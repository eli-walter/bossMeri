import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500);
    }, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className={`bm-splash ${!visible ? 'fade-out' : ''}`}>
      <div className="bm-splash-icon">👑</div>
      <div className="bm-splash-title">Boss Meri</div>
      <div className="bm-splash-subtitle">Elizabeth's Market Manager</div>
      <div className="bm-splash-loader"></div>
    </div>
  );
};

export default SplashScreen;
