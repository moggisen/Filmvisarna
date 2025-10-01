import { useState } from "react";
import { Container } from "react-bootstrap";
import HeaderBar from "./HeaderBar";
import BottomNav from "./BottomNav";
import AuthPage from "./AuthPage";

type Route = "home" | "biljett" | "login" | "signup";

export default function Auth() {
  const [route, setRoute] = useState<Route>("home");
  const [authed, setAuthed] = useState(false);

  const handleAuthSuccess = () => {
    setAuthed(true);
    setRoute("home");
  };

  const navigationProps = {
    authed,
    onNavigate: setRoute,
    onLogout: () => setAuthed(false),
  };

  return (
    <div className="main-container min-vh-100 min-vw-100 text-white pb-5">
      <HeaderBar {...navigationProps} onHome={() => setRoute("home")} />

      <Container className="pt-3 pb-5">
        {route === "login" || route === "signup" ? (
          <AuthPage
            mode={route}
            onSuccess={handleAuthSuccess}
            onBack={() => setRoute("home")}
          />
        ) : (
          <p className="text-center text-secondary mt-5">
            👋 Välkommen! Använd för att logga in eller skapa konto.
          </p>
        )}
      </Container>

      <BottomNav {...navigationProps} />
    </div>
  );
}
