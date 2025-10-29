import { Nav } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import { routePath } from "../routes";

type RouteKey = keyof typeof routePath;

interface NavigationButtonsProps {
  authed: boolean;
  onLogout: () => void;
  btnClass?: string;
}

export default function NavigationButtons({
  authed,
  onLogout,
  btnClass = "",
}: NavigationButtonsProps) {
  const navigate = useNavigate();

  const buttons: Array<{ key: RouteKey; label: string; klass: string }> = [
    { key: "home", label: "Hem", klass: "home-btn" },
    { key: "biljett", label: "Biljett", klass: "biljett-btn" },
  ];

  const authButtons = !authed
    ? [
        { key: "login" as RouteKey, label: "Logga in", klass: "login-btn" },
        { key: "signup" as RouteKey, label: "Bli medlem", klass: "signup-btn" },
      ]
    : [
        {
          key: "profile" as RouteKey,
          label: "Mina sidor",
          klass: "profile-btn",
        },
      ];

  // ✅ Hantera klick på login/signup knappar från navigation
  const handleAuthNavigation = (route: "login" | "signup") => {
    navigate(routePath[route], {
      state: { fromNavigation: true }, // ✅ Sätt flaggan här
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

      {/* ✅ Specialhantering för auth-knappar för att använda navigate med state */}
      {!authed && (
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

      {/* Inloggade användare - Mina sidor använder NavLink */}
      {authed && (
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
    </Nav>
  );
}
