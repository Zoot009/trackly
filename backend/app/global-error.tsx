"use client";

// App-Router root error boundary. Providing this keeps `next build` from
// prerendering the legacy pages-router /_error page (the <Html> import crash).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "monospace", padding: 32 }}>
        <h1>Something went wrong</h1>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
