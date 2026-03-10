// HTMX + ECharts SSE helper
// Initializes any element with [data-sse-chart] and keeps it updated from an SSE endpoint.
(function () {
  function initSseChart(el) {
    if (!el || el.dataset.sseChartInitialized === "true") return;
    if (!window.echarts) {
      console.error("ECharts library missing from window.");
      return;
    }

    const chart = window.echarts.init(el);
    let xData = [];
    let yData = [];

    const chartType = el.dataset.sseChart || "line";
    const maxPoints = parseInt(el.dataset.sseMaxPoints || "50", 10);

    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: xData },
      yAxis: { type: "value" },
      series: [{ type: chartType, data: yData }],
    });

    // Handle responsiveness
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(el);

    const url = el.dataset.sseUrl;
    if (!url) {
      console.warn("data-sse-url is required for echarts SSE charts");
      return;
    }

    const source = new EventSource(url);
    const eventName = el.dataset.sseEvent || "message";

    source.addEventListener(eventName, (ev) => {
      try {
        const point = JSON.parse(ev.data);
        xData.push(point.label);
        yData.push(point.value);

        if (xData.length > maxPoints) {
          xData.shift();
          yData.shift();
        }

        chart.setOption({
          xAxis: { data: xData },
          series: [{ data: yData }],
        });
      } catch (err) {
        console.error("SSE Data Error:", err);
      }
    });

    el._sseSource = source;
    el._chartInstance = chart;
    el._resizeObserver = resizeObserver;
    el.dataset.sseChartInitialized = "true";
  }

  function scanAndInit(root) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-sse-chart]");
    els.forEach(initSseChart);
  }

  function cleanupSseCharts(root) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-sse-chart]");
    els.forEach((el) => {
      if (el._sseSource) el._sseSource.close();
      if (el._chartInstance) el._chartInstance.dispose();
      if (el._resizeObserver) el._resizeObserver.disconnect();
      el._sseSource = null;
      el._chartInstance = null;
      el._resizeObserver = null;
      el.dataset.sseChartInitialized = "false";
    });
  }

  // Initial page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      scanAndInit(document);
    });
  } else {
    scanAndInit(document);
  }

  // After HTMX swaps in new content
  document.addEventListener("htmx:afterSwap", function (evt) {
    const target = evt.target || (evt.detail && evt.detail.target) || document;
    scanAndInit(target);
  });

  // Before HTMX cleans up elements, close SSE + dispose charts
  document.addEventListener("htmx:beforeCleanupElement", function (evt) {
    const target = evt.target || (evt.detail && evt.detail.target) || null;
    if (!target) return;
    cleanupSseCharts(target);
  });

  console.log("htmx-echarts-sse.js loaded");
})();