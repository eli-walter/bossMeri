import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin, error, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email.trim(), password);
  };

  return (
    <div className="bm-login-screen">
      <div className="bm-login-card">
        <div className="bm-login-header">
          <img src="/assets/icon.png" alt="Boss Meri" className="bm-login-icon" />
          <h1>Boss Meri</h1>
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
        </form>
      </div>
    </div>
  );
};

export default Login;
