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

// Static image imports (these should be moved to the /public folder for production deployment)
import spidermarathonImg from "../assets/banners/spidermanmarathon.png";
import guardianmarathonImg from "../assets/banners/guardianmarathon.png";
import carousel1Img from "../assets/banners/deadpool.jpg";
import carousel2Img from "../assets/banners/ironMan2013.jpg";
import carousel3Img from "../assets/banners/venom2018.jpg";
import AgeTooltip from "../components/ageTooltip";

// Route imports for navigation
import { routePath, buildPath } from "../routes";
import type { RouteKey } from "../routes";

// INTERFACES (Data Structures)
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
  type: string;
  date: string;
  img: string;
}

// MovieGrid Component
// Component responsible for rendering the movie cards in a grid layout
interface MovieGridProps {
  movies: (Movie & { times?: string[] })[];
  onNavigate: (route: RouteKey, movieId?: number) => void;
}
// Hantering av moviegrid kortet
const MovieGrid = ({ movies, onNavigate }: MovieGridProps) => (
  // Bootstrap Row setup: 2 columns on extra small screens, 4 columns on extra large screens
  <Row xs={2} xl={4} className="homepage-movie-grid g-3 mb-5">
    {movies.map((movie) => (
      <Col key={movie.id}>
        <Card className="homepage-movie-card h-100 d-flex flex-column">
          <Card.Img variant="top" src={`src/${movie.movie_banner}`} />
          <div className="movie-title-wrapper text-center mt-2 mb-2">
            {movie.movie_title}
          </div>
          <Card.Body className="text-center mt-auto">
            {/* Button to navigate to the booking page */}
            <Button
              variant="secondary"
              size="sm"
              className="me-2 homepage-btn homepage-btn-secondary"
              onClick={() => onNavigate("biljett", movie.id)}
            >
              Biljett
            </Button>
            {/* Button to navigate to the movie detail page */}
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

//  HomePage Component
export default function HomePage() {
  // State for all movies fetched from API
  const [movies, setMovies] = useState<Movie[]>([]);
  // State for all screenings fetched from API
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  // State for age filter ('all' or specific age limit)
  const [age, setAge] = useState<string>("all");
  // State for search input
  const [search, setSearch] = useState<string>("");
  // State for the date selected in the calendar
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // State for movies filtered by the selected date
  const [moviesForDate, setMoviesForDate] = useState<Movie[]>([]);

  const navigate = useNavigate(); // Hook for programmatic navigation

  // Function to handle all internal navigation
  const handleNavigate = (name: RouteKey, movieId?: number) => {
    if (name === "biljett" && movieId) {
      // Navigate to booking, passing the movie ID in the state (not URL)
      navigate(routePath.biljett, { state: { preselectedMovieId: movieId } });
    } else if (name === "movie-detail" && movieId) {
      // Logic for movie detail page navigation
      const target = buildPath("movie-detail", { id: movieId });
      try {
        localStorage.setItem("selectedMovieId", String(movieId));
      } catch {
        return;
      }
      navigate(target);
    } else {
      // Default navigation for other routes
      navigate(routePath[name] ?? routePath.home);
    }
  };

  // Effect to fetch all movies from the backend on component mount
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
  }, []); // Runs once on mount

  // Effect to fetch all screenings from the backend
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
        setLoading(false); // Stop loading after fetching screenings
      }
    };
    fetchScreenings();
  }, []); // Runs once on mount

  // Effect to filter movies based on the selected date
  useEffect(() => {
    if (!selectedDate) {
      setMoviesForDate([]); // Clear movies if no date is selected
      return;
    }

    const selectedDay = selectedDate.getDate();
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();

    // Find all screenings happening on the selected day
    const screeningsOnDate = screenings.filter((s) => {
      const screeningDate = new Date(s.screening_time);
      return (
        screeningDate.getDate() === selectedDay &&
        screeningDate.getMonth() === selectedMonth &&
        screeningDate.getFullYear() === selectedYear
      );
    });

    // Map movies to include screening times for the selected date
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
        if (times.length > 0) return { ...movie, times }; // Only return movies with times
        return null;
      })
      .filter(Boolean) as (Movie & { times: string[] })[];
    setMoviesForDate(filteredMovies);
  }, [selectedDate, screenings, movies]); // Reruns when date, screenings, or movies change

  // Filter movies based on the search term and age limit
  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.movie_title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesAge = age === "all" || movie.age_limit === parseInt(age);
    return matchesSearch && matchesAge;
  });

  // Hardcoded event data
  const events: Event[] = [
    {
      title: "Spider-Man Marathon",
      description: "Se alla Spider-Man filmer!",
      type: "marathon",
      date: "2025-10-15",
      img: spidermarathonImg,
    },
    {
      title: "Guardians of the Galaxy Marathon",
      description: "Alla Guardians-filmer back-to-back.",
      type: "marathon",
      date: "2025-10-20",
      img: guardianmarathonImg,
    },
  ];

  // Hardcoded newest movie data for the carousel
  const newestMoviesHardcoded = [
    { movie_id: 1, movie_title: "Deadpool", movie_poster: carousel1Img },
    { movie_id: 2, movie_title: "Iron Man 3", movie_poster: carousel2Img },
    { movie_id: 3, movie_title: "Venom", movie_poster: carousel3Img },
  ];

  // Show a loading spinner while fetching data
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="dark" />
      </div>
    );
  }

  return (
    <>
      {/* MOBILE VIEW */}
      <Container fluid className="d-md-none p-3">
        {/* Carousel for newest movies */}
        <Carousel variant="dark" className="homepage-newest-carousel mb-4">
          {newestMoviesHardcoded.map((movie) => (
            <Carousel.Item key={movie.movie_id}>
              {/* Image source from public folder (static import) */}
              <img
                className="d-block w-100"
                src={movie.movie_poster}
                alt={movie.movie_title}
                style={{ width: "100%", height: "auto" }}
              />
            </Carousel.Item>
          ))}
        </Carousel>

        {/* Upcoming events section */}
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

        {/* Age limit filter with tooltip */}
        <h5 className="homepage-heading d-flex align-items-center gap-2">
          Åldersgräns
          <AgeTooltip />
        </h5>
        <Form.Group className="homepage-form mb-3">
          <Form.Select value={age} onChange={(e) => setAge(e.target.value)}>
            {/* Age options */}
            <option value="all">Alla</option>
            <option value="7">7 år</option>
            <option value="11">11 år</option>
            <option value="15">15 år</option>
          </Form.Select>
        </Form.Group>

        {/* Search movie input */}
        <Form.Group className="homepage-form mb-3">
          <Form.Label>Sök film</Form.Label>
          <FormControl
            type="text"
            placeholder="Skriv titel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Form.Group>

        {/* Calendar for date selection */}
        <h5 className="homepage-heading">Välj datum</h5>
        <Calendar
          value={selectedDate}
          onChange={(value) => {
            if (value === null) {
              setSelectedDate(null);
            } else if (Array.isArray(value)) {
              // Logic for selecting the first date in the array (if multiple selection is possible)
              const newDate = value[0] || null;
              if (
                selectedDate &&
                newDate &&
                selectedDate.toDateString() === newDate.toDateString()
              ) {
                setSelectedDate(null); // Logic for single date selection
              } else {
                setSelectedDate(newDate);
              }
            } else {
              // Logic for single date selection
              if (
                selectedDate &&
                value &&
                selectedDate.toDateString() === value.toDateString()
              ) {
                setSelectedDate(null);
              } else {
                setSelectedDate(value); // Select new date
              }
            }
          }}
          className="homepage-calendar"
          // Custom short weekday format (Sön, Mån, Tis...)
          formatShortWeekday={(_, date) =>
            ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
          }
        />

        {/* Button to clear date filter (Show all movies) */}
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

        {/* Movie list rendering based on selected date */}
        {selectedDate ? (
          moviesForDate.length > 0 ? (
            <>
              <h5
                className="homepage-heading text-center"
                style={{ marginTop: "1.25rem", marginBottom: "1rem" }}
              >
                Filmer som går den {selectedDate.toLocaleDateString()}
              </h5>
              <MovieGrid movies={moviesForDate} onNavigate={handleNavigate} />
            </>
          ) : (
            // Message if no movies are found for the date
            <div className="text-center mt-4 mb-5">
              <p style={{ fontStyle: "italic", color: "#666" }}>
                Ingen film visas detta datum 🎬
              </p>
            </div>
          )
        ) : (
          // Render all filtered movies (by age/search) if no date is selected
          <>
            <h5
              className="homepage-heading text-center"
              style={{ marginTop: "1.25rem" }}
            >
              Alla filmer
            </h5>
            <MovieGrid movies={filteredMovies} onNavigate={handleNavigate} />
          </>
        )}
      </Container>

      {/* DESKTOP VIEW */}
      <Container
        fluid
        className="d-none d-md-block"
        style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
      >
        <Row>
          {/* SIDEBAR FILTER */}
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
            {/* Calendar for date selection in desktop */}
            <h5 className="homepage-heading">Välj datum</h5>
            <Calendar
              value={selectedDate}
              onChange={(value) => {
                if (value === null) {
                  setSelectedDate(null);
                } else if (Array.isArray(value)) {
                  const newDate = value[0] || null;
                  if (
                    selectedDate &&
                    newDate &&
                    selectedDate.toDateString() === newDate.toDateString()
                  ) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(newDate);
                  }
                } else {
                  if (
                    selectedDate &&
                    value &&
                    selectedDate.toDateString() === value.toDateString()
                  ) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(value);
                  }
                }
              }}
              className="homepage-calendar"
              formatShortWeekday={(_, date) =>
                ["sön", "mån", "tis", "ons", "tor", "fre", "lör"][date.getDay()]
              }
            />

            {/* Show all movies button in desktop sidebar */}
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

          {/* MOVIE LIST */}
          <Col md={8} lg={9} className="p-4">
            <h5 className="homepage-heading">
              {/* Dynamic title based on date selection */}
              {selectedDate
                ? `Filmer som går den ${selectedDate.toLocaleDateString()}`
                : "Alla filmer"}
            </h5>
            {/* Render movie grid based on date filter */}
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
