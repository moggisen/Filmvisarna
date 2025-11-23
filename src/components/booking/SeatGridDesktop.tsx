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
  seatStruct: { indexByRow: number[][] };
  occupied: Set<number>;
  held: Map<number, string>;
  selected: Set<number>;
  needed: number;
  sessionId: string;
  getSeatLabel: (id: number) => string;
  onToggle: (id: number) => void;
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
                    isTaken ? "seat-taken" : heldByOther ? "seat-held" : isActive ? "seat-active" : ""
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