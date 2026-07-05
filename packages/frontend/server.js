import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

const BE = 'http://taskflowbackend.railway.internal:3000';

// Proxy API — handle before static files
app.use(
  createProxyMiddleware({
    target: BE,
    changeOrigin: true,
    pathFilter: '/api',
  }),
);

// Proxy WebSocket
app.use(
  createProxyMiddleware({
    target: BE,
    changeOrigin: true,
    ws: true,
    pathFilter: '/socket.io',
  }),
);

// Serve static files from Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
