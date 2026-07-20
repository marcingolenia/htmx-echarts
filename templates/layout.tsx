export const Layout = ({ children }: { children?: unknown }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lytic</title>
        <script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0-beta5/dist/htmx.min.js" integrity="sha384-5dnhUXCt1hXGvYrjAnKwgNX3I8xtIJiW6eIHIbeo7oWyXv2XpWYC/rl+ZiWfuYO5" crossorigin="anonymous"></script>
        {/* Browser ECharts bundle so window.echarts is available */}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/6.0.0/echarts.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/6.0.0/theme/dark.min.js" defer></script>
        <script src="/static/htmx-echarts.js" defer></script>
      </head>
      <body>
        <h1>tessa</h1>

        <button
          hx-get="/api/hello"
          hx-swap="innerHTML"
          hx-target="#result"
          hx-push-url="true"
        >
          Load greeting
        </button>
        <button hx-get="/charts" hx-swap="innerHTML" hx-target="#charts" hx-push-url="true">charts</button>
        <div id="result">{children}</div>
        <div id="charts"></div>
      </body>
    </html>
  );
}