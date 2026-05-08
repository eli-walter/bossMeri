import React from 'react';
import './PlaceholderScreen.css';

const ICONS = {
  otaManKaon:    { icon: '📋', title: 'Ota Man Kaon',  subtitle: "Customer credit records" },
  notifications: { icon: '🔔', title: 'Notifications',  subtitle: "Alerts and updates" },
  users:         { icon: '👥', title: 'Users',           subtitle: "Manage access" },
  settings:      { icon: '⚙️', title: 'Settings',        subtitle: "App preferences" },
};

const PlaceholderScreen = ({ screen }) => {
  const info = ICONS[screen] || { icon: '📄', title: screen, subtitle: '' };
  return (
    <div className="bm-placeholder">
      <div className="bm-placeholder-icon">{info.icon}</div>
      <div className="bm-placeholder-title">{info.title}</div>
      <div className="bm-placeholder-subtitle">{info.subtitle}</div>
      <div className="bm-placeholder-badge">Coming Soon</div>
    </div>
  );
};

export default PlaceholderScreen;
