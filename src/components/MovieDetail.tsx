
import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

// plockar ut youtube id
function toEmbed(url: string): string {
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

export default function MovieDetail() {
  const [playTrailer, setPlayTrailer] = useState<boolean>(false);
  const trailerId: string = toEmbed("https://www.youtube.com/watch?v=TcMBFSGVi1c");


  return (
    <div className="theme min-vh-100 d-flex flex-column">
   

      {/* logga för mobil */}
      <header className="logo mb-2 d-lg-none">Filmvisarna</header>

      <main className="container-xxl py-4 flex-grow-1">
        <h1 className="title text-center mb-3">Avengers</h1>

        <section className="row g-4 align-items-start">
          {/* info genre speltid åldersgräns */}
          <article className="col-lg-7 order-2 order-lg-1">
            <p className="meta small d-flex justify-content-between mb-3">
              <span>11+</span>
              <span>Action Äventyr Fantasy</span>
              <span>3 tim 2 min</span>
            </p>

            {/* kort beskrivning */}
            <section className="card surface mb-3">
              <div className="card-body body-text">
                Efter de katastrofala händelserna, som startades av Thanos, och vilka raderade
                halva universum och splittrade The Avengers tvingas de återstående medlemmarna
                i Avengers ta upp en sista kamp.
              </div>
            </section>

            {/* accordion för mer info och recensioner */}
            <section className="accordion mb-4" id="filmAccordion">
              <div className="accordion-item surface">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button surface-btn"
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
                  <div className="accordion-body body-text">
                    <p><strong>Regi:</strong> Joe Russo, Anthony Russo</p>
                    <p><strong>Skådespelare:</strong> Brie Larson, Scarlett Johansson, Robert Downey Jr, Chris Evans...</p>
                    <p><strong>Originaltitel:</strong> Avengers: Endgame</p>
                    <p><strong>Premiär:</strong> 2019-04-24</p>
                  </div>
                </div>
              </div>

              <div className="accordion-item surface">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button collapsed surface-btn"
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
                  <div className="accordion-body body-text">
                    <ul className="list-unstyled review-list">
                      <li className="mb-3">
                        <h3 className="h6 mb-1">Dagens Nyheter</h3>
                        <p className="mb-1">“Ett storslaget avslut som levererar både action och känsla.”</p>
                        <small className="text-muted">Betyg: 4/5</small>
                      </li>
                      <li>
                        <h3 className="h6 mb-1">Aftonbladet</h3>
                        <p className="mb-1">“Marvels bästa ensemblefilm hittills.”</p>
                        <small className="text-muted">Betyg: 5/5</small>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* boka biljett knapp */}
            <div className="d-flex justify-content-end mb-5">
              <a href="#" className="btn book btn-sm rounded-pill px-3">
                Boka biljett
              </a>
            </div>
          </article>

          {/* film poster */}
          <aside className="col-lg-5 order-1 order-lg-2 d-grid gap-3">
            <figure className="d-none d-lg-flex justify-content-center">
              <img
                src="/poster.png"
                alt="Film Poster"
                className="img-fluid rounded-2 poster"
              />
            </figure>

            {/* trailer */}
            <section className="trailer-wrapper">
              {!playTrailer ? (
                <div
                  className="trailer-poster position-relative"
                  onClick={() => setPlayTrailer(true)}
                  role="button"
                  aria-label="spela trailer"
                >
                  <img
                    src="/trailer.png"
                    alt="Trailer Poster"
                    className="img-fluid rounded-2"
                  />
                  <div className="play-icon position-absolute top-50 start-50 translate-middle fs-1 text-white">
                    ▶
                  </div>
                </div>
              ) : (
                <div className="ratio ratio-16x9">
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

