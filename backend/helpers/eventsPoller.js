// helpers/eventsPoller.js
import { pool } from '../db/connection.js';
import { broadcastEvent, hasClients, minLastId } from './sseRegistry.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startEventsPoller(intervalMs = 400) {
  let lastId = 0;

  // Evig lågintensiv loop (räcker gott för bio)
  while (true) {
    try {
      if (hasClients()) {
        const since = Math.max(lastId, minLastId());
        const [rows] = await pool.query(
          `SELECT id, op, screening_id, seat_id, ticketType_id, booking_id, payload, created_at
           FROM booking_events
           WHERE id > ?
           ORDER BY id ASC
           LIMIT 1000`,
          [since]
        );

        if (rows.length) {
          for (const ev of rows) {
            broadcastEvent(ev);
            if (ev.id > lastId) lastId = ev.id;
          }
        }
      }
    } catch (err) {
      console.error('[SSE] poll error:', err);
      await sleep(1000);
    }
    await sleep(intervalMs);
  }
}
