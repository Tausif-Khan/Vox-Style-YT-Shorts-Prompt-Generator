import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Dev: same-origin (Vite proxies /api to the Convex backend) — immune to
// convex dev rewriting VITE_CONVEX_URL. Prod builds use the env var.
const address = import.meta.env.PROD
  ? (import.meta.env.VITE_CONVEX_URL as string)
  : window.location.origin;

// This site never writes to the browser console (product requirement):
// a missing backend URL surfaces as an on-page message instead.
if (address) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConvexProvider client={new ConvexReactClient(address)}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </StrictMode>
  );
} else {
  const notice = document.createElement("p");
  notice.textContent = "Setup incomplete: VITE_CONVEX_URL is not configured.";
  notice.style.cssText =
    "min-height:100vh;margin:0;padding:2rem;background:#14101c;color:#fff;font-family:sans-serif;";
  document.getElementById("root")?.replaceChildren(notice);
}
