import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPhoneOtp } from '../api/user.api';

export default function VerifyPhone() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState(params.get('phone') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyPhoneOtp({ phoneNumber: phoneNumber.trim(), otp: otp.trim() });
      navigate('/login', { replace: true, state: { verified: true } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card-panel">
        <div className="login-card">
          <h1 className="login-card__title">Verify your phone</h1>
          <p className="login-card__desc">Enter the code sent to your WhatsApp or SMS number.</p>
          <form className="login-card__form" onSubmit={submit}>
            <label className="login-card__field">
              <span className="login-card__label">PHONE NUMBER</span>
              <input className="login-card__input" type="tel" autoComplete="tel" placeholder="+919876543210" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
            </label>
            <label className="login-card__field">
              <span className="login-card__label">ONE TIME CODE</span>
              <input className="login-card__input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} required />
            </label>
            {error && <p role="alert" className="login-card__error">{error}</p>}
            <button className="login-card__submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify phone'}</button>
          </form>
          <p className="login-card__footer"><Link to="/login">Back to sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
