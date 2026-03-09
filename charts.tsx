import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.html(<div>Hello, world!</div>);
});

export default app;