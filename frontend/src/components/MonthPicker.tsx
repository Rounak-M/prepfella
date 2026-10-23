"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "YYYY-MM" for comparisons; a bare "YYYY" counts as January (start) — callers pass normalized values. */
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

function parse(value: string | null | undefined): { y: number; m: number | null } | null {
  const match = value?.match(/^(\d{4})(?:-(\d{2}))?$/);
  return match ? { y: Number(match[1]), m: match[2] ? Number(match[2]) - 1 : null } : null;
}

export function formatMonth(value: string | null | undefined): string {
  const p = parse(value);
  if (!p) return "";
  return p.m == null ? String(p.y) : `${MONTHS[p.m]} ${p.y}`;
}

/**
 * Themed month picker (replaces <input type="month">, which can't show a placeholder or be styled).
 * Value is "YYYY-MM" (or a legacy "YYYY"); `min`/`max` are "YYYY-MM" bounds.
 */
export function MonthPicker({
  value,
  onChange,
  labelId,
  placeholder = "Choose date",
  disabled = false,
  disabledText,
  min,
  max,
  align = "left",
}: {
  value: string | null;
  onChange: (value: string) => void;
  labelId?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledText?: string;
  min?: string;
  max?: string;
  align?: "left" | "right"; // which edge of the field the popup lines up with
}) {
  const now = new Date();
  const thisMonth = ym(now.getFullYear(), now.getMonth());
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selected?.y ?? now.getFullYear());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Close on a click outside; focus the selected (or first available) month when opening.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    panel.current?.querySelector<HTMLButtonElement>("[aria-pressed=true], button[data-month]:not(:disabled)")?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const minY = parse(min)?.y ?? 1970;
  const maxY = parse(max)?.y ?? now.getFullYear() + 10;
  const out = (v: string) => (min != null && v < min) || (max != null && v > max);

  function toggle() {
    if (!open) setYear(selected?.y ?? Math.min(now.getFullYear(), maxY));
    setOpen((o) => !o);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelId}
        className="field flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={!disabled && !selected ? "text-[var(--muted)]" : ""}>
          {disabled ? disabledText ?? placeholder : selected ? formatMonth(value) : placeholder}
        </span>
        <CalendarDays size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
      </button>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Choose month"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation(); // close the picker, not the surrounding modal
              setOpen(false);
              trigger.current?.focus();
            }
          }}
          className={`month-picker neu absolute top-full z-30 mt-2 w-72 rounded-3xl p-4 ${align === "right" ? "right-0 origin-top-right" : "left-0"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setYear((y) => y - 1)} disabled={year <= minY} aria-label="Previous year"
              className="neu-btn grid size-8 place-items-center rounded-full disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-semibold tabular-nums" aria-live="polite">{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} disabled={year >= maxY} aria-label="Next year"
              className="neu-btn grid size-8 place-items-center rounded-full disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((name, m) => {
              const v = ym(year, m);
              const isSelected = selected?.y === year && selected.m === m;
              const isNow = v === thisMonth;
              return (
                <button
                  key={name}
                  type="button"
                  data-month
                  onClick={() => pick(v)}
                  disabled={out(v)}
                  aria-pressed={isSelected}
                  aria-label={`${name} ${year}`}
                  className={`rounded-xl py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSelected ? "btn-primary font-semibold" : `neu-inset hover:-translate-y-px ${isNow ? "ring-1 ring-[var(--primary)]" : ""}`
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <button type="button" onClick={() => pick("")} className="text-[var(--muted)] underline-offset-2 hover:underline" hidden={!selected}>
              Clear
            </button>
            {!out(thisMonth) && (
              <button type="button" onClick={() => pick(thisMonth)} className="ml-auto font-medium text-[var(--primary)] underline-offset-2 hover:underline">
                This month
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
