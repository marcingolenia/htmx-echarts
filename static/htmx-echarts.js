// htmx-echarts: [data-chart-type], data-url (fetch | SSE + poll), chart-click / chart-hover
const P =
  "componentType componentSubType seriesType seriesIndex seriesName name dataIndex value data color".split(
    " ",
  );

const pick = (p) => {
  if (!p || typeof p !== "object") return {};
  const o = {};
  for (const k of P) if (p[k] !== undefined) o[k] = p[k];
  return o;
};

const bridge = (chart, el) => {
  let b = el.dataset.chartBridge;
  b =
    b == null || !String(b).trim()
      ? "click,hover"
      : String(b).trim().toLowerCase();
  if (b === "false" || b === "none") return;
  const t = b.split(",").map((s) => s.trim()).filter(Boolean);
  const onClick = t.includes("click");
  const onHover = t.includes("hover") || t.includes("mouseover");
  const cn = el.dataset.chartEventClick || "chart-click";
  const hn = el.dataset.chartEventHover || "chart-hover";
  const fire = (n, d) =>
    typeof htmx !== "undefined" && htmx.trigger
      ? htmx.trigger(el, n, d)
      : el.dispatchEvent(
          new CustomEvent(n, { bubbles: true, cancelable: true, detail: d }),
        );
  if (onClick) chart.on("click", (p) => fire(cn, pick(p)));
  if (onHover) chart.on("mouseover", (p) => fire(hn, pick(p)));
};

const createChart = (el) => {
  const chart = window.echarts.init(el, el.dataset.theme);
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);
  el._resizeObserver = ro;
  el._chartInstance = chart;
  return chart;
};

const parseDurationMs = (raw) => {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)(ms|s)?$/i);
  if (!m) return null;
  const n = +m[1];
  if (!Number.isFinite(n) || n <= 0) return null;
  return (m[2] || "ms").toLowerCase() === "s" ? Math.round(n * 1e3) : Math.round(n);
};

const parseDataUrl = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return { url: "", pollMs: null };
  const parts = s.split(/\s+/).filter(Boolean);
  let pollMs = null;
  for (const tok of parts.slice(1)) {
    const m = tok.match(/^poll:(.+)$/i);
    if (m) pollMs = parseDurationMs(m[1]);
  }
  return { url: parts[0] || "", pollMs };
};

const remoteFetch = (chart, url) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => chart.setOption(d))
    .catch((e) => console.error("htmx-echarts fetch", e));

const remoteSSE = (chart, url, ev) => {
  const src = new EventSource(url);
  src.addEventListener(ev, (e) => {
    try {
      chart.setOption(JSON.parse(e.data));
    } catch (err) {
      console.error("htmx-echarts SSE", err);
    }
  });
  return src;
};

(() => {
  if (typeof htmx === "undefined") {
    console.error("htmx-echarts: htmx missing");
    return;
  }

  const init = (el) => {
    if (!el) return;
    if (!window.echarts) {
      console.error("htmx-echarts: echarts missing");
      return;
    }
    const { url, pollMs } = parseDataUrl(el.dataset.url);
    const sse = el.dataset.sseEvent;
    if (!url) return console.error("htmx-echarts: missing data-url", el);

    const chart = createChart(el);
    bridge(chart, el);

    if (sse) el._sseSource = remoteSSE(chart, url, sse);
    else {
      remoteFetch(chart, url);
      if (pollMs) el._pollIntervalId = setInterval(() => remoteFetch(chart, url), pollMs);
    }
  };

  const scan = (root) => {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("[data-chart-type]").forEach(init);
  };

  const cleanup = (root) => {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("[data-chart-type]").forEach((el) => {
      el._sseSource?.close();
      if (el._pollIntervalId) clearInterval(el._pollIntervalId);
      el._chartInstance?.dispose();
      el._resizeObserver?.disconnect();
      el._sseSource = el._pollIntervalId = el._chartInstance = el._resizeObserver = null;
    });
  };

  htmx.defineExtension("echarts", {
    onEvent: (name, evt) => {
      const root = evt.detail?.elt || evt.target;
      if (name === "htmx:load") scan(root);
      else if (name === "htmx:historyRestore") {
        cleanup(root);
        scan(root);
      } else if (name === "htmx:beforeCleanupElement") cleanup(evt.target);
    },
  });
})();
