### HTMX + ECharts SSE Helper

A tiny helper to connect `htmx`, `ECharts`, and Server-Sent Events (SSE) for live-updating charts.

---

## Installation

You need:

- **HTMX**
- **ECharts** (browser bundle)
- **`htmx-echarts-sse.js`** (this helper)

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

  {/* This file */}
  <script src="/static/htmx-echarts-sse.js" defer></script>
</head>
```

`htmx-echarts-sse.js` assumes `window.echarts` is available.

---

## How it works

- On **initial page load** (`DOMContentLoaded`), the helper scans the DOM for elements with `data-sse-chart` and initializes them.
- On **HTMX swaps** (`htmx:afterSwap`), it scans only the swapped-in region (`evt.target`) and initializes any new `data-sse-chart` elements.
- For each such element:
  - Creates an ECharts instance on that element.
  - Sets up a basic chart configuration (category `xAxis`, numeric `yAxis`, one `series`).
  - Attaches a `ResizeObserver` so the chart resizes with its container.
  - Creates an `EventSource` using `data-sse-url`.
  - Listens for SSE events (name from `data-sse-event`, default `"message"`).
  - On each event, parses JSON payload `{ "label": string, "value": number }`:
    - Appends to internal `xData`/`yData` arrays.
    - Trims to `data-sse-max-points` (default `50`).
    - Calls `chart.setOption(...)` to update the series.
- On **HTMX cleanup** (`htmx:beforeCleanupElement`), for any subtree being removed:
  - Closes any `EventSource`s.
  - Disposes ECharts instances.
  - Disconnects `ResizeObserver`s.
  - Clears internal flags on the chart elements.

So charts are:

- Automatically initialized when they appear (initial render or HTMX swap).
- Continuously updated from SSE.
- Properly cleaned up when removed, avoiding memory and connection leaks.

---

## Usage

### Frontend: Markup

Add containers with `data-sse-chart` and attributes for either **SSE streaming** or **static fetch**.

The behavior is:

- If `data-sse-url` is set **and** `data-sse-event` is set → **SSE streaming** mode.
- If `data-sse-url` is set and `data-sse-event` is **not** set → **static fetch** mode (one-shot fetch of JSON data).

#### Minimal example (line chart, SSE streaming)

```html
<section style="max-width: 640px;">
  <h2>SSE ECharts (line)</h2>

  <div
    id="sse-chart"
    data-chart-type="line"
    data-url="/charts/sse"
    data-sse-event="chart-update"
    data-max-points="50"
    style="height: 400px; border: 1px solid #eee;"
  ></div>
</section>
```

#### Bar chart example (SSE streaming)

```html
<section style="max-width: 640px;">
  <h2>SSE ECharts (bar)</h2>

  <div
    id="sse-chart-bar"
    data-chart-type="bar"
    data-url="/charts/sse"
    data-sse-event="chart-update"
    data-max-points="30"
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
    data-url="/charts/initial-data"
    data-max-points="100"
    style="height: 400px; border: 1px solid #eee;"
  ></div>
</section>
```

In this mode:

- The helper creates the ECharts instance and `ResizeObserver`.
- It performs a single `fetch("/charts/initial-data")` on init.
- The JSON response should be either:

  ```json
  [
    { "label": "A", "value": 10 },
    { "label": "B", "value": 20 }
  ]
  ```

  or:

  ```json
  {
    "points": [
      { "label": "A", "value": 10 },
      { "label": "B", "value": 20 }
    ]
  }
  ```

  and the helper will plot those points and **not** open an SSE connection (no streaming).

**Supported attributes:**

- `data-chart-type` (required): chart type (e.g. `"line"`, `"bar"`).
- `data-url` (required): URL used either for SSE streaming or static JSON fetch.
- `data-sse-event` (optional): when set, the helper opens an `EventSource` to `data-url` and listens for this SSE event name; when omitted, the helper performs a single `fetch(data-url)` and treats the response as static data.
- `data-max-points` (optional): max number of points kept in memory and displayed (default `50`).

**Payload format** (expected from SSE):

```json
{ "label": "2026-03-09T12:34:56Z", "value": 42 }
```

### Backend: SSE endpoint examples

#### Hono + Bun example

```ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

// SSE endpoint for streaming data points to the chart
app.get("/charts/sse", (c) => {
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
        event: "chart-update", // matches data-sse-event
        data: JSON.stringify(point),
      });

      console.log("sse", point);
      await stream.sleep(1000);
    }
  });
});
```

#### Generic Node-style example (Express-like pseudo-code)

```js
app.get("/charts/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let id = 0;
  const interval = setInterval(() => {
    const point = {
      label: new Date().toISOString(),
      value: Math.round(Math.random() * 100),
    };

    res.write(
      `id: ${id++}\n` +
        `event: chart-update\n` +
        `data: ${JSON.stringify(point)}\n\n`,
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

app.MapGet("/charts/sse", async context =>
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
        var point = new
        {
            label = DateTime.Now.ToLongTimeString(),
            value = Random.Shared.Next(0, 100)
        };

        var json = JsonSerializer.Serialize(point);

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
- Sends payloads shaped like `{ "label": string, "value": number }`, which the helper expects.

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
    while True:
        point = {
            "label": time.strftime("%H:%M:%S"),
            "value": random.randint(0, 100),
        }
        data = json.dumps(point)

        yield (
            f"id: {event_id}\n"
            f"event: chart-update\n"
            f"data: {data}\n\n"
        )
        event_id += 1
        time.sleep(1)


@app.route("/charts/sse")
def charts_sse():
    return Response(event_stream(), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True, threaded=True)
```

This endpoint:

- Uses a generator (`event_stream`) to yield SSE frames.
- Sets `mimetype="text/event-stream"` so browsers treat it as an SSE stream.
- Sends `chart-update` events with `{ "label": string, "value": number }` payloads.


