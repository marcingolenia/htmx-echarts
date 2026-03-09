// Initializes the SSE-powered ECharts line chart on the element with id="sse-chart".
// The server only streams data; the chart instance lives entirely in the browser.

(function () {
  function initSseChartOnElement(el) {
    if (!el || el.dataset.sseChartInitialized === "true") return;

    function ensureEchartsAndInit() {
      if (typeof window === "undefined") return;

      if (typeof window.echarts === "undefined") {
        // Wait for the ECharts browser bundle to load
        setTimeout(ensureEchartsAndInit, 100);
        return;
      }

      var existing = window.echarts.getInstanceByDom(el);
      var chart = existing || window.echarts.init(el);

      var xData = [];
      var yData = [];

      chart.setOption({
        xAxis: { type: "category", data: xData },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            data: yData,
            smooth: true,
            areaStyle: {},
          },
        ],
      });

      var url = el.getAttribute("data-sse-url") || "/charts/sse";
      var source = new EventSource(url);

      source.addEventListener("chart-update", function (ev) {
        try {
          var point = JSON.parse(ev.data);
          xData.push(point.label);
          yData.push(point.value);

          var maxPoints = 50;
          if (xData.length > maxPoints) {
            xData.shift();
            yData.shift();
          }

          chart.setOption({
            xAxis: { data: xData },
            series: [{ data: yData }],
          });
        } catch (e) {
          console.error("Invalid chart-update payload", e);
        }
      });

      el.dataset.sseChartInitialized = "true";
    }

    ensureEchartsAndInit();
  }

  function scanAndInit(root) {
    var scope = root || document;
    var el = scope.querySelector("#sse-chart");
    if (el) {
      initSseChartOnElement(el);
    }
  }

  // Run on initial page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      scanAndInit(document);
    });
  } else {
    scanAndInit(document);
  }

  // Re-run after HTMX swaps, so charts loaded via hx-get / hx-swap are initialized
  document.addEventListener("htmx:afterSwap", function (evt) {
    scanAndInit(evt.target || document);
  });
})();

