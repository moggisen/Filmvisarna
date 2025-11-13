import { useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import "../styles/authpage.scss";

interface LoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function Login({ onSuccess, onBack }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string | undefined }>(
    {}
  );
  const [focused, setFocused] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleBlur = (field: keyof typeof formData) => {
    setFocused((prev) => ({ ...prev, [field]: true }));

    switch (field) {
      case "email":
        if (!formData.email.trim()) {
          setErrors((prev) => ({ ...prev, email: "E-post är obligatorisk" }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setErrors((prev) => ({ ...prev, email: "Ogiltig e-postadress" }));
        } else {
          setErrors((prev) => ({ ...prev, email: undefined }));
        }
        break;

      case "password":
        // Enklare validering för login - bara kolla att det inte är tomt
        if (!formData.password) {
          setErrors((prev) => ({
            ...prev,
            password: "Lösenord krävs",
          }));
        } else {
          setErrors((prev) => ({ ...prev, password: undefined }));
        }
        break;
    }
  };

  const handleInputChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.email || !formData.password) {
      setErrors((prev) => ({
        ...prev,
        general: "Fyll i både email och lösenord",
      }));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_email: formData.email,
          user_password_hash: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Fel email eller lösenord");
      }

      onSuccess();
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err.message }));
    } finally {
      setLoading(false);
    }
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
          Logga in
        </Card.Header>
        <Card.Body>
          {errors.general && (
            <div className="alert alert-danger py-2" role="alert">
              {errors.general}
            </div>
          )}

          <Form onSubmit={handleSubmit} className="auth-form">
            <Form.Group className="mb-2" controlId="email">
              <Form.Label>E-post</Form.Label>
              <Form.Control
                type="email"
                placeholder="du@example.com"
                autoComplete="username"
                value={formData.email}
                onChange={handleInputChange("email")}
                onBlur={() => handleBlur("email")}
                isInvalid={focused.email && !!errors.email}
                isValid={
                  focused.email && !errors.email && formData.email !== ""
                }
              />
              {focused.email && errors.email && (
                <Form.Control.Feedback type="invalid">
                  {errors.email}
                </Form.Control.Feedback>
              )}
            </Form.Group>

            <Form.Group className="mb-2" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                placeholder="Ange ditt lösenord"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange("password")}
                onBlur={() => handleBlur("password")}
                isInvalid={focused.password && !!errors.password}
              />
              {focused.password && errors.password && (
                <Form.Control.Feedback type="invalid">
                  {errors.password}
                </Form.Control.Feedback>
              )}
            </Form.Group>

            <div className="auth-btn-grid">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="auth-btn auth-btn-submit"
              >
                {loading ? "Skickar…" : "Logga in"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}
