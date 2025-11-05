import { useEffect, useMemo, useState } from "react";
import { Alert, Card, ListGroup, Button, Spinner } from "react-bootstrap";
import "../styles/ConfirmationAndProfile.scss";

function formatPrice(n: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
  }).format(n);
}
function formatDateTimeISO(isoLike: string) {
  const d = new Date(isoLike);
  const date = d.toLocaleDateString("sv-SE");
  const time = d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

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
  row_index: number; // 1 = rad A, 2 = rad B, etc
  seat_number: number; // stolnumret i den raden
};
type TicketTypeRow = {
  id: number;
  ticketType_price: number;
  ticketType_name: string;
};

interface ConfirmationPageProps {
  onDone: () => void;
}

export default function ConfirmationPage({ onDone }: ConfirmationPageProps) {
  // 1) Läs query params
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const bookingIdParam = params.get("booking_id");
  const confParam = params.get("conf") || undefined;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Data som visas
  const [ticketBreakdown, setTicketBreakdown] = useState<string>("");
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [screening, setScreening] = useState<ScreeningRow | null>(null);
  const [movie, setMovie] = useState<MovieRow | null>(null);
  const [seats, setSeats] = useState<SeatDetailedRow[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState<number | null>(null);

  useEffect(() => {
    let isDead = false;
    async function run() {
      try {
        setLoading(true);
        setErr(null);

        if (!bookingIdParam) {
          throw new Error("Saknar booking_id i URL:en.");
        }

        // 2) Hämta bokning
        const bRes = await fetch(`/api/bookings/${bookingIdParam}`);
        if (!bRes.ok)
          throw new Error(`Kunde inte hämta bokning (${bRes.status}).`);
        const bJson: BookingRow | null = await bRes.json();
        if (!bJson) throw new Error("Bokningen finns inte.");
        if (confParam && bJson.booking_confirmation !== confParam) {
          // inte blockerande / bra att veta
          console.warn("booking_confirmation i URL och DB matchar inte.");
        }
        if (isDead) return;
        setBooking(bJson);

        // 3) Hämta visningen
        const scRes = await fetch(`/api/screenings/${bJson.screening_id}`);
        if (!scRes.ok)
          throw new Error(`Kunde inte hämta visning (${scRes.status}).`);
        const scJson: ScreeningRow | null = await scRes.json();
        if (!scJson) throw new Error("Visningen finns inte.");
        if (isDead) return;
        setScreening(scJson);

        // 4) Hämta filmen
        const mvRes = await fetch(`/api/movies/${scJson.movie_id}`);
        if (!mvRes.ok)
          throw new Error(`Kunde inte hämta film (${mvRes.status}).`);
        const mvJson: MovieRow | null = await mvRes.json();
        if (!mvJson) throw new Error("Filmen finns inte.");
        if (isDead) return;
        setMovie(mvJson);

        // 5) Hämta platser (inkl rader/nummer) för denna bokning
        const bxRes = await fetch(`/api/bookings/${bJson.id}/seatsDetailed`);
        if (!bxRes.ok)
          throw new Error(`Kunde inte hämta stolar (${bxRes.status}).`);
        const bxJson: SeatDetailedRow[] = await bxRes.json();
        if (isDead) return;
        setSeats(bxJson);

        // 6) Hämta ticketTypes, räkna totalpris och breakdown per typ
        try {
          const ttRes = await fetch(`/api/ticketTypes`);
          if (ttRes.ok) {
            const ttJson: TicketTypeRow[] = await ttRes.json();

            // Maps för pris & namn
            const priceMap = new Map(
              ttJson.map((t) => [t.id, t.ticketType_price])
            );
            const nameMap = new Map(
              ttJson.map((t) => [t.id, t.ticketType_name])
            );

            // Summera totalpris
            const sum = bxJson.reduce(
              (acc, row) => acc + (priceMap.get(row.ticketType_id) ?? 0),
              0
            );
            if (!isDead) setTicketsTotal(sum);

            // Räkna antal per ticketType_id
            const counts = new Map<number, number>();
            for (const row of bxJson) {
              counts.set(
                row.ticketType_id,
                (counts.get(row.ticketType_id) ?? 0) + 1
              );
            }

            // Bygg i formatet “2 vuxen, 1 barn” (namn från DB; fallback till id)
            const parts: string[] = [];
            for (const [ttId, count] of counts) {
              const rawName = nameMap.get(ttId) ?? `Typ ${ttId}`;
              const niceName = rawName.trim().toLowerCase(); // “Vuxen” blir “vuxen”
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
      } catch (e: any) {
        if (!isDead) setErr(e?.message ?? "Ett fel inträffade.");
      } finally {
        if (!isDead) setLoading(false);
      }
    }
    run();
    return () => {
      isDead = true;
    };
  }, [bookingIdParam, confParam]);

  // UI
  if (loading) {
    return (
      <div
        className="mobile-shell confirm-page d-flex justify-content-center align-items-center"
        style={{ minHeight: 240 }}
      >
        <Spinner animation="border" role="status" />
        <span className="ms-2">Laddar bokningsbekräftelse…</span>
      </div>
    );
  }

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

  if (!booking || !screening || !movie) {
    return null; // borde ej hända pga felhantering ovan
  }

  // helper: gör om row_index (1,2,3...) till A,B,C...
  function rowIndexToLetter(rowIndex: number): string {
    // row_index = 1 -> 'A', 2 -> 'B', osv
    const baseCharCode = "A".charCodeAt(0);
    return String.fromCharCode(baseCharCode + (rowIndex - 1));
  }

  // Presentationsdata
  const bookingCode = booking.booking_confirmation;
  const showtimeLabel = formatDateTimeISO(screening.screening_time);

  // Bygg "A7, A8, B12 ..."
  const seatList = seats
    .slice() // kopia så vi kan sortera utan att mutera state
    .sort((a, b) => {
      // sortera först på row_index, sen på seat_number
      if (a.row_index !== b.row_index) {
        return a.row_index - b.row_index;
      }
      return a.seat_number - b.seat_number;
    })
    .map((s) => rowIndexToLetter(s.row_index) + s.seat_number)
    .join(", ");

  return (
    <div className="mobile-shell confirm-page">
      <Alert data-bs-theme="dark" variant="success" className="mb-3">
        <Alert.Heading className="h5">Bokning bekräftad!</Alert.Heading>
        <p className="text-center mb-0">
          Ditt boknings-ID är <strong>{bookingCode}</strong>.
        </p>
      </Alert>

      <Card className="bg-secondary mb-3">
        <Card.Header as="h6">Din bokning</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Film</span> <span>{movie.movie_title}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Föreställning</span> <span>{showtimeLabel}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Biljetter</span>{" "}
            <span>
              {ticketBreakdown ||
                `${seats.length} biljett${seats.length === 1 ? "" : "er"}`}
            </span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Platser</span> <span>{seatList || "–"}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Pris</span>{" "}
            <strong>
              {ticketsTotal != null ? formatPrice(ticketsTotal) : "–"}
            </strong>
          </ListGroup.Item>
        </ListGroup>
      </Card>

      <div className="text-center">
        <Button
          variant="primary"
          size="sm"
          className="border-dark text-info py-2 px-3"
          onClick={onDone}
        >
          Till startsidan
        </Button>
      </div>
    </div>
  );
}
