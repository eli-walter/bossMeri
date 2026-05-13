// src/components/Dashboard.jsx
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

/**
 * Dashboard receives `adminProfile` from App.jsx which is fetched from the
 * Firestore `adminProfiles` collection.
 * Expected shape: { status: 'Mr'|'Ms'|'Mrs'|'', fullName: string, email: string }
 *
 * Admins are manually added to Firestore with their details. The greeting
 * uses their status (Mr/Ms/Mrs) and first name, e.g. "Welcome, Mr. John 👑".
 */
const Dashboard = ({ onNavigate, adminProfile }) => {
  // Build a personalised greeting from the admin profile
  const buildGreeting = () => {
    if (!adminProfile) return 'Welcome, Boss 👑';
    const status    = adminProfile.status ? `${adminProfile.status}.` : '';
    const firstName = adminProfile.fullName?.trim().split(/\s+/)[0] || 'Boss';
    return `Welcome, ${status ? status + ' ' : ''}${firstName} 👑`;
  };

  const subGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning! What would you like to manage today?';
    if (hour < 17) return 'Good afternoon! What would you like to manage today?';
    return 'Good evening! What would you like to manage today?';
  };

  return (
    <div className="bm-dashboard">
      <div className="bm-dashboard-greeting">
        <h2>{buildGreeting()}</h2>
        <p>{subGreeting()}</p>
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
