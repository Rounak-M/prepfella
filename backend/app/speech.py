"""Hosted NVIDIA speech over gRPC: Magpie TTS and Riva ASR (build.nvidia.com free endpoints)."""
import io
import threading
import wave
from concurrent.futures import Future, ThreadPoolExecutor

import grpc
import riva.client

from . import cache, ratelimit
from .config import get_settings

_TRANSIENT = {grpc.StatusCode.RESOURCE_EXHAUSTED, grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED,
              grpc.StatusCode.INTERNAL}


def _transient(e: Exception) -> bool:
    return isinstance(e, grpc.RpcError) and e.code() in _TRANSIENT


def _auth(function_id: str, api_key: str) -> riva.client.Auth:
    return riva.client.Auth(
        uri=get_settings().riva_server,
        use_ssl=True,
        metadata_args=[["function-id", function_id], ["authorization", f"Bearer {api_key}"]],
    )


# Uncached TTS takes ~1.5–2 s, about as long as the browser waits before using its own voice. So the question's audio
# is started the moment the question exists (prefetch), and the browser's request joins that in-flight call.
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tts-prefetch")
_inflight: dict[str, Future] = {}
_inflight_lock = threading.Lock()


def prefetch(text: str) -> None:
    """Synthesize in the background so the audio is cached (or in progress) when the browser asks for it."""
    def run():
        try:
            synthesize(text, max_wait=10.0)
        except Exception:
            pass  # the browser's own request retries, or it falls back to browser speech
    _pool.submit(run)


def synthesize(text: str, *, max_wait: float = 3.0) -> bytes:
    """Text → WAV bytes (16-bit mono PCM). Cached on disk by (text, voice, rate); a call for text that is already being
    synthesized waits for that call. Short max_wait by default: when the budget is full it is better to raise
    ratelimit.Busy fast and let the browser speak the question itself."""
    s = get_settings()
    k = cache.key(text, s.tts_voice, s.tts_sample_rate)
    if (hit := cache.get_bytes("tts", k, "wav")) is not None:
        return hit
    with _inflight_lock:
        fut = _inflight.get(k)
        owner = fut is None
        if owner:
            fut = _inflight[k] = Future()
    if not owner:
        return fut.result(timeout=30)
    try:
        wav = _synthesize(text, k, max_wait)
        fut.set_result(wav)
        return wav
    except BaseException as e:
        fut.set_exception(e)
        raise
    finally:
        with _inflight_lock:
            _inflight.pop(k, None)


def _synthesize(text: str, k: str, max_wait: float) -> bytes:
    s = get_settings()
    tts = riva.client.SpeechSynthesisService(_auth(s.tts_function_id, s.tts_api_key))
    resp = ratelimit.call(
        f"tts:{s.tts_function_id}",
        lambda: tts.synthesize(text, voice_name=s.tts_voice, language_code="en-US", sample_rate_hz=s.tts_sample_rate),
        is_transient=_transient,
        max_wait=max_wait,
        retries=1,
    )
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(s.tts_sample_rate)
        w.writeframes(resp.audio)
    cache.put_bytes("tts", k, "wav", buf.getvalue())
    return buf.getvalue()


def transcribe(wav_bytes: bytes, *, max_wait: float = 20.0) -> str:
    """WAV bytes (16-bit mono PCM) → transcript. The browser should send 16 kHz WAV. Rate-limited per function."""
    s = get_settings()
    with wave.open(io.BytesIO(wav_bytes)) as w:
        rate, pcm = w.getframerate(), w.readframes(w.getnframes())
    asr = riva.client.ASRService(_auth(s.asr_function_id, s.nvidia_api_key))
    config = riva.client.RecognitionConfig(
        encoding=riva.client.AudioEncoding.LINEAR_PCM,
        sample_rate_hertz=rate,
        language_code="en-US",
        max_alternatives=1,
        enable_automatic_punctuation=True,
        audio_channel_count=1,
    )
    # The hosted Parakeet endpoint only serves streaming ("Unavailable model ... type=offline"),
    # so we stream the whole recording in 100 ms-ish chunks and keep the final results.
    streaming = riva.client.StreamingRecognitionConfig(config=config, interim_results=False)
    chunks = [pcm[i : i + 3200] for i in range(0, len(pcm), 3200)]
    def run() -> list[str]:  # the RPC happens while iterating, so the whole loop is the retried unit
        return [
            r.alternatives[0].transcript.strip()
            for resp in asr.streaming_response_generator(audio_chunks=chunks, streaming_config=streaming)
            for r in resp.results
            if r.is_final and r.alternatives
        ]

    parts = ratelimit.call(f"asr:{s.asr_function_id}", run, is_transient=_transient, max_wait=max_wait)
    return " ".join(parts).strip()
