import { useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import "../styles/authpage.scss";

interface AuthPageProps {
  mode: "login" | "signup";
  onSuccess: () => void;
  onBack: () => void;
}

const validateForm = (
  mode: "login" | "signup",
  email: string,
  password: string,
  password2: string
): string | null => {
  if (!email || !password) {
    return "Fyll i både email och lösenord.";
  }

  if (mode === "signup" && password !== password2) {
    return "Lösenorden matchar inte";
  }

  return null;
};

export default function AuthPage({ mode, onSuccess, onBack }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    password2: "",
    name: "",
    phone: "",
  });

  const handleInputChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validationError = validateForm(
      mode,
      formData.email,
      formData.password,
      formData.password2
    );
    if (validationError) {
      alert(validationError);
      setLoading(false);
      return;
    }

    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";

      const body =
        mode === "login"
          ? {
              user_email: formData.email,
              user_password_hash: formData.password,
            }
          : {
              user_email: formData.email,
              user_password_hash: formData.password,
              ...(formData.name && { user_name: formData.name }),
              ...(formData.phone && { user_phoneNumber: formData.phone }),
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Något gick fel");
      }

      if (mode === "signup") {
        setShowModal(true);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    onSuccess(); // ✅ Anropa onSuccess direkt - navigering hanteras i App.tsx
  };

  const isLoginMode = mode === "login";
  const submitButtonText = loading
    ? "Skickar…"
    : isLoginMode
    ? "Logga in"
    : "Bli medlem";

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
          {isLoginMode ? "Logga in" : "Bli medlem"}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit} className="auth-form">
            <Form.Group className="mb-2" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                placeholder="du@example.com"
                autoComplete="username"
                value={formData.email}
                onChange={handleInputChange("email")}
              />
            </Form.Group>

            <Form.Group className="mb-2" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                minLength={8}
                placeholder="Minst 8 tecken"
                autoComplete={isLoginMode ? "current-password" : "new-password"}
                value={formData.password}
                onChange={handleInputChange("password")}
              />
            </Form.Group>

            {!isLoginMode && (
              <>
                <Form.Group className="mb-2" controlId="pwd2">
                  <Form.Label>Verifiera lösenord</Form.Label>
                  <Form.Control
                    type="password"
                    minLength={8}
                    value={formData.password2}
                    onChange={handleInputChange("password2")}
                  />
                </Form.Group>
                <Form.Group className="mb-2" controlId="name">
                  <Form.Label>Namn</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange("name")}
                  />
                </Form.Group>
                <Form.Group className="mb-2" controlId="number">
                  <Form.Label>Telefonnummer</Form.Label>
                  <Form.Control
                    type="tel"
                    minLength={10}
                    placeholder="070 555 5454"
                    value={formData.phone}
                    onChange={handleInputChange("phone")}
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
                {submitButtonText}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Modal
        className="auth-modal"
        show={showModal}
        onHide={handleCloseModal}
        animation={false}
        backdropClassName="auth-modal-backdrop"
      >
        <Modal.Header closeButton>
          <Modal.Title className="auth-heading-text">
            {formData.name ? (
              <>
                Välkommen, <strong>{formData.name}</strong>!
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
            onClick={handleCloseModal}
            className="auth-btn auth-btn-modal"
          >
            Fortsätt
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
