import { Navbar } from "react-bootstrap";
import NavigationButtons from "./NavigationButtons";

type Route = "home" | "biljett" | "login" | "signup";

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
    <Navbar fixed="bottom" className="bg-primary bottom-nav d-lg-none">
      <NavigationButtons
        authed={authed}
        onNavigate={onNavigate}
        onLogout={onLogout}
        btnClass="mx-auto"
      />
    </Navbar>
  );
}
