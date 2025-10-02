import { useState } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  FormControl,
  Button,
  Card,
} from "react-bootstrap";

import "../styles/homepage.scss";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

import deadpoolImg from "../assets/deadpool.jpg";
import guardianImg from "../assets/guardians3.jpg";
import doctorstrangeImg from "../assets/doctorstrange.jpg";
import nowayhomeImg from "../assets/nowayhome.jpg";
import avengersImg from "../assets/avengers.jpg";
import spideracrossImg from "../assets/spideracross.jpg";
import thorImg from "../assets/thor.jpg";
import infinitywarImg from "../assets/avengers2.jpg";
import civilwarImg from "../assets/captainamerica2.jpg";
import guardiansImg from "../assets/guardian1.jpg";
import spidermarathonImg from "../assets/spidermanmarathon.png";
import guardianmarathonImg from "../assets/guardianmarathon.png";
import ironmanImg from "../assets/ironMan2013.jpg";
import venomImg from "../assets/venom2018.jpg";
import loganImg from "../assets/logan2017.jpg";
import deadpool1Img from "../assets/deadpool12016.jpg";
import captainImg from "../assets/captainamerica2014.jpg";
import type { Route } from "./types";

interface Movie {
  year: number;
  title: string;
  age: string;
  dates: { date: string; times: string[] }[];
  img: string;
}

interface Event {
  title: string;
  description: string;
  date: string;
  img: string;
}

interface HomePageProps {
  onNavigate: (route: Route) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [age, setAge] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);

  const movies: Movie[] = [
    {
      year: 2024,
      title: "Deadpool",
      age: "15",
      dates: [{ date: "2025-09-25", times: ["12:00", "15:00", "18:00"] }],
      img: deadpoolImg,
    },
    {
      year: 2023,
      title: "Guardians of the galaxy 3",
      age: "11",
      dates: [{ date: "2025-11-25", times: ["13:00", "16:00"] }],
      img: guardianImg,
    },
    {
      year: 2023,
      title: "Spider man across",
      age: "7",
      dates: [{ date: "2025-10-24", times: ["11:00", "14:00"] }],
      img: spideracrossImg,
    },
    {
      year: 2022,
      title: "Doctor Strange",
      age: "11",
      dates: [{ date: "2025-10-25", times: ["12:30", "15:30"] }],
      img: doctorstrangeImg,
    },
    {
      year: 2022,
      title: "Spider Man No way home",
      age: "11",
      dates: [
        { date: "2025-10-25", times: ["12:00", "15:00", "18:00"] },
        { date: "2025-10-21", times: ["14:00", "17:00"] },
        { date: "2025-11-25", times: ["13:00", "16:00"] },
      ],
      img: nowayhomeImg,
    },
    {
      year: 2019,
      title: "Avengers Endgame",
      age: "11",
      dates: [{ date: "2025-10-25", times: ["12:00", "15:00"] }],
      img: avengersImg,
    },
    {
      year: 2018,
      title: "Avengers Infinity war",
      age: "11",
      dates: [{ date: "2025-10-03", times: ["13:00", "16:00"] }],
      img: infinitywarImg,
    },
    {
      year: 2017,
      title: "Logan",
      age: "15",
      dates: [{ date: "2025-10-17", times: ["12:00", "15:00"] }],
      img: loganImg,
    },
    {
      year: 2017,
      title: "Thor Ragnarok",
      age: "11",
      dates: [{ date: "2025-10-05", times: ["11:00", "14:00"] }],
      img: thorImg,
    },
    {
      year: 2017,
      title: "Venom",
      age: "15",
      dates: [{ date: "2025-10-16", times: ["13:00", "16:00"] }],
      img: venomImg,
    },
    {
      year: 2016,
      title: "Deadpool 1",
      age: "15",
      dates: [{ date: "2025-10-19", times: ["12:00", "15:00"] }],
      img: deadpool1Img,
    },
    {
      year: 2016,
      title: "Captain America civil war",
      age: "11",
      dates: [{ date: "2025-11-10", times: ["13:00", "16:00"] }],
      img: civilwarImg,
    },
    {
      year: 2014,
      title: "Guardians of the galaxy",
      age: "11",
      dates: [{ date: "2025-10-14", times: ["12:00", "15:00"] }],
      img: guardiansImg,
    },
    {
      year: 2014,
      title: "Captain America the winter soldier",
      age: "11",
      dates: [{ date: "2025-10-20", times: ["13:00", "16:00"] }],
      img: captainImg,
    },
    {
      year: 2013,
      title: "Iron Man 3",
      age: "11",
      dates: [{ date: "2025-10-14", times: ["12:00", "15:00"] }],
      img: ironmanImg,
    },
  ];

  const newestMovie = [...movies].sort(
    (a, b) =>
      new Date(b.dates[0].date).getTime() - new Date(a.dates[0].date).getTime()
  )[1];

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
    const matchesSearch = movie.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesAge = age === "all" || movie.age === age;
    const matchesDate =
      !date ||
      movie.dates.some((d) => d.date === date.toISOString().split("T")[0]);
    return matchesSearch && matchesAge && matchesDate;
  });

  return (
    <>
      {/* Mobilvy */}
      <Container fluid className="homepage-container d-md-none p-3">
        <h5 className="homepage-heading">Nyaste filmen</h5>
        <Card className="homepage-newest-movie mb-3">
          <Card.Img variant="top" src={newestMovie.img} />
          <Card.Body>
            <Card.Title className="homepage-heading-text">
              {newestMovie.title}
            </Card.Title>
            <Button
              variant="secondary"
              size="sm"
              className="me-2 homepage-btn homepage-btn-secondary"
              onClick={() => onNavigate("biljett")}
            >
              Biljett
            </Button>
            <Button
              variant="dark"
              size="sm"
              className="homepage-btn homepage-btn-dark"
              onClick={() => onNavigate("movie-detail")}
            >
              Info
            </Button>
          </Card.Body>
        </Card>

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
          onChange={(value: Date | Date[]) => {
            if (Array.isArray(value)) {
              setDate(value[0] || null);
            } else {
              setDate(value);
            }
          }}
          className="homepage-calendar"
          style={{ maxWidth: "220px" }}
          formatShortWeekday={(locale, date) => {
            const shortNames = [
              "sön",
              "mån",
              "tis",
              "ons",
              "tor",
              "fre",
              "lör",
            ];
            return shortNames[date.getDay()];
          }}
        />

        {/* Alla filmer */}
        <h5 className="homepage-heading">Alla filmer</h5>
        <Row
          xs={2}
          xl={4}
          className="homepage-movie-grid homepage-mobile-grid g-3"
        >
          {filteredMovies.map((movie, idx) => (
            <Col key={idx}>
              <Card className="homepage-movie-card h-100">
                <Card.Img variant="top" src={movie.img} />
                <Card.Body className="text-center">
                  {date ? (
                    movie.dates
                      .find((d) => d.date === date.toISOString().split("T")[0])
                      ?.times.map((time, i) => (
                        <Button
                          key={i}
                          variant="secondary"
                          size="sm"
                          className="me-2 homepage-btn homepage-btn-secondary"
                          onClick={() => onNavigate("biljett")}
                        >
                          {time}
                        </Button>
                      ))
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="me-2 homepage-btn homepage-btn-secondary"
                        onClick={() => onNavigate("biljett")}
                      >
                        Biljett
                      </Button>
                      <Button
                        variant="dark"
                        size="sm"
                        className="homepage-btn homepage-btn-dark"
                        onClick={() => onNavigate("movie-detail")}
                      >
                        Info
                      </Button>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

      {/* Desktopvy */}
      <Container
        fluid
        className="homepage-container d-none d-md-block"
        style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
      >
        <Row>
          <Col md={4} lg={3} className="sidebar p-1 mt-2 position-sticky">
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
              style={{ maxWidth: "220px" }}
              formatShortWeekday={(locale, date) => {
                const shortNames = [
                  "sön",
                  "mån",
                  "tis",
                  "ons",
                  "tor",
                  "fre",
                  "lör",
                ];
                return shortNames[date.getDay()];
              }}
            />
          </Col>

          <Col md={8} lg={9} className="p-4">
            <Row
              xs={1}
              sm={2}
              md={3}
              lg={4}
              className="homepage-movie-grid homepage-desktop-grid g-4"
            >
              {filteredMovies.map((movie, idx) => (
                <Col key={idx}>
                  <Card className="homepage-movie-card h-100">
                    <Card.Img variant="top" src={movie.img} />
                    <Card.Body className="text-center">
                      {date ? (
                        movie.dates
                          .find(
                            (d) => d.date === date.toISOString().split("T")[0]
                          )
                          ?.times.map((time, i) => (
                            <Button
                              key={i}
                              variant="secondary"
                              size="sm"
                              className="me-2 homepage-btn homepage-btn-secondary"
                              onClick={() => onNavigate("biljett")}
                            >
                              {time}
                            </Button>
                          ))
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="me-2 homepage-btn homepage-btn-secondary"
                            onClick={() => onNavigate("biljett")}
                          >
                            Biljett
                          </Button>
                          <Button
                            variant="dark"
                            size="sm"
                            className="homepage-btn homepage-btn-dark"
                            onClick={() => onNavigate("movie-detail")}
                          >
                            Info
                          </Button>
                        </>
                      )}
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
