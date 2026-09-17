import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Google AdSense display-ad slot.
 * Renders nothing until VITE_ADSENSE_CLIENT (and optionally VITE_ADSENSE_SLOT_*)
 * env vars are set — safe placeholder in dev.
 *
 * Setup for production:
 *  1. Add <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"> to index.html (see comment there).
 *  2. Set VITE_ADSENSE_CLIENT=ca-pub-XXXX (and per-slot IDs) in deploy env.
 *  3. Serve ads.txt with your publisher ID (placeholder committed at /public/ads.txt).
 */
export default function AdSlot({
  slot,
  format = "auto",
  className = "",
  minHeight = 90,
  label = "Advertisement",
}: {
  slot?: string;
  format?: string;
  className?: string;
  minHeight?: number;
  label?: string;
}) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script not loaded yet / blocked — ignore, placeholder shows.
    }
  }, [client]);

  if (!client) {
    // Dev placeholder — keeps layout stable and shows where ads will sit.
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-900/40 text-[10px] uppercase tracking-[0.2em] text-bone-400/50 ${className}`}
        style={{ minHeight }}
        aria-hidden
      >
        {label} slot
      </div>
    );
  }

  return (
    <div className={className} style={{ minHeight }}>
      <span className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-bone-400/40">{label}</span>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
