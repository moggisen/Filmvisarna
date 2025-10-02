import { Navbar, Container } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";
import type { Route } from "./types";
import "../styles/headerbar.scss"

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
    <Navbar className="header-navbar" sticky="top">
      <Container className="header-container">
        <Navbar.Brand role="button" onClick={onHome} className="header-brand">
          <span className="header-logo">FILMVISARNA</span>
        </Navbar.Brand>

        <div className="header-desktop-nav">
          <NavigationButtons
            authed={authed}
            onNavigate={onNavigate}
            onLogout={onLogout}
            btnClass="header-top-buttons"
          />
        </div>
      </Container>
    </Navbar>
  );
}
