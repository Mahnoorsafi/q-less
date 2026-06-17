import React, { useEffect, useState } from 'react';
import {
  subscribeToBranches, subscribeToAdmins,
  addBranch, createBranchAdmin, updateAdminRole, removeAdminRole,
} from '../services/firebaseService';
import './PageStyles.css';

const G = {
  primary: '#2D6A2E', primaryBg: '#E8F5E9',
  surface: '#FFFFFF', text: '#1A1A1A', muted: '#6B7280',
  border: '#E5E7EB', error: '#DC2626', errorBg: '#FEE2E2',
};

const BLANK_BRANCH = { id: '', name: '', address: '', lat: '', lng: '', phone: '', hours: '11:00 AM – 11:00 PM', emoji: '🍃', tokenPrefix: '', staffCount: 3, avgServiceTime: 10 };
const BLANK_NEW_ADMIN = { email: '', password: '', name: '', role: 'branch_admin', branchId: '' };
const BLANK_EDIT      = { role: 'branch_admin', branchId: '' };

export default function BranchRolePage() {
  const [branches, setBranches] = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [message,  setMessage]  = useState('');

  // Branch modal
  const [showBranch, setShowBranch] = useState(false);
  const [branchForm, setBranchForm] = useState(BLANK_BRANCH);
  const [savingB,    setSavingB]    = useState(false);

  // Create Admin modal (new account with email+password)
  const [showCreate,  setShowCreate]  = useState(false);
  const [createForm,  setCreateForm]  = useState(BLANK_NEW_ADMIN);
  const [showPw,      setShowPw]      = useState(false);
  const [savingNew,   setSavingNew]   = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null); // { email, password } for display

  // Edit Role modal (existing admin — only role/branch changes)
  const [showEdit,  setShowEdit]  = useState(false);
  const [editUid,   setEditUid]   = useState(null);
  const [editName,  setEditName]  = useState('');
  const [editForm,  setEditForm]  = useState(BLANK_EDIT);
  const [savingE,   setSavingE]   = useState(false);

  useEffect(() => {
    const u1 = subscribeToBranches(setBranches);
    const u2 = subscribeToAdmins(setAdmins);
    return () => { u1(); u2(); };
  }, []);

  function flash(msg) { setMessage(msg); setTimeout(() => setMessage(''), 6000); }

  // ── Branch actions ────────────────────────────────────────────────────────

  async function handleSaveBranch() {
    if (!branchForm.id.trim() || !branchForm.name.trim()) {
      flash('⚠️ Branch ID and Name are required.');
      return;
    }
    if (branches.find((b) => b.id === branchForm.id.trim())) {
      flash('⚠️ A branch with this ID already exists.');
      return;
    }
    setSavingB(true);
    try {
      await addBranch({
        id:             branchForm.id.trim().toLowerCase().replace(/\s+/g, '_'),
        name:           branchForm.name.trim(),
        address:        branchForm.address.trim(),
        lat:            parseFloat(branchForm.lat) || 33.7,
        lng:            parseFloat(branchForm.lng) || 73.0,
        phone:          branchForm.phone.trim(),
        hours:          branchForm.hours.trim(),
        emoji:          branchForm.emoji || '🍃',
        tokenPrefix:    branchForm.tokenPrefix.trim().toUpperCase() || branchForm.id.trim().toUpperCase().slice(0, 3),
        staffCount:     parseInt(branchForm.staffCount) || 3,
        avgServiceTime: parseInt(branchForm.avgServiceTime) || 10,
      });
      flash(`✅ Branch "${branchForm.name}" added!`);
      setShowBranch(false);
      setBranchForm(BLANK_BRANCH);
    } catch (e) {
      flash(`❌ ${e.message}`);
    } finally {
      setSavingB(false);
    }
  }

  // ── Create new admin account ──────────────────────────────────────────────

  async function handleCreateAdmin() {
    const { email, password, name, role, branchId } = createForm;
    if (!email.trim() || !password.trim() || !name.trim()) {
      flash('⚠️ Name, Email, and Password are all required.');
      return;
    }
    if (password.length < 6) {
      flash('⚠️ Password must be at least 6 characters.');
      return;
    }
    if (role === 'branch_admin' && !branchId) {
      flash('⚠️ Select a branch for the Branch Admin.');
      return;
    }
    setSavingNew(true);
    try {
      await createBranchAdmin({
        email: email.trim(),
        password,
        name:     name.trim(),
        role,
        branchId: branchId || null,
      });
      setCreatedCreds({ email: email.trim(), password });
      setShowCreate(false);
      setCreateForm(BLANK_NEW_ADMIN);
      setShowPw(false);
    } catch (e) {
      flash(`❌ ${e.message}`);
    } finally {
      setSavingNew(false);
    }
  }

  // ── Edit existing admin role ──────────────────────────────────────────────

  function openEditAdmin(admin) {
    setEditUid(admin.uid);
    setEditName(admin.name);
    setEditForm({ role: admin.role, branchId: admin.branchId ?? '' });
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (editForm.role === 'branch_admin' && !editForm.branchId) {
      flash('⚠️ Select a branch for the Branch Admin.');
      return;
    }
    setSavingE(true);
    try {
      await updateAdminRole(editUid, { role: editForm.role, branchId: editForm.branchId || null });
      flash('✅ Role updated!');
      setShowEdit(false);
    } catch (e) {
      flash(`❌ ${e.message}`);
    } finally {
      setSavingE(false);
    }
  }

  async function handleRemoveAdmin(uid, name) {
    if (!window.confirm(`Remove admin role from "${name}"? They can still log in but won't have branch restrictions.`)) return;
    try {
      await removeAdminRole(uid);
      flash(`🗑️ Role removed from ${name}.`);
    } catch (e) {
      flash(`❌ ${e.message}`);
    }
  }

  const ROLE_COLORS = {
    super_admin:  { bg: '#E8F5E9', color: '#2D6A2E' },
    branch_admin: { bg: '#FFF3E0', color: '#d97706' },
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: G.text, marginBottom: 4 }}>🏢 Branches & Roles</h1>
      <p style={{ color: G.muted, marginBottom: 28 }}>Manage restaurant branches and admin access control</p>

      {/* Flash message */}
      {message && (
        <div style={{ background: message.startsWith('✅') ? G.primaryBg : G.errorBg, color: message.startsWith('✅') ? G.primary : G.error, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Created credentials banner */}
      {createdCreds && (
        <div style={{ background: '#FFF3E0', border: '2px solid #F59E0B', borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#92400E', marginBottom: 8, fontSize: 15 }}>✅ Branch Admin Account Created</div>
          <p style={{ margin: '0 0 8px', color: '#78350F', fontSize: 13 }}>Share these credentials securely with the branch admin. They can log in at the admin panel with these details.</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px', fontFamily: 'monospace', fontSize: 13, border: '1px solid #FCD34D' }}>
              📧 <strong>{createdCreds.email}</strong>
            </div>
            <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px', fontFamily: 'monospace', fontSize: 13, border: '1px solid #FCD34D' }}>
              🔑 <strong>{createdCreds.password}</strong>
            </div>
          </div>
          <button onClick={() => setCreatedCreds(null)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#92400E', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Branches section ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: G.text, margin: 0 }}>📍 Branches ({branches.length})</h2>
        <button style={addBtn} onClick={() => { setBranchForm(BLANK_BRANCH); setShowBranch(true); }}>+ Add Branch</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 36 }}>
        {branches.map((b) => (
          <div key={b.id} style={{ background: G.surface, borderRadius: 14, padding: 16, border: `1px solid ${G.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{b.emoji ?? '🍃'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: G.text }}>{b.name}</div>
                <div style={{ fontSize: 11, color: G.muted }}>{b.id}</div>
              </div>
              <div style={{ marginLeft: 'auto', background: b.isOpen ? '#D1FAE5' : '#F3F4F6', color: b.isOpen ? '#16a34a' : G.muted, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                {b.isOpen ? '● Open' : '● Closed'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>📍 {b.address}</div>
            {b.phone && <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>📞 {b.phone}</div>}
            <div style={{ fontSize: 12, color: G.muted }}>⏰ {b.hours}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: G.primary, fontWeight: 700 }}>
              <span>👥 {b.staffCount} staff</span>
              <span>🎫 prefix: {b.tokenPrefix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Admin roles section ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: G.text, margin: 0 }}>👤 Admin Users ({admins.length})</h2>
        <button style={addBtn} onClick={() => { setCreateForm(BLANK_NEW_ADMIN); setShowPw(false); setShowCreate(true); }}>
          + Create Branch Admin
        </button>
      </div>

      <div style={{ background: G.primaryBg, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: G.primary, fontWeight: 600, lineHeight: 1.6 }}>
        💡 Use <strong>"Create Branch Admin"</strong> to set up a new login account for a branch manager. You choose their email, password, and which branch they can access. They log in at the admin panel and will only see their assigned branch.
      </div>

      <div style={{ background: G.surface, borderRadius: 14, overflow: 'hidden', border: `1px solid ${G.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Name', 'Email', 'Role', 'Branch', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: G.muted, borderBottom: `1px solid ${G.border}`, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: G.muted }}>No admin roles configured yet. Click "Create Branch Admin" to add one.</td></tr>
            ) : (
              admins.map((a) => {
                const rc         = ROLE_COLORS[a.role] ?? ROLE_COLORS.branch_admin;
                const branchName = a.branchId ? (branches.find((b) => b.id === a.branchId)?.name ?? a.branchId) : '—';
                return (
                  <tr key={a.uid} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={td}><strong>{a.name}</strong></td>
                    <td style={{ ...td, color: G.muted }}>{a.email}</td>
                    <td style={td}>
                      <span style={{ background: rc.bg, color: rc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {a.role === 'super_admin' ? '👑 Super Admin' : '🏪 Branch Admin'}
                      </span>
                    </td>
                    <td style={{ ...td, color: G.muted, fontSize: 13 }}>{branchName}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEditAdmin(a)} style={editBtnStyle}>Edit Role</button>
                        <button onClick={() => handleRemoveAdmin(a.uid, a.name)} style={delBtnStyle}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Branch Modal ── */}
      {showBranch && (
        <div style={overlay} onClick={() => setShowBranch(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>➕ Add New Branch</h2>
              <button onClick={() => setShowBranch(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Branch ID *',  key: 'id',          ph: 'e.g. blue_area',       hint: 'lowercase, no spaces' },
                { label: 'Name *',       key: 'name',        ph: 'e.g. Olive Blue Area',  hint: '' },
                { label: 'Address',      key: 'address',     ph: 'Street, City',          hint: '', span: true },
                { label: 'Phone',        key: 'phone',       ph: '+92 51 000 0000',       hint: '' },
                { label: 'Hours',        key: 'hours',       ph: '11:00 AM – 11:00 PM',  hint: '' },
                { label: 'Token Prefix', key: 'tokenPrefix', ph: 'BLU',                  hint: '3 letters' },
                { label: 'Latitude',     key: 'lat',         ph: '33.72',                hint: '' },
                { label: 'Longitude',    key: 'lng',         ph: '73.04',                hint: '' },
                { label: 'Emoji Icon',   key: 'emoji',       ph: '🍃',                   hint: '' },
                { label: 'Staff Count',  key: 'staffCount',  ph: '3',                    hint: '' },
              ].map(({ label, key, ph, hint, span }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: span ? '1/-1' : undefined }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.muted }}>
                    {label}{hint && <span style={{ color: '#9CA3AF', marginLeft: 4 }}>({hint})</span>}
                  </label>
                  <input
                    style={inp}
                    value={branchForm[key]}
                    onChange={(e) => setBranchForm({ ...branchForm, [key]: e.target.value })}
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowBranch(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleSaveBranch} disabled={savingB} style={{ ...saveBtnStyle, opacity: savingB ? 0.7 : 1 }}>
                {savingB ? 'Adding…' : 'Add Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Branch Admin Modal ── */}
      {showCreate && (
        <div style={overlay} onClick={() => setShowCreate(false)}>
          <div style={{ ...modal, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>👤 Create Branch Admin</h2>
              <button onClick={() => setShowCreate(false)} style={closeBtn}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: G.muted, marginBottom: 20, marginTop: 4 }}>
              This creates a new Firebase login account. Share the email + password with the branch manager so they can log in to the admin panel and access only their assigned branch.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full Name *">
                <input style={inp} placeholder="e.g. Sara Ahmed" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </Field>
              <Field label="Email Address *">
                <input style={inp} type="email" placeholder="branch@olive.com" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </Field>
              <Field label="Password *">
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inp, paddingRight: 48 }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: G.muted }}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>
              <Field label="Role">
                <select style={inp} value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="branch_admin">🏪 Branch Admin (single branch)</option>
                  <option value="super_admin">👑 Super Admin (all branches)</option>
                </select>
              </Field>
              {createForm.role === 'branch_admin' && (
                <Field label="Assigned Branch *">
                  <select style={inp} value={createForm.branchId} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}>
                    <option value="">— Select branch —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowCreate(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleCreateAdmin} disabled={savingNew} style={{ ...saveBtnStyle, opacity: savingNew ? 0.7 : 1 }}>
                {savingNew ? 'Creating…' : '✓ Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Admin Role Modal ── */}
      {showEdit && (
        <div style={overlay} onClick={() => setShowEdit(false)}>
          <div style={{ ...modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>✏️ Edit Role — {editName}</h2>
              <button onClick={() => setShowEdit(false)} style={closeBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Role">
                <select style={inp} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="super_admin">👑 Super Admin (all branches)</option>
                  <option value="branch_admin">🏪 Branch Admin (single branch)</option>
                </select>
              </Field>
              {editForm.role === 'branch_admin' && (
                <Field label="Assigned Branch">
                  <select style={inp} value={editForm.branchId} onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}>
                    <option value="">— Select branch —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEdit(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingE} style={{ ...saveBtnStyle, opacity: savingE ? 0.7 : 1 }}>
                {savingE ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
      {children}
    </div>
  );
}

const td           = { padding: '12px 16px', fontSize: 13, color: '#111827' };
const overlay      = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal        = { background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const closeBtn     = { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: G.muted, padding: 4 };
const inp          = { border: `1.5px solid ${G.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', color: G.text, width: '100%', boxSizing: 'border-box' };
const addBtn       = { padding: '9px 20px', background: G.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const editBtnStyle = { padding: '5px 12px', borderRadius: 8, background: G.primaryBg, color: G.primary, border: `1px solid ${G.primary}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const delBtnStyle  = { padding: '5px 12px', borderRadius: 8, background: '#FEE2E2', color: G.error, border: `1px solid ${G.error}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const cancelBtnStyle = { padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: G.text };
const saveBtnStyle   = { padding: '10px 22px', borderRadius: 10, background: G.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
