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
};
