import type { AudioCodec } from "mediabunny";

type EncoderProbe = {
  numberOfChannels: number;
  sampleRate: number;
  bitrate: number;
};

const registrations = new Map<string, Promise<void>>();

export async function ensureAudioEncoder(
  media: typeof import("mediabunny"),
  codec: AudioCodec,
  probe: EncoderProbe,
  options: { preferBundled?: boolean } = {}
) {
  if ((!options.preferBundled || !hasBundledAudioEncoder(codec)) && await media.canEncodeAudio(codec, probe)) return;

  const registrationKey = codec === "eac3" ? "ac3" : codec;
  let registration = registrations.get(registrationKey);
  if (!registration) {
    registration = registerEncoder(codec);
    registrations.set(registrationKey, registration);
  }
  await registration;

  if (!await media.canEncodeAudio(codec, probe)) {
    throw new Error(`${audioCodecLabel(codec)} encoding is not supported by this browser and device.`);
  }
}

export function hasBundledAudioEncoder(codec: AudioCodec) {
  return codec === "mp3" || codec === "flac" || codec === "aac" || codec === "ac3" || codec === "eac3";
}

async function registerEncoder(codec: AudioCodec) {
  if (codec === "mp3") {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
    return;
  }
  if (codec === "flac") {
    const { registerFlacEncoder } = await import("@mediabunny/flac-encoder");
    registerFlacEncoder();
    return;
  }
  if (codec === "aac") {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    return;
  }
  if (codec === "ac3" || codec === "eac3") {
    const { registerAc3Encoder } = await import("@mediabunny/ac3");
    registerAc3Encoder();
  }
}

function audioCodecLabel(codec: AudioCodec) {
  if (codec === "eac3") return "E-AC-3";
  return codec.toUpperCase();
}
