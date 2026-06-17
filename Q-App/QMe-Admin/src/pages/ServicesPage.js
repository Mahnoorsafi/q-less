import React, { useEffect, useState } from 'react';
import {
  subscribeToBranches, subscribeToServices, seedServicesIfEmpty,
  updateBranchService, addBranchService, deleteBranchService,
  broadcastToAll,
} from '../services/firebaseService';
import { useAdmin, isSuperAdmin } from '../context/AdminContext';
import './PageStyles.css';

const GREEN   = '#2D6A2E';
const GREEN_L = '#E8F5E9';

export default function ServicesPage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);
  const [services,       setServices]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [editId,         setEditId]         = useState(null);
  const [form,           setForm]           = useState({ name: '', avgServiceTime: 10, description: '', isAvailable: true });
  const [message,        setMessage]        = useState('');

  // Close service dialog
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeUntil,  setCloseUntil]  = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [closeNotify, setCloseNotify] = useState(true);

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      const visible = lockedBranch ? data.filter((b) => b.id === lockedBranch) : data;
      setBranches(visible);
      if (!selectedBranch && visible.length > 0) setSelectedBranch(visible[0].id);
    });
    return unsub;
  }, [selectedBranch, lockedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    let unsub = () => {};
    seedServicesIfEmpty(selectedBranch).then(() => {
      unsub = subscribeToServices(selectedBranch, (svcs) => {
        setServices(svcs);
        setLoading(false);
      });
    });
    return () => unsub();
  }, [selectedBranch]);

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', avgServiceTime: 10, description: '', isAvailable: true });
    setShowForm(true);
  }

  function openEdit(svc) {
    setEditId(svc.id);
    setForm({ name: svc.name, avgServiceTime: svc.avgServiceTime, description: svc.description, isAvailable: svc.isAvailable });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    try {
      if (editId) {
        await updateBranchService(selectedBranch, editId, form);
        flash('✅ Service updated.');
      } else {
        await addBranchService(selectedBranch, form);
        flash('✅ Service added.');
      }
      setShowForm(false);
    } catch {
      flash('❌ Error saving service.');
    }
  }

  function openCloseDialog(svc) {
    setCloseTarget(svc);
    setCloseUntil('');
    setCloseReason('');
    setCloseNotify(true);
  }

  async function confirmClose() {
    if (!closeTarget || !selectedBranch) return;
    const branchName = branches.find((b) => b.id === selectedBranch)?.name ?? selectedBranch;
    const until  = closeUntil.trim();
    const reason = closeReason.trim();

    await updateBranchService(selectedBranch, closeTarget.id, {
      isAvailable:      false,
      unavailableUntil: until  || null,
      closedReason:     reason || null,
    });

    if (closeNotify) {
      const untilStr  = until  ? ` until ${until}`  : '';
      const reasonStr = reason ? ` — ${reason}` : '';
      await broadcastToAll(
        `⚠️ ${closeTarget.name} Unavailable — ${branchName}`,
        `${closeTarget.name} at ${branchName} is temporarily unavailable${untilStr}${reasonStr}. We apologize for the inconvenience.`,
      ).catch(() => {});
    }

    flash(`✅ ${closeTarget.name} closed${closeNotify ? ' · customers notified' : ''}.`);
    setCloseTarget(null);
  }

  async function handleEnable(svc) {
    const branchName = branches.find((b) => b.id === selectedBranch)?.name ?? selectedBranch;
    await updateBranchService(selectedBranch, svc.id, {
      isAvailable:      true,
      unavailableUntil: null,
      closedReason:     null,
    });
    await broadcastToAll(
      `✅ ${svc.name} is Back — ${branchName}`,
      `Good news! ${svc.name} at ${branchName} is now available again. Come visit us!`,
    ).catch(() => {});
    flash(`✅ ${svc.name} reopened · customers notified.`);
  }

  async function handleDelete(svcId) {
    if (!window.confirm('Delete this service?')) return;
    await deleteBranchService(selectedBranch, svcId);
    flash('Service deleted.');
  }

  return (
    <div className="page services-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1>⚙️ Service Management</h1>
          <p style={{ color: '#6B7280', marginTop: 4, marginBottom: 0 }}>Configure available services per branch</p>
        </div>
        <button style={btnStyle(GREEN)} onClick={openAdd}>+ Add Service</button>
      </div>

      {/* Branch tabs — hidden when locked to a single branch */}
      {!lockedBranch && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              style={{
                padding: '8px 20px', borderRadius: 24, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: selectedBranch === b.id ? GREEN : '#F3F4F6',
                color:      selectedBranch === b.id ? '#fff' : '#374151',
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div style={{ background: GREEN_L, color: GREEN, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div style={formCard}>
          <h3 style={{ marginTop: 0, marginBottom: 18, color: GREEN }}>{editId ? '✏️ Edit Service' : '➕ New Service'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={fieldCol}>
              <label style={labelStyle}>Service Name</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dine In" />
            </div>
            <div style={fieldCol}>
              <label style={labelStyle}>Avg Service Time (min)</label>
              <input style={inputStyle} type="number" min={1} value={form.avgServiceTime} onChange={(e) => setForm({ ...form, avgServiceTime: parseInt(e.target.value) || 10 })} />
            </div>
          </div>
          <div style={{ ...fieldCol, marginTop: 12 }}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <input type="checkbox" id="avail" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} style={{ width: 18, height: 18, accentColor: GREEN }} />
            <label htmlFor="avail" style={{ ...labelStyle, margin: 0 }}>Available to customers</label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={btnStyle(GREEN)} onClick={handleSave}>Save Service</button>
            <button style={btnStyle('#9CA3AF')} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Close service dialog (modal overlay) */}
      {closeTarget && (
        <div style={overlayStyle}>
          <div style={dialogCard}>
            <h3 style={{ marginTop: 0, color: '#dc2626' }}>🚫 Close {closeTarget.name}</h3>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 18px' }}>
              Customers will see this service as unavailable. Optionally set a reopening time and reason.
            </p>
            <div style={fieldCol}>
              <label style={labelStyle}>Unavailable Until (optional)</label>
              <input
                style={inputStyle}
                value={closeUntil}
                onChange={(e) => setCloseUntil(e.target.value)}
                placeholder="e.g. 6:00 PM  or  Tomorrow morning"
              />
            </div>
            <div style={{ ...fieldCol, marginTop: 12 }}>
              <label style={labelStyle}>Reason (optional)</label>
              <input
                style={inputStyle}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="e.g. Maintenance, High demand, Staff shortage"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <input
                type="checkbox"
                id="notify"
                checked={closeNotify}
                onChange={(e) => setCloseNotify(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#dc2626' }}
              />
              <label htmlFor="notify" style={{ ...labelStyle, margin: 0, color: '#374151' }}>
                Notify all app customers
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={btnStyle('#dc2626')} onClick={confirmClose}>Confirm Close</button>
              <button style={btnStyle('#9CA3AF')} onClick={() => setCloseTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7280', textAlign: 'center', padding: 24 }}>Loading services…</p>
      ) : services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          <p style={{ fontSize: 32 }}>⚙️</p>
          <p>No services configured for this branch yet.</p>
          <button style={btnStyle(GREEN)} onClick={openAdd}>Add First Service</button>
        </div>
      ) : (
        <div className="grid">
          {services.map((svc) => (
            <div key={svc.id} style={svcCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, color: '#111827' }}>{svc.name}</h2>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: svc.isAvailable ? GREEN_L : '#fee2e2',
                  color:      svc.isAvailable ? GREEN : '#dc2626',
                }}>
                  {svc.isAvailable ? 'Active' : 'Closed'}
                </span>
              </div>
              {svc.description && <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 6px' }}>{svc.description}</p>}
              {!svc.isAvailable && (svc.closedReason || svc.unavailableUntil) && (
                <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 6px', fontStyle: 'italic' }}>
                  {svc.closedReason ?? ''}
                  {svc.unavailableUntil ? ` · Until ${svc.unavailableUntil}` : ''}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 16px' }}>⏱ {svc.avgServiceTime} min/person</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={smallBtn(GREEN)} onClick={() => openEdit(svc)}>Edit</button>
                {svc.isAvailable ? (
                  <button style={smallBtn('#dc2626')} onClick={() => openCloseDialog(svc)}>Close</button>
                ) : (
                  <button style={smallBtn('#16a34a')} onClick={() => handleEnable(svc)}>Reopen</button>
                )}
                <button style={smallBtn('#6B7280')} onClick={() => handleDelete(svc.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btnStyle(bg) {
  return { padding: '9px 20px', borderRadius: 10, background: bg, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
}
function smallBtn(bg) {
  return { padding: '5px 12px', borderRadius: 8, background: bg, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 };
const dialogCard   = { background: '#fff', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' };
const formCard     = { background: '#F9FAFB', borderRadius: 14, padding: 24, marginBottom: 24, border: '1px solid #E5E7EB' };
const fieldCol     = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle   = { fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em' };
const inputStyle   = { border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none' };
const svcCard      = { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' };
