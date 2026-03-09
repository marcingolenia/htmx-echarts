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

(function () {
  function initStreamingLineChart(el) {
    if (!el || el.dataset.sseChartInitialized === "true") return;

    if (typeof window === "undefined" || !window.echarts) {
      console.error(
        "ECharts is not available on window.echarts. " +
          "Make sure echarts.min.js is loaded before sse-chart.js.",
      );
      return;
    }

    var existing = window.echarts.getInstanceByDom(el);
    var chart = existing || window.echarts.init(el);

    var xData = [];
    var yData = [];

    var chartType = el.getAttribute("data-sse-chart") || "line";

    var maxPoints = parseInt(
      el.getAttribute("data-sse-max-points") || "50",
      10,
    );

    chart.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: chartType === "bar" ? "shadow" : "line" },
      },
      xAxis: { type: "category", data: xData },
      yAxis: { type: "value" },
      series: [
        {
          type: chartType,
          data: yData,
          smooth: chartType === "line",
          areaStyle: chartType === "line" ? {} : undefined,
          emphasis: {
            focus: "series",
            label: {
              show: true,
              position: chartType === "bar" ? "top" : "right",
            },
          },
        },
      ],
    });

    var url = el.getAttribute("data-sse-url") || "/charts/sse";
    var eventName = el.getAttribute("data-sse-event") || "chart-update";

    var source = new EventSource(url);

    source.addEventListener(eventName, function (ev) {
      try {
        var point = JSON.parse(ev.data);
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
      } catch (e) {
        console.error("Invalid SSE chart payload", e);
      }
    });

    el.dataset.sseChartInitialized = "true";
  }

  function scanAndInit(root) {
    var scope = root || document;
    var els = scope.querySelectorAll("[data-sse-chart]");
    for (var i = 0; i < els.length; i++) {
      initStreamingLineChart(els[i]);
    }
  }

  // Re-run after HTMX swaps, so charts loaded via hx-get / hx-swap are initialized
  document.addEventListener("htmx:afterSwap", function (evt) {
    scanAndInit(evt.target || document);
  });
})();

