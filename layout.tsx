export default function Layout({ children }: { children?: unknown }) {
  return (
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Lytc</title>
      <script src="/static/htmx.min.js.js" defer></script>
    </head>
    <body>
     <h1>adddd</h1>
     <img src="/static/unnamed.png" alt="Lytic" />

     <button hx-get="/api/hello" hx-swap="innerHTML" hx-target="#result" hx-push-url="true">
       Load grseseting
     </button>
     <div id="result">{children}</div>
   </body>
    </html>
  );
}