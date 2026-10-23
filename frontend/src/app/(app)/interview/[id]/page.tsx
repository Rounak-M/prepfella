"use client";

import { Eye, EyeOff, Flag, Keyboard, Mic, RotateCcw, Square, Volume2, Waypoints } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";

/* eslint-disable @next/next/no-img-element -- static SVG avatar */
import { ScoresPanel } from "@/components/interview/ScoresPanel";
import { ThinkingIndicator } from "@/components/interview/ThinkingIndicator";
import { speakQuestion, type Playback } from "@/components/interview/voice";
import { Waveform } from "@/components/interview/Waveform";
import { api, ApiError, type AnswerResponse, type SessionDetail, type Turn } from "@/lib/api";
import { MicError, startRecording, type Recorder } from "@/lib/audio";

// speaking → ready (listening / typing) → recording (voice) → thinking → next question … → finishing → report
type Phase = "loading" | "speaking" | "ready" | "recording" | "thinking" | "finishing";
type Notice = { message: string; retry?: () => void };

const FINISHING = ["Collecting your answers…", "Comparing against strong answers…", "Writing your report…", "Planning your next session…"];

// Colour per adaptive move, so the path through the interview is visible at a glance.
const LABEL_TONE: Record<string, string> = {
  "Follow-up": "var(--accent-cyan)",
  Harder: "var(--accent-pink)",
  Easier: "var(--success)",
  "Verifying your resume": "var(--primary)",
};

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="neu h-96 animate-pulse rounded-[28px]" />}>
      <InterviewRoom />
    </Suspense>
  );
}

function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lastEval, setLastEval] = useState<Turn | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [typing, setTyping] = useState(false); // voice interview, but this turn is typed (mic/ASR problem or by choice)
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<Recorder | null>(null);
  const playback = useRef<Playback | null>(null);
  const askedAt = useRef(0);

  const current = turns.find((t) => !t.answered) ?? null;
  const answered = turns.filter((t) => t.answered);
  const previous = answered.at(-1) ?? null;
  const voiceTurn = session?.mode === "voice" && !typing;

  /** Put a question to the candidate: speak it in voice mode, then open the answer. */
  function ask(turn: Turn, mode: "voice" | "text") {
    playback.current?.stop();
    setElapsed(0);
    if (mode === "text") {
      askedAt.current = Date.now();
      setPhase("ready");
      return;
    }
    setPhase("speaking");
    const p = speakQuestion(sessionId, turn.idx, turn.question);
    playback.current = p;
    p.done.then(() => {
      if (playback.current !== p) return; // a newer question took over
      playback.current = null;
      askedAt.current = Date.now();
      setPhase("ready");
    });
  }

  async function finish() {
    playback.current?.stop();
    setPhase("finishing");
    setNotice(null);
    try {
      await api(`/sessions/${sessionId}/finish`, { method: "POST" });
      router.push(`/report/${sessionId}`);
    } catch (err) {
      setNotice({ message: err instanceof ApiError ? err.message : "Couldn't write the report.", retry: finish });
    }
  }

  useEffect(() => {
    api<SessionDetail>(`/sessions/${sessionId}`)
      .then((s) => {
        if (s.status === "finished") {
          router.replace(`/report/${sessionId}`);
          return;
        }
        setSession(s);
        setTurns(s.turns);
        setLastEval(s.turns.filter((t) => t.answered).at(-1) ?? null);
        const open = s.turns.find((t) => !t.answered);
        if (open) ask(open, s.mode);
        else finish(); // every question answered but the report was never written
      })
      .catch((err) => setNotice({ message: err instanceof ApiError && err.status === 404 ? "Interview not found." : "Couldn't load the interview." }));
    // Stop the voice and mic if the candidate leaves mid-interview.
    const media = { playback, recorder };
    return () => {
      media.playback.current?.stop();
      media.recorder.current?.cancel();
    };
    // ask/finish are plain functions recreated each render; this should run once per interview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (phase !== "ready" && phase !== "recording") return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - askedAt.current) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase]);

  async function submit(form: FormData) {
    setPhase("thinking");
    setNotice(null);
    try {
      const r = await api<AnswerResponse>(`/sessions/${sessionId}/answer`, { method: "POST", body: form });
      setLastEval(r.evaluation);
      setLastTranscript(r.transcript);
      setTurns((ts) => [...ts.map((t) => (t.idx === r.evaluation.idx ? r.evaluation : t)), ...(r.next ? [r.next] : [])]);
      setText("");
      setTyping(false);
      if (r.done || !r.next) finish();
      else ask(r.next, session!.mode);
    } catch (err) {
      setPhase("ready");
      if (err instanceof ApiError && err.code === "asr_unavailable") {
        setTyping(true);
        setNotice({ message: "We couldn't transcribe that recording. Type your answer below instead." });
      } else if (err instanceof ApiError && err.code === "busy") {
        setNotice({ message: "The AI is busy for a moment. Your answer is safe.", retry: () => submit(form) });
      } else {
        setNotice({ message: err instanceof ApiError ? err.message : "Couldn't send your answer.", retry: () => submit(form) });
      }
    }
  }

  function submitText() {
    if (!text.trim() || phase !== "ready") return;
    const form = new FormData();
    form.set("text", text.trim());
    form.set("seconds", String(Math.max(1, (Date.now() - askedAt.current) / 1000)));
    submit(form);
  }

  async function toggleRecording() {
    if (phase === "ready") {
      setNotice(null);
      try {
        recorder.current = await startRecording();
        setAnalyser(recorder.current.analyser);
        setPhase("recording");
      } catch (err) {
        setTyping(true);
        setNotice({ message: err instanceof MicError ? err.message : "Couldn't start the microphone. Type your answer instead." });
      }
      return;
    }
    if (phase !== "recording" || !recorder.current) return;
    const rec = recorder.current;
    recorder.current = null;
    setAnalyser(null);
    try {
      const { wav, seconds } = await rec.stop();
      if (seconds < 1.5) {
        setPhase("ready");
        setNotice({ message: "That was very short. Tap the mic and answer again." });
        return;
      }
      const form = new FormData();
      form.set("audio", wav, "answer.wav");
      form.set("seconds", String(seconds));
      submit(form);
    } catch (err) {
      setPhase("ready");
      setTyping(true);
      setNotice({ message: err instanceof MicError ? err.message : "Couldn't process the recording. Type your answer instead." });
    }
  }

  function endEarly() {
    if (!answered.length || !confirm("End the interview now and get your report for the answers so far?")) return;
    recorder.current?.cancel();
    recorder.current = null;
    setAnalyser(null);
    finish();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitText();
    }
  }

  if (!session) {
    return notice ? (
      <div className="neu rounded-[28px] p-6 text-sm text-[var(--danger)]">{notice.message}</div>
    ) : (
      <div className="neu h-96 animate-pulse rounded-[28px]" />
    );
  }

  const total = session.question_count;
  const number = current ? current.idx + 1 : answered.length;
  const shown = current ?? previous; // while finishing, keep the last question on screen
  const tone = (shown?.label && LABEL_TONE[shown.label]) || "var(--muted)";

  return (
    <div className="flex flex-col gap-6">
      <section className="neu rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{session.role} interview</h1>
            <p className="text-sm text-[var(--muted)] capitalize">
              {session.level} · {session.interview_type === "hr" ? "HR" : session.interview_type} · {session.difficulty} · {session.mode}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setShowScores((v) => !v)} aria-pressed={showScores}
              className="neu-btn flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
              {showScores ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden sm:inline">{showScores ? "Hide scores" : "Show scores"}</span>
            </button>
            <button type="button" onClick={endEarly} disabled={!answered.length || phase === "finishing"}
              className="neu-btn flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-40">
              <Flag size={16} /> <span className="hidden sm:inline">End interview</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-xs text-[var(--muted)] tabular-nums">Question {number} of {total}</span>
          <div className="neu-inset h-3 flex-1 rounded-full p-0.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered.length}>
            <div className="h-full rounded-full bg-[image:var(--primary-gradient)] transition-[width] duration-500"
              style={{ width: `${Math.max(4, (answered.length / total) * 100)}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="neu flex flex-col gap-5 rounded-[28px] p-5 sm:p-7">
          {shown && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`relative grid size-12 shrink-0 place-items-center rounded-2xl ${phase === "speaking" ? "motion-safe:animate-pulse" : ""}`}>
                  <img src="/brand/fella.svg" alt="" className="size-12 rounded-2xl" />
                  {phase === "speaking" && <Volume2 size={14} className="absolute -right-1 -bottom-1 rounded-full bg-[var(--surface)] text-[var(--primary)]" />}
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {shown.label && (
                    <span className="neu-inset rounded-full px-3 py-1 text-xs font-medium" style={{ color: tone }}>{shown.label}</span>
                  )}
                  <span className="truncate text-xs text-[var(--muted)]">{shown.topic}</span>
                  <Difficulty value={shown.difficulty} />
                </div>
              </div>

              <h2 className="text-xl leading-snug font-semibold sm:text-2xl">{shown.question}</h2>

              {current && previous?.decision?.reason && (
                <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
                  <Waypoints size={16} className="mt-0.5 shrink-0" style={{ color: tone }} />
                  <span><b className="font-medium text-[var(--fg)]">Why this question:</b> {previous.decision.reason}</span>
                </p>
              )}
            </>
          )}

          {notice && (
            <div className="neu-inset flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" role="alert">
              <span className="flex-1 text-[var(--accent-pink)]">{notice.message}</span>
              {notice.retry && (
                <button type="button" onClick={notice.retry} className="neu-btn flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                  <RotateCcw size={14} /> Retry
                </button>
              )}
            </div>
          )}

          <div className="neu-inset rounded-3xl p-5">
            {phase === "loading" && <ThinkingIndicator steps={["Loading your interview…"]} />}

            {phase === "speaking" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm text-[var(--muted)]">The interviewer is asking the question…</p>
                <button type="button" onClick={() => playback.current?.stop()} className="neu-btn rounded-xl px-4 py-2 text-sm">
                  Skip to answer
                </button>
              </div>
            )}

            {(phase === "ready" || phase === "recording") && voiceTurn && (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                {phase === "recording" ? <Waveform analyser={analyser} /> : <div className="h-14" aria-hidden />}
                <button type="button" onClick={toggleRecording}
                  aria-label={phase === "recording" ? "Stop recording and send" : "Start recording your answer"}
                  className={`grid size-20 place-items-center rounded-full text-white transition ${
                    phase === "recording" ? "bg-[#e11d48] shadow-[0_0_0_8px_rgb(225_29_72_/_0.25)] motion-safe:animate-pulse" : "btn-primary"
                  }`}>
                  {phase === "recording" ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
                </button>
                <p className="text-sm text-[var(--muted)]">
                  {phase === "recording" ? <>Recording · <Clock seconds={elapsed} /> · tap to finish</> : <>Tap to answer · <Clock seconds={elapsed} /></>}
                </p>
                {phase === "ready" && (
                  <div className="flex flex-wrap justify-center gap-4 text-xs">
                    <button type="button" onClick={() => current && ask(current, "voice")} className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
                      <Volume2 size={14} /> Replay question
                    </button>
                    <button type="button" onClick={() => setTyping(true)} className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
                      <Keyboard size={14} /> Type instead
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === "ready" && !voiceTurn && (
              <div className="flex flex-col gap-3">
                <label htmlFor="answer" className="sr-only">Your answer</label>
                <textarea id="answer" rows={6} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} autoFocus
                  placeholder="Type your answer as you would say it…" className="field resize-y leading-relaxed" />
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <Clock seconds={elapsed} />
                  <span>· {text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
                  <span className="hidden sm:inline">· Ctrl/⌘ + Enter to send</span>
                  {session.mode === "voice" && (
                    <button type="button" onClick={() => setTyping(false)} className="flex items-center gap-1 hover:text-[var(--fg)]">
                      <Mic size={12} /> Use mic
                    </button>
                  )}
                  <button type="button" onClick={submitText} disabled={!text.trim()} className="btn-primary ml-auto rounded-2xl px-6 py-2.5 text-sm font-medium">
                    Send answer
                  </button>
                </div>
              </div>
            )}

            {phase === "thinking" && <ThinkingIndicator />}
            {phase === "finishing" && <ThinkingIndicator steps={FINISHING} />}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          {showScores && (
            <section className="neu rounded-[28px] p-5">
              <h3 className="mb-4 font-semibold">Last answer</h3>
              <ScoresPanel turn={lastEval} />
            </section>
          )}

          {lastTranscript !== null && (
            <section className="neu rounded-[28px] p-5">
              <h3 className="mb-2 font-semibold">What we heard</h3>
              <p className="text-sm text-[var(--muted)]">{lastTranscript || "(no answer)"}</p>
            </section>
          )}

          <section className="neu rounded-[28px] p-5">
            <h3 className="mb-1 font-semibold">Interview path</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">The next question adapts to each answer.</p>
            <ol className="flex flex-col gap-2">
              {turns.map((t) => (
                <li key={t.idx} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ${t === current ? "neu-inset" : ""}`}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ background: t.answered ? "var(--primary-gradient)" : "var(--track)", color: t.answered ? "#fff" : "var(--muted)" }}>
                    {t.idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.label ?? "Question"}</span>
                  <span className="truncate text-xs text-[var(--muted)]">{t.topic}</span>
                </li>
              ))}
              {Array.from({ length: Math.max(0, total - turns.length) }, (_, i) => (
                <li key={`todo${i}`} className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--muted)] opacity-60">
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--track)] text-xs">{turns.length + i + 1}</span>
                  Adapts to your answers
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Clock({ seconds }: { seconds: number }) {
  return <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
}

function Difficulty({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1" title={`Difficulty ${value} of 5`} aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="size-1.5 rounded-full" style={{ background: n <= value ? "var(--accent-pink)" : "var(--track)" }} />
      ))}
    </span>
  );
}
