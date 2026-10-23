// Backend client. No auth: the chosen demo account's id is kept in localStorage and sent as X-User-Id.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USER_KEY = "prepfella.userId";

export function getUserId(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function setUserId(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, String(id));
  } catch {}
}

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : (detail as { message?: string })?.message ?? `Request failed (${status})`);
  }
  get code(): string | undefined {
    return (this.detail as { code?: string })?.code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const uid = getUserId();
  if (uid) headers.set("X-User-Id", uid);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(API_URL + path, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) setUserId(null); // stale account id (e.g. database was reset); AppShell sends you to /login
    throw new ApiError(res.status, body?.detail ?? body);
  }
  return body as T;
}

// --- Types mirroring the backend responses

export type User = { id: number; name: string; email: string; tagline: string; has_password: boolean };

export type CareerKind = "job" | "internship" | "education";
export type CareerEntry = {
  id: number;
  kind: CareerKind;
  title: string;
  organization: string;
  start: string; // "YYYY" | "YYYY-MM"
  end: string | null; // null = present
  level: number;
  level_label: string;
  salary: number | null;
  salary_period: "month" | "year";
  currency: string;
  salary_yearly: number | null;
  source: "manual" | "linkedin";
};
export type CareerResponse = { levels: Record<string, string>; entries: CareerEntry[] };
export type CareerInput = Omit<CareerEntry, "id" | "level_label" | "salary_yearly" | "source" | "level"> & { level: number | null };

export type ReviewSection = { score: number; comment: string; suggestion: string } | null;
export type LinkedInReview = {
  overall: number | null;
  source: "public" | "pdf";
  sections: Record<"headline" | "about" | "experience" | "education" | "skills", ReviewSection>;
  strengths: string[];
  top_fixes: string[];
  headline_options: string[];
  about_rewrite: string;
  missing_keywords: string[];
  checks: { label: string; ok: boolean; tip: string }[];
};

export function linkedinForm(url: string, pdf: File | null): FormData {
  const form = new FormData();
  if (url.trim()) form.set("url", url.trim());
  if (pdf) form.set("pdf", pdf);
  return form;
}

// --- Profile + AI Profile Review (§4.1)
export type ProfileReview = {
  role_fit: { level: "strong" | "good" | "developing"; summary: string };
  strengths: string[];
  gaps: string[];
  red_flags: { issue: string; fix: string }[];
  resume_claims: string[];
  interview_plan: { topic: string; kind: "technical" | "hr"; count: number }[];
};
export type Profile = {
  target_role: string;
  experience_level: string;
  links: Record<string, string>;
  has_resume: boolean;
  resume_chars: number;
  resume_preview: string;
  review: ProfileReview | null;
  reviewed_at: string | null;
  linkedin_overall: number | null;
};

// --- Interviews (§4.2–4.4)
export const DIMENSIONS = ["communication", "technical", "problem_solving", "answer_quality"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const DIMENSION_LABELS: Record<Dimension, string> = {
  communication: "Communication",
  technical: "Technical",
  problem_solving: "Problem solving",
  answer_quality: "Answer quality",
};
export type Scores = Record<Dimension, number>;

export type Turn = {
  idx: number;
  kind: "main" | "follow_up" | "harder" | "easier" | "resume_probe";
  topic: string;
  question: string;
  difficulty: number; // 1–5
  label: string | null; // how it was asked: "Opening question" | "Follow-up" | "Harder" | "Easier" | "Verifying your resume" | "New topic"
  answered: boolean;
  // present once answered:
  answer_text?: string;
  answer_seconds?: number | null;
  wpm?: number | null;
  filler_count?: number | null;
  scores?: Scores;
  evidence?: Record<Dimension, string>;
  feedback?: string;
  decision?: { move: string; label: string; reason: string; avg: number; missing_points: string[]; ai: boolean; because?: string };
};

export type Report = {
  averages: Scores;
  overall: number; // 0–100
  weakest: Dimension;
  summary: string;
  strengths: string[];
  top_fixes: string[];
  model_answers: { question: string; stronger_answer: string }[];
  next_session: { difficulty: "easy" | "medium" | "hard"; topics: string[]; count: number; type?: "technical" | "hr" | "mixed" };
  study_plan: { task: string; why: string }[];
  adaptive: { idx: number; question: string; asked_as: string | null; move_after: string | null; reason: string | null }[];
  gaps: string[];
  ai: boolean;
};

export type InterviewType = "technical" | "hr" | "mixed";
export type SessionSummary = {
  id: number;
  role: string;
  level: string;
  interview_type: InterviewType;
  difficulty: "easy" | "medium" | "hard";
  mode: "voice" | "text";
  status: "active" | "finished";
  question_count: number;
  current_difficulty: number;
  started_at: string;
  ended_at: string | null;
  overall: number | null;
  averages: Scores | null;
};
export type SessionDetail = SessionSummary & { turns: Turn[]; report: Report | null };
export type SessionCreate = {
  role: string;
  level: string;
  interview_type: InterviewType;
  difficulty: "easy" | "medium" | "hard";
  mode: "voice" | "text";
  question_count: number;
  topics?: string[];
};
export type AnswerResponse = { transcript: string; evaluation: Turn; next: Turn | null; done: boolean };
export type ProgressPoint = { session_id: number; date: string; role: string; interview_type: InterviewType; averages: Scores; overall: number };

// --- Fella (§4.5)
export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; quiz: { question: string; topic: string } | null; created_at: string };

/** Interviewer audio for a question as an object URL (the endpoint needs the X-User-Id header, so <audio src> can't call it). */
export async function questionAudioUrl(sessionId: number, idx: number, signal?: AbortSignal): Promise<string> {
  const uid = getUserId();
  const res = await fetch(`${API_URL}/sessions/${sessionId}/turns/${idx}/audio`, { headers: uid ? { "X-User-Id": uid } : {}, signal });
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => null))?.detail);
  return URL.createObjectURL(await res.blob());
}

// --- Advice (Fella's learning roadmaps)
export type AdviceResource = {
  n: number; // reference number used as [n] in the reply text
  id: string;
  title: string;
  provider: string;
  type: "course" | "youtube" | "docs" | "practice" | "roadmap";
  url: string;
};
export type AdviceMessage = { id: number; role: "user" | "assistant"; content: string; resources: AdviceResource[]; created_at: string };
