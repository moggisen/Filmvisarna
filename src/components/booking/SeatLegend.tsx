// Compact legend explaining seat color codes used in the auditorium layout.
// Accessibility:
// - Wrapper has aria-label for screen readers.
// - Color swatches are decorative (aria-hidden) and paired with text labels.

export default function SeatLegend() {
  return (
    <div className="seat-legend-wrapper">
      {/* Legend container */}
      <div className="seat-legend mt-3" aria-label="Färgnyckel för platser">
        {/* Free seat */}
        <div className="legend-item">
          <span className="swatch swatch-free" aria-hidden="true" />
          <span className="legend-text">Ledig</span>
        </div>
        {/* Booked seat */}
        <div className="legend-item">
          <span className="swatch swatch-taken" aria-hidden="true" />
          <span className="legend-text">Bokad</span>
        </div>
        {/* Currently selected seat */}
        <div className="legend-item">
          <span className="swatch swatch-active" aria-hidden="true" />
          <span className="legend-text">Vald plats</span>
        </div>
        {/* Temporarily held seat (by another session) */}
        <div className="legend-item">
          <span className="swatch swatch-held" aria-hidden="true" />
          <span className="legend-text">Tillfälligt reserverad</span>
        </div>
      </div>
    </div>
  );
}
