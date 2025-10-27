import { useState, useEffect } from "react";
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
import "../styles/homepage.scss";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

import spidermarathonImg from "../assets/banners/spidermanmarathon.png";
import guardianmarathonImg from "../assets/banners/guardianmarathon.png";
import carousel1Img from "../assets/banners/deadpool.jpg";
import carousel2Img from "../assets/banners/ironMan2013.jpg";
import carousel3Img from "../assets/banners/venom2018.jpg";

interface Movie {
  id: number;
  movie_title: string;
  movie_desc: string;
  movie_playtime: string;
  movie_director: string;
  movie_cast: string;
  movie_premier: string;
  movie_poster: string;
  age_limit: number;
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

export default function HomePage({ onNavigate }: HomePageProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);

  // Hämta filmer från backend
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const res = await fetch("/api/movies");
        if (!res.ok) throw new Error("Misslyckades att hämta filmer");
        const data = await res.json();
        setMovies(data);
        console.log(data);
      } catch (err) {
        console.error("Fel vid hämtning av filmer:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

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

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.movie_title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesAge = age === "all" || movie.age_limit === parseInt(age);
    return matchesSearch && matchesAge;
  });

  // Hårdkodade nyaste filmer för mobil-karusell
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

  return (
    <>
      {/* ------------------ MOBILVY ------------------ */}
      <Container fluid className="d-md-none p-3">
        {/* Karusell med bilder endast */}
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

        {/* FILTRERING */}
        <h5 className="homepage-heading">Åldersgräns</h5>
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
          value={date}
          onChange={(value: Date | Date[]) =>
            setDate(Array.isArray(value) ? value[0] || null : value)
          }
          className="homepage-calendar"
          formatShortWeekday={(locale, date) =>
            ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
          }
        />

        {/* ALLA FILMER */}
        <h5 className="homepage-heading">Alla filmer</h5>
        <Row xs={2} xl={4} className="homepage-movie-grid g-3">
          {filteredMovies.map((movie) => (
            <Col key={movie.id}>
              <Card className="homepage-movie-card h-100 d-flex flex-column">
                <Card.Img variant="top" src={`src/${movie.movie_poster}`} />
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
      </Container>

      {/* ------------------ DESKTOPVY ------------------ */}
      <Container
        fluid
        className="d-none d-md-block"
        style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
      >
        <Row>
          {/* SIDOFILTER */}
          <Col md={4} lg={2} className="sidebar p-1 mt-2 position-sticky">
            <h5 className="homepage-heading">Åldersgräns</h5>
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

            <h5 className="homepage-heading">Välj datum</h5>
            <Calendar
              value={date}
              onChange={setDate}
              className="homepage-calendar"
              formatShortWeekday={(locale, date) =>
                ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
              }
            />
          </Col>

          {/* FILMLISTA */}
          <Col md={8} lg={10} className="p-4">
            <Row
              xs={1}
              sm={2}
              md={3}
              lg={5}
              className="homepage-movie-grid homepage-desktop-grid g-4"
            >
              {filteredMovies.map((movie) => (
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
          </Col>
        </Row>
      </Container>
    </>
  );
}
