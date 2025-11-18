import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  Container,
  Row,
  Col,
  Form,
  FormControl,
  Button,
  Card,
  Spinner,
  Carousel,
} from "react-bootstrap";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

import "../styles/homepage.scss";

import spidermarathonImg from "../assets/banners/spidermanmarathon.png";
import guardianmarathonImg from "../assets/banners/guardianmarathon.png";
import carousel1Img from "../assets/banners/deadpool.jpg";
import carousel2Img from "../assets/banners/ironMan2013.jpg";
import carousel3Img from "../assets/banners/venom2018.jpg";
import type { Route } from "./types";
import AgeTooltip from "../components/ageTooltip";

// ⭐ Lägg till dessa imports för routes
import { routePath, buildPath } from "../routes";
import type { RouteKey } from "../routes";

interface Movie {
  id: number;
  movie_title: string;
  movie_desc: string;
  movie_playtime: string;
  movie_director: string;
  movie_cast: string;
  movie_premier: string;
  movie_poster: string;
  movie_banner: string;
  age_limit: number;
}

interface Screening {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
}

interface Event {
  title: string;
  description: string;
  date: string;
  img: string;
}

interface HomePageProps {
  onNavigate: (route: Route, movieId?: number) => void;
}

// ------------------ MovieGrid-komponent ------------------
interface MovieGridProps {
  movies: (Movie & { times?: string[] })[];
  onNavigate: (route: Route, movieId?: number) => void;
}

const MovieGrid = ({ movies, onNavigate }: MovieGridProps) => (
  <Row xs={2} xl={4} className="homepage-movie-grid g-3 mb-5">
    {movies.map((movie) => (
      <Col key={movie.id}>
        <Card className="homepage-movie-card h-100 d-flex flex-column">
          <Card.Img variant="top" src={`src/${movie.movie_banner}`} />
          <div className="movie-title-wrapper text-center mt-2 mb-2">
            {movie.movie_title}
          </div>
          <Card.Body className="text-center mt-auto">
            <Button
              variant="secondary"
              size="sm"
              className="me-2 homepage-btn homepage-btn-secondary"
              onClick={() => onNavigate("biljett", movie.id)}
            >
              Biljett
            </Button>
            <Button
              variant="dark"
              size="sm"
              className="homepage-btn homepage-btn-dark"
              onClick={() => onNavigate("movie-detail", movie.id)}
            >
              Info
            </Button>
          </Card.Body>
        </Card>
      </Col>
    ))}
  </Row>
);

// ------------------ HomePage-komponent ------------------
export default function HomePage({ onNavigate }: HomePageProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [moviesForDate, setMoviesForDate] = useState<Movie[]>([]);

  const navigate = useNavigate(); // ⭐ useNavigate är nu korrekt importerad

  // ⭐ Uppdaterad handleNavigate funktion
  const handleNavigate = (name: RouteKey, movieId?: number) => {
    if (name === "biljett" && movieId) {
      // Navigera till booking med movieId i state (URLen ändras INTE)
      navigate(routePath.biljett, { state: { preselectedMovieId: movieId } });
    } else if (name === "movie-detail" && movieId) {
      // Befintlig logik för movie-detail
      const target = buildPath("movie-detail", { id: movieId });
      try {
        localStorage.setItem("selectedMovieId", String(movieId));
      } catch {}
      navigate(target);
    } else {
      // Standard navigation
      navigate(routePath[name] ?? routePath.home);
    }
  };

  // Hämta filmer
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const res = await fetch("/api/movies");
        if (!res.ok) throw new Error("Misslyckades att hämta filmer");
        const data = await res.json();
        setMovies(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMovies();
  }, []);

  // Hämta visningar
  useEffect(() => {
    const fetchScreenings = async () => {
      try {
        const res = await fetch("/api/screenings");
        if (!res.ok) throw new Error("Misslyckades att hämta visningar");
        const data = await res.json();
        setScreenings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchScreenings();
  }, []);

  // Filtrera filmer baserat på valt datum
  useEffect(() => {
    if (!selectedDate) {
      setMoviesForDate([]);
      return;
    }

    const selectedDay = selectedDate.getDate();
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();

    const screeningsOnDate = screenings.filter((s) => {
      const screeningDate = new Date(s.screening_time);
      return (
        screeningDate.getDate() === selectedDay &&
        screeningDate.getMonth() === selectedMonth &&
        screeningDate.getFullYear() === selectedYear
      );
    });

    const filteredMovies = movies
      .map((movie) => {
        const times = screeningsOnDate
          .filter((s) => s.movie_id === movie.id)
          .map((s) =>
            new Date(s.screening_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        if (times.length > 0) return { ...movie, times };
        return null;
      })
      .filter(Boolean) as (Movie & { times: string[] })[];
    setMoviesForDate(filteredMovies);
  }, [selectedDate, screenings, movies]);

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.movie_title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesAge = age === "all" || movie.age_limit === parseInt(age);
    return matchesSearch && matchesAge;
  });

  const events: Event[] = [
    {
      title: "Spider-Man Marathon",
      description: "Se alla Spider-Man filmer!",
      date: "2025-10-15",
      img: spidermarathonImg,
    },
    {
      title: "Guardians of the Galaxy Marathon",
      description: "Alla Guardians-filmer back-to-back.",
      date: "2025-10-20",
      img: guardianmarathonImg,
    },
  ];

  const newestMoviesHardcoded = [
    { movie_id: 1, movie_title: "Deadpool", movie_poster: carousel1Img },
    { movie_id: 2, movie_title: "Iron Man 3", movie_poster: carousel2Img },
    { movie_id: 3, movie_title: "Venom", movie_poster: carousel3Img },
  ];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="dark" />
      </div>
    );
  }

  // ------------------ Render ------------------
  return (
    <>
      {/* ------------------ MOBILVY ------------------ */}
      <Container fluid className="d-md-none p-3">
        <Carousel variant="dark" className="homepage-newest-carousel mb-4">
          {newestMoviesHardcoded.map((movie) => (
            <Carousel.Item key={movie.movie_id}>
              <img
                className="d-block w-100"
                src={movie.movie_poster}
                alt={movie.movie_title}
                style={{ width: "100%", height: "auto" }}
              />
            </Carousel.Item>
          ))}
        </Carousel>

        {/* KOMMANDE EVENT */}
        <h5 className="homepage-heading">🎉 Kommande Event</h5>
        <Row xs={1} sm={2} className="mb-3 g-4">
          {events.map((event, idx) => (
            <Col key={idx}>
              <Card className="homepage-event-card h-100">
                <Card.Img variant="top" src={event.img} />
                <Card.Body>
                  <Card.Title>{event.title}</Card.Title>
                  <Card.Text className="homepage-body-text">
                    {event.description}
                  </Card.Text>
                  <span className="homepage-event-date">{event.date}</span>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ÅLDERSGRÄNS + INFO*/}

        <h5 className="homepage-heading d-flex align-items-center gap-2">
          Åldersgräns
          <AgeTooltip />
        </h5>
        <Form.Group className="homepage-form mb-3">
          <Form.Select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="all">Alla</option>
            <option value="7">7 år</option>
            <option value="11">11 år</option>
            <option value="15">15 år</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="homepage-form mb-3">
          <Form.Label>Sök film</Form.Label>
          <FormControl
            type="text"
            placeholder="Skriv titel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Form.Group>

        {/* KALENDER */}
        <h5 className="homepage-heading">Välj datum</h5>
        <Calendar
          value={selectedDate}
          onChange={(value: Date | Date[]) => {
            const newDate = Array.isArray(value) ? value[0] || null : value;
            if (
              selectedDate &&
              newDate &&
              selectedDate.toDateString() === newDate.toDateString()
            ) {
              setSelectedDate(null);
            } else {
              setSelectedDate(newDate);
            }
          }}
          className="homepage-calendar"
          formatShortWeekday={(_, date) =>
            ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
          }
        />

        {/* Visa alla filmer-knapp */}
        {selectedDate && (
          <div
            className="text-center"
            style={{ marginTop: 12, marginBottom: 28 }}
          >
            <Button
              variant="light"
              size="sm"
              className="border shadow-sm"
              style={{
                backgroundColor: "transparent",
                color: "white",
                borderColor: "white",
                boxShadow: "none",
              }}
              onClick={() => setSelectedDate(null)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Visa alla filmer
            </Button>
          </div>
        )}

        {/* FILMER FÖR VALT DATUM / ALLA */}
        {selectedDate ? (
          moviesForDate.length > 0 ? (
            <>
              <h5
                className="homepage-heading text-center"
                style={{ marginTop: "1.25rem", marginBottom: "1rem" }}
              >
                Filmer som går den {selectedDate.toLocaleDateString()}
              </h5>
              {/* ⭐ Använd handleNavigate här för mobila vyn */}
              <MovieGrid movies={moviesForDate} onNavigate={handleNavigate} />
            </>
          ) : (
            <div className="text-center mt-4 mb-5">
              <p style={{ fontStyle: "italic", color: "#666" }}>
                Ingen film visas detta datum 🎬
              </p>
            </div>
          )
        ) : (
          <>
            <h5
              className="homepage-heading text-center"
              style={{ marginTop: "1.25rem" }}
            >
              Alla filmer
            </h5>
            {/* ⭐ Använd handleNavigate här för mobila vyn */}
            <MovieGrid movies={filteredMovies} onNavigate={handleNavigate} />
          </>
        )}
      </Container>

      {/* ------------------ DESKTOPVY ------------------ */}
      <Container
        fluid
        className="d-none d-md-block"
        style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
      >
        <Row>
          {/* SIDOFILTER */}
          <Col md={4} lg={3} className="sidebar p-1 mt-2 position-sticky">
            <h5 className="homepage-heading d-flex align-items-center gap-2">
              Åldersgräns
              <AgeTooltip />
            </h5>
            <Form.Group className="homepage-form mb-3">
              <Form.Select value={age} onChange={(e) => setAge(e.target.value)}>
                <option value="all">Alla</option>
                <option value="7">7 år</option>
                <option value="11">11 år (7år i vuxet sällskap)</option>
                <option value="15">15 år (11år i vuxet sällskap)</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="homepage-form mb-3">
              <Form.Label>Sök film</Form.Label>
              <FormControl
                type="text"
                placeholder="Skriv titel..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Form.Group>

            <h5 className="homepage-heading">Välj datum</h5>
            <Calendar
              value={selectedDate}
              onChange={(value: Date | Date[]) => {
                const newDate = Array.isArray(value) ? value[0] || null : value;
                if (
                  selectedDate &&
                  newDate &&
                  selectedDate.toDateString() === newDate.toDateString()
                ) {
                  setSelectedDate(null);
                } else {
                  setSelectedDate(newDate);
                }
              }}
              className="homepage-calendar"
              formatShortWeekday={(_, date) =>
                ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
              }
            />

            {/* Vit knapp även i desktop-sidokolumn */}
            {selectedDate && (
              <div
                className="text-center"
                style={{ marginTop: 12, marginBottom: 20 }}
              >
                <Button
                  variant="light"
                  size="sm"
                  className="border shadow-sm"
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    borderColor: "white",
                    boxShadow: "none",
                  }}
                  onClick={() => setSelectedDate(null)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  Visa alla filmer
                </Button>
              </div>
            )}
          </Col>

          {/* FILMLISTA */}
          <Col md={8} lg={9} className="p-4">
            <h5 className="homepage-heading">
              {selectedDate
                ? `Filmer som går den ${selectedDate.toLocaleDateString()}`
                : "Alla filmer"}
            </h5>
            {/* ⭐ Använd handleNavigate här för desktop vyn också */}
            <MovieGrid
              movies={selectedDate ? moviesForDate : filteredMovies}
              onNavigate={handleNavigate}
            />
          </Col>
        </Row>
      </Container>
    </>
  );
}
