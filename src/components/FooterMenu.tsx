import { Link, useLocation } from "react-router-dom";
import { openCookieConsent } from "./CookieConsent";
import "../styles/footermenu.scss";

type FooterMenuProps = {
  aboutRoute?: string; // default "/info"
};

export default function FooterMenu({ aboutRoute = "/info" }: FooterMenuProps) {
  const { pathname } = useLocation();

  return (
    <footer className="footer-menu border-top pt-3 pb-4 mt-4">
      <nav className="container">
        <div
          className="d-flex flex-row gap-3 gap-lg-5
                        justify-content-center align-items-center
                        text-center small"
        >
          <FooterLink to={aboutRoute} active={pathname === aboutRoute}>
            Om oss
          </FooterLink>
          <FooterLink to={aboutRoute} active={pathname === aboutRoute}>
            Kontakt
          </FooterLink>
          <FooterLink to={aboutRoute} active={pathname === aboutRoute}>
            Hitta hit
          </FooterLink>
          <FooterLink to={aboutRoute} active={pathname === aboutRoute}>
            Kiosk
          </FooterLink>

          <button
            type="button"
            className="btn btn-link p-0 text-decoration-none link-light-50"
            onClick={() => openCookieConsent()} // öppna cookies-modalen
            aria-label="Öppna cookiepolicy"
          >
            Cookiepolicy
          </button>
        </div>
      </nav>
    </footer>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={`text-decoration-none link-light-50`}>
      {children}
    </Link>
  );
}
