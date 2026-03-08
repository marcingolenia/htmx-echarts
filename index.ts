import { Hono } from "hono";
import layout from "./layout";
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
  return c.html(layout({ children: "<h1>Hello, world!</h1>" }));
});

app.get("/api/hello", (c) => {
  // Now, if you change this text, Bun's --hot mode 
  // will pick it up because the fetch call is dynamic.
  return c.html("<p>Hi from Honsso! (HMR is alive)</p>");
});

export default {
  port: 3000,
  routes: {
  },
  fetch(req: Request) {
    return app.fetch(req);
  },
  development: true,
};