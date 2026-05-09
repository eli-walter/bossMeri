// src/components/Settings.jsx
import React from 'react';
import './Settings.css';

const FONT_SIZES = [
  { label: 'Small',   value: '14px' },
  { label: 'Medium',  value: '16px' },
  { label: 'Large',   value: '18px' },
  { label: 'X-Large', value: '20px' },
];

const Settings = ({ settings, onSettingsChange }) => {
  const { language, fontSize, theme } = settings;

  const update = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="bm-settings">
      <div className="bm-settings-header">
        <span className="bm-settings-header-icon">⚙️</span>
        <div>
          <div className="bm-settings-header-title">Settings</div>
          <div className="bm-settings-header-sub">App preferences</div>
        </div>
      </div>

      {/* ── Language ── */}
      <div className="bm-settings-section">
        <div className="bm-settings-section-label">🌐 Language</div>
        <div className="bm-settings-card">
          <button
            className={`bm-settings-option ${language === 'en' ? 'active' : ''}`}
            onClick={() => update('language', 'en')}
          >
            <span className="bm-settings-option-icon">🇬🇧</span>
            <div className="bm-settings-option-text">
              <div className="bm-settings-option-title">English</div>
              <div className="bm-settings-option-sub">Default language</div>
            </div>
            {language === 'en' && <span className="bm-settings-check">✓</span>}
          </button>

          <div className="bm-settings-divider" />

          <button
            className={`bm-settings-option disabled ${language === 'pij' ? 'active' : ''}`}
            disabled
          >
            <span className="bm-settings-option-icon">🇸🇧</span>
            <div className="bm-settings-option-text">
              <div className="bm-settings-option-title">Solomon Pidgin</div>
              <div className="bm-settings-option-sub">Coming soon</div>
            </div>
            <span className="bm-settings-soon">Soon</span>
          </button>
        </div>
      </div>

      {/* ── Font Size ── */}
      <div className="bm-settings-section">
        <div className="bm-settings-section-label">🔡 Font Size</div>
        <div className="bm-settings-card bm-settings-card-pad">
          <div className="bm-font-preview" style={{ fontSize }}>
            The quick brown fox
          </div>
          <div className="bm-font-buttons">
            {FONT_SIZES.map(f => (
              <button
                key={f.value}
                className={`bm-font-btn ${fontSize === f.value ? 'active' : ''}`}
                onClick={() => update('fontSize', f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="bm-font-slider-row">
            <span className="bm-font-slider-label">A</span>
            <input
              type="range"
              min="12"
              max="22"
              value={parseInt(fontSize)}
              onChange={e => update('fontSize', e.target.value + 'px')}
              className="bm-font-slider"
            />
            <span className="bm-font-slider-label large">A</span>
          </div>
        </div>
      </div>

      {/* ── Theme ── */}
      <div className="bm-settings-section">
        <div className="bm-settings-section-label">🎨 Theme</div>
        <div className="bm-settings-card">
          <button
            className={`bm-settings-option ${theme === 'bright' ? 'active' : ''}`}
            onClick={() => update('theme', 'bright')}
          >
            <span className="bm-settings-option-icon">☀️</span>
            <div className="bm-settings-option-text">
              <div className="bm-settings-option-title">Bright</div>
              <div className="bm-settings-option-sub">Light background</div>
            </div>
            {theme === 'bright' && <span className="bm-settings-check">✓</span>}
          </button>

          <div className="bm-settings-divider" />

          <button
            className={`bm-settings-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => update('theme', 'dark')}
          >
            <span className="bm-settings-option-icon">🌙</span>
            <div className="bm-settings-option-text">
              <div className="bm-settings-option-title">Dark</div>
              <div className="bm-settings-option-sub">Dark background</div>
            </div>
            {theme === 'dark' && <span className="bm-settings-check">✓</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
