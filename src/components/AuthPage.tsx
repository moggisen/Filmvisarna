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
  passwordVerification: string
): string | null => {
  if (!email || !password) {
    return "Fyll i både email och lösenord.";
  }

  if (mode === "signup" && password !== passwordVerification) {
    return "Lösenorden matchar inte";
  }

  return null;
};

export default function AuthPage({ mode, onSuccess, onBack }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string | undefined }>(
    {}
  );
  const [focused, setFocused] = useState<{ [key: string]: boolean }>({});

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordVerification: "",
    name: "",
    phone: "",
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
        const password = formData.password;

        // regex: minst 8 tecken, minst 1 bokstav och 1 siffra
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

        if (!passwordRegex.test(password)) {
          setErrors((prev) => ({
            ...prev,
            password:
              "Lösenordet måste vara minst 8 tecken och innehålla minst en bokstav och en siffra",
          }));
        } else {
          setErrors((prev) => ({ ...prev, password: undefined }));
        }
        break;

      case "passwordVerification":
        if (formData.passwordVerification !== formData.password) {
          setErrors((prev) => ({
            ...prev,
            passwordVerification: "Lösenorden matchar inte",
          }));
        } else {
          setErrors((prev) => ({ ...prev, passwordVerification: undefined }));
        }
        break;

      case "phone":
        if (formData.phone && !/^(\+46|0)[\d\s-]{7,15}$/.test(formData.phone)) {
          setErrors((prev) => ({
            ...prev,
            phone: "Ange ett giltigt svenskt mobilnummer",
          }));
        } else {
          setErrors((prev) => ({ ...prev, phone: undefined }));
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

    const validationError = validateForm(
      mode,
      formData.email,
      formData.password,
      formData.passwordVerification
    );

    if (validationError) {
      setErrors((prev) => ({ ...prev, general: validationError }));
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
      console.log(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    onSuccess();
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
          {errors.general && (
            <div className="alert alert-danger py-2" role="alert">
              {errors.general}
            </div>
          )}

          <Form onSubmit={handleSubmit} className="auth-form">
            {/* E-post */}
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

            {/* Lösenord */}
            <Form.Group className="mb-2" controlId="pwd">
              <Form.Label>Lösenord</Form.Label>
              <Form.Control
                type="password"
                minLength={8}
                placeholder="Minst 8 tecken"
                autoComplete={isLoginMode ? "current-password" : "new-password"}
                value={formData.password}
                onChange={handleInputChange("password")}
                onBlur={() => handleBlur("password")}
                isInvalid={focused.password && !!errors.password}
                isValid={
                  focused.password &&
                  !errors.password &&
                  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(
                    formData.password
                  )
                }
              />
              {focused.password && errors.password && (
                <Form.Control.Feedback type="invalid">
                  {errors.password}
                </Form.Control.Feedback>
              )}
            </Form.Group>

            {/* Extra fält vid signup */}
            {!isLoginMode && (
              <>
                <Form.Group className="mb-2" controlId="pwd2">
                  <Form.Label>Verifiera lösenord</Form.Label>
                  <Form.Control
                    type="password"
                    minLength={8}
                    value={formData.passwordVerification}
                    onChange={handleInputChange("passwordVerification")}
                    onBlur={() => handleBlur("passwordVerification")}
                    isInvalid={
                      focused.passwordVerification &&
                      !!errors.passwordVerification &&
                      (formData.password !== "" ||
                        formData.passwordVerification !== "")
                    }
                    isValid={
                      focused.passwordVerification &&
                      !errors.passwordVerification &&
                      formData.passwordVerification === formData.password &&
                      formData.password !== "" &&
                      formData.passwordVerification !== ""
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2" controlId="name">
                  <Form.Label>Förnamn</Form.Label>
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
                    onBlur={() => handleBlur("phone")}
                    isInvalid={focused.phone && !!errors.phone}
                    isValid={
                      focused.phone && !errors.phone && formData.phone !== ""
                    }
                  />
                  {focused.phone && errors.phone && (
                    <Form.Control.Feedback type="invalid">
                      {errors.phone}
                    </Form.Control.Feedback>
                  )}
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
