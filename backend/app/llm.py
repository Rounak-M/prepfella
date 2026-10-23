"""Nemotron via NVIDIA's OpenAI-compatible NIM API. Every AI feature goes through chat_json."""
import json
import logging
import re

import openai
from openai import OpenAI

from . import cache, ratelimit
from .config import get_settings

log = logging.getLogger("prepfella")
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


def client() -> OpenAI:
    s = get_settings()
    # max_retries=0: ratelimit.call does the retrying, so every attempt is counted against the budget.
    return OpenAI(base_url=s.nim_base_url, api_key=s.nvidia_api_key, max_retries=0, timeout=60)


def _transient(e: Exception) -> bool:
    return isinstance(e, (openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)) or (
        isinstance(e, openai.APIStatusError) and e.status_code in (429, 502, 503, 504)
    )


def parse_json(text: str) -> dict:
    """Pull the JSON object out of a model reply (strips reasoning blocks and code fences)."""
    text = _THINK.sub("", text).strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object in model reply: {text[:200]!r}")
    return json.loads(text[start : end + 1])


def chat_json(system: str, user: str, *, deep: bool = False, temperature: float = 0.3, max_tokens: int = 1500,
              thinking: bool = False, use_cache: bool = True, max_wait: float = 25.0) -> dict:
    """Rate-limited per model (ratelimit.py) and cached on disk by exact input. Raises ratelimit.Busy when the
    model's budget stays full for more than max_wait seconds."""
    model = get_settings().model_deep if deep else get_settings().model_fast
    k = cache.key(model, system, user, temperature, max_tokens, thinking)
    if use_cache and (hit := cache.get_json("llm", k)) is not None:
        return hit
    result = parse_json(chat_text(system, user, deep=deep, temperature=temperature, max_tokens=max_tokens,
                                  thinking=thinking, max_wait=max_wait))
    if use_cache:
        cache.put_json("llm", k, result)
    return result


def chat_text(system: str, user: str, *, deep: bool = False, temperature: float = 0.3, max_tokens: int = 1500,
              thinking: bool = False, max_wait: float = 25.0) -> str:
    """Plain-text reply (no JSON contract, no cache) — for conversation, where models drift out of JSON."""
    model = get_settings().model_deep if deep else get_settings().model_fast

    def run():
        return client().chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=temperature,
            max_tokens=max_tokens,
            # Nemotron 3.x reasons by default and can spend the whole budget before answering (finish=length, empty
            # content). This switch turns it off: ~9 s instead of 35+ s. "/no_think" and reasoning_effort do NOT work.
            extra_body={"chat_template_kwargs": {"enable_thinking": thinking}},
        )

    resp = ratelimit.call(f"llm:{model}", run, is_transient=_transient, max_wait=max_wait)
    return _THINK.sub("", resp.choices[0].message.content or "").strip()


def try_chat_json(system: str, user: str, **kwargs) -> dict | None:
    """chat_json with one retry on an unparseable reply. Returns None when the AI is unavailable (budget full,
    API error, bad JSON twice) so the caller can fall back and the demo never dead-ends."""
    for attempt in range(2):
        try:
            return chat_json(system, user, **kwargs)
        except ValueError as e:
            log.warning("unparseable AI reply (attempt %d): %s", attempt + 1, e)
        except (openai.APIError, ratelimit.Busy) as e:
            log.warning("AI unavailable: %s", e)
            return None
    return None
