import { CircleHelp, RotateCw } from "lucide-react";

import type { ChatMessage } from "@/lib/api";

/** Plain text with preserved line breaks; consecutive "- " / "• " lines become a bullet list. */
function RichText({ text }: { text: string }) {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: string[] })[] = [];
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const last = blocks.at(-1);
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (line.trim()) {
      blocks.push({ kind: "p", text: line });
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="flex flex-col gap-1">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current opacity-60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  failed,
  onRetry,
  onAnswerQuiz,
}: {
  message: ChatMessage;
  failed?: boolean;
  onRetry?: () => void;
  onAnswerQuiz?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className={`max-w-[85%] sm:max-w-[72%] rounded-3xl rounded-br-lg bg-[image:var(--primary-gradient)] px-4 py-2.5 text-sm whitespace-pre-line text-white ${failed ? "opacity-60" : ""}`}>
          {message.content}
        </div>
        {failed && (
          <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-[var(--accent-pink)]">
            <RotateCw size={12} /> Fella is busy, try again
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="neu max-w-[90%] rounded-3xl rounded-bl-lg px-4 py-3 text-sm sm:max-w-[75%]">
        <RichText text={message.content} />
      </div>
      {message.quiz && (
        <div className="neu-inset w-[90%] rounded-2xl p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <CircleHelp size={16} className="text-[var(--accent-cyan)]" />
            <span className="font-medium">Quick quiz</span>
            <span className="ml-auto truncate rounded-full px-2.5 py-0.5 text-[11px] text-[var(--accent-cyan)] ring-1 ring-[var(--accent-cyan)]/40">
              {message.quiz.topic}
            </span>
          </div>
          <p>{message.quiz.question}</p>
          <button type="button" onClick={onAnswerQuiz} className="neu-btn mt-3 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--primary)]">
            Answer
          </button>
        </div>
      )}
    </div>
  );
}
