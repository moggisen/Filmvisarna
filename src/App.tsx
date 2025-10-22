// import Auth from "./components/Auth";

// function App() {
//   return (
//     <>
//       <Auth />
//     </>
//   );
// }

// export default App;

// App.tsx
import { Routes, Route, useNavigate } from "react-router-dom";
import Auth from "./components/Auth";
import ConfirmationPage from "./components/ConfirmationPage";

// Temporära “stubs” tills du får bokningskoden
function Home() {
  return <Auth />; // eller en enkel startvy
}
function BookingStub() {
  return <div className="container py-4">Booking-sida kommer här.</div>;
}

function ConfirmWrapper() {
  const navigate = useNavigate();
  return <ConfirmationPage onDone={() => navigate("/")} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/booking" element={<BookingStub />} />
      <Route path="/confirm" element={<ConfirmWrapper />} />
      {/* 404 */}
      <Route
        path="*"
        element={<div className="container py-4">Sidan finns inte.</div>}
      />
    </Routes>
  );
}
