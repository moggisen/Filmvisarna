import { Nav, Button } from "react-bootstrap";

type Route = "home" | "biljett" | "login" | "signup" | "profile";

interface NavigationButtonsProps {
  authed: boolean;
  onNavigate: (name: Route) => void;
  onLogout: () => void;
  btnClass?: string;
}

export default function NavigationButtons({
  authed,
  onNavigate,
  onLogout,
  btnClass = "",
}: NavigationButtonsProps) {
  const buttons = [
    { key: "home", label: "Hem", btnClass: "home-btn" },
    { key: "biljett", label: "Biljett", btnClass: "biljett-btn" },
  ];

  const authButtons = !authed
    ? [
        { key: "login", label: "Logga in", btnClass: "login-btn" },
        { key: "signup", label: "Bli medlem", btnClass: "signup-btn" },
      ]
    : [
        { key: "profile", label: "Mina sidor", btnClass: "profile-btn" },
        { key: "logout", label: "Logga ut", btnClass: "logout-btn" },
      ];

  return (
    <Nav className={btnClass}>
      {[...buttons, ...authButtons].map(({ key, label, btnClass }) => (
        <Nav.Item key={key}>
          <Button
            className={`${btnClass} nav-btn`}
            size="sm"
            onClick={() =>
              key === "logout" ? onLogout() : onNavigate(key as Route)
            }
          >
            {label}
          </Button>
        </Nav.Item>
      ))}
    </Nav>
  );
}
