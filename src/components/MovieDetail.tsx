import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/detail.scss";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Ratio from "react-bootstrap/Ratio";
import Figure from "react-bootstrap/Figure";
import Card from "react-bootstrap/Card";
import Accordion from "react-bootstrap/Accordion";
import ListGroup from "react-bootstrap/ListGroup";
import AgeTooltip from "./ageTooltip";

// Types for movie data
interface Movie {
  id: number;
  movie_title: string;
  movie_desc: string;
  movie_playtime: string;
  movie_director: string;
  movie_cast: string;
  movie_premier: string;
  movie_poster: string;
  movie_banner?: string;
  movie_trailer?: string;
  age_limit: number;
  review1?: Review;
  review2?: Review;
}

interface Screening {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
}

interface Review {
  text: string;
  author: string;
  rating: number;
}

// Props for component
interface MovieDetailProps {
  onBook: () => void;
  movieId?: number;
}

// Make api path start with /api
const apiUrl = (path: string) =>
  path.startsWith("/") ? `/api${path}` : `/api/${path}`;

// Get youtube id from link
const toYouTubeId = (val?: string): string => {
  if (!val) return "";
  const v = val.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m =
    v.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    v.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    v.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    v.match(/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
};

// Split cast list into array
const csvToList = (csv?: string): string[] =>
  (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Build full poster path
const posterPath = (val?: string): string => {
  const p = (val ?? "").trim();
  if (!p) return "/assets/posters/placeholder.jpg";
  if (/^https?:\/\//i.test(p)) return p;

  const file = p.split("/").pop() ?? "";
  if (!file) return "/assets/posters/placeholder.jpg";

  // Enkel sökväg till public-mappen
  return `/assets/posters/${file}`;
};

// Format helpers
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

// Get auditorium name
const getAuditoriumName = (id: number | undefined): string => {
  if (id === 2) return "Lilla Salongen";
  if (id === 1) return "Stora Salongen";
  return id ? `Salong ${id}` : "N/A";
};

// Main component
export default function MovieDetail({ onBook }: MovieDetailProps) {
  //find movie id
  const { id: idParam } = useParams<{ id: string }>();
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedId = useMemo<number | null>(() => {
    const n = idParam ? Number(idParam) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    try {
      const stored = localStorage.getItem("selectedMovieId");
      const m = stored ? Number(stored) : NaN;
      if (Number.isFinite(m) && m > 0) return m;
    } catch {}
    return null;
  }, [idParam]);

  // Fetch movie data
  useEffect(() => {
    if (resolvedId === null) return;
    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(apiUrl(`/movies/${resolvedId}`), {
          signal: ac.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload: Movie = Array.isArray(json)
          ? json[0]
          : json?.data ?? json;
        if (!payload) throw new Error("Filmen hittades inte");

        if (!cancelled) setMovie(payload);
      } catch (e: any) {
        const name = e?.name ?? "";
        const msg = e?.message ?? "";
        if (name === "AbortError" || msg.includes("aborted")) return;
        if (!cancelled) setError(msg || "Nätverksfel");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [resolvedId]);

  // Fetch screenings
  useEffect(() => {
    if (resolvedId === null) return;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(apiUrl(`/screenings`), { signal: ac.signal });
        const data = await res.json().catch(() => []);
        setScreenings(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        setScreenings([]);
      }
    })();
    return () => ac.abort();
  }, [resolvedId]);

  // Early states
  if (resolvedId === null)
    return (
      <div className="alert alert-warning m-5">
        Saknar film-id. Öppna via Info eller lägg till <code>?id=1</code>.
      </div>
    );

  if (loading)
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" className="text-primary" />
      </div>
    );

  if (notFound)
    return (
      <Alert variant="info" className="m-5">
        Filmen med id <code>{resolvedId}</code> kunde inte hittas.
      </Alert>
    );

  if (error)
    return (
      <Alert variant="danger" className="m-5">
        <strong>Ett fel uppstod:</strong> {error}
      </Alert>
    );

  const m = movie as Movie;
  const poster = posterPath(m.movie_poster);
  const trailerId = toYouTubeId(m.movie_trailer);
  const cast = csvToList(m.movie_cast);

  const reviews: Review[] = [m.review1, m.review2].filter((r): r is Review =>
    Boolean(r && r.text)
  );

  const upcoming = screenings
    .filter((s) => s.movie_id === m.id)
    .filter((s) => new Date(s.screening_time).getTime() > Date.now())
    .sort(
      (a, b) =>
        new Date(a.screening_time).getTime() -
        new Date(b.screening_time).getTime()
    );

  function handleBook(s: Screening): void {
    localStorage.setItem("selectedScreeningId", String(s.id));
    localStorage.setItem("selectedScreeningTime", s.screening_time);
    localStorage.setItem("selectedAuditoriumId", String(s.auditorium_id));
    onBook();
  }

  // Origin for youtube
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="movie-detail-theme min-vh-100 d-flex flex-column">
      <main className="container-xxl py-4 flex-grow-1">
        <h1 className="movie-title mb-3">{m.movie_title}</h1>

        <section className="row g-4 align-items-start">
          <article className="col-lg-7 order-2 order-lg-1">
            <p className="small d-flex justify-content-between mb-3">
              <span>
                {m.age_limit ?? "-"}+ <AgeTooltip />
              </span>
              <span>{m.movie_playtime || "-"}</span>
            </p>

            {/* Description card */}
            <Card
              className="movie-card border-0 shadow-0"
              style={{
                backgroundColor: "var(--movie-secondary)",
                color: "var(--movie-text)",
                boxShadow: "none",
                border: 0,
              }}
            >
              <Card.Body className="p-4" style={{ backgroundColor: "inherit" }}>
                {m.movie_desc || "Ingen beskrivning."}
              </Card.Body>
            </Card>

            {/* Accordion */}
            <Accordion defaultActiveKey="info" className="movie-accordion">
              {/* Info */}
              <Accordion.Item eventKey="info">
                <Accordion.Header>Mer info</Accordion.Header>
                <Accordion.Body>
                  <p>
                    <strong>Regi:</strong> {m.movie_director || "–"}
                  </p>
                  <div className="mb-2">
                    <strong>Skådespelare:</strong>{" "}
                    {cast.length ? (
                      <ul className="mb-0">
                        {cast.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </div>
                  <p>
                    <strong>Premiär:</strong> {m.movie_premier || "–"}
                  </p>
                </Accordion.Body>
              </Accordion.Item>

              {/* Reviews */}
              <Accordion.Item eventKey="reviews">
                <Accordion.Header>Recensioner</Accordion.Header>
                <Accordion.Body>
                  {reviews.length === 0 ? (
                    <p className="mb-0 text-muted">Inga recensioner ännu.</p>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {reviews.map((r, i) => (
                        <Card key={i} className="border rounded-2">
                          <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <strong>{r.author || "Okänd källa"}</strong>
                              <span className="badge bg-secondary">
                                Betyg: {r.rating}/5
                              </span>
                            </div>
                            <p className="mb-0">{r.text}</p>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </Accordion.Body>
              </Accordion.Item>

              {/* Screenings & booking */}
              <Accordion.Item eventKey="bookings">
                <Accordion.Header>Föreställningar & bokning</Accordion.Header>
                <Accordion.Body>
                  {upcoming.length === 0 ? (
                    <p className="mb-0 text-muted">
                      Inga kommande visningar för den här filmen.
                    </p>
                  ) : (
                    <ListGroup variant="flush" className="mt-1 gap-1">
                      {upcoming.map((s) => (
                        <ListGroup.Item
                          as="button"
                          type="button"
                          key={s.id}
                          action
                          onClick={() => handleBook(s)}
                          aria-label={`Boka ${m.movie_title} ${fmtDate(
                            s.screening_time
                          )} ${fmtTime(s.screening_time)} i ${getAuditoriumName(
                            s.auditorium_id
                          )}`}
                          className="d-flex justify-content-between align-items-center w-100 text-start rounded-2 py-2 "
                        >
                          <span>
                            {fmtDate(s.screening_time)} •{" "}
                            {fmtTime(s.screening_time)} •{" "}
                            {getAuditoriumName(s.auditorium_id)}
                          </span>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </article>

          {/* Poster */}
          <aside className="col-lg-5 order-1 order-lg-2 d-grid gap-3">
            {poster ? (
              <Figure className="movie-poster d-none d-lg-flex justify-content-center">
                <Figure.Image
                  src={poster}
                  alt="Film poster"
                  className="img-fluid rounded-2"
                  onError={(e) =>
                    ((e.currentTarget as HTMLImageElement).src =
                      "/assets/posters/placeholder.jpg")
                  }
                />
              </Figure>
            ) : (
              <Alert variant="secondary" className="d-none d-lg-block">
                Ingen bild tillgänglig.
              </Alert>
            )}

            {/* Trailer */}
            <section className="movie-trailer-wrapper">
              {!trailerId ? (
                <Alert variant="secondary" className="mb-0">
                  Ingen trailer tillgänglig.
                </Alert>
              ) : (
                <Ratio aspectRatio="16x9" className="movie-trailer-iframe">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?modestbranding=1&rel=0&controls=1&origin=${origin}`}
                    title={`${m.movie_title} – trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{ border: 0, width: "100%", height: "100%" }}
                  />
                </Ratio>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
