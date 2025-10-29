import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/detail.scss";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";

//types for movie data
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
}

interface Screening {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
}

//props for component
interface MovieDetailProps {
  onBook: () => void;
  movieId?: number;
}

//ake api path start with /api
const apiUrl = (path: string) =>
  path.startsWith("/") ? `/api${path}` : `/api/${path}`;

//get youtube id from link
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

//split cast list into array
const csvToList = (csv?: string): string[] =>
  (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

//build full poster path
const posterPath = (val?: string): string => {
  const p = (val ?? "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const file = p.split("/").pop() ?? "";
  try {
    return new URL(`../assets/posters/${file}`, import.meta.url).href;
  } catch {
    return "";
  }
};

//main component
export default function MovieDetail({ onBook }: MovieDetailProps) {
  //find movie id
  const { id: idParam } = useParams<{ id: string }>();
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

    //main states
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);

  //fetch movie data
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

      const payload: Movie = Array.isArray(json) ? json[0] : json?.data ?? json;
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

  //fetch screenings
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

  const thisMovieScreenings = useMemo(() => {
    if (!movie) return [];
    const now = Date.now();
    return screenings
      .filter((s) => s.movie_id === movie.id)
      .filter((s) => new Date(s.screening_time).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.screening_time).getTime() -
          new Date(b.screening_time).getTime()
      );
  }, [screenings, movie]);

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

  if (resolvedId === null)
    return (
      <div className="alert alert-warning m-5">
        Saknar film-id. Öppna via Info eller lägg till <code>?id=1</code>.
      </div>
    );

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );

  if (notFound)
    return (
      <div className="alert alert-info m-5">
        Filmen med id <code>{resolvedId}</code> kunde inte hittas.
      </div>
    );

  if (error)
    return (
      <div className="alert alert-danger m-5">
        <strong>Ett fel uppstod:</strong> {error}
      </div>
    );

  const m = movie as Movie;
  const poster = posterPath(m.movie_poster);
  const trailerId = toYouTubeId(m.movie_trailer);
  const cast = csvToList(m.movie_cast);

  return (
    <div className="movie-detail-theme min-vh-100 d-flex flex-column">
      <main className="container-xxl py-4 flex-grow-1">
        <h1 className="movie-title mb-3">{m.movie_title}</h1>

        <section className="row g-4 align-items-start">
          <article className="col-lg-7 order-2 order-lg-1">
            <p className="small d-flex justify-content-between mb-3">
              <span>{m.age_limit ?? "-"}+</span>
              <span>{m.movie_playtime || "-"}</span>
            </p>

            <section className="movie-card mb-3">
              <div className="card-body movie-body-text p-4">
                {m.movie_desc || "Ingen beskrivning."}
              </div>
            </section>

            {/*Accordion */}
            <Accordion defaultActiveKey="info">
              <Accordion.Item eventKey="info">
                 {/*more info*/}
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
             {/* reviews */}
              <Accordion.Item eventKey="reviews">
                <Accordion.Header>Recensioner</Accordion.Header>
                <Accordion.Body>
                  <p className="mb-0 text-muted">Inga recensioner ännu.</p>
                </Accordion.Body>
              </Accordion.Item>
                
                {/*book ticket*/}
              <Accordion.Item eventKey="bookings">
                <Accordion.Header>Föreställningar & bokning</Accordion.Header>
                <Accordion.Body>
                  {thisMovieScreenings.length === 0 ? (
                    <p className="mb-0 text-muted">
                      Inga kommande visningar för den här filmen.
                    </p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {thisMovieScreenings.map((s) => (
                        <div
                          key={s.id}
                          className="d-flex align-items-center justify-content-between border-bottom pb-1"
                        >
                          <span>
                            {fmtDate(s.screening_time)} • {fmtTime(s.screening_time)} • Salong{" "}
                            {s.auditorium_id}
                          </span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem("selectedScreeningId", String(s.id));
                              localStorage.setItem("selectedScreeningTime", s.screening_time);
                              localStorage.setItem("selectedAuditoriumId", String(s.auditorium_id));
                              onBook();
                            }}
                          >
                            Boka
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </article>

            {/*poster*/}
          <aside className="col-lg-5 order-1 order-lg-2 d-grid gap-3">
            {poster ? (
              <figure className="movie-poster d-none d-lg-flex justify-content-center">
                <img
                  src={poster}
                  alt="Film poster"
                  className="img-fluid rounded-2"
                  onError={(e) =>
                    ((e.currentTarget as HTMLImageElement).src =
                      "/assets/posters/placeholder.jpg")
                  }
                />
              </figure>
            ) : (
              <div className="alert alert-secondary d-none d-lg-block">
                Ingen bild tillgänglig.
              </div>
            )}

            {/*trailer*/}
            <section className="movie-trailer-wrapper">
              {!trailerId ? (
                <div className="alert alert-secondary mb-0">
                  Ingen trailer tillgänglig.
                </div>
              ) : (
                <div className="movie-trailer-iframe ratio ratio-16x9">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?modestbranding=1&rel=0&showinfo=0&controls=1`}
                    title={`${m.movie_title} – trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
