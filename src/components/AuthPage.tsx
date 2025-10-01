import { useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import "../styles/authpage.scss";

interface AuthPageProps {
  mode: "login" | "signup";
  onSuccess: () => void;
  onBack: () => void;
}

export default function AuthPage({ mode, onSuccess, onBack }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      mode === "signup" ? setShow(true) : onSuccess();
    }, 700);
  };

  const handleClose = () => {
    setShow(false);
    onSuccess();
  };

  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        className="auth-btn auth-btn-back"
        onClick={onBack}
      >
        ← Tillbaka
      </Button>

      <Card className="auth-container auth-card">
        <Card.Header as="h6" className="auth-heading-text">
          {mode === "login" ? "Logga in" : "Bli medlem"}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit} className="auth-form">
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                placeholder="du@example.com"
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                minLength={8}
                placeholder="Minst 8 tecken"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Form.Group>

            {mode === "signup" && (
              <>
                <Form.Group className="mb-3" controlId="pwd2">
                  <Form.Label>Verifiera lösenord</Form.Label>
                  <Form.Control type="password" minLength={8} />
                </Form.Group>
                <Form.Group className="mb-3" controlId="name">
                  <Form.Label>Namn</Form.Label>
                  <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="number">
                  <Form.Label>Telefonnummer</Form.Label>
                  <Form.Control
                    type="tel"
                    minLength={10}
                    placeholder="070 555 5454"
                  />
                </Form.Group>
              </>
            )}

            <div className="auth-btn-grid">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="auth-btn auth-btn-submit"
              >
                {loading
                  ? "Skickar…"
                  : mode === "login"
                  ? "Logga in"
                  : "Bli medlem"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Modal
        className="auth-modal"
        show={show}
        onHide={handleClose}
        animation={false}
        backdropClassName="auth-modal-backdrop"
      >
        <Modal.Header closeButton>
          <Modal.Title className="auth-heading-text">
            {name ? (
              <>
                Välkommen, <strong>{name}</strong>!
              </>
            ) : (
              "Välkommen!"
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="auth-body-text">
            Tack för att du blev medlem hos Filmvisarna!
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={handleClose}
            className="auth-btn auth-btn-modal"
          >
            Stäng
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
