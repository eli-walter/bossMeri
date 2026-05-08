import React from 'react';
import './Dashboard.css';

const CARDS = [
  {
    key: 'otaManKaon',
    icon: '📋',
    title: 'Ota Man Kaon',
    description: "View and manage customers' credit records",
    color: '#4A0080',
  },
  {
    key: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    description: 'Alerts and updates from the market',
    color: '#B8860B',
  },
  {
    key: 'users',
    icon: '👥',
    title: 'Users',
    description: 'Manage app users and access',
    color: '#6B0099',
  },
  {
    key: 'settings',
    icon: '⚙️',
    title: 'Settings',
    description: 'Configure app preferences',
    color: '#8B0000',
  },
];

const Dashboard = ({ onNavigate }) => {
  return (
    <div className="bm-dashboard">
      <div className="bm-dashboard-greeting">
        <h2>Welcome, Boss 👑</h2>
        <p>What would you like to manage today?</p>
      </div>

      <div className="bm-cards-grid">
        {CARDS.map(card => (
          <button
            key={card.key}
            className="bm-card"
            style={{ '--card-color': card.color }}
            onClick={() => onNavigate(card.key)}
          >
            <div className="bm-card-icon">{card.icon}</div>
            <div className="bm-card-title">{card.title}</div>
            <div className="bm-card-desc">{card.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
