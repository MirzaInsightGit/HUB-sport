// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
const http = require('http');

function toBool(v) {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/**
 * CRA dev proxy so the SPA can always call "/api/...".
 * Selection order (prefer Azure in dev):
 * 1) REACT_APP_API_BASE if it's a full URL (starts with http)
 * 2) BACKEND_LOCAL=1 -> http://localhost:8080/api
 * 3) REACT_APP_API_BASE_AZURE
 * 4) REACT_APP_API_BASE_PROD
 * 5) fallback http://localhost:8080/api
 */
module.exports = function (app) {
  const preferLocal = toBool(process.env.BACKEND_LOCAL);
  const envBase = process.env.REACT_APP_API_BASE;
  const azureBase = process.env.REACT_APP_API_BASE_AZURE;
  const prodBase = process.env.REACT_APP_API_BASE_PROD;

  let apiBase =
    (envBase && /^https?:/i.test(envBase) && envBase) ||
    (preferLocal && 'http://localhost:8080/api') ||
    azureBase ||
    prodBase ||
    'http://localhost:8080/api';

  // http-proxy-middleware expects target without trailing "/api"
  const target = apiBase.replace(/\/+api\/?$/, '');

  const useHttps = /^https:/i.test(target);
  // Keep connections alive to reduce TLS handshakes and avoid ECONNRESET on big payloads
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 20, timeout: 300000 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 20, timeout: 300000 });
  const agent = useHttps ? httpsAgent : httpAgent;

  let printed = false;
  let printedWs = false;

  app.use(
    '/api',
    (req, res, next) => {
      if (!printed) {
        // eslint-disable-next-line no-console
        console.log(`[setupProxy] /api → ${target}`);
        printed = true;
      }
      next();
    },
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
      xfwd: true,
      agent,
      proxyTimeout: 300000,
      timeout: 300000,
      logLevel: 'warn',
      ws: false,
      // Keep /api on the path. If your backend doesn't have the /api prefix, uncomment:
      // pathRewrite: { '^/api': '' },
      onProxyReq(proxyReq, req, res) {
        // Ensure keep-alive and forward x-forwarded headers consistently
        proxyReq.setHeader('Connection', 'keep-alive');
      },
      onError(err, req, res) {
        const code = err && (err.code || 'ECONNRESET');
        const payload = { error: 'proxy_error', code, target };
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      },
    })
  );

  app.use(
    '/socket.io',
    (req, res, next) => {
      if (!printedWs) {
        // eslint-disable-next-line no-console
        console.log(`[setupProxy] /socket.io (WS) → ${target}`);
        printedWs = true;
      }
      next();
    },
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
      xfwd: true,
      agent,
      ws: true,
      logLevel: 'warn',
      proxyTimeout: 300000,
      timeout: 300000,
      onProxyReqWs(proxyReq, req, socket, options, head) {
        // Keep WebSocket alive
        try { proxyReq.setHeader('Connection', 'keep-alive, Upgrade'); } catch {}
      },
      onError(err, req, res) {
        const code = err && (err.code || 'ECONNRESET');
        const payload = { error: 'proxy_error_ws', code, target };
        try {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        } catch {}
      },
    })
  );
};