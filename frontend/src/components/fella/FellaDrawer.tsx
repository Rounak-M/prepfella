/* eslint-disable @next/next/no-img-element -- static SVG icon */
"use client";

import { Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";

import { api, ApiError, type ChatMessage } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";

const SUGGESTIONS = [
  "Why did my last interview score low?",
  "Quiz me on my weakest topic",
  "Rewrite my resume headline",
  "What should I practise next?",
];

type Pending = { id: number; text: string; failed: boolean };

/** Floating Fella button + chat drawer, mounted once in AppShell so it's on every signed-in page. */
export function FellaDrawer() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false); // plays the fly-back animation before unmounting
  // Offset from the screen centre to the round button: the window flies out of (and back into) that spot.
  const [fly, setFly] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [draft, setDraft] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 320);
  }, []);

  function openFromButton() {
    const r = button.current?.getBoundingClientRect();
    if (r) setFly({ x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 });
    setOpen(true);
  }

  // Load history on first open.
  useEffect(() => {
    if (!open || messages) return;
    api<ChatMessage[]>("/assistant/messages")
      .then(setMessages)
      .catch(() => setLoadError(true));
  }, [open, messages]);

  // Focus the input on open; give focus back to the button on close. Escape closes. The page behind is locked so
  // scrolling the chat never scrolls the dashboard.
  useEffect(() => {
    if (open) {
      input.current?.focus();
      const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close();
      window.addEventListener("keydown", onKey);
      const root = document.documentElement;
      const prevOverflow = root.style.overflow;
      root.style.overflow = "hidden";
      wasOpen.current = true;
      return () => {
        window.removeEventListener("keydown", onKey);
        root.style.overflow = prevOverflow;
      };
    }
    if (wasOpen.current) button.current?.focus();
  }, [open, close]);

  // Keep the newest message in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    text = text.trim();
    if (!text || (pending && !pending.failed)) return;
    const id = Date.now();
    setPending({ id, text, failed: false });
    setDraft("");
    try {
      const res = await api<{ user: ChatMessage; assistant: ChatMessage }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((m) => [...(m ?? []), res.user, res.assistant]);
      setPending(null);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 503) {
        setPending(null);
        setDraft(text);
        setLoadError(true);
      } else {
        setPending({ id, text, failed: true });
      }
    }
  }

  async function clearHistory() {
    if (!confirm("Clear your conversation with Fella?")) return;
    await api("/assistant/messages", { method: "DELETE" });
    setMessages([]);
    setPending(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  const onlyGreeting = !!messages && messages.every((m) => m.role === "assistant");
  const thinking = !!pending && !pending.failed;

  return (
    <>
      {!open && (
        <button
          ref={button}
          type="button"
          onClick={openFromButton}
          aria-label="Open Fella, your interview coach"
          title="Ask Fella"
          className="neu-btn fixed top-4 right-3 z-40 grid size-14 place-items-center rounded-full transition hover:translate-y-0.5 sm:top-6 lg:right-[calc(max(0px,50%-740px)/2+16px)] lg:size-16"
        >
          <img src="/brand/fella.svg" alt="" className="size-10 rounded-xl" />
        </button>
      )}

      {open && (
        <div className={`fella-overlay fixed inset-0 z-50 grid place-items-center overscroll-contain bg-[var(--overlay)] backdrop-blur-xl sm:p-6 ${closing ? "is-closing" : ""}`}
          style={{ "--fly-x": `${fly.x}px`, "--fly-y": `${fly.y}px` } as CSSProperties} onClick={close}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Fella, your interview coach"
            onClick={(e) => e.stopPropagation()}
            className="fella-panel neu flex h-full w-full flex-col sm:h-[min(86vh,820px)] sm:w-[min(880px,100%)] sm:rounded-[32px] sm:shadow-2xl"
          >
            <header className="flex items-center gap-3 p-4 sm:px-8 sm:pt-7">
              <img src="/brand/fella.svg" alt="" className="size-10 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Fella</div>
                <div className="truncate text-xs text-[var(--muted)]">your interview coach</div>
              </div>
              {!!messages?.length && (
                <button type="button" onClick={clearHistory} aria-label="Clear conversation" title="Clear conversation"
                  className="neu-btn grid size-9 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--danger)]">
                  <Trash2 size={15} />
                </button>
              )}
              <button type="button" onClick={close} aria-label="Close Fella" className="neu-btn grid size-9 place-items-center rounded-full">
                <X size={16} />
              </button>
            </header>

            <div ref={list} className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-4 sm:px-8" aria-live="polite">
              {!messages && !loadError && <p className="text-sm text-[var(--muted)]">Loading…</p>}
              {loadError && <p className="text-sm text-[var(--danger)]">Couldn&apos;t reach Fella. Check the backend is running.</p>}
              {messages?.length === 0 && !pending && (
                <div className="neu rounded-3xl rounded-bl-lg px-4 py-3 text-sm">
                  Hi! I&apos;m Fella. I can explain your scores, quiz you on weak spots, or polish your resume and LinkedIn.
                </div>
              )}
              {messages?.map((m) => (
                <MessageBubble key={m.id} message={m} onAnswerQuiz={() => input.current?.focus()} />
              ))}
              {pending && (
                <MessageBubble
                  message={{ id: pending.id, role: "user", content: pending.text, quiz: null, created_at: "" }}
                  failed={pending.failed}
                  onRetry={() => send(pending.text)}
                />
              )}
              {thinking && (
                <div className="neu flex w-16 items-center justify-center gap-1 rounded-3xl rounded-bl-lg py-3" aria-label="Fella is typing">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-1.5 rounded-full bg-[var(--muted)] motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
              {messages && (messages.length === 0 || onlyGreeting) && !pending && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="neu-btn rounded-full px-3 py-1.5 text-xs text-[var(--primary)]">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-end gap-3 p-4 sm:px-8 sm:pb-7"
            >
              <textarea
                ref={input}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask Fella anything…"
                aria-label="Message Fella"
                maxLength={2000}
                className="field max-h-32 min-h-11 resize-none"
              />
              <button type="submit" disabled={!draft.trim() || thinking} aria-label="Send"
                className="btn-primary grid size-11 shrink-0 place-items-center rounded-2xl">
                <Send size={16} />
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
