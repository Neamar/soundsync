import { debounce, map } from 'lodash-es';
import { getAudioSourcesSinksManager } from '../../../src/audio/audio_sources_sinks_manager';
import { getPeersManager } from '../../../src/communication/peers_manager';

import { registerLocalPeer, getLocalPeer } from '../../../src/communication/local_peer';
import { getClientCoordinator } from '../../../src/coordinator/client_coordinator';
import { initConfig, getConfigField } from '../../../src/coordinator/config';

initConfig();
registerLocalPeer({
  name: 'Web page',
  uuid: getConfigField('uuid'),
  capacities: [],
});

let initializePromise: Promise<void>;

export const initializeCoordinator = async () => {
  const innerInitialize = async () => {
    const peersManager = getPeersManager();

    const peerHost = document.location.port === '8080' ? `http://${document.location.hostname}:6512` : `http://${document.location.host}`;
    await peersManager.joinPeerWithHttpApi(peerHost, undefined, true);

    const audioSourcesSinksManager = getAudioSourcesSinksManager();
    audioSourcesSinksManager.addFromConfig();
    // attachTimekeeperClient(peersManager);
    // await waitForFirstTimeSync();
    getClientCoordinator();
    audioSourcesSinksManager.addSink({
      type: 'webaudio',
      name: 'Web Page Output',
      peerUuid: getLocalPeer().uuid,
    });
  };
  if (initializePromise) {
    return initializePromise;
  }
  initializePromise = innerInitialize();
  return initializePromise;
};

export const onSoundStateChange = async (listener) => {
  await initializeCoordinator();
  const debouncedListener = debounce(listener);
  getAudioSourcesSinksManager().on('soundstateUpdated', debouncedListener);
};

export const getSoundState = async () => {
  await initializeCoordinator();

  return {
    sources: getAudioSourcesSinksManager().sources.filter((s) => s.peer && s.peer.state === 'connected').map((source) => source.toObject()),
    sinks: getAudioSourcesSinksManager().sinks.filter((s) => s.peer && s.peer.state === 'connected').map((sink) => sink.toObject()),
    peers: map(getPeersManager().peers, (peer) => ({
      name: peer.name,
      uuid: peer.uuid,
    })),
  };
};
