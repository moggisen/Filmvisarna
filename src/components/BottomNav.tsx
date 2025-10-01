import { Navbar } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";
import type { Route } from "./types";

interface BottomNavProps {
  authed: boolean;
  onNavigate: (name: Route) => void;
  onLogout: () => void;
}

export default function BottomNav({
  authed,
  onNavigate,
  onLogout,
}: BottomNavProps) {
  return (
    <Navbar fixed="bottom" className="bottom-navbar d-lg-none">
      <NavigationButtons
        authed={authed}
        onNavigate={onNavigate}
        onLogout={onLogout}
        btnClass="bottom-nav-buttons"
      />
    </Navbar>
  );
}
