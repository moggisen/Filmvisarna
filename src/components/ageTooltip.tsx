import { useEffect, useState } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";

interface AgeTooltipProps {
  offsetMobile?: [number, number];
  offsetDesktop?: [number, number];
}

export default function AgeTooltip({
  offsetMobile = [35, 5],
  offsetDesktop = [75, 10],
}: AgeTooltipProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const offset = isMobile ? offsetMobile : offsetDesktop;
  const placement = isMobile ? "bottom" : "right";

  return (
    <OverlayTrigger
      placement={placement}
      popperConfig={{
        modifiers: [{ name: "offset", options: { offset } }],
      }}
      overlay={
        <Tooltip
          id="age-tooltip"
          style={{
            maxWidth: "80vw",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid white",
            backgroundColor: "#000",
            opacity: 1,
            color: "white",
            fontSize: "0.85rem",
            lineHeight: "1.4",
            boxShadow: "0 4px 15px rgba(0,0,0,0.6)",
            textAlign: "left",
          }}
        >
          <strong style={{ display: "block", marginBottom: "6px" }}>
            Regler i Sverige:
          </strong>
          • Barn under 7 år får se filmer med 7-årsgräns i vuxet sällskap.
          <br />
          • Barn över 11 år får se filmer med 15-årsgräns i vuxet sällskap.
          <hr
            style={{
              border: "none",
              borderTop: "2px solid rgba(255, 255, 255, 0.838)",
              margin: "8px 0",
            }}
          />
          <div
            style={{
              fontStyle: "italic",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <strong>Observera:</strong> Åldersgränsen anger vad som är tillåtet,
            inte vad som rekommenderas. När en film har en åldersgräns där yngre
            barn får se den i vuxens sällskap, är det den vuxne som ansvarar för
            att bedöma om filmen passar barnet utifrån mognad och känslighet.
          </div>
        </Tooltip>
      }
    >
      <InfoCircle
        size={18}
        color="white"
        style={{ cursor: "pointer", opacity: 0.8 }}
      />
    </OverlayTrigger>
  );
}
