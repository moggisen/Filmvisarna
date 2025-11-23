import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Card,
  ListGroup,
  Button,
  Spinner,
  Row,
  Col,
} from "react-bootstrap";
import { usePDF } from "react-to-pdf"; // PDF generation hook
import "../styles/ConfirmationAndProfile.scss";

// Helper functions

// Helper function to format price into Swedish Krona (SEK)
function formatPrice(n: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
  }).format(n);
}

// Helper function to format ISO date string to readable date and time (Swedish locale)
function formatDateTimeISO(isoLike: string) {
  const d = new Date(isoLike);
  const date = d.toLocaleDateString("sv-SE");
  const time = d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

// Helper: converts row_index (1, 2, 3...) to a letter (A, B, C...)
function rowIndexToLetter(rowIndex: number): string {
  const baseCharCode = "A".charCodeAt(0);
  return String.fromCharCode(baseCharCode + (rowIndex - 1));
}

// Helper to get a human-readable auditorium name from its ID
function getAuditoriumName(id: number | undefined): string {
  if (id === 2) return "Lilla Salongen";
  if (id === 1) return "Stora Salongen";
  return id ? `Salong ${id}` : "N/A";
}

// Data types

type BookingRow = {
  id: number;
  booking_time: string;
  booking_confirmation: string;
  screening_id: number;
  user_id: number;
};
type ScreeningRow = {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
};
type MovieRow = {
  id: number;
  movie_title: string;
};
type SeatDetailedRow = {
  seat_id: number;
  ticketType_id: number;
  row_index: number;
  seat_number: number;
};
type TicketTypeRow = {
  id: number;
  ticketType_price: number;
  ticketType_name: string;
};

interface ConfirmationPageProps {
  onDone: () => void; // Function to call when user is done (e.g., navigate home)
}

interface PdfOptions {
  filename: string;
  scale?: number;
}
// Main Component

export default function ConfirmationPage({ onDone }: ConfirmationPageProps) {
  // PDF Hook: Initialiserar toPDF funktionen och targetRef
  const { toPDF, targetRef } = usePDF({
    filename: "biljett_filmvisarna.pdf",
    scale: 1.2,
  } as PdfOptions);

  // Read query parameters from URL
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const bookingIdParam = params.get("booking_id");
  const confParam = params.get("conf") || undefined;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Data to be displayed
  const [ticketBreakdown, setTicketBreakdown] = useState<string>("");
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [screening, setScreening] = useState<ScreeningRow | null>(null);
  const [movie, setMovie] = useState<MovieRow | null>(null);
  const [seats, setSeats] = useState<SeatDetailedRow[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState<number | null>(null);

  // Effect to fetch all booking data
  useEffect(() => {
    let isDead = false; // Flag to prevent state update after component unmount
    async function run() {
      try {
        setLoading(true);
        setErr(null);

        if (!bookingIdParam) {
          throw new Error("Saknar booking_id i URL:en.");
        }

        // Fetch booking details
        const bRes = await fetch(`/api/bookings/${bookingIdParam}`);
        if (!bRes.ok)
          throw new Error(`Kunde inte hämta bokning (${bRes.status}).`);
        const bJson: BookingRow | null = await bRes.json();
        if (!bJson) throw new Error("Bokningen finns inte.");
        // Basic security check (though typically done on backend)
        if (confParam && bJson.booking_confirmation !== confParam) {
          console.warn("booking_confirmation i URL och DB matchar inte.");
        }
        if (isDead) return;
        setBooking(bJson);

        // Fetch screening details using ID from booking
        const scRes = await fetch(`/api/screenings/${bJson.screening_id}`);
        if (!scRes.ok)
          throw new Error(`Kunde inte hämta visning (${scRes.status}).`);
        const scJson: ScreeningRow | null = await scRes.json();
        if (!scJson) throw new Error("Visningen finns inte.");
        if (isDead) return;
        setScreening(scJson);

        // Fetch movie details using ID from screening
        const mvRes = await fetch(`/api/movies/${scJson.movie_id}`);
        if (!mvRes.ok)
          throw new Error(`Kunde inte hämta film (${mvRes.status}).`);
        const mvJson: MovieRow | null = await mvRes.json();
        if (!mvJson) throw new Error("Filmen finns inte.");
        if (isDead) return;
        setMovie(mvJson);

        // Fetch detailed seat information for this booking
        const bxRes = await fetch(`/api/bookings/${bJson.id}/seatsDetailed`);
        if (!bxRes.ok)
          throw new Error(`Kunde inte hämta stolar (${bxRes.status}).`);
        const bxJson: SeatDetailedRow[] = await bxRes.json();
        if (isDead) return;
        setSeats(bxJson);

        // Fetch ticket types, calculate total price and create breakdown string
        try {
          const ttRes = await fetch(`/api/ticketTypes`);
          if (ttRes.ok) {
            const ttJson: TicketTypeRow[] = await ttRes.json();

            // Maps for price and name lookup
            const priceMap = new Map(
              ttJson.map((t) => [t.id, t.ticketType_price])
            );
            const nameMap = new Map(
              ttJson.map((t) => [t.id, t.ticketType_name])
            );

            // Calculate total price
            const sum = bxJson.reduce(
              (acc, row) => acc + (priceMap.get(row.ticketType_id) ?? 0),
              0
            );
            if (!isDead) setTicketsTotal(sum);

            // Count number of seats per ticketType_id
            const counts = new Map<number, number>();
            for (const row of bxJson) {
              counts.set(
                row.ticketType_id,
                (counts.get(row.ticketType_id) ?? 0) + 1
              );
            }

            // Build string format like “2 adult, 1 child”
            const parts: string[] = [];
            for (const [ttId, count] of counts) {
              const rawName = nameMap.get(ttId) ?? `Typ ${ttId}`;
              const niceName = rawName.trim().toLowerCase();
              parts.push(`${count} ${niceName}`);
            }
            const breakdown = parts.sort().join(", ");
            if (!isDead) setTicketBreakdown(breakdown);
          } else {
            console.warn(
              "Kunde inte hämta ticketTypes för totalsumma/breakdown."
            );
          }
        } catch (e) {
          console.warn("Fel vid hämtning av ticketTypes:", e);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Ett fel inträffade.";

        if (!isDead) setErr(message);
      } finally {
        if (!isDead) setLoading(false);
      }
    }
    run();
    // Cleanup function to set the dead flag
    return () => {
      isDead = true;
    };
  }, [bookingIdParam, confParam]);

  // Ui Rendering

  // Show spinner while loading
  if (loading) {
    return (
      <div className="mobile-shell confirm-page d-flex justify-content-center align-items-center">
        <Spinner animation="border" role="status" />
        <span className="ms-2">Laddar bokningsbekräftelse…</span>
      </div>
    );
  }

  // Show error message if fetch failed
  if (err) {
    return (
      <div className="mobile-shell confirm-page">
        <Alert data-bs-theme="dark" variant="danger" className="mb-3">
          <Alert.Heading className="h6">
            Kunde inte hämta bokningen
          </Alert.Heading>
          <p className="mb-0">{err}</p>
        </Alert>
        <div className="text-center">
          <Button variant="secondary" size="sm" onClick={onDone}>
            Till startsidan
          </Button>
        </div>
      </div>
    );
  }

  // Should not happen, but for type safety:
  if (!booking || !screening || !movie) {
    return null;
  }

  // Presentation data formatting
  const bookingCode = (
    booking.booking_confirmation?.slice(0, 6) || "------"
  ).toUpperCase();
  const showtimeLabel = formatDateTimeISO(screening.screening_time);

  // Build the list of seats, e.g., "A7, A8, B12 ..."
  const seatList = seats
    .slice()
    .sort((a, b) => {
      // Sort by row index first, then by seat number
      if (a.row_index !== b.row_index) {
        return a.row_index - b.row_index;
      }
      return a.seat_number - b.seat_number;
    })
    .map((s) => rowIndexToLetter(s.row_index) + s.seat_number)
    .join(", ");

  return (
    <div className="mobile-shell confirm-page">
      <div className="top-alert bg-primary text-white">Bokning bekräftad!</div>
      <Card className="mb-0" ref={targetRef}>
        <Card.Header as="h6">
          <Row>
            <Col xs={12}>
              <h5
                className="mb-4 text-uppercase text-center border-bottom"
                style={{ fontSize: "1.8rem", fontWeight: "bold" }}
              >
                {movie.movie_title}
              </h5>
              <ListGroup variant="flush" style={{ fontSize: "0.9rem" }}>
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Datum</span>{" "}
                  <span>{showtimeLabel.split(" ")[0]}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Tid</span>{" "}
                  <span>{showtimeLabel.split(" ")[1]}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Salong</span>{" "}
                  <span>{getAuditoriumName(screening.auditorium_id)}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Platser</span>{" "}
                  <span>{seatList || "–"}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Biljetter</span>{" "}
                  <span>{ticketBreakdown || `${seats.length} st`}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-0">
                  <span className="fw-bold text-uppercase">Totala priset</span>{" "}
                  <strong>
                    {ticketsTotal != null ? formatPrice(ticketsTotal) : "–"}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
            </Col>
          </Row>
        </Card.Header>

        <div className="text-center p-3">
          <p className="mb-0 text-uppercase text-primary-dark">Boknings-ID:</p>

          <div
            className="d-inline-block p-2 px-4 mb-1"
            style={{ backgroundColor: "#eeeeee", borderRadius: "5px" }}
          >
            <strong
              className="text-danger"
              style={{ fontSize: "1.5rem", letterSpacing: "2px" }}
            >
              {bookingCode}
            </strong>
          </div>

          <p className="small mb-1">Visa upp ditt boknings-ID i kassan.</p>

          <div className="d-grid gap-2 mt-2 ">
            <Button
              variant="secondary"
              size="lg"
              className="py-2 px-3"
              onClick={() => {
                toPDF();
              }}
            >
              Ladda ner som PDF
            </Button>

            <Button
              variant="primary"
              size="lg"
              className="py-2 px-3"
              onClick={onDone}
            >
              Tillbaka till startsidan
            </Button>
          </div>

          <p className="small mt-2 mb-0">
            Avbokning för medlemmar sker via Mina Sidor. För ickemedlemmar
            kontakta oss på 000-12345 eller mejla filmvisarna38@gmail.com
          </p>
        </div>
      </Card>
    </div>
  );
}
