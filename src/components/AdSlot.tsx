import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Provider-neutral ad slot — the "parking space" every ad network parks in.
 *
 * Each slot shows ONE ad from ONE provider at a time. Which provider? A
 * per-slot switch in the Environment (not a secret):
 *
 *   VITE_AD_PROVIDER_SIDEBAR   "adsterra" | "adsense"   (default: adsterra)
 *   VITE_AD_PROVIDER_BANNER    "adsterra" | "adsense"   (default: adsterra)
 *
 * Provider keys (secrets — Settings → Environment):
 *   Adsterra: VITE_ADSTERRA_SIDEBAR_KEY  160×600 skyscraper — side rails
 *             VITE_ADSTERRA_BANNER_KEY   728×90  banner     — in-content
 *   AdSense:  VITE_ADSENSE_CLIENT        your ca-pub-… publisher id
 *             VITE_ADSENSE_SIDEBAR_SLOT  the slot id for the sidebar unit
 *             VITE_ADSENSE_BANNER_SLOT   the slot id for the banner unit
 *
 * Rules this file must keep (ad network policies — non-negotiable):
 *   • Each network's tag is rendered exactly as that network documents it;
 *     the driver only mounts it. Never auction or wrap one network's code
 *     inside another's (Google explicitly forbids altering ad code/delivery).
 *   • One ad per slot, ever — never stack two networks in one space.
 *
 * Runtime behavior:
 *   1. Providers are tried in switch order, skipping any whose keys are
 *      missing — flipping a switch early (or having only one account) never
 *      empties a slot, it falls back to whatever can actually serve.
 *   2. If the chosen provider paints no ad within FILL_TIMEOUT_MS (no-fill,
 *      or blocked), the slot clears and the next provider is tried.
 *   3. If nothing fills — or no keys exist at all — the layout-stable
 *      placeholder is shown. Safe in dev and before any keys are added.
 *
 * Switching providers later = change the switch value + redeploy. Nothing
 * else in the app knows or cares which network ran.
 *
 * Never writes to the browser console (site-wide requirement).
 */

const AD_UNITS = {
  sidebar: { width: 160, height: 600 },
  banner: { width: 728, height: 90 },
} as const;

export type AdUnitKind = keyof typeof AD_UNITS;
type AdProvider = "adsterra" | "adsense";

const PROVIDERS: AdProvider[] = ["adsterra", "adsense"];
/** How long a provider gets to paint an ad before we call it a no-fill. */
const FILL_TIMEOUT_MS = 5000;

/* ─────────────────────────── configuration (env) ─────────────────────────── */

const ADSTERRA_KEY_ENV: Record<AdUnitKind, string | undefined> = {
  sidebar: import.meta.env.VITE_ADSTERRA_SIDEBAR_KEY as string | undefined,
  banner: import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined,
};

const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? "";
const ADSENSE_SLOT_ENV: Record<AdUnitKind, string | undefined> = {
  sidebar: import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT as string | undefined,
  banner: import.meta.env.VITE_ADSENSE_BANNER_SLOT as string | undefined,
};

const SWITCH_ENV: Record<AdUnitKind, string | undefined> = {
  sidebar: import.meta.env.VITE_AD_PROVIDER_SIDEBAR as string | undefined,
  banner: import.meta.env.VITE_AD_PROVIDER_BANNER as string | undefined,
};

function isProvider(value: string | undefined): value is AdProvider {
  return value === "adsterra" || value === "adsense";
}

function hasKeys(provider: AdProvider, unit: AdUnitKind): boolean {
  if (provider === "adsterra") return Boolean(ADSTERRA_KEY_ENV[unit]);
  return Boolean(ADSENSE_CLIENT && ADSENSE_SLOT_ENV[unit]);
}

/** Switch order: the unit's switch provider first, then the rest — keys-less
 *  providers are skipped so a slot is never left empty by a premature flip. */
function providerChain(unit: AdUnitKind): AdProvider[] {
  const primary = isProvider(SWITCH_ENV[unit]) ? SWITCH_ENV[unit] : "adsterra";
  return [primary, ...PROVIDERS.filter((p) => p !== primary)].filter((p) => hasKeys(p, unit));
}

/* ─────────────────────────── drivers ─────────────────────────── */

/* Adsterra: window.atOptions + the unit's invoke.js, both attached to the
   slot's own container. Units are serialized through a module-level chain
   so one unit's atOptions is never overwritten by the next unit before its
   own invoke.js has read it (invoke.js reads window.atOptions at run time). */
let adsterraChain: Promise<void> = Promise.resolve();
function renderAdsterra(
  host: HTMLElement,
  key: string,
  size: { width: number; height: number }
): () => void {
  let cancelled = false;
  let script: HTMLScriptElement | null = null;
  adsterraChain = adsterraChain.catch(() => {}).then(
    () =>
      new Promise<void>((resolve) => {
        if (cancelled) {
          resolve();
          return;
        }
        (window as unknown as Record<string, unknown>).atOptions = {
          key,
          format: "iframe",
          height: size.height,
          width: size.width,
          params: {},
        };
        const s = document.createElement("script");
        s.src = `https://www.highperformanceformat.com/${key}/invoke.js`;
        s.async = true;
        s.onload = () => setTimeout(resolve, 120);
        s.onerror = () => resolve();
        script = s;
        host.appendChild(s);
      })
  );
  return () => {
    cancelled = true;
    script?.remove();
    host.replaceChildren();
  };
}

/* AdSense: the adsbygoogle.js loader (once per page, tagged with the
   publisher client id) + a documented <ins class="adsbygoogle"> unit and a
   queue push. The tag is exactly what Google provides — never modified. */
let adsenseScriptFor = "";
function loadAdsenseScript(client: string): void {
  if (adsenseScriptFor === client) return;
  adsenseScriptFor = client;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

function renderAdsense(
  host: HTMLElement,
  unit: AdUnitKind,
  size: { width: number; height: number }
): () => void {
  loadAdsenseScript(ADSENSE_CLIENT);
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.cssText = `display:inline-block;width:${size.width}px;height:${size.height}px;`;
  ins.setAttribute("data-ad-client", ADSENSE_CLIENT);
  ins.setAttribute("data-ad-slot", ADSENSE_SLOT_ENV[unit] ?? "");
  host.appendChild(ins);
  const w = window as unknown as { adsbygoogle?: unknown[] };
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.push({});
  return () => {
    ins.remove();
    host.replaceChildren();
  };
}

function renderProvider(
  provider: AdProvider,
  host: HTMLElement,
  unit: AdUnitKind,
  size: { width: number; height: number }
): () => void {
  if (provider === "adsterra") {
    return renderAdsterra(host, ADSTERRA_KEY_ENV[unit] as string, size);
  }
  return renderAdsense(host, unit, size);
}

/** Did the provider actually paint an ad? Both networks end up rendering an
 *  iframe; AdSense can also fill the <ins> element directly. */
function slotHasAd(host: HTMLElement): boolean {
  if (host.querySelector("iframe")) return true;
  const ins = host.querySelector("ins");
  return ins !== null && ins.childElementCount > 0;
}

/* ─────────────────────────── the slot component ─────────────────────────── */

const PLACEHOLDER_CLASS =
  "flex items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-900/40 text-[10px] uppercase tracking-[0.2em] text-bone-400/50";

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
  const [noFill, setNoFill] = useState(false);
  const size = AD_UNITS[unit];
  const chain = useMemo(() => providerChain(unit), [unit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || chain.length === 0) return;
    let disposed = false;
    let timer = 0;
    let cleanup: (() => void) | null = null;
    // window.setTimeout (not the bare global) so the id is a plain number
    // even with node types in the project.

    const attempt = (i: number) => {
      if (disposed) return;
      if (i >= chain.length) {
        setNoFill(true); // nothing served — show the placeholder
        return;
      }
      cleanup = renderProvider(chain[i], host, unit, size);
      timer = window.setTimeout(() => {
        if (disposed) return;
        if (slotHasAd(host)) return; // filled — leave it alone
        cleanup?.(); // clears the host
        attempt(i + 1);
      }, FILL_TIMEOUT_MS);
    };

    attempt(0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanup?.();
      host.replaceChildren();
    };
  }, [unit, chain, size]);

  if (chain.length === 0) {
    // Nothing configured yet — keeps the layout stable and shows the spot.
    return (
      <div className={`${PLACEHOLDER_CLASS} ${className}`} style={{ minHeight }} aria-hidden>
        {label} slot
      </div>
    );
  }

  return (
    <div className={className} style={{ minHeight }}>
      <span className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-bone-400/40">
        {label}
      </span>
      {/* The provider driver injects the network's tag into this container. */}
      <div
        ref={hostRef}
        className="flex items-center justify-center overflow-hidden rounded-lg"
        style={{ width: "100%", minHeight: size.height, display: noFill ? "none" : undefined }}
      />
      {noFill && (
        <div
          className={PLACEHOLDER_CLASS.replace("rounded-xl", "rounded-lg")}
          style={{ minHeight: size.height }}
          aria-hidden
        >
          {label}
        </div>
      )}
    </div>
  );
}
