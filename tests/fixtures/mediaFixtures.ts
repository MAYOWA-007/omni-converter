export function createSineWavBytes(durationSeconds = 2, sampleRate = 8_000, channels = 1) {
  const frameCount = Math.round(durationSeconds * sampleRate);
  const dataBytes = frameCount * channels * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sample = Math.sin((frame / sampleRate) * Math.PI * 2 * 440) * 0.5;
    for (let channel = 0; channel < channels; channel += 1) {
      view.setInt16(offset, Math.round(sample * 0x7fff), true);
      offset += 2;
    }
  }
  return bytes;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}
