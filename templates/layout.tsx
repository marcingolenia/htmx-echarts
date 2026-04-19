export const Layout = ({ children }: { children?: unknown }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lytc</title>
        <script src="/static/htmx.min.js.js" defer></script>
        {/* Browser ECharts bundle so window.echarts is available */}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/6.0.0/echarts.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/6.0.0/theme/dark.min.js" defer></script>
        <script src="/static/htmx-echarts.js" defer></script>
      </head>
      <body hx-ext="echarts">
        <h1>tessa</h1>

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