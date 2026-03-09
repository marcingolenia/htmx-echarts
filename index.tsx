import { Hono } from "hono";
import layout from "./templates/layout";
import { serveStatic } from "hono/bun";

const app = new Hono();

app.use(
  "/static/*",
  serveStatic({
    root: "./static",
    rewriteRequestPath: (p) => p.replace(/^\/static\/?/, ""),
  })
);
app.get("/", (c) => {
  return c.html(layout({ children: <h1>Hello, world!</h1> }));
});

app.get("/api/hello", (c) => {
  if (c.req.header("hx-request") === "true") {
    return c.html(<p>Hi from Honsso! (HMR is alive)</p>);
  }
  return c.html(layout({ children: <h1>Hello, world!</h1> }));
});

export default {
  port: 3000,
  fetch: app.fetch,
  development: true,
};