import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * AdBlockGate — ad-blocker detection + tamper-resistant hard lockout.
 *
 * The site is ad-funded (Adsterra), so the FIRST thing that runs on every
 * page load is an ad-blocker probe: elements wearing the class names / ids
 * that public ad-block filter lists hide cosmetically are injected off-screen.
 * If the browser hides (or removes) any of them, an ad blocker is active —
 * the entire app becomes `inert` (no clicks, no typing, no focus, no scroll
 * anywhere behind the modal) and a dialog asks the visitor to allow ads.
 *
 * Detection is 100% local: no network requests, no third-party calls.
 *
 * ── Console-tamper hardening ─────────────────────────────────────────────
 * A visitor can open DevTools, but every escape hatch below is covered:
 *   • Deleting the popup node, emptying it, or detaching it from <body>
 *     → a watchdog re-appends / rebuilds it within ~250ms (rAF loop plus a
 *       setInterval fallback, so it also runs when frames are throttled).
 *   • Removing `inert`, the lock classes, or aria-hidden from the app
 *     wrapper → the same watchdog re-asserts them every frame batch.
 *   • Removing our capture-phase event guards (e.g. Chrome's
 *     getEventListeners) → they are re-registered twice a second.
 *   • Deleting the React root entirely → page reloads (and re-locks).
 *   • Patching getComputedStyle / isConnected / createElement / timers
 *     from the console to fool the probe or the watchdog → the module
 *     captures pristine native references at load and only ever uses those.
 *   • Forcing React state to "clean" via DevTools → a 6s re-scan while
 *     unlocked re-locks the page within seconds.
 * No unlock state is persisted anywhere; every page load starts locked-
 * checking again.
 *
 * Not claimable: someone who edits our JS file or uses a userscript
 * interceptor always wins — this raises the bar from "one console line"
 * to "rewrite the page", which covers the realistic audience.
 *
 * Auto-recovery: while locked the real probe re-runs every 4s, and the
 * instant the window regains focus or the tab becomes visible (i.e. the
 * visitor just toggled their blocker in the toolbar popup and came back) —
 * a visitor who allows ads never has to click anything.
 * Continue is self-resolving: probe → one retry after 700ms (some blockers
 * take a beat to un-apply filters already injected into this document) →
 * if STILL failing it reloads the page, because a fresh load re-evaluates
 * the filters from scratch — the path visitors confirm works. Pressing
 * Continue can never leave someone stuck on the popup.
 * While unlocked, the probe re-runs every 6s AND on focus/visibility
 * return, so enabling a blocker mid-session re-locks the page.
 *
 * Dev/preview: open any URL with `?adblock=force` to preview the lockout.
 */

/* ─────────────── pristine natives (captured before console patches) ─────────────── */

const NATIVE = (() => {
  const isConnectedDesc = Object.getOwnPropertyDescriptor(Node.prototype, "isConnected");
  const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  return {
    getComputedStyle: window.getComputedStyle.bind(window) as (el: Element) => CSSStyleDeclaration,
    isConnected: (el: Node) => isConnectedDesc?.get?.call(el) === true,
    createElement: document.createElement.bind(document) as (tag: string) => HTMLElement,
    appendChild: Node.prototype.appendChild as (this: Node, child: Node) => Node,
    removeChild: Node.prototype.removeChild as (this: Node, child: Node) => Node,
    querySelectorAll: Element.prototype.querySelectorAll as (
      this: Element,
      selectors: string
    ) => NodeListOf<Element>,
    setInnerHTML: innerHTMLDesc?.set as ((this: Element, html: string) => void) | undefined,
    addEventListener: document.addEventListener.bind(document) as typeof document.addEventListener,
    removeEventListener: document.removeEventListener.bind(document) as typeof document.removeEventListener,
    winAdd: window.addEventListener.bind(window) as typeof window.addEventListener,
    winRemove: window.removeEventListener.bind(window) as typeof window.removeEventListener,
    addListener: EventTarget.prototype.addEventListener as (
      this: EventTarget,
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions
    ) => void,
    setAttribute: Element.prototype.setAttribute as (this: Element, name: string, value: string) => void,
    getAttribute: Element.prototype.getAttribute as (this: Element, name: string) => string | null,
    hasAttribute: Element.prototype.hasAttribute as (this: Element, name: string) => boolean,
    classListAdd: DOMTokenList.prototype.add as (this: DOMTokenList, ...tokens: string[]) => void,
    contains: Node.prototype.contains as (this: Node, other: Node | null) => boolean,
    querySelector: Element.prototype.querySelector as (
      this: Element,
      selectors: string
    ) => Element | null,
    getElementById: Document.prototype.getElementById as (id: string) => HTMLElement | null,
    stopPropagation: Event.prototype.stopPropagation as (this: Event) => void,
    preventDefault: Event.prototype.preventDefault as (this: Event) => void,
    focus: HTMLElement.prototype.focus as (this: HTMLElement) => void,
    setTimeout: window.setTimeout.bind(window) as (fn: () => void, ms: number) => number,
    clearTimeout: window.clearTimeout.bind(window) as (id: number) => void,
    setInterval: window.setInterval.bind(window) as (fn: () => void, ms: number) => number,
    clearInterval: window.clearInterval.bind(window) as (id: number) => void,
    rAF: window.requestAnimationFrame.bind(window) as (fn: (ts: number) => void) => number,
    cAF: window.cancelAnimationFrame.bind(window) as (id: number) => void,
    reload: () => window.location.reload(),
  };
})();

/* ─────────────────────────── detection ─────────────────────────── */

/** Cosmetic-filter bait: selectors commonly present in EasyList-family lists. */
const BAIT_MARKUP = `
  <div class="ad adsbox ad-banner ad-placement ad-unit banner-advertising text-ad textads pub_300x250 ad-container sponsored-ad" style="display:block;width:300px;height:250px;"></div>
  <ins class="adsbygoogle" style="display:block;width:300px;height:250px;"></ins>
  <div id="ad-banner" class="ad-banner" style="display:block;width:728px;height:90px;"></div>
  <div class="adzone ad-slot" style="display:block;width:320px;height:50px;"></div>
`.trim();

function isBaitBlocked(el: Element): boolean {
  // Blocker detached the node outright.
  if (!NATIVE.isConnected(el)) return true;
  const cs = NATIVE.getComputedStyle(el);
  // Cosmetic filters hide via display:none / visibility:hidden (!important).
  if (cs.display === "none" || cs.visibility === "hidden") return true;
  // …or by collapsing the box (height:0;overflow:hidden tricks).
  // Our bait carries explicit inline sizes, so 0 can only come from a
  // stylesheet rule that beat inline styles — i.e. an ad blocker's !important.
  const h = parseFloat(cs.height);
  const w = parseFloat(cs.width);
  if (Number.isFinite(h) && h <= 0) return true;
  if (Number.isFinite(w) && w <= 0) return true;
  return false;
}

/**
 * Returns true when an ad blocker is active. ~300ms: blockers that hide bait
 * synchronously are caught immediately, scriptlet-driven ones after one tick.
 * Never throws — a probe failure resolves to false (fail open).
 * Uses only captured natives, so console monkey-patching can't fool it.
 */
export async function detectAdBlocker(): Promise<boolean> {
  try {
    const host = NATIVE.createElement("div");
    host.setAttribute("data-adblock-probe", "");
    host.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;";
    if (NATIVE.setInnerHTML) NATIVE.setInnerHTML.call(host, BAIT_MARKUP);
    else host.innerHTML = BAIT_MARKUP;
    NATIVE.appendChild.call(document.body, host);

    const nodes = Array.from(NATIVE.querySelectorAll.call(host, "*"));
    const trip = () => nodes.some(isBaitBlocked);

    if (trip()) {
      NATIVE.removeChild.call(host.parentNode as Node, host);
      return true;
    }
    await new Promise<void>((r) => NATIVE.setTimeout(r, 300));
    const blocked = trip();
    if (NATIVE.isConnected(host) && host.parentNode) {
      NATIVE.removeChild.call(host.parentNode, host);
    }
    return blocked;
  } catch {
    return false;
  }
}

/* ─────────────────────────── lockout gate ─────────────────────────── */

type Status = "checking" | "clean" | "blocked";

/** Input events swallowed globally while the lockout is up (capture phase). */
const GUARDED_EVENTS = [
  "keydown",
  "keyup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "auxclick",
  "pointerdown",
  "pointerup",
  "input",
  "beforeinput",
  "change",
  "submit",
  "paste",
  "cut",
  "copy",
  "dragstart",
  "wheel",
  "touchstart",
  "touchmove",
  "contextmenu",
] as const;

const GUARD_OPTS = { capture: true, passive: false } as const;

const STEPS = [
  "Click your ad blocker's icon in the browser toolbar.",
  'Choose "Pause on this site" or "Allow on this site" — the wording depends on your blocker.',
  'Press "Continue" below. The page unlocks as soon as the check passes.',
];

const CONTINUE_LABEL = "I've allowed ads — continue";

type OverlayHandle = {
  root: HTMLElement;
  setChecking: (busy: boolean) => void;
  setNotice: (text: string | null) => void;
  focus: () => void;
};

/**
 * The lockout UI is built imperatively (not through React) so a console user
 * who deletes the node can't win: React never has to reconcile it back, we
 * simply re-append a fresh copy from the watchdog.
 */
function createLockOverlay(handlers: {
  onContinue: () => void;
  onReload: () => void;
}): OverlayHandle {
  const root = NATIVE.createElement("div");
  root.setAttribute("data-adblock-overlay", "");
  root.className =
    "fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-[#0e0b15]/88 p-4 backdrop-blur-sm";
  const markup = `
    <div role="alertdialog" aria-modal="true" aria-labelledby="adblock-title" aria-describedby="adblock-desc"
         class="relative my-auto w-full max-w-lg rounded-3xl border border-white/15 bg-[#14101c] p-7 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:p-8">
      <span class="badge border border-amber-film/30 bg-amber-film/10 text-amber-film">Ad blocker detected</span>
      <span class="mx-auto mb-5 mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-film/10 ring-1 ring-amber-film/35">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-7 w-7 text-amber-film" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <line x1="5.7" y1="5.7" x2="18.3" y2="18.3"></line>
        </svg>
      </span>
      <h2 id="adblock-title" class="text-2xl font-bold text-bone-50">This page is paused</h2>
      <p id="adblock-desc" class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-bone-200">
        Papercut Studio is free because of ads. We've disabled the entire page
        until ads are allowed on this site — nothing else is affected.
      </p>
      <ol class="mx-auto mt-6 max-w-sm space-y-3 text-left">
        <li class="flex gap-3 text-[13px] leading-relaxed">
          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-film/15 text-[11px] font-bold text-amber-film">1</span>
          <span class="text-bone-200">${STEPS[0]}</span>
        </li>
        <li class="flex gap-3 text-[13px] leading-relaxed">
          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-film/15 text-[11px] font-bold text-amber-film">2</span>
          <span class="text-bone-200">${STEPS[1]}</span>
        </li>
        <li class="flex gap-3 text-[13px] leading-relaxed">
          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-film/15 text-[11px] font-bold text-amber-film">3</span>
          <span class="text-bone-200">${STEPS[2]}</span>
        </li>
      </ol>
      <p data-notice hidden class="mx-auto mt-5 max-w-sm rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200"></p>
      <button data-continue type="button" class="btn-primary mt-6 w-full">${CONTINUE_LABEL}</button>
      <button data-reload type="button" class="btn-secondary mt-3 w-full">Reload the page</button>
      <p class="mt-5 text-[11px] leading-relaxed text-bone-400">
        The check runs entirely in your browser — nothing is sent anywhere.
        Only this site is affected.
      </p>
    </div>
  `.trim();
  if (NATIVE.setInnerHTML) NATIVE.setInnerHTML.call(root, markup);
  else root.innerHTML = markup;

  const btn = root.querySelector("[data-continue]") as HTMLButtonElement;
  const notice = root.querySelector("[data-notice]") as HTMLElement;
  const reloadBtn = root.querySelector("[data-reload]") as HTMLElement;

  NATIVE.addListener.call(btn, "click", handlers.onContinue);
  NATIVE.addListener.call(reloadBtn, "click", handlers.onReload);

  return {
    root,
    setChecking(busy) {
      btn.disabled = busy;
      btn.textContent = busy ? "Checking…" : CONTINUE_LABEL;
    },
    setNotice(text) {
      if (text === null) {
        notice.hidden = true;
        notice.textContent = "";
      } else {
        notice.hidden = false;
        notice.textContent = text;
      }
    },
    focus: () => NATIVE.focus.call(btn),
  };
}

export default function AdBlockGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<OverlayHandle | null>(null);
  const forcedRef = useRef(false);
  const checkingRef = useRef(false);

  const locked = status !== "clean";

  /* Continue-button handler (imperative overlay needs a stable reference).
     Deliberately self-resolving — pressing it can never leave the visitor
     stuck on the popup:
       1. run the probe;
       2. if it trips, wait 700ms and probe again (some blockers take a beat
          to un-apply the filters already injected into this document);
       3. if it STILL trips, reload the page — a fresh load re-evaluates the
          blocker's filters from scratch, which is the path visitors confirm
          works. If the blocker is genuinely still on, the popup comes back. */
  const onContinue = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    overlayRef.current?.setChecking(true);
    overlayRef.current?.setNotice(null);
    let blocked = await detectAdBlocker();
    if (blocked) {
      await new Promise<void>((resolve) => NATIVE.setTimeout(resolve, 700));
      blocked = await detectAdBlocker();
    }
    checkingRef.current = false;
    if (!blocked) {
      forcedRef.current = false;
      overlayRef.current?.setNotice(null);
      setStatus("clean"); // tears the overlay down via the status effect
      return;
    }
    // In-page probe still trips: reload so the check restarts from scratch.
    overlayRef.current?.setNotice(
      "Still detecting an ad blocker — reloading to re-check. If you've allowed ads, the page will open."
    );
    NATIVE.setTimeout(() => NATIVE.reload(), 1200);
  }, []);

  const buildOverlay = useCallback(
    () =>
      createLockOverlay({
        onContinue: () => void onContinue(),
        onReload: () => NATIVE.reload(),
      }),
    [onContinue]
  );

  /* 1 — the first thing that runs on load: check for ad blockers. */
  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get("adblock") === "force") {
      forcedRef.current = true;
      setStatus("blocked");
      return;
    }
    void detectAdBlocker().then((blocked) => {
      if (!cancelled) setStatus(blocked ? "blocked" : "clean");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 2 — while locked: mount the imperative overlay, freeze scrolling, and
        AUTO-RECOVER: the real probe re-runs every 4s and the instant the tab
        regains focus — the moment the visitor allows ads, the page unlocks
        itself within ~4s without any click. Runs in ?adblock=force preview
        too (a browser with no blocker clears the popup ~4s after load, which
        is exactly the recovery being previewed). The overlay lives outside
        React so console deletions can be repaired by re-appending a copy. */
  useEffect(() => {
    if (status !== "blocked") return;

    const overlay = buildOverlay();
    overlayRef.current = overlay;
    NATIVE.appendChild.call(document.body, overlay.root);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = NATIVE.setTimeout(() => overlay.focus(), 60);

    const tryUnlock = () => {
      if (checkingRef.current) return; // never race the Continue button's probe
      void detectAdBlocker().then((blocked) => {
        if (!blocked) {
          forcedRef.current = false;
          overlayRef.current?.setNotice(null);
          setStatus("clean"); // tears the overlay down via this effect's cleanup
        }
      });
    };

    const autoClear = NATIVE.setInterval(tryUnlock, 4000);
    // Blockers are toggled from a toolbar popup, which blurs the window and
    // never hides the tab — so listen for BOTH: window focus (returning from
    // the extension popup) and tab visibility. Either one re-checks at once
    // instead of waiting for the next 4s tick.
    const onReturn = () => {
      if (document.visibilityState === "visible") tryUnlock();
    };
    NATIVE.addEventListener("visibilitychange", onReturn);
    NATIVE.winAdd("focus", onReturn);

    return () => {
      NATIVE.clearTimeout(focusTimer);
      NATIVE.clearInterval(autoClear);
      NATIVE.removeEventListener("visibilitychange", onReturn);
      NATIVE.winRemove("focus", onReturn);
      // Remove whatever node is CURRENTLY live: if the watchdog already
      // repaired a console-deleted overlay, the original local reference is
      // stale and the fresh copy would stay stuck on <body> forever.
      const current = overlayRef.current;
      if (current && NATIVE.isConnected(current.root) && current.root.parentNode) {
        NATIVE.removeChild.call(current.root.parentNode, current.root);
      }
      document.body.style.overflow = prevOverflow;
      overlayRef.current = null;
    };
  }, [status, buildOverlay]);

  /* 3 — while unlocked, keep re-scanning: this also re-locks the page if
        someone force-flips React state to "clean" from DevTools, or enables
        a blocker mid-session. */
  useEffect(() => {
    if (status !== "clean") return;
    const recheck = () => {
      void detectAdBlocker().then((blocked) => {
        if (blocked) setStatus("blocked");
      });
    };
    const id = NATIVE.setInterval(recheck, 6000);
    // Enabling a blocker happens in the toolbar popup (window blurs, tab
    // stays visible) — re-check the moment the visitor comes back to the
    // page instead of waiting up to 6s for the interval.
    const onReturn = () => {
      if (document.visibilityState === "visible") recheck();
    };
    NATIVE.addEventListener("visibilitychange", onReturn);
    NATIVE.winAdd("focus", onReturn);
    return () => {
      NATIVE.clearInterval(id);
      NATIVE.removeEventListener("visibilitychange", onReturn);
      NATIVE.winRemove("focus", onReturn);
    };
  }, [status]);

  /* 4 — capture-phase guards: swallow every input event whose target isn't
        inside the overlay. Re-registered twice a second in case a console
        user removes them via getEventListeners(). Escape never dismisses. */
  useEffect(() => {
    if (status !== "blocked") return;
    const guard = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") {
        NATIVE.stopPropagation.call(e);
        NATIVE.preventDefault.call(e);
        return;
      }
      const overlay = overlayRef.current?.root;
      if (overlay && e.target instanceof Node && NATIVE.contains.call(overlay, e.target)) return;
      NATIVE.stopPropagation.call(e);
      if (e.cancelable) NATIVE.preventDefault.call(e);
    };
    const add = () => {
      for (const type of GUARDED_EVENTS) NATIVE.addEventListener(type, guard, GUARD_OPTS);
    };
    const remove = () => {
      for (const type of GUARDED_EVENTS) NATIVE.removeEventListener(type, guard, GUARD_OPTS);
    };
    add();
    const reassert = NATIVE.setInterval(add, 500);
    return () => {
      remove();
      NATIVE.clearInterval(reassert);
    };
  }, [status]);

  /* 5 — the lock watchdog: while (and only while) BLOCKED, re-assert that
        • the app wrapper is still inert / aria-hidden / pointer-events-none
        • the overlay is still present, connected, and intact
        • the React root still exists (else reload — it can't be repaired)
        Driven by rAF (~100ms) AND a 250ms setInterval fallback, so repairs
        still land on time when animation frames are throttled (hidden or
        occluded tab, battery saver, heavy load). Gated on `blocked` (not
        `locked`) so it can never mount the popup during the initial
        "checking" window on a clean browser. */
  useEffect(() => {
    if (status !== "blocked") return;
    let raf = 0;
    let last = -1e9;

    const ensure = () => {
      const root = NATIVE.getElementById.call(document, "root");
      if (!root || !NATIVE.isConnected(root)) {
        NATIVE.reload();
        return;
      }

      const wrapper = wrapperRef.current;
      if (wrapper) {
        // Attribute-level, not property-level: a console user can redefine the
        // `inert` IDL accessor to fool property reads/writes, but can't stop
        // setAttribute from mutating the content attribute the UA enforces.
        if (!NATIVE.hasAttribute.call(wrapper, "inert")) {
          NATIVE.setAttribute.call(wrapper, "inert", "");
        }
        if (NATIVE.getAttribute.call(wrapper, "aria-hidden") !== "true") {
          NATIVE.setAttribute.call(wrapper, "aria-hidden", "true");
        }
        NATIVE.classListAdd.call(wrapper.classList, "pointer-events-none", "select-none");
      }

      const overlay = overlayRef.current;
      const intact =
        overlay &&
        NATIVE.isConnected(overlay.root) &&
        NATIVE.querySelector.call(overlay.root, "[data-continue]");
      if (!intact) {
        // Deleted / emptied / detached from <body>: repair with a fresh copy.
        if (overlay && overlay.root.parentNode) {
          try {
            NATIVE.removeChild.call(overlay.root.parentNode, overlay.root);
          } catch {
            /* already gone */
          }
        }
        const fresh = buildOverlay();
        overlayRef.current = fresh;
        NATIVE.appendChild.call(document.body, fresh.root);
        fresh.focus();
      }
    };

    const tick = (ts: number) => {
      raf = NATIVE.rAF(tick);
      if (ts - last < 100) return;
      last = ts;
      ensure();
    };

    raf = NATIVE.rAF(tick);
    const fallback = NATIVE.setInterval(ensure, 250);
    return () => {
      NATIVE.cAF(raf);
      NATIVE.clearInterval(fallback);
    };
  }, [status, buildOverlay]);

  return (
    <>
      {/* The whole app: inert (unfocusable, unclickable, untypeable) while locked.
          React renders this declaratively; the watchdog re-asserts it if tampered. */}
      <div
        ref={wrapperRef}
        inert={locked}
        aria-hidden={locked || undefined}
        className={locked ? "pointer-events-none select-none" : undefined}
      >
        {children}
      </div>
      {/* The lockout overlay itself is imperative (see createLockOverlay). */}
    </>
  );
}
