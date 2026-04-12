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

      {/* ECharts → HTMX: chart-click / chart-hover for dashboards */}
      <section
        id="chart-events-section"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>Chart events (HTMX bridge)</h2>
        <p>
          Click or hover a pie slice and open the browser console:{" "}
          <code>chart-click</code> and <code>chart-hover</code> fire on this
          element with <code>event.detail</code> (series name, value, indices,
          etc.). Use <code>hx-trigger=&quot;chart-click&quot;</code> on the same
          chart container to load fragments (e.g. a detail table) without extra
          JavaScript.
        </p>

        <div
          data-chart-type="pie"
          data-url="/charts/pie"
          {...{
            "hx-on::chart-click":
              "console.log('chart-click', event.detail)",
            "hx-on::chart-hover":
              "console.log('chart-hover', event.detail)",
          }}
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>

      {/* Empty state: backend returns option with graphic text (no series data) */}
      <section
        id="empty-chart-section"
        style={{ width: "100%", maxWidth: 640, marginBottom: 40 }}
      >
        <h2>No data placeholder (<code>graphic</code>)</h2>
        <p>
          When there is nothing to plot, the API can still return a valid
          option: empty axes/series plus a{" "}
          <a href="https://echarts.apache.org/en/option.html#graphic">
            graphic
          </a>{" "}
          element so the chart area shows a message instead of a blank box.
        </p>

        <div
          data-chart-type="bar"
          data-url="/charts/empty-placeholder"
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>

            {/* 4. Client-side line chart (static fetch, 1sec polling) */}
      <section
        id="pie-chart-section"
        style={{ width: "100%", maxWidth: 740, marginBottom: 40 }}
      >
        <h2>Line chart polling every 1000ms</h2>

        <div
          data-chart-type="pie"
          data-url="/charts/line-polling poll:1000ms"
          data-theme="dark"
          style={{ width: "100%", height: 400, border: "1px solid #eee" }}
        />
      </section>
    </div>
  );
};