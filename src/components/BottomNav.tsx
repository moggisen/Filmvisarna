import { Navbar } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";
import "../styles/bottomnav.scss";

interface BottomNavProps {
  authed: boolean;
  onLogout: () => void;
}

export default function BottomNav({ authed, onLogout }: BottomNavProps) {
  return (
    <Navbar
      fixed="bottom"
      bg="primary"
      data-bs-theme="dark"
      className="border-top border-secondary py-0 bottom-navbar d-lg-none"
    >
      <NavigationButtons
        authed={authed}
        onLogout={onLogout}
        btnClass="bottom-nav-buttons"
      />
    </Navbar>
  );
}
