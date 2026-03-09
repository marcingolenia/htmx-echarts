export const Chart = ({ chart }: { chart: string }) => {
  return (
    <div id="chart" style={{ width: '100%', height: '400px' }}>
      <h1>Interactive Server-Side ECharts</h1>

      <button
        hx-get="/charts/update-chart"
        hx-target="#chart-container"
        style={{ padding: 10, marginBottom: 20 }}
      >
        Randomize Data (HTMX)
      </button>

      <div
        id="chart-container"
        style={{ width: 600, height: 400, border: '1px solid #eee' }}
        dangerouslySetInnerHTML={{ __html: chart }}
      />
    </div>
  );
};