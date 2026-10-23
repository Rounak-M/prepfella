/* eslint-disable @next/next/no-img-element -- static SVG icon */
"use client";

import { ChartColumn, Code, Network, Send, ShieldCheck, Target, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { AdviceReply } from "@/components/advice/AdviceReply";
import { api, ApiError, type AdviceMessage, type Profile } from "@/lib/api";

const STARTERS = [
  { icon: ShieldCheck, text: "I want to get into cybersecurity. Where do I start?" },
  { icon: Network, text: "Teach me system design for interviews" },
  { icon: ChartColumn, text: "Make me a data analyst from scratch" },
  { icon: Code, text: "Help me crack DSA for placements in 3 months" },
];

/** Advice: tell Fella a goal role or topics, get a phased roadmap with free courses and YouTube playlists. */
export default function AdvicePage() {
  const [messages, setMessages] = useState<AdviceMessage[] | null>(null);
  const [role, setRole] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; message: string } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<AdviceMessage[]>("/advice/messages").then(setMessages).catch(() => setMessages([]));
    api<Profile>("/profile").then((p) => setRole(p.target_role)).catch(() => {});
  }, []);

  // A fresh chat starts at the top (the welcome + starters); an ongoing one keeps the newest message in view.
  useEffect(() => {
    const el = list.current;
    if (!el || !messages) return;
    if (!messages.length && !pending) el.scrollTo({ top: 0 });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setError(null);
    setPending(message);
    try {
      const res = await api<{ user: AdviceMessage; assistant: AdviceMessage }>("/advice/chat", { method: "POST", body: JSON.stringify({ message }) });
      setMessages((m) => [...(m ?? []), res.user, res.assistant]);
    } catch (err) {
      setError({ text: message, message: err instanceof ApiError ? err.message : "Couldn't reach Fella" });
    } finally {
      setPending(null);
    }
  }

  async function clear() {
    if (!confirm("Clear this advice conversation?")) return;
    await api("/advice/messages", { method: "DELETE" });
    setMessages([]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  const starters = role ? [{ icon: Target, text: `What should I learn to become a ${role}?` }, ...STARTERS] : STARTERS;
  const empty = messages?.length === 0 && !pending;

  return (
    <section className="neu flex h-[calc(100dvh-11rem)] flex-col rounded-[28px] lg:h-[calc(100dvh-3rem)]">
      <header className="flex items-center gap-3 p-5 sm:px-7 sm:pt-6">
        <img src="/brand/fella.svg" alt="" className="size-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Advice</h1>
          <p className="truncate text-sm text-[var(--muted)]">Tell Fella your goal role or what you want to learn. Get a roadmap with free courses and playlists.</p>
        </div>
        {!!messages?.length && (
          <button type="button" onClick={clear} aria-label="Clear conversation" title="Clear conversation"
            className="neu-btn grid size-9 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--danger)]">
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <div ref={list} className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-7" aria-live="polite">
        {!messages && <p className="text-sm text-[var(--muted)]">Loading…</p>}
        {empty && (
          <div className="m-auto flex w-full max-w-2xl flex-col items-center gap-5 py-6 text-center">
            <img src="/brand/fella.svg" alt="" className="size-16 rounded-2xl" />
            <div>
              <h2 className="text-lg font-semibold">What do you want to grow into?</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">A role, a topic, a deadline — Fella plans the steps and picks free courses, guides and YouTube playlists.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              {starters.map(({ icon: Icon, text }) => (
                <button key={text} type="button" onClick={() => send(text)}
                  className="neu-inset flex items-center gap-3 rounded-2xl p-3.5 text-left text-sm transition hover:-translate-y-0.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[image:var(--primary-gradient)] text-white"><Icon size={17} /></span>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[image:var(--primary-gradient)] px-4 py-2.5 text-sm whitespace-pre-line text-white sm:max-w-[70%]">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <img src="/brand/fella.svg" alt="" className="mt-1 size-8 shrink-0 rounded-lg" />
              <div className="neu-inset min-w-0 flex-1 rounded-3xl rounded-tl-lg p-4 sm:p-5">
                <AdviceReply content={m.content} resources={m.resources} />
              </div>
            </div>
          ),
        )}

        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[image:var(--primary-gradient)] px-4 py-2.5 text-sm whitespace-pre-line text-white sm:max-w-[70%]">{pending}</div>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <img src="/brand/fella.svg" alt="" className="size-8 rounded-lg motion-safe:animate-bounce" />
              Fella is building your roadmap…
            </div>
          </>
        )}

        {error && (
          <div className="neu-inset flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="text-[var(--danger)]">{error.message}</span>
            <button type="button" onClick={() => send(error.text)} className="neu-btn ml-auto rounded-full px-3 py-1 text-xs">Try again</button>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-3 p-4 sm:px-7 sm:pb-6">
        <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} rows={1}
          placeholder="e.g. I want to become a cloud engineer in 6 months" aria-label="Your goal or question"
          className="field max-h-32 min-h-11 resize-none" />
        <button type="submit" disabled={!draft.trim() || !!pending} aria-label="Send"
          className="btn-primary grid size-11 shrink-0 place-items-center rounded-2xl">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
