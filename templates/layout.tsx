export const Layout = ({ children }: { children?: unknown }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lytc</title>
        <script src="/static/htmx.min.js.js" defer></script>
        <script src="/static/htmx-ext-sse.min.js" defer></script>
        {/* Browser ECharts bundle so window.echarts is available */}
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js" defer></script>
        <script src="/static/sse-chart.js" defer></script>
      </head>
      <body hx-ext="sse">
        <h1>tessa</h1>
        <img src="/static/unnamed.png" alt="Lytic" />

        <button
          hx-get="/api/hello"
          hx-swap="innerHTML"
          hx-target="#result"
          hx-push-url="true"
        >
          Load grseseting
        </button>
        <button hx-get="/adder" hx-swap="innerHTML" hx-target="#adder">Add</button>
        <button hx-get="/charts" hx-swap="innerHTML" hx-target="#charts" hx-push-url="true">charts</button>
        <div id="result">{children}</div>
        <div id="adder"></div>
        <div id="charts"></div>
      </body>
    </html>
  );
}