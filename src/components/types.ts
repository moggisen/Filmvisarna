export type Route = "home" | "biljett" | "login" | "signup";

export interface NavigationProps {
  authed: boolean;
  onNavigate: (name: Route) => void;
  onLogout: () => void;
}
