import {
  Routes,
  Route,
  useNavigate,
  useSearchParams,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

import HeaderBar from "./components/HeaderBar";
import BottomNav from "./components/BottomNav";
import HomePage from "./components/HomePage";
import Booking from "./components/Booking";
import ConfirmationPage from "./components/ConfirmationPage";
import ProfilePage from "./components/ProfilePage";
import MovieDetail from "./components/MovieDetail";
import CookieConsent from "./components/CookieConsent";

import { routePath, buildPath } from "./routes";
import type { RouteKey } from "./routes";
import type { BookingSummary } from "./components/types";
import Signup from "./components/Signup";
import Login from "./components/Login";

// --- Types för auth-state ---
interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  userData: any | null;
}

// --- LocalStorage helpers ---
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

function ConfirmWrapper() {
  const [sp] = useSearchParams();
  if (!sp.get("booking_id")) return <Navigate to="/" replace />;
  return <ConfirmationPage onDone={() => (window.location.href = "/")} />;
}

export default function App() {
  // ==== Uppdaterad auth-state ====
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isGuest: false,
    userData: null,
  });
  const [bookings, setBookings] = useState<BookingSummary[]>(() =>
    loadBookings()
  );

  const navigate = useNavigate();
  const location = useLocation();

  // Uppdaterad auth-check som hanterar gästsessioner
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/login", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        console.log("Auth check: ", data);

        if (response.ok && !data.error) {
          // Kolla om det är en gästsession
          const isGuest = !!data.is_guest;

          setAuthState({
            isAuthenticated: !isGuest, // Endast icke-gäster är "authed"
            isGuest: isGuest,
            userData: data,
          });
        } else {
          // Ingen session eller fel
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

  useEffect(() => saveBookings(bookings), [bookings]);

  // Uppdaterad handleAuthSuccess
  const handleAuthSuccess = () => {
    // Kör auth-check igen för att få korrekt state
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

          // Navigeringslogik
          const shouldRestoreBooking = sessionStorage.getItem(
            "shouldRestoreBooking"
          );
          const returnTo = sessionStorage.getItem("returnTo");

          console.log(
            "Auth success - shouldRestoreBooking:",
            shouldRestoreBooking,
            "returnTo:",
            returnTo
          );

          if (shouldRestoreBooking === "true" && returnTo) {
            console.log("Navigating back to booking:", returnTo);
            navigate(returnTo, { replace: true });
            return;
          }

          // NYTT: återgå till guarded route (t.ex. /profile) efter login
          const fromGuardPath =
            (location.state as any)?.from?.pathname ??
            (location.state as any)?.from?.location?.pathname;
          if (fromGuardPath) {
            console.log(
              "Auth success - returning to guarded route:",
              fromGuardPath
            );
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

  // Uppdaterad handleLogout
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/login", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(data.success);
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

  const addBooking = (booking: BookingSummary) => {
    setBookings((prev) => [booking, ...prev]);
  };

  const cancelBooking = (bookingId: string) => {
    setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  };

  const homeOnNavigate = (name: RouteKey, movieId?: number) => {
    if (
      name === "movie-detail" &&
      typeof movieId === "number" &&
      Number.isFinite(movieId) &&
      movieId > 0
    ) {
      const target = buildPath("movie-detail", { id: movieId });
      try {
        localStorage.setItem("selectedMovieId", String(movieId));
      } catch {}
      console.log("Navigating to:", target, "movieId:", movieId);
      navigate(target);
      return;
    }

    navigate(routePath[name] ?? routePath.home);
  };

  // Helper för bakåtkompatibilitet
  const isAuthed = authState.isAuthenticated;

  return (
    <>
      {/* Skicka både isAuthenticated och isGuest till komponenter som behöver det */}
      <HeaderBar
        authed={isAuthed}
        isGuest={authState.isGuest}
        onLogout={handleLogout}
      />
      {/* Cookie-modal, visas endast om användaren inte redan gjort ett val */}
      <CookieConsent />

      <main className="container py-4">
        <Routes>
          {/* START */}
          <Route
            path={routePath.home}
            element={<HomePage onNavigate={homeOnNavigate} />}
          />

          {/* BOKNING */}
          <Route
            path={routePath.biljett}
            element={
              <Booking
                authed={isAuthed} // Använd isAuthenticated (false för gäster)
                isGuest={authState.isGuest} // Skicka gäst-status om behövs
                onConfirm={(b) => {
                  addBooking(b);
                }}
                onNavigate={(name) =>
                  navigate(routePath[name as keyof typeof routePath] ?? "/")
                }
              />
            }
          />

          {/* CONFIRM (via query booking_id & conf) */}
          <Route path={routePath.confirm} element={<ConfirmWrapper />} />

          {/* LOGIN */}
          {/* NYTT: tillåt bara om man INTE redan är inloggad ELLER om en bokning pågår. 
          Gäster (isGuest) får gå till login för att uppgradera. */}
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

          {/* SIGNUP*/}
          {/* NYTT: tillåt bara om man INTE redan är inloggad ELLER om en bokning pågår. */}
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

          {/* PROFIL */}
          {/* NYTT: guarded route, om man försöker nå /profile via URL som icke-inloggad så tas man till login
          och efter inloggning så återgår man till Mina Sidor som då är tillgänglig */}
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

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="container py-4">404 – sidan finns inte.</div>
            }
          />
        </Routes>
      </main>
      {/* Skicka både isAuthenticated och isGuest till BottomNav */}
      <BottomNav
        authed={isAuthed}
        isGuest={authState.isGuest}
        onLogout={handleLogout}
      />
    </>
  );
}
