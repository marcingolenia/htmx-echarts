export const Chart = ({ chart }: { chart: string }) => {
  return (
    <div style={{ width: "100%", height: "auto" }}>
      <h1>Interactive ECharts Examples</h1>

      {/* 1. Server-side rendered SVG chart updated via HTMX */}
      <section
        id="chart"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>SSR ECharts (HTMX refresh)</h2>

        <button
          hx-get="/charts/update-chart"
          hx-target="#chart-container"
          style={{ padding: 10, marginBottom: 20 }}
        >
          Randomize Data (HTMX)
        </button>

        <div
          id="chart-container"
          style={{ width: 600, height: 400, border: "1px solid #eee" }}
          dangerouslySetInnerHTML={{ __html: chart }}
        />
      </section>

      {/* 2. Client-side ECharts chart that receives data over SSE */}
      <section
        id="sse-chart-section"
        style={{ width: "100%", marginBottom: 40 }}
      >
        <h2>SSE ECharts (client-side streaming)</h2>
        <p>
          This chart runs entirely in the browser. The server only streams new
          data points over SSE, and the existing ECharts instance updates its
          series without a full re-render.
        </p>

        <div
          id="sse-chart"
          data-sse-chart="line"
          data-sse-url="/charts/sse"
          data-sse-event="chart-update"
          style={{ height: 400, border: "1px solid #eee" }}
        />
      </section>
      {/* 3. Client-side ECharts chart bar that receives data over SSE */}
      <section
        id="sse-chart-section"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>SSE ECharts (client-side streaming)</h2>
        <p>
          This chart runs entirely in the browser. The server only streams new
          data points over SSE, and the existing ECharts instance updates its
          series without a full re-render.
        </p>

        <div
          id="sse-chart-bar"
          data-sse-chart="bar"
          data-sse-url="/charts/sse"
          data-sse-event="chart-update"
          style={{ width: 600, height: 400, border: "1px solid #eee" }}
        />
      </section>
    </div>
  );
};