(function () {
  function initEChart(el) {
    if (!el || el.dataset.eChartInitialized === "true") return;
    if (!window.echarts) {
      console.error("ECharts library missing from window.");
      return;
    }

    const chart = window.echarts.init(el);
    let xData = [];
    let yData = [];

    const chartType = el.dataset.chartType || "line";
    const maxPoints = parseInt(el.dataset.maxPoints || "50", 10);

    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: xData },
      yAxis: { type: "value" },
      series: [{ type: chartType, data: yData }],
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(el);

    const url = el.dataset.url;
    const eventName = el.dataset.sseEvent;

    if (!url) {
      console.warn("data-url is required for echarts charts");
      el._chartInstance = chart;
      el._resizeObserver = resizeObserver;
      el.dataset.eChartInitialized = "true";
      return;
    }

    // If no event name is provided, treat this as a static chart
    // and fetch data once from the URL instead of opening SSE.
    if (!eventName) {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const points = Array.isArray(data)
            ? data
            : Array.isArray(data.points)
            ? data.points
            : [];
          points.slice(-maxPoints).forEach((p) => {
            xData.push(p.label);
            yData.push(p.value);
          });
          chart.setOption({
            xAxis: { data: xData },
            series: [{ data: yData }],
          });
        })
        .catch((err) => {
          console.error("Error fetching initial chart data", err);
        })
        .finally(() => {
          el._chartInstance = chart;
          el._resizeObserver = resizeObserver;
          el.dataset.eChartInitialized = "true";
        });
      return;
    }

    // SSE mode: open an EventSource and stream updates
    const source = new EventSource(url);

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
    el.dataset.eChartInitialized = "true";
  }

  function scanAndInit(root) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-chart-type]");
    els.forEach(initEChart);
  }

  function cleanupECharts(root) {
    if (!root || !root.querySelectorAll) return;
    const els = root.querySelectorAll("[data-chart-type]");
    els.forEach((el) => {
      if (el._sseSource) el._sseSource.close();
      if (el._chartInstance) el._chartInstance.dispose();
      if (el._resizeObserver) el._resizeObserver.disconnect();
      el._sseSource = null;
      el._chartInstance = null;
      el._resizeObserver = null;
      el.dataset.eChartInitialized = "false";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      scanAndInit(document);
    });
  } else {
    scanAndInit(document);
  }

  document.addEventListener("htmx:afterSwap", function (evt) {
    const target = evt.target || (evt.detail && evt.detail.target) || document;
    scanAndInit(target);
  });

  document.addEventListener("htmx:beforeCleanupElement", function (evt) {
    const target = evt.target || (evt.detail && evt.detail.target) || null;
    if (!target) return;
    cleanupECharts(target);
  });
})();