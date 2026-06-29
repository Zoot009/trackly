// Explicit App-Router 404 so the build doesn't fall back to the legacy
// pages-router error page (which imports <Html> and breaks `next build`).
export default function NotFound() {
  return (
    <main style={{ fontFamily: "monospace", padding: 32 }}>
      <h1>404</h1>
      <p>Not found. This is an API-only service — see /api/health.</p>
    </main>
  );
}
