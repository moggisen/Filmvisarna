import { useState } from "react";
import { Container, Navbar, Nav, Button, Card, Form } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";

// ------------------------------------------------------------
// Endast Auth (login/signup)
// ------------------------------------------------------------

// Routes: bara login och signup
type Route = { name: "login" | "biljett" | "signup" | "home" };

export default function Auth() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [authed, setAuthed] = useState(false);

  return (
    <div className="main-container min-vh-100 min-vw-100 text-white pb-5">
      <HeaderBar
        authed={authed}
        onNavigate={(name) => setRoute({ name })}
        onLogout={() => setAuthed(false)}
        onHome={() => setRoute({ name: "home" })}
      />

      <Container className="pt-3 pb-5">
        {route.name === "login" && (
          <AuthPage
            mode="login"
            onSuccess={() => {
              setAuthed(true);
              setRoute({ name: "home" });
            }}
            onBack={() => setRoute({ name: "home" })}
          />
        )}
        {route.name === "signup" && (
          <AuthPage
            mode="signup"
            onSuccess={() => {
              setAuthed(true);
              setRoute({ name: "home" });
            }}
            onBack={() => setRoute({ name: "home" })}
          />
        )}
        {route.name === "home" && (
          <p className="text-center text-secondary mt-5">
            👋 Välkommen! Använd menyn längst ner för att logga in eller skapa
            konto.
          </p>
        )}
      </Container>

      <BottomNav
        authed={authed}
        onNavigate={(name) => setRoute({ name })}
        onLogout={() => setAuthed(false)}
      />
    </div>
  );
}

// ---------- Gemensam Navigation-komponent ----------
function NavigationButtons({
  authed,
  onNavigate,
  onLogout,
  className = "",
}: {
  authed: boolean;
  onNavigate: (name: "home" | "biljett" | "login" | "signup") => void;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <Nav className={className}>
      <Nav.Item>
        <Button
          className="home-btn nav-btn"
          size="sm"
          variant="outline-light"
          onClick={() => onNavigate("home")}
        >
          🏠 Hem
        </Button>
      </Nav.Item>
      <Nav.Item>
        <Button
          className="biljett-btn nav-btn"
          size="sm"
          variant="outline-light"
          onClick={() => onNavigate("biljett")}
        >
          🎫 Biljett
        </Button>
      </Nav.Item>
      {!authed ? (
        <>
          <Nav.Item>
            <Button
              className="login-btn nav-btn"
              size="sm"
              variant="outline-light"
              onClick={() => onNavigate("login")}
            >
              🔐 Logga in
            </Button>
          </Nav.Item>
          <Nav.Item>
            <Button
              className="signup-btn nav-btn"
              size="sm"
              variant="outline-light"
              onClick={() => onNavigate("signup")}
            >
              ✨ Bli medlem
            </Button>
          </Nav.Item>
        </>
      ) : (
        <Nav.Item>
          <Button
            className="logout-btn nav-btn"
            size="sm"
            variant="outline-light"
            onClick={onLogout}
          >
            ⎋ Logga ut
          </Button>
        </Nav.Item>
      )}
    </Nav>
  );
}

// ---------- Header ----------
function HeaderBar({
  authed,
  onNavigate,
  onLogout,
  onHome,
}: {
  authed: boolean;
  onNavigate: (name: "home" | "biljett" | "login" | "signup") => void;
  onLogout: () => void;
  onHome: () => void;
}) {
  return (
    <Navbar className="bg-primary logo-text" sticky="top">
      <Container>
        <Navbar.Brand role="button" className="top-nav" onClick={onHome}>
          <span className="text-light logo-text">FILMVISARNA</span>
        </Navbar.Brand>

        {/* Desktop navigation - visas bara på större skärmar */}
        <div className="d-none d-md-block">
          <NavigationButtons
            authed={authed}
            onNavigate={onNavigate}
            onLogout={onLogout}
            className="top-nav-buttons"
          />
        </div>
      </Container>
    </Navbar>
  );
}

// ---------- Bottom nav ----------
function BottomNav({
  authed,
  onNavigate,
  onLogout,
}: {
  authed: boolean;
  onNavigate: (name: "home" | "biljett" | "login" | "signup") => void;
  onLogout: () => void;
}) {
  return (
    <Navbar fixed="bottom" className="bg-primary bottom-nav d-md-none">
      <NavigationButtons
        authed={authed}
        onNavigate={onNavigate}
        onLogout={onLogout}
        className="mx-auto"
      />
    </Navbar>
  );
}

// ---------- Auth (login/signup) ----------
// (AuthPage-komponenten förblir oförändrad)
function AuthPage({
  mode,
  onSuccess,
  onBack,
}: {
  mode: "login" | "signup";
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");

  const handleClose = () => {
    setShow(false);
    onSuccess();
  };
  const handleShow = () => setShow(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (mode === "signup") {
        setShow(true);
      } else {
        onSuccess(); // login går direkt
      }
    }, 700);
  }

  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        className="mb-3"
        onClick={onBack}
      >
        ← Tillbaka
      </Button>
      <Card className="custom-container bg-secondary">
        <Card.Header as="h6">
          {mode === "login" ? "Logga in" : "Bli medlem"}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={submit}>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="du@example.com"
                autoComplete="username"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                required
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
                  <Form.Control type="password" required minLength={8} />
                </Form.Group>
                <Form.Group className="mb-3" controlId="name">
                  <Form.Label>Namn</Form.Label>
                  <Form.Control
                    type="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="number">
                  <Form.Label>Telefonnummer</Form.Label>
                  <Form.Control
                    type="password"
                    minLength={10}
                    placeholder="070 555 5454"
                  />
                </Form.Group>
              </>
            )}
            <div className="d-grid gap-2">
              <Button
                type="submit"
                variant="primary"
                onClick={mode === "login" ? onSuccess : handleShow}
                disabled={loading}
                className="sign-up-submit"
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
        className="modal-container"
        show={show}
        onHide={handleClose}
        animation={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
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
          <p>Tack för att du blev medlem hos Filmvisarna!</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Stäng
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
