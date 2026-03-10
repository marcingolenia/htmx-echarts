import { Hono } from "hono";
import * as echarts from "echarts";
import { streamSSE } from "hono/streaming";
import { Chart } from "./templates/chart";
import { Layout } from "./templates/layout";

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

// SSE endpoint for streaming incremental data points to a client-side ECharts chart
app.get("/sse", (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    let aborted = false;

    stream.onAbort(() => {
      aborted = true;
      console.log("SSE client disconnected");
    });

    while (!aborted) {
      const point = {
        label: new Date().toLocaleTimeString(),
        value: Math.round(Math.random() * 100),
      };

      await stream.writeSSE({
        id: String(id++),
        event: "chart-update",
        data: JSON.stringify(point),
      });
      console.log("sse", point);
      await stream.sleep(1000);
    }
  });
});

export default app;