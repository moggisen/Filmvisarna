// backend/helpers/bookingsStream.js
/** En superenkel SSE-hub per screeningId (JS/CommonJS) */
const rooms = new Map(); // Map<number, Set<{id:number,res:Response}>>
let seq = 1;

function bookingsStream(req, res) {
  const screeningId = Number(req.query.screeningId);
  if (!Number.isFinite(screeningId)) return res.status(400).end("screeningId?");

  // Nödvändiga SSE-headrar
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // om man kör bakom nginx
  if (res.flushHeaders) res.flushHeaders();

  // Heartbeat (hindrar proxies från att stänga)
  const hb = setInterval(() => res.write(`:hb ${Date.now()}\n\n`), 15000);

  const client = { id: seq++, res };
  if (!rooms.has(screeningId)) rooms.set(screeningId, new Set());
  rooms.get(screeningId).add(client);

  req.on("close", () => {
    clearInterval(hb);
    const set = rooms.get(screeningId);
    if (set) set.delete(client);
  });
}

function emit(screeningId, event, payload) {
  const set = rooms.get(Number(screeningId));
  if (!set || set.size === 0) return;
  const msg =
    `event: ${event}\n` +
    `id: ${Date.now()}\n` +
    `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of set) {
    client.res.write(msg);
  }
}

// Publika helpers
function emitSeatHeld(screeningId, seatId, sessionId, expiresAt) {
  emit(screeningId, "seat:held", { seatId, sessionId, expiresAt });
}

function emitSeatReleased(screeningId, seatId) {
  emit(screeningId, "seat:released", { seatId });
}

function emitSeatBooked(screeningId, seatIds) {
  emit(screeningId, "seat:booked", { seatIds });
}

module.exports = {
  bookingsStream,
  emitSeatHeld,
  emitSeatReleased,
  emitSeatBooked,
};
