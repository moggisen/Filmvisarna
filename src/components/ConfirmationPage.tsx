import { Alert, Card, ListGroup, Button } from "react-bootstrap";
import "../styles/ConfirmationAndProfile.scss";

interface ConfirmationPageProps {
  onDone: () => void;
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

export default function ConfirmationPage({ onDone }: ConfirmationPageProps) {
  // Mock data för bekräftelse
  const mockSummary = {
    bookingId: "M-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    movieTitle: "Avengers: Endgame",
    showtime: new Date().toISOString(),
    tickets: { vuxen: 2, barn: 0, pensionar: 0 },
    seats: [
      { row: "C", number: 7 },
      { row: "C", number: 8 },
    ],
    total: 280,
  };

  return (
    <div className="mobile-shell">
      <Alert variant="success" className="mb-3">
        <Alert.Heading className="h5">Bokning bekräftad!</Alert.Heading>
        <p className="text-center mb-0">
          Ditt boknings-ID är <strong>{mockSummary.bookingId}</strong>.
        </p>
      </Alert>

      <Card className="bg-secondary mb-3">
        <Card.Header as="h6">Din bokning</Card.Header>
        <ListGroup variant="flush" className="bg-secondary">
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Film</span> <span>{mockSummary.movieTitle}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Föreställning</span>{" "}
            <span>{formatDateTime(mockSummary.showtime)}</span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Biljetter</span>
            <span>
              {mockSummary.tickets.vuxen} vuxen, {mockSummary.tickets.barn}{" "}
              barn, {mockSummary.tickets.pensionar} pensionär
            </span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Platser</span>
            <span>
              {mockSummary.seats.map((s) => `${s.row}${s.number}`).join(", ")}
            </span>
          </ListGroup.Item>
          <ListGroup.Item className="bg-secondary border-primary d-flex justify-content-between">
            <span>Pris</span> <strong>{formatPrice(mockSummary.total)}</strong>
          </ListGroup.Item>
        </ListGroup>
      </Card>

      <div className="text-center">
        <Button
          variant="primary"
          size="sm"
          className="border-dark text-dark"
          onClick={onDone}
        >
          Till startsidan
        </Button>
      </div>
    </div>
  );
}
