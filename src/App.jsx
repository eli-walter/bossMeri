import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import PlaceholderScreen from './components/PlaceholderScreen';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState('dashboard');

  // Restore Firebase Auth session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

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

  const handleLogout = async () => {
    await signOut(auth);
    setActiveScreen('dashboard');
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
        onLogout={handleLogout}
        userName={displayName}
      />
      <div className="bm-screen-content">
        {renderScreen()}
      </div>
    </div>
  );
}

export default App;
