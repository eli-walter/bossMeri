// src/components/Notifications.jsx
// Generates smart notifications from live Firestore data — no separate
// notifications collection needed. Derived from users + records.

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './Notifications.css';

const Spinner = () => <div className="notif-spinner" />;

const NOW = Date.now();
const DAY_MS = 86_400_000;

const daysAgo = (ts) => {
  if (!ts) return Infinity;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((NOW - d.getTime()) / DAY_MS);
};

const relativeTime = (ts) => {
  const d = daysAgo(ts);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? 's' : ''} ago`;
};

const formatCurrency = (n) => `SBD $${parseFloat(n || 0).toFixed(2)}`;

// ─── Build notifications from raw data ────────────────────────────────────────
const buildNotifications = (users, recordsByUid) => {
  const items = [];

  users.forEach((u) => {
    const recs       = recordsByUid[u.uid] || [];
    const lastRec    = recs[recs.length - 1];
    const balance    = parseFloat(lastRec?.balance) || 0;
    const joined     = u.createdAt;
    const joinedDays = daysAgo(joined);

    // 1. New customer (joined within 14 days)
    if (joinedDays <= 14) {
      items.push({
        id: `new-${u.uid}`,
        type: 'new_user',
        icon: '🆕',
        title: 'New customer joined',
        body: `${u.fullName} (@${u.username || u.loginEmail?.replace('@kaon.app','')}) has been registered and can now log in to Kaon Lo Elizabeth.`,
        time: joined,
        priority: 3,
      });
    }

    // 2. Very high balance (≥ SBD 100) — critical
    if (balance >= 100) {
      items.push({
        id: `debt-crit-${u.uid}`,
        type: 'debt_critical',
        icon: '🚨',
        title: 'Critical debt level',
        body: `${u.fullName} has an outstanding balance of ${formatCurrency(balance)}. Consider following up.`,
        time: u.createdAt,
        priority: 5,
      });
    }
    // 3. High balance (≥ SBD 50)
    else if (balance >= 50) {
      items.push({
        id: `debt-high-${u.uid}`,
        type: 'debt_high',
        icon: '⚠️',
        title: 'High outstanding balance',
        body: `${u.fullName} owes ${formatCurrency(balance)}. This is above the SBD 50 threshold.`,
        time: u.createdAt,
        priority: 4,
      });
    }

    // 4. Account disabled
    if (!u.active) {
      items.push({
        id: `disabled-${u.uid}`,
        type: 'account_disabled',
        icon: '🚫',
        title: 'Account disabled',
        body: `${u.fullName}'s account is currently disabled. They cannot log in to Kaon Lo Elizabeth.`,
        time: u.createdAt,
        priority: 2,
      });
    }

    // 5. Scan recent records for activity (last 7 days)
    recs.forEach((r, idx) => {
      const recDate = r.date ? new Date(r.date.split('/').reverse().join('-')) : null;
      const recDays = recDate ? Math.floor((NOW - recDate.getTime()) / DAY_MS) : Infinity;

      if (recDays > 7) return; // only show recent activity

      // Recent deposit/payment
      if (r.greyed && parseFloat(r.deposit) > 0) {
        items.push({
          id: `deposit-${u.uid}-${idx}`,
          type: 'payment',
          icon: '💰',
          title: 'Payment received',
          body: `${u.fullName} made a deposit of ${formatCurrency(r.deposit)}. Remaining balance: ${formatCurrency(r.balance)}.`,
          time: null,
          timeLabel: relativeTime(recDate),
          priority: 3,
        });
      }

      // Large purchase (total ≥ SBD 15)
      if (!r.greyed && parseFloat(r.total) >= 15) {
        items.push({
          id: `bigbuy-${u.uid}-${idx}`,
          type: 'large_purchase',
          icon: '🛒',
          title: 'Large purchase on credit',
          body: `${u.fullName} bought ${r.item} (×${r.qty}) for ${formatCurrency(r.total)} on credit. Balance is now ${formatCurrency(r.balance)}.`,
          time: null,
          timeLabel: relativeTime(recDate),
          priority: 3,
        });
      }
    });

    // 6. Dormant debtor (balance > 0, no activity in 30+ days)
    if (balance > 0 && recs.length > 0) {
      const lastDate = lastRec?.date
        ? new Date(lastRec.date.split('/').reverse().join('-'))
        : null;
      const lastDays = lastDate ? Math.floor((NOW - lastDate.getTime()) / DAY_MS) : Infinity;
      if (lastDays >= 30) {
        items.push({
          id: `dormant-${u.uid}`,
          type: 'dormant',
          icon: '🕐',
          title: 'No activity in 30+ days',
          body: `${u.fullName} still owes ${formatCurrency(balance)} but hasn't had any activity in ${lastDays} days.`,
          time: u.createdAt,
          timeLabel: `${lastDays} days inactive`,
          priority: 2,
        });
      }
    }

    // 7. Balance fully cleared
    if (balance === 0 && recs.length > 0) {
      const lastDate = lastRec?.date
        ? new Date(lastRec.date.split('/').reverse().join('-'))
        : null;
      const lastDays = lastDate ? Math.floor((NOW - lastDate.getTime()) / DAY_MS) : Infinity;
      if (lastDays <= 14) {
        items.push({
          id: `cleared-${u.uid}`,
          type: 'cleared',
          icon: '✅',
          title: 'Balance cleared',
          body: `${u.fullName} has settled their account. Balance is now $0.00.`,
          time: null,
          timeLabel: relativeTime(lastDate),
          priority: 3,
        });
      }
    }
  });

  // Sort: priority desc, then by time desc
  items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ta = a.time ? (a.time.toDate ? a.time.toDate() : new Date(a.time)).getTime() : 0;
    const tb = b.time ? (b.time.toDate ? b.time.toDate() : new Date(b.time)).getTime() : 0;
    return tb - ta;
  });

  return items;
};

// ─── Type config (for colour coding) ─────────────────────────────────────────
const TYPE_CLASS = {
  debt_critical:   'notif-critical',
  debt_high:       'notif-warning',
  new_user:        'notif-info',
  payment:         'notif-success',
  large_purchase:  'notif-warning',
  dormant:         'notif-muted',
  account_disabled:'notif-muted',
  cleared:         'notif-success',
};

// ─── Single notification card ─────────────────────────────────────────────────
const NotifCard = ({ item }) => (
  <div className={`notif-card ${TYPE_CLASS[item.type] || ''}`}>
    <div className="notif-icon">{item.icon}</div>
    <div className="notif-content">
      <div className="notif-title">{item.title}</div>
      <div className="notif-body">{item.body}</div>
    </div>
    {(item.time || item.timeLabel) && (
      <div className="notif-time">
        {item.timeLabel || relativeTime(item.time)}
      </div>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'critical', label: '🚨 Urgent' },
  { key: 'payment',  label: '💰 Payments' },
  { key: 'new_user', label: '🆕 New Users' },
];

const Notifications = () => {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const recSnap = await getDocs(query(collection(db, 'records'), orderBy('createdAt', 'asc')));
      const recordsByUid = {};
      recSnap.docs.forEach((d) => {
        const { uid, record } = d.data();
        if (!uid || !record) return;
        if (!recordsByUid[uid]) recordsByUid[uid] = [];
        recordsByUid[uid].push(record);
      });

      setNotifs(buildNotifications(users, recordsByUid));
    } catch (err) {
      console.error('Notifications load error:', err);
      setError('Could not load notifications. Try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = notifs.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'critical') return n.priority >= 4;
    if (filter === 'payment')  return n.type === 'payment' || n.type === 'cleared';
    if (filter === 'new_user') return n.type === 'new_user';
    return true;
  });

  const urgentCount = notifs.filter((n) => n.priority >= 4).length;

  return (
    <div className="notif-screen">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <span className="notif-header-icon">🔔</span>
          <div>
            <div className="notif-header-title">Notifications</div>
            <div className="notif-header-sub">
              {loading ? 'Loading…' : urgentCount > 0
                ? `${urgentCount} urgent · ${notifs.length} total`
                : `${notifs.length} notification${notifs.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
        <button className="notif-refresh-btn" onClick={loadData} disabled={loading} title="Refresh">
          🔄
        </button>
      </div>

      {/* Filter tabs */}
      {!loading && notifs.length > 0 && (
        <div className="notif-filter-row">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              className={`notif-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === 'critical' && urgentCount > 0 && (
                <span className="notif-badge">{urgentCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="notif-body">
        {loading && (
          <div className="notif-empty"><Spinner /><div className="notif-empty-text">Loading notifications…</div></div>
        )}
        {!loading && error && (
          <div className="notif-empty">
            <div className="notif-empty-icon">⚠️</div>
            <div className="notif-empty-text">{error}</div>
            <button className="notif-btn-primary" onClick={loadData}>Try Again</button>
          </div>
        )}
        {!loading && !error && notifs.length === 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon">🔔</div>
            <div className="notif-empty-title">All quiet!</div>
            <div className="notif-empty-text">
              No alerts right now. Add customers and record their purchases to see activity here.
            </div>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && notifs.length > 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon">✅</div>
            <div className="notif-empty-text">No notifications in this category.</div>
          </div>
        )}
        {!loading && !error && filtered.map((n) => (
          <NotifCard key={n.id} item={n} />
        ))}
      </div>

      {!loading && !error && notifs.length > 0 && (
        <div className="notif-footer-note">
          Notifications are generated automatically from customer records and are refreshed each time you open this screen.
        </div>
      )}
    </div>
  );
};

export default Notifications;
