import { useState, useEffect } from "react";
import { Button, Card, ListGroup, Modal } from "react-bootstrap";
import type { BookingSummary } from "./types";
import "../styles/ConfirmationAndProfile.scss";

interface ProfilePageProps {
  bookings: BookingSummary[];
  onBack: () => void;
  onCancel: (bookingId: string) => void;
}

interface UserBooking {
  id: number;
  booking_confirmation: string;
  booking_time: string;
  screening_time: string;
  movie_title: string;
  auditorium_name: string;
  total_price: number;
  seats: Array<{
    seat_id: number;
    ticketType_name: string;
    ticketType_price: number;
  }>;
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

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toCancel, setToCancel] = useState<UserBooking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    async function fetchUserBookings() {
      try {
        const response = await fetch("/api/user/bookings", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUserBookings(data);
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
        // Uppdatera listan genom att ta bort den avbokade bokningen
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
        className="mb-3 d-block mx-auto text-info border-dark py-2 px-5"
        onClick={onBack}
      >
        Tillbaka
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
            upcomingBookings.map((booking) => (
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
                    Platser:{" "}
                    {booking.seats
                      .map(
                        (seat) =>
                          `Stol ${seat.seat_id} (${seat.ticketType_name})`
                      )
                      .join(", ")}
                  </div>
                  <div className="small text-info">
                    Bokningsnummer: {booking.booking_confirmation}
                  </div>
                </div>
                <div className="text-end">
                  <div className="fw-semibold">
                    {formatPrice(booking.total_price)}
                  </div>
                  <Button
                    size="sm"
                    variant="dark"
                    className="border-light mt-2"
                    onClick={() => setToCancel(booking)}
                    disabled={cancelLoading}
                  >
                    Avboka
                  </Button>
                </div>
              </ListGroup.Item>
            ))
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
                    Platser:{" "}
                    {booking.seats
                      .map(
                        (seat) =>
                          `Stol ${seat.seat_id} (${seat.ticketType_name})`
                      )
                      .join(", ")}
                  </div>
                  <div className="small text-info">
                    Bokningsnummer: {booking.booking_confirmation}
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

      <Button
        variant="primary"
        size="sm"
        className="mb-3 d-block mx-auto text-info border-dark py-2 px-5"
        onClick={onBack}
      >
        Tillbaka
      </Button>

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
                  {toCancel.seats
                    .map(
                      (seat) => `Stol ${seat.seat_id} (${seat.ticketType_name})`
                    )
                    .join(", ")}
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
