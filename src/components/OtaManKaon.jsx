// src/components/OtaManKaon.jsx
// "Ota Man Kaon" = Track / Record Credit
// Shows all customers ranked by highest outstanding debt.
// Tap a customer card to see their full transaction history.

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './OtaManKaon.css';

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AVATAR_COLORS = [
  '#4A0080','#6B0099','#8B0000','#B8860B',
  '#005f73','#0a9396','#ae2012','#ca6702',
];
const pickColor = (uid) =>
  AVATAR_COLORS[(uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1)) % AVATAR_COLORS.length];

const getInitials = (name) => {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

const Spinner = () => <div className="omk-spinner" />;

// ─── Debt History Modal ───────────────────────────────────────────────────────
const DebtHistoryModal = ({ customer, records, onClose }) => {
  const balance = parseFloat(records[records.length - 1]?.balance) || 0;
  const isOwed  = balance > 0;

  return (
    <div className="omk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="omk-modal">
        {/* Header */}
        <div className="omk-modal-header">
          <div className="omk-modal-avatar" style={{ background: pickColor(customer.uid) }}>
            {getInitials(customer.fullName)}
          </div>
          <div className="omk-modal-header-info">
            <div className="omk-modal-name">{customer.fullName}</div>
            <div className="omk-modal-username">@{customer.username || customer.loginEmail?.replace('@kaon.app','')}</div>
          </div>
          <button className="omk-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Balance summary */}
        <div className={`omk-balance-banner ${isOwed ? 'omk-balance-owed' : 'omk-balance-clear'}`}>
          <span className="omk-balance-label">{isOwed ? '📋 Outstanding Balance' : '✅ All Cleared'}</span>
          <span className="omk-balance-amount">SBD ${balance.toFixed(2)}</span>
        </div>

        {/* Record table */}
        <div className="omk-table-scroll">
          {records.length === 0 ? (
            <div className="omk-no-records">No transactions recorded yet.</div>
          ) : (
            <table className="omk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Deposit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className={r.greyed ? 'omk-row-deposit' : ''}>
                    <td>{r.date}</td>
                    <td className={r.greyed ? 'omk-greyed' : ''}>{r.item}</td>
                    <td className={r.greyed ? 'omk-greyed' : ''}>{r.qty}</td>
                    <td className={r.greyed ? 'omk-greyed' : ''}>{r.unitPrice}</td>
                    <td className={r.greyed ? 'omk-greyed' : ''}>{r.total}</td>
                    <td className="omk-cell-deposit">{r.deposit ? `$${r.deposit}` : ''}</td>
                    <td className={`omk-cell-balance ${parseFloat(r.balance) > 0 ? 'omk-balance-pos' : 'omk-balance-zero'}`}>
                      ${r.balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="omk-modal-footer">
          <button className="omk-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── Customer Debt Card ───────────────────────────────────────────────────────
const DebtCard = ({ rank, customer, balance, lastActivity, onClick }) => {
  const isHighDebt = balance >= 50;
  const isMedDebt  = balance >= 20 && balance < 50;

  return (
    <div
      className={`omk-card ${isHighDebt ? 'omk-card-high' : isMedDebt ? 'omk-card-med' : 'omk-card-low'}`}
      onClick={onClick}
    >
      <div className="omk-card-rank">#{rank}</div>
      <div className="omk-card-avatar" style={{ background: pickColor(customer.uid) }}>
        {getInitials(customer.fullName)}
      </div>
      <div className="omk-card-info">
        <div className="omk-card-name">{customer.fullName}</div>
        <div className="omk-card-meta">
          <span className="omk-card-username">@{customer.username || customer.loginEmail?.replace('@kaon.app','')}</span>
          {lastActivity && <span className="omk-card-date">· Last: {lastActivity}</span>}
        </div>
      </div>
      <div className="omk-card-right">
        <div className={`omk-debt-amount ${isHighDebt ? 'omk-debt-high' : isMedDebt ? 'omk-debt-med' : 'omk-debt-low'}`}>
          SBD ${balance.toFixed(2)}
        </div>
        {isHighDebt && <div className="omk-debt-tag">⚠️ HIGH</div>}
        <div className="omk-chevron">›</div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const OtaManKaon = () => {
  const [customers, setCustomers]     = useState([]);  // [{ ...userDoc, balance, records, lastActivity }]
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [selected, setSelected]       = useState(null); // customer for history modal
  const [showZeroBalance, setShowZeroBalance] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // Load all users
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'asc')));
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Load all records
      const recSnap = await getDocs(query(collection(db, 'records'), orderBy('createdAt', 'asc')));
      const allRecords = recSnap.docs.map((d) => ({ ...d.data() }));

      // Group records by uid
      const recordsByUid = {};
      allRecords.forEach(({ uid, record }) => {
        if (!uid || !record) return;
        if (!recordsByUid[uid]) recordsByUid[uid] = [];
        recordsByUid[uid].push(record);
      });

      // Build customer objects with balance + lastActivity
      const enriched = users.map((u) => {
        const recs   = recordsByUid[u.uid] || [];
        const lastRec = recs[recs.length - 1];
        const balance = parseFloat(lastRec?.balance) || 0;
        const lastActivity = lastRec?.date || null;
        return { ...u, balance, records: recs, lastActivity };
      });

      // Sort by highest balance descending
      enriched.sort((a, b) => b.balance - a.balance);
      setCustomers(enriched);
    } catch (err) {
      console.error('OtaManKaon load error:', err);
      setError('Could not load records. Check your connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalOwed   = customers.reduce((s, c) => s + c.balance, 0);
  const debtors     = customers.filter((c) => c.balance > 0);
  const displayed   = showZeroBalance ? customers : debtors;

  return (
    <div className="omk-screen">
      {/* Header */}
      <div className="omk-header">
        <div className="omk-header-left">
          <span className="omk-header-icon">📋</span>
          <div>
            <div className="omk-header-title">Ota Man Kaon</div>
            <div className="omk-header-sub">
              {loading ? 'Loading…' : `${debtors.length} debtor${debtors.length !== 1 ? 's' : ''} · SBD $${totalOwed.toFixed(2)} total`}
            </div>
          </div>
        </div>
        <button className="omk-refresh-btn" onClick={loadData} disabled={loading} title="Refresh">
          🔄
        </button>
      </div>

      {/* Summary strip */}
      {!loading && !error && customers.length > 0 && (
        <div className="omk-summary-strip">
          <div className="omk-summary-item">
            <span className="omk-summary-val">{customers.length}</span>
            <span className="omk-summary-lbl">Customers</span>
          </div>
          <div className="omk-summary-divider" />
          <div className="omk-summary-item">
            <span className="omk-summary-val omk-col-red">{debtors.length}</span>
            <span className="omk-summary-lbl">With Debt</span>
          </div>
          <div className="omk-summary-divider" />
          <div className="omk-summary-item">
            <span className="omk-summary-val omk-col-red">SBD ${totalOwed.toFixed(2)}</span>
            <span className="omk-summary-lbl">Total Owed</span>
          </div>
        </div>
      )}

      {/* Toggle: show cleared accounts */}
      {!loading && !error && customers.length > 0 && (
        <div className="omk-toggle-row">
          <button
            className={`omk-toggle-btn ${showZeroBalance ? 'active' : ''}`}
            onClick={() => setShowZeroBalance((v) => !v)}
          >
            {showZeroBalance ? '👁 Hide cleared accounts' : '👁 Show cleared accounts'}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="omk-body">
        {loading && (
          <div className="omk-empty"><Spinner /><div className="omk-empty-text">Loading records…</div></div>
        )}
        {!loading && error && (
          <div className="omk-empty">
            <div className="omk-empty-icon">⚠️</div>
            <div className="omk-empty-text">{error}</div>
            <button className="omk-btn-primary" onClick={loadData}>Try Again</button>
          </div>
        )}
        {!loading && !error && debtors.length === 0 && (
          <div className="omk-empty">
            <div className="omk-empty-icon">🎉</div>
            <div className="omk-empty-title">All Cleared!</div>
            <div className="omk-empty-text">No outstanding debts at the moment.</div>
          </div>
        )}
        {!loading && !error && displayed.map((c, i) => (
          <DebtCard
            key={c.uid}
            rank={i + 1}
            customer={c}
            balance={c.balance}
            lastActivity={c.lastActivity}
            onClick={() => setSelected(c)}
          />
        ))}
      </div>

      {/* History modal */}
      {selected && (
        <DebtHistoryModal
          customer={selected}
          records={selected.records}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default OtaManKaon;
