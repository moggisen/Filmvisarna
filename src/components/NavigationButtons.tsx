import { Nav } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import { routePath } from "../routes";

type RouteKey = keyof typeof routePath;

interface NavigationButtonsProps {
  authed: boolean;
  isGuest?: boolean;
  onLogout: () => void;
  btnClass?: string;
}

export default function NavigationButtons({
  authed,
  isGuest = false,
  onLogout,
  btnClass = "",
}: NavigationButtonsProps) {
  const navigate = useNavigate();

  const buttons: Array<{ key: RouteKey; label: string; klass: string }> = [
    { key: "home", label: "Hem", klass: "home-btn" },
    { key: "biljett", label: "Biljett", klass: "biljett-btn" },
  ];

  // ✅ Hantera klick på login/signup knappar från navigation
  const handleAuthNavigation = (route: "login" | "signup") => {
    navigate(routePath[route], {
      state: { fromNavigation: true },
    });
  };

  return (
    <Nav className={btnClass}>
      {/* Vanliga länkar (Hem, Biljett) använder NavLink */}
      {buttons.map(({ key, label, klass }) => (
        <Nav.Item key={key}>
          <NavLink
            to={routePath[key]}
            end={key === "home"}
            className={`${klass} nav-btn btn text-info btn-sm`}
            style={{ lineHeight: "5" }}
          >
            {label}
          </NavLink>
        </Nav.Item>
      ))}

      {/* ✅ Visa "Logga in" och "Bli medlem" för Oautentiserade användare och gäster */}
      {(!authed || isGuest) && (
        <>
          <Nav.Item>
            <button
              className="login-btn nav-btn btn text-info btn-sm"
              style={{ lineHeight: "5" }}
              onClick={() => handleAuthNavigation("login")}
              type="button"
            >
              Logga in
            </button>
          </Nav.Item>
          <Nav.Item>
            <button
              className="signup-btn nav-btn btn text-info btn-sm"
              style={{ lineHeight: "5" }}
              onClick={() => handleAuthNavigation("signup")}
              type="button"
            >
              Bli medlem
            </button>
          </Nav.Item>
        </>
      )}

      {/* ✅ Visa "Mina sidor" och "Logga ut" ENDAST för autentiserade användare som INTE är gäster */}
      {authed && !isGuest && (
        <>
          <Nav.Item>
            <NavLink
              to={routePath.profile}
              className="profile-btn nav-btn btn text-info btn-sm"
              style={{ lineHeight: "5" }}
            >
              Mina sidor
            </NavLink>
          </Nav.Item>
          <Nav.Item>
            <button
              className="logout-btn nav-btn btn btn-sm text-info"
              onClick={onLogout}
              type="button"
            >
              Logga ut
            </button>
          </Nav.Item>
        </>
      )}

      {/* ✅ Alternativt: Visa "Avsluta session" för gäster om du vill */}
      {authed && isGuest && (
        <Nav.Item>
          <button
            className="guest-logout-btn nav-btn btn btn-sm text-info"
            onClick={onLogout}
            type="button"
          >
            Avsluta
          </button>
        </Nav.Item>
      )}
    </Nav>
  );
}
