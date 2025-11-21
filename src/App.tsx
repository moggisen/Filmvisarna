import {
  Routes,
  Route,
  useNavigate,
  useSearchParams,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

// Layout
import HeaderBar from "./components/HeaderBar";
import BottomNav from "./components/BottomNav";

//Pages
import HomePage from "./components/HomePage";
import Booking from "./components/Booking";
import ConfirmationPage from "./components/ConfirmationPage";
import ProfilePage from "./components/ProfilePage";
import MovieDetail from "./components/MovieDetail";
import Signup from "./components/Signup";
import Login from "./components/Login";

// Cookies
import CookieConsent from "./components/CookieConsent";
import FooterMenu from "./components/FooterMenu";
import InfoPage from "./components/InfoPage";

// Routing helpers
import { routePath } from "./routes";

// Types
import type { BookingSummary } from "./components/types";

// Auth state
interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  userData: any | null;
}

// Load/save bookings
function loadBookings(): BookingSummary[] {
  try {
    const raw = localStorage.getItem("bookings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function saveBookings(b: BookingSummary[]) {
  try {
    localStorage.setItem("bookings", JSON.stringify(b));
  } catch {}
}

// Wrapper for confirm page
function ConfirmWrapper() {
  const [sp] = useSearchParams();
  if (!sp.get("booking_id")) return <Navigate to="/" replace />;
  return <ConfirmationPage onDone={() => (window.location.href = "/")} />;
}

export default function App() {
  // Auth state (user, guest, logged in)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isGuest: false,
    userData: null,
  });

  // Local booking history
  const [bookings, setBookings] = useState<BookingSummary[]>(() =>
    loadBookings()
  );

  const navigate = useNavigate();
  const location = useLocation();

  // Check authentication on app load
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/login", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (response.ok && !data.error) {
          const isGuest = !!data.is_guest;

          setAuthState({
            isAuthenticated: !isGuest,
            isGuest: isGuest,
            userData: data,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isGuest: false,
            userData: null,
          });
        }
      } catch (err) {
        console.error("Fel vid kontroll av inloggning: ", err);
        setAuthState({
          isAuthenticated: false,
          isGuest: false,
          userData: null,
        });
      }
    }
    checkAuth();
  }, []);

  // Auto save booking list
  useEffect(() => saveBookings(bookings), [bookings]);

  // Login sucess handler
  const handleAuthSuccess = () => {
    async function refreshAuth() {
      try {
        const response = await fetch("/api/login", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (response.ok && !data.error) {
          const isGuest = !!data.is_guest;

          setAuthState({
            isAuthenticated: !isGuest,
            isGuest: isGuest,
            userData: data,
          });

          // Return to protected route
          const fromGuardPath =
            (location.state as any)?.from?.pathname ??
            (location.state as any)?.from?.location?.pathname;
          if (fromGuardPath) {
            navigate(fromGuardPath, { replace: true });
            return;
          }

          const fromNavigation = location.state?.fromNavigation;
          if (fromNavigation) {
            navigate("/profile", { replace: true });
          } else {
            navigate(routePath.home, { replace: true });
          }
        }
      } catch (err) {
        console.error("Fel vid auth refresh: ", err);
      }
    }

    refreshAuth();
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/login", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAuthState({
          isAuthenticated: false,
          isGuest: false,
          userData: null,
        });
        navigate(routePath.home);
      } else {
        console.error(data.error || "Kunde inte logga ut.");
      }
    } catch (err) {
      console.error("Fel vid utloggning: ", err);
    }
  };

  // Add booking to local list
  const addBooking = (booking: BookingSummary) => {
    setBookings((prev) => [booking, ...prev]);
  };

  // Remove booking from loval list
  const cancelBooking = (bookingId: string) => {
    setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  };

  // Helper för bakåtkompatibilitet
  const isAuthed = authState.isAuthenticated;

  return (
    <>
      {/* Header */}
      <HeaderBar
        authed={isAuthed}
        isGuest={authState.isGuest}
        onLogout={handleLogout}
      />
      {/* Cookie popup */}
      <CookieConsent />

      <main className="container py-4">
        <Routes>
          {/* HOME*/}
          <Route path={routePath.home} element={<HomePage />} />

          {/* BOOKING */}
          <Route
            path={routePath.biljett}
            element={
              <Booking
                authed={isAuthed}
                isGuest={authState.isGuest}
                onConfirm={(b) => {
                  addBooking(b);
                }}
                onNavigate={(name) =>
                  navigate(routePath[name as keyof typeof routePath] ?? "/")
                }
              />
            }
          />

          {/* BOOKING CONFIRMATION */}
          <Route path={routePath.confirm} element={<ConfirmWrapper />} />

          {/* LOGIN */}
          <Route
            path={routePath.login}
            element={
              authState.isAuthenticated &&
              sessionStorage.getItem("shouldRestoreBooking") !== "true" ? (
                <Navigate to="/profile" replace />
              ) : (
                <Login
                  onSuccess={handleAuthSuccess}
                  onBack={() => navigate("/")}
                />
              )
            }
          />

          {/* SIGNUP */}
          <Route
            path={routePath.signup}
            element={
              authState.isAuthenticated &&
              sessionStorage.getItem("shouldRestoreBooking") !== "true" ? (
                <Navigate to="/profile" replace />
              ) : (
                <Signup
                  onSuccess={handleAuthSuccess}
                  onBack={() => navigate("/")}
                />
              )
            }
          />

          {/* PROFILE */}
          <Route
            path={routePath.profile}
            element={
              isAuthed ? (
                <ProfilePage
                  bookings={bookings}
                  onBack={() => navigate(routePath.home)}
                  onCancel={cancelBooking}
                />
              ) : (
                <Navigate
                  to={routePath.login}
                  replace
                  state={{ from: location }}
                />
              )
            }
          />

          {/* MOVIE DETAIL */}
          <Route
            path={routePath["movie-detail"]}
            element={<MovieDetail onBook={() => navigate(routePath.biljett)} />}
          />

          {/* INFO PAGE */}
          <Route path="/info" element={<InfoPage />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="container py-4">404 – sidan finns inte.</div>
            }
          />
        </Routes>
      </main>

      <FooterMenu />

      <BottomNav
        authed={isAuthed}
        isGuest={authState.isGuest}
        onLogout={handleLogout}
      />
    </>
  );
}
