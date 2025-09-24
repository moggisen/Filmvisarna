import { useState, useEffect } from "react";
import { Container, Navbar, Nav, Button, Card, Form } from "react-bootstrap";
import "../styles/App.css";

// ------------------------------------------------------------
// Endast Auth (login/signup)
// ------------------------------------------------------------

// Routes: bara login och signup
type Route = { name: "login" | "signup" | "home" };

export default function Auth() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [authed, setAuthed] = useState(false);

  //   // Tema (mörkt)
  //   useEffect(() => {
  //     document.documentElement.setAttribute("data-bs-theme", "dark");
  //   }, []);

  return (
    <div className="bg-black min-vh-100 min-vw-100 text-white pb-5">
      <HeaderBar onHome={() => setRoute({ name: "home" })} />

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

// ---------- Header ----------
function HeaderBar({ onHome }: { onHome: () => void }) {
  return (
    <Navbar bg="dark" variant="dark" className="border-bottom" sticky="top">
      <Container>
        <Navbar.Brand role="button" onClick={onHome}>
          <span className="text-primary fw-bold">FILM</span>
          <span className="text-danger">VISARNA</span>
        </Navbar.Brand>
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
  onNavigate: (name: "home" | "login" | "signup") => void;
  onLogout: () => void;
}) {
  return (
    <Navbar bg="dark" variant="dark" fixed="bottom" className="border-top">
      <Nav className="mx-auto gap-3">
        <Nav.Item>
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => onNavigate("home")}
          >
            🏠 Hem
          </Button>
        </Nav.Item>
        {!authed ? (
          <>
            <Nav.Item>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("login")}
              >
                🔐 Logga in
              </Button>
            </Nav.Item>
            <Nav.Item>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate("signup")}
              >
                ✨ Bli medlem
              </Button>
            </Nav.Item>
          </>
        ) : (
          <Nav.Item>
            <Button variant="outline-danger" size="sm" onClick={onLogout}>
              ⎋ Logga ut
            </Button>
          </Nav.Item>
        )}
      </Nav>
    </Navbar>
  );
}

// ---------- Auth (login/signup) ----------
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
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
      <Card className="custom-container bg-dark border-secondary">
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
                  <Form.Label>Upprepa lösenord</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    minLength={8}
                    placeholder="Minst 8 tecken"
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="pwd2">
                  <Form.Label>Namn</Form.Label>
                  <Form.Control type="Name" required placeholder="Jens" />
                </Form.Group>
                <Form.Group className="mb-3" controlId="pwd2">
                  <Form.Label>Telefonnummer</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    minLength={10}
                    placeholder="070 555 5454"
                  />
                </Form.Group>
              </>
            )}
            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
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
    </>
  );
}
