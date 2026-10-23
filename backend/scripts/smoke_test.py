"""Checks every NVIDIA service PrepFella depends on. Run from backend/: python -m scripts.smoke_test

1. lists the Nemotron models your key can see
2. one JSON chat completion on NIM_MODEL_FAST (and NIM_MODEL_DEEP)
3. Magpie TTS → tmp/smoke.wav
4. ASR on that WAV (round trip)
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import llm, speech  # noqa: E402
from app.config import get_settings  # noqa: E402

TMP = Path(__file__).resolve().parents[1] / "tmp"


def step(name, fn):
    t = time.perf_counter()
    try:
        out = fn()
        print(f"PASS  {name}  ({time.perf_counter() - t:.1f}s)  {out if out is not None else ''}")
        return True
    except Exception as e:  # report and keep going so one run shows every problem
        print(f"FAIL  {name}  ({time.perf_counter() - t:.1f}s)  {type(e).__name__}: {e}")
        return False


def main():
    s = get_settings()
    if not s.nvidia_api_key:
        sys.exit("NVIDIA_API_KEY is empty: copy .env.example to .env at the repo root and paste your key from build.nvidia.com")

    step("list Nemotron models", lambda: [m.id for m in llm.client().models.list() if "nemotron" in m.id.lower()])
    for label, deep, model in (("fast", False, s.model_fast), ("deep", True, s.model_deep)):
        if model:
            step(f"chat_json on {label} model {model}",
                 lambda deep=deep: llm.chat_json("Reply with JSON only.", 'Return {"ok": true, "word": "<one word for interview>"}', deep=deep, max_tokens=300))
        else:
            print(f"SKIP  chat_json on {label} model (NIM_MODEL_{label.upper()} not set; pick one from the list above)")

    TMP.mkdir(exist_ok=True)
    wav = TMP / "smoke.wav"
    if s.tts_function_id and step("Magpie TTS", lambda: wav.write_bytes(speech.synthesize("Tell me about a project you are proud of.")) and f"→ {wav}"):
        if s.asr_function_id:
            step("ASR round trip", lambda: repr(speech.transcribe(wav.read_bytes())))
        else:
            print("SKIP  ASR (ASR_FUNCTION_ID not set)")
    elif not s.tts_function_id:
        print("SKIP  TTS (TTS_FUNCTION_ID not set)")


if __name__ == "__main__":
    main()
