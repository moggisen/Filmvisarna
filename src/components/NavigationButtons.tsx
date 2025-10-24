import { Nav } from "react-bootstrap";
import { NavLink } from "react-router-dom";
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

  return (
    <Nav className={btnClass}>
      {[...buttons, ...authButtons].map(({ key, label, klass }) => (
        <Nav.Item key={key}>
          <NavLink
            to={routePath[key]}
            end={key === "home"}
            className={({ isActive }) =>
              `${klass} nav-btn btn btn-sm ${
                isActive ? "btn-info" : "btn-outline-info"
              }`
            }
          >
            {label}
          </NavLink>
        </Nav.Item>
      ))}

      {authed && (
        <Nav.Item>
          <button
            className="logout-btn nav-btn btn btn-sm btn-outline-info"
            onClick={onLogout}
            type="button"
          >
            Logga ut
          </button>
        </Nav.Item>
      )}
    </Nav>
  );
}
