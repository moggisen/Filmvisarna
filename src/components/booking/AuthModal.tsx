// AuthModal with session support
export default function AuthModal(props: {
  step: "choose" | "guest";
  guestEmail: string;
  onChangeEmail: (s: string) => void;
  onClose: () => void;
  onPickGuest: () => void;
  onLogin: () => void;
  onSignup: () => void;
  onConfirmGuest: () => void;
}) {
  const {
    step,
    guestEmail,
    onChangeEmail,
    onClose,
    onPickGuest,
    onLogin,
    onSignup,
    onConfirmGuest,
  } = props;

  const handleLogin = () => {
    // Flag for restoring session when user returns from login
    sessionStorage.setItem("shouldRestoreBooking", "true");
    onLogin();
  };

  const handleSignup = () => {
    // Flag for restoring session when user returns from signup
    sessionStorage.setItem("shouldRestoreBooking", "true");
    onSignup();
  };

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal d-block" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Fortsätt för att boka</h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            {step === "choose" && (
              <div className="modal-body">
                <p className="mb-3">
                  Välj hur du vill fortsätta. Dina val sparas så du kan
                  återvända.
                </p>
                <div className="d-grid gap-2">
                  <button className="btn btn-primary" onClick={handleLogin}>
                    Logga in
                  </button>
                  <button className="btn btn-primary" onClick={handleSignup}>
                    Bli medlem
                  </button>
                  <button className="btn btn-primary" onClick={onPickGuest}>
                    Fortsätt som gäst
                  </button>
                </div>
              </div>
            )}

            {step === "guest" && (
              <div className="modal-body">
                <label className="form-label">E-postadress</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="du@example.com"
                  value={guestEmail}
                  onChange={(e) => onChangeEmail(e.target.value)}
                />
                <small className="booking-note d-block mt-2">
                  Vi skickar din bokningsbekräftelse till denna adress.
                </small>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-cancel" onClick={onClose}>
                Stäng
              </button>
              {step === "guest" && (
                <button
                  className="btn btn-primary btn-confirm"
                  onClick={onConfirmGuest}
                >
                  Bekräfta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
