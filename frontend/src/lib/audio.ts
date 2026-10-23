// Mic recording for voice answers. The backend's speech-to-text wants 16 kHz mono 16-bit PCM WAV, so we record with
// MediaRecorder (webm/opus or mp4), decode it, and let an OfflineAudioContext downmix + resample before encoding.

const TARGET_RATE = 16000;

export class MicError extends Error {}

export type Recording = { wav: Blob; seconds: number };

export type Recorder = {
  /** Live input for the level meter / waveform. */
  analyser: AnalyserNode;
  stop: () => Promise<Recording>;
  /** Stop without producing a recording (e.g. the page was left). */
  cancel: () => void;
};

export async function startRecording(): Promise<Recorder> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new MicError("This browser can't record audio. Switch to text mode or try Chrome or Edge.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError")
      throw new MicError("Microphone access was blocked. Allow it from the address bar, or type your answer instead.");
    if (name === "NotFoundError") throw new MicError("No microphone found. Plug one in, or type your answer instead.");
    throw new MicError("Couldn't start the microphone. Type your answer instead.");
  }

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const startedAt = performance.now();
  recorder.start();

  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  return {
    analyser,
    stop: () =>
      new Promise<Recording>((resolve, reject) => {
        recorder.onstop = async () => {
          const seconds = (performance.now() - startedAt) / 1000;
          try {
            const raw = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
            const decoded = await ctx.decodeAudioData(raw);
            resolve({ wav: await toWav16k(decoded), seconds });
          } catch {
            reject(new MicError("Couldn't process that recording. Try again, or type your answer."));
          } finally {
            release();
          }
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

/** Downmix to mono and resample to 16 kHz (OfflineAudioContext does both), then encode 16-bit PCM WAV. */
async function toWav16k(buffer: AudioBuffer): Promise<Blob> {
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * TARGET_RATE)), TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  });
  return new Blob([view], { type: "audio/wav" });
}

/** Current input level 0–1 (RMS of the time-domain signal, boosted so speech fills the meter). */
export function micLevel(analyser: AnalyserNode, buf = new Uint8Array(analyser.fftSize)): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const b of buf) sum += ((b - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}
