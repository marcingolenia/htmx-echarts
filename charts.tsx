import { Hono } from "hono";
import * as echarts from 'echarts';
import { Chart } from "./templates/chart";

const app = new Hono();

// 1. Helper to generate the ECharts SVG
export const getChartSvg = (data: number[]) => {
  // Initialize in SSR mode
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 600,
    height: 400,
  })

  chart.setOption({
    xAxis: { type: 'category', data: ['A', 'B', 'C', 'D', 'E'] },
    yAxis: { type: 'value' },
    series: [{
      data: data,
      type: 'bar',
      emphasis: {
        label: {
          show: true,
          position: 'top',
          formatter: '{c}'
        },
        itemStyle: { color: '#5470c6' }
      }
    }]
  })

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svg
}


app.get("/", (c) => {
  return c.html(Chart({chart: getChartSvg([10, 20, 30, 40, 50])}));
});

app.get("/update-chart", (c) => {
  return c.html(getChartSvg([Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100]));
});

export default app;