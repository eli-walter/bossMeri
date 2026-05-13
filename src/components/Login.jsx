// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

const Login = ({ onLogin, error, loading }) => {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [mounted, setMounted]     = useState(false);

  // Forgot-password state
  const [showForgot, setShowForgot]         = useState(false);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [forgotStatus, setForgotStatus]     = useState(''); // 'sent' | 'error' | ''
  const [forgotLoading, setForgotLoading]   = useState(false);

  // Prevent flash of unstyled content
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email.trim(), password);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotStatus('');
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotStatus('sent');
    } catch (err) {
      // Always show success to avoid user enumeration, except for invalid email format
      if (err.code === 'auth/invalid-email') {
        setForgotStatus('invalid');
      } else {
        setForgotStatus('sent');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  if (!mounted) return null;

  // ── Forgot Password View ──────────────────────────────────────────────────
  if (showForgot) {
    return (
      <div className="bm-login-screen">
        <div className="bm-login-card">
          <div className="bm-login-header">
            <img src={process.env.PUBLIC_URL + "/assets/icon.png"} alt="Market Boss" className="bm-login-icon" />
            <h1>Market Boss</h1>
            <p>Reset your password</p>
          </div>

          {forgotStatus === 'sent' ? (
            <div className="bm-login-form">
              <div className="bm-login-success">
                ✅ Password reset email sent. Check your inbox and follow the link to set a new password.
              </div>
              <button
                className="bm-login-btn"
                onClick={() => { setShowForgot(false); setForgotStatus(''); setForgotEmail(''); }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form className="bm-login-form" onSubmit={handleForgot}>
              <div className="bm-login-field">
                <label htmlFor="forgotEmail">Your Email Address</label>
                <input
                  type="email"
                  id="forgotEmail"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>

              {forgotStatus === 'invalid' && (
                <div className="bm-login-error">Please enter a valid email address.</div>
              )}

              <button type="submit" className="bm-login-btn" disabled={forgotLoading}>
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                className="bm-login-link"
                onClick={() => { setShowForgot(false); setForgotStatus(''); setForgotEmail(''); }}
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Normal Login View ─────────────────────────────────────────────────────
  return (
    <div className="bm-login-screen">
      <div className="bm-login-card">
        <div className="bm-login-header">
          <img src={process.env.PUBLIC_URL + "/assets/icon.png"} alt="Market Boss" className="bm-login-icon" />
          <h1>Market Boss</h1>
          <p>Elizabeth's Market Manager</p>
        </div>

        <form className="bm-login-form" onSubmit={handleSubmit}>
          <div className="bm-login-field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>

          <div className="bm-login-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="bm-login-error">{error}</div>}

          <button type="submit" className="bm-login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <button
            type="button"
            className="bm-login-link"
            onClick={() => setShowForgot(true)}
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
