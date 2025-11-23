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

// Normalize raw movie payloads into { id, title }.
// - Accepts multiple possible field names to be robust to backend differences.
const normalizeMovies = (raw: any): Movie[] => {
  return (Array.isArray(raw) ? raw : []).map((m: any) => ({
    id: Number(m.id ?? m.movie_id ?? m.movieId),
    title: String(m.title ?? m.movie_title ?? m.movieTitle ?? "Okänd film"),
  }));
};

// Seat management hook: selection, holds, and best-seat logic.
// - Keeps track of selected, occupied, and temporarily held seats.
// - Picks best seats automatically unless the user picks manually.
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

  // Compute seats currently held by other sessions.
  useEffect(() => {
    const s = new Set<number>();
    held.forEach((sessId, seatId) => {
      if (sessId !== sessionId) s.add(seatId);
    });
    setHeldByOthers(s);
  }, [held, sessionId]);

  // Build seat structure from layout:
  // - indexByRow: seat IDs grouped by row
  // - seatMeta: quick lookup for row/column
  // - takenSet: seats already booked
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

  // Score seats by distance to center row/column (lower is better).
  // - Skips occupied and seats held by others.
  const bestSeatOrder = useCallback(
    (exclude?: Set<number>) => {
      const rowCenter = Math.floor(seatStruct.indexByRow.length / 2);
      const weightRow = 2.0;
      const scored: { no: number; dist: number }[] = [];

      seatStruct.seatMeta.forEach(({ ri, ci }, no) => {
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

  // Find best contiguous block of size=N near center.
  // - Returns empty array if no suitable block exists.
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

  // Connect to SSE stream for the current screening and sync holds/bookings.
  // - Initial "snapshot" applied once, then incremental events.
  useEffect(() => {
    if (!screeningId) return;

    setOccupied(new Set(seatStruct.takenSet));

    setHeld(new Map());
    gotSnapshotRef.current = false;

    const es = new EventSource(
      `${API_PREFIX}/bookings/stream?screeningId=${screeningId}`
    );

    // Apply initial holds snapshot (once per connection).
    const onSnapshot = (e: MessageEvent) => {
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
      gotSnapshotRef.current = true;
    };
    // Realtime: someone held a seat.
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
    // Realtime: a seat hold was released.
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
    // Realtime: seats got booked > mark as occupied and clear from holds/selection.
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
      // EventSource will auto-reconnect; no manual action here.
    };

    return () => {
      es.removeEventListener("snapshot", onSnapshot as any);
      es.removeEventListener("seat:held", onSeatHeld as any);
      es.removeEventListener("seat:released", onSeatReleased as any);
      es.removeEventListener("seat:booked", onSeatBooked as any);
      es.close();
    };
  }, [screeningId, seatStruct.takenSet]);

  // Mark a list of seat IDs as booked locally (optimistic UI).
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

  // Periodically extend our own holds to prevent expiry during checkout.
  useEffect(() => {
    if (!screeningId) return;

    const interval = setInterval(() => {
      if (selected.size === 0) return;
      selected.forEach((seatId) => {
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
    }, 60_000); // every 60s

    return () => clearInterval(interval);
  }, [screeningId, selected, held, sessionId]);

  // Auto-pick best seats when "needed" changes (unless user picked manually).
  useEffect(() => {
    if (hasManualSelection) return;

    setSelected(() => {
      const next = new Set<number>();
      if (needed <= 0) return next;

      // Try finding contigous block first
      const block = findBestContiguousBlock(needed);
      if (block.length === needed) {
        block.forEach((n) => next.add(n));
      } else {
        // Else chose best individual seats
        for (const n of bestSeatOrder()) {
          if (next.size >= needed) break;
          next.add(n);
        }
      }
      return next;
    });
  }, [needed, findBestContiguousBlock, bestSeatOrder, hasManualSelection]);

  // Auto-pick once when there is no selection yet (and no manual picks).
  useEffect(() => {
    if (hasManualSelection) return;
    // Only run auto-select if NO choice has already been made
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

  // Reset manual mode when seat need goes to zero.
  useEffect(() => {
    if (needed === 0) {
      setHasManualSelection(false);
    }
  }, [needed]);

  // Toggle a seat:
  // - Ignore if no screening, no tickets, occupied, or held by others.
  // - On select/unselect, optimistically hold/release on the server.
  const toggleSeat = useCallback(
    (seatId: number) => {
      if (!screeningId) return;
      if (needed === 0) return;
      if (occupied.has(seatId)) return;
      if (held.has(seatId) && held.get(seatId) !== sessionId) return;

      setHasManualSelection(true);

      setSelected((prev) => {
        const next = new Set(prev);
        const wasSelected = next.has(seatId);

        if (wasSelected) {
          next.delete(seatId);
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

  // Set selection and keep manual mode state in sync:
  // - Any newly added seats > manual mode ON
  // - Empty selection > manual mode OFF
  const setSelectedWithManual = useCallback(
    (newSelected: Set<number> | ((prev: Set<number>) => Set<number>)) => {
      setSelected((prev) => {
        const result =
          typeof newSelected === "function" ? newSelected(prev) : newSelected;

        if (
          result.size > 0 &&
          Array.from(result).some((seatId) => !prev.has(seatId))
        ) {
          setHasManualSelection(true);
        } else if (result.size === 0) {
          setHasManualSelection(false);
        }

        return result;
      });
    },
    []
  );

  // Clear selection and exit manual mode.
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
    markAsBooked,
  };
};

export default function Booking({
  onConfirm,
  onNavigate,
  authed,
}: BookingProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Session id for client-side booking flow and seat holds.
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [sessionId] = useState(
    () => `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // URL query params (movie/screening deep-linking).
  const [searchParams, setSearchParams] = useSearchParams();

  // Page state: current movie, screening, tickets, prices, and layout.
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

  // Load screenings/movies/ticketTypes with optional normalization.
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

  // Keep only upcoming screenings (with 60s grace period).
  const futureScreenings = useMemo(
    () => allScreenings.filter((s) => isFuture(s.screening_time)),
    [allScreenings]
  );

  // Log API errors for easier debugging.
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

  // Derive prices from ticket types by matching Swedish labels.
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

  // Derived state: seats needed and available movies with future screenings.
  const needed = tickets.adult + tickets.child + tickets.senior;
  const bookableMovies = useMemo(
    () =>
      movies.filter((m) => futureScreenings.some((s) => s.movie_id === m.id)),
    [movies, futureScreenings]
  );

  // Build dropdown options for the selected movie, sorted by time.
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

  // Preselect movie from navigation state (e.g., "Book this movie" flow).
  useEffect(() => {
    const state = location.state as { preselectedMovieId?: number } | null;
    if (state?.preselectedMovieId && !hasRestoredSession) {
      setMovieId(state.preselectedMovieId);
      setHasRestoredSession(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, hasRestoredSession]);

  // Auto-pick first available movie once session restoration is done.
  useEffect(() => {
    if (!movieId && bookableMovies.length > 0 && hasRestoredSession) {
      setMovieId(bookableMovies[0].id);
    }
  }, [movieId, bookableMovies, hasRestoredSession]);

  // Auto-pick first screening for the selected movie (after session restore).
  useEffect(() => {
    if (
      !selectedScreeningId &&
      movieId &&
      screeningsForMovie.length > 0 &&
      hasRestoredSession
    ) {
      setSelectedScreeningId(screeningsForMovie[0].value);
    }
  }, [movieId, screeningsForMovie, selectedScreeningId, hasRestoredSession]);

  // Fetch seating layout for the selected screening.
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

  // Hook: seats state and actions (toggle, clear, markAsBooked, etc.).
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

  // Release one seat on server (helper).
  const releaseSeat = (scrId: number, seatId: number) =>
    fetch(`${API_PREFIX}/screenings/${scrId}/seats/${seatId}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "release", sessionId }),
    }).catch(() => {});

  // Release all currently selected seats owned by this session (helper).
  const releaseAllSelected = useCallback(() => {
    if (!selectedScreeningId || selected.size === 0) return;
    selected.forEach((seatId) => {
      if (held.get(seatId) === sessionId) {
        releaseSeat(selectedScreeningId, seatId);
      }
    });
  }, [selectedScreeningId, selected, held, sessionId]);

  // Release on tab close/refresh to avoid orphaned holds.
  useEffect(() => {
    const onUnload = () => releaseAllSelected();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [releaseAllSelected]);

  // Clear local selection and release holds on server.
  const clearSelectedAndRelease = useCallback(() => {
    releaseAllSelected();
    setSelected(new Set());
  }, [releaseAllSelected, setSelected]);

  // If need goes to zero, drop all selected and release holds.
  useEffect(() => {
    if (needed === 0 && selected.size > 0) {
      clearSelectedAndRelease();
    }
  }, [needed, selected, clearSelectedAndRelease]);

  // If we selected more seats than needed, drop the "worst" ones first.
  // - Ranking: by row index (ri) then column (ci) for stable behavior.
  useEffect(() => {
    if (!selectedScreeningId) return;
    if (needed === 0) return;
    if (selected.size <= needed) return;

    const rank = (seatId: number) => {
      const meta = seatStruct.seatMeta.get(seatId);
      if (!meta) return Number.MAX_SAFE_INTEGER;
      return meta.ri * 1000 + meta.ci;
    };

    const current = Array.from(selected).sort((a, b) => rank(a) - rank(b));
    const keepCount = Math.max(0, needed);
    const keep = new Set(current.slice(0, keepCount));
    const drop = current.slice(keepCount);

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

  // Debounced sync of local selection to server holds (idempotent).
  useEffect(() => {
    if (!selectedScreeningId) return;

    let timer: number | undefined;

    const run = () => {
      const mine = new Set<number>();
      held.forEach((sessId, seatId) => {
        if (sessId === sessionId) mine.add(seatId);
      });

      const toHold: number[] = [];
      selected.forEach((seatId) => {
        if (!mine.has(seatId)) toHold.push(seatId);
      });

      const toRelease: number[] = [];
      mine.forEach((seatId) => {
        if (!selected.has(seatId)) toRelease.push(seatId);
      });

      if (toHold.length === 0 && toRelease.length === 0) return;

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

    timer = window.setTimeout(run, 180); // ~debounce UI bursts
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [selected, held, selectedScreeningId, sessionId]);

  // Keep selection valid when movie changes:
  // - If current screening is not among the new list, pick the first one.
  useEffect(() => {
    if (movieId == null || screeningsForMovie.length === 0) return;

    const validIds = new Set(screeningsForMovie.map((s) => s.value));

    if (!selectedScreeningId || !validIds.has(selectedScreeningId)) {
      const firstId = screeningsForMovie[0]?.value ?? null;
      setSelectedScreeningId(firstId);
      clearSelected();
    }
  }, [movieId, screeningsForMovie, selectedScreeningId, clearSelected]);

  // When screening actually changes, clear selection.
  useEffect(() => {
    if (selectedScreeningId != null) {
      clearSelected();
    }
  }, [selectedScreeningId, clearSelected]);

  // Fit the grid to the viewport width (translate + scale).
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

  // Helper: lookup movie title by id.
  const getMovieTitle = (id: number | null) =>
    movies.find((m) => m.id === id)?.title ?? "";

  // Compute total price from chosen ticket counts and current prices.
  const ticketTotal =
    tickets.adult * prices.adult +
    tickets.child * prices.child +
    tickets.senior * prices.senior;

  // Find ticketType_id by friendly key: "adult" | "child" | "senior".
  // - Matches Swedish substrings used in DB ("vuxen", "barn", "pension").
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

  // Persist booking-in-progress (for restore after auth/navigation).
  // - If nothing is in progress, clear stored data.
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
      hasManualSelection: hasManualSelection,
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

  // Restore booking-in-progress from session or URL parameters.
  // - Prefers URL (deep link), then sessionStorage, then a stored screening id.
  const restoreBookingSession = useCallback(() => {
    if (hasRestoredSession) return false;

    if (allScreenings.length === 0) {
      return false;
    }
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
        // saved id not found among current screenings > ignore
      }
    }

    // Cleanup old localStorage sessions if expired.
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

  // One-time restore on mount.
  useEffect(() => {
    if (hasRestoredSession) return;

    const savedScreeningId = localStorage.getItem("selectedScreeningId");
    if (savedScreeningId && allScreenings.length > 0) {
      const screeningId = Number(savedScreeningId);
      const screening = allScreenings.find((s) => s.id === screeningId);

      if (screening) {
        setMovieId(screening.movie_id);
        setSelectedScreeningId(screeningId);

        localStorage.removeItem("selectedScreeningId");
        localStorage.removeItem("selectedScreeningTime");
        localStorage.removeItem("selectedAuditoriumId");

        setHasRestoredSession(true);
      }
    }
  }, [allScreenings, hasRestoredSession]);

  // Auto-save booking-in-progress when relevant state changes.
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

  // Try restore after mount (covers URL/session cases).
  useEffect(() => {
    const restored = restoreBookingSession();
    if (restored) {
      console.log("Booking session restored successfully");
    }
  }, [restoreBookingSession]);

  // If returning from auth, restore and then clear auth flags.
  useEffect(() => {
    const shouldRestore = sessionStorage.getItem("shouldRestoreBooking");
    const savedSessionId = sessionStorage.getItem("bookingSessionId");

    if (shouldRestore === "true" && savedSessionId === sessionId) {
      console.log("Auth flow completed - restoring booking session");

      restoreBookingSession();

      setTimeout(() => {
        sessionStorage.removeItem("shouldRestoreBooking");
        sessionStorage.removeItem("bookingSessionId");
        sessionStorage.removeItem("isAuthNavigation");
        console.log("Auth flags cleared");
      }, 100);
    }
  }, [sessionId, restoreBookingSession]);

  // Cleanup when navigating away (but keep state if we're going into auth flow).
  useEffect(() => {
    return () => {
      const shouldRestoreBooking = sessionStorage.getItem(
        "shouldRestoreBooking"
      );
      const isAuthNavigation = sessionStorage.getItem("isAuthNavigation");

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

  // If restored screening is in the past, jump to the next upcoming for same movie.
  useEffect(() => {
    if (!selectedScreeningId) return;
    const curr = allScreenings.find((s) => s.id === selectedScreeningId);
    if (!curr) return;

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
        setSelectedScreeningId(null);
      }
    }
  }, [selectedScreeningId, allScreenings, futureScreenings]);

  // Finalize booking:
  // - Build seat→ticketType mapping
  // - POST /makeBooking
  // - Handle conflicts (409) and navigate to confirm page on success
  const finalizeBooking = async (email?: string) => {
    if (!selectedScreeningId) {
      alert("Ingen visning vald.");
      return;
    }

    // Sort seats deterministically (by id) for stable payloads.
    const chosenSeatsSorted = Array.from(selected).sort((a, b) => a - b);

    // Distribute ticket categories across seats (adult → child → senior).
    let remainingAdult = tickets.adult;
    let remainingChild = tickets.child;
    let remainingSenior = tickets.senior;

    const adultTypeId = getTicketTypeId("adult");
    const childTypeId = getTicketTypeId("child");
    const seniorTypeId = getTicketTypeId("senior");

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

    if (seatPayload.length !== chosenSeatsSorted.length) {
      alert("Kunde inte matcha biljetttyper till platser. Försök igen.");
      return;
    }

    const bookingPayload: any = {
      screening_id: selectedScreeningId,
      seats: seatPayload,
    };

    if (email && !authed) {
      bookingPayload.guest_email = email;
    }

    const resp = await fetch(`${API_PREFIX}/makeBooking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(bookingPayload),
    });

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

    const data = await resp.json().catch(() => null);

    const backendId = data?.booking_id ?? null;
    const confCode = data?.booking_confirmation ?? null;
    const isGuestBooking = data?.is_guest ?? false;

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

    // Optimistic UI: mark selected seats as booked locally.
    markAsBooked(Array.from(selected));

    onConfirm(booking);
    if (showAuth) closeAuth();

    // Clear stored session data on success.
    sessionStorage.removeItem("pendingBooking");
    sessionStorage.removeItem("shouldRestoreBooking");
    sessionStorage.removeItem("bookingSessionId");

    const lastSessionId = localStorage.getItem("lastBookingSession");
    if (lastSessionId) {
      localStorage.removeItem(`bookingSession_${lastSessionId}`);
      localStorage.removeItem("lastBookingSession");
    }

    // Navigate to confirm page with booking id and optional conf code/email.
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

  // Open auth modal or finalize immediately if already authenticated.
  const openAuth = () => {
    if (authed) void finalizeBooking();
    else {
      setAuthStep("choose");
      setShowAuth(true);
    }
  };

  // Close auth modal and reset guest input.
  const closeAuth = () => {
    setShowAuth(false);
    setGuestEmail("");
    setAuthStep("choose");
  };

  // Start login/signup flow:
  // - Save session so we can restore when user returns.
  const handleAuthAction = useCallback(
    (type: "login" | "signup") => {
      saveBookingSession();

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

      onNavigate(type);
    },
    [saveBookingSession, location, sessionId, onNavigate]
  );

  // Cancel booking: reset tickets and release seats.
  const handleCancel = () => {
    setTickets({ adult: 0, child: 0, senior: 0 });
    clearSelectedAndRelease();
  };

  // Keep URL query (movie, screening) in sync with current selection.
  useEffect(() => {
    if (movieId || selectedScreeningId) {
      const params = new URLSearchParams();
      if (movieId) params.set("movie", movieId.toString());
      if (selectedScreeningId)
        params.set("screening", selectedScreeningId.toString());
      setSearchParams(params, { replace: true });
    }
  }, [movieId, selectedScreeningId, setSearchParams]);

  // On first render, hydrate selection from URL if present.
  useEffect(() => {
    const urlMovieId = searchParams.get("movie");
    const urlScreeningId = searchParams.get("screening");
    if (urlMovieId && !movieId) setMovieId(Number(urlMovieId));
    if (urlScreeningId && !selectedScreeningId)
      setSelectedScreeningId(Number(urlScreeningId));
  }, []);

  // ---------- UI ----------

  return (
    <>
      <div className="booking container-fluid py-4">
        <div className="row g-4 align-items-stretch">
          {/* Left panel: movie/screening and ticket counts */}
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
                          setSelectedScreeningId(null);
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

          {/* Right panel: seat grid and totals */}
          <div className="col-lg-8">
            <div className="card booking-panel h-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <span className="fw-semibold">Salong – platser</span>
                <small className="hidden-text">Välj dina platser</small>
              </div>

              <div className="card-body">
                {/* Mobile seat picker (collapsible list) */}
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

                {/* Desktop seat grid */}
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

      {/* Auth Modal (shown when not authenticated) */}
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
