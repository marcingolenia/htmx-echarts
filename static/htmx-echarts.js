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

// A swap can dispose the chart while its request is still in flight; ECharts errors
// on any call made after that, so every async callback re-checks before touching it.
const alive = (chart) => chart && !chart.isDisposed?.();

const apply = (chart, option) => {
  if (!alive(chart)) return;
  chart.setOption(option);
  chart.hideLoading();
};

const remoteFetch = (chart, url) =>
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`.trim());
      return r.json();
    })
    .then((d) => apply(chart, d))
    .catch((e) => {
      console.error("htmx-echarts fetch", url, e);
      if (alive(chart)) chart.hideLoading();
    });

const remoteSSE = (chart, url, ev) => {
  const src = new EventSource(url);
  src.addEventListener(ev, (e) => {
    try {
      apply(chart, JSON.parse(e.data));
    } catch (err) {
      console.error("htmx-echarts SSE", err);
    }
  });
  // EventSource reconnects on its own, so this is diagnostic only.
  src.addEventListener("error", () => console.error("htmx-echarts SSE", url));
  return src;
};

(() => {
  if (typeof htmx === "undefined") {
    console.error("htmx-echarts: htmx missing");
    return;
  }

  const init = (el) => {
    if (!el || el._chartInstance) return;
    if (!window.echarts) {
      console.error("htmx-echarts: echarts missing");
      return;
    }
    const { url, pollMs } = parseDataUrl(el.dataset.url);
    const sse = el.dataset.sseEvent;
    if (!url) return console.error("htmx-echarts: missing data-url", el);

    const chart = createChart(el);
    bridge(chart, el);
    if (el.dataset.chartLoading !== "false") chart.showLoading();

    if (sse) el._sseSource = remoteSSE(chart, url, sse);
    else {
      remoteFetch(chart, url);
      if (pollMs) {
        // An endpoint slower than the poll interval would otherwise stack requests.
        let inFlight = false;
        el._pollIntervalId = setInterval(() => {
          if (inFlight) return;
          inFlight = true;
          remoteFetch(chart, url).then(() => { inFlight = false; });
        }, pollMs);
      }
    }
  };

  const destroy = (el) => {
    el._sseSource?.close();
    if (el._pollIntervalId) clearInterval(el._pollIntervalId);
    el._chartInstance?.dispose();
    el._resizeObserver?.disconnect();
    el._sseSource = el._pollIntervalId = el._chartInstance = el._resizeObserver = null;
  };

  // htmx 4 processes each swapped-in node, so the root itself may be a chart.
  const charts = (root) => {
    const found = [...(root?.querySelectorAll?.("[data-chart-type]") ?? [])];
    if (root?.matches?.("[data-chart-type]")) found.unshift(root);
    return found;
  };

  const scan = (root) => charts(root).forEach(init);
  const cleanup = (root) => charts(root).forEach(destroy);

  htmx.registerExtension("echarts", {
    htmx_after_process: (elt) => {
      scan(elt);
    },
    // htmx 4 fires htmx:before:cleanup only for [data-htmx-powered] elements, so a
    // plain chart div never sees it. The swap targets are where those charts go.
    htmx_before_swap: (_elt, detail) => {
      for (const task of detail?.tasks ?? []) {
        const spec = task?.swapSpec;
        const style = (typeof spec === "string" ? spec : spec?.style) || "";
        // Morph keeps matching elements in place and "none" swaps nothing, so the
        // charts survive; disposing them here would rebuild every one on each swap.
        if (style.includes("Morph") || style === "none") continue;
        cleanup(task.target);
      }
    },
    htmx_before_cleanup: (elt) => {
      cleanup(elt);
    },
  });
})();
