/**
 * The Gymlic brand mark — a minimal dumbbell glyph. Uses currentColor so it
 * can be dropped white-on-blue (tiles, dark surfaces) or blue-on-white
 * (light surfaces) just by setting the parent's text color.
 */
export function GymlicMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="17" y="28" width="15" height="44" rx="7.5" fill="currentColor" />
      <rect x="68" y="28" width="15" height="44" rx="7.5" fill="currentColor" />
      <rect x="30" y="43" width="40" height="14" rx="7" fill="currentColor" />
    </svg>
  );
}
