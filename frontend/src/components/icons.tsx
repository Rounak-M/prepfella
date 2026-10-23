// lucide-react v1 dropped brand icons, so the LinkedIn mark is drawn here.
export function LinkedInIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 0 0-4 0" />
    </svg>
  );
}

/** Fella's face as a menu icon. The artwork has built-in padding, so it's drawn ~1.4× larger (with negative margin to
 *  keep the row height) to match the visual size of the label text and the lucide icons beside it. */
export function FellaIcon({ size = 18 }: { size?: number }) {
  const px = Math.round(size * 1.4);
  const pull = (size - px) / 2;
  // eslint-disable-next-line @next/next/no-img-element -- static SVG icon
  return <img src="/brand/fella.svg" alt="" width={px} height={px} className="shrink-0" style={{ width: px, height: px, margin: pull }} />;
}
