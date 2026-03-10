// Simple helper for SSE-driven ECharts line charts in the browser.
// Usage pattern:
//   1) Add a container:
//        <div
//          id="my-streaming-chart"
//          data-sse-chart="line"
//          data-sse-url="/charts/sse"
//          data-sse-event="chart-update"      (optional, default: "chart-update")
//          data-sse-max-points="50"           (optional, default: 50)
//        ></div>
//   2) Stream SSE events with JSON payloads: { "label": "...", "value": 123 }
(() => {
  const initChart = (el) => {
    if (!el || el.dataset.sseChartInitialized === "true") return;

    // Ensure ECharts is loaded (Full version required for this specific script)
    if (!window.echarts) return console.error("ECharts missing");

    const chart = window.echarts.init(el);
    let xData = [];
    let yData = [];

    const chartType = el.dataset.sseChart || "line";
    const maxPoints = parseInt(el.dataset.sseMaxPoints || "50");

    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: xData },
      yAxis: { type: "value" },
      series: [{ type: chartType, data: yData }]
    });

    const source = new EventSource(el.dataset.sseUrl || "/charts/sse");
    
    source.addEventListener(el.dataset.sseEvent || "chart-update", (ev) => {
      const point = JSON.parse(ev.data);
      xData.push(point.label);
      yData.push(point.value);

      if (xData.length > maxPoints) {
        xData.shift();
        yData.shift();
      }

      chart.setOption({
        xAxis: { data: xData },
        series: [{ data: yData }]
      });
    });
    // For cleanup: Close SSE and dispose chart when element is removed
    el._sseSource = source;
    el._chartInstance = chart;
    el.dataset.sseChartInitialized = "true";
  };

  // HTMX Integration
  document.addEventListener("htmx:afterProcessNode", (e) => {
    const target = e.target;
    if (target.hasAttribute?.("data-sse-chart")) initChart(target);
    target.querySelectorAll?.("[data-sse-chart]").forEach(initChart);
  });

  document.addEventListener("htmx:beforeCleanupElement", (e) => {
    const el = e.target;
    if (el._sseSource) el._sseSource.close();
    if (el._chartInstance) el._chartInstance.dispose();
  });
})();
