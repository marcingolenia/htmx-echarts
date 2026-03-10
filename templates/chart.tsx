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
          data-chart-type="line"
          data-url="/charts/sse"
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
          data-chart-type="bar"
          data-url="/charts/sse"
          data-sse-event="chart-update"
          style={{ width: 600, height: 400, border: "1px solid #eee" }}
        />
      </section>
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
          data-chart-type="scatter"
          data-url="/charts/sse-multi"
          data-sse-event="chart-update"
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>
      <section
        id="sse-chart-section-3"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>SSE ECharts (client-side streaming)</h2>
        <p>
          This chart runs entirely in the browser. The server only streams new
          data points over SSE, and the existing ECharts instance updates its
          series without a full re-render.
        </p>

        <div
          data-chart-type="line"
          data-url="/charts/sse-latest"
          data-sse-event="chart-update"
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>

      {/* 4. Client-side pie chart (static fetch, no SSE) */}
      <section
        id="pie-chart-section"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>Pie chart (static data)</h2>
        <p>
          Fetches a full ECharts option once from the server. No SSE.
        </p>

        <div
          data-chart-type="pie"
          data-url="/charts/pie"
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>
    </div>
  );
};