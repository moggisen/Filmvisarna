// Ticket counts for Swedish categories used in UI and receipts.
// Keys match displayed labels to avoid mapping during rendering.
export type TicketCounts = { vuxen: number; barn: number; pensionar: number };

// A single seat presented to the user (row letter + seat number).
export type Seat = { row: string; number: number };

// Summary object passed to confirmation/receipt views.
// Contains all user-facing booking details in one place.
export type BookingSummary = {
  movieId: number; // Internal movie id
  movieTitle: string; // Title shown on receipt
  tickets: TicketCounts; // Final ticket breakdown
  seats: Seat[]; // User-friendly seats (e.g., A10)
  total: number; // Total price in SEK (number, not formatted)
  bookingId: string; // Backend id or generated fallback
  showtime: string; // ISO timestamp for the screening
  isGuestBooking?: boolean; // True if booked without account
  guestEmail?: string; // Email used for guest confirmation
};

// Minimal movie info for dropdowns and display.
export type Movie = { id: number; title: string };

// A single screening (one showing of a movie).
export type Screening = {
  id: number;
  screening_time: string; // ISO date/time from backend
  movie_id: number;
  auditorium_id: number;
};

// Internal ticket counters used during selection.
// Mapped to TicketType via name matching ("vuxen", "barn", "pension").
export type Tickets = { adult: number; child: number; senior: number };

// Raw ticket type from backend (name + price).
export type TicketType = {
  id: number;
  ticketType_name: string; // e.g., "Vuxen"
  ticketType_price: number; // Price in SEK
};

// Seat metadata used for layout calculations.
// ri = row index (0-based), ci = column index (1-based for labels).
export type SeatMeta = { ri: number; ci: number };

// One logical layout row with seat cells and availability flags.
export type LayoutRow = {
  rowIndex: number; // 0-based row index (A = 0, B = 1, ...)
  seats: { id: number; seatNumber: number; taken: boolean }[];
};

// Seating layout payload for a screening.
// Used to render both desktop grid and mobile picker.
export type ScreeningLayoutResponse = {
  auditorium_id: number;
  auditorium_name: string;
  rows: LayoutRow[];
};
