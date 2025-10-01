export type Route =
  | "home"
  | "biljett"
  | "login"
  | "signup"
  | "movie-detail"
  | "confirm"
  | "profile";

export interface NavigationProps {
  authed: boolean;
  onNavigate: (name: Route) => void;
  onLogout: () => void;
}

export type TicketCounts = { vuxen: number; barn: number; pensionar: number };

export type Seat = { row: string; number: number };

export type BookingSummary = {
  movieId: string;
  movieTitle: string;
  tickets: TicketCounts;
  seats: Seat[];
  total: number;
  bookingId: string;
  showtime: string;
};
