import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";

import type {
  BookingSummary,
  Screening,
  Tickets,
  TicketType,
  SeatMeta,
  LayoutRow,
  ScreeningLayoutResponse,
  Movie,
} from "./types";

import "../styles/booking.scss";
import AgeTooltip from "./ageTooltip";
import SeatLegend from "./booking/SeatLegend";
import TicketRow from "./booking/TicketRow";
import SeatPickerMobile from "./booking/SeatPickerMobile";
import SeatGridDesktop from "./booking/SeatGridDesktop";
import AuthModal from "./booking/AuthModal";

import useApiData from "../hooks/useApiData";
import {
  fmtSEK,
  isFuture,
  getSeatInfo,
  getSeatLabel,
  formatSelectedSeats,
} from "./booking/bookingHelpers";

interface BookingProps {
  onConfirm: (booking: BookingSummary) => void;
  onNavigate: (route: "login" | "signup" | "profile") => void;
  authed: boolean;
  isGuest?: boolean;
}

const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

// Normaliseringsfunktion för filmer
const normalizeMovies = (raw: any): Movie[] => {
  return (Array.isArray(raw) ? raw : []).map((m: any) => ({
    id: Number(m.id ?? m.movie_id ?? m.movieId),
    title: String(m.title ?? m.movie_title ?? m.movieTitle ?? "Okänd film"),
  }));
};

// Custom hook för seat management med "bästa platser" logik
const useSeatManagement = (
  screeningId: number | null,
  layoutRows: LayoutRow[],
  needed: number,
  sessionId: string
) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [occupied, setOccupied] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Map<number, string>>(new Map());
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [heldByOthers, setHeldByOthers] = useState<Set<number>>(new Set());

  // uppdatera heldByOthers när held eller sessionId ändras
  useEffect(() => {
    const s = new Set<number>();
    held.forEach((sessId, seatId) => {
      if (sessId !== sessionId) s.add(seatId);
    });
    setHeldByOthers(s);
  }, [held, sessionId]);

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

  const bestSeatOrder = useCallback(
    (exclude?: Set<number>) => {
      const rowCenter = Math.floor(seatStruct.indexByRow.length / 2);
      const weightRow = 2.0;
      const scored: { no: number; dist: number }[] = [];

      seatStruct.seatMeta.forEach(({ ri, ci }, no) => {
        // hoppa över platser som är bokade ELLER hålls av någon annan
        if (occupied.has(no) || heldByOthers.has(no)) return;
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
    [occupied, heldByOthers, seatStruct.indexByRow, seatStruct.seatMeta]
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
            (no) =>
              !occupied.has(no) &&
              !heldByOthers.has(no) && // 👈 NY
              !exclude?.has(no)
          );
          if (ok) return segment;
        }
      }
      return [] as number[];
    },
    [occupied, heldByOthers, seatStruct.indexByRow]
  );

  const gotSnapshotRef = useRef(false);

  useEffect(() => {
    if (!screeningId) return;

    // Seed: permanenta bokningar från layout
    setOccupied(new Set(seatStruct.takenSet));

    // Vi nollställer “held” lokalt när screening byts,
    // och markerar att vi ännu INTE har tagit emot snapshot.
    setHeld(new Map());
    gotSnapshotRef.current = false;

    const es = new EventSource(
      `${API_PREFIX}/bookings/stream?screeningId=${screeningId}`
    );

    // Viktigt: detta snapshot ska bara användas EN gång per anslutning.
    const onSnapshot = (e: MessageEvent) => {
      // Har vi redan lagt in snapshot? Då IGNORERAR vi detta (förhindrar blink).
      if (gotSnapshotRef.current) return;

      const arr = JSON.parse(e.data) as Array<{
        seatId: number | string;
        sessionId: string;
        expiresAt: number;
      }>;

      const map = new Map<number, string>();
      for (const h of arr) {
        map.set(Number(h.seatId), String(h.sessionId));
      }

      setHeld(map);
      gotSnapshotRef.current = true; // lås: snapshot är “konsumerat”
    };

    const onSeatHeld = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as {
        seatId: number | string;
        sessionId: string;
        expiresAt: number;
      };
      setHeld((prev) => {
        const next = new Map(prev);
        next.set(Number(ev.seatId), String(ev.sessionId));
        return next;
      });
    };

    const onSeatReleased = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as {
        seatId: number | string;
        reason?: string;
      };
      setHeld((prev) => {
        const next = new Map(prev);
        next.delete(Number(ev.seatId));
        return next;
      });
    };

    const onSeatBooked = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as {
        seatIds?: Array<number | string>;
        seatId?: number | string;
      };

      const ids: Array<number | string> = Array.isArray(ev.seatIds)
        ? ev.seatIds
        : ev.seatId !== undefined
        ? [ev.seatId]
        : [];

      if (ids.length === 0) return;

      setOccupied((prev) => {
        const next = new Set(prev);
        ids.forEach((id: number | string) => next.add(Number(id)));
        return next;
      });

      setHeld((prev) => {
        const next = new Map(prev);
        ids.forEach((id: number | string) => next.delete(Number(id)));
        return next;
      });

      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id: number | string) => next.delete(Number(id)));
        return next;
      });
    };

    es.addEventListener("snapshot", onSnapshot);
    es.addEventListener("seat:held", onSeatHeld);
    es.addEventListener("seat:released", onSeatReleased);
    es.addEventListener("seat:booked", onSeatBooked);

    es.onerror = () => {
      // EventSource försöker reconnecta själv – inget att göra här.
    };

    return () => {
      es.removeEventListener("snapshot", onSnapshot as any);
      es.removeEventListener("seat:held", onSeatHeld as any);
      es.removeEventListener("seat:released", onSeatReleased as any);
      es.removeEventListener("seat:booked", onSeatBooked as any);
      es.close();
    };
  }, [screeningId, seatStruct.takenSet]);

  const markAsBooked = useCallback((ids: number[]) => {
    if (!ids || ids.length === 0) return;

    setOccupied((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(Number(id)));
      return next;
    });

    setHeld((prev) => {
      const next = new Map(prev);
      ids.forEach((id) => next.delete(Number(id)));
      return next;
    });

    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(Number(id)));
      return next;
    });
  }, []);

  // Förläng mina holds periodiskt så de inte hinner gå ut under flödet
  useEffect(() => {
    if (!screeningId) return;

    const interval = setInterval(() => {
      if (selected.size === 0) return;
      selected.forEach((seatId) => {
        // Skicka extend bara för platser som faktiskt är mina
        const holder = held.get(seatId);
        if (holder && holder === sessionId) {
          fetch(
            `${API_PREFIX}/screenings/${screeningId}/seats/${seatId}/hold`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "extend", sessionId }),
            }
          ).catch(() => {});
        }
      });
    }, 60_000); // 60 s – matcha TTL/2 typ

    return () => clearInterval(interval);
  }, [screeningId, selected, held, sessionId]);

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

  useEffect(() => {
    if (hasManualSelection) return;
    // Kör bara auto-select om vi INTE redan har val
    if (selected.size > 0) return;

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
    needed,
    findBestContiguousBlock,
    bestSeatOrder,
    hasManualSelection,
    selected.size,
  ]);

  // När man går ner till 0 biljetter vill vi att autoväljaren ska kunna starta om
  useEffect(() => {
    if (needed === 0) {
      setHasManualSelection(false);
    }
  }, [needed]);

  const toggleSeat = useCallback(
    (seatId: number) => {
      if (!screeningId) return;
      if (needed === 0) return; // NY RAD: inga biljetter → ingen seat
      if (occupied.has(seatId)) return; // redan bokad
      if (held.has(seatId) && held.get(seatId) !== sessionId) return; // hålls av annan

      setHasManualSelection(true);

      setSelected((prev) => {
        const next = new Set(prev);
        const wasSelected = next.has(seatId);

        if (wasSelected) {
          next.delete(seatId);
          // optimistisk release
          fetch(
            `${API_PREFIX}/screenings/${screeningId}/seats/${seatId}/hold`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "release", sessionId }),
            }
          ).catch(() => {});
        } else if (next.size < needed) {
          next.add(seatId);
          // optimistisk hold
          fetch(
            `${API_PREFIX}/screenings/${screeningId}/seats/${seatId}/hold`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "hold", sessionId }),
            }
          ).catch(() => {});
        }
        return next;
      });
    },
    [occupied, held, needed, screeningId, sessionId]
  );

  const setSelectedWithManual = useCallback(
    (newSelected: Set<number> | ((prev: Set<number>) => Set<number>)) => {
      setSelected((prev) => {
        const result =
          typeof newSelected === "function" ? newSelected(prev) : newSelected;

        if (
          result.size > 0 &&
          Array.from(result).some((seatId) => !prev.has(seatId))
        ) {
          // ➜ Vi har fått nya platser (manuell förändring) → stäng av autoväljaren
          setHasManualSelection(true);
        } else if (result.size === 0) {
          // ➜ Alla platser är borttagna → slå PÅ autoväljaren igen
          setHasManualSelection(false);
        }

        return result;
      });
    },
    []
  );

  const clearSelected = useCallback(() => {
    setSelected(new Set());
    setHasManualSelection(false);
  }, []);

  return {
    selected,
    occupied,
    held,
    seatStruct,
    toggleSeat,
    clearSelected,
    setSelected: setSelectedWithManual,
    hasManualSelection,
    markAsBooked, // lägg till
  };
};

export default function Booking({
  onConfirm,
  onNavigate,
  authed,
}: BookingProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // State för session tracking
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [sessionId] = useState(
    () => `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // SearchParams
  const [searchParams, setSearchParams] = useSearchParams();

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

  const { data: ticketTypes, error: ticketTypesError } = useApiData<
    TicketType[]
  >("/ticketTypes", []);

  const futureScreenings = useMemo(
    () => allScreenings.filter((s) => isFuture(s.screening_time)),
    [allScreenings]
  );

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
    () =>
      movies.filter((m) => futureScreenings.some((s) => s.movie_id === m.id)),
    [movies, futureScreenings]
  );

  const screeningsForMovie = useMemo(
    () =>
      movieId
        ? futureScreenings
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
    [futureScreenings, movieId]
  );

  // Hämta preselected movie från navigation state
  useEffect(() => {
    const state = location.state as { preselectedMovieId?: number } | null;
    if (state?.preselectedMovieId && !hasRestoredSession) {
      setMovieId(state.preselectedMovieId);
      setHasRestoredSession(true);
      // Rensa state så det inte påverkar vid refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, hasRestoredSession]);

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
    held,
    seatStruct,
    toggleSeat,
    clearSelected,
    setSelected,
    hasManualSelection,
    markAsBooked,
  } = useSeatManagement(selectedScreeningId, layoutRows, needed, sessionId);

  // --- release helpers (Booking-scope) ---
  const releaseSeat = (scrId: number, seatId: number) =>
    fetch(`${API_PREFIX}/screenings/${scrId}/seats/${seatId}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "release", sessionId }),
    }).catch(() => {});

  const releaseAllSelected = useCallback(() => {
    if (!selectedScreeningId || selected.size === 0) return;
    selected.forEach((seatId) => {
      if (held.get(seatId) === sessionId) {
        releaseSeat(selectedScreeningId, seatId);
      }
    });
  }, [selectedScreeningId, selected, held, sessionId]);

  useEffect(() => {
    const onUnload = () => releaseAllSelected();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [releaseAllSelected]);

  // Egen variant för UI som även släpper på servern
  const clearSelectedAndRelease = useCallback(() => {
    releaseAllSelected();
    setSelected(new Set());
    // vi vill också avsluta “manuellt-val”-läge
    // den flaggan sätts inne i hooken via setSelectedWithManual,
    // men att nollställa selected räcker för att auto-select ska kunna köra igen
  }, [releaseAllSelected, setSelected]);

  useEffect(() => {
    // När man väljer 0 biljetter vill vi:
    // - släppa alla holds på servern
    // - tömma alla valda platser i UI
    if (needed === 0 && selected.size > 0) {
      clearSelectedAndRelease();
    }
  }, [needed, selected, clearSelectedAndRelease]);

  // Om needed minskar och vi har fler val än tillåtet → släpp de sämst rankade först
  useEffect(() => {
    if (!selectedScreeningId) return;

    // Viktigt: rensa inte ner till 0 när inga biljetter är valda
    if (needed === 0) return;

    if (selected.size <= needed) return;

    // Rang: radindex (ri) väger tyngre än kolumn (ci) – stabil och deterministisk
    const rank = (seatId: number) => {
      const meta = seatStruct.seatMeta.get(seatId);
      if (!meta) return Number.MAX_SAFE_INTEGER;
      return meta.ri * 1000 + meta.ci;
    };

    const current = Array.from(selected).sort((a, b) => rank(a) - rank(b));
    const keepCount = Math.max(0, needed);
    const keep = new Set(current.slice(0, keepCount));
    const drop = current.slice(keepCount);

    // Släpp överskott hos servern om de är mina
    drop.forEach((seatId) => {
      if (held.get(seatId) === sessionId) {
        releaseSeat(selectedScreeningId, seatId);
      }
    });

    setSelected(keep);
  }, [
    needed,
    selected,
    selectedScreeningId,
    seatStruct.seatMeta,
    held,
    sessionId,
    setSelected,
  ]);

  // Debouncad sync: klumpar ihop lokala val → server-holds
  useEffect(() => {
    if (!selectedScreeningId) return;

    let timer: number | undefined;

    const run = () => {
      // vilka säten håller JAG just nu (enligt SSE)?
      const mine = new Set<number>();
      held.forEach((sessId, seatId) => {
        if (sessId === sessionId) mine.add(seatId);
      });

      // diff
      const toHold: number[] = [];
      selected.forEach((seatId) => {
        if (!mine.has(seatId)) toHold.push(seatId);
      });

      const toRelease: number[] = [];
      mine.forEach((seatId) => {
        if (!selected.has(seatId)) toRelease.push(seatId);
      });

      if (toHold.length === 0 && toRelease.length === 0) return;

      // batcha ut, men idempotent (backend ska tåla dubletter)
      toHold.forEach((seatId) => {
        fetch(
          `${API_PREFIX}/screenings/${selectedScreeningId}/seats/${seatId}/hold`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "hold", sessionId }),
          }
        ).catch(() => {});
      });

      toRelease.forEach((seatId) => {
        fetch(
          `${API_PREFIX}/screenings/${selectedScreeningId}/seats/${seatId}/hold`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "release", sessionId }),
          }
        ).catch(() => {});
      });
    };

    // debounce ~180ms så snabb klicksekvens + auto-logik klumpas
    timer = window.setTimeout(run, 180);

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [selected, held, selectedScreeningId, sessionId]);

  // Synka visning när filmen byts (för att omrendera salongslayout)
  useEffect(() => {
    if (movieId == null || screeningsForMovie.length === 0) return;

    const validIds = new Set(screeningsForMovie.map((s) => s.value));

    if (!selectedScreeningId || !validIds.has(selectedScreeningId)) {
      const firstId = screeningsForMovie[0]?.value ?? null;
      setSelectedScreeningId(firstId);
      // Rensa tidigare manuella platser från föregående visning
      clearSelected();
    }
  }, [movieId, screeningsForMovie, selectedScreeningId, clearSelected]);

  // Rensa platser när visningen faktiskt byts
  useEffect(() => {
    if (selectedScreeningId != null) {
      clearSelected();
    }
  }, [selectedScreeningId, clearSelected]);

  // Viewport fitting
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const fitSeatsToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!vp || !stage) return;

    const contentW = stage.scrollWidth;
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

  const ticketTotal =
    tickets.adult * prices.adult +
    tickets.child * prices.child +
    tickets.senior * prices.senior;

  // Funktion för att hitta ticketType_id
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
  const restoreBookingSession = useCallback(() => {
    if (hasRestoredSession) return false;

    //  VIKTIGT: Vänta tills allScreenings har laddats
    if (allScreenings.length === 0) {
      return false;
    }
    // Kolla URL-parametrar FÖRST
    const urlMovieId = searchParams.get("movie");
    const urlScreeningId = searchParams.get("screening");

    if (urlMovieId || urlScreeningId) {
      if (urlMovieId) setMovieId(Number(urlMovieId));
      if (urlScreeningId) setSelectedScreeningId(Number(urlScreeningId));
      setHasRestoredSession(true);
      return true;
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

  // Om valt screeningId är i det förflutna (efter t.ex. session restore), byt till första framtida
  useEffect(() => {
    if (!selectedScreeningId) return;
    const curr = allScreenings.find((s) => s.id === selectedScreeningId);
    if (!curr) return;

    // Om nuvarande visning är dåtid, välj nästkommande framtida visning för samma film, annars låt vara
    if (!isFuture(curr.screening_time)) {
      const nextForSameMovie = futureScreenings
        .filter((s) => s.movie_id === curr.movie_id)
        .sort(
          (a, b) =>
            new Date(a.screening_time).getTime() -
            new Date(b.screening_time).getTime()
        )[0];

      if (nextForSameMovie) {
        setSelectedScreeningId(nextForSameMovie.id);
      } else {
        // Töm screening om det inte finns några kommande visningar för samma film
        setSelectedScreeningId(null);
      }
    }
  }, [selectedScreeningId, allScreenings, futureScreenings]);

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
    const chosenScreening =
      futureScreenings.find((s) => s.id === selectedScreeningId) ||
      allScreenings.find((s) => s.id === selectedScreeningId);
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
        const { rowLetter, seatNumber } = getSeatInfo(
          seatStruct,
          layoutRows,
          seatId
        );
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
    // Optimistisk UI-uppdatering: mina val är nu bokade
    markAsBooked(Array.from(selected));

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
    clearSelectedAndRelease();
  };

  // SearchParams
  useEffect(() => {
    if (movieId || selectedScreeningId) {
      const params = new URLSearchParams();
      if (movieId) params.set("movie", movieId.toString());
      if (selectedScreeningId)
        params.set("screening", selectedScreeningId.toString());
      setSearchParams(params, { replace: true });
    }
  }, [movieId, selectedScreeningId, setSearchParams]);

  useEffect(() => {
    const urlMovieId = searchParams.get("movie");
    const urlScreeningId = searchParams.get("screening");
    if (urlMovieId && !movieId) setMovieId(Number(urlMovieId));
    if (urlScreeningId && !selectedScreeningId)
      setSelectedScreeningId(Number(urlScreeningId));
  }, []);

  // ---------- SLUT SearchParams

  return (
    <>
      <div className="booking container-fluid py-4">
        <div className="row g-4 align-items-stretch">
          {/* Left panel */}
          <div className="col-lg-4">
            <div className="card booking-panel h-100">
              <div className="card-header">Välj föreställning</div>
              <div className="card-body">
                <section className="auditoriums">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Film</label>
                    {loadingMovies ? (
                      <div className="form-control-plaintext">
                        Laddar filmer…
                      </div>
                    ) : movieError ? (
                      <div className="text-danger small">{movieError}</div>
                    ) : (
                      <select
                        className="form-select"
                        value={movieId ?? ""}
                        onChange={(e) => {
                          const newMovieId = e.target.value
                            ? Number(e.target.value)
                            : null;
                          setMovieId(newMovieId);
                          setSelectedScreeningId(null); // Rensa screening när film ändras
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
                    <label className="form-label fw-semibold">
                      Datum & tid
                    </label>
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
                        onChange={(e) => {
                          const newScreeningId = e.target.value
                            ? Number(e.target.value)
                            : null;
                          setSelectedScreeningId(newScreeningId);
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
                    )}
                  </div>

                  <label className="form-label fw-semibold">Salong</label>
                  <div className="form-control-plaintext hidden-text">
                    {auditoriumName || "–"}
                  </div>
                </section>
                <section className="tickets">
                  <h6 className="mb-3 fw-bold">Antal biljetter</h6>{" "}
                  <AgeTooltip />
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
                </section>
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
                {/* MOBIL: dropdown för platser */}
                <SeatPickerMobile
                  rows={seatStruct.indexByRow}
                  occupied={occupied}
                  held={held}
                  selected={selected}
                  needed={needed}
                  onToggle={toggleSeat}
                  getSeatLabel={(id) =>
                    getSeatLabel(seatStruct, layoutRows, id)
                  }
                  sessionId={sessionId}
                />

                {/* DESKTOP: vanlig seat-grid (döljs på mobil) */}
                <div className="seat-viewport" ref={viewportRef}>
                  <div className="seat-stage" ref={stageRef}>
                    <div className="screenbar">BIODUK</div>

                    <SeatGridDesktop
                      seatStruct={seatStruct}
                      occupied={occupied}
                      held={held}
                      selected={selected}
                      needed={needed}
                      sessionId={sessionId}
                      getSeatLabel={(id) =>
                        getSeatLabel(seatStruct, layoutRows, id)
                      }
                      onToggle={toggleSeat}
                    />
                    <SeatLegend />
                  </div>
                </div>

                <div className="mt-3 d-flex align-items-center justify-content-between">
                  <div>
                    <div className="small hidden-text">Valda platser</div>
                    <div className="fw-semibold">
                      {selected.size === 0
                        ? "–"
                        : formatSelectedSeats(selected, seatStruct, layoutRows)}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="small hidden-text">Totalt</div>
                    <div className="h4 mb-0">{fmtSEK(ticketTotal)}</div>
                  </div>
                </div>

                <div className="mt-3 d-flex gap-2 justify-content-end">
                  <button
                    className="btn btn-primary btn-cancel"
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
