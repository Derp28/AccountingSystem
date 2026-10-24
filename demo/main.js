import { createDemoState, handleDemoRequest } from "./api.js";
import { seed } from "./seed.js";

/**
 * Interactive demo entry point for the GitHub Pages site.
 *
 * The real UI (public/js) is copied next to this file at build time. It talks to
 * /api/* through fetch, so the demo swaps fetch for an in-memory handler before
 * the application boots. Everything the UI does is real application code; only
 * the persistence is replaced.
 */

const state = createDemoState(seed);

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
  return key ? headers[key] : null;
}

function installDemoApi() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === "string" ? input : input?.url ?? String(input);
    const url = new URL(rawUrl, window.location.href);

    if (!url.pathname.startsWith("/api/")) {
      return realFetch(input, init);
    }

    const method = String(init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    let body = null;
    if (typeof init.body === "string" && init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
    }

    // Keep the handler synchronous-looking for the caller, but answer through a
    // real Response so the UI's fetch wrapper behaves exactly as it does live.
    const result = handleDemoRequest(state, method, url.pathname + url.search, {
      body,
      headers: {
        "idempotency-key": headerValue(init.headers, "idempotency-key"),
        "content-type": headerValue(init.headers, "content-type"),
      },
    });

    return new Response(JSON.stringify(result.payload), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function mountDemoBanner() {
  const banner = document.createElement("aside");
  banner.className = "demo-banner";
  banner.setAttribute("role", "note");
  banner.innerHTML = `
    <strong>Interactive demo</strong>
    <span>
      Sample books from the real Ledgerline app, running entirely in your browser.
      Changes last until you reload, and nothing is sent anywhere.
      The sign-in screen accepts any password.
    </span>
    <a href="https://github.com/Derp28/AccountingSystem#run-from-source">Run it locally for real persistence</a>
  `;
  document.body.prepend(banner);
  document.documentElement.classList.add("has-demo-banner");
}

installDemoApi();
mountDemoBanner();
await import("../js/app.js");
