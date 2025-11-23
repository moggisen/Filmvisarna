import type { LayoutRow } from "../types";

// Format a number as Swedish Krona (SEK) using Swedish locale rules.
// Example: 140 > "140,00 kr"
export const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(
    n
  );

// Returns true if the timestamp is in the future.
// 60s buffer added so screenings that are about to start
// are not considered "bookable" due to latency etc.
export const isFuture = (iso: string) =>
  new Date(iso).getTime() > Date.now() + 60 * 1000;

// Converts seatId from DB (1, 2,..., 132, 133) to row (A, B,...) and seat in that row (1, 2, 3)
export const getSeatInfo = (
  seatStruct: { seatMeta: Map<number, { ri: number; ci: number }> },
  layoutRows: LayoutRow[],
  seatId: number
) => {
  const meta = seatStruct.seatMeta.get(seatId);
  if (!meta) return { rowLetter: "A", seatNumber: seatId };
  const rowLetter = String.fromCharCode("A".charCodeAt(0) + meta.ri);
  const layoutRow = layoutRows[meta.ri];
  const seat = layoutRow?.seats.find((s) => s.id === seatId);
  return { rowLetter, seatNumber: seat?.seatNumber ?? meta.ci };
};

// Builds a seat-label (A1, C7, ...) with info from getSeatInfo
export const getSeatLabel = (
  seatStruct: any,
  layoutRows: LayoutRow[],
  seatId: number
) => {
  const { rowLetter, seatNumber } = getSeatInfo(seatStruct, layoutRows, seatId);
  return rowLetter + seatNumber;
};

// Produce a user-friendly, sorted list of selected seats as a single string.
// Example: Set{A10, A2, B3} -> "A2, A10, B3"
// Sorting rules:
// - First by row (A..Z), then numerically by seat number within the row.
export const formatSelectedSeats = (
  selected: Set<number>,
  seatStruct: any,
  layoutRows: LayoutRow[]
) =>
  Array.from(selected)
    .sort((a, b) => {
      const A = getSeatInfo(seatStruct, layoutRows, a);
      const B = getSeatInfo(seatStruct, layoutRows, b);
      return (
        A.rowLetter.localeCompare(B.rowLetter) || A.seatNumber - B.seatNumber
      );
    })
    .map((id) => getSeatLabel(seatStruct, layoutRows, id))
    .join(", ");
