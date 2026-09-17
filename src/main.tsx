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

if (!address) {
  console.error("Missing VITE_CONVEX_URL");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={new ConvexReactClient(address)}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>
);
