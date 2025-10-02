import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingSummary } from "./types";

import "../styles/booking.scss";

interface BookingProps {
  onConfirm: (booking: BookingSummary) => void;
  onNavigate: (route: "login" | "signup" | "profile") => void;
  authed: boolean;
}

// ----- Salonger (din JSON) -----
type Salon = { name: string; seatsPerRow: number[] };
const SALONGER: Salon[] = [
  { name: "Stora Salongen", seatsPerRow: [8, 9, 10, 10, 10, 10, 12, 12] },
  { name: "Lilla Salongen", seatsPerRow: [6, 8, 9, 10, 10, 12] },
];
// 0 = Stora Salongen, 1 = Lilla Salongen (enligt ordningen i SALONGER)
const MOVIE_TO_SALON: Record<string, number> = {
  ironman: 0,
  avengers: 1,
  blackpanther: 0,
};

// ----- Övrigt -----
type Tickets = { adult: number; child: number; senior: number };
const PRICES = { adult: 140, child: 80, senior: 120 } as const;
type SeatMeta = { ri: number; ci: number };

const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(
    n
  );

// Visningstider (5 dagar × 15/18/21)
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
  // ----- UI-state -----
  const [salonIndex, setSalonIndex] = useState(0);
  const [movieId, setMovieId] = useState("ironman");
  const showtimes = useMemo(makeShowtimes, []);
  const [showtime, setShowtime] = useState(showtimes[0]?.value ?? "");
  const [tickets, setTickets] = useState<Tickets>({
    adult: 0,
    child: 0,
    senior: 0,
  });

  useEffect(() => {
    setSalonIndex(MOVIE_TO_SALON[movieId] ?? 0);
  }, [movieId]);

  // ----- Seats-state -----
  const needed = tickets.adult + tickets.child + tickets.senior;

  // Struktur för vald salong
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
    return { layout, indexByRow, seatMeta, totalSeats };
  }, [salonIndex]);

  // Förbokade platser (mock)
  const [prebooked, setPrebooked] = useState<Set<number>>(new Set());
  useEffect(() => {
    const set = new Set<number>();
    set.add(1);
    if (seatStruct.totalSeats >= 2) set.add(2);
    const mid1 = Math.floor(seatStruct.totalSeats / 2);
    const mid2 = mid1 + 1;
    if (mid1 >= 1) set.add(mid1);
    if (mid2 >= 1 && mid2 <= seatStruct.totalSeats) set.add(mid2);
    setPrebooked(set);
  }, [seatStruct.totalSeats, salonIndex, showtime]);

  // Valda platser
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // “Bästa” platser (mitt/viktning)
  const bestSeatOrder = useCallback(
    (exclude?: Set<number>) => {
      const rowCenter = Math.floor(seatStruct.indexByRow.length / 2);
      const weightRow = 2.0;
      const scored: { no: number; dist: number }[] = [];

      seatStruct.seatMeta.forEach(({ ri, ci }, no) => {
        if (prebooked.has(no)) return;
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
    [prebooked, seatStruct.indexByRow, seatStruct.seatMeta]
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
            (no) => !prebooked.has(no) && !exclude?.has(no)
          );
          if (ok) return segment;
        }
      }
      return [] as number[];
    },
    [prebooked, seatStruct.indexByRow]
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
    if (prebooked.has(no)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else if (next.size < needed) next.add(no);
      return next;
    });
  };

  // Totalsumma
  const ticketTotal =
    tickets.adult * PRICES.adult +
    tickets.child * PRICES.child +
    tickets.senior * PRICES.senior;

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

  // --- BOKA → MODAL (endast gäst lokalt; login/signup redirect) ---
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<"choose" | "guest">("choose");
  const [guestEmail, setGuestEmail] = useState("");

  function openAuth() {
    if (authed) {
      // Om användaren är inloggad, boka direkt
      finalizeBooking();
    } else {
      // Om användaren inte är inloggad, visa auth modal
      setAuthStep("choose");
      setShowAuth(true);
    }
  }
  function closeAuth() {
    setShowAuth(false);
    setGuestEmail("");
    setAuthStep("choose");
  }

  function finalizeBooking(email?: string) {
    const seats = Array.from(selected)
      .sort((a, b) => a - b)
      .join(", ");

    // Skapa en bokning
    const booking: BookingSummary = {
      movieId: movieId,
      movieTitle: getMovieTitle(movieId),
      tickets: {
        vuxen: tickets.adult,
        barn: tickets.child,
        pensionar: tickets.senior,
      },
      seats: convertSeats(selected),
      total: ticketTotal,
      bookingId: "M-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      showtime: showtime,
    };

    // Anropa onConfirm för att spara bokningen
    onConfirm(booking);

    // Stäng auth modal om den är öppen
    if (showAuth) {
      closeAuth();
    }

    // Navigera till "Mina sidor" om användaren är inloggad
    if (authed) {
      onConfirm(booking);
    }
  }

  function getMovieTitle(id: string): string {
    const titles: Record<string, string> = {
      ironman: "Iron Man",
      avengers: "The Avengers",
      blackpanther: "Black Panther",
    };
    return titles[id] || "Okänd film";
  }

  function convertSeats(
    seatNumbers: Set<number>
  ): { row: string; number: number }[] {
    // Konvertera dina seat numbers till row/number format
    // Justera denna logik baserat på din seat-struktur
    return Array.from(seatNumbers).map((no) => ({
      row: "A", // 👈 Justera baserat på din salongsstruktur
      number: no,
    }));
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
                <div className="mb-3"></div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Film</label>
                  <select
                    className="form-select"
                    value={movieId}
                    onChange={(e) => setMovieId(e.target.value)}
                  >
                    <option value="ironman">Iron Man</option>
                    <option value="avengers">The Avengers</option>
                    <option value="blackpanther">Black Panther</option>
                  </select>
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
                  price={PRICES.adult}
                  value={tickets.adult}
                  onChange={(v) =>
                    setTickets({ ...tickets, adult: Math.max(0, v) })
                  }
                />
                <TicketRow
                  label="Barn"
                  price={PRICES.child}
                  value={tickets.child}
                  onChange={(v) =>
                    setTickets({ ...tickets, child: Math.max(0, v) })
                  }
                />
                <TicketRow
                  label="Pensionär"
                  price={PRICES.senior}
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
                {/* MOBIL (0–600px): checkbox-dropdown för platser */}
                <SeatPickerMobile
                  totalSeats={seatStruct.totalSeats}
                  prebooked={prebooked}
                  selected={selected}
                  needed={needed}
                  onToggle={onToggleSeat}
                />

                {/* viewport + stage: allt skalas/centreras på mobil */}
                <div className="seat-viewport" ref={viewportRef}>
                  <div className="seat-stage" ref={stageRef}>
                    <div className="screenbar" />
                    <div className="seat-grid" aria-label="Salsplatser">
                      {seatStruct.indexByRow.map((rowNos, ri) => (
                        <div className="seat-row" key={`r${ri}`}>
                          <div className="row-inner">
                            {rowNos.map((no) => {
                              const isTaken = prebooked.has(no);
                              const isActive = selected.has(no);
                              const disabled =
                                isTaken ||
                                (!isActive && selected.size >= needed);
                              return (
                                <button
                                key={no}
                                type="button"
                                className={"seat" + (isTaken ? " seat-taken" : isActive ? " seat-active" : "")}
                                aria-pressed={isActive}
                                aria-label={`Plats ${no}${isTaken ? " (upptagen)" : isActive ? " (vald)" : ""}`}
                                disabled={disabled}onClick={() => onToggleSeat(no)}>{no}</button>

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
                    {" "}
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
        onConfirmGuest={() => {
          const ok = /\S+@\S+\.\S+/.test(guestEmail);
          if (!ok) return alert("Ange en giltig e-postadress.");
          finalizeBooking(guestEmail);
        }}
      />
    </>
  );
}

/* ===== Auth modal (endast gäst här; login/signup redirect) ===== */
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

function SeatPickerMobile({
  totalSeats,
  prebooked,
  selected,
  needed,
  onToggle,
}: {
  totalSeats: number;
  prebooked: Set<number>;
  selected: Set<number>;
  needed: number;
  onToggle: (no: number) => void;
}) {
  const canAddMore = selected.size < needed;

  return (
    <div className="seat-picker-mobile">
      <label className="form-label fw-semibold">
        Välj platser{" "}
        {needed > 0 ? `(behöver ${needed})` : `(välj antal biljetter först)`}
      </label>

      {/* En enkel "dropdown" med checkboxar – ingen extra state behövs */}
      <details className="spm-dropdown">
        <summary className="btn form-select w-100 d-flex justify-content-between align-items-center">
          {selected.size
            ? `Platser: ${Array.from(selected)
                .sort((a, b) => a - b)
                .join(", ")}`
            : "Öppna och bocka i platser"}
          <span className="ms-2">▾</span>
        </summary>

        <div className="spm-panel mt-2">
          {Array.from({ length: totalSeats }, (_, i) => i + 1).map((no) => {
            const taken = prebooked.has(no);
            const checked = selected.has(no);
            // tillåt bocka UR alltid; blockera nya val om max är nått eller inga biljetter valda
            const disabled = taken || (!checked && !canAddMore) || needed === 0;

            return (
              <label
                key={no}
                className="form-check d-flex align-items-center gap-2 spm-item"
              >
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(no)}
                />
                <span>
                  Plats {no}
                  {taken ? " (upptagen)" : ""}
                </span>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}
