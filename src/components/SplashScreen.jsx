// src/components/SplashScreen.jsx
import React, { useEffect, useState } from 'react';
import { SplashScreen as CapSplash } from '@capacitor/splash-screen';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    CapSplash.hide({ fadeOutDuration: 200 });

    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500);
    }, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className={`bm-splash ${!visible ? 'fade-out' : ''}`}>
      <img
        src={process.env.PUBLIC_URL + '/assets/icon.png'}
        alt="Boss Meri"
        className="bm-splash-icon-img"
      />
      <div className="bm-splash-loader"></div>
    </div>
  );
};

export default SplashScreen;
