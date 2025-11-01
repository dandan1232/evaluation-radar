const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(express.json({ limit: '256kb' }));

// In-memory store: id -> payload
const store = new Map();

function isValidPayload(p) {
  if (!p || typeof p !== 'object') return false;
  if (!p.id) return false;
  if (!Array.isArray(p.dims) || !Array.isArray(p.scores) || !Array.isArray(p.weights)) return false;
  const n = p.dims.length;
  if (!(n > 0 && p.scores.length === n && p.weights.length === n)) return false;
  return true;
}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

app.post('/api/submit', (req, res) => {
  const p = req.body;
  if (!isValidPayload(p)) return res.status(400).json({ ok: false, error: 'invalid payload' });
  const ts = Date.parse(p.submittedAt || '') || Date.now();
  p.submittedAt = new Date(ts).toISOString();
  store.set(p.id, p);
  broadcast('payload', p);
  res.json({ ok: true });
});

app.get('/api/list', (req, res) => {
  const arr = Array.from(store.values()).sort((a, b) => (Date.parse(a.submittedAt||'')||0) - (Date.parse(b.submittedAt||'')||0));
  res.json({ ok: true, data: arr });
});

// Static hosting for convenience
const root = path.resolve(__dirname, '..');
app.use(express.static(root));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
