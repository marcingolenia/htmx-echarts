import { Hono } from "hono";
import * as echarts from "echarts";
import { streamSSE } from "hono/streaming";
import { Chart } from "./templates/chart";
import { Layout } from "./templates/layout";
import { type EChartsOption } from "echarts";

const app = new Hono();

export const getChartSvg = (data: number[]) => {
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: 600,
    height: 400,
  });

  chart.setOption({
    xAxis: { type: "category", data: ["A", "B", "C", "D", "E"] },
    yAxis: { type: "value" },
    series: [
      {
        data: data,
        type: "bar",
        emphasis: {
          label: {
            show: true,
            position: "top",
            formatter: "{c}",
          },
          itemStyle: { color: "#5470c6" },
        },
      },
    ],
  });

  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
};

// Page with both SSR+HTMX example and SSE+client ECharts example
app.get("/", (c) => {
  if (c.req.header("hx-request") === "true") {
    return c.html(Chart({ chart: getChartSvg([10, 20, 30, 40, 50]) }));
  }
  else {
    return c.html(Layout({ children: Chart({ chart: getChartSvg([10, 20, 30, 40, 50]) }) }));
  }
});

// HTMX endpoint to re-render the server-side SVG chart with new random data
app.get("/update-chart", (c) => {
  return c.html(
    getChartSvg([
      Math.random() * 100,
      Math.random() * 100,
      Math.random() * 100,
      Math.random() * 100,
      Math.random() * 100,
    ]),
  );
});

// Static JSON endpoint: full ECharts option for a pie chart (no SSE)
app.get("/pie", (c) => {
  const option: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: { top: "5%", left: "center" },
    series: [
      {
        name: "Share",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: { show: true, formatter: "{b}: {d}%" },
        data: [
          { value: 1048, name: "Search" },
          { value: 735, name: "Direct" },
          { value: 580, name: "Email" },
          { value: 484, name: "Union Ads" },
          { value: 300, name: "Video" },
        ],
      },
    ],
  };
  return c.json(option);
});

// SSE endpoint for streaming a single-series ECharts option
app.get("/sse", (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    let aborted = false;
    const labels: string[] = [];
    const values: number[] = [];
    const maxPoints = 50;

    stream.onAbort(() => {
      aborted = true;
      console.log("SSE client disconnected");
    });

    while (!aborted) {
      const label = new Date().toLocaleTimeString();
      const value = Math.round(Math.random() * 100);

      labels.push(label);
      values.push(value);
      if (labels.length > maxPoints) {
        labels.shift();
        values.shift();
      }

      const option: EChartsOption = {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: labels },
        yAxis: { type: "value" },
        series: [
          {
            name: "Random",
            type: "line",
            data: values,
          },
        ],
      };

      await stream.writeSSE({
        id: String(id++),
        event: "chart-update",
        data: JSON.stringify(option),
      });
      console.log("sse", option);
      await stream.sleep(1000);
    }
  });
});

// SSE endpoint for streaming a multi-series ECharts option
app.get("/sse-multi", (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    let aborted = false;
    const labels: string[] = [];
    const seriesA: number[] = [];
    const seriesB: number[] = [];
    const seriesC: number[] = [];
    const maxPoints = 50;

    stream.onAbort(() => {
      aborted = true;
      console.log("SSE multi-series client disconnected");
    });

    while (!aborted) {
      const label = new Date().toLocaleTimeString();

      labels.push(label);
      seriesA.push(Math.round(Math.random() * 100));
      seriesB.push(Math.round(Math.random() * 100));
      seriesC.push(Math.round(Math.random() * 100));

      if (labels.length > maxPoints) {
        labels.shift();
        seriesA.shift();
        seriesB.shift();
        seriesC.shift();
      }

      const option: EChartsOption = {
        tooltip: { trigger: "axis" },
        legend: { data: ["Series A", "Series B", "Series C"] },
        xAxis: { type: "category", data: labels },
        yAxis: { type: "value" },
        series: [
          { name: "Series A", type: "line", data: seriesA },
          { name: "Series B", type: "line", data: seriesB },
          { name: "Series C", type: "line", data: seriesC },
        ],
      };

      await stream.writeSSE({
        id: String(id++),
        event: "chart-update",
        data: JSON.stringify(option),
      });
      console.log("sse-multi", option);
      await stream.sleep(500);
    }
  });
});

// SSE endpoint: every second send full option built from "latest 10 points".
// Simulates a backend that filters in SQL (e.g. ORDER BY ts DESC LIMIT 10) and
// returns that window — no shifting; we just append and send slice(-10).
const LATEST_WINDOW = 10;

app.get("/sse-latest", (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    let aborted = false;
    const labels: string[] = [];
    const values: number[] = [];

    stream.onAbort(() => {
      aborted = true;
      console.log("SSE latest client disconnected");
    });

    while (!aborted) {
      labels.push(new Date().toLocaleTimeString());
      values.push(Math.round(Math.random() * 100));

      // "Query": latest N points (in production this would be your SQL result)
      const latestLabels = labels.slice(-LATEST_WINDOW);
      const latestValues = values.slice(-LATEST_WINDOW);

      const option: EChartsOption = {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: latestLabels },
        yAxis: { type: "value" },
        series: [
          { name: "Random", type: "line", data: latestValues },
        ],
      };

      await stream.writeSSE({
        id: String(id++),
        event: "chart-update",
        data: JSON.stringify(option),
      });
      console.log("sse-latest", latestLabels.length, "points");
      await stream.sleep(1000);
    }
  });
});


let data = [...Array(10).keys()].map(i => Math.random() * 100);
function labelsForLength(len: number, nowMs = Date.now()): string[] {
  // last element: now - 1s, before-last: now - 2s, ...
  return Array.from({ length: len }, (_, i) =>
    new Date(nowMs - (len - i) * 1000).toLocaleTimeString(),
  );
}

let labels = labelsForLength(data.length);
app.get("/line-polling", (c) => {
  data.shift();
  data.push(Math.random() * 100);
  labels.shift();
  labels.push(new Date().toLocaleTimeString());
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: labels },
    yAxis: { type: "value" },
    series: [
      {
        name: "Random",
        type: "line",
        data: data,
      },
    ],
  };
  return c.json(option);
});

export default app;