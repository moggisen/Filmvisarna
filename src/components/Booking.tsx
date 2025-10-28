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

// ===== Typer =====
type Movie = { id: number; title: string };

type Screening = {
  id: number;
  screening_time: string; // ISO/datetime från backend
  movie_id: number;
  auditorium_id: number;
};

type Tickets = { adult: number; child: number; senior: number };
type TicketType = {
  id: number;
  ticketType_name: string;
  ticketType_price: number;
};
type Prices = { adult: number; child: number; senior: number };

type SeatMeta = { ri: number; ci: number };
// Layout vi får från backend /api/screenings/:id/layout
type LayoutRow = {
  rowIndex: number; // 1,2,3...
  seats: {
    id: number; // seat.id i DB
    seatNumber: number; // stolnummer i raden
    taken: boolean; // true om redan bokad
  }[];
};

type ScreeningLayoutResponse = {
  auditorium_id: number;
  auditorium_name: string;
  rows: LayoutRow[];
};

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

  // Filmval (numeriskt id)
  const [movieId, setMovieId] = useState<number | null>(null);
  // Alla screenings
  const [allScreenings, setAllScreenings] = useState<Screening[]>([]);
  // Vald screening
  const [selectedScreeningId, setSelectedScreeningId] = useState<number | null>(
    null
  );
  // Biljettantal
  const [tickets, setTickets] = useState<Tickets>({
    adult: 0,
    child: 0,
    senior: 0,
  });
  // Filmer från API
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [movieError, setMovieError] = useState<string | null>(null);
  // Ticket types/priser
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [prices, setPrices] = useState<Prices>({
    adult: 0,
    child: 0,
    senior: 0,
  });
  // Layout-data för den valda visningen
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([]);
  const [auditoriumName, setAuditoriumName] = useState<string>("");

  // ===== Hämta screenings =====
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

  // ===== Hämta filmer =====
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingMovies(true);
        const resp = await fetch(`${API_PREFIX}/movies`);
        if (!resp.ok) throw new Error("Kunde inte hämta filmer");
        const raw = await resp.json();

        // Normalisera till { id:number, title:string }
        const data: Movie[] = (Array.isArray(raw) ? raw : []).map((m: any) => ({
          id: Number(m.id ?? m.movie_id ?? m.movieId),
          title: String(
            m.title ?? m.movie_title ?? m.movieTitle ?? "Okänd film"
          ),
        }));

        if (!alive) return;
        setMovies(data);
        setMovieError(null);
      } catch (e: any) {
        if (!alive) return;
        setMovieError(e?.message ?? "Fel vid hämtning av filmer");
      } finally {
        if (alive) setLoadingMovies(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ===== Hämta biljettyper/priser =====
  useEffect(() => {
    const fetchTicketTypes = async () => {
      try {
        const response = await fetch(`${API_PREFIX}/ticketTypes`);
        if (!response.ok) throw new Error("Kunde inte hämta biljettyper");
        const data: TicketType[] = await response.json();
        setTicketTypes(data);

        const newPrices: Prices = { adult: 0, child: 0, senior: 0 };
        data.forEach((ticket) => {
          const name = ticket.ticketType_name.toLowerCase();
          if (name.includes("vuxen")) newPrices.adult = ticket.ticketType_price;
          if (name.includes("barn")) newPrices.child = ticket.ticketType_price;
          if (name.includes("pension"))
            newPrices.senior = ticket.ticketType_price;
        });
        setPrices((prev) => ({
          adult: newPrices.adult || prev.adult || 140,
          child: newPrices.child || prev.child || 80,
          senior: newPrices.senior || prev.senior || 120,
        }));
      } catch (error) {
        console.error("Error fetching ticket types:", error);
        // Fallback
        setPrices({ adult: 140, child: 80, senior: 120 });
      }
    };
    fetchTicketTypes();
  }, []);

  // ===== Filmer som har screenings =====
  const bookableMovieIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of allScreenings) ids.add(s.movie_id);
    return ids;
  }, [allScreenings]);

  const bookableMovies = useMemo(
    () => movies.filter((m) => bookableMovieIds.has(m.id)),
    [movies, bookableMovieIds]
  );

  // Välj default-film när data finns
  useEffect(() => {
    if (movieId != null) return;
    if (!bookableMovies.length) return;
    setMovieId(bookableMovies[0].id);
  }, [movieId, bookableMovies]);

  // ===== Screenings för vald film =====
  const screeningsForMovie = useMemo(() => {
    if (movieId == null) return [];
    return allScreenings
      .filter((s) => s.movie_id === movieId)
      .sort(
        (a, b) =>
          new Date(a.screening_time).getTime() -
          new Date(b.screening_time).getTime()
      )
      .map((s) => {
        const d = new Date(s.screening_time);
        const label = d.toLocaleString("sv-SE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return { value: s.id, label, raw: s };
      });
  }, [allScreenings, movieId]);

  // När film ändras: välj första screening + uppdatera salong
  useEffect(() => {
    if (movieId == null) return;
    const first = screeningsForMovie[0];
    if (first) {
      setSelectedScreeningId(first.value);
    } else {
      setSelectedScreeningId(null);
    }
  }, [movieId, screeningsForMovie]);

  // ===== Seat-structure =====

  // Hämta faktisk salongslayout + initialt upptagna säten för vald screening
  useEffect(() => {
    if (!selectedScreeningId) return;

    (async () => {
      try {
        const resp = await fetch(
          `${API_PREFIX}/screenings/${selectedScreeningId}/layout`
        );
        if (!resp.ok) throw new Error("Kunde inte hämta layout");
        const data: ScreeningLayoutResponse = await resp.json();

        // Spara raderna (layoutRows) och salongsnamnet (auditoriumName)
        setLayoutRows(data.rows || []);
        setAuditoriumName(data.auditorium_name || "");
      } catch (err) {
        console.error("Fel vid hämtning av layout:", err);
        setLayoutRows([]);
        setAuditoriumName("");
      }
    })();
  }, [selectedScreeningId]);

  const needed = tickets.adult + tickets.child + tickets.senior;

  // Bygg struktur av layoutRows så resten av koden (bestSeatOrder osv)
  // kan fortsätta funka ungefär som innan
  const seatStruct = useMemo(() => {
    const indexByRow: number[][] = [];
    const seatMeta = new Map<number, SeatMeta>();
    const takenSet = new Set<number>();
    const allSeatIds: number[] = [];

    layoutRows.forEach((row, rowIdxZeroBased) => {
      // row = { rowIndex, seats: [{id, seatNumber, taken}, ...] }
      const thisRowSeatIds: number[] = [];

      row.seats.forEach((seat, ci) => {
        thisRowSeatIds.push(seat.id); // vi använder DB seat.id som unik stol-id
        allSeatIds.push(seat.id);

        // lagra var stolen sitter (ri = radindex, ci = kolumnindex)
        seatMeta.set(seat.id, {
          ri: rowIdxZeroBased,
          ci: ci + 1, // börja på 1 istället för 0 i kolumn
        });

        if (seat.taken) {
          takenSet.add(seat.id);
        }
      });

      indexByRow.push(thisRowSeatIds);
    });

    return {
      indexByRow, // [ [27,28,29], [30,31,32], ... ]
      seatMeta, // Map(seatId -> {ri,ci})
      totalSeats: allSeatIds.length,
      takenSet, // Set med säten som redan var tagna i DB
    };
  }, [layoutRows]);

  // ===== Realtid via SSE =====
  const [occupied, setOccupied] = useState<Set<number>>(new Set());
  const sid = selectedScreeningId;

  // När vi hämtat en ny layout från backend, markera de som var tagna i DB
  useEffect(() => {
    // seatStruct.takenSet är Set<number> av upptagna säten vid load
    setOccupied(new Set(seatStruct.takenSet));
  }, [seatStruct.takenSet]);

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
    es.onerror = () => {};
    return () => es.close();
  }, [sid, API_PREFIX]);

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
  }, [selectedScreeningId, needed, findBestContiguousBlock, bestSeatOrder]);

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
    selectedScreeningId,
    selected.size,
    seatStruct.totalSeats,
    layoutRows,
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

  // Hjälp: filmtitel via movies-state
  function getMovieTitle(id: number | null): string {
    if (id == null) return "";
    return movies.find((m) => m.id === id)?.title ?? "";
  }

  // Gör om seatId -> label som "A7", "B12", etc
  function getSeatLabel(seatId: number): string {
    // Hämta metadata (ri = radindex 0-baserad, ci = kolumnindex 1-baserad)
    const meta = seatStruct.seatMeta.get(seatId);
    if (!meta) return String(seatId);

    const { ri, ci } = meta;

    // Radbokstav: 0 -> A, 1 -> B, 2 -> C
    const rowLetter = String.fromCharCode("A".charCodeAt(0) + ri);

    // Och sittplatsnumret kan vara ci (position i raden).
    // Om du vill vara ännu mer exakt och använda seat_number från DB istället
    // (t.ex. om raden har hål eller dubbla siffror) kan vi slå upp layoutRows:
    const layoutRow = layoutRows[ri];
    if (layoutRow) {
      const seatInThatRow = layoutRow.seats.find((s) => s.id === seatId);
      if (seatInThatRow) {
        return rowLetter + seatInThatRow.seatNumber; // t.ex. "B7"
      }
    }

    // fallback om något saknas
    return rowLetter + ci;
  }

  // Hämta radbokstav + platsnummer för en seatId
  function getSeatInfo(seatId: number): {
    rowLetter: string;
    seatNumber: number;
  } {
    // 1. Ta metadata vi byggde upp i seatStruct (ri = radindex 0-baserad, ci = kolumnindex i raden)
    const meta = seatStruct.seatMeta.get(seatId);

    // Sätt rimliga default-värden om något saknas
    let ri = 0;
    let fallbackNumber = seatId;
    if (meta) {
      ri = meta.ri;
      // meta.ci är "kolumn i raden" (1,2,3...) som vi kan använda som backupnummer
      fallbackNumber = meta.ci;
    }

    // 2. Gör om radindex (0,1,2,3,...) → bokstav ("A","B","C",...)
    const rowLetter = String.fromCharCode("A".charCodeAt(0) + ri);

    // 3. Försök slå upp det EXAKTA seatNumber från layoutRows (dvs det som faktiskt står på sitsen i salongen)
    //    layoutRows[ri] ska vara raden med alla säten i den raden.
    //    Vi letar efter just det seatId vi fick in.
    const layoutRow = layoutRows[ri];
    if (layoutRow) {
      const seatInThatRow = layoutRow.seats.find((s) => s.id === seatId);
      if (seatInThatRow) {
        return {
          rowLetter,
          seatNumber: seatInThatRow.seatNumber,
        };
      }
    }

    // 4. Fallback om vi inte hittar något i layoutRows (t.ex. första millisekunden innan data hunnit ladda helt)
    return {
      rowLetter,
      seatNumber: fallbackNumber,
    };
  }

  // helper för att hitta rätt ticketType_id baserat på namnet
  function getTicketTypeId(kind: "adult" | "child" | "senior"): number | null {
    const lowerMatch =
      kind === "adult" ? "vuxen" : kind === "child" ? "barn" : "pension"; // funkar för pensionär/pensioner

    const t = ticketTypes.find((tt) =>
      tt.ticketType_name.toLowerCase().includes(lowerMatch)
    );
    return t ? t.id : null;
  }

  // Boka
  async function finalizeBooking(email?: string) {
    if (!sid) {
      alert("Ingen visning vald.");
      return;
    }

    // 1. Sortera de valda stolarna så vi har en stabil ordning
    const chosenSeatsSorted = Array.from(selected).sort((a, b) => a - b);

    // 2. Plocka fram hur många av varje biljettkategori som återstår att fördela
    let remainingAdult = tickets.adult;
    let remainingChild = tickets.child;
    let remainingSenior = tickets.senior;

    // 3. Hämta respektive ticketType_id från ticketTypes
    const adultTypeId = getTicketTypeId("adult");
    const childTypeId = getTicketTypeId("child");
    const seniorTypeId = getTicketTypeId("senior");

    // 4. Bygg payloaden med { seat_id, ticketType_id }
    const seatPayload: { seat_id: number; ticketType_id: number }[] = [];

    for (const seatId of chosenSeatsSorted) {
      if (remainingAdult > 0 && adultTypeId != null) {
        seatPayload.push({ seat_id: seatId, ticketType_id: adultTypeId });
        remainingAdult--;
        continue;
      }
      if (remainingChild > 0 && childTypeId != null) {
        seatPayload.push({ seat_id: seatId, ticketType_id: childTypeId });
        remainingChild--;
        continue;
      }
      if (remainingSenior > 0 && seniorTypeId != null) {
        seatPayload.push({ seat_id: seatId, ticketType_id: seniorTypeId });
        remainingSenior--;
        continue;
      }
    }

    // Sanity check: seatPayload ska ha lika många entries som valda säten
    if (seatPayload.length !== chosenSeatsSorted.length) {
      alert("Kunde inte matcha biljetttyper till platser. Försök igen.");
      return;
    }

    // 5. Skicka POST till riktiga backend-endpointen
    const resp = await fetch(`${API_PREFIX}/makeBooking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screening_id: sid,
        seats: seatPayload,
        // email kan läggas med här om/ när backend stöttar gästbokning,
        // men din nuvarande /makeBooking ignorerar email ändå:
        // guest_email: email,
      }),
    });

    // 6. Krock-hantering (409 = någon hann boka samma plats)
    if (resp.status === 409) {
      const data = await resp.json().catch(() => ({}));
      // backend skickar: 409 { error: "...", ... }
      alert(
        data?.error ||
          "Någon hann före på vissa platser. Välj nya och försök igen."
      );
      // vi kan även välja att ta bort ev. krockade platser här,
      // men din makeBooking ger bara text, inte lista på stolar,
      // så vi kan inte auto-rensa exakt vilka som krockade ännu.
      return;
    }

    if (!resp.ok) {
      // t.ex. 401 "Ej inloggad" om session saknas
      const data = await resp.json().catch(() => null);
      alert(data?.error || "Kunde inte boka just nu.");
      return;
    }

    // 7. Lyckades! Läs svaret
    const data = await resp.json().catch(() => null);

    // Din backend svarar t.ex.:
    // {
    //   "message": "Bokning skapad!",
    //   "booking_id": 9,
    //   "booking_confirmation": "163d78efdb5d9f08",
    //   "total_price": 340,
    //   "screening_id": 2,
    //   "screening_time": "13 okt. 2025 18:00",
    //   "seats": [
    //     { "seat_id": 27, "ticketType_id": 1 },
    //     ...
    //   ]
    // }

    const backendId = data?.booking_id ?? null;
    const confCode = data?.booking_confirmation ?? null;

    // 8. Bygg BookingSummary-objektet vi skickar vidare till onConfirm()
    const chosenScreening = allScreenings.find(
      (s) => s.id === selectedScreeningId
    );
    const showtimeISO = chosenScreening?.screening_time ?? "";

    const booking: BookingSummary = {
      movieId: movieId!, // vi antar att det är valt
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

    // 9. Trigga bekräftelsesidan + ev. stäng modalen
    onConfirm(booking);
    if (showAuth) closeAuth();

    // 10. Navigera till confirm-sidan (nu använder vi booking_id och booking_confirmation)
    if (backendId) {
      const q = new URLSearchParams({ booking_id: String(backendId) });
      if (confCode) q.set("conf", String(confCode));
      navigate(`/confirm?${q.toString()}`, { replace: true });
    } else {
      alert("Bokningen skapades men inget booking_id returnerades.");
    }
  }

  function convertSeats(
    seatNumbers: Set<number>
  ): { row: string; number: number }[] {
    // Gör om varje seatId till { row: "B", number: 7 }
    const arr = Array.from(seatNumbers);
    // sortera dem lite snyggt: först på rad (A,B,C...), sen på seatNumber
    arr.sort((a, b) => {
      const A = getSeatInfo(a);
      const B = getSeatInfo(b);

      // jämför radbokstav först
      if (A.rowLetter < B.rowLetter) return -1;
      if (A.rowLetter > B.rowLetter) return 1;

      // om samma rad → jämför platsnummer
      return A.seatNumber - B.seatNumber;
    });

    // returnera i rätt shape för BookingSummary
    return arr.map((seatId) => {
      const info = getSeatInfo(seatId);
      return {
        row: info.rowLetter,
        number: info.seatNumber,
      };
    });
  }

  function formatSelectedSeatsHuman(): string {
    const arr = Array.from(selected);
    // sortera på samma sätt som i convertSeats
    arr.sort((a, b) => {
      const A = getSeatInfo(a);
      const B = getSeatInfo(b);
      if (A.rowLetter < B.rowLetter) return -1;
      if (A.rowLetter > B.rowLetter) return 1;
      return A.seatNumber - B.seatNumber;
    });
    return arr
      .map((seatId) => {
        const { rowLetter, seatNumber } = getSeatInfo(seatId);
        return rowLetter + seatNumber;
      })
      .join(", ");
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
                      value={movieId ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setMovieId(Number.isFinite(n) ? n : null);
                      }}
                    >
                      {bookableMovies.map((m) => (
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
                    value={selectedScreeningId ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setSelectedScreeningId(Number.isFinite(n) ? n : null);

                      const scr = screeningsForMovie.find(
                        (opt) => opt.value === n
                      );
                      if (scr) {
                        // vi sätter inte längre någon salongIndex,
                        // layout + auditoriumName kommer laddas av useEffect på selectedScreeningId
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
                  {auditoriumName || "–"}
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
                                  aria-label={`Plats ${getSeatLabel(no)}${
                                    isTaken
                                      ? " (upptagen)"
                                      : isActive
                                      ? " (vald)"
                                      : ""
                                  }`}
                                  disabled={disabled}
                                  onClick={() => onToggleSeat(no)}
                                >
                                  {getSeatLabel(no)}
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
                      {selected.size === 0 ? "–" : formatSelectedSeatsHuman()}
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
                    selected.size === 0 ? "inga" : formatSelectedSeatsHuman()
                  }.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth/Checkout modal */}
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
