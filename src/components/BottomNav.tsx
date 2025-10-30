import { Navbar } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";
import "../styles/bottomnav.scss";

interface BottomNavProps {
  authed: boolean;
  isGuest?: boolean;
  onLogout: () => void;
}

export default function BottomNav({
  authed,
  isGuest = false,
  onLogout,
}: BottomNavProps) {
  return (
    <Navbar
      fixed="bottom"
      bg="primary"
      data-bs-theme="dark"
      className="border-top border-secondary py-0 bottom-navbar d-lg-none"
    >
      <NavigationButtons
        authed={authed}
        isGuest={isGuest}
        onLogout={onLogout}
        btnClass="bottom-nav-buttons"
      />
    </Navbar>
  );
}
