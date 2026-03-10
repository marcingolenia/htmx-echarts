### HTMX + ECharts SSE Extension

An `htmx` extension (`echarts`) that connects `htmx`, `ECharts`, and Server-Sent Events (SSE) for live-updating (or statically-fetched) charts.

---

## Installation

You need:

- **HTMX**
- **ECharts** (browser bundle)
- **`htmx-echarts.js`** (this extension)

Example layout head:

```tsx
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analytica</title>

  {/* HTMX */}
  <script src="/static/htmx.min.js.js" defer></script>

  {/* ECharts must be loaded before the helper */}
  <script
    src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"
    defer
  ></script>

  {/* Extension file */}
  <script src="/static/htmx-echarts.js" defer></script>
</head>
```

`htmx-echarts.js` assumes `window.echarts` is available.

### 2. Enable the extension

Activate the extension on any region that contains charts (commonly `body`):

```html
<body hx-ext="echarts">
  ...
</body>
```

---

## How it works

- The extension registers as `echarts` via `htmx.defineExtension("echarts", ...)`.
- On **`htmx:load`** within an `hx-ext="echarts"` region, it scans the loaded fragment for `[data-chart-type]` and initializes charts.
- On **HTMX cleanup** (`htmx:beforeCleanupElement`), for any subtree being removed inside an `hx-ext="echarts"` region, it cleans up charts.
- For each chart element:
  - Creates an ECharts instance on that element.
  - Attaches a `ResizeObserver` so the chart resizes with its container.
  - Reads:
    - `data-url`: endpoint for either SSE or static JSON fetch.
    - `data-sse-event`: when present, enables SSE streaming mode.
  - **Static mode** (no `data-sse-event`):
    - Performs `fetch(data-url)` once.
    - Expects the response body to be a **full ECharts option object**.
    - Calls `chart.setOption(option)` with that object.
  - **SSE mode** (`data-sse-event` present):
    - Creates an `EventSource(data-url)`.
    - Listens for SSE events with the given name.
    - For each event:
      - Parses `event.data` as JSON.
      - Expects a **full (or partial) ECharts option object**.
      - Calls `chart.setOption(option)` to update the chart.
- On cleanup it:
  - Closes any `EventSource`s.
  - Disposes ECharts instances.
  - Disconnects `ResizeObserver`s.
  - Clears internal references on the chart elements.

So charts are:

- Automatically initialized when they appear (initial render or HTMX swap).
- Continuously updated from SSE.
- Properly cleaned up when removed, avoiding memory and connection leaks.

---

## Usage

### Frontend: Markup

Add containers with `data-chart-type` and attributes for either **SSE streaming** or **static fetch**.

The behavior is:

- If `data-url` is set **and** `data-sse-event` is set → **SSE streaming** mode.
- If `data-url` is set and `data-sse-event` is **not** set → **static fetch** mode (one-shot fetch of JSON data).

#### Minimal example (line chart, SSE streaming)

```html
<section style="max-width: 640px;">
  <h2>SSE ECharts (line)</h2>

  <div
    id="sse-chart"
    data-chart-type="line"
    data-url="/sse"
    data-sse-event="chart-update"
    style="height: 400px; border: 1px solid #eee;"
  ></div>
</section>
```

#### Bar chart example (SSE streaming)

```html
<section style="max-width: 640px;">
  <h2>SSE ECharts (multi-series)</h2>

  <div
    id="sse-chart-multi"
    data-chart-type="line"
    data-url="/sse-multi"
    data-sse-event="chart-update"
    style="height: 400px; border: 1px solid #eee;"
  ></div>
</section>
```

#### Static chart example (one-shot fetch, no SSE)

```html
<section style="max-width: 640px;">
  <h2>Static ECharts (fetch JSON once)</h2>

  <div
    id="static-chart"
    data-chart-type="line"
    data-url="/initial-data"
    style="height: 400px; border: 1px solid #eee;"
  ></div>
</section>
```

In this mode:

- The helper creates the ECharts instance and `ResizeObserver`.
- It performs a single `fetch("/initial-data")` on init.
- The JSON response must be a **full ECharts option**, for example:

  ```json
  {
    "tooltip": { "trigger": "axis" },
    "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed"] },
    "yAxis": { "type": "value" },
    "series": [
      { "name": "2011", "type": "line", "data": [10, 20, 30] },
      { "name": "2012", "type": "bar",  "data": [5, 15, 25] }
    ]
  }
  ```

  and the helper will **not** open an SSE connection (no streaming).

**Supported attributes:**

- `data-chart-type` (optional): chart type hint (e.g. `"line"`, `"bar"`). Helpful for semantics but not required, since the option comes from the backend.
- `data-url` (required): URL used either for SSE streaming or static JSON fetch.
- `data-sse-event` (optional): when set, the helper opens an `EventSource` to `data-url` and listens for this SSE event name; when omitted, the helper performs a single `fetch(data-url)` and treats the response as static data.

**Payload format (both static and SSE)**:

- A JSON object that is a valid ECharts option, e.g.:

  ```json
  {
    "tooltip": { "trigger": "axis" },
    "xAxis": { "type": "category", "data": ["Mon", "Tue"] },
    "yAxis": { "type": "value" },
    "series": [
      { "name": "Series A", "type": "line", "data": [1, 2] }
    ]
  }
  ```

### Backend: SSE endpoint examples

#### Hono + Bun example (single-series)

```ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

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

      const option = {
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
        event: "chart-update", // matches data-sse-event
        data: JSON.stringify(option),
      });

      await stream.sleep(1000);
    }
  });
});
```

#### Generic Node-style example (Express-like pseudo-code)

```js
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let id = 0;
  const labels = [];
  const values = [];
  const maxPoints = 50;

  const interval = setInterval(() => {
    const label = new Date().toISOString();
    const value = Math.round(Math.random() * 100);

    labels.push(label);
    values.push(value);
    if (labels.length > maxPoints) {
      labels.shift();
      values.shift();
    }

    const option = {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value" },
      series: [
        { name: "Random", type: "line", data: values },
      ],
    };

    res.write(
      `id: ${id++}\n` +
        `event: chart-update\n` +
        `data: ${JSON.stringify(option)}\n\n`,
    );
  }, 1000);

  req.on("close", () => {
    clearInterval(interval);
  });
});
```

#### ASP.NET Core (C#) example

Minimal API using `IResult` and `HttpResponse`:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/sse", async context =>
{
    var response = context.Response;
    response.Headers.Add("Content-Type", "text/event-stream");
    response.Headers.Add("Cache-Control", "no-cache");
    response.Headers.Add("Connection", "keep-alive");

    var id = 0;
    var cancellation = context.RequestAborted;
    var writer = new StreamWriter(response.Body);

    while (!cancellation.IsCancellationRequested)
    {
        // build your option here (latest N points)
        var option = new {
            tooltip = new { trigger = "axis" },
            xAxis = new { type = "category", data = new[] { "A", "B", "C" } },
            yAxis = new { type = "value" },
            series = new[] {
                new { name = "Random", type = "line", data = new[] { 1, 2, 3 } }
            }
        };

        var json = JsonSerializer.Serialize(option);

        await writer.WriteAsync(
            $"id: {id++}\n" +
            $"event: chart-update\n" +
            $"data: {json}\n\n"
        );
        await writer.FlushAsync();

        await Task.Delay(1000, cancellation);
    }
});

app.Run();
```

This endpoint:

- Sets the correct SSE headers.
- Streams an event named `"chart-update"` every second, matching `data-sse-event="chart-update"` on the frontend.
- Sends payloads that are **full ECharts options**, which the helper applies with `setOption`.

#### Python (Flask) example

Simple SSE endpoint using Flask:

```python
from flask import Flask, Response
import json
import time
import random

app = Flask(__name__)


def event_stream():
    event_id = 0
    labels = []
    values = []
    max_points = 50

    while True:
        labels.append(time.strftime("%H:%M:%S"))
        values.append(random.randint(0, 100))

        if len(labels) > max_points:
            labels.pop(0)
            values.pop(0)

        option = {
            "tooltip": {"trigger": "axis"},
            "xAxis": {"type": "category", "data": labels},
            "yAxis": {"type": "value"},
            "series": [
                {"name": "Random", "type": "line", "data": values},
            ],
        }
        data = json.dumps(option)

        yield (
            f"id: {event_id}\n"
            f"event: chart-update\n"
            f"data: {data}\n\n"
        )
        event_id += 1
        time.sleep(1)


@app.route("/sse")
def charts_sse():
    return Response(event_stream(), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True, threaded=True)
```

This endpoint:

- Uses a generator (`event_stream`) to yield SSE frames.
- Sets `mimetype="text/event-stream"` so browsers treat it as an SSE stream.
- Sends `chart-update` events with payloads that are **full ECharts options**.


