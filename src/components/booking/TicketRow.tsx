import { fmtSEK } from "./bookingHelpers";

// Render a single ticket type row with label, unit price and a quantity.
// Responsibilities:
// - Show ticket label ("Vuxen") and formatted price.
// - Provide +/- buttons to change quantity via onChange.
// - Display current quantity in a disabled button for consistent sizing.
export default function TicketRow({
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
      {/* Ticket label + unit price */}
      <div>
        <div className="fw-semibold">{label}</div>
        <div className="booking-hint">{fmtSEK(price)}</div>
      </div>

      {/* Quantity stepper */}
      {/* Rules:
          - Decrement calls onChange(value - 1)
          - Increment calls onChange(value + 1)
          - Current value shown in a disabled button to avoid accidental clicks */}
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
