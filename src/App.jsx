// src/App.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { App as CapApp } from '@capacitor/app';
import SplashScreen      from './components/SplashScreen';
import Login             from './components/Login';
import TopBar            from './components/TopBar';
import Dashboard         from './components/Dashboard';
import Settings          from './components/Settings';
import Users             from './components/Users';
import OtaManKaon        from './components/OtaManKaon';
import Notifications     from './components/Notifications';
import PlaceholderScreen from './components/PlaceholderScreen';
import './App.css';

const SETTINGS_KEY = 'bmSettings';
const DEFAULT_SETTINGS = { language: 'en', fontSize: '16px', theme: 'bright' };

const ConfirmModal = ({ icon, title, message, confirmLabel, confirmClass, onConfirm, onCancel }) => (
  <div className="bm-modal-overlay">
    <div className="bm-modal">
      <div className="bm-modal-icon">{icon}</div>
      <div className="bm-modal-title">{title}</div>
      <div className="bm-modal-message">{message}</div>
      <div className="bm-modal-buttons">
        <button className="bm-modal-btn cancel" onClick={onCancel}>Cancel</button>
        <button className={`bm-modal-btn ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

function App() {
  const [showSplash, setShowSplash]           = useState(true);
  const [user, setUser]                       = useState(null);
  const [authReady, setAuthReady]             = useState(false);
  const [loginError, setLoginError]           = useState('');
  const [loginLoading, setLoginLoading]       = useState(false);
  const [activeScreen, setActiveScreen]       = useState('dashboard');
  const [showExitModal, setShowExitModal]     = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Admin profile fetched from Firestore 'adminProfiles' collection.
  // Each document is keyed by the admin's Firebase Auth UID and contains:
  // { status: 'Mr'|'Ms'|'Mrs', fullName: string, email: string }
  const [adminProfile, setAdminProfile] = useState(null);

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // Apply theme + font size
  useEffect(() => {
    const root = document.documentElement;
    const isDark = settings.theme === 'dark';

    root.style.fontSize = settings.fontSize;
    root.style.setProperty('--font-size-base', settings.fontSize);
    root.style.setProperty('--bg-main',        isDark ? '#121212' : '#f4f6f9');
    root.style.setProperty('--card-bg',        isDark ? '#1e1e1e' : '#ffffff');
    root.style.setProperty('--text-primary',   isDark ? '#f0f0f0' : '#1a1a2e');
    root.style.setProperty('--text-secondary', isDark ? '#aaaaaa' : '#666666');
    root.style.setProperty('--divider',        isDark ? '#333333' : '#eeeeee');
    root.style.setProperty('--hover-bg',       isDark ? '#2a2a2a' : '#faf8ff');
    root.style.setProperty('--active-bg',      isDark ? '#2d1a40' : '#f0e6ff');

    document.body.style.background = isDark ? '#121212' : '#f4f6f9';
    document.body.style.fontSize   = settings.fontSize;

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Listen for auth state and fetch admin profile on login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        try {
          const profileSnap = await getDoc(doc(db, 'adminProfiles', u.uid));
          if (profileSnap.exists()) {
            setAdminProfile(profileSnap.data());
          } else {
            // Fallback: build a minimal profile from Firebase Auth data
            setAdminProfile({
              status: '',
              fullName: u.displayName || u.email,
              email: u.email,
            });
          }
        } catch (err) {
          console.error('Failed to load admin profile:', err);
          setAdminProfile({ status: '', fullName: u.displayName || u.email, email: u.email });
        }
      } else {
        setAdminProfile(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    let listener;
    const reg = async () => {
      listener = await CapApp.addListener('backButton', () => {
        if (activeScreen !== 'dashboard') setActiveScreen('dashboard');
        else setShowExitModal(true);
      });
    };
    reg();
    return () => { if (listener) listener.remove(); };
  }, [user, activeScreen]);

  const handleLogin = async (email, password) => {
    setLoginError(''); setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const c = err.code;
      if (c === 'auth/user-not-found' || c === 'auth/wrong-password' || c === 'auth/invalid-credential')
        setLoginError('Incorrect email or password.');
      else if (c === 'auth/invalid-email') setLoginError('Invalid email address.');
      else if (c === 'auth/too-many-requests') setLoginError('Too many attempts. Try again later.');
      else setLoginError('Login failed. Please try again.');
    } finally { setLoginLoading(false); }
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false); await signOut(auth); setActiveScreen('dashboard');
  };
  const handleExitConfirm = async () => {
    setShowExitModal(false); await CapApp.exitApp();
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (!authReady) return null;
  if (!user) return <Login onLogin={handleLogin} error={loginError} loading={loginLoading} />;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':     return <Dashboard onNavigate={setActiveScreen} adminProfile={adminProfile} />;
      case 'users':         return <Users />;
      case 'otaManKaon':    return <OtaManKaon />;
      case 'notifications': return <Notifications />;
      case 'settings':      return <Settings settings={settings} onSettingsChange={setSettings} />;
      default:              return <PlaceholderScreen screen={activeScreen} />;
    }
  };

  // Build display name for TopBar: "Mr. John" or fallback to email
  const topBarName = adminProfile
    ? [adminProfile.status, adminProfile.fullName?.split(' ')[0]].filter(Boolean).join(' ')
    : (user.displayName || user.email);

  return (
    <div className={`bm-app theme-${settings.theme}`}>
      <TopBar
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        onLogout={() => setShowLogoutModal(true)}
        userName={topBarName}
      />
      <div className="bm-screen-content">{renderScreen()}</div>

      {showExitModal && (
        <ConfirmModal icon="🚪" title="Exit App"
          message="Are you sure you want to exit Market Boss?"
          confirmLabel="Exit" confirmClass="danger"
          onConfirm={handleExitConfirm} onCancel={() => setShowExitModal(false)} />
      )}
      {showLogoutModal && (
        <ConfirmModal icon="👋" title="Log Out"
          message="Are you sure you want to log out of Market Boss?"
          confirmLabel="Log Out" confirmClass="danger"
          onConfirm={handleLogoutConfirm} onCancel={() => setShowLogoutModal(false)} />
      )}
    </div>
  );
}

export default App;
