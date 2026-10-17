import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sendPhoneOtp, verifyPhoneOtp } from '../api/user.api';
import { useAuth } from '../context/Authcontext';

export default function VerifyPhone() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getCurrentUser } = useAuth();
  const verificationToken = location.state?.verificationToken;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!codeSent) {
        await sendPhoneOtp({ verificationToken, phoneNumber: phoneNumber.trim() });
        setCodeSent(true);
        return;
      }
      await verifyPhoneOtp({ verificationToken, phoneNumber: phoneNumber.trim(), otp: otp.trim() });
      await getCurrentUser();
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setBusy(true);
    setError('');
    try {
      await sendPhoneOtp({ verificationToken, phoneNumber: phoneNumber.trim() });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!verificationToken) {
    return (
      <main className="login-page">
        <section className="login-card-panel">
          <div className="login-card">
            <h1 className="login-card__title">Sign in to verify your phone</h1>
            <p className="login-card__desc">Your verification session is missing or expired. Sign in again to continue.</p>
            <p className="login-card__footer"><Link to="/login">Back to sign in</Link></p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card-panel">
        <div className="login-card">
          <h1 className="login-card__title">Verify your phone</h1>
          <p className="login-card__desc">{codeSent ? 'Enter the code sent to your phone.' : 'Enter your phone number to receive a verification code by WhatsApp or SMS.'}</p>
          <form className="login-card__form" onSubmit={submit}>
            <label className="login-card__field">
              <span className="login-card__label">PHONE NUMBER</span>
              <input className="login-card__input" type="tel" autoComplete="tel" placeholder="+919876543210" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
            </label>
            {codeSent && (
              <label className="login-card__field">
                <span className="login-card__label">ONE TIME CODE</span>
                <input className="login-card__input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} required />
              </label>
            )}
            {error && <p role="alert" className="login-card__error">{error}</p>}
            <button className="login-card__submit" type="submit" disabled={busy}>{busy ? (codeSent ? 'Verifying…' : 'Sending…') : (codeSent ? 'Verify phone' : 'Send code')}</button>
            {codeSent && <button className="login-card__footer" type="button" disabled={busy} onClick={resendCode}>Send another code</button>}
          </form>
          <p className="login-card__footer"><Link to="/login">Back to sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
