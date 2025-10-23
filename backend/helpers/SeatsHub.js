// backend/helpers/SeatsHub.js
export default class SeatsHub {
  constructor({ loadSeatsFromDB } = {}) {
    this.rooms = new Map(); // screeningId -> { clients:Set<res>, occupied:Set<number> }
    this.loadSeatsFromDB = loadSeatsFromDB || (async () => new Set());
  }

  async getRoom(id) {
    let room = this.rooms.get(id);
    if (!room) {
      const initial = await this.loadSeatsFromDB(id);
      room = { clients: new Set(), occupied: new Set(initial) };
      this.rooms.set(id, room);
    }
    return room;
  }

  send(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  async stream(req, res) {
    const id = req.params.id;
    const room = await this.getRoom(id);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // initial snapshot
    this.send(res, "snapshot", { type: "snapshot", seats: [...room.occupied] });

    room.clients.add(res);
    const hb = setInterval(() => {
      try { res.write(`event: ping\ndata: {}\n\n`); } catch {}
    }, 25000);

    req.on("close", () => {
      clearInterval(hb);
      room.clients.delete(res);
    });
  }

  async tryBook(screeningId, seats) {
    const room = await this.getRoom(screeningId);
    const taken = seats.filter((n) => room.occupied.has(n));
    if (taken.length) return { ok: false, taken };

    seats.forEach((n) => room.occupied.add(n));
    // broadcast till alla anslutna klienter
    for (const client of room.clients) {
      this.send(client, "booked", { type: "booked", seats });
    }
    return { ok: true };
  }

  async release(screeningId, seats) {
    const room = await this.getRoom(screeningId);
    seats.forEach((n) => room.occupied.delete(n));
    for (const client of room.clients) {
      this.send(client, "released", { type: "released", seats });
    }
  }
}
