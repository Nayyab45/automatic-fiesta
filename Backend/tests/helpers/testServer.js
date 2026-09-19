import express from 'express';

// Boots a real (if minimal) Express app around a single router, listening on
// an ephemeral port, and hands back plain-fetch-friendly helpers -- lets
// route tests exercise the actual routing/middleware/JSON-parsing stack
// instead of calling handler functions directly, without pulling in an extra
// HTTP-testing dependency (Node 22's global fetch is already enough).
export async function startTestServer(router, mountPath = '/') {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  // Mirrors src/server.js's fallback: an async handler's rejection (routed
  // here via asyncHandler) becomes a 500 instead of crashing the process.
  app.use((err, _req, res, _next) => {
    res.status(500).json({ message: err.message });
  });

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
