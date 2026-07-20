import { Hono } from "hono";
import { Layout } from "./templates/layout";
import { serveStatic } from "hono/bun";
import charts from "./charts";

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

app.get("/api/hello", (c) => {
  if (c.req.header("hx-request") === "true") {
    return c.html(<p>Hi from Hono! (HMR is alived)</p>);
  }
  return c.html(Layout({ children: <h1>Hello, world!</h1> }));
});

app.route("/charts", charts);

export default {
  port: 3000,
  fetch: app.fetch,
  development: true,
};