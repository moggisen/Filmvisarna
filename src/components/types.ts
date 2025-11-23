export type TicketCounts = { vuxen: number; barn: number; pensionar: number };

export type Seat = { row: string; number: number };

export type BookingSummary = {
  movieId: number;
  movieTitle: string;
  tickets: TicketCounts;
  seats: Seat[];
  total: number;
  bookingId: string;
  showtime: string;
  isGuestBooking?: boolean;
  guestEmail?: string;
};

export type Movie = { id: number; title: string };

export type Screening = {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
};

export type Tickets = { adult: number; child: number; senior: number };

export type TicketType = {
  id: number;
  ticketType_name: string;
  ticketType_price: number;
};

export type SeatMeta = { ri: number; ci: number };

export type LayoutRow = {
  rowIndex: number;
  seats: { id: number; seatNumber: number; taken: boolean }[];
};

export type ScreeningLayoutResponse = {
  auditorium_id: number;
  auditorium_name: string;
  rows: LayoutRow[];
};
