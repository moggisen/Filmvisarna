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
import AuthPage from "./components/AuthPage";
import ProfilePage from "./components/ProfilePage";
import MovieDetail from "./components/MovieDetail";

import { routePath, buildPath } from "./routes";
import type { RouteKey } from "./routes";
import type { BookingSummary } from "./components/types";

// --- LocalStorage helpers (från gamla Auth.tsx) ---
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
  // ==== Global app-state (flyttat från Auth.tsx) ====
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<BookingSummary[]>(() =>
    loadBookings()
  );

  const navigate = useNavigate();
  const location = useLocation();

  // Stay logged in----------------------------------------------------------
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
          setAuthed(true);
        }
      } catch (err) {
        console.error("Fel vid kontroll av inloggning: ", err);
      }
    }
    checkAuth();
  }, []);
  // ------------------------------------------------------------------------

  useEffect(() => saveBookings(bookings), [bookings]);

  // ✅ Uppdaterad handleAuthSuccess som kollar location.state
  const handleAuthSuccess = () => {
    setAuthed(true);

    // Kolla om användaren kom från navigation (via location.state)
    const fromNavigation = location.state?.fromNavigation;

    if (fromNavigation) {
      // Om användaren kom från navigation, skicka till "mina sidor"
      navigate("/profile", { replace: true });
    } else {
      // Annars gå till startsidan
      navigate(routePath.home, { replace: true });
    }

    // ✅ Reload för att uppdatera navigationen
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/login", {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(data.success);
        setAuthed(false);
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

  return (
    <>
      <HeaderBar authed={authed} onLogout={handleLogout} />
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
                authed={authed}
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

          {/* LOGIN / SIGNUP */}
          <Route
            path={routePath.login}
            element={
              <AuthPage
                mode="login"
                onSuccess={handleAuthSuccess}
                onBack={() => navigate("/")}
              />
            }
          />
          <Route
            path={routePath.signup}
            element={
              <AuthPage
                mode="signup"
                onSuccess={handleAuthSuccess}
                onBack={() => navigate("/")}
              />
            }
          />

          {/* PROFIL */}
          <Route
            path={routePath.profile}
            element={
              <ProfilePage
                bookings={bookings}
                onBack={() => navigate(routePath.home)}
                onCancel={cancelBooking}
              />
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
      <BottomNav authed={authed} onLogout={handleLogout} />
    </>
  );
}
