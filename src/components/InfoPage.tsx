import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Card } from "react-bootstrap";
import "../styles/infopage.scss"

export default function InfoPage() {
  const location = useLocation();

  // Refs till våra sektioner
  const aboutRef = useRef<HTMLDivElement | null>(null);
  const visitRef = useRef<HTMLDivElement | null>(null);
  const contactRef = useRef<HTMLDivElement | null>(null);
  const kioskRef = useRef<HTMLDivElement | null>(null);

  const mapRefs = useMemo(
    () => ({
      about: aboutRef,
      visit: visitRef,
      contact: contactRef,
      kiosk: kioskRef,
    }),
    []
  );

  // Hjälpare: smooth-scroll till en sektion om den finns
  const scrollToSection = (key: keyof typeof mapRefs) => {
    const el = mapRefs[key]?.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Vid första render: kolla hash OCH/ELLER state från navigation
  useEffect(() => {
    // 1) Hash (#kiosk etc.)
    const hash = location.hash?.replace("#", "");
    if (hash && hash in mapRefs) {
      scrollToSection(hash as keyof typeof mapRefs);
      return;
    }

    // 2) State från navigate('/info', { state: { section: 'kiosk' } })
    const state = location.state as { section?: keyof typeof mapRefs } | null;
    if (state?.section && state.section in mapRefs) {
      scrollToSection(state.section);
    }
  }, [location, mapRefs]);

  return (
    <div className="container py-4 px-4">

      {/* 2x2 grid på desktop, staplad på mobil */}
      <div className="row g-4">
        {/* Uppe vänster – Om oss */}
        <div className="col-12 col-lg-6 mb-4">
          <Card className="bg-secondary text-info h-100">
            <Card.Body id="about" ref={aboutRef} className="info-section p-0">
              <Card.Title className="bg-primary fs-3 text-center text-light p-3 mb-4">Om Filmvisarna</Card.Title>
              <Card.Text className="px-4 pt-2">
                Filmvisarna är din kvartersbio med fokus på nya premiärer och
                kultklassiker. Vår salong är liten men modern, med sköna stolar
                och bra ljud – perfekt för både vardagsbio och helgmys.
              </Card.Text>
              <Card.Text className="px-4 pb-4 mb-0">
                Vi drivs av ett gäng filmnördar och visar gärna publikens
                önskefilmer under våra temakvällar.
              </Card.Text>
            </Card.Body>
          </Card>
        </div>

        {/* Uppe höger – Hitta hit */}
        <div className="col-12 col-lg-6 mb-4">
          <Card className="bg-secondary text-info h-100">
            <Card.Body id="visit" ref={visitRef} className="info-section p-0">
              <Card.Title className="bg-primary fs-3 text-center text-light p-3 mb-4">Hitta hit</Card.Title>
              <Card.Text className="px-4 pt-2 mb-2">
                <strong>Adress:</strong> Biogatan 12, 123 45 Filmstad
              </Card.Text>
              <Card.Text className="px-4 mb-2">
                <strong>Kollektivt:</strong> Buss 12/24 till “Filmplan”. 3 min
                promenad.
              </Card.Text>
              <Card.Text className="px-4 mb-2">
                <strong>Parkering:</strong> Avgiftsparkering finns på baksidan.
              </Card.Text>
              <div className="px-4 pb-4">
                <a
                href="https://maps.google.com/?q=Biogatan%2012%2C%20123%2045%20Filmstad"
                target="_blank"
                rel="noreferrer"
                className="link-info"
              >
                Öppna i Google Maps
              </a>
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Nere vänster – Kontakt */}
        <div className="col-12 col-lg-6 mb-4">
          <Card className="bg-secondary text-info h-100">
            <Card.Body id="contact" ref={contactRef} className="info-section p-0">
              <Card.Title className="bg-primary fs-3 text-center text-light p-3 mb-4">Kontakt</Card.Title>
              <Card.Text className="px-4 pt-2 mb-1">
                <strong>E-post:</strong>{" "}
                <a href="mailto:kontakt@filmvisarna.se" className="link-info">
                  kontakt@filmvisarna.se
                </a>
              </Card.Text>
              <Card.Text className="px-4 mb-1">
                <strong>Telefon:</strong>{" "}
                <a href="tel:+46123456789" className="link-info">
                  012-345 67 89
                </a>
              </Card.Text>
              <Card.Text className="px-4 pb-4 mb-0">
                <strong>Öppettider kassa:</strong> 30 min före första
                föreställningen.
              </Card.Text>
            </Card.Body>
          </Card>
        </div>

        {/* Nere höger – Kiosk */}
        <div className="col-12 col-lg-6 mb-4">
          <Card className="bg-secondary text-info h-100">
            <Card.Body id="kiosk" ref={kioskRef} className="info-section p-0">
              <Card.Title className="bg-primary fs-3 text-center text-light p-3 mb-4">Kioskutbud</Card.Title>
              <div className="px-4 pt-2">
                <ul className="mb-3">
                <li>Popcorn (liten/medium/stor)</li>
                <li>Choklad & godispåsar</li>
                <li>Läsk & mineralvatten</li>
                <li>Kaffe/te & liten fika</li>
              </ul>
              </div>
              <Card.Text className="small text-info px-4 pb-4 mb-0">
                Psst! Visa medlemskortet så får du 10% på snacks.
              </Card.Text>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
