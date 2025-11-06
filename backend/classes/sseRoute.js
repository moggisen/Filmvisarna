// classes/SseRoute.js
import express from 'express';
import { pool } from '../db/connection.js';
import { addClient } from '../helpers/sseRegistry.js';

export default class SseRoute {
  constructor(app /*, settings */) {
    const router = express.Router();

    router.get('/stream', async (req, res) => {
      const screeningId = Number(req.query.screeningId);
      if (!screeningId) return res.status(400).end('screeningId krävs');

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      // startposition (om klienten inte skickar Last-Event-ID)
      let lastId = Number(req.header('Last-Event-ID') || 0);
      if (!lastId) {
        const [r] = await pool.query('SELECT IFNULL(MAX(id),0) AS maxId FROM booking_events');
        lastId = r[0].maxId ?? 0;
      }

      // skicka init-snapshot: upptagna stolar för visningen
      const [occupied] = await pool.query(
        `SELECT s.id AS seat_id, s.row_index, s.seat_number
         FROM bookingsXseats bxs
         JOIN seats s ON s.id = bxs.seat_id
         WHERE bxs.screening_id = ?`,
        [screeningId]
      );
      res.write(`event: init\n`);
      res.write(`data: ${JSON.stringify({ screeningId, occupied })}\n\n`);

      const remove = addClient({ res, screeningId, lastId });

      // håll kopplingen vid liv
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => {
        clearInterval(ping);
        remove();
        res.end();
      });
    });

    app.use('/api/bookings', router); // => /api/bookings/stream
  }
}

