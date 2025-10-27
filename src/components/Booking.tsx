import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BookingSummary } from "./types";
import "../styles/booking.scss";

interface BookingProps {
  onConfirm: (booking: BookingSummary) => void;
  onNavigate: (route: "login" | "signup" | "profile") => void;
  authed: boolean;
}

// ===== Konfig från .env =====
const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

// ===== Salonger =====
type Salon = { name: string; seatsPerRow: number[] };
const SALONGER: Salon[] = [
  { name: "Stora Salongen", seatsPerRow: [8, 9, 10, 10, 10, 10, 12, 12] },
  { name: "Lilla Salongen", seatsPerRow: [6, 8, 9, 10, 10, 12] },
];

// ===== Övrigt =====

type Screening = {
  id: number;
  screening_time: string; // ISO/datetime från backend
  movie_id: number;
  auditorium_id: number;
};

type Tickets = { adult: number; child: number; senior: number };
const PRICES = { adult: 140, child: 80, senior: 120 } as const;
type SeatMeta = { ri: number; ci: number };

const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(
    n
  );

export default function Booking({
  onConfirm,
  onNavigate,
  authed,
}: BookingProps) {
  const navigate = useNavigate();

  // ===== UI-state =====
  const [salonIndex, setSalonIndex] = useState(0);

  // OBS: efter att din kollega kopplat Film-dropdownen till riktiga filmer
  // så kommer movieId antagligen vara ett riktigt film-id (t.ex. 1, 2, 3...)
  // så jag gör den numerisk direkt
  const [movieId, setMovieId] = useState<number | null>(null);

  // alla screenings vi hämtar från /api/screenings
  const [allScreenings, setAllScreenings] = useState<Screening[]>([]);

  // vilket screening_id som användaren valt i "Datum & Tid"
  const [selectedScreeningId, setSelectedScreeningId] = useState<number | null>(
    null
  );

  const [tickets, setTickets] = useState<Tickets>({
    adult: 0,
    child: 0,
    senior: 0,
  });

  // Hämta alla visningstillfällen från backend när sidan laddas
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(`${API_PREFIX}/screenings`);
        if (!res.ok) throw new Error("Kunde inte hämta screenings");
        const data: Screening[] = await res.json();
        if (!dead) {
          setAllScreenings(data);
        }
      } catch (e) {
        console.error("Fel vid hämtning av screenings:", e);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // De screenings som matchar vald film
  const screeningsForMovie = useMemo(() => {
    if (movieId == null) return [];
    return allScreenings
      .filter((s) => s.movie_id === movieId)
      .sort((a, b) => {
        // sortera kronologiskt
        const ta = new Date(a.screening_time).getTime();
        const tb = new Date(b.screening_time).getTime();
        return ta - tb;
      })
      .map((s) => {
        const d = new Date(s.screening_time);
        const label = d.toLocaleString("sv-SE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          value: s.id, // screening_id
          label,
          raw: s,
        };
      });
  }, [allScreenings, movieId]);

  // När film ändras: välj första screening för den filmen och uppdatera salong
  useEffect(() => {
    if (movieId == null) return;

    const first = screeningsForMovie[0];
    if (first) {
      setSelectedScreeningId(first.value);

      // TEMP: sätt salongIndex baserat på auditorium_id så gott det går.
      // Vi mappar auditorium_id 1 -> SALONGER[0], auditorium_id 2 -> SALONGER[1]...
      const audId = first.raw.auditorium_id;
      if (audId != null) {
        const fallbackIndex = audId - 1; // auditorium_id 1 -> index 0, osv.
        if (fallbackIndex >= 0 && fallbackIndex < SALONGER.length) {
          setSalonIndex(fallbackIndex);
        }
      }
    } else {
      // filmen har inga screenings ➜ nollställ
      setSelectedScreeningId(null);
    }
  }, [movieId, screeningsForMovie]);

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
  // sid = valt screening_id från databasen
  const sid = selectedScreeningId;

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
      // EventSource auto-reconnectar; här kan man logga om man vill
      // console.warn("SSE error");
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
      if (block.length === needed) {
        block.forEach((n) => next.add(n));
      } else {
        for (const n of bestSeatOrder()) {
          if (next.size >= needed) break;
          next.add(n);
        }
      }
      return next;
    });
  }, [
    salonIndex,
    selectedScreeningId,
    needed,
    findBestContiguousBlock,
    bestSeatOrder,
  ]);

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
    selectedScreeningId,
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

    // Läs backend-svaret (förväntar t.ex. { id, booking_confirmation, ... })
    const data = await resp.json().catch(() => null);

    // Plocka fram id + conf med säkra fallbacks
    const backendId = (data && (data.id ?? data.booking_id)) ?? null;
    const confCode =
      (data && (data.booking_confirmation ?? data.confirmation ?? data.conf)) ??
      null;

    // Skapa (fortfarande) lokal sammanfattning för profil/LS om ni vill
    const chosenScreening = allScreenings.find(
      (s) => s.id === selectedScreeningId
    );
    const showtimeISO = chosenScreening?.screening_time ?? "";

    const booking: BookingSummary = {
      movieId: movieId!, // vi vet att den inte är null här
      movieTitle: getMovieTitle(movieId),
      tickets: {
        vuxen: tickets.adult,
        barn: tickets.child,
        pensionar: tickets.senior,
      },
      seats: convertSeats(selected),
      total: ticketTotal,
      bookingId: backendId
        ? String(backendId)
        : "M-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      showtime: showtimeISO,
    };

    onConfirm(booking);
    if (showAuth) closeAuth();

    // Navigera till bekräftelse med riktiga queryparametrar
    if (backendId) {
      const q = new URLSearchParams({ booking_id: String(backendId) });
      if (confCode) q.set("conf", String(confCode));
      navigate(`/confirm?${q.toString()}`, { replace: true });
    } else {
      // Fallback (om backend inte gav id): visa i profil men saknar confirm-detaljer
      alert("Bokningen skapades men inget booking_id returnerades.");
    }
  }

  function getMovieTitle(id: number | null): string {
    // tillfälligt: vi kan inte veta titeln förrän kollegan matar in riktiga movies från backend,
    // så returnera tom sträng eller placeholder tills dess
    return "Vald film";
  }

  function convertSeats(
    seatNumbers: Set<number>
  ): { row: string; number: number }[] {
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
                  <select
                    className="form-select"
                    value={movieId ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setMovieId(Number.isFinite(n) ? n : null);
                    }}
                  >
                    <option value="">Välj film…</option>

                    {/* Tillfälliga hårdkodade tills kollegan kopplar riktiga filmer */}
                    <option value={1}>Deadpool & Wolverine</option>
                    <option value={10}>Venom</option>
                    <option value={13}>Guardians of the Galaxy</option>
                    {/* osv */}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Datum & tid</label>
                  <select
                    className="form-select"
                    value={selectedScreeningId ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setSelectedScreeningId(Number.isFinite(n) ? n : null);

                      // när användaren väljer ett specifikt visningstillfälle, uppdatera salongen
                      const scr = screeningsForMovie.find(
                        (opt) => opt.value === n
                      );
                      if (scr) {
                        const audId = scr.raw.auditorium_id;
                        const fallbackIndex = audId - 1;
                        if (
                          fallbackIndex >= 0 &&
                          fallbackIndex < SALONGER.length
                        ) {
                          setSalonIndex(fallbackIndex);
                        }
                      }
                    }}
                  >
                    {screeningsForMovie.length === 0 ? (
                      <option value="">Inga visningar för vald film</option>
                    ) : (
                      screeningsForMovie.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    )}
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
                      !selectedScreeningId ||
                      movieId == null
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
