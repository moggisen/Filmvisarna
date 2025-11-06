// helpers/sseRegistry.js
// Håller koll på öppna SSE-klienter och sänder event till rätt screening.

const clients = new Set(); // element: { res, screeningId, lastId }

export function addClient(client) {
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcastEvent(ev) {
  // ev: { id, op, screening_id, seat_id, ticketType_id, booking_id, payload, created_at }
  const payload = JSON.stringify({
    id: ev.id,
    op: ev.op,
    screeningId: ev.screening_id,
    seatId: ev.seat_id,
    ticketTypeId: ev.ticketType_id,
    bookingId: ev.booking_id,
    payload: ev.payload,
    at: ev.created_at,
  });

  for (const c of clients) {
    if (c.screeningId !== ev.screening_id) continue;
    c.res.write(`id: ${ev.id}\n`);
    c.res.write(`event: booking_changed\n`);
    c.res.write(`data: ${payload}\n\n`);
    if (ev.id > c.lastId) c.lastId = ev.id;
  }
}

export function hasClients() {
  return clients.size > 0;
}

export function minLastId() {
  if (!clients.size) return 0;
  return Math.min(...Array.from(clients, (c) => c.lastId));
}
