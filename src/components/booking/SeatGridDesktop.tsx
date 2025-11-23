export default function SeatGridDesktop({
  seatStruct,
  occupied,
  held,
  selected,
  needed,
  sessionId,
  getSeatLabel,
  onToggle,
}: {
  // Seat grid structure:
  // - indexByRow: array of rows, each row is an array of seat IDs
  seatStruct: { indexByRow: number[][] };
  // Seat state sets/maps from parent
  occupied: Set<number>; // seats already booked
  held: Map<number, string>; // seatId > sessionId (temporary holds)
  selected: Set<number>; // seats currently selected in UI
  needed: number; // How many seats the user needs to pick
  sessionId: string; // Current user's session id (to tell our holds from others)
  getSeatLabel: (id: number) => string; // Format a seat id into a user-friendly label (e.g., "B12")
  onToggle: (id: number) => void; // Toggle selection when a seat button is pressed
}) {
  return (
    <div className="seat-grid" aria-label="Salsplatser">
      {seatStruct.indexByRow.map((rowNos, ri) => (
        <div className="seat-row" key={ri}>
          <div className="row-inner">
            {rowNos.map((no) => {
              const isTaken = occupied.has(no);
              const isActive = selected.has(no);
              const heldByOther = held.has(no) && held.get(no) !== sessionId;

              return (
                <button
                  key={no}
                  type="button"
                  className={`seat ${
                    isTaken
                      ? "seat-taken"
                      : heldByOther
                      ? "seat-held"
                      : isActive
                      ? "seat-active"
                      : ""
                  }`}
                  aria-pressed={isActive}
                  disabled={
                    needed === 0 ||
                    isTaken ||
                    heldByOther ||
                    (!isActive && !(needed === 0 || selected.size < needed))
                  }
                  onClick={() => onToggle(no)}
                >
                  {getSeatLabel(no)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
