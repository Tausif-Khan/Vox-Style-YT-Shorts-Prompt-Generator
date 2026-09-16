import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const address = import.meta.env.VITE_CONVEX_URL as string;

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
