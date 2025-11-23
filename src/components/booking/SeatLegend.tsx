
export default function SeatLegend() {
    return (
      <div className="seat-legend-wrapper">
        <div className="seat-legend mt-3" aria-label="Färgnyckel för platser">
          <div className="legend-item">
            <span className="swatch swatch-free" aria-hidden="true" />
            <span className="legend-text">Ledig</span>
          </div>
          <div className="legend-item">
            <span className="swatch swatch-taken" aria-hidden="true" />
            <span className="legend-text">Bokad</span>
          </div>
          <div className="legend-item">
            <span className="swatch swatch-active" aria-hidden="true" />
            <span className="legend-text">Vald plats</span>
          </div>
          <div className="legend-item">
            <span className="swatch swatch-held" aria-hidden="true" />
            <span className="legend-text">Tillfälligt reserverad</span>
          </div>
        </div>
      </div>
    );
  }