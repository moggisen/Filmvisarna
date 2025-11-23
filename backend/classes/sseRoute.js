// backend/classes/sseRoute.js
// ESM
const rooms = new Map(); // Map<number, Set<import('express').Response>>
const holdsByScreening = new Map(); // Map<number, Map<seatId, {sessionId, expiresAt}>>

function send(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`id: ${Date.now()}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(screeningId, event, payload) {
  const set = rooms.get(Number(screeningId));
  if (!set) return;
  for (const res of set) {
    try { send(res, event, payload); } catch {}
  }
}

// ---- Exporterade helpers (anropas från andra routes) ----
export function emitSeatHeld(screeningId, seatId, sessionId, expiresAt) {
  // spara i “snapshot”-bufferten så nyanslutna ser läget
  const m = holdsByScreening.get(screeningId) || new Map();
  m.set(Number(seatId), { sessionId: String(sessionId), expiresAt: Number(expiresAt) });
  holdsByScreening.set(screeningId, m);

  broadcast(screeningId, "seat:held", { seatId, sessionId, expiresAt });
}

export function emitSeatReleased(screeningId, seatId) {
  const m = holdsByScreening.get(screeningId);
  if (m) m.delete(Number(seatId));
  broadcast(screeningId, "seat:released", { seatId });
}

export function emitSeatBooked(screeningId, seatIds) {
  const m = holdsByScreening.get(screeningId);
  if (m) {
    for (const id of seatIds) m.delete(Number(id));
  }
  broadcast(screeningId, "seat:booked", { seatIds });
}

// ---- SSE-route ----
import { addClient, removeClient, getSnapshot } from '../helpers/sseRegistry.js';

export default class SseRoute {
  /**
   * @param {import('express').Express} app
   * @param {{ prefix?: string }} cfg
   */
  constructor(app, { prefix = '/api' } = {}) {
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    if (prefix.endsWith('/')) prefix = prefix.slice(0, -1);

    app.get(`${prefix}/bookings/stream`, (req, res) => {
      const screeningId = Number(req.query.screeningId);
      if (!Number.isFinite(screeningId)) {
        res.status(400).end('screeningId query param is required');
        return;
      }

      console.log(`[SSE] connect screeningId=${screeningId}`);

      // SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      // Första chunk så anslutningen flusher direkt
      res.write(`: connected ${Date.now()}\n\n`);

      // Snapshot från sseRegistry
      const snapshot = getSnapshot(screeningId);
      res.write(`id: 0\n`);
      res.write(`event: snapshot\n`);
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

      // Registrera klient
      addClient(screeningId, res);

      // Heartbeat
      const hb = setInterval(() => {
        try { res.write(`: ping ${Date.now()}\n\n`); } catch {}
      }, 15000);

      // Cleanup
      const cleanup = () => {
        clearInterval(hb);
        removeClient(screeningId, res);
        console.log(`[SSE] close screeningId=${screeningId}`);
      };
      req.on('close', cleanup);
      res.on('close', cleanup);
      res.on('finish', cleanup);
    });
  }
}
