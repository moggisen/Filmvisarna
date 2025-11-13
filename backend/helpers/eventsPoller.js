// helpers/eventsPoller.js (ESM)
let started = false;

export async function startEventsPoller(intervalMs = 0) {
  if (started) return; // 👈 förhindrar dubbelstart
  started = true;

  // MySQL: vi använder in-memory SSE via sseRegistry.js just nu.
  console.log('EventsPoller: MySQL – ingen LISTEN, SSE sker via in-memory registry.');

  // Om du senare vill polla en DB-kö, lägg din setInterval här.
  // Behåll guard: den ska bara skapas en gång.
}

