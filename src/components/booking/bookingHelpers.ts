
import type { LayoutRow } from "../types";

export const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(
    n
  );

export const isFuture = (iso: string) =>
  new Date(iso).getTime() > Date.now() + 60 * 1000;

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

export const getSeatLabel = (
  seatStruct: any,
  layoutRows: LayoutRow[],
  seatId: number
) => {
  const { rowLetter, seatNumber } = getSeatInfo(seatStruct, layoutRows, seatId);
  return rowLetter + seatNumber;
};

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
