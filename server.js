// Zero-dependency HTTP server for Word Garden. Serves the static frontend from
// public/ and a JSON API from /api/*. Run with: npm start  (or node server.js)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as api from './lib/api.js';
import * as db from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// Route table: maps "METHOD /api/path" to a handler. `p` = path segments after
// /api, `q` = query params, `body` = parsed JSON body.
async function handleApi(method, segments, query, body) {
  const [head, a, b] = segments;
  const key = `${method} /${head || ''}`;

  switch (true) {
    case method === 'GET' && head === 'bootstrap':
      return api.bootstrap();

    case method === 'GET' && head === 'students' && b === 'home':
      return api.studentHome(a);
    case method === 'GET' && head === 'students' && b === 'garden':
      return api.gardenView(a);

    case method === 'GET' && head === 'decks' && !!a:
      return api.deckView(query.studentId, a);

    case method === 'POST' && head === 'review':
      return api.review(body);
    case method === 'POST' && head === 'plant':
      return api.updatePlant(body);
    case method === 'POST' && head === 'avatar':
      return api.updateAvatar(body);
    case method === 'POST' && head === 'cheer':
      return api.cheer(body);

    case method === 'GET' && head === 'gardens':
      return api.gardensList();
    case method === 'GET' && head === 'leaderboard':
      return api.leaderboard();

    case method === 'GET' && head === 'teacher' && b === 'dashboard':
      return api.teacherDashboard(a);

    case method === 'POST' && head === 'reset':
      db.reset();
      return { ok: true };

    default:
      throw api.httpErr(404, `no route for ${key}`);
  }
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) { // path traversal guard
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      // SPA fallback to index.html for client routes.
      if (path.extname(filePath) === '') {
        return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(html);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      const segments = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '').split('/');
      const query = Object.fromEntries(url.searchParams);
      const body = (req.method === 'POST' || req.method === 'PUT')
        ? await readBody(req) : {};
      const result = await handleApi(req.method, segments, query, body);
      sendJSON(res, 200, result);
    } catch (err) {
      sendJSON(res, err.status || 500, { error: err.message });
    }
    return;
  }
  serveStatic(req, res, url.pathname);
});

db.load(); // seed on boot
server.listen(PORT, () => {
  console.log(`🌱 Word Garden running at http://localhost:${PORT}`);
});
