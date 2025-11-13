// ProfilePage
import { useState, useEffect } from "react";
import {
  Button,
  Card,
  ListGroup,
  Modal,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import type { BookingSummary } from "./types";
import "../styles/ConfirmationAndProfile.scss";

interface ProfilePageProps {
  bookings: BookingSummary[];
  onBack: () => void;
  onCancel: (bookingId: string) => void;
}

// Lägg till dessa typer för platsinformation
type SeatDetailedRow = {
  seat_id: number;
  ticketType_id: number;
  row_index: number; // 1 = rad A, 2 = rad B, etc
  seat_number: number; // stolnumret i den raden
  ticketType_name: string;
  ticketType_price: number;
};

interface UserBooking {
  id: number;
  booking_confirmation: string;
  booking_time: string;
  screening_time: string;
  movie_title: string;
  auditorium_name: string;
  total_price: number;
  seats: SeatDetailedRow[]; // Uppdatera till den detaljerade typen
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
  }).format(n);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE");
  const time = d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

// helper: gör om row_index (1,2,3...) till A,B,C...
function rowIndexToLetter(rowIndex: number): string {
  const baseCharCode = "A".charCodeAt(0);
  return String.fromCharCode(baseCharCode + (rowIndex - 1));
}

// Funktion för att kolla om en bokning går att avboka (mer än 1 timme kvar)
function canCancelBooking(screeningTime: string): boolean {
  const now = new Date();
  const screeningDate = new Date(screeningTime);
  const timeDiff = screeningDate.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  return hoursDiff > 1;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toCancel, setToCancel] = useState<UserBooking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showBackButton, setShowBackButton] = useState(false);

  // Only shows the "← Tillbaka"-button on the bottom if there is enough content that the user has to scroll
  useEffect(() => {
    const checkScroll = () => {
      const scrolledFromTop = window.scrollY;
      const viewportHeight = window.innerHeight;

      // adjusting how much you need to be able to scroll before the button at the bottom displays
      const scrollThreshold = viewportHeight * 0.2; // 1 = 1 viewport height

      setShowBackButton(scrolledFromTop > scrollThreshold);
    };

    window.addEventListener("scroll", checkScroll);
    checkScroll();

    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  useEffect(() => {
    async function fetchUserBookings() {
      try {
        const response = await fetch("/api/user/bookings", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();

          // För varje bokning, hämta detaljerad platsinformation
          const bookingsWithDetailedSeats = await Promise.all(
            data.map(async (booking: any) => {
              try {
                const seatsResponse = await fetch(
                  `/api/bookings/${booking.id}/seatsDetailed`
                );
                if (seatsResponse.ok) {
                  const detailedSeats: SeatDetailedRow[] =
                    await seatsResponse.json();
                  return {
                    ...booking,
                    seats: detailedSeats,
                  };
                }
              } catch (error) {
                console.error("Kunde inte hämta detaljerad platsinfo:", error);
              }
              return booking; // Fallback till originaldata om det misslyckas
            })
          );

          setUserBookings(bookingsWithDetailedSeats);
        } else {
          console.error("Kunde inte hämta bokningar");
        }
      } catch (error) {
        console.error("Fel vid hämtning av bokningar: ", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserBookings();
  }, []);

  const handleCancelBooking = async (bookingId: number) => {
    setCancelLoading(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setUserBookings((prev) =>
          prev.filter((booking) => booking.id !== bookingId)
        );
        console.log("Avbokning lyckades");
      } else {
        const errorData = await response.json();
        console.error("Kunde inte avboka:", errorData.error);
        alert(
          "Kunde inte avboka bokningen: " + (errorData.error || "Okänt fel")
        );
      }
    } catch (error) {
      console.error("Fel vid avbokning: ", error);
      alert("Ett fel uppstod vid avbokning. Försök igen.");
    } finally {
      setCancelLoading(false);
      setToCancel(null);
    }
  };

  // Funktion för att formatera platslistan som "A7, A8, B12"
  const formatSeatList = (seats: SeatDetailedRow[]): string => {
    return seats
      .slice()
      .sort((a, b) => {
        if (a.row_index !== b.row_index) {
          return a.row_index - b.row_index;
        }
        return a.seat_number - b.seat_number;
      })
      .map((seat) => `${rowIndexToLetter(seat.row_index)}${seat.seat_number}`)
      .join(", ");
  };

  // Separate bookings in coming screenings and past screenings based on time of showing
  const now = new Date();
  const upcomingBookings = userBookings.filter((booking) => {
    const screeningDate = new Date(booking.screening_time);
    return screeningDate > now;
  });

  const pastBookings = userBookings.filter((booking) => {
    const screeningDate = new Date(booking.screening_time);
    return screeningDate <= now;
  });

  if (loading) {
    return <div className="container py-4 text-white">Laddar...</div>;
  }

  return (
    <div className="mobile-shell profile-page">
      <Button
        variant="primary"
        size="sm"
        className="auth-btn auth-btn-back d-block mx-auto"
        onClick={onBack}
      >
        ← Tillbaka
      </Button>

      {/* Kommande visningar */}
      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Kommande visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {upcomingBookings.length === 0 ? (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga kommande bokningar.
            </ListGroup.Item>
          ) : (
            upcomingBookings.map((booking) => {
              const canCancel = canCancelBooking(booking.screening_time);

              return (
                <ListGroup.Item
                  key={booking.id}
                  className="bg-secondary border-primary text-info d-flex justify-content-between align-items-start py-4"
                >
                  <div>
                    <div className="fw-semibold">{booking.movie_title}</div>
                    <div className="small text-info">
                      {formatDateTime(booking.screening_time)}
                    </div>
                    <div className="small text-info">
                      Salong: {booking.auditorium_name}
                    </div>
                    <div className="small text-info">
                      Platser: {formatSeatList(booking.seats)}
                      {booking.seats[0]?.ticketType_name && (
                        <span>
                          {" "}
                          (
                          {booking.seats
                            .map((seat) => seat.ticketType_name)
                            .join(", ")}
                          )
                        </span>
                      )}
                    </div>
                    <div className="small text-info">
                      Bokningsnummer:{" "}
                      {booking.booking_confirmation.slice(0, 6).toUpperCase()}
                    </div>
                    {!canCancel && (
                      <div className="small text-warning mt-1">
                        Kan inte avbokas (mindre än 1 timme kvar)
                      </div>
                    )}
                  </div>
                  <div className="text-end">
                    <div className="fw-semibold">
                      {formatPrice(booking.total_price)}
                    </div>
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip>
                          {canCancel
                            ? "Avboka denna visning"
                            : "Går inte att avboka mindre än 1 timme före visning"}
                        </Tooltip>
                      }
                    >
                      <span>
                        <Button
                          size="sm"
                          variant={canCancel ? "dark" : "secondary"}
                          className={`border-light mt-2 ${
                            !canCancel ? "text-danger" : ""
                          }`}
                          onClick={() => canCancel && setToCancel(booking)}
                          disabled={cancelLoading || !canCancel}
                        >
                          Avboka
                        </Button>
                      </span>
                    </OverlayTrigger>
                  </div>
                </ListGroup.Item>
              );
            })
          )}
        </ListGroup>
      </Card>

      {/* Tidigare visningar */}
      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Tidigare visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {pastBookings.length === 0 ? (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga tidigare bokningar.
            </ListGroup.Item>
          ) : (
            pastBookings.map((booking) => (
              <ListGroup.Item
                key={booking.id}
                className="bg-secondary border-primary text-info d-flex justify-content-between align-items-start py-4"
              >
                <div>
                  <div className="fw-semibold">{booking.movie_title}</div>
                  <div className="small text-info">
                    {formatDateTime(booking.screening_time)}
                  </div>
                  <div className="small text-info">
                    Salong: {booking.auditorium_name}
                  </div>
                  <div className="small text-info">
                    Platser: {formatSeatList(booking.seats)}
                    {booking.seats[0]?.ticketType_name && (
                      <span>
                        {" "}
                        (
                        {booking.seats
                          .map((seat) => seat.ticketType_name)
                          .join(", ")}
                        )
                      </span>
                    )}
                  </div>
                  <div className="small text-info">
                    Bokningsnummer:{" "}
                    {booking.booking_confirmation.slice(0, 6).toUpperCase()}
                  </div>
                </div>
                <div className="text-end">
                  <div className="fw-semibold">
                    {formatPrice(booking.total_price)}
                  </div>
                </div>
              </ListGroup.Item>
            ))
          )}
        </ListGroup>
      </Card>

      {showBackButton && (
        <Button
          variant="primary"
          size="sm"
          className="auth-btn auth-btn-back d-block mx-auto"
          onClick={onBack}
        >
          ← Tillbaka
        </Button>
      )}

      {/* Avbokningsmodal */}
      <Modal show={!!toCancel} onHide={() => setToCancel(null)} centered>
        <Modal.Header closeButton className="bg-primary border-dark text-info">
          <Modal.Title>Avboka visning</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-secondary border-dark text-info">
          Är du säker på att du vill avboka?
          <br />
          <strong>Detta val går ej att ångra.</strong>
          {toCancel && (
            <div className="mt-3 small text-info">
              <div>
                Film: <span className="text-info">{toCancel.movie_title}</span>
              </div>
              <div>
                Föreställning:{" "}
                <span className="text-info">
                  {formatDateTime(toCancel.screening_time)}
                </span>
              </div>
              <div>
                Platser:{" "}
                <span className="text-info">
                  {formatSeatList(toCancel.seats)}
                  {toCancel.seats[0]?.ticketType_name && (
                    <span>
                      {" "}
                      (
                      {toCancel.seats
                        .map((seat) => seat.ticketType_name)
                        .join(", ")}
                      )
                    </span>
                  )}
                </span>
              </div>
              <div>
                Bokningsnummer:{" "}
                <span className="text-info">
                  {toCancel.booking_confirmation}
                </span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-primary border-dark d-flex justify-content-center">
          <Button
            variant="secondary"
            className="border-dark"
            onClick={() => setToCancel(null)}
            disabled={cancelLoading}
          >
            Nej, avbryt
          </Button>
          <Button
            variant="dark"
            className="border-light"
            onClick={() => {
              if (toCancel) {
                handleCancelBooking(toCancel.id);
              }
            }}
            disabled={cancelLoading}
          >
            {cancelLoading ? "Avbokar..." : "Ja, avboka"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
