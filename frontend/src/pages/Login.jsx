import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
export default function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, authReady, login, register } = useApp();
  const navigate = useNavigate();
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (registerMode) await register(name, email, password);
      else await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Unable to authenticate. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (authReady && user) return <Navigate to="/" replace />;
  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand-mark">F</div>
        <strong>Finora</strong>
      </div>
      <div className="login-grid">
        <div className="login-copy">
          <span className="eyebrow">Personal banking, redesigned</span>
          <h1>Clarity for every financial decision.</h1>
          <p>
            A polished banking experience built as a React portfolio project, with realistic
            workflows and a safe simulated dataset.
          </p>
          <div className="login-points">
            <span>
              <ShieldCheck /> Demo-safe financial actions
            </span>
            <span>
              <LockKeyhole /> Secure demo account authentication
            </span>
          </div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <span className="eyebrow">{registerMode ? 'Create your account' : 'Welcome back'}</span>
          <h2>{registerMode ? 'Register for Finora' : 'Sign in to Finora'}</h2>
          <p className="muted">
            {registerMode
              ? 'Create a demo account to access your private workspace.'
              : 'Sign in with the account you registered for this demo.'}
          </p>
          {registerMode && (
            <label>
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={registerMode ? 'new-password' : 'current-password'}
              minLength={registerMode ? 8 : 1}
              maxLength={128}
              required
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary full" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : registerMode ? 'Create account' : 'Sign in'}{' '}
            <ArrowRight size={17} />
          </button>
          <p className="muted">
            {registerMode ? 'Already registered?' : 'New to Finora?'}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRegisterMode((v) => !v);
                setError('');
              }}
            >
              {registerMode ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </div>
      <footer className="login-footer">
        Finora is a fictional bank for portfolio demonstration purposes.
      </footer>
    </div>
  );
}
