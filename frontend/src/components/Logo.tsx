/* eslint-disable @next/next/no-img-element -- static SVG logos, no optimisation needed */

// Both lockups are rendered and CSS shows the one matching the theme (no hydration mismatch). On a glass tile in dark
// mode the wordmark accent needs to be light, hence the tile variant.
export function Logo({ className = "h-9", onTile = false }: { className?: string; onTile?: boolean }) {
  return (
    <>
      <img src="/brand/lockup-light.svg" alt="PrepFella" className={`theme-light-only w-auto ${className}`} />
      <img src={onTile ? "/brand/lockup-tile.svg" : "/brand/lockup-dark.svg"} alt="PrepFella" className={`theme-dark-only w-auto ${className}`} />
    </>
  );
}
