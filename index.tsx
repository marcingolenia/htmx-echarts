import { Hono } from "hono";
import { Layout } from "./templates/layout";
import { serveStatic } from "hono/bun";
import { NumberAdder } from "./templates/number-adder";
import { streamSSE } from 'hono/streaming'

const app = new Hono();

app.use(
  "/static/*",
  serveStatic({
    root: "./static",
    rewriteRequestPath: (p) => p.replace(/^\/static\/?/, ""),
  })
);

app.get("/", (c) => {
  return c.html(Layout({ children: <h1>Hello, world!</h1> }));
});

app.get("/adder", (c) => {
  return c.html(NumberAdder());
});

app.get("/sse", (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0
    while (true) {
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: message,
        event: 'time-update',
        id: String(id++),
      })
      await stream.sleep(1000)
    }
  });
});

app.get("/api/hello", (c) => {
  if (c.req.header("hx-request") === "true") {
    return c.html(<p>Hi from Honsso! (HMR is alived)</p>);
  }
  return c.html(Layout({ children: <h1>Hello, world!</h1> }));
});

export default {
  port: 3000,
  fetch: app.fetch,
  development: true,
};