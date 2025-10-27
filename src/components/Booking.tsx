import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingSummary } from "./types";
import "../styles/booking.scss";

interface BookingProps {
  onConfirm: (booking: BookingSummary) => void;
  onNavigate: (route: "login" | "signup" | "profile") => void;
  authed: boolean;
}

// ===== Konfig från .env =====
const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

// ===== Filmer (från API) =====
type Movie = { id: string; title: string };

// ===== Salonger (oförändrat – tills screenings kopplas in) =====
type Salon = { name: string; seatsPerRow: number[] };
const SALONGER: Salon[] = [
  { name: "Stora Salongen", seatsPerRow: [8, 9, 10, 10, 10, 10, 12, 12] },
  { name: "Lilla Salongen", seatsPerRow: [6, 8, 9, 10, 10, 12] },
];
const MOVIE_TO_SALON: Record<string, number> = {
  ironman: 0,
  avengers: 1,
  blackpanther: 0,
};

// ===== Övrigt =====
type Tickets = { adult: number; child: number; senior: number };
type TicketType = {
  id: number;
  ticketType_name: string;
  ticketType_price: number;
};
type Prices = { adult: number; child: number; senior: number };
type SeatMeta = { ri: number; ci: number };

const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(
    n
  );

const screeningKey = (movieId: string, showtime: string, salonIndex: number) =>
  `${movieId}|${showtime}|${salonIndex}`;

// Skapa visningstider (5 dagar × 15/18/21)
function makeShowtimes() {
  const now = new Date();
  const times = [15, 18, 21];
  const out: { value: string; label: string }[] = [];
  for (let d = 0; d < 5; d++) {
    for (const hh of times) {
      const dt = new Date(now);
      dt.setDate(now.getDate() + d);
      dt.setHours(hh, 0, 0, 0);
      out.push({
        value: dt.toISOString(),
        label: dt.toLocaleString("sv-SE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
  }
  return out;
}

export default function Booking({
  onConfirm,
  onNavigate,
  authed,
}: BookingProps) {
  // ===== UI-state =====
  const [salonIndex, setSalonIndex] = useState(0);
  const [movieId, setMovieId] = useState(""); // init tom, sätts efter movies-load
  const showtimes = useMemo(makeShowtimes, []);
  const [showtime, setShowtime] = useState(showtimes[0]?.value ?? "");
  const [tickets, setTickets] = useState<Tickets>({
    adult: 0,
    child: 0,
    senior: 0,
  });

  // ===== State för ticket types =====
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [prices, setPrices] = useState<Prices>({
    adult: 0,
    child: 0,
    senior: 0,
  });

  useEffect(() => {
    setSalonIndex(MOVIE_TO_SALON[movieId] ?? 0);
  }, [movieId]);

  // Hämta ticket types från databasen
  useEffect(() => {
    const fetchTicketTypes = async () => {
      try {
        const response = await fetch(`api/ticketTypes`);
        if (!response.ok) {
          throw new Error("Kunde inte hämta biljettyper");
        }
        const data: TicketType[] = await response.json();
        setTicketTypes(data);

        // Konvertera till PRICES-format
        const newPrices: Prices = { adult: 0, child: 0, senior: 0 };
        data.forEach((ticket) => {
          if (ticket.ticketType_name === "vuxen")
            newPrices.adult = ticket.ticketType_price;
          if (ticket.ticketType_name === "barn")
            newPrices.child = ticket.ticketType_price;
          if (ticket.ticketType_name === "pensionär")
            newPrices.senior = ticket.ticketType_price;
        });
        setPrices(newPrices);
      } catch (error) {
        console.error("Error fetching ticket types:", error);
        // Fallback till hårdkodade priser om API-anropet misslyckas
        setPrices({ adult: 140, child: 80, senior: 120 });
      }
    };

    fetchTicketTypes();
  }, []);

  // ===== Seat-structure =====
  const needed = tickets.adult + tickets.child + tickets.senior;

  const seatStruct = useMemo(() => {
    const layout = SALONGER[salonIndex];
    let seatNo = 1;
    const indexByRow: number[][] = [];
    const seatMeta = new Map<number, SeatMeta>();
    layout.seatsPerRow.forEach((cols, ri) => {
      const rowNos: number[] = [];
      for (let ci = 1; ci <= cols; ci++) {
        rowNos.push(seatNo);
        seatMeta.set(seatNo, { ri, ci });
        seatNo++;
      }
      indexByRow.push(rowNos);
    });
    const totalSeats = seatNo - 1;
    return { indexByRow, seatMeta, totalSeats };
  }, [salonIndex]);

  // ===== Realtid via SSE =====
  const [occupied, setOccupied] = useState<Set<number>>(new Set());
  const sid = useMemo(
    () => screeningKey(movieId, showtime, salonIndex),
    [movieId, showtime, salonIndex]
  );

  useEffect(() => {
    if (!sid) return;
    const es = new EventSource(
      `${API_PREFIX}/screenings/${encodeURIComponent(sid)}/seats/stream`
    );

    const apply = (msg: { type: string; seats?: number[] }) => {
      setOccupied((prev) => {
        if (msg.type === "snapshot" && Array.isArray(msg.seats))
          return new Set(msg.seats);
        const next = new Set(prev);
        if (msg.type === "booked" && Array.isArray(msg.seats))
          msg.seats.forEach((n) => next.add(n));
        if (msg.type === "released" && Array.isArray(msg.seats))
          msg.seats.forEach((n) => next.delete(n));
        return next;
      });
    };

    es.onmessage = (ev) => {
      try {
        apply(JSON.parse(ev.data));
      } catch {}
    };
    es.addEventListener("snapshot", (ev) =>
      apply(JSON.parse((ev as MessageEvent).data))
    );
    es.addEventListener("booked", (ev) =>
      apply(JSON.parse((ev as MessageEvent).data))
    );
    es.addEventListener("released", (ev) =>
      apply(JSON.parse((ev as MessageEvent).data))
    );
    es.onerror = () => {
    };
    return () => es.close();
  }, [sid]);

  // ===== Valda platser =====
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // “Bästa” platser (mitt/viktning)
  const bestSeatOrder = useCallback(
    (exclude?: Set<number>) => {
      const rowCenter = Math.floor(seatStruct.indexByRow.length / 2);
      const weightRow = 2.0;
      const scored: { no: number; dist: number }[] = [];

      seatStruct.seatMeta.forEach(({ ri, ci }, no) => {
        if (occupied.has(no)) return;
        if (exclude?.has(no)) return;
        const cols = seatStruct.indexByRow[ri].length;
        const centerCol = Math.ceil(cols / 2);
        const dr = ri - rowCenter;
        const dc = ci - centerCol;
        const dist = weightRow * dr * dr + dc * dc;
        scored.push({ no, dist });
      });

      scored.sort((a, b) => a.dist - b.dist);
      return scored.map((s) => s.no);
    },
    [occupied, seatStruct.indexByRow, seatStruct.seatMeta]
  );

  const findBestContiguousBlock = useCallback(
    (size: number, exclude?: Set<number>) => {
      const rowCenter = Math.floor(seatStruct.indexByRow.length / 2);
      const rowsOrdered = [...seatStruct.indexByRow.keys()].sort(
        (a, b) => Math.abs(a - rowCenter) - Math.abs(b - rowCenter)
      );
      for (const ri of rowsOrdered) {
        const rowNos = seatStruct.indexByRow[ri];
        const cols = rowNos.length;
        const center = Math.ceil(cols / 2);
        const starts: { s: number; bias: number }[] = [];
        for (let s = 0; s <= cols - size; s++) {
          const mid = s + (size - 1) / 2 + 1;
          starts.push({ s, bias: Math.abs(mid - center) });
        }
        starts.sort((a, b) => a.bias - b.bias);
        for (const { s } of starts) {
          const segment = rowNos.slice(s, s + size);
          const ok = segment.every(
            (no) => !occupied.has(no) && !exclude?.has(no)
          );
          if (ok) return segment;
        }
      }
      return [] as number[];
    },
    [occupied, seatStruct.indexByRow]
  );

  // Förval vid salong/tidsbyte
  useEffect(() => {
    setSelected(() => {
      const next = new Set<number>();
      if (needed <= 0) return next;
      const block = findBestContiguousBlock(needed);
      if (block.length === needed) block.forEach((n) => next.add(n));
      else
        for (const n of bestSeatOrder()) {
          if (next.size >= needed) break;
          next.add(n);
        }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonIndex, showtime]);

  // Auto-justera när antal biljetter ändras
  useEffect(() => {
    setSelected((prev) => {
      const curr = new Set(prev);
      const diff = needed - curr.size;
      if (diff > 0) {
        const exclude = new Set<number>(curr);
        const block = findBestContiguousBlock(diff, exclude);
        if (block.length === diff) block.forEach((n) => curr.add(n));
        else
          for (const n of bestSeatOrder(exclude)) {
            if (curr.size >= needed) break;
            curr.add(n);
          }
      } else if (diff < 0) {
        const arr = Array.from(curr);
        const toRemove = arr.slice(needed);
        toRemove.forEach((n) => curr.delete(n));
      }
      return curr;
    });
  }, [needed, bestSeatOrder, findBestContiguousBlock]);

  // Toggle säte
  const onToggleSeat = (no: number) => {
    if (occupied.has(no)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else if (next.size < needed) next.add(no);
      return next;
    });
  };

  // Totalsumma
  const ticketTotal =
    tickets.adult * prices.adult +
    tickets.child * prices.child +
    tickets.senior * prices.senior;

  // Mobil-fit (skala + centrera)
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fitSeatsToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!vp || !stage) return;
    stage.style.transform = "none";
    const contentW = stage.scrollWidth;
    const contentH = stage.scrollHeight;
    const availW = vp.clientWidth;
    const availH = vp.clientHeight;
    const scale = Math.min(availW / contentW, availH / contentH, 1);
    const offsetX = Math.max((availW - contentW * scale) / 2, 0);
    stage.style.transform = `translate(${offsetX}px, 0) scale(${scale})`;
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(fitSeatsToViewport);
    return () => cancelAnimationFrame(id);
  }, [
    fitSeatsToViewport,
    salonIndex,
    showtime,
    selected.size,
    seatStruct.totalSeats,
  ]);
  useEffect(() => {
    const onR = () => fitSeatsToViewport();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [fitSeatsToViewport]);

  // --- Auth/Checkout ---
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<"choose" | "guest">("choose");
  const [guestEmail, setGuestEmail] = useState("");

  function openAuth() {
    if (authed) void finalizeBooking();
    else {
      setAuthStep("choose");
      setShowAuth(true);
    }
  }
  function closeAuth() {
    setShowAuth(false);
    setGuestEmail("");
    setAuthStep("choose");
  }

  // Boka
  async function finalizeBooking(email?: string) {
    const seatsArr = Array.from(selected).sort((a, b) => a - b);
    const resp = await fetch(`${API_PREFIX}/bookings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screeningId: sid, seats: seatsArr, email }),
    });

    if (resp.status === 409) {
      const data = await resp.json().catch(() => ({}));
      const taken: number[] = Array.isArray((data as any).taken)
        ? (data as any).taken
        : [];
      setSelected((prev) => {
        const next = new Set(prev);
        taken.forEach((n) => next.delete(n));
        return next;
      });
      alert("Någon hann före på vissa platser. Välj nya och försök igen.");
      return;
    }

    if (!resp.ok) {
      alert("Kunde inte boka just nu.");
      return;
    }

    const movie = movies.find((m) => m.id === movieId);
    const booking: BookingSummary = {
      movieId,
      movieTitle: getMovieTitle(movieId),
      tickets: {
        vuxen: tickets.adult,
        barn: tickets.child,
        pensionar: tickets.senior,
      },
      seats: convertSeats(selected),
      total: ticketTotal,
      bookingId: "M-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      showtime,
    };
    onConfirm(booking);
    if (showAuth) closeAuth();
  }

  function convertSeats(seatNumbers: Set<number>): { row: string; number: number }[] {
    // TODO: Mappa till rad A/B/C via seatStruct om du vill visa exakt radbokstav.
    return Array.from(seatNumbers).map((no) => ({ row: "A", number: no }));
  }

  return (
    <>
      <div className="booking container-fluid py-4">
        <div className="row g-4 align-items-stretch">
          {/* VÄNSTER: val */}
          <div className="col-lg-4">
            <div className="card booking-panel h-100">
              <div className="card-header">Välj föreställning</div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Film</label>
                  {loadingMovies ? (
                    <div className="form-control-plaintext">Laddar filmer…</div>
                  ) : movieError ? (
                    <div className="text-danger small">{movieError}</div>
                  ) : (
                    <select
                      className="form-select"
                      value={movieId}
                      onChange={(e) => setMovieId(e.target.value)}
                    >
                      {movies.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Datum & tid</label>
                  <select
                    className="form-select"
                    value={showtime}
                    onChange={(e) => setShowtime(e.target.value)}
                  >
                    {showtimes.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="form-label fw-semibold">Salong</label>
                <div className="form-control-plaintext hidden-text">
                  {SALONGER[salonIndex].name}
                </div>

                <h6 className="mb-3 fw-bold">Antal biljetter</h6>
                <TicketRow
                  label="Vuxen"
                  price={prices.adult}
                  value={tickets.adult}
                  onChange={(v) =>
                    setTickets({ ...tickets, adult: Math.max(0, v) })
                  }
                />
                <TicketRow
                  label="Barn"
                  price={prices.child}
                  value={tickets.child}
                  onChange={(v) =>
                    setTickets({ ...tickets, child: Math.max(0, v) })
                  }
                />
                <TicketRow
                  label="Pensionär"
                  price={prices.senior}
                  value={tickets.senior}
                  onChange={(v) =>
                    setTickets({ ...tickets, senior: Math.max(0, v) })
                  }
                />
              </div>
            </div>
          </div>

          {/* HÖGER: salong & platser + knappar */}
          <div className="col-lg-8">
            <div className="card booking-panel h-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <span className="fw-semibold">Salong – platser</span>
                <small className="hidden-text">Välj dina platser</small>
              </div>
              <div className="card-body">
                {/* viewport + stage */}
                <div className="seat-viewport" ref={viewportRef}>
                  <div className="seat-stage" ref={stageRef}>
                    <div className="screenbar" />
                    <div className="seat-grid" aria-label="Salsplatser">
                      {seatStruct.indexByRow.map((rowNos, ri) => (
                        <div className="seat-row" key={`r${ri}`}>
                          <div className="row-inner">
                            {rowNos.map((no) => {
                              const isTaken = occupied.has(no);
                              const isActive = selected.has(no);
                              const disabled =
                                isTaken ||
                                (!isActive && selected.size >= needed);
                              return (
                                <button
                                  key={no}
                                  type="button"
                                  className={
                                    "seat" +
                                    (isTaken
                                      ? " seat-taken"
                                      : isActive
                                      ? " seat-active"
                                      : "")
                                  }
                                  aria-pressed={isActive}
                                  aria-label={`Plats ${no}${
                                    isTaken
                                      ? " (upptagen)"
                                      : isActive
                                      ? " (vald)"
                                      : ""
                                  }`}
                                  disabled={disabled}
                                  onClick={() => onToggleSeat(no)}
                                >
                                  {no}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Val + totals */}
                <div className="mt-3 d-flex align-items-center justify-content-between">
                  <div>
                    <div className="small hidden-text">Valda platser</div>
                    <div className="fw-semibold">
                      {Array.from(selected)
                        .sort((a, b) => a - b)
                        .join(", ") || "–"}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="small hidden-text">Totalt</div>
                    <div className="h4 mb-0">{fmtSEK(ticketTotal)}</div>
                  </div>
                </div>

                {/* Knappar */}
                <div className="mt-3 d-flex gap-2 justify-content-end">
                  <button
                    className="btn btn-dark btn-cancel"
                    onClick={() => {
                      setTickets({ adult: 0, child: 0, senior: 0 });
                      setSelected(new Set());
                    }}
                  >
                    Avbryt
                  </button>
                  <button
                    className="btn btn-primary btn-confirm"
                    disabled={
                      needed === 0 ||
                      selected.size !== needed ||
                      !showtime ||
                      !movieId
                    }
                    onClick={openAuth}
                  >
                    Boka
                  </button>
                </div>

                {/* Live region för a11y */}
                <div className="visually-hidden" aria-live="polite">
                  {`Totalt ${fmtSEK(
                    ticketTotal
                  )} för ${needed} biljett(er). Valda platser: ${
                    selected.size
                  }.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth/Checkout modal (endast gäst lokalt; login/signup redirect) */}
      <AuthModal
        open={showAuth && !authed}
        step={authStep}
        guestEmail={guestEmail}
        onChangeEmail={setGuestEmail}
        onClose={closeAuth}
        onPickGuest={() => setAuthStep("guest")}
        onLoginRedirect={() => onNavigate("login")}
        onSignupRedirect={() => onNavigate("signup")}
        onConfirmGuest={async () => {
          const ok = /\S+@\S+\.\S+/.test(guestEmail);
          if (!ok) return alert("Ange en giltig e-postadress.");
          await finalizeBooking(guestEmail);
        }}
      />
    </>
  );
}

/* ===== Auth modal ===== */
function AuthModal(props: {
  open: boolean;
  step: "choose" | "guest";
  guestEmail: string;
  onChangeEmail: (s: string) => void;
  onClose: () => void;
  onPickGuest: () => void;
  onLoginRedirect: () => void;
  onSignupRedirect: () => void;
  onConfirmGuest: () => void;
}) {
  const {
    open,
    step,
    guestEmail,
    onChangeEmail,
    onClose,
    onPickGuest,
    onLoginRedirect,
    onSignupRedirect,
    onConfirmGuest,
  } = props;
  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Fortsätt för att boka</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Stäng"
                onClick={onClose}
              ></button>
            </div>

            {step === "choose" && (
              <div className="modal-body">
                <p className="mb-3">Välj hur du vill fortsätta:</p>
                <div className="d-grid gap-2">
                  <button className="btn btn-primary" onClick={onLoginRedirect}>
                    Logga in
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={onSignupRedirect}
                  >
                    Bli medlem
                  </button>
                  <button className="btn btn-primary" onClick={onPickGuest}>
                    Fortsätt som gäst
                  </button>
                </div>
              </div>
            )}

            {step === "guest" && (
              <div className="modal-body">
                <label className="form-label">E-postadress</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="du@example.com"
                  value={guestEmail}
                  onChange={(e) => onChangeEmail(e.target.value)}
                />
                <small className="booking-note d-block mt-2">
                  Vi skickar din bokningsbekräftelse till denna adress.
                </small>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-cancel" onClick={onClose}>
                Stäng
              </button>
              {step === "guest" && (
                <button
                  className="btn btn-primary btn-confirm"
                  onClick={onConfirmGuest}
                >
                  Bekräfta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== UI-delkomponent ===== */
function TicketRow({
  label,
  price,
  value,
  onChange,
}: {
  label: string;
  price: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const fmtSEK = (n: number) =>
    new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
    }).format(n);
  return (
    <div className="mb-2 d-flex align-items-center justify-content-between">
      <div>
        <div className="fw-semibold">{label}</div>
        <div className="booking-hint">{fmtSEK(price)}</div>
      </div>
      <div className="btn-group">
        <button
          className="btn btn-outline-info btn-sm"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <button className="btn btn-info btn-sm" disabled>
          {value}
        </button>
        <button
          className="btn btn-outline-info btn-sm"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
