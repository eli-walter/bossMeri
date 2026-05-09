// src/App.jsx
import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { App as CapApp } from '@capacitor/app';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import PlaceholderScreen from './components/PlaceholderScreen';
import './App.css';

// Reusable confirmation modal
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
  const [showSplash, setShowSplash]       = useState(true);
  const [user, setUser]                   = useState(null);
  const [authReady, setAuthReady]         = useState(false);
  const [loginError, setLoginError]       = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);
  const [activeScreen, setActiveScreen]   = useState('dashboard');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Restore Firebase Auth session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Hardware back button handler
  useEffect(() => {
    if (!user) return;

    let listener;
    const register = async () => {
      listener = await CapApp.addListener('backButton', () => {
        if (activeScreen !== 'dashboard') {
          // Any sub-screen → go back to dashboard
          setActiveScreen('dashboard');
        } else {
          // Already on dashboard → show exit confirmation
          setShowExitModal(true);
        }
      });
    };
    register();

    return () => {
      if (listener) listener.remove();
    };
  }, [user, activeScreen]);

  const handleLogin = async (email, password) => {
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        setLoginError('Incorrect email or password.');
      } else if (error.code === 'auth/invalid-email') {
        setLoginError('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setLoginError('Too many attempts. Please try again later.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout — show confirmation first
  const handleLogoutRequest = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    await signOut(auth);
    setActiveScreen('dashboard');
  };

  // Exit app confirm
  const handleExitConfirm = async () => {
    setShowExitModal(false);
    await CapApp.exitApp();
  };

  const handleNavigate = (screen) => {
    setActiveScreen(screen);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!authReady) return null;

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        error={loginError}
        loading={loginLoading}
      />
    );
  }

  const displayName = user.displayName || user.email;

  const renderScreen = () => {
    if (activeScreen === 'dashboard') {
      return <Dashboard onNavigate={handleNavigate} />;
    }
    return <PlaceholderScreen screen={activeScreen} />;
  };

  return (
    <div className="bm-app">
      <TopBar
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        onLogout={handleLogoutRequest}
        userName={displayName}
      />

      <div className="bm-screen-content">
        {renderScreen()}
      </div>

      {/* Exit app modal */}
      {showExitModal && (
        <ConfirmModal
          icon="🚪"
          title="Exit App"
          message="Are you sure you want to exit Boss Meri?"
          confirmLabel="Exit"
          confirmClass="danger"
          onConfirm={handleExitConfirm}
          onCancel={() => setShowExitModal(false)}
        />
      )}

      {/* Logout modal */}
      {showLogoutModal && (
        <ConfirmModal
          icon="👋"
          title="Log Out"
          message="Are you sure you want to log out of Boss Meri?"
          confirmLabel="Log Out"
          confirmClass="danger"
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </div>
  );
}

export default App;
