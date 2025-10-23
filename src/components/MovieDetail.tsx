import { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/detail.scss";

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

//props for component
interface MovieDetailProps {
  onBook: () => void;
  movieId?: number;
}

//make api path start with /api
const apiUrl = (path: string) => (path.startsWith("/") ? `/api${path}` : `/api/${path}`);

//get id from url
const getQueryId = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get("id");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
  if (p.startsWith("/assets/")) return p;
  if (p.startsWith("assets/")) return `/${p}`;
  return `/assets/posters/${p}`;
};

//main component
export default function MovieDetail({ onBook, movieId }: MovieDetailProps) {
  //find movie id
  const resolvedId = useMemo<number | null>(() => {
    if (typeof movieId === "number" && Number.isFinite(movieId) && movieId > 0) return movieId;
    const qid = getQueryId();
    if (qid) return qid;
    try {
      const stored = localStorage.getItem("selectedMovieId");
      const n = stored ? Number(stored) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {}
    return null;
  }, [movieId]);

  //main states
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);

  //fetch movie data
  useEffect(() => {
    if (resolvedId === null) {
      setLoading(false);
      setMovie(null);
      setError("Saknar film id. Öppna detaljvyn via Info eller lägg till id i URL:en.");
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const res = await fetch(apiUrl(`/movies/${resolvedId}`), { signal: ac.signal });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setError((json && (json.error || json.message)) || `HTTP ${res.status}`);
          setLoading(false);
          return;
        }

        const payload: Movie | null = Array.isArray(json) ? (json[0] ?? null) : (json?.data ?? json ?? null);
        if (!payload) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setMovie(payload);
        setLoading(false);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message || "Nätverksfel");
          setLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [resolvedId]);

  //no id found
  if (resolvedId === null) {
    return (
      <div className="movie-detail-theme min-vh-100 d-flex flex-column">
        <main className="container-xxl py-4 flex-grow-1">
          <div className="alert alert-warning">
            <strong>Saknar film-id.</strong> Öppna via <em>Info</em> eller lägg till <code>?id=1</code> i adressfältet.
          </div>
        </main>
      </div>
    );
  }

  //loading state
  if (loading) {
    return (
      <div className="movie-detail-theme min-vh-100 d-flex flex-column">
        <main className="container-xxl py-4 flex-grow-1">
          <section className="placeholder-glow">
            <div className="placeholder col-6 mb-2" />
            <div className="placeholder col-12 mb-2" />
            <div className="placeholder col-10 mb-2" />
            <div className="placeholder col-8 mb-2" />
          </section>
        </main>
      </div>
    );
  }

  //movie not found
  if (notFound) {
    return (
      <div className="movie-detail-theme min-vh-100 d-flex flex-column">
        <main className="container-xxl py-4 flex-grow-1">
          <section className="alert alert-info">
            <strong>404.</strong> Filmen med id <code>{resolvedId}</code> kunde inte hittas.
          </section>
        </main>
      </div>
    );
  }

  //error state
  if (error) {
    return (
      <div className="movie-detail-theme min-vh-100 d-flex flex-column">
        <main className="container-xxl py-4 flex-grow-1">
          <section className="alert alert-danger">
            <strong>Ett fel uppstod:</strong> {error}
          </section>
        </main>
      </div>
    );
  }

  //render movie
  const m = movie as Movie;
  const poster = posterPath(m.movie_poster);
  const trailerId = toYouTubeId(m.movie_trailer);
  const cast = csvToList(m.movie_cast);

  return (
    <div className="movie-detail-theme min-vh-100 d-flex flex-column">
      <main className="container-xxl py-4 flex-grow-1">
        {/*title*/}
        <h1 className="movie-title mb-3">{m.movie_title}</h1>

        <section className="row g-4 align-items-start">
          {/*left side*/}
          <article className="col-lg-7 order-2 order-lg-1">
            {/*meta info*/}
            <div className="movie-meta">
              <p className="small d-flex justify-content-between mb-3">
                <span>{m.age_limit ?? "-"}+</span>
                <span>{/* genre saknas i schema */}</span>
                <span>{m.movie_playtime || "-"}</span>
              </p>
            </div>

            {/*description*/}
            <section className="movie-card mb-3">
              <div className="card-body movie-body-text p-4">
                {m.movie_desc || "Ingen beskrivning."}
              </div>
            </section>

            {/*accordion*/}
            <section className="movie-accordion accordion" id="filmAccordion">
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseInfo"
                    aria-expanded={true}
                    aria-controls="collapseInfo"
                  >
                    Mer info
                  </button>
                </h2>
                <div id="collapseInfo" className="accordion-collapse collapse show" data-bs-parent="#filmAccordion">
                  <div className="accordion-body movie-body-text">
                    <p><strong>Regi:</strong> {m.movie_director || "–"}</p>
                    <p>
                      <strong>Skådespelare:</strong>{" "}
                      {cast.length ? (
                        <ul className="mb-0">
                          {cast.map((name, i) => (
                            <li key={i}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        "-"
                      )}
                    </p>
                    <p><strong>Premiär:</strong> {m.movie_premier || "–"}</p>
                  </div>
                </div>
              </div>

              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseReviews"
                    aria-expanded={false}
                    aria-controls="collapseReviews"
                  >
                    Recensioner
                  </button>
                </h2>
                <div id="collapseReviews" className="accordion-collapse collapse" data-bs-parent="#filmAccordion">
                  <div className="accordion-body movie-body-text">
                    <p className="mb-0 text-muted">Inga recensioner ännu.</p>
                  </div>
                </div>
              </div>
            </section>

            {/*book button*/}
            <div className="d-flex justify-content-end mb-5">
              <button className="movie-book-btn" onClick={onBook}>
                Boka biljett
              </button>
            </div>
          </article>

          {/*right side*/}
          <aside className="col-lg-5 order-1 order-lg-2 d-grid gap-3">
            {/*poster*/}
            {poster ? (
              <figure className="movie-poster d-none d-lg-flex justify-content-center">
                <img
                  src={poster}
                  alt="Film poster"
                  className="img-fluid rounded-2"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/assets/posters/placeholder.jpg";
                  }}
                />
              </figure>
            ) : (
              <div className="alert alert-secondary d-none d-lg-block">Ingen bild tillgänglig.</div>
            )}

            {/*trailer*/}
            <section className="movie-trailer-wrapper">
              {!trailerId ? (
                <div className="alert alert-secondary mb-0">Ingen trailer tillgänglig.</div>
              ) : (
                <div className="movie-trailer-iframe ratio ratio-16x9">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&modestbranding=1&rel=0&showinfo=0`}
                    title={`${m.movie_title} – trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
