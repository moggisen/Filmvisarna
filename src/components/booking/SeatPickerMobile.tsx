import { useEffect, useRef, useState } from "react";

export default function SeatPickerMobile({
  rows,
  occupied,
  held,
  selected,
  needed,
  onToggle,
  getSeatLabel,
  sessionId,
}: {
  rows: number[][];
  occupied: Set<number>;
  held: Map<number, string>;
  selected: Set<number>;
  needed: number;
  onToggle: (seatId: number) => void;
  getSeatLabel: (seatId: number) => string;
  sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canAddMore = selected.size < needed;

  // Sort seats by user-friendly label (A..Z then numeric)
  // Example: A1, A2, A10 -> A1, A2, A10 (not A1, A10, A2)
  const sortBySeatLabel = (a: number, b: number) => {
    const la = getSeatLabel(a);
    const lb = getSeatLabel(b);

    const rowA = la.charAt(0);
    const rowB = lb.charAt(0);

    const numA = parseInt(la.slice(1), 10) || 0;
    const numB = parseInt(lb.slice(1), 10) || 0;

    if (rowA < rowB) return -1;
    if (rowA > rowB) return 1;
    return numA - numB;
  };

  // Build summary text for the collapsed picker
  // Cases:
  // - Some selected > "Platser: A2, A10"
  // - Need more than 0 and none selected > prompt to open
  // - Need 0 > ask user to pick ticket count first
  const summaryLabel =
    selected.size > 0
      ? `Platser: ${[...selected]
          .sort(sortBySeatLabel)
          .map((id) => getSeatLabel(id))
          .join(", ")}`
      : needed > 0
      ? "Öppna och välj platser"
      : "Välj antal biljetter först";

  // Close panel when clicking outside the component
  // - Only active while panel is open
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      const target = e.target as Node;
      if (!wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    // Mobile-only picker (hidden on lg and up)
    <div className="seat-picker-mobile d-lg-none" ref={wrapperRef}>
      {/* Label with dynamic hint of how many seats are still needed */}
      <label className="form-label fw-semibold">
        Välj platser{" "}
        {needed > 0 ? `(behöver ${needed})` : `(välj antal biljetter först)`}
      </label>

      {/* Clickable summary acting like a <select> to toggle the panel */}
      <button
        type="button"
        className="spm-summary form-select d-flex justify-content-between align-items-center"
        onClick={() => {
          if (needed > 0) setOpen((o) => !o);
        }}
        disabled={needed === 0}
      >
        <span>{summaryLabel}</span>
        <span className="ms-2">{open ? "▴" : "▾"}</span>
      </button>

      {/* Expanded panel with rows and pill buttons for each seat */}
      {open && (
        <div className="spm-panel mt-2">
          {rows.map((rowSeatIds, rowIndex) => {
            if (!rowSeatIds.length) return null;

            const rowLetter = String.fromCharCode("A".charCodeAt(0) + rowIndex);

            // Keep visual order consistent within each row
            const sortedSeats = [...rowSeatIds].sort(sortBySeatLabel);

            return (
              <div key={rowIndex} className="spm-row">
                <div className="spm-row-label">Rad {rowLetter}</div>
                <div className="spm-row-seats">
                  {sortedSeats.map((seatId) => {
                    const label = getSeatLabel(seatId);
                    const taken = occupied.has(seatId);
                    const checked = selected.has(seatId);
                    const heldByOther =
                      held.has(seatId) && held.get(seatId) !== sessionId;

                    // Disable rules:
                    // - No tickets requested
                    // - Already taken
                    // - Temporarily held by another session
                    // - Reaching the requested seat count
                    const disabled =
                      needed === 0 ||
                      taken ||
                      heldByOther ||
                      (!checked && !canAddMore);

                    // Visual state per seat
                    const stateClass = taken
                      ? "spm-seat-taken"
                      : heldByOther
                      ? "spm-seat-held"
                      : checked
                      ? "spm-seat-selected"
                      : "spm-seat-free";

                    return (
                      <button
                        key={seatId}
                        type="button"
                        className={`spm-seat-pill ${stateClass}`}
                        onClick={() => {
                          if (!disabled) onToggle(seatId);
                        }}
                        disabled={disabled}
                        aria-pressed={checked}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
