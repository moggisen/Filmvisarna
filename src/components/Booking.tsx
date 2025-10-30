import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { BookingSummary } from "./types";
import "../styles/booking.scss";

interface BookingProps {
  onConfirm: (booking: BookingSummary) => void;
  onNavigate: (route: "login" | "signup" | "profile") => void;
  authed: boolean;
  isGuest?: boolean;
}

const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

type Movie = { id: number; title: string };
type Screening = {
  id: number;
  screening_time: string;
  movie_id: number;
  auditorium_id: number;
};
type Tickets = { adult: number; child: number; senior: number };
type TicketType = {
  id: number;
  ticketType_name: string;
  ticketType_price: number;
};
type SeatMeta = { ri: number; ci: number };
type LayoutRow = {
  rowIndex: number;
  seats: { id: number; seatNumber: number; taken: boolean }[];
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

// Custom hook för data fetching med normalisering och felhantering
const useApiData = <T,>(
  url: string,
  initialValue: T,
  normalizer?: (data: any) => T
) => {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_PREFIX}${url}`);
        if (!res.ok) {
          throw new Error(
            `Kunde inte hämta ${url}: ${res.status} ${res.statusText}`
          );
        }
        const result = await res.json();
        if (alive) {
          setData(normalizer ? normalizer(result) : result);
          setError(null);
        }
      } catch (e: any) {
        if (alive) {
          console.error(`Error fetching ${url}:`, e);
          setError(e?.message || "Något gick fel");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, normalizer]);

  return { data, loading, error };
};

// Normaliseringsfunktion för filmer
const normalizeMovies = (raw: any): Movie[] => {
  return (Array.isArray(raw) ? raw : []).map((m: any) => ({
    id: Number(m.id ?? m.movie_id ?? m.movieId),
    title: String(m.title ?? m.movie_title ?? m.movieTitle ?? "Okänd film"),
  }));
};

// Custom hook för seat management med "bästa platser" logik
// Custom hook för seat management med "bästa platser" logik
const useSeatManagement = (
  screeningId: number | null,
  layoutRows: LayoutRow[],
  needed: number
) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [occupied, setOccupied] = useState<Set<number>>(new Set());
  const [hasManualSelection, setHasManualSelection] = useState(false);

  const seatStruct = useMemo(() => {
    const indexByRow: number[][] = [];
    const seatMeta = new Map<number, SeatMeta>();
    const takenSet = new Set<number>();

    layoutRows.forEach((row, ri) => {
      const rowSeats: number[] = [];
      row.seats.forEach((seat, ci) => {
        rowSeats.push(seat.id);
        seatMeta.set(seat.id, { ri, ci: ci + 1 });
        if (seat.taken) takenSet.add(seat.id);
      });
      indexByRow.push(rowSeats);
    });

    return { indexByRow, seatMeta, takenSet };
  }, [layoutRows]);

  // Beräkna bästa platsordning (mitten först)
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

  // Hitta sammanhängande block av platser
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

  // SSE för realtidsuppdatering
  useEffect(() => {
    if (!screeningId) return;
    setOccupied(new Set(seatStruct.takenSet));

    const es = new EventSource(
      `${API_PREFIX}/screenings/${screeningId}/seats/stream`
    );
    const handleMessage = (msg: any) => {
      setOccupied((prev) => {
        if (msg.type === "snapshot" && msg.seats) return new Set(msg.seats);
        const next = new Set(prev);
        if (msg.type === "booked" && msg.seats)
          msg.seats.forEach((n: number) => next.add(n));
        if (msg.type === "released" && msg.seats)
          msg.seats.forEach((n: number) => next.delete(n));
        return next;
      });
    };

    es.onmessage = (ev) => handleMessage(JSON.parse(ev.data));
    return () => es.close();
  }, [screeningId, seatStruct.takenSet]);

  // Auto-select bästa platser när behov ändras - FIXED: Respektera manuella val
  useEffect(() => {
    if (hasManualSelection) return; //  STOPP om användaren gjort manuella val

    setSelected(() => {
      const next = new Set<number>();
      if (needed <= 0) return next;

      // Försök hitta sammanhängande block först
      const block = findBestContiguousBlock(needed);
      if (block.length === needed) {
        block.forEach((n) => next.add(n));
      } else {
        // Annars välj bästa individuella platser
        for (const n of bestSeatOrder()) {
          if (next.size >= needed) break;
          next.add(n);
        }
      }
      return next;
    });
  }, [needed, findBestContiguousBlock, bestSeatOrder, hasManualSelection]);

  // Auto-justera när antal biljetter ändras - FIXED: Respektera manuella val
  useEffect(() => {
    if (hasManualSelection) return; //  STOPP om användaren gjort manuella val

    setSelected((prev) => {
      const curr = new Set(prev);
      const diff = needed - curr.size;

      if (diff > 0) {
        const exclude = new Set<number>(curr);
        const block = findBestContiguousBlock(diff, exclude);
        if (block.length === diff) {
          block.forEach((n) => curr.add(n));
        } else {
          for (const n of bestSeatOrder(exclude)) {
            if (curr.size >= needed) break;
            curr.add(n);
          }
        }
      } else if (diff < 0) {
        const arr = Array.from(curr);
        const toRemove = arr.slice(needed);
        toRemove.forEach((n) => curr.delete(n));
      }

      return curr;
    });
  }, [needed, bestSeatOrder, findBestContiguousBlock, hasManualSelection]);

  const toggleSeat = useCallback(
    (seatId: number) => {
      if (occupied.has(seatId)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(seatId)) {
          next.delete(seatId);
        } else if (next.size < needed) {
          next.add(seatId);
        }
        return next;
      });
      setHasManualSelection(true); //  Sätt flaggan vid manuellt val
    },
    [occupied, needed]
  );

  const clearSelected = useCallback(() => {
    setSelected(new Set());
    setHasManualSelection(false); // Återställ flaggan när alla val rensas
  }, []);

  // Uppdaterad setSelected som också hanterar manuella val
  const setSelectedWithManual = useCallback(
    (newSelected: Set<number> | ((prev: Set<number>) => Set<number>)) => {
      setSelected((prev) => {
        const result =
          typeof newSelected === "function" ? newSelected(prev) : newSelected;

        // Om vi sätter platser manuellt (t.ex. från session restore), markera som manuella val
        if (
          result.size > 0 &&
          Array.from(result).some((seatId) => !prev.has(seatId))
        ) {
          setHasManualSelection(true);
        }

        return result;
      });
    },
    []
  );

  return {
    selected,
    occupied,
    seatStruct,
    toggleSeat,
    clearSelected,
    setSelected: setSelectedWithManual, //  Använd den uppdaterade versionen
    hasManualSelection,
  };
};

export default function Booking({
  onConfirm,
  onNavigate,
  authed,
  isGuest = false,
}: BookingProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // State för session tracking
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [sessionId] = useState(
    () => `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // State
  const [movieId, setMovieId] = useState<number | null>(null);
  const [selectedScreeningId, setSelectedScreeningId] = useState<number | null>(
    null
  );
  const [tickets, setTickets] = useState<Tickets>({
    adult: 0,
    child: 0,
    senior: 0,
  });
  const [prices, setPrices] = useState({ adult: 140, child: 80, senior: 120 });
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([]);
  const [auditoriumName, setAuditoriumName] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authStep, setAuthStep] = useState<"choose" | "guest">("choose");
  const [guestEmail, setGuestEmail] = useState("");

  // Data fetching med normalisering - FIXED: Använd env variabel korrekt
  const {
    data: allScreenings,
    loading: loadingScreenings,
    error: screeningsError,
  } = useApiData<Screening[]>("/screenings", []);
  const {
    data: movies,
    loading: loadingMovies,
    error: movieError,
  } = useApiData<Movie[]>("/movies", [], normalizeMovies);
  const {
    data: ticketTypes,
    loading: loadingTicketTypes,
    error: ticketTypesError,
  } = useApiData<TicketType[]>("/ticketTypes", []);

  // Debug: Logga API responses
  useEffect(() => {
    if (screeningsError) {
      console.error("Screenings fetch error:", screeningsError);
    }
    if (movieError) {
      console.error("Movies fetch error:", movieError);
    }
    if (ticketTypesError) {
      console.error("Ticket types fetch error:", ticketTypesError);
    }
  }, [screeningsError, movieError, ticketTypesError]);

  // Beräkna priser från ticket types
  useEffect(() => {
    const newPrices = { adult: 140, child: 80, senior: 120 };
    ticketTypes.forEach((ticket) => {
      const name = ticket.ticketType_name.toLowerCase();
      if (name.includes("vuxen")) newPrices.adult = ticket.ticketType_price;
      if (name.includes("barn")) newPrices.child = ticket.ticketType_price;
      if (name.includes("pension")) newPrices.senior = ticket.ticketType_price;
    });
    setPrices(newPrices);
  }, [ticketTypes]);

  // Beräknade värden
  const needed = tickets.adult + tickets.child + tickets.senior;
  const bookableMovies = useMemo(
    () => movies.filter((m) => allScreenings.some((s) => s.movie_id === m.id)),
    [movies, allScreenings]
  );

  const screeningsForMovie = useMemo(
    () =>
      movieId
        ? allScreenings
            .filter((s) => s.movie_id === movieId)
            .sort(
              (a, b) =>
                new Date(a.screening_time).getTime() -
                new Date(b.screening_time).getTime()
            )
            .map((s) => ({
              value: s.id,
              label: new Date(s.screening_time).toLocaleString("sv-SE", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }),
              raw: s,
            }))
        : [],
    [allScreenings, movieId]
  );

  // Auto-välj första film och screening ENDAST om inget är valt OCH data är laddad
  useEffect(() => {
    // Vänta tills movieId inte är satt, OCH det finns filmer, OCH vi inte har någon session att återställa
    if (!movieId && bookableMovies.length > 0 && hasRestoredSession) {
      setMovieId(bookableMovies[0].id);
    }
  }, [movieId, bookableMovies, hasRestoredSession]);

  useEffect(() => {
    // Vänta tills selectedScreeningId inte är satt, OCH det finns visningar, OCH vi inte har någon session att återställa
    if (
      !selectedScreeningId &&
      movieId &&
      screeningsForMovie.length > 0 &&
      hasRestoredSession
    ) {
      setSelectedScreeningId(screeningsForMovie[0].value);
    }
  }, [movieId, screeningsForMovie, selectedScreeningId, hasRestoredSession]);

  // Hämta layout för vald screening
  useEffect(() => {
    if (!selectedScreeningId) return;

    (async () => {
      try {
        const resp = await fetch(
          `${API_PREFIX}/screenings/${selectedScreeningId}/layout`
        );
        if (!resp.ok) throw new Error("Kunde inte hämta layout");
        const data: ScreeningLayoutResponse = await resp.json();
        setLayoutRows(data.rows || []);
        setAuditoriumName(data.auditorium_name || "");
      } catch (err) {
        console.error("Fel vid hämtning av layout:", err);
        setLayoutRows([]);
        setAuditoriumName("");
      }
    })();
  }, [selectedScreeningId]);

  // Seat management - FIXED: setSelected är nu tillgänglig
  const {
    selected,
    occupied,
    seatStruct,
    toggleSeat,
    clearSelected,
    setSelected,
    hasManualSelection,
  } = useSeatManagement(selectedScreeningId, layoutRows, needed);

  // Viewport fitting
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const fitSeatsToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!vp || !stage) return;

    const contentW = stage.scrollWidth;
    const contentH = stage.scrollHeight;
    const availW = vp.clientWidth;
    const scale = Math.min(availW / contentW, 1);
    const offsetX = Math.max((availW - contentW * scale) / 2, 0);

    stage.style.transform = `translate(${offsetX}px, 0) scale(${scale})`;
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(fitSeatsToViewport);
    return () => cancelAnimationFrame(id);
  }, [fitSeatsToViewport, selectedScreeningId, layoutRows]);

  useEffect(() => {
    window.addEventListener("resize", fitSeatsToViewport);
    return () => window.removeEventListener("resize", fitSeatsToViewport);
  }, [fitSeatsToViewport]);

  // Helper functions
  const getMovieTitle = (id: number | null) =>
    movies.find((m) => m.id === id)?.title ?? "";

  const getSeatInfo = (seatId: number) => {
    const meta = seatStruct.seatMeta.get(seatId);
    if (!meta) return { rowLetter: "A", seatNumber: seatId };

    const rowLetter = String.fromCharCode("A".charCodeAt(0) + meta.ri);
    const layoutRow = layoutRows[meta.ri];
    const seat = layoutRow?.seats.find((s) => s.id === seatId);

    return {
      rowLetter,
      seatNumber: seat?.seatNumber ?? meta.ci,
    };
  };

  const getSeatLabel = (seatId: number) => {
    const { rowLetter, seatNumber } = getSeatInfo(seatId);
    return rowLetter + seatNumber;
  };

  const formatSelectedSeats = () =>
    Array.from(selected)
      .sort((a, b) => {
        const A = getSeatInfo(a);
        const B = getSeatInfo(b);
        return (
          A.rowLetter.localeCompare(B.rowLetter) || A.seatNumber - B.seatNumber
        );
      })
      .map(getSeatLabel)
      .join(", ");

  const ticketTotal =
    tickets.adult * prices.adult +
    tickets.child * prices.child +
    tickets.senior * prices.senior;

  // Viktig funktion för att hitta ticketType_id
  const getTicketTypeId = (
    kind: "adult" | "child" | "senior"
  ): number | null => {
    const lowerMatch =
      kind === "adult" ? "vuxen" : kind === "child" ? "barn" : "pension";

    const t = ticketTypes.find((tt) =>
      tt.ticketType_name.toLowerCase().includes(lowerMatch)
    );
    return t ? t.id : null;
  };

  // Förbättrad session sparning
  const saveBookingSession = useCallback(() => {
    const hasStartedBooking =
      tickets.adult > 0 ||
      tickets.child > 0 ||
      tickets.senior > 0 ||
      selected.size > 0;

    if (!hasStartedBooking) {
      sessionStorage.removeItem("pendingBooking");
      localStorage.removeItem(`bookingSession_${sessionId}`);
      localStorage.removeItem("lastBookingSession");
      return;
    }

    const sessionData = {
      movieId,
      selectedScreeningId,
      tickets,
      seats: Array.from(selected),
      manuallySelectedSeats: Array.from(selected),
      hasManualSelection: hasManualSelection, //  Använd den riktiga flaggan
      timestamp: Date.now(),
      sessionId,
    };

    sessionStorage.setItem("pendingBooking", JSON.stringify(sessionData));
    localStorage.setItem(
      `bookingSession_${sessionId}`,
      JSON.stringify(sessionData)
    );
    localStorage.setItem("lastBookingSession", sessionId);
  }, [
    movieId,
    selectedScreeningId,
    tickets,
    selected,
    hasManualSelection,
    sessionId,
  ]);

  // Förbättrad session återställning
  // Förbättrad session återställning
  const restoreBookingSession = useCallback(() => {
    if (hasRestoredSession) return false;

    //  VIKTIGT: Vänta tills allScreenings har laddats
    if (allScreenings.length === 0) {
      return false;
    }

    const savedScreeningId = localStorage.getItem("selectedScreeningId");

    const sessionData = sessionStorage.getItem("pendingBooking");
    if (sessionData) {
      try {
        const data = JSON.parse(sessionData);
        const isExpired = Date.now() - data.timestamp > 30 * 60 * 1000;

        if (!isExpired) {
          setMovieId(data.movieId);
          setSelectedScreeningId(data.selectedScreeningId);
          setTickets(data.tickets);

          if (
            data.manuallySelectedSeats &&
            data.manuallySelectedSeats.length > 0
          ) {
            setSelected(new Set(data.manuallySelectedSeats));
          } else if (data.seats) {
            setSelected(new Set(data.seats));
          }

          setHasRestoredSession(true);
          return true;
        } else {
          sessionStorage.removeItem("pendingBooking");
        }
      } catch (error) {
        console.error("Error restoring session:", error);
      }
    }

    //  Kolla om vi har en screening från detaljsidan
    if (savedScreeningId) {
      const screeningId = Number(savedScreeningId);

      const screening = allScreenings.find((s) => s.id === screeningId);

      if (screening) {
        setMovieId(screening.movie_id);
        setSelectedScreeningId(screeningId);

        // Rensa localStorage efter användning
        localStorage.removeItem("selectedScreeningId");
        localStorage.removeItem("selectedScreeningTime");
        localStorage.removeItem("selectedAuditoriumId");

        setHasRestoredSession(true);
        return true;
      } else {
      }
    }

    // Rensa localStorage om session är utgången
    const lastSessionId = localStorage.getItem("lastBookingSession");
    if (lastSessionId) {
      const backupData = localStorage.getItem(
        `bookingSession_${lastSessionId}`
      );
      if (backupData) {
        try {
          const data = JSON.parse(backupData);
          const isExpired = Date.now() - data.timestamp > 30 * 60 * 1000;
          if (isExpired) {
            localStorage.removeItem(`bookingSession_${lastSessionId}`);
            localStorage.removeItem("lastBookingSession");
          }
        } catch (error) {
          console.error("Error checking localStorage session:", error);
        }
      }
    }

    setHasRestoredSession(true);
    console.log(" No session to restore - using auto-select");
    return false;
  }, [hasRestoredSession, setSelected, allScreenings]);

  useEffect(() => {
    if (hasRestoredSession) return;

    const savedScreeningId = localStorage.getItem("selectedScreeningId");
    if (savedScreeningId && allScreenings.length > 0) {
      const screeningId = Number(savedScreeningId);
      const screening = allScreenings.find((s) => s.id === screeningId);

      if (screening) {
        setMovieId(screening.movie_id);
        setSelectedScreeningId(screeningId);

        // Rensa localStorage efter användning
        localStorage.removeItem("selectedScreeningId");
        localStorage.removeItem("selectedScreeningTime");
        localStorage.removeItem("selectedAuditoriumId");

        setHasRestoredSession(true);
      }
    }
  }, [allScreenings, hasRestoredSession]);

  // Auto-save när state ändras
  useEffect(() => {
    if (hasRestoredSession) {
      saveBookingSession();
    }
  }, [
    movieId,
    selectedScreeningId,
    tickets,
    selected,
    hasRestoredSession,
    saveBookingSession,
  ]);

  // Restore session på mount
  useEffect(() => {
    const restored = restoreBookingSession();

    if (restored) {
      console.log("Booking session restored successfully");
    }
  }, [restoreBookingSession]);

  // Hantera när användaren kommer tillbaka från auth
  // I Booking.tsx - Uppdatera auth restoration effect
  useEffect(() => {
    // Kolla om vi precis kom tillbaka från en auth flow
    const shouldRestore = sessionStorage.getItem("shouldRestoreBooking");
    const savedSessionId = sessionStorage.getItem("bookingSessionId");
    const isAuthNavigation = sessionStorage.getItem("isAuthNavigation");

    if (shouldRestore === "true" && savedSessionId === sessionId) {
      console.log("Auth flow completed - restoring booking session");

      //  Restore session först
      restoreBookingSession();

      //  Rensa flaggor EFTER restore är klar
      setTimeout(() => {
        sessionStorage.removeItem("shouldRestoreBooking");
        sessionStorage.removeItem("bookingSessionId");
        sessionStorage.removeItem("isAuthNavigation");
        console.log("Auth flags cleared");
      }, 100);
    }
  }, [sessionId, restoreBookingSession]);

  useEffect(() => {
    return () => {
      //  Lösning 2b: Smart cleanup som respekterar auth flow
      // Kolla om vi navigerar AWAY från booking eller TO auth
      const shouldRestoreBooking = sessionStorage.getItem(
        "shouldRestoreBooking"
      );
      const isAuthNavigation = sessionStorage.getItem("isAuthNavigation");

      //  Rensa ENDAST om vi inte går till auth flow
      if (!shouldRestoreBooking && !isAuthNavigation) {
        console.log(
          "Cleaning up booking session - normal navigation away from booking"
        );
        sessionStorage.removeItem("pendingBooking");
        sessionStorage.removeItem("bookingSessionId");

        const lastSessionId = localStorage.getItem("lastBookingSession");
        if (lastSessionId) {
          localStorage.removeItem(`bookingSession_${lastSessionId}`);
          localStorage.removeItem("lastBookingSession");
        }
      } else {
        console.log("Preserving booking session - auth navigation detected");
      }
    };
  }, []);

  // Booking functions
  const finalizeBooking = async (email?: string) => {
    if (!selectedScreeningId) {
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

    //  Guest booking logic
    const bookingPayload: any = {
      screening_id: selectedScreeningId,
      seats: seatPayload,
    };

    // Om email finns (guest booking), lägg till den
    if (email && !authed) {
      bookingPayload.guest_email = email;
    }

    // 5. Skicka POST till riktiga backend-endpointen
    const resp = await fetch(`${API_PREFIX}/makeBooking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(bookingPayload),
    });

    // 6. Krock-hantering (409 = någon hann boka samma plats)
    if (resp.status === 409) {
      const data = await resp.json().catch(() => ({}));
      alert(
        data?.error ||
          "Någon hann före på vissa platser. Välj nya och försök igen."
      );
      return;
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      alert(data?.error || "Kunde inte boka just nu.");
      return;
    }

    // 7. Lyckades! Läs svaret
    const data = await resp.json().catch(() => null);

    const backendId = data?.booking_id ?? null;
    const confCode = data?.booking_confirmation ?? null;
    const isGuestBooking = data?.is_guest ?? false;

    // 8. Bygg BookingSummary-objektet vi skickar vidare till onConfirm()
    const chosenScreening = allScreenings.find(
      (s) => s.id === selectedScreeningId
    );
    const showtimeISO = chosenScreening?.screening_time ?? "";

    const booking: BookingSummary = {
      movieId: movieId!,
      movieTitle: getMovieTitle(movieId),
      tickets: {
        vuxen: tickets.adult,
        barn: tickets.child,
        pensionar: tickets.senior,
      },
      seats: Array.from(selected).map((seatId) => {
        const { rowLetter, seatNumber } = getSeatInfo(seatId);
        return { row: rowLetter, number: seatNumber };
      }),
      total: ticketTotal,
      bookingId: backendId
        ? String(backendId)
        : "M-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      showtime: showtimeISO,
      isGuestBooking: isGuestBooking,
      guestEmail: email,
    };

    // 9. Trigga bekräftelsesidan + ev. stäng modalen
    onConfirm(booking);
    if (showAuth) closeAuth();

    // 10. Rensa sessioner efter genomförd bokning
    sessionStorage.removeItem("pendingBooking");
    sessionStorage.removeItem("shouldRestoreBooking");
    sessionStorage.removeItem("bookingSessionId");

    const lastSessionId = localStorage.getItem("lastBookingSession");
    if (lastSessionId) {
      localStorage.removeItem(`bookingSession_${lastSessionId}`);
      localStorage.removeItem("lastBookingSession");
    }

    // 11. Navigera till confirm-sidan med korrekta parametrar
    if (backendId) {
      const q = new URLSearchParams({ booking_id: String(backendId) });
      if (confCode) q.set("conf", String(confCode));
      if (isGuestBooking && email) {
        q.set("guest", "true");
        q.set("email", encodeURIComponent(email));
      }
      navigate(`/confirm?${q.toString()}`, { replace: true });
    } else {
      alert("Bokningen skapades men inget booking_id returnerades.");
    }
  };

  const openAuth = () => {
    if (authed) void finalizeBooking();
    else {
      setAuthStep("choose");
      setShowAuth(true);
    }
  };

  const closeAuth = () => {
    setShowAuth(false);
    setGuestEmail("");
    setAuthStep("choose");
  };

  const handleAuthAction = useCallback(
    (type: "login" | "signup") => {
      // Spara aktuell session
      saveBookingSession();

      // Spara return URL med session ID
      const returnTo = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem("returnTo", returnTo);
      sessionStorage.setItem("bookingSessionId", sessionId);
      sessionStorage.setItem("shouldRestoreBooking", "true");

      sessionStorage.setItem("isAuthNavigation", "true");

      console.log("Auth navigation started:", {
        type,
        returnTo,
        sessionId,
        hasBookingData: !!movieId || selected.size > 0,
      });

      // Navigera till auth
      onNavigate(type);
    },
    [saveBookingSession, location, sessionId, onNavigate]
  );

  const handleCancel = () => {
    setTickets({ adult: 0, child: 0, senior: 0 });
    clearSelected();
  };

  return (
    <>
      <div className="booking container-fluid py-4">
        <div className="row g-4 align-items-stretch">
          {/* Left panel */}
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
                      onChange={(e) =>
                        setMovieId(Number(e.target.value) || null)
                      }
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
                  {loadingScreenings ? (
                    <div className="form-control-plaintext">
                      Laddar visningar…
                    </div>
                  ) : screeningsError ? (
                    <div className="text-danger small">
                      Kunde inte ladda visningar
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={selectedScreeningId ?? ""}
                      onChange={(e) =>
                        setSelectedScreeningId(Number(e.target.value) || null)
                      }
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
                  )}
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
                    setTickets((t) => ({ ...t, adult: Math.max(0, v) }))
                  }
                />
                <TicketRow
                  label="Barn"
                  price={prices.child}
                  value={tickets.child}
                  onChange={(v) =>
                    setTickets((t) => ({ ...t, child: Math.max(0, v) }))
                  }
                />
                <TicketRow
                  label="Pensionär"
                  price={prices.senior}
                  value={tickets.senior}
                  onChange={(v) =>
                    setTickets((t) => ({ ...t, senior: Math.max(0, v) }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="col-lg-8">
            <div className="card booking-panel h-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <span className="fw-semibold">Salong – platser</span>
                <small className="hidden-text">Välj dina platser</small>
              </div>

              <div className="card-body">
                <div className="seat-viewport" ref={viewportRef}>
                  <div className="seat-stage" ref={stageRef}>
                    <div className="screenbar" />
                    <div className="seat-grid" aria-label="Salsplatser">
                      {seatStruct.indexByRow.map((rowNos, ri) => (
                        <div className="seat-row" key={ri}>
                          <div className="row-inner">
                            {rowNos.map((no) => {
                              const isTaken = occupied.has(no);
                              const isActive = selected.has(no);
                              return (
                                <button
                                  key={no}
                                  type="button"
                                  className={`seat ${
                                    isTaken
                                      ? "seat-taken"
                                      : isActive
                                      ? "seat-active"
                                      : ""
                                  }`}
                                  aria-pressed={isActive}
                                  disabled={
                                    isTaken ||
                                    (!isActive && selected.size >= needed)
                                  }
                                  onClick={() => toggleSeat(no)}
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

                <div className="mt-3 d-flex align-items-center justify-content-between">
                  <div>
                    <div className="small hidden-text">Valda platser</div>
                    <div className="fw-semibold">
                      {selected.size === 0 ? "–" : formatSelectedSeats()}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="small hidden-text">Totalt</div>
                    <div className="h4 mb-0">{fmtSEK(ticketTotal)}</div>
                  </div>
                </div>

                <div className="mt-3 d-flex gap-2 justify-content-end">
                  <button
                    className="btn btn-dark btn-cancel"
                    onClick={handleCancel}
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && !authed && (
        <AuthModal
          step={authStep}
          guestEmail={guestEmail}
          onChangeEmail={setGuestEmail}
          onClose={closeAuth}
          onPickGuest={() => setAuthStep("guest")}
          onLogin={() => handleAuthAction("login")}
          onSignup={() => handleAuthAction("signup")}
          onConfirmGuest={() => {
            if (!/\S+@\S+\.\S+/.test(guestEmail))
              return alert("Ange en giltig e-postadress.");
            finalizeBooking(guestEmail);
          }}
        />
      )}
    </>
  );
}

// AuthModal med session support
function AuthModal(props: {
  step: "choose" | "guest";
  guestEmail: string;
  onChangeEmail: (s: string) => void;
  onClose: () => void;
  onPickGuest: () => void;
  onLogin: () => void;
  onSignup: () => void;
  onConfirmGuest: () => void;
}) {
  const {
    step,
    guestEmail,
    onChangeEmail,
    onClose,
    onPickGuest,
    onLogin,
    onSignup,
    onConfirmGuest,
  } = props;

  const handleLogin = () => {
    // Sätt flagga för att restore session när användaren kommer tillbaka
    sessionStorage.setItem("shouldRestoreBooking", "true");
    onLogin();
  };

  const handleSignup = () => {
    // Sätt flagga för att restore session när användaren kommer tillbaka
    sessionStorage.setItem("shouldRestoreBooking", "true");
    onSignup();
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal d-block" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Fortsätt för att boka</h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            {step === "choose" && (
              <div className="modal-body">
                <p className="mb-3">
                  Välj hur du vill fortsätta. Dina val sparas så du kan
                  återvända.
                </p>
                <div className="d-grid gap-2">
                  <button className="btn btn-primary" onClick={handleLogin}>
                    Logga in
                  </button>
                  <button className="btn btn-primary" onClick={handleSignup}>
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
          onClick={() => onChange(value - 1)}
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
