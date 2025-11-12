// helpers/sseRegistry.js  (ESM)
const clientsByTopic = new Map(); // topic(screeningId) -> Set<res>
const holdsByTopic = new Map();   // topic -> Map(seatId -> { sessionId, expiresAt, timer })
let nextEventId = 1;

const HOLD_TTL_MS = 120_000; // 2 min

// --- internal utils ---
function ensureTopic(topic) {
  if (!clientsByTopic.has(topic)) clientsByTopic.set(topic, new Set());
  if (!holdsByTopic.has(topic)) holdsByTopic.set(topic, new Map());
  return {
    clients: clientsByTopic.get(topic),
    holds: holdsByTopic.get(topic),
  };
}

function scheduleExpiry(topic, seatId) {
  const { holds } = ensureTopic(topic);
  const entry = holds.get(seatId);
  if (!entry) return;
  // rensa tidigare timer om den finns
  if (entry.timer) clearTimeout(entry.timer);

  const delay = Math.max(0, entry.expiresAt - Date.now());
  entry.timer = setTimeout(() => {
    const again = holds.get(seatId);
    if (!again) return;
    if (again.expiresAt <= Date.now()) {
      holds.delete(seatId);
      broadcast(topic, 'seat:released', { seatId, reason: 'expired' });
    }
  }, delay + 10);
  holds.set(seatId, entry);
}

// --- client registry (SSE plumbing) ---
export function addClient(topic, res) {
  ensureTopic(topic).clients.add(res);
}

export function removeClient(topic, res) {
  const set = clientsByTopic.get(topic);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    clientsByTopic.delete(topic);
    // valfritt: töm holdsByTopic när inga lyssnare finns kvar
    // holdsByTopic.delete(topic);
  }
}

export function broadcast(topic, type, data) {
  const set = clientsByTopic.get(topic);
  if (!set || set.size === 0) return;
  const payload =
    `id: ${nextEventId++}\n` +
    `event: ${type}\n` +
    `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch (_) {}
  }
}

// --- public API for holds ---
/**
 * Skapa eller förläng en hold.
 * @param {number|string} topic screeningId
 * @param {number|string} seatId
 * @param {string} sessionId
 * @param {{extend?: boolean, ttlMs?: number}} [opts]
 * @returns {{ ok: boolean, expiresAt?: number }}
 */
export function holdSeat(topic, seatId, sessionId, opts = {}) {
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : HOLD_TTL_MS;
  const { holds } = ensureTopic(topic);
  const existing = holds.get(seatId);

  // Om ingen hold finns: skapa ny
  if (!existing) {
    const expiresAt = Date.now() + ttl;
    holds.set(seatId, { sessionId, expiresAt, timer: null });
    scheduleExpiry(topic, seatId);
    broadcast(topic, 'seat:held', { seatId, sessionId, expiresAt });
    return { ok: true, expiresAt };
  }

  // Hold finns redan
  if (existing.sessionId !== sessionId) {
    // annan användare håller den
    if (opts.extend) {
      // du får inte förlänga någon annans hold
      return { ok: false };
    }
    // ny hold från annan -> nekas
    return { ok: false };
  }

  // Samma session: förläng alltid (vid hold eller extend)
  existing.expiresAt = Date.now() + ttl;
  holds.set(seatId, existing);
  scheduleExpiry(topic, seatId);
  broadcast(topic, 'seat:held', { seatId, sessionId, expiresAt: existing.expiresAt });
  return { ok: true, expiresAt: existing.expiresAt };
}

/**
 * Släpp en hold (endast ägaren, om inte force används).
 * @param {number|string} topic
 * @param {number|string} seatId
 * @param {string} sessionId
 * @param {{force?: boolean}} [opts]
 */
export function releaseSeat(topic, seatId, sessionId, opts = {}) {
  const { holds } = ensureTopic(topic);
  const existing = holds.get(seatId);
  if (!existing) return;

  if (!opts.force && existing.sessionId !== sessionId) {
    // inte din hold
    return;
  }

  if (existing.timer) clearTimeout(existing.timer);
  holds.delete(seatId);
  broadcast(topic, 'seat:released', { seatId, reason: opts.force ? 'force' : 'manual' });
}

// helpers/sseRegistry.js  (lägg längst ned, före exporterna, eller tillsammans med övriga exports)

/**
 * Ta bort holds för en lista stolar utan att sända 'seat:released'.
 * Används när stolar nyss blivit permanent bokade och vi istället sänder 'seat:booked'.
 */
export function clearHolds(topic, seatIds = []) {
  const { holds } = ensureTopic(topic);
  for (const id of seatIds) {
    const existing = holds.get(id);
    if (existing?.timer) clearTimeout(existing.timer);
    holds.delete(id);
  }
}


/**
 * Returnerar aktuell snapshot för en screening/topic.
 * Används av sseRoute för initialt event.
 */
export function getSnapshot(topic) {
  const { holds } = ensureTopic(topic);
  return Array.from(holds.entries()).map(([seatId, v]) => ({
    seatId,
    sessionId: v.sessionId,
    expiresAt: v.expiresAt,
  }));
}

