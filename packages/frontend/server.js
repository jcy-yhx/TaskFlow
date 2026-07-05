import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 80;

// Serve static files from Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy API calls to the backend service
app.use(
  '/api',
  createProxyMiddleware({
    target: 'http://taskflowbackend.railway.internal:3000',
    changeOrigin: true,
  }),
);

// Proxy WebSocket
app.use(
  '/socket.io',
  createProxyMiddleware({
    target: 'http://taskflowbackend.railway.internal:3000',
    changeOrigin: true,
    ws: true,
  }),
);

// SPA fallback — serve index.html for any non-file route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
