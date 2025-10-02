import { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import HeaderBar from "./HeaderBar";
import BottomNav from "./BottomNav";
import AuthPage from "./AuthPage";
import HomePage from "./HomePage";
import Booking from "./Booking";
import MovieDetail from "./MovieDetail";
import type { BookingSummary, Route } from "./types";
import ConfirmationPage from "./ConfirmationPage";
import ProfilePage from "./ProfilePage";

// --------------------------------------------------------

// LocalStorage för bokningar
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

// --------------------------------------------------------------------

export default function Auth() {
  const [route, setRoute] = useState<Route>("home");
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<BookingSummary[]>(() =>
    loadBookings()
  );

  // Bokningar ---------------------------------------------------------------
  useEffect(() => saveBookings(bookings), [bookings]);

  const addBooking = (booking: BookingSummary) => {
    setBookings((prev) => [booking, ...prev]);
    setRoute("confirm");
  };

  const cancelBooking = (bookingId: string) => {
    setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
  };

  //  -----------------------------------------------------------------------

  const handleAuthSuccess = () => {
    setAuthed(true);
    setRoute("home");
  };

  const handleLogout = () => {
    setAuthed(false); // Logga ut
    setRoute("home"); // Navigera till startsidan
  };

  const navigationProps = {
    authed,
    onNavigate: setRoute,
    onLogout: handleLogout,
  };

  return (
    <div className="main-container min-vh-100 text-white pb-5">
      <HeaderBar {...navigationProps} onHome={() => setRoute("home")} />

      <Container className="pt-3 pb-5">
        {route === "login" || route === "signup" ? (
          <AuthPage
            mode={route}
            onSuccess={handleAuthSuccess}
            onBack={() => setRoute("home")}
          />
        ) : route === "biljett" ? (
          <Booking
            onConfirm={addBooking}
            onNavigate={setRoute}
            authed={authed}
          />
        ) : route === "movie-detail" ? (
          <MovieDetail onBook={() => setRoute("biljett")} />
        ) : route === "confirm" ? ( // 👈 Lägg till
          <ConfirmationPage onDone={() => setRoute("home")} />
        ) : route === "profile" ? ( // 👈 Lägg till
          <ProfilePage
            bookings={bookings}
            onBack={() => setRoute("home")}
            onCancel={cancelBooking}
          />
        ) : (
          // Alla andra routes (inklusive "home") hamnar här
          <HomePage onNavigate={setRoute} />
        )}
      </Container>

      <BottomNav {...navigationProps} />
    </div>
  );
}
