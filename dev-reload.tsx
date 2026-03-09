/**
 * Lightweight dev auto-reload for Bun + Hono + JSX templates.
 *
 * Bun's built-in HMR injects a browser client only when you're serving an HTML
 * or JS entry through the Bun dev server/bundler (e.g. `bun dev index.html`),
 * where it can rewrite the HTML and add its own HMR script.
 *
 * In this setup the entry is a TSX server (`index.tsx`) that uses Hono to
 * render HTML via `c.html(<Layout />)`. Bun just runs the runtime server with
 * server-side hot module reload and never sees the rendered HTML, so it cannot
 * inject its HMR client and the browser never auto-refreshes.
 *
 * This module fills that gap by:
 * - exposing a version endpoint that changes when the server process reloads
 * - serving a tiny JS file that polls that endpoint and reloads the page
 *
 * It is dev-only (no-op when `NODE_ENV === "production"`), so it can be safely
 * left wired in for production builds without affecting behavior.
 */
import type { Hono } from "hono";

type DevReloadOptions = {
  versionPath?: string;
  scriptPath?: string;
  intervalMs?: number;
};

export function installDevReload(app: Hono, options: DevReloadOptions = {}) {
  if (Bun.env.NODE_ENV === "production") return;

  const versionPath = options.versionPath ?? "/__version";
  const scriptPath = options.scriptPath ?? "/__dev-reload.js";
  const intervalMs = options.intervalMs ?? 1000;

  const buildId = Date.now().toString();

  app.get(versionPath, (c) =>
    c.text(buildId, 200, {
      "cache-control": "no-store, must-revalidate",
    }),
  );

  const scriptSource = `
(() => {
  let v;
  console.log("DevReload active... 🚀");
  const poll = async () => {
    try {
      const res = await fetch(${JSON.stringify(versionPath)}, { cache: "no-store" });
      const text = await res.text();
      if (v === undefined) {
        v = text;
      } else if (v !== text) {
        window.location.reload();
        return;
      }
    } catch (_) {
      // ignore and retry
    }
    setTimeout(poll, ${intervalMs});
  };
  poll();
})();
`.trimStart();

  app.get(scriptPath, (c) =>
    c.text(scriptSource, 200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
    }),
  );
}

export function DevReload(options: DevReloadOptions = {}) {
  if (Bun.env.NODE_ENV === "production") return null;

  const scriptPath = options.scriptPath ?? "/__dev-reload.js";

  return <script src={scriptPath}></script>;
}


