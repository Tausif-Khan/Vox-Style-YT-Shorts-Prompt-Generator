import { useEffect, useRef } from "react";

/**
 * Adsterra ad unit (replaces the old Google AdSense slot).
 *
 * A unit = `window.atOptions` + Adsterra's invoke.js, both attached to the
 * unit's own container. Units are serialized through a module-level chain so
 * one unit's atOptions is never overwritten by the next unit before its own
 * invoke.js has executed (invoke.js reads window.atOptions at run time).
 *
 * Renders a layout-stable placeholder until the unit's key is configured —
 * safe in dev and before ad keys are added.
 *
 * Setup (Settings → Environment / deploy env):
 *   VITE_ADSTERRA_SIDEBAR_KEY  160×600 skyscraper — left/right rails
 *   VITE_ADSTERRA_BANNER_KEY   728×90  banner     — in-content blocks
 * Keys come from your Adsterra dashboard → Websites → create ad units.
 */

const AD_UNITS = {
  sidebar: { width: 160, height: 600 },
  banner: { width: 728, height: 90 },
} as const;

export type AdUnitKind = keyof typeof AD_UNITS;

const KEY_ENV: Record<AdUnitKind, string | undefined> = {
  sidebar: import.meta.env.VITE_ADSTERRA_SIDEBAR_KEY as string | undefined,
  banner: import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined,
};

/* Serialize unit loading: Adsterra's invoke.js reads window.atOptions when it
   executes, so the next unit's atOptions must not be set until the previous
   invoke.js has run. */
let chain: Promise<void> = Promise.resolve();
function loadUnit(host: HTMLElement, key: string, width: number, height: number): void {
  chain = chain.catch(() => {}).then(
    () =>
      new Promise<void>((resolve) => {
        (window as unknown as Record<string, unknown>).atOptions = {
          key,
          format: "iframe",
          height,
          width,
          params: {},
        };
        const s = document.createElement("script");
        s.src = `https://www.highperformanceformat.com/${key}/invoke.js`;
        s.async = true;
        s.onload = () => setTimeout(resolve, 120);
        s.onerror = () => resolve();
        host.appendChild(s);
      })
  );
}

export default function AdSlot({
  unit = "banner",
  className = "",
  minHeight = 90,
  label = "Advertisement",
}: {
  unit?: AdUnitKind;
  className?: string;
  minHeight?: number;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const key = KEY_ENV[unit];
  const size = AD_UNITS[unit];

  useEffect(() => {
    if (!key || loaded.current || !hostRef.current) return;
    loaded.current = true; // guard: React StrictMode double-mounts effects
    loadUnit(hostRef.current, key, size.width, size.height);
  }, [key, size.width, size.height]);

  if (!key) {
    // Placeholder — keeps layout stable and shows where ads will sit.
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
      {/* Adsterra injects the unit's iframe into this container. */}
      <div
        ref={hostRef}
        className="flex items-center justify-center overflow-hidden rounded-lg"
        style={{ width: "100%", minHeight: size.height }}
      />
    </div>
  );
}
