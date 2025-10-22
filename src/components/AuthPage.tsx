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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup" && password !== password2) {
      alert("Lösenorden matchar inte");
      setLoading(false);
      return;
    }

    // Basic validation
    if (!email || !password) {
      alert("Fyll i både email och lösenord.");
      setLoading(false);
      return;
    }

    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const body: any = { user_email: email };

      if (mode === "signup") {
        if (password) body.user_password_hash = password;
        if (name) body.user_name = name;
        if (phone) body.user_phoneNumber = phone;
      } else {
        body.user_password_hash = password;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      console.log("signup response: ", data);

      console.log(data.error);
      if (!res.ok || data.error)
        throw new Error(data.error || "Något gick fel");

      if ((mode === "signup" && data.success) || data.message) {
        setShow(true);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
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

      <Card className="auth-container auth-card auth-page">
        <Card.Header as="h6" className="auth-heading-text">
          {mode === "login" ? "Logga in" : "Bli medlem"}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit} className="auth-form">
            <Form.Group className="mb-2" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                placeholder="du@example.com"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-2" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                minLength={8}
                placeholder="Minst 8 tecken"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>

            {mode === "signup" && (
              <>
                <Form.Group className="mb-2" controlId="pwd2">
                  <Form.Label>Verifiera lösenord</Form.Label>
                  <Form.Control
                    type="password"
                    minLength={8}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-2" controlId="name">
                  <Form.Label>Namn</Form.Label>
                  <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-2" controlId="number">
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
