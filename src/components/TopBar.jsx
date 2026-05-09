import React, { useState, useEffect, useRef } from 'react';
import './TopBar.css';

const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',     icon: '🏠' },
  { key: 'otaManKaon',  label: 'Ota Man Kaon',  icon: '📋' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'users',        label: 'Users',          icon: '👥' },
  { key: 'settings',     label: 'Settings',       icon: '⚙️' },
];

const TopBar = ({ activeScreen, onNavigate, onLogout, userName }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleNav = (key) => {
    onNavigate(key);
    setMenuOpen(false);
  };

  return (
    <div className="bm-topbar">
      {/* Left: App Icon */}
      <div className="bm-topbar-icon">
        <img src={process.env.PUBLIC_URL + "/assets/icon.png"} alt="Boss Meri" className="bm-topbar-icon-img" />
      </div>

      {/* Centre: App Name */}
      <div className="bm-topbar-title">Boss Meri</div>

      {/* Right: Hamburger */}
      <div className="bm-topbar-right" ref={menuRef}>
        <button
          className={`bm-hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label="Menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {menuOpen && (
          <div className="bm-dropdown">
            <div className="bm-dropdown-user">
              <span>👤 {userName}</span>
            </div>
            <div className="bm-dropdown-divider" />
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`bm-dropdown-item ${activeScreen === item.key ? 'active' : ''}`}
                onClick={() => handleNav(item.key)}
              >
                <span className="bm-dropdown-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="bm-dropdown-divider" />
            <button className="bm-dropdown-item bm-dropdown-logout" onClick={onLogout}>
              <span className="bm-dropdown-icon">🚪</span>
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
