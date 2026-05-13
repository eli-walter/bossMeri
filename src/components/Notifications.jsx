// src/components/Notifications.jsx
//
// Reads from two Firestore collections shared with the Kaon Lo Eli app:
//   • users/{uid}     — customer profiles (fullName, status, active, createdAt)
//   • records/{docId} — purchase/payment entries (uid, record{}, dueDate, createdAt)
//
// New notification types added:
//   • debt_registered  — a purchase was recorded in the last 7 days
//   • due_date_reached — today >= dueDate and balance > 0
//   • overdue_3days    — today >= dueDate + 3 days and balance > 0
//   • payment          — partial deposit received
//   • cleared          — balance fully settled

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './Notifications.css';

const Spinner = () => <div className="notif-spinner" />;

const DAY_MS = 86_400_000;

// Compute the current time fresh each call (not a module-level constant)
const nowMs = () => Date.now();

const daysAgo = (ts) => {
  if (!ts) return Infinity;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((nowMs() - d.getTime()) / DAY_MS);
};

const relativeTime = (ts) => {
  if (!ts) return '';
  const d = daysAgo(ts);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) > 1 ? 's' : ''} ago`;
};

const formatCurrency = (n) => `SBD $${parseFloat(n || 0).toFixed(2)}`;

// Returns "Mr. John" or "John" depending on whether status is set
const statusFirst = (u) => {
  const status    = u.status ? `${u.status}.` : '';
  const firstName = u.fullName?.trim().split(/\s+/)[0] || u.fullName || 'Customer';
  return status ? `${status} ${firstName}` : firstName;
};

// Returns last name or full name as fallback
const lastName = (u) =>
  u.fullName?.trim().split(/\s+/).slice(-1)[0] || u.fullName || 'Customer';

// ─── Build notifications from raw Firestore data ──────────────────────────────
//
// `recordsByUid`  is a map of uid → array of { ...record fields, _dueDate, _createdAt }
// where _dueDate comes from the top-level Firestore document field (set by Kaon Lo Eli
// when the customer chooses a repayment due date) and _createdAt is the doc timestamp.
//
const buildNotifications = (users, recordsByUid) => {
  const items = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  users.forEach((u) => {
    const recs       = recordsByUid[u.uid] || [];
    const lastRec    = recs[recs.length - 1];
    const balance    = parseFloat(lastRec?.balance) || 0;
    const joinedDays = daysAgo(u.createdAt);

    // ── 1. New customer registered (joined within 14 days) ──────────────────
    if (joinedDays <= 14) {
      items.push({
        id:       `new-${u.uid}`,
        type:     'new_user',
        icon:     '🆕',
        title:    'New customer registered',
        body:     `${statusFirst(u)} (@${u.username || u.loginEmail?.replace('@kaon.app', '')}) has been registered and can now log in to Kaon Lo Elizabeth.`,
        time:     u.createdAt,
        priority: 3,
      });
    }

    // ── 2. Account disabled ────────────────────────────────────────────────
    if (!u.active) {
      items.push({
        id:       `disabled-${u.uid}`,
        type:     'account_disabled',
        icon:     '🚫',
        title:    'Account disabled',
        body:     `${u.fullName}'s account is currently disabled. They cannot log in to Kaon Lo Elizabeth.`,
        time:     u.createdAt,
        priority: 2,
      });
    }

    // ── 3. Very high balance (≥ SBD 100) — critical ────────────────────────
    if (balance >= 100) {
      items.push({
        id:       `debt-crit-${u.uid}`,
        type:     'debt_critical',
        icon:     '🚨',
        title:    'Critical debt level',
        body:     `${u.fullName} has an outstanding kaon of ${formatCurrency(balance)}. Immediate follow-up recommended.`,
        time:     u.createdAt,
        priority: 5,
      });
    } else if (balance >= 50) {
      // High balance (≥ SBD 50)
      items.push({
        id:       `debt-high-${u.uid}`,
        type:     'debt_high',
        icon:     '⚠️',
        title:    'High outstanding balance',
        body:     `${u.fullName} owes ${formatCurrency(balance)}. This is above the SBD 50 threshold.`,
        time:     u.createdAt,
        priority: 4,
      });
    }

    // ── 4. Due date reached / overdue ──────────────────────────────────────
    //
    // `_dueDate` is an ISO date string stored at the top level of each Firestore
    // record document (e.g. "2026-05-20"). It is set by the Kaon Lo Eli user
    // when they submit a purchase with a repayment due date.
    //
    if (balance > 0) {
      // Collect all valid due dates from purchase records for this user
      const dueDates = recs
        .filter(r => r._dueDate && !r.greyed && parseFloat(r.total || 0) > 0)
        .map(r => {
          const d = new Date(r._dueDate);
          d.setHours(0, 0, 0, 0);
          return d;
        })
        .filter(d => !isNaN(d.getTime()));

      if (dueDates.length > 0) {
        // Use the earliest unpaid due date
        dueDates.sort((a, b) => a - b);
        const earliest     = dueDates[0];
        const daysOverdue  = Math.floor((todayMs - earliest.getTime()) / DAY_MS);

        if (daysOverdue >= 3) {
          // 3 or more days overdue
          items.push({
            id:        `overdue-${u.uid}`,
            type:      'overdue_3days',
            icon:      '⏰',
            title:     'Kaon overdue',
            body:      `${lastName(u)}'s kaon is ${formatCurrency(balance)} and is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`,
            time:      null,
            timeLabel: `${daysOverdue} days overdue`,
            priority:  6,
          });
        } else if (daysOverdue >= 0) {
          // Due today or just reached
          items.push({
            id:        `duetoday-${u.uid}`,
            type:      'due_date_reached',
            icon:      '📅',
            title:     'Repayment due today',
            body:      `It is time for ${statusFirst(u)} to repay their kaon of ${formatCurrency(balance)}.`,
            time:      null,
            timeLabel: daysOverdue === 0 ? 'Due today' : 'Yesterday',
            priority:  5,
          });
        }
      }
    }

    // ── 5. Scan recent records (last 7 days) ────────────────────────────────
    recs.forEach((r, idx) => {
      const recDate = r.date
        ? new Date(r.date.split('/').reverse().join('-'))
        : (r._createdAt ? (r._createdAt.toDate ? r._createdAt.toDate() : new Date(r._createdAt)) : null);
      const recDays = recDate
        ? Math.floor((nowMs() - recDate.getTime()) / DAY_MS)
        : Infinity;

      if (recDays > 7) return; // only recent activity

      // 5a. Debt registered (any purchase on credit within 7 days)
      if (!r.greyed && parseFloat(r.total || 0) > 0) {
        items.push({
          id:        `debt-${u.uid}-${idx}`,
          type:      'debt_registered',
          icon:      '📝',
          title:     'New kaon registered',
          body:      `${statusFirst(u)} registered a new kaon of ${formatCurrency(r.total)} for ${r.item || 'items'}.`,
          time:      null,
          timeLabel: recDate ? relativeTime(recDate) : '',
          priority:  3,
        });
      }

      // 5b. Payment / partial deposit received
      if (r.greyed && parseFloat(r.deposit || 0) > 0) {
        const remaining = parseFloat(r.balance || 0);
        items.push({
          id:        `deposit-${u.uid}-${idx}`,
          type:      'payment',
          icon:      '💰',
          title:     remaining > 0 ? 'Partial payment received' : 'Kaon fully paid',
          body:      remaining > 0
            ? `${u.fullName} made a deposit of ${formatCurrency(r.deposit)}. Remaining kaon: ${formatCurrency(remaining)}.`
            : `${u.fullName} has fully settled their kaon. Balance is now $0.00.`,
          time:      null,
          timeLabel: recDate ? relativeTime(recDate) : '',
          priority:  3,
        });
      }
    });

    // ── 6. Balance fully cleared (within 14 days, no active debt) ──────────
    if (balance === 0 && recs.length > 0) {
      const lastDate = lastRec?.date
        ? new Date(lastRec.date.split('/').reverse().join('-'))
        : null;
      const lastDays = lastDate
        ? Math.floor((nowMs() - lastDate.getTime()) / DAY_MS)
        : Infinity;
      if (lastDays <= 14) {
        items.push({
          id:        `cleared-${u.uid}`,
          type:      'cleared',
          icon:      '✅',
          title:     'Kaon cleared',
          body:      `${u.fullName} has settled their full balance. Account is now clear.`,
          time:      null,
          timeLabel: lastDate ? relativeTime(lastDate) : '',
          priority:  3,
        });
      }
    }

    // ── 7. Dormant debtor (balance > 0, no activity ≥ 30 days) ─────────────
    if (balance > 0 && recs.length > 0) {
      const lastDate = lastRec?.date
        ? new Date(lastRec.date.split('/').reverse().join('-'))
        : null;
      const lastDays = lastDate
        ? Math.floor((nowMs() - lastDate.getTime()) / DAY_MS)
        : Infinity;
      if (lastDays >= 30) {
        items.push({
          id:        `dormant-${u.uid}`,
          type:      'dormant',
          icon:      '🕐',
          title:     'No activity in 30+ days',
          body:      `${u.fullName} still owes ${formatCurrency(balance)} but hasn't had any activity in ${lastDays} days.`,
          time:      u.createdAt,
          timeLabel: `${lastDays} days inactive`,
          priority:  2,
        });
      }
    }
  });

  // Sort: priority desc, then time desc
  items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ta = a.time ? (a.time.toDate ? a.time.toDate() : new Date(a.time)).getTime() : 0;
    const tb = b.time ? (b.time.toDate ? b.time.toDate() : new Date(b.time)).getTime() : 0;
    return tb - ta;
  });

  return items;
};

// ─── Type → CSS class ────────────────────────────────────────────────────────
const TYPE_CLASS = {
  overdue_3days:   'notif-critical',
  due_date_reached:'notif-warning',
  debt_critical:   'notif-critical',
  debt_high:       'notif-warning',
  debt_registered: 'notif-info',
  new_user:        'notif-info',
  payment:         'notif-success',
  cleared:         'notif-success',
  dormant:         'notif-muted',
  account_disabled:'notif-muted',
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

// ─── Filter options ───────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all',         label: 'All' },
  { key: 'overdue',     label: '⏰ Overdue' },
  { key: 'payment',     label: '💰 Payments' },
  { key: 'new_debt',    label: '📝 New Debts' },
  { key: 'new_user',    label: '🆕 New Users' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const Notifications = () => {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // Load customer profiles (includes status field added by Market Boss Users screen)
      const usersSnap = await getDocs(
        query(collection(db, 'users'), orderBy('createdAt', 'desc'))
      );
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Load all purchase/payment records.
      // Each Firestore doc has: { uid, record: {...}, dueDate?, createdAt }
      // We merge dueDate and createdAt into the record object with underscore prefix
      // so the builder can access them alongside the record fields.
      const recSnap = await getDocs(
        query(collection(db, 'records'), orderBy('createdAt', 'asc'))
      );
      const recordsByUid = {};
      recSnap.docs.forEach((d) => {
        const { uid, record, dueDate, createdAt } = d.data();
        if (!uid || !record) return;
        if (!recordsByUid[uid]) recordsByUid[uid] = [];
        // Attach doc-level fields with _ prefix to avoid collision with record fields
        recordsByUid[uid].push({ ...record, _dueDate: dueDate || null, _createdAt: createdAt });
      });

      setNotifs(buildNotifications(users, recordsByUid));
    } catch (err) {
      console.error('Notifications load error:', err);
      setError('Could not load notifications. Check connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = notifs.filter((n) => {
    if (filter === 'all')      return true;
    if (filter === 'overdue')  return n.type === 'overdue_3days' || n.type === 'due_date_reached';
    if (filter === 'payment')  return n.type === 'payment' || n.type === 'cleared';
    if (filter === 'new_debt') return n.type === 'debt_registered';
    if (filter === 'new_user') return n.type === 'new_user';
    return true;
  });

  const urgentCount = notifs.filter((n) => n.priority >= 5).length;

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
              {f.key === 'overdue' && urgentCount > 0 && (
                <span className="notif-badge">{urgentCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="notif-body">
        {loading && (
          <div className="notif-empty">
            <Spinner />
            <div className="notif-empty-text">Loading notifications…</div>
          </div>
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
              No alerts right now. Notifications appear here when customers register,
              record debts, reach repayment due dates, or make payments.
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
          Notifications are generated automatically from customer records.
          Refresh to see the latest activity.
        </div>
      )}
    </div>
  );
};

export default Notifications;
