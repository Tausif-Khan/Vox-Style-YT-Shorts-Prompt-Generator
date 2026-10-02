/**
 * Studio master mark — the brand symbol shared by every generator in the tool.
 *
 * Deliberately style-neutral: a play button inside a broken ring with a
 * creation sparkle in the gap. It says "video studio + AI creation" without
 * borrowing anything from one style's look (VOX paper-cut, documentary,
 * cartoon, …), so it can sit over any style generator's custom backdrop.
 *
 * Single color via `currentColor` — it inherits whatever ink the surrounding
 * theme provides.
 */
export default function StudioMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      {/* Ring with a gap at the top-right, where the sparkle sits */}
      <path
        d="M19.24 3.93 A12.5 12.5 0 1 0 27.75 11.72"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Play triangle — the "video" half of the mark */}
      <path
        d="M13.4 11.4 L21.6 16 L13.4 20.6 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Creation sparkle breaking the ring — the "AI generates it" half */}
      <path
        d="M24.5 2.5 Q25.35 6.65 29.5 7.5 Q25.35 8.35 24.5 12.5 Q23.65 8.35 19.5 7.5 Q23.65 6.65 24.5 2.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
