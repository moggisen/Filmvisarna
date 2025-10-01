import { useState } from "react";
import { Button, Card, ListGroup, Modal } from "react-bootstrap";
import type { BookingSummary } from "./types";

interface ProfilePageProps {
  bookings: BookingSummary[];
  onBack: () => void;
  onCancel: (bookingId: string) => void;
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

export default function ProfilePage({
  bookings,
  onBack,
  onCancel,
}: ProfilePageProps) {
  const [toCancel, setToCancel] = useState<BookingSummary | null>(null);
  const now = Date.now();

  const upcoming = bookings
    .filter((b) => Date.parse(b.showtime) >= now)
    .sort((a, b) => Date.parse(a.showtime) - Date.parse(b.showtime));

  const past = bookings
    .filter((b) => Date.parse(b.showtime) < now)
    .sort((a, b) => Date.parse(b.showtime) - Date.parse(a.showtime));

  return (
    <div className="mobile-shell">
      <Button
        variant="primary"
        size="sm"
        className="mb-3 d-block mx-auto text-dark border-dark py-2 px-5"
        onClick={onBack}
      >
        Tillbaka
      </Button>

      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Kommande visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {upcoming.length === 0 && (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga kommande bokningar.
            </ListGroup.Item>
          )}
          {upcoming.map((b) => (
            <ListGroup.Item
              key={b.bookingId}
              className="bg-secondary border-primary text-info d-flex justify-content-between align-items-start py-4"
            >
              <div>
                <div className="fw-semibold">{b.movieTitle}</div>
                <div className="small text-info">
                  {formatDateTime(b.showtime)}
                </div>
                <div className="small text-info">
                  Platser:{" "}
                  {b.seats.map((s) => `${s.row}${s.number}`).join(", ")}
                </div>
                <div className="small text-info">ID: {b.bookingId}</div>
              </div>
              <div className="text-end">
                <div className="fw-semibold">{formatPrice(b.total)}</div>
                <Button
                  size="sm"
                  variant="dark"
                  className="border-light mt-2"
                  onClick={() => setToCancel(b)}
                >
                  Avboka
                </Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>

      <Card className="bg-secondary border-primary my-5">
        <Card.Header as="h6">Tidigare visningar</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          {past.length === 0 && (
            <ListGroup.Item className="bg-secondary border-primary text-info py-4">
              Inga tidigare bokningar.
            </ListGroup.Item>
          )}
          {past.map((b) => (
            <ListGroup.Item
              key={b.bookingId}
              className="bg-secondary border-primary text-info d-flex justify-content-between py-4"
            >
              <div>
                <div className="fw-semibold">{b.movieTitle}</div>
                <div className="small text-info">
                  {formatDateTime(b.showtime)}
                </div>
              </div>
              <div className="text-end">
                <div className="fw-semibold">{formatPrice(b.total)}</div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>

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
                Film: <span className="text-info">{toCancel.movieTitle}</span>
              </div>
              <div>
                Föreställning:{" "}
                <span className="text-info">
                  {formatDateTime(toCancel.showtime)}
                </span>
              </div>
              <div>
                Platser:{" "}
                <span className="text-info">
                  {toCancel.seats.map((s) => `${s.row}${s.number}`).join(", ")}
                </span>
              </div>
              <div>
                ID: <span className="text-info">{toCancel.bookingId}</span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-primary border-dark d-flex justify-content-center">
          <Button
            variant="secondary"
            className="border-dark"
            onClick={() => setToCancel(null)}
          >
            Nej, avbryt
          </Button>
          <Button
            variant="dark"
            className="border-light"
            onClick={() => {
              if (toCancel) {
                onCancel(toCancel.bookingId);
                setToCancel(null);
              }
            }}
          >
            Ja, avboka
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
