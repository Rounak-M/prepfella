// Interviewer voice: the backend's TTS audio, falling back to the browser's own speech when TTS is busy/slow.
import { questionAudioUrl } from "@/lib/api";

const TTS_TIMEOUT_MS = 2000;

export type Playback = { done: Promise<void>; stop: () => void };

/** Speak a question. Resolves `done` when speaking ends (or fails — the interview must never wait forever). */
export function speakQuestion(sessionId: number, idx: number, text: string): Playback {
  const abort = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  let stopped = false;

  const done = (async () => {
    // Slow TTS → abort the fetch, which rejects it, and fall through to browser speech.
    const timer = setTimeout(() => abort.abort(), TTS_TIMEOUT_MS);
    try {
      url = await questionAudioUrl(sessionId, idx, abort.signal);
      clearTimeout(timer);
      if (stopped) return;
      audio = new Audio(url);
      await playToEnd(audio);
    } catch {
      clearTimeout(timer);
      if (!stopped) await browserSpeak(text);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  })();

  return {
    done,
    stop: () => {
      stopped = true;
      abort.abort();
      audio?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
  };
}

function playToEnd(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onpause = () => resolve(); // stopped by the user / page
    audio.onerror = () => reject(new Error("audio playback failed"));
    audio.play().catch(reject); // e.g. autoplay blocked → browser speech below
  });
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Some browsers never fire onend when speech is unavailable; don't block the interview on it.
    setTimeout(resolve, Math.max(4000, text.split(" ").length * 450));
  });
}
