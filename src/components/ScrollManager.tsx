import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Centralized scroll management for client-side route changes.
 *
 * Root cause of "destination opens at the previous page's scroll position":
 * with <BrowserRouter> the document never reloads, so the window keeps its
 * scroll offset across route transitions unless the app resets it. React
 * Router's <ScrollRestoration> only works with data routers, so this component
 * provides the equivalent behavior for the plain <Routes> setup:
 *
 *  - navigation to a hash (e.g. /legal#dmca) → scroll to that element,
 *    falling back to top when the element doesn't exist (intentional anchor
 *    navigation is preserved; in-page #hash links never reach here)
 *  - PUSH navigation to a different path → scroll to top
 *  - POP (Back/Forward) to a different path → restore the remembered
 *    position when we have one, otherwise top
 *  - first location of a fresh document load (direct URL / refresh) → top
 *  - query-only changes on the SAME path (e.g. /?project=<id>) → leave the
 *    viewport alone: switching content inline is not a page change, so it
 *    must not jump the reader back to the top
 *
 * history.scrollRestoration is switched to "manual" so the browser does not
 * fight the SPA with its own (often stale) restoration. Positions are kept
 * in memory (and mirrored to sessionStorage for same-tab resilience) keyed by
 * React Router's location.key.
 */

const STORE_KEY = "docstudio:scrollpos";

function loadStore(): Map<string, number> {
  const map = new Map<string, number>();
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
        if (typeof v === "number") map.set(k, v);
      }
    }
  } catch {
    /* storage unavailable — in-memory only */
  }
  return map;
}

function persist(store: Map<string, number>): void {
  try {
    // Bound the store so it cannot grow without limit.
    if (store.size > 50) {
      const oldest = Array.from(store.keys()).slice(0, store.size - 50);
      for (const k of oldest) store.delete(k);
    }
    sessionStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(store)));
  } catch {
    /* ignore */
  }
}

interface Loc {
  key: string;
  pathname: string;
  hash: string;
}

export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const store = useRef<Map<string, number> | null>(null);
  const prev = useRef<Loc | null>(null);
  const firstRun = useRef(true);

  // Take manual control of scroll restoration (refresh/direct loads start at top).
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    store.current = loadStore();
    return () => {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "auto";
      }
    };
  }, []);

  // Remember where the previous location was scrolled before moving on.
  useEffect(() => {
    const savePrev = () => {
      if (prev.current && store.current) {
        store.current.set(prev.current.key, window.scrollY);
        persist(store.current);
      }
    };
    window.addEventListener("pagehide", savePrev);
    return () => window.removeEventListener("pagehide", savePrev);
  }, []);

  useEffect(() => {
    const storeMap = store.current ?? (store.current = loadStore());
    const before = prev.current;

    // Capture the outgoing location's position before we move the viewport.
    if (before && before.key !== location.key) {
      storeMap.set(before.key, window.scrollY);
      persist(storeMap);
    }

    // Same path + no new hash → only the query changed (inline state such as
    // /?project=<id>). Not a page transition: keep the current scroll.
    const samePage =
      !firstRun.current &&
      before !== null &&
      before.pathname === location.pathname &&
      before.hash === location.hash;

    const scrollToTop = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const scrollToHash = () => {
      const id = decodeURIComponent(location.hash.replace(/^#/, ""));
      const el = id ? document.getElementById(id) : null;
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        scrollToTop();
      }
    };
    const restore = () => {
      const saved = storeMap.get(location.key);
      if (saved === undefined) return false;
      // Wait a frame so the new route has painted before restoring.
      requestAnimationFrame(() => window.scrollTo({ top: saved, left: 0, behavior: "auto" }));
      return true;
    };

    const handle = () => {
      // Hash wins whenever one is present (direct loads and hash changes).
      if (location.hash) {
        scrollToHash();
        return;
      }
      // Fresh document load (direct URL or refresh): deterministic top.
      if (firstRun.current) {
        scrollToTop();
        return;
      }
      if (samePage) return; // query-only change — do not move the viewport
      // Dropping a hash on the same page means "back to the top" of it.
      if (before !== null && before.hash && before.pathname === location.pathname) {
        scrollToTop();
        return;
      }
      if (navType === "POP") {
        if (restore()) return;
      }
      scrollToTop();
    };

    // Run after paint so layout of the new route exists.
    requestAnimationFrame(handle);
    firstRun.current = false;
    prev.current = { key: location.key, pathname: location.pathname, hash: location.hash };
  }, [location, navType]);

  return null;
}
