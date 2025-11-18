import { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import "../styles/cookieconsent.scss";

type ConsentChoice = "necessary" | "stats";
const LS_KEY = "cookieConsent"; // localStorage-nyckel

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice>("necessary");

  // Visa modal om inget val finns sen tidigare
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY) as ConsentChoice | null;
      if (!saved) {
        setShow(true);
      }
    } catch {
      // Om localStorage är spärrad/privat läge, visa modal ändå
      setShow(true);
    }
  }, []);

  const handleSave = (selected: ConsentChoice) => {
    try {
      localStorage.setItem(LS_KEY, selected);
    } catch {}
    setShow(false);
  };

  // (Valfritt) gör det lättare att testa: håll ALT nedtryckt för att visa igen
  window.addEventListener("keydown", e => { if(e.altKey) setShow(true) })

  return (
    <Modal
      show={show}
      onHide={() => {}}
      backdrop="static"
      keyboard={false}
      centered
      dialogClassName="cookie-modal"
    >
      <Modal.Header>
        <Modal.Title>Cookies på Filmvisarna</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3 text-info">
          Vi använder <strong>nödvändiga tekniska cookies</strong> för att sidan ska fungera
          (för t.ex. inloggning och platsreservering vid bokning). Vi planerar också att använda cookies
          för <strong>statistik</strong>, vilket kan komma att användas som underlag för marknadsföring.
        </p>

        <div className="mb-3">
          <Form.Check
            type="radio"
            id="consent-necessary"
            name="cookie-consent"
            label={
              <>
                <strong>Endast nödvändiga</strong>
                <div className="small text-info">
                  Krävs för inloggning och grundfunktioner. Inga personliga uppgifter sparas för statistik.
                </div>
              </>
            }
            checked={choice === "necessary"}
            onChange={() => setChoice("necessary")}
            className="mb-2"
          />
          <Form.Check
            type="radio"
            id="consent-stats"
            name="cookie-consent"
            label={
              <>
                <strong>Tillåt statistik</strong>
                <div className="small text-info">
                  Tillåt mätning av användning (för statistikanalys som kan bli underlag för
                  marknadsföring). Inga personliga annonser hos oss.
                </div>
              </>
            }
            checked={choice === "stats"}
            onChange={() => setChoice("stats")}
          />
        </div>

        <p className="small text-info mb-0">
          Ditt val sparas i din webbläsare så att du inte behöver välja igen.
        </p>
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <Button variant="secondary" onClick={() => handleSave("necessary")}>
          Endast nödvändiga
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSave(choice)}
          disabled={!choice}
        >
          Spara mitt val
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
