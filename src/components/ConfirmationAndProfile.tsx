import { useMemo, useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Navbar,
  Nav,
  Button,
  Card,
  Form,
  Badge,
  Alert,
  InputGroup,
  Ratio,
  ListGroup,
  Modal,
} from "react-bootstrap";

/* ------------------------------------------------------------
   Biograf-prototyp (mobil) – React + TS + React-Bootstrap
   ------------------------------------------------------------ */

type Route =
  | { name: "home" }
  | { name: "movie"; id: string }
  | { name: "book"; id: string }
  | { name: "confirm"; summary: BookingSummary }
  | { name: "profile" }
  | { name: "login" }
  | { name: "signup" };

// ---------- Mockdata ----------
export type Movie = {
  id: string;
  title: string;
  year: number;
  language: string;
  director: string;
  cast: string[];
  posterUrl: string;
  trailerYouTubeId: string;
  genres: string[];
  runtimeMin: number;
};

const MOVIES: Movie[] = [
  {
    id: "ironman",
    title: "Iron Man",
    year: 2008,
    language: "Engelska",
    director: "Jon Favreau",
    cast: ["Robert Downey Jr.", "Gwyneth Paltrow", "Jeff Bridges"],
    posterUrl: "https://placehold.co/600x900?text=Iron+Man",
    trailerYouTubeId: "8ugaeA-nMTc",
    genres: ["Action", "Sci-Fi"],
    runtimeMin: 126,
  },
  {
    id: "avengers",
    title: "The Avengers",
    year: 2012,
    language: "Engelska",
    director: "Joss Whedon",
    cast: ["Scarlett Johansson", "Chris Evans", "Chris Hemsworth"],
    posterUrl: "https://placehold.co/600x900?text=The+Avengers",
    trailerYouTubeId: "eOrNdBpGMv8",
    genres: ["Action", "Äventyr"],
    runtimeMin: 143,
  },
  {
    id: "blackpanther",
    title: "Black Panther",
    year: 2018,
    language: "Engelska",
    director: "Ryan Coogler",
    cast: ["Chadwick Boseman", "Michael B. Jordan", "Lupita Nyong'o"],
    posterUrl: "https://placehold.co/600x900?text=Black+Panther",
    trailerYouTubeId: "xjDjIWPwcPU",
    genres: ["Action", "Sci-Fi"],
    runtimeMin: 134,
  },
];

// ---------- Priser ----------
const PRICES = { vuxen: 140, barn: 90, pensionar: 110 } as const;

// ---------- Typer för bokning ----------
export type TicketCounts = { vuxen: number; barn: number; pensionar: number };
export type Seat = { row: string; number: number };
export type BookingSummary = {
  movieId: string;
  movieTitle: string;
  tickets: TicketCounts;
  seats: Seat[];
  total: number;
  bookingId: string;
  showtime: string; // ISO
};

// Hjälp: generera säteskarta
const rows = ["A", "B", "C", "D", "E", "F", "G"];
const cols = 10;

const PREBOOKED = new Set(["A1", "A2", "C5", "E8"]);

function seatKey(s: Seat) {
  return `${s.row}${s.number}`;
}
function formatPrice(n: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
  }).format(n);
}
function calcTotal(t: TicketCounts) {
  return (
    t.vuxen * PRICES.vuxen +
    t.barn * PRICES.barn +
    t.pensionar * PRICES.pensionar
  );
}
// #UNDER##########################################################################################################################
// Lägg detta en gång i App.tsx (t.ex. ovanför komponenterna)
function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE"); // t.ex. 2025-09-25
  const time = d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  }); // 14:05
  return `${date} ${time}`;
}
// #ÖVER##########################################################################################################################

// #UNDER#########################################################################################################################
// ---------- LocalStorage “DB” ----------
function loadBookings(): BookingSummary[] {
  try {
    const raw = localStorage.getItem("bookings");
    if (raw) return JSON.parse(raw);
  } catch {}
  // Seed:a en mockad tidigare visning (igår) så listan inte är tom
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(20, 0, 0, 0);
  const m = MOVIES[0];
  const seed: BookingSummary = {
    movieId: m.id,
    movieTitle: m.title,
    tickets: { vuxen: 2, barn: 0, pensionar: 0 },
    seats: [
      { row: "C", number: 7 },
      { row: "C", number: 8 },
    ],
    total: 2 * PRICES.vuxen,
    bookingId: "SEED-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
    showtime: yesterday.toISOString(),
  };
  saveBookings([seed]);
  return [seed];
}
function saveBookings(b: BookingSummary[]) {
  try {
    localStorage.setItem("bookings", JSON.stringify(b));
  } catch {}
}

function defaultShowtimes(movie: Movie): string[] {
  // Tre framtida tider + en igår (för att kunna testa "Tidigare visningar")
  const base = new Date();
  const mk = (d: Date) => new Date(d).toISOString();

  const t1 = new Date(base);
  t1.setHours(15, 0, 0);
  const t2 = new Date(base);
  t2.setHours(18, 30, 0);
  const t3 = new Date(base);
  t3.setHours(23, 55, 0);
  const y = new Date(base);
  y.setDate(base.getDate() - 1);
  y.setHours(20, 0, 0);

  return [mk(t1), mk(t2), mk(t3), mk(y)];
}
// #ÖVER##################################################################################################################################

// ---------- Rotkomponent ----------
export default function CinemaApp() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<BookingSummary[]>(() =>
    loadBookings()
  );

  useEffect(() => saveBookings(bookings), [bookings]);

  const goHome = () => setRoute({ name: "home" });

  function addBooking(b: BookingSummary) {
    setBookings((prev) => [b, ...prev]);
  }
  function cancelBooking(bookingId: string) {
    setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  }

  return (
    <div className={`app-root min-vh-100 text-info pb-5 ${route.name}-page`}>
      {/* <div className="bg-primary min-vh-100 min-vw-100 text-info pb-5"> */}
      <HeaderBar onHome={goHome} />

      <Container className="pt-3 pb-5">
        {route.name === "home" && (
          <HomePage
            movies={MOVIES}
            onOpenMovie={(id) => setRoute({ name: "movie", id })}
          />
        )}

        {route.name === "movie" && (
          <MovieDetail
            movie={MOVIES.find((m) => m.id === route.id)!}
            onBack={goHome}
            onBook={() => setRoute({ name: "book", id: route.id })}
          />
        )}

        {route.name === "book" && (
          <BookingPage
            movie={MOVIES.find((m) => m.id === route.id)!}
            onCancel={() => setRoute({ name: "movie", id: route.id })}
            onConfirm={(summary) => {
              addBooking(summary);
              setRoute({ name: "confirm", summary });
            }}
          />
        )}

        {route.name === "confirm" && (
          <ConfirmationPage summary={route.summary} onDone={goHome} />
        )}

        {route.name === "profile" && (
          <ProfilePage
            bookings={bookings}
            onBack={goHome}
            onCancel={cancelBooking}
          />
        )}

        {route.name === "login" && (
          <AuthPage
            mode="login"
            onSuccess={() => {
              setAuthed(true);
              goHome();
            }}
            onBack={goHome}
          />
        )}

        {route.name === "signup" && (
          <AuthPage
            mode="signup"
            onSuccess={() => {
              setAuthed(true);
              goHome();
            }}
            onBack={goHome}
          />
        )}
      </Container>

      <BottomNav
        authed={authed}
        onNavigate={(name) => {
          if (name === "home") setRoute({ name: "home" });
          if (name === "login") setRoute({ name: "login" });
          if (name === "signup") setRoute({ name: "signup" });
          if (name === "profile") setRoute({ name: "profile" });
        }}
        onLogout={() => setAuthed(false)}
      />
    </div>
  );
}

// #UNDER###############################################################################################################################
// ---------- Header ----------
function HeaderBar({ onHome }: { onHome: () => void }) {
  return (
    <Navbar
      bg="primary"
      variant="primary"
      className="border-bottom border-secondary"
      sticky="top"
    >
      <Container>
        <Navbar.Brand
          role="button"
          onClick={onHome}
          aria-label="Gå till startsidan"
        >
          <span className="text-dark fw-bold fs-1">FILM</span>
          <span className="text-light fs-1">VISARNA</span>
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
}
// #ÖVER##################################################################################################################################

// #UNDER#################################################################################################################################
// ---------- Bottom nav (mobil) ----------
function BottomNav({
  authed,
  onNavigate,
  onLogout,
}: {
  authed: boolean;
  onNavigate: (name: "home" | "login" | "signup" | "profile") => void;
  onLogout: () => void;
}) {
  return (
    <Navbar
      bg="primary"
      variant="primary"
      fixed="bottom"
      className="border-top border-bottom border-secondary py-1 px-1"
    >
      <Nav className="w-100 d-flex gap-1">
        <Nav.Item className="d-flex" style={{ flex: "1 0 0" }}>
          <Button
            variant="primary"
            className="w-100 text-truncate border-secondary mobile-nav-button"
            size="sm"
            onClick={() => onNavigate("home")}
            aria-label="Startsida"
          >
            Hem
          </Button>
        </Nav.Item>

        {authed ? (
          <>
            <Nav.Item className="d-flex" style={{ flex: "1 0 0" }}>
              <Button
                variant="primary"
                className="w-100 text-truncate border-secondary mobile-nav-button"
                size="sm"
                onClick={() => onNavigate("profile")}
                aria-label="Profil"
              >
                Mina sidor
              </Button>
            </Nav.Item>
            <Nav.Item className="d-flex" style={{ flex: "1 0 0" }}>
              <Button
                variant="primary"
                className="w-100 text-truncate border-secondary mobile-nav-button"
                size="sm"
                onClick={onLogout}
                aria-label="Logga ut"
              >
                Logga ut
              </Button>
            </Nav.Item>
          </>
        ) : (
          <>
            <Nav.Item className="d-flex" style={{ flex: "1 0 0" }}>
              <Button
                variant="primary"
                className="w-100 text-truncate border-secondary mobile-nav-button"
                size="sm"
                onClick={() => onNavigate("login")}
                aria-label="Logga in"
              >
                Logga in
              </Button>
            </Nav.Item>
            <Nav.Item className="d-flex" style={{ flex: "1 0 0" }}>
              <Button
                variant="primary"
                className="w-100 text-truncate border-secondary mobile-nav-button"
                size="sm"
                onClick={() => onNavigate("signup")}
                aria-label="Skapa konto"
              >
                Bli medlem
              </Button>
            </Nav.Item>
          </>
        )}
      </Nav>
    </Navbar>
  );
}
// #ÖVER###################################################################################################################################

// ---------- Startsida ----------
function HomePage({
  movies,
  onOpenMovie,
}: {
  movies: Movie[];
  onOpenMovie: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("Alla");

  const genres = useMemo(
    () => ["Alla", ...new Set(movies.flatMap((m) => m.genres))],
    [movies]
  );
  const filtered = movies.filter((m) => {
    const matchesText = [m.title, m.director, m.cast.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesGenre = genre === "Alla" || m.genres.includes(genre);
    return matchesText && matchesGenre;
  });

  return (
    <>
      <h1 className="h4 mt-2 mb-3">Visas nu</h1>
      <InputGroup className="mb-3">
        <InputGroup.Text id="sok">Sök</InputGroup.Text>
        <Form.Control
          aria-label="Sök film"
          aria-describedby="sok"
          placeholder="Sök på titel, regissör, skådis…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </InputGroup>
      <Form.Select
        aria-label="Filtrera på genre"
        className="mb-3"
        value={genre}
        onChange={(e) => setGenre(e.target.value)}
      >
        {genres.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </Form.Select>

      <Row className="g-3">
        {filtered.map((m) => (
          <Col xs={12} key={m.id}>
            <Card
              className="bg-dark border-secondary shadow-sm"
              role="button"
              onClick={() => onOpenMovie(m.id)}
            >
              <Row className="g-0 align-items-center">
                <Col xs={4}>
                  <div className="ratio ratio-2x3">
                    <img
                      src={m.posterUrl}
                      alt={`Poster för ${m.title}`}
                      className="img-fluid rounded-start"
                    />
                  </div>
                </Col>
                <Col xs={8}>
                  <Card.Body>
                    <Card.Title className="mb-1 h6">
                      {m.title}{" "}
                      <small className="text-secondary">({m.year})</small>
                    </Card.Title>
                    <Card.Text className="mb-1 small text-secondary">
                      {m.genres.join(" · ")}
                    </Card.Text>
                    <Badge bg="danger" className="me-2">
                      MARVEL
                    </Badge>
                    <Badge bg="primary">IMAX</Badge>
                  </Card.Body>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
        {filtered.length === 0 && (
          <p className="text-secondary">Inga träffar.</p>
        )}
      </Row>
    </>
  );
}

// ---------- Filmsida ----------
function MovieDetail({
  movie,
  onBack,
  onBook,
}: {
  movie: Movie;
  onBack: () => void;
  onBook: () => void;
}) {
  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        className="mb-3"
        onClick={onBack}
        aria-label="Tillbaka"
      >
        ← Tillbaka
      </Button>

      <Card className="bg-dark border-secondary mb-3">
        <Row className="g-0">
          <Col xs={5}>
            <div className="ratio ratio-2x3">
              <img src={movie.posterUrl} alt={`Poster för ${movie.title}`} />
            </div>
          </Col>
          <Col xs={7}>
            <Card.Body>
              <Card.Title className="h5 mb-2">{movie.title}</Card.Title>
              <Card.Text className="small text-secondary mb-1">
                {movie.year} • {movie.runtimeMin} min • {movie.language}
              </Card.Text>
              <Card.Text className="small text-secondary mb-2">
                Regi: {movie.director}
              </Card.Text>
              <Card.Text className="small text-secondary">
                Med: {movie.cast.join(", ")}
              </Card.Text>
              <div className="mt-3 d-flex gap-2">
                <Badge bg="danger">MARVEL</Badge>
                <Badge bg="primary">IMAX</Badge>
              </div>
            </Card.Body>
          </Col>
        </Row>
      </Card>

      <Ratio aspectRatio="16x9" className="mb-3">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${movie.trailerYouTubeId}`}
          title={`Trailer för ${movie.title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Ratio>

      <div className="d-grid">
        <Button
          size="lg"
          variant="danger"
          onClick={onBook}
          aria-label="Boka biljett"
        >
          🎟️ Boka biljett
        </Button>
      </div>
    </>
  );
}

// ---------- Bokning ----------
function BookingPage({
  movie,
  onCancel,
  onConfirm,
}: {
  movie: Movie;
  onCancel: () => void;
  onConfirm: (summary: BookingSummary) => void;
}) {
  const [tickets, setTickets] = useState<TicketCounts>({
    vuxen: 1,
    barn: 0,
    pensionar: 0,
  });
  const [selected, setSelected] = useState<Seat[]>([]);
  const [showtime, setShowtime] = useState<string>(defaultShowtimes(movie)[0]);

  const needed = tickets.vuxen + tickets.barn + tickets.pensionar;
  const total = calcTotal(tickets);

  const [liveMsg, setLiveMsg] = useState("Pris uppdateras");
  useEffect(
    () => setLiveMsg(`Totalt ${formatPrice(total)} för ${needed} biljett(er)`),
    [total, needed]
  );

  function toggleSeat(s: Seat) {
    const key = seatKey(s);
    if (PREBOOKED.has(key)) return;
    const exists = selected.find((x) => seatKey(x) === key);
    if (exists) setSelected((xs) => xs.filter((x) => seatKey(x) !== key));
    else if (selected.length < needed) setSelected((xs) => [...xs, s]);
  }

  function confirm() {
    if (selected.length !== needed || needed === 0) return;
    const bookingId = `M-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    onConfirm({
      movieId: movie.id,
      movieTitle: movie.title,
      tickets,
      seats: selected,
      total,
      bookingId,
      showtime,
    });
  }

  const times = defaultShowtimes(movie);

  return (
    <>
      <h2 className="h5 mb-2">{movie.title}</h2>
      <p className="text-secondary small mb-3">
        Välj föreställning, biljetter och platser.
      </p>

      <Card className="bg-dark border-secondary mb-3">
        <Card.Header as="h6">Föreställning</Card.Header>
        <Card.Body>
          <Form.Select
            aria-label="Välj föreställning"
            className="mb-2"
            value={showtime}
            onChange={(e) => setShowtime(e.target.value)}
          >
            {times.map((t) => (
              <option key={t} value={t}>
                {formatDateTime(t)}
              </option>
            ))}
          </Form.Select>
        </Card.Body>
      </Card>

      <Card className="bg-dark border-secondary mb-3">
        <Card.Header as="h6">Biljetter</Card.Header>
        <Card.Body>
          <TicketRow
            label="Vuxen"
            price={PRICES.vuxen}
            value={tickets.vuxen}
            onChange={(v) => setTickets({ ...tickets, vuxen: v })}
          />
          <TicketRow
            label="Barn"
            price={PRICES.barn}
            value={tickets.barn}
            onChange={(v) => setTickets({ ...tickets, barn: v })}
          />
          <TicketRow
            label="Pensionär"
            price={PRICES.pensionar}
            value={tickets.pensionar}
            onChange={(v) => setTickets({ ...tickets, pensionar: v })}
          />
          <div className="d-flex justify-content-between align-items-center mt-3">
            <strong>Totalt</strong>
            <strong aria-live="polite">{formatPrice(total)}</strong>
          </div>
        </Card.Body>
      </Card>

      <Card className="bg-dark border-secondary mb-3">
        <Card.Header as="h6">
          Välj platser ({selected.length}/{needed})
        </Card.Header>
        <Card.Body>
          <div className="screen mb-2 text-center text-secondary">
            ■■■ DUK ■■■
          </div>
          <div className="seat-grid" role="grid" aria-label="Salsplatser">
            {rows.map((r) => (
              <div key={r} className="seat-row" role="row">
                <span className="row-label" aria-hidden>
                  {r}
                </span>
                {Array.from({ length: cols }, (_, i) => i + 1).map((n) => {
                  const s = { row: r, number: n };
                  const key = seatKey(s);
                  const taken = PREBOOKED.has(key);
                  const active = selected.some((x) => seatKey(x) === key);
                  return (
                    <button
                      key={key}
                      role="gridcell"
                      aria-label={`Säte ${key}${
                        taken ? " (upptaget)" : active ? " (vald)" : ""
                      }`}
                      className={`seat ${
                        taken ? "seat-taken" : active ? "seat-active" : ""
                      }`}
                      disabled={taken || (selected.length >= needed && !active)}
                      onClick={() => toggleSeat(s)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <small className="text-secondary d-block mt-2">
            Grå = upptaget, Blå = ledigt, Röd = vald
          </small>
        </Card.Body>
      </Card>

      <div aria-live="polite" className="visually-hidden">
        {liveMsg}
      </div>

      <div className="d-grid gap-2">
        <Button
          variant="danger"
          size="lg"
          disabled={needed === 0 || selected.length !== needed}
          onClick={confirm}
        >
          Boka biljett
        </Button>
        <Button variant="outline-light" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </>
  );
}

function TicketRow({
  label,
  price,
  value,
  onChange,
}: {
  label: string;
  price: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Row className="align-items-center g-2 mb-2">
      <Col xs={5}>
        <div className="fw-semibold">{label}</div>
        <div className="text-secondary small">{formatPrice(price)}</div>
      </Col>
      <Col xs={7} className="text-end">
        <div className="btn-group" role="group" aria-label={`Antal ${label}`}>
          <Button
            variant="outline-light"
            onClick={() => onChange(Math.max(0, value - 1))}
            aria-label={`Minska antal ${label}`}
          >
            −
          </Button>
          <Button variant="secondary" disabled aria-label={`Antal ${label}`}>
            {value}
          </Button>
          <Button
            variant="outline-light"
            onClick={() => onChange(value + 1)}
            aria-label={`Öka antal ${label}`}
          >
            +
          </Button>
        </div>
      </Col>
    </Row>
  );
}
// #UNDER#################################################################################################################################
// ---------- Bekräftelse ----------
function ConfirmationPage({
  summary,
  onDone,
}: {
  summary: BookingSummary;
  onDone: () => void;
}) {
  return (
    <div className="mobile-shell">
      <Alert data-bs-theme="dark" variant="success" className="mb-3">
        <Alert.Heading className="h5">Bokning bekräftad!</Alert.Heading>
        <p className="text-center mb-0">
          Ditt boknings-ID är <strong>{summary.bookingId}</strong>.
        </p>
      </Alert>

      <Card className="bg-secondary mb-3">
        <Card.Header as="h6">Din bokning</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Film</span> <span>{summary.movieTitle}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Föreställning</span>{" "}
            <span>{formatDateTime(summary.showtime)}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Biljetter</span>
            <span>
              {summary.tickets.vuxen} vuxen, {summary.tickets.barn} barn,{" "}
              {summary.tickets.pensionar} pensionär
            </span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Platser</span>
            <span>{summary.seats.map(seatKey).join(", ")}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Pris</span> <strong>{formatPrice(summary.total)}</strong>
          </ListGroup.Item>
        </ListGroup>
      </Card>

      <div className="text-center">
        <Button
          variant="primary"
          size="sm"
          className="border-dark text-dark"
          onClick={onDone}
        >
          Till startsidan
        </Button>
      </div>
    </div>
  );
}
// #ÖVER################################################################################################################################

// #UNDER###############################################################################################################################
// ---------- Profil ----------
function ProfilePage({
  bookings,
  onBack,
  onCancel,
}: {
  bookings: BookingSummary[];
  onBack: () => void;
  onCancel: (id: string) => void;
}) {
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => Date.parse(b.showtime) >= now)
    .sort((a, b) => Date.parse(a.showtime) - Date.parse(b.showtime));
  const past = bookings
    .filter((b) => Date.parse(b.showtime) < now)
    .sort((a, b) => Date.parse(b.showtime) - Date.parse(a.showtime));

  // ⬇️ state för aktuell bokning som användaren vill avboka
  const [toCancel, setToCancel] = useState<BookingSummary | null>(null);

  return (
    <div className="mobile-shell">
      <Button
        variant="primary"
        size="sm"
        className="mb-3 d-block mx-auto text-dark border-dark py-2 px-5"
        onClick={onBack}
        aria-label="Tillbaka"
      >
        Tillbaka
      </Button>
      {/* <h2 className="h5 mb-3">Min profil</h2> */}

      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Kommande visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {upcoming.length === 0 && (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga kommande bokningar.
            </ListGroup.Item>
          )}
          {upcoming.map((b) => (
            <ListGroup.Item
              key={b.bookingId}
              className="bg-secondary border-primary text-info d-flex justify-content-between align-items-start py-4"
            >
              <div>
                <div className="fw-semibold">{b.movieTitle}</div>
                <div className="small text-info">
                  {formatDateTime(b.showtime)}
                </div>
                <div className="small text-info">
                  Platser: {b.seats.map(seatKey).join(", ")}
                </div>
                <div className="small text-info">ID: {b.bookingId}</div>
              </div>
              <div className="text-end">
                <div className="fw-semibold">{formatPrice(b.total)}</div>
                <Button
                  size="sm"
                  variant="dark"
                  className="border-light mt-2"
                  onClick={() => setToCancel(b)} // ⬅️ öppna popup
                >
                  Avboka
                </Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>

      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Tidigare visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {past.length === 0 && (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga tidigare bokningar.
            </ListGroup.Item>
          )}
          {past.map((b) => (
            <ListGroup.Item
              key={b.bookingId}
              className="bg-secondary border-primary text-info d-flex justify-content-between py-4"
            >
              <div>
                <div className="fw-semibold">{b.movieTitle}</div>
                <div className="small text-info">
                  {formatDateTime(b.showtime)}
                </div>
                {/* <div className="small text-info">
                  Platser: {b.seats.map(seatKey).join(", ")}
                </div> */}
                {/* <div className="small text-info">ID: {b.bookingId}</div> */}
              </div>
              <div className="text-end">
                <div className="fw-semibold">{formatPrice(b.total)}</div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>
      <Button
        variant="primary"
        size="sm"
        className="border-dark mb-3 d-block mx-auto text-dark py-2 px-5"
        onClick={onBack}
        aria-label="Tillbaka"
      >
        Tillbaka
      </Button>
      {/* ⬇️ Bekräftelse-popup */}
      <Modal
        show={!!toCancel}
        onHide={() => setToCancel(null)}
        centered
        dialogClassName="mobile-shell-modal"
        aria-labelledby="cancel-confirm-title"
      >
        <Modal.Header closeButton className="bg-primary border-dark text-info">
          <Modal.Title id="cancel-confirm-title">Avboka visning</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-secondary border-dark text-info">
          Är du säker på att du vill avboka?
          <br />
          <strong>Detta val går ej att ångra.</strong>
          {toCancel && (
            <div className="mt-3 small text-info">
              <div>
                Film: <span className="text-info">{toCancel.movieTitle}</span>
              </div>
              <div>
                Föreställning:{" "}
                <span className="text-info">
                  {formatDateTime(toCancel.showtime)}
                </span>
              </div>
              <div>
                Platser:{" "}
                <span className="text-info">
                  {toCancel.seats.map(seatKey).join(", ")}
                </span>
              </div>
              <div>
                ID: <span className="text-info">{toCancel.bookingId}</span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-primary border-dark d-flex justify-content-center">
          <Button
            variant="secondary"
            className="border-dark"
            onClick={() => setToCancel(null)}
          >
            Nej, avbryt
          </Button>
          <Button
            variant="dark"
            className="border-light"
            onClick={() => {
              if (toCancel) {
                onCancel(toCancel.bookingId); // ⬅️ tar bort bokningen
                setToCancel(null);
              }
            }}
          >
            Ja, avboka
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
// #ÖVER##################################################################################################################################

// ---------- Auth (login/signup) ----------
function AuthPage({
  mode,
  onSuccess,
  onBack,
}: {
  mode: "login" | "signup";
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 700);
  }
  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        className="mb-3"
        onClick={onBack}
        aria-label="Tillbaka"
      >
        ← Tillbaka
      </Button>
      <Card className="bg-dark border-secondary">
        <Card.Header as="h6">
          {mode === "login" ? "Logga in" : "Skapa konto"}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={submit}>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="du@example.com"
                autoComplete="username"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                required
                minLength={8}
                placeholder="Minst 8 tecken"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Form.Group>
            {mode === "signup" && (
              <Form.Group className="mb-3" controlId="pwd2">
                <Form.Label>Upprepa lösenord</Form.Label>
                <Form.Control
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minst 8 tecken"
                />
              </Form.Group>
            )}
            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading
                  ? "Skickar…"
                  : mode === "login"
                  ? "Logga in"
                  : "Skapa konto"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}

// Extra CSS via inline <style>
const style = document.createElement("style");
style.innerHTML = `
  .ratio-2x3 { aspect-ratio: 2 / 3; }
  .screen { letter-spacing: .2em; }
  .seat-grid { display: grid; gap: .5rem; }
  .seat-row { display: grid; grid-template-columns: 1.5rem repeat(${cols}, 1fr); gap: .35rem; align-items: center; }
  .row-label { color: #9ca3af; font-size: .8rem; text-align: center; }
  .seat { background: var(--seat); color: #fff; border: 1px solid #334155; border-radius: .5rem; padding: .35rem 0; font-size: .9rem; }
  .seat-active { background: var(--seat-active); border-color: #b91c1c; }
  .seat-taken { background: var(--seat-taken); color: #9ca3af; border-style: dashed; }
`;
if (
  typeof document !== "undefined" &&
  !document.getElementById("_cinema_style")
) {
  style.id = "_cinema_style";
  document.head.appendChild(style);
}
