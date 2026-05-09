// src/components/Users.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as secondarySignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import './Users.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toEmail = (email) => email.trim().toLowerCase();

const getInitials = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

const AVATAR_COLORS = [
  '#4A0080', '#6B0099', '#8B0000', '#B8860B',
  '#005f73', '#0a9396', '#ae2012', '#ca6702',
];
const pickColor = (uid) => AVATAR_COLORS[(uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1)) % AVATAR_COLORS.length];

const toWaLink = (number) => {
  const digits = number.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}`;
};

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Secondary Firebase Auth (creates users without signing admin out) ────────
const getSecondaryAuth = () => {
  const APP_NAME = 'kaon-user-auth';
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing || initializeApp(firebaseConfig, APP_NAME);
  return getAuth(app);
};

// ─── Validators ───────────────────────────────────────────────────────────────
const validateAdd = ({ loginEmail, fullName, whatsapp, password, confirmPassword }) => {
  const e = {};
  if (!loginEmail.trim())
    e.loginEmail = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim()))
    e.loginEmail = 'Enter a valid email address (e.g. ana@gmail.com).';
  if (!fullName.trim())
    e.fullName = 'Full name is required.';
  if (!whatsapp.trim())
    e.whatsapp = 'WhatsApp number is required.';
  else if (!/^\+?[\d\s\-()]{7,20}$/.test(whatsapp.trim()))
    e.whatsapp = 'Enter a valid phone number (e.g. +677 12345).';
  if (!password)
    e.password = 'Password is required.';
  else if (password.length < 6)
    e.password = 'Password must be at least 6 characters.';
  if (password !== confirmPassword)
    e.confirmPassword = 'Passwords do not match.';
  return e;
};

const validateEdit = ({ fullName, whatsapp }) => {
  const e = {};
  if (!fullName.trim()) e.fullName = 'Full name is required.';
  if (!whatsapp.trim())
    e.whatsapp = 'WhatsApp number is required.';
  else if (!/^\+?[\d\s\-()]{7,20}$/.test(whatsapp.trim()))
    e.whatsapp = 'Enter a valid phone number (e.g. +677 12345).';
  return e;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FieldError = ({ msg }) =>
  msg ? <div className="bmu-field-error">{msg}</div> : null;

const Spinner = () => <div className="bmu-spinner" />;

/** Modal backdrop wrapper */
const Modal = ({ onClose, children }) => (
  <div className="bmu-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="bmu-modal">{children}</div>
  </div>
);

/** Add User Modal */
const AddUserModal = ({ onClose, onSave, saving, saveError }) => {
  const EMPTY = { loginEmail: '', fullName: '', whatsapp: '', password: '', confirmPassword: '' };
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = () => {
    const errs = validateAdd(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    onSave(form);
  };

  return (
    <Modal onClose={onClose}>
      <div className="bmu-modal-header">
        <span className="bmu-modal-header-icon">👤</span>
        <div>
          <div className="bmu-modal-title">Add New User</div>
          <div className="bmu-modal-sub">Creates a login account for Kaon Lo Elizabeth</div>
        </div>
      </div>

      <div className="bmu-form-scroll">
        {/* Login Email */}
        <div className="bmu-field">
          <label className="bmu-label">Email <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.loginEmail ? 'error' : ''}`}
            value={form.loginEmail}
            onChange={set('loginEmail')}
            placeholder="e.g. ana@gmail.com"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <FieldError msg={errors.loginEmail} />
        </div>

        {/* Full Name */}
        <div className="bmu-field">
          <label className="bmu-label">Full Name <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.fullName ? 'error' : ''}`}
            value={form.fullName}
            onChange={set('fullName')}
            placeholder="e.g. Ana Napo"
          />
          <FieldError msg={errors.fullName} />
        </div>

        {/* WhatsApp */}
        <div className="bmu-field">
          <label className="bmu-label">WhatsApp Number <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.whatsapp ? 'error' : ''}`}
            value={form.whatsapp}
            onChange={set('whatsapp')}
            placeholder="e.g. +677 12345"
            type="tel"
          />
          <FieldError msg={errors.whatsapp} />
        </div>

        {/* Password */}
        <div className="bmu-field">
          <label className="bmu-label">Password <span className="bmu-required">*</span></label>
          <div className="bmu-pwd-row">
            <input
              className={`bmu-input bmu-pwd-input ${errors.password ? 'error' : ''}`}
              value={form.password}
              onChange={set('password')}
              type={showPwd ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="bmu-pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}
            >{showPwd ? '🙈' : '👁️'}</button>
          </div>
          <FieldError msg={errors.password} />
        </div>

        {/* Confirm Password */}
        <div className="bmu-field">
          <label className="bmu-label">Confirm Password <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.confirmPassword ? 'error' : ''}`}
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            type={showPwd ? 'text' : 'password'}
            placeholder="Re-enter password"
            autoComplete="new-password"
          />
          <FieldError msg={errors.confirmPassword} />
        </div>

        {saveError && <div className="bmu-save-error">⚠️ {saveError}</div>}
      </div>

      <div className="bmu-modal-footer">
        <button className="bmu-btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="bmu-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? <><Spinner /> Creating…</> : 'Create User'}
        </button>
      </div>
    </Modal>
  );
};

/** Edit User Modal */
const EditUserModal = ({ user, onClose, onSave, saving, saveError }) => {
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    whatsapp: user.whatsapp || '',
  });
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = () => {
    const errs = validateEdit(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    onSave(form);
  };

  return (
    <Modal onClose={onClose}>
      <div className="bmu-modal-header">
        <div
          className="bmu-avatar bmu-avatar-lg"
          style={{ background: pickColor(user.uid) }}
        >
          {getInitials(user.fullName)}
        </div>
        <div>
          <div className="bmu-modal-title">Edit User</div>
          <div className="bmu-modal-sub">{user.loginEmail}</div>
        </div>
      </div>

      <div className="bmu-form-scroll">
        <div className="bmu-field">
          <label className="bmu-label">Full Name <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.fullName ? 'error' : ''}`}
            value={form.fullName}
            onChange={set('fullName')}
          />
          <FieldError msg={errors.fullName} />
        </div>

        <div className="bmu-field">
          <label className="bmu-label">WhatsApp Number <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.whatsapp ? 'error' : ''}`}
            value={form.whatsapp}
            onChange={set('whatsapp')}
            type="tel"
          />
          <FieldError msg={errors.whatsapp} />
        </div>

        <div className="bmu-info-note">
          🔒 Email and password can only be changed via the Firebase Console.
        </div>

        {saveError && <div className="bmu-save-error">⚠️ {saveError}</div>}
      </div>

      <div className="bmu-modal-footer">
        <button className="bmu-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="bmu-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? <><Spinner /> Saving…</> : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
};

/** Confirm action modal */
const ConfirmModal = ({ icon, title, message, confirmLabel, danger, onConfirm, onCancel }) => (
  <div className="bmu-overlay">
    <div className="bmu-modal bmu-modal-confirm">
      <div className="bmu-confirm-icon">{icon}</div>
      <div className="bmu-confirm-title">{title}</div>
      <div className="bmu-confirm-message">{message}</div>
      <div className="bmu-modal-footer">
        <button className="bmu-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className={danger ? 'bmu-btn-danger' : 'bmu-btn-primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

/** Single user card */
const UserCard = ({ user, onEdit, onToggleActive, onDelete }) => {
  const initials = getInitials(user.fullName);
  const color = pickColor(user.uid);

  return (
    <div className={`bmu-card ${user.active ? '' : 'bmu-card-disabled'}`}>
      <div className="bmu-card-top">
        <div className="bmu-avatar" style={{ background: color }}>{initials}</div>

        <div className="bmu-card-info">
          <div className="bmu-card-name">{user.fullName}</div>
          <div className="bmu-card-username">✉️ {user.loginEmail}</div>
        </div>

        <div className={`bmu-badge ${user.active ? 'bmu-badge-active' : 'bmu-badge-disabled'}`}>
          {user.active ? 'Active' : 'Disabled'}
        </div>
      </div>

      <div className="bmu-card-meta">
        <a
          className="bmu-wa-link"
          href={toWaLink(user.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="bmu-wa-icon">📱</span>
          {user.whatsapp}
        </a>
        {user.createdAt && (
          <div className="bmu-card-date">Added {formatDate(user.createdAt)}</div>
        )}
      </div>

      <div className="bmu-card-actions">
        <button className="bmu-action-btn bmu-action-edit" onClick={() => onEdit(user)}>
          ✏️ Edit
        </button>
        <button
          className={`bmu-action-btn ${user.active ? 'bmu-action-disable' : 'bmu-action-enable'}`}
          onClick={() => onToggleActive(user)}
        >
          {user.active ? '🚫 Disable' : '✅ Enable'}
        </button>
        <button className="bmu-action-btn bmu-action-delete" onClick={() => onDelete(user)}>
          🗑️
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load users:', err);
      setFetchError('Could not load users. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Add user ───────────────────────────────────────────────────────────────
  const handleAddSave = async ({ loginEmail, fullName, whatsapp, password }) => {
    setSaving(true);
    setSaveError('');
    try {
      const secondaryAuth = getSecondaryAuth();
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        toEmail(loginEmail),
        password
      );
      const { uid } = credential.user;

      // Sign secondary user out immediately — we don't need that session
      await secondarySignOut(secondaryAuth);

      // Save profile to Firestore
      await setDoc(doc(db, 'users', uid), {
        uid,
        loginEmail: toEmail(loginEmail),
        fullName: fullName.trim(),
        whatsapp: whatsapp.trim(),
        active: true,
        createdAt: serverTimestamp(),
      });

      setShowAdd(false);
      await fetchUsers();
    } catch (err) {
      console.error('Add user error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setSaveError(`An account with "${toEmail(loginEmail)}" already exists.`);
      } else if (err.code === 'auth/weak-password') {
        setSaveError('Password is too weak. Use at least 6 characters.');
      } else {
        setSaveError('Failed to create user. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Edit user ──────────────────────────────────────────────────────────────
  const handleEditSave = async ({ fullName, whatsapp }) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateDoc(doc(db, 'users', editTarget.uid), {
        fullName: fullName.trim(),
        whatsapp: whatsapp.trim(),
      });
      setEditTarget(null);
      await fetchUsers();
    } catch (err) {
      console.error('Edit user error:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggleConfirm = async () => {
    const u = toggleTarget;
    setToggleTarget(null);
    try {
      await updateDoc(doc(db, 'users', u.uid), { active: !u.active });
      await fetchUsers();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // ── Delete user ────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    const u = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      await fetchUsers();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ── Search filter ──────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.loginEmail?.toLowerCase().includes(q) ||
      u.whatsapp?.includes(q)
    );
  });

  const activeCount = users.filter((u) => u.active).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bmu-screen">

      {/* Header */}
      <div className="bmu-header">
        <div className="bmu-header-left">
          <span className="bmu-header-icon">👥</span>
          <div>
            <div className="bmu-header-title">Users</div>
            <div className="bmu-header-sub">
              {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} · ${activeCount} active`}
            </div>
          </div>
        </div>
        <button className="bmu-add-btn" onClick={() => { setSaveError(''); setShowAdd(true); }}>
          + Add User
        </button>
      </div>

      {/* Search */}
      {!loading && users.length > 0 && (
        <div className="bmu-search-row">
          <span className="bmu-search-icon">🔍</span>
          <input
            className="bmu-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or number…"
          />
          {search && (
            <button className="bmu-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="bmu-body">
        {loading && (
          <div className="bmu-empty">
            <Spinner />
            <div className="bmu-empty-text">Loading users…</div>
          </div>
        )}

        {!loading && fetchError && (
          <div className="bmu-empty">
            <div className="bmu-empty-icon">⚠️</div>
            <div className="bmu-empty-text">{fetchError}</div>
            <button className="bmu-btn-primary bmu-retry-btn" onClick={fetchUsers}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !fetchError && users.length === 0 && (
          <div className="bmu-empty">
            <div className="bmu-empty-icon">👥</div>
            <div className="bmu-empty-title">No Users Yet</div>
            <div className="bmu-empty-text">
              Add users here so they can log in to the Kaon Lo Elizabeth app.
            </div>
            <button className="bmu-btn-primary" onClick={() => { setSaveError(''); setShowAdd(true); }}>
              + Add First User
            </button>
          </div>
        )}

        {!loading && !fetchError && users.length > 0 && filtered.length === 0 && (
          <div className="bmu-empty">
            <div className="bmu-empty-icon">🔍</div>
            <div className="bmu-empty-title">No Match</div>
            <div className="bmu-empty-text">No users match "<strong>{search}</strong>".</div>
          </div>
        )}

        {!loading && !fetchError && filtered.map((user) => (
          <UserCard
            key={user.uid}
            user={user}
            onEdit={(u) => { setSaveError(''); setEditTarget(u); }}
            onToggleActive={(u) => setToggleTarget(u)}
            onDelete={(u) => setDeleteTarget(u)}
          />
        ))}
      </div>

      {/* Note at bottom */}
      {!loading && !fetchError && users.length > 0 && (
        <div className="bmu-footer-note">
          🔒 To reset a password, use the Firebase Console → Authentication.
          Deleting a user here removes their profile but not their login account.
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onSave={handleAddSave}
          saving={saving}
          saveError={saveError}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
          saving={saving}
          saveError={saveError}
        />
      )}

      {toggleTarget && (
        <ConfirmModal
          icon={toggleTarget.active ? '🚫' : '✅'}
          title={toggleTarget.active ? 'Disable User?' : 'Enable User?'}
          message={
            toggleTarget.active
              ? `${toggleTarget.fullName} will be marked as disabled. Note: they can still log in until you also remove their account from Firebase Console.`
              : `${toggleTarget.fullName} will be marked as active again.`
          }
          confirmLabel={toggleTarget.active ? 'Disable' : 'Enable'}
          danger={toggleTarget.active}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          icon="🗑️"
          title="Delete User?"
          message={`This will remove ${deleteTarget.fullName}'s profile from the app. Their Firebase login account will remain — delete it from Firebase Console if needed.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Users;
