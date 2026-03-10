// HTMX extension: echarts-sse
// Turns any element with [data-chart-type] inside an hx-ext="echarts" region
// into an ECharts chart that can either:
// - stream points over SSE (when data-sse-event is present), or
// - fetch a static dataset once from data-url (when data-sse-event is absent).

const createChart = (el) => {
  const chart = window.echarts.init(el);

  const resizeObserver = new ResizeObserver(() => chart.resize());
  resizeObserver.observe(el);
  el._resizeObserver = resizeObserver;
  el._chartInstance = chart;

  return chart;
};

const remoteFetch = (chart, url) => {
  fetch(url)
  .then((r) => r.json())
  .then((data) => {
    chart.setOption(data);
  })
  .catch((err) => {
    console.error("Error fetching initial chart data", err);
  })
};

const remoteSSE = (chart, url, eventName) => {
  const source = new EventSource(url);
  source.addEventListener(eventName, (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      chart.setOption(payload);
    } catch (err) {
      console.error("SSE Data Error:", err);
    }
  }); 
  return source;
}

(() => {
  if (typeof htmx === "undefined") {
    console.error("htmx-echarts-sse.js: htmx is required but not found on window.");
    return;
  }

  const initEChart = (el) => {
    if (!el) return;
    if (!window.echarts) {
      console.error("ECharts library missing from window.");
      return;
    }
    const url = el.dataset.url;
    const eventName = el.dataset.sseEvent;
    if (!url) {
      console.error("Missing data-url on chart element", el);
      return;
    }

    const chart = createChart(el);

    if (eventName) {
      el._sseSource = remoteSSE(
        chart,
        url,
        eventName,
      );
    } else {
      remoteFetch(chart, url);
    }
  };

  const scanAndInit = (root) => {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-chart-type]");
    els.forEach(initEChart);
  };

  const cleanupECharts = (root) => {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-chart-type]");
    els.forEach((el) => {
      if (el._sseSource) el._sseSource.close();
      if (el._chartInstance) el._chartInstance.dispose();
      if (el._resizeObserver) el._resizeObserver.disconnect();
      el._sseSource = null;
      el._chartInstance = null;
      el._resizeObserver = null;
    });
  };

  htmx.defineExtension("echarts", {
    onEvent: (name, evt) => {
      if (name === "htmx:load") {
        const root = (evt.detail && evt.detail.elt) || evt.target;
        scanAndInit(root);
      }
      if (name === "htmx:historyRestore") {
        const root = (evt.detail && evt.detail.elt) || evt.target;
        cleanupECharts(root);
        scanAndInit(root);
      }
      if (name === "htmx:beforeCleanupElement") {
        const root = evt.target;
        cleanupECharts(root);
      }
    },
  });
})();