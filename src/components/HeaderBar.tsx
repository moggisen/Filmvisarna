
import { Navbar, Container } from "react-bootstrap";
import { Link } from "react-router-dom";
import NavigationButtons from "./NavigationButtons";
import "../styles/headerbar.scss";

interface HeaderBarProps {
  authed: boolean;
  onLogout: () => void;
}

export default function HeaderBar({ authed, onLogout }: HeaderBarProps) {
  return (
    <Navbar className="header-navbar" sticky="top">
      <Container className="header-container">
        <Navbar.Brand as={Link} to="/" className="header-brand">
          <span className="header-logo">FILMVISARNA</span>
        </Navbar.Brand>

        <div className="header-desktop-nav">
          <NavigationButtons
            authed={authed}
            onLogout={onLogout}
            btnClass="header-top-buttons"
          />
        </div>
      </Container>
    </Navbar>
  );
}
