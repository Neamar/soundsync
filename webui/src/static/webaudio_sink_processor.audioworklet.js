// This file is copied directly by parcel to the root of the dist folder
// without any transformers applying, we can only use JS
// This is necessary as Parcel don't handle requiring an AudioWorklet file for now

// TODO: use Parcel transformers for this file to be able to use imports and typescript features

const BUFFER_SIZE_IN_SECONDS = 10;
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BUFFER_SIZE = BUFFER_SIZE_IN_SECONDS * SAMPLE_RATE * CHANNELS;

class CircularTypedArray {
  constructor(TypedArrayConstructor, length) {
    this.TypedArrayConstructor = TypedArrayConstructor;
    this.buffer = new TypedArrayConstructor(length);
  }

  set(data, offset) {
    const realOffset = offset % this.buffer.length;
    const overflow = Math.max(0, (realOffset + data.length) - this.buffer.length);
    if (!overflow) {
      this.buffer.set(data, realOffset);
      return;
    }
    this.buffer.set(data.subarray(0, data.length - overflow), realOffset);
    this.set(data.subarray(data.length - overflow), realOffset + (data.length - overflow));
  }

  get(offset, length) {
    // TODO: implement a way to reset read samples to 0 to prevent outputting the same sample
    // again if the buffer runs too low and we don't have the new chunk from the source
    const realOffset = offset % this.buffer.length;
    const overflow = Math.max(0, (realOffset + length) - this.buffer.length);
    if (!overflow) {
      return this.buffer.subarray(realOffset, realOffset + length);
    }
    const output = new this.TypedArrayConstructor(length);
    output.set(this.buffer.subarray(realOffset, this.buffer.length - overflow), 0);
    output.set(this.buffer.subarray(0, overflow), length - overflow);
    return output;
  }

  // this will copy the info in another buffer passed in parameter and empty the current buffer for this offset + length
  getInTypedArray(targetTypedArray, offset, length) {
    const realOffset = offset % this.buffer.length;
    const overflow = Math.max(0, (realOffset + length) - this.buffer.length);
    if (!overflow) {
      targetTypedArray.set(this.buffer.subarray(realOffset, realOffset + length));
      this.buffer.fill(0, realOffset, realOffset + length);
    } else {
      targetTypedArray.set(this.buffer.subarray(realOffset, this.buffer.length - overflow), 0);
      this.buffer.fill(0, realOffset, this.buffer.length - overflow);
      targetTypedArray.set(this.buffer.subarray(0, overflow), length - overflow);
      this.buffer.fill(0, 0, overflow);
    }
  }
}

class RawPcmPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.port.onmessage = this.handleMessage_.bind(this);
    this.buffer = new CircularTypedArray(Float32Array, BUFFER_SIZE);

    this.currentSampleIndex = 0;
    this.chunkBuffer = new Float32Array(128 * CHANNELS);
  }

  handleMessage_(event) {
    if (event.data.type === 'chunk') {
      this.buffer.set(event.data.chunk, event.data.i * SAMPLE_RATE * 0.01 * 2);
    }
    if (event.data.type === 'sourceTimeAtAudioTimeOrigin') {
      this.currentSampleIndex = Math.floor((event.data.sourceTimeAtAudioTimeOrigin * SAMPLE_RATE) / 1000);
    }
  }

  process(inputs, outputs) {
    // we cannot rely on the currentTime property to know which sample needs to be sent because
    // the precision is not high enough so we synchronize once the this.currentSampleIndex from the sourceTimeAtAudioTimeOrigin
    // message and then increase the currentSampleIndex everytime we output samples
    this.buffer.getInTypedArray(this.chunkBuffer, this.currentSampleIndex * CHANNELS, outputs[0][0].length * CHANNELS);

    for (let sampleIndex = 0; sampleIndex < outputs[0][0].length; sampleIndex++) {
      outputs[0][0][sampleIndex] = this.chunkBuffer[sampleIndex * 2];
      outputs[0][1][sampleIndex] = this.chunkBuffer[sampleIndex * 2 + 1];
      this.currentSampleIndex += 2;
    }

    return true;
  }
}

registerProcessor('rawPcmPlayerProcessor', RawPcmPlayerProcessor);
