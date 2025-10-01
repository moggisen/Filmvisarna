import { Navbar, Container } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";

type Route = "home" | "biljett" | "login" | "signup";

interface HeaderBarProps {
  authed: boolean;
  onNavigate: (name: Route) => void;
  onLogout: () => void;
  onHome: () => void;
}

export default function HeaderBar({
  authed,
  onNavigate,
  onLogout,
  onHome,
}: HeaderBarProps) {
  return (
    <Navbar className="bg-primary logo-text" sticky="top">
      <Container>
        <Navbar.Brand role="button" onClick={onHome}>
          <span className="text-light logo-text">FILMVISARNA</span>
        </Navbar.Brand>

        <div className="d-none d-lg-block top-nav">
          <NavigationButtons
            authed={authed}
            onNavigate={onNavigate}
            onLogout={onLogout}
            btnClass="top-nav-buttons"
          />
        </div>
      </Container>
    </Navbar>
  );
}
