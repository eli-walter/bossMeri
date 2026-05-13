// src/components/Users.jsx
//
// Change from original: AddUserModal now includes a `status` field (Mr / Ms / Mrs)
// which is saved to the `users` Firestore document. This allows Notifications.jsx
// to address customers with the correct title, e.g. "Mr. John" or "Ms. Ana".

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as secondarySignOut,
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import './Users.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toLoginEmail = (username) => `${username.trim().toLowerCase()}@kaon.app`;

const getInitials = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

const AVATAR_COLORS = [
  '#4A0080','#6B0099','#8B0000','#B8860B',
  '#005f73','#0a9396','#ae2012','#ca6702',
];
const pickColor = (uid) =>
  AVATAR_COLORS[(uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1)) % AVATAR_COLORS.length];

const toWaLink = (n) => `https://wa.me/${n.replace(/[^\d]/g, '')}`;

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getSecondaryAuth = () => {
  const NAME = 'kaon-user-auth';
  const existing = getApps().find((a) => a.name === NAME);
  const app = existing || initializeApp(firebaseConfig, NAME);
  return getAuth(app);
};

// ─── Validators ───────────────────────────────────────────────────────────────
const validateAdd = ({ username, fullName, whatsapp, password, confirmPassword }) => {
  const e = {};
  if (!username.trim())
    e.username = 'Username is required.';
  else if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim()))
    e.username = 'Use 3–30 letters, numbers, dots, underscores, or hyphens.';
  if (!fullName.trim())
    e.fullName = 'Full name is required.';
  if (!whatsapp.trim())
    e.whatsapp = 'WhatsApp number is required.';
  else if (!/^\+?[\d\s\-()\d]{7,20}$/.test(whatsapp.trim()))
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
  else if (!/^\+?[\d\s\-()\d]{7,20}$/.test(whatsapp.trim()))
    e.whatsapp = 'Enter a valid phone number (e.g. +677 12345).';
  return e;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const FieldError = ({ msg }) => msg ? <div className="bmu-field-error">{msg}</div> : null;
const Spinner    = () => <div className="bmu-spinner" />;

const Modal = ({ onClose, children }) => (
  <div className="bmu-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="bmu-modal">{children}</div>
  </div>
);

/** Status selector: Mr / Ms / Mrs */
const StatusSelect = ({ value, onChange }) => (
  <div className="bmu-status-row">
    {['Mr', 'Ms', 'Mrs'].map((s) => (
      <button
        key={s}
        type="button"
        className={`bmu-status-btn ${value === s ? 'active' : ''}`}
        onClick={() => onChange(s)}
      >
        {s}
      </button>
    ))}
  </div>
);

/** Add User Modal */
const AddUserModal = ({ onClose, onSave, saving, saveError }) => {
  const EMPTY = { status: 'Mr', username: '', fullName: '', whatsapp: '', password: '', confirmPassword: '' };
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
          <div className="bmu-modal-sub">Creates a login for the Kaon Lo Elizabeth app</div>
        </div>
      </div>

      <div className="bmu-form-scroll">
        {/* Status */}
        <div className="bmu-field">
          <label className="bmu-label">Status <span className="bmu-required">*</span></label>
          <StatusSelect value={form.status} onChange={(s) => setForm((f) => ({ ...f, status: s }))} />
        </div>

        {/* Username */}
        <div className="bmu-field">
          <label className="bmu-label">Username <span className="bmu-required">*</span></label>
          <input
            className={`bmu-input ${errors.username ? 'error' : ''}`}
            value={form.username}
            onChange={set('username')}
            placeholder="e.g. ana_napo"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
          {form.username.trim().length > 0 && (
            <div className="bmu-field-hint">
              Login email: {toLoginEmail(form.username)}
            </div>
          )}
          <FieldError msg={errors.username} />
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
            <button type="button" className="bmu-pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? '🙈' : '👁️'}
            </button>
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
        <button className="bmu-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
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
    status:    user.status   || 'Mr',
    fullName:  user.fullName || '',
    whatsapp:  user.whatsapp || '',
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
        <div className="bmu-avatar bmu-avatar-lg" style={{ background: pickColor(user.uid) }}>
          {getInitials(user.fullName)}
        </div>
        <div>
          <div className="bmu-modal-title">Edit User</div>
          <div className="bmu-modal-sub">@{user.username || user.loginEmail}</div>
        </div>
      </div>

      <div className="bmu-form-scroll">
        {/* Status */}
        <div className="bmu-field">
          <label className="bmu-label">Status</label>
          <StatusSelect value={form.status} onChange={(s) => setForm((f) => ({ ...f, status: s }))} />
        </div>
        <div className="bmu-field">
          <label className="bmu-label">Full Name <span className="bmu-required">*</span></label>
          <input className={`bmu-input ${errors.fullName ? 'error' : ''}`}
            value={form.fullName} onChange={set('fullName')} />
          <FieldError msg={errors.fullName} />
        </div>
        <div className="bmu-field">
          <label className="bmu-label">WhatsApp Number <span className="bmu-required">*</span></label>
          <input className={`bmu-input ${errors.whatsapp ? 'error' : ''}`}
            value={form.whatsapp} onChange={set('whatsapp')} type="tel" />
          <FieldError msg={errors.whatsapp} />
        </div>
        <div className="bmu-info-note">
          🔒 Username and password can only be changed via the Firebase Console.
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

/** Confirm modal */
const ConfirmModal = ({ icon, title, message, confirmLabel, danger, onConfirm, onCancel }) => (
  <div className="bmu-overlay">
    <div className="bmu-modal bmu-modal-confirm">
      <div className="bmu-confirm-icon">{icon}</div>
      <div className="bmu-confirm-title">{title}</div>
      <div className="bmu-confirm-message">{message}</div>
      <div className="bmu-modal-footer">
        <button className="bmu-btn-ghost" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'bmu-btn-danger' : 'bmu-btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

/** User profile modal */
const UserProfileModal = ({ user, onClose, onEdit, onToggleActive, onDelete }) => {
  const color = pickColor(user.uid);
  return (
    <Modal onClose={onClose}>
      <div className="bmu-modal-header bmu-profile-header">
        <div className="bmu-avatar bmu-avatar-lg" style={{ background: color }}>
          {getInitials(user.fullName)}
        </div>
        <div className="bmu-profile-header-info">
          <div className="bmu-modal-title">
            {user.status ? `${user.status}. ` : ''}{user.fullName}
          </div>
          <div className="bmu-modal-sub">@{user.username || user.loginEmail?.replace('@kaon.app','')}</div>
          <span className={`bmu-badge ${user.active ? 'bmu-badge-active' : 'bmu-badge-disabled'}`}>
            {user.active ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="bmu-form-scroll bmu-profile-body">
        <div className="bmu-profile-row">
          <span className="bmu-profile-label">📱 WhatsApp</span>
          <a className="bmu-wa-link" href={toWaLink(user.whatsapp)}
            target="_blank" rel="noopener noreferrer">
            {user.whatsapp}
          </a>
        </div>
        <div className="bmu-profile-row">
          <span className="bmu-profile-label">🔑 Login</span>
          <span className="bmu-profile-value">{user.loginEmail || `${user.username}@kaon.app`}</span>
        </div>
        <div className="bmu-profile-row">
          <span className="bmu-profile-label">📅 Added</span>
          <span className="bmu-profile-value">{formatDate(user.createdAt)}</span>
        </div>
      </div>

      <div className="bmu-profile-actions">
        <button className="bmu-action-btn bmu-action-edit bmu-profile-action-btn"
          onClick={() => { onEdit(user); onClose(); }}>
          ✏️ Edit
        </button>
        <button
          className={`bmu-action-btn bmu-profile-action-btn ${user.active ? 'bmu-action-disable' : 'bmu-action-enable'}`}
          onClick={() => { onToggleActive(user); onClose(); }}>
          {user.active ? '🚫 Disable' : '✅ Enable'}
        </button>
        <button className="bmu-action-btn bmu-action-delete bmu-profile-action-btn"
          onClick={() => { onDelete(user); onClose(); }}>
          🗑️ Delete
        </button>
      </div>

      <div className="bmu-modal-footer">
        <button className="bmu-btn-ghost" style={{flex:'none', width:'100%'}} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

/** Simple name-row in list */
const UserListItem = ({ user, onClick }) => (
  <div
    className={`bmu-list-item ${!user.active ? 'bmu-list-item-disabled' : ''}`}
    onClick={() => onClick(user)}
  >
    <div className="bmu-avatar bmu-avatar-sm" style={{ background: pickColor(user.uid) }}>
      {getInitials(user.fullName)}
    </div>
    <div className="bmu-list-name">
      {user.status ? `${user.status}. ` : ''}{user.fullName}
    </div>
    <div className={`bmu-badge ${user.active ? 'bmu-badge-active' : 'bmu-badge-disabled'}`}>
      {user.active ? 'Active' : 'Off'}
    </div>
    <span className="bmu-list-chevron">›</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Users = () => {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch]         = useState('');

  const [showAdd, setShowAdd]             = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [editTarget, setEditTarget]       = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [toggleTarget, setToggleTarget]   = useState(null);

  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true); setFetchError('');
    try {
      const q    = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load users:', err);
      setFetchError('Could not load users. Check your connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Add user ──────────────────────────────────────────────────────────────
  const handleAddSave = async ({ status, username, fullName, whatsapp, password }) => {
    setSaving(true); setSaveError('');
    const loginEmail = toLoginEmail(username);
    try {
      const secondaryAuth = getSecondaryAuth();
      const credential    = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, password);
      const { uid }       = credential.user;
      await secondarySignOut(secondaryAuth);

      await setDoc(doc(db, 'users', uid), {
        uid,
        status:     status || 'Mr',       // Mr / Ms / Mrs
        username:   username.trim().toLowerCase(),
        loginEmail,
        fullName:   fullName.trim(),
        whatsapp:   whatsapp.trim(),
        active:     true,
        createdAt:  serverTimestamp(),
      });

      setShowAdd(false);
      await fetchUsers();
    } catch (err) {
      console.error('Add user error:', err);
      if (err.code === 'auth/email-already-in-use')
        setSaveError(`Username "${username.trim().toLowerCase()}" is already taken.`);
      else if (err.code === 'auth/weak-password')
        setSaveError('Password is too weak. Use at least 6 characters.');
      else
        setSaveError('Failed to create user. Please try again.');
    } finally { setSaving(false); }
  };

  const handleEditSave = async ({ status, fullName, whatsapp }) => {
    setSaving(true); setSaveError('');
    try {
      await updateDoc(doc(db, 'users', editTarget.uid), {
        status:   status || 'Mr',
        fullName: fullName.trim(),
        whatsapp: whatsapp.trim(),
      });
      setEditTarget(null);
      await fetchUsers();
    } catch (err) {
      console.error('Edit user error:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally { setSaving(false); }
  };

  const handleToggleConfirm = async () => {
    const u = toggleTarget; setToggleTarget(null);
    try {
      await updateDoc(doc(db, 'users', u.uid), { active: !u.active });
      await fetchUsers();
    } catch (err) { console.error('Toggle error:', err); }
  };

  const handleDeleteConfirm = async () => {
    const u = deleteTarget; setDeleteTarget(null);
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      await fetchUsers();
    } catch (err) { console.error('Delete error:', err); }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.loginEmail?.toLowerCase().includes(q) ||
      u.whatsapp?.includes(q)
    );
  });

  const activeCount = users.filter((u) => u.active).length;

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
          <input className="bmu-search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username…" />
          {search && <button className="bmu-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
      )}

      {/* Body */}
      <div className="bmu-body">
        {loading && (
          <div className="bmu-empty"><Spinner /><div className="bmu-empty-text">Loading users…</div></div>
        )}
        {!loading && fetchError && (
          <div className="bmu-empty">
            <div className="bmu-empty-icon">⚠️</div>
            <div className="bmu-empty-text">{fetchError}</div>
            <button className="bmu-btn-primary bmu-retry-btn" onClick={fetchUsers}>Try Again</button>
          </div>
        )}
        {!loading && !fetchError && users.length === 0 && (
          <div className="bmu-empty">
            <div className="bmu-empty-icon">👥</div>
            <div className="bmu-empty-title">No Users Yet</div>
            <div className="bmu-empty-text">
              Add users here so they can log in to the Kaon Lo Elizabeth app with their username and password.
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
        {!loading && !fetchError && filtered.length > 0 && (
          <div className="bmu-list-container">
            {filtered.map((u) => (
              <UserListItem key={u.uid} user={u} onClick={setProfileTarget} />
            ))}
          </div>
        )}
      </div>

      {!loading && !fetchError && users.length > 0 && (
        <div className="bmu-footer-note">
          🔒 Tap a name to view profile. Password resets must be done via the Firebase Console.
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)}
          onSave={handleAddSave} saving={saving} saveError={saveError} />
      )}

      {profileTarget && (
        <UserProfileModal
          user={profileTarget}
          onClose={() => setProfileTarget(null)}
          onEdit={(u)  => { setSaveError(''); setEditTarget(u); }}
          onToggleActive={(u) => setToggleTarget(u)}
          onDelete={(u) => setDeleteTarget(u)}
        />
      )}

      {editTarget && (
        <EditUserModal user={editTarget} onClose={() => setEditTarget(null)}
          onSave={handleEditSave} saving={saving} saveError={saveError} />
      )}

      {toggleTarget && (
        <ConfirmModal
          icon={toggleTarget.active ? '🚫' : '✅'}
          title={toggleTarget.active ? 'Disable User?' : 'Enable User?'}
          message={
            toggleTarget.active
              ? `${toggleTarget.fullName} will be marked as disabled.`
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
          icon="🗑️" title="Delete User?"
          message={`This will remove ${deleteTarget.fullName}'s profile. Their Firebase login will remain — delete it from Firebase Console if needed.`}
          confirmLabel="Delete" danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Users;
