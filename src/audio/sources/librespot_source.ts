import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { hostname } from 'os';
import { createReadStream } from 'fs';
import { AudioSource } from './audio_source';
import { LibresportSourceDescriptor } from './source_type';
import { AudioSourcesSinksManager } from '../audio_sources_sinks_manager';
import { createAudioEncodedStream } from '../opus_streams';

export class LibrespotSource extends AudioSource {
  local = true;
  rate = 44100;
  channels = 2;

  options: LibresportSourceDescriptor['librespotOptions'];
  librespotProcess: ChildProcessWithoutNullStreams;
  testPcm: NodeJS.ReadableStream;

  constructor(descriptor: LibresportSourceDescriptor, manager: AudioSourcesSinksManager) {
    super(descriptor, manager);
    this.options = descriptor.librespotOptions || {};
    this.options.name = this.options.name || hostname();

    this.log(`Starting librespot process`);
    this.librespotProcess = spawn(`librespot`, [
      '-n', this.options.name,
      '--backend', 'pipe',
      '--initial-volume', '100',
      '-v',
      ...(this.options.bitrate ? ['-b', String(this.options.bitrate)] : []),
      ...(this.options.username ? [
        '-u', this.options.username,
        '-p', this.options.password,
      ] : []),
    ]);
    const librespotLog = this.log.extend('librespot');
    this.librespotProcess.stderr.on('data', (d) => librespotLog(d.toString()));
    this.librespotProcess.on('exit', (code) => {
      this.log('Librespot excited with code:', code);
    });
    this.testPcm = createReadStream('./test.pcm');
  }

  _getAudioEncodedStream() {
    return createAudioEncodedStream(this.testPcm, this.rate, this.channels);
    // return createAudioEncodedStream(this.librespotProcess.stdout, this.rate, this.channels);
  }

  toDescriptor: (() => LibresportSourceDescriptor) = () => ({
    type: 'librespot',
    name: this.name,
    uuid: this.uuid,
    librespotOptions: this.options,
    peerUuid: this.peerUuid,
  })
}
