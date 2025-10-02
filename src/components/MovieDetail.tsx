import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/detail.scss";

// plockar ut youtube id
function toEmbed(url: string): string {
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

interface MovieDetailProps {
  onBook: () => void;
}

export default function MovieDetail({ onBook }: MovieDetailProps) {
  const [playTrailer, setPlayTrailer] = useState<boolean>(false);
  const trailerId: string = toEmbed(
    "https://www.youtube.com/watch?v=TcMBFSGVi1c"
  );

  return (
    <div className="movie-detail-theme min-vh-100 d-flex flex-column">
      {/* logga för mobil */}

      <main className="container-xxl py-4 flex-grow-1">
        <h1 className="movie-title mb-3">Avengers</h1>

        <section className="row g-4 align-items-start">
          {/* info genre speltid åldersgräns */}
          <article className="col-lg-7 order-2 order-lg-1">
            <div className="movie-meta">
              <p className="small d-flex justify-content-between mb-3">
                <span>11+</span>
                <span>Action Äventyr Fantasy</span>
                <span>3 tim 2 min</span>
              </p>
            </div>

            {/* kort beskrivning */}
            <section className="movie-card mb-3">
              <div className="card-body movie-body-text">
                Efter de katastrofala händelserna, som startades av Thanos, och
                vilka raderade halva universum och splittrade The Avengers
                tvingas de återstående medlemmarna i Avengers ta upp en sista
                kamp.
              </div>
            </section>

            {/* accordion för mer info och recensioner */}

            <section className="movie-accordion accordion" id="filmAccordion">
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button "
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseInfo"
                    aria-expanded="true"
                    aria-controls="collapseInfo"
                  >
                    Mer info
                  </button>
                </h2>
                <div
                  id="collapseInfo"
                  className="accordion-collapse collapse show"
                  data-bs-parent="#filmAccordion"
                >
                  <div className="accordion-body movie-body-text">
                    <p>
                      <strong>Regi:</strong> Joe Russo, Anthony Russo
                    </p>
                    <p>
                      <strong>Skådespelare:</strong> Brie Larson, Scarlett
                      Johansson, Robert Downey Jr, Chris Evans...
                    </p>
                    <p>
                      <strong>Originaltitel:</strong> Avengers: Endgame
                    </p>
                    <p>
                      <strong>Premiär:</strong> 2019-04-24
                    </p>
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
                    aria-expanded="false"
                    aria-controls="collapseReviews"
                  >
                    Recensioner
                  </button>
                </h2>
                <div
                  id="collapseReviews"
                  className="accordion-collapse collapse"
                  data-bs-parent="#filmAccordion"
                >
                  <div className="accordion-body movie-body-text">
                    <ul className="movie-review-list">
                      <li className="mb-3">
                        <h3 className="movie-heading-text mb-1">
                          Dagens Nyheter
                        </h3>
                        <p className="mb-1">
                          "Ett storslaget avslut som levererar både action och
                          känsla."
                        </p>
                        <small className="text-muted">Betyg: 4/5</small>
                      </li>
                      <li>
                        <h3 className="movie-heading-text mb-1">Aftonbladet</h3>
                        <p className="mb-1">
                          "Marvels bästa ensemblefilm hittills."
                        </p>
                        <small className="text-muted">Betyg: 5/5</small>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* boka biljett knapp */}
            <div className="d-flex justify-content-end mb-5">
              <button className="movie-book-btn" onClick={onBook}>
                Boka biljett
              </button>
            </div>
          </article>

          {/* film poster */}
          <aside className="col-lg-5 order-1 order-lg-2 d-grid gap-3">
            <figure className="movie-poster d-none d-lg-flex justify-content-center">
              <img
                src="/poster.png"
                alt="Film Poster"
                className="img-fluid rounded-2"
              />
            </figure>

            {/* trailer */}
            <section className="movie-trailer-wrapper">
              {!playTrailer ? (
                <div
                  className="movie-trailer-poster"
                  onClick={() => setPlayTrailer(true)}
                  role="button"
                  aria-label="spela trailer"
                >
                  <img
                    src="/trailer.png"
                    alt="Trailer Poster"
                    className="img-fluid"
                  />
                  <div className="movie-play-icon">▶</div>
                </div>
              ) : (
                <div className="movie-trailer-iframe ratio ratio-16x9">
                  <iframe
                    src={
                      trailerId
                        ? `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&modestbranding=1&rel=0&showinfo=0`
                        : ""
                    }
                    title="Avengers Trailer"
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
