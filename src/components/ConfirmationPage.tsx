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
import { usePDF } from "react-to-pdf";
import "../styles/ConfirmationAndProfile.scss";

// --- Hjälpfunktioner ---

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

// helper: gör om row_index (1,2,3...) till A,B,C...
function rowIndexToLetter(rowIndex: number): string {
  const baseCharCode = "A".charCodeAt(0);
  return String.fromCharCode(baseCharCode + (rowIndex - 1));
}

function getAuditoriumName(id: number | undefined): string {
  if (id === 2) return "Lilla Salongen";
  if (id === 1) return "Stora Salongen";
  return id ? `Salong ${id}` : "N/A";
}

// --- Data-typer (Oförändrade) ---

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
  onDone: () => void;
}

// --- Huvudkomponent ---

export default function ConfirmationPage({ onDone }: ConfirmationPageProps) {
  // PDF Hook: Initialiserar toPDF funktionen och targetRef
  const { toPDF, targetRef } = usePDF({
    filename: "biljett_filmvisarna.pdf",
  });

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

  // Hämtar all bokningsdata (Logik från den första versionen)
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

            // Bygg i formatet "2 vuxen, 1 barn"
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

  // ⭐ FIX: Lägg till en wrapper-funktion för toPDF
  const handleDownloadPDF = () => {
    toPDF();
  };

  // --- UI Rendrering ---
  if (loading) {
    return (
      <div className="mobile-shell confirm-page d-flex justify-content-center align-items-center">
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
    return null;
  }

  // Presentationsdata
  const bookingCode = (
    booking.booking_confirmation?.slice(0, 6) || "------"
  ).toUpperCase();
  const showtimeLabel = formatDateTimeISO(screening.screening_time);

  // Bygg "A7, A8, B12 ..."
  const seatList = seats
    .slice()
    .sort((a, b) => {
      if (a.row_index !== b.row_index) {
        return a.row_index - b.row_index;
      }
      return a.seat_number - b.seat_number;
    })
    .map((s) => rowIndexToLetter(s.row_index) + s.seat_number)
    .join(", ");

  return (
    <div className="mobile-shell confirm-page">
      {/* 1. BLÅ Toppremsa (Använder Bootstrap Primary) */}
      <div className="top-alert bg-primary text-white">Bokning bekräftad!</div>

      {/* 2. Biljettens Huvuddel (Card) - Använder targetRef för PDF-generering */}
      <Card className="mb-0" ref={targetRef}>
        {/* Filmdetaljer (Enkel kolumn) */}
        <Card.Header as="h6">
          <Row>
            <Col xs={12}>
              {/* Film titel: STOR och CENTRERAD */}
              <h5
                className="mb-4 text-uppercase text-center border-bottom"
                style={{ fontSize: "1.8rem", fontWeight: "bold" }}
              >
                {movie.movie_title}
              </h5>

              {/* Detaljer: Mindre typsnitt - Med ljusgrå linjer */}
              <ListGroup variant="flush" style={{ fontSize: "0.9rem" }}>
                {/* DATUM - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Datum</span>{" "}
                  <span>{showtimeLabel.split(" ")[0]}</span>
                </ListGroup.Item>

                {/* TID - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Tid</span>{" "}
                  <span>{showtimeLabel.split(" ")[1]}</span>
                </ListGroup.Item>

                {/* SALONG (med namnmappning) - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Salong</span>{" "}
                  <span>{getAuditoriumName(screening.auditorium_id)}</span>
                </ListGroup.Item>

                {/* PLATSER (vilka stolar) - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Platser</span>{" "}
                  <span>{seatList || "–"}</span>
                </ListGroup.Item>

                {/* BILJETTER (antal + typ) - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-light border-bottom">
                  <span className="fw-bold text-uppercase">Biljetter</span>{" "}
                  <span>{ticketBreakdown || `${seats.length} st`}</span>
                </ListGroup.Item>

                {/* PRIS (utan border-bottom) - py-1 */}
                <ListGroup.Item className="d-flex justify-content-between px-0 py-1 border-0">
                  <span className="fw-bold text-uppercase">
                    Pris att betala
                  </span>{" "}
                  <strong>
                    {ticketsTotal != null ? formatPrice(ticketsTotal) : "–"}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
            </Col>
          </Row>
        </Card.Header>

        {/* 4. Bokningsnummer & Knappar - MINSKAR PADDING PÅ SEKTIONEN TILL p-3 */}
        <div className="text-center p-3">
          {/* Bokningsnummer-etikett - mb-0 */}
          <p className="mb-0 text-uppercase">Boknings-ID:</p>

          {/* Bokningsnummer-ruta - mb-1 */}
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

          {/* Ny text: Visa upp i kassan - MINSKAD MARGINAL TILL mb-1 */}
          <p className="small text-muted mb-1">
            Visa upp ditt boknings-ID i kassan.
          </p>

          {/* Knappgrupp - APPLICERA hide-on-print för PDF:en */}
          <div className="d-grid gap-2 mt-2 ">
            {/* Ladda ner PDF (Använder handleDownloadPDF wrapper) */}
            <Button
              variant="secondary"
              size="lg"
              className="py-2 px-3"
              onClick={handleDownloadPDF} // ⭐ ÄNDRA: Använd wrapper-funktionen
            >
              Ladda ner som PDF
            </Button>

            {/* Tillbaka till startsidan */}
            <Button
              variant="primary"
              size="lg"
              className="py-2 px-3"
              onClick={onDone}
            >
              Tillbaka till startsidan
            </Button>
          </div>

          {/* Kontakttexten du lade till - Ligger under knapparna */}
          <p className="small text-muted mt-2 mb-0">
            Avbokning för medlemmar sker via Mina Sidor. För ickemedlemmar
            kontakta oss på 000-12345 eller mejla filmvisarna38@gmail.com
          </p>
        </div>
      </Card>
    </div>
  );
}
