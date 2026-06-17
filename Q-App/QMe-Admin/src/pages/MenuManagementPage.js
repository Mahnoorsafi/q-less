import React, { useEffect, useState } from 'react';
import {
  subscribeToMenuItems, addMenuItem, updateMenuItem,
  deleteMenuItem, toggleMenuItem, subscribeToBranches,
} from '../services/firebaseService';
import { useAdmin, isSuperAdmin } from '../context/AdminContext';

const G = {
  primary:   '#2D6A2E',
  primaryBg: '#E8F5E9',
  bg:        '#F5F0E8',
  surface:   '#FFFFFF',
  text:      '#1A1A1A',
  muted:     '#6B7280',
  border:    '#E5E7EB',
  error:     '#DC2626',
  errorBg:   '#FEE2E2',
  success:   '#16A34A',
  successBg: '#D1FAE5',
};

const CATEGORIES = ['Burgers', 'Pasta', 'Drinks', 'Desserts', 'Snacks'];
const EMOJIS     = ['🍔', '🍝', '🍵', '☕', '🍋', '🧋', '🎂', '🍫', '🍮', '🥖', '🍟', '🥗', '🍕', '🥪', '🌮'];

const BLANK = { name: '', description: '', price: '', category: 'Burgers', emoji: '🍔', calories: '' };

export default function MenuManagementPage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);
  const [menuItems,      setMenuItems]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filterCat,      setFilterCat]      = useState('All');
  const [showForm,       setShowForm]       = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [form,           setForm]           = useState(BLANK);
  const [saving,         setSaving]         = useState(false);
  const [message,        setMessage]        = useState('');

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
    const unsub = subscribeToMenuItems(selectedBranch, (items) => {
      setMenuItems(items);
      setLoading(false);
    });
    return unsub;
  }, [selectedBranch]);

  function flash(msg) { setMessage(msg); setTimeout(() => setMessage(''), 3000); }

  function openAdd() {
    setEditItem(null);
    setForm(BLANK);
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      name:        item.name,
      description: item.description,
      price:       String(item.price),
      category:    item.category,
      emoji:       item.emoji,
      calories:    String(item.calories ?? ''),
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) {
      flash('⚠️ Name and price are required.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name:        form.name.trim(),
        description: form.description.trim(),
        price:       parseInt(form.price, 10),
        category:    form.category,
        emoji:       form.emoji,
        calories:    form.calories ? parseInt(form.calories, 10) : null,
      };
      if (editItem) {
        await updateMenuItem(selectedBranch, editItem.id, data);
        flash('✅ Item updated successfully!');
      } else {
        await addMenuItem(selectedBranch, data);
        flash('✅ Item added successfully!');
      }
      setShowForm(false);
    } catch {
      flash('❌ Could not save item. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteMenuItem(selectedBranch, item.id);
      flash(`🗑️ "${item.name}" deleted.`);
    } catch {
      flash('❌ Could not delete item.');
    }
  }

  async function handleToggle(item) {
    try {
      await toggleMenuItem(selectedBranch, item.id, !item.isAvailable);
      flash(item.isAvailable ? `"${item.name}" marked unavailable.` : `"${item.name}" is available again.`);
    } catch {
      flash('❌ Could not update availability.');
    }
  }

  const displayed = filterCat === 'All'
    ? menuItems
    : menuItems.filter((m) => m.category === filterCat);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Menu Management</h1>
          <p style={styles.pageSub}>Add, edit, and toggle food items for each branch</p>
        </div>
        <button style={styles.addBtn} onClick={openAdd}>+ Add New Item</button>
      </div>

      {/* Branch selector */}
      <div style={styles.branchRow}>
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBranch(b.id)}
            style={{
              ...styles.branchTab,
              ...(selectedBranch === b.id ? styles.branchTabActive : {}),
            }}
          >
            {b.name.replace('Olive ', '')}
          </button>
        ))}
      </div>

      {/* Flash */}
      {message && <div style={styles.flash}>{message}</div>}

      {/* Category filter */}
      <div style={styles.catRow}>
        {['All', ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            style={{ ...styles.catBtn, ...(filterCat === c ? styles.catBtnActive : {}) }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={styles.countText}>{displayed.length} item{displayed.length !== 1 ? 's' : ''}</p>

      {/* Items grid */}
      {loading ? (
        <p style={{ color: G.muted, textAlign: 'center', padding: 40 }}>Loading menu…</p>
      ) : displayed.length === 0 ? (
        <div style={styles.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <p style={{ fontWeight: 700, color: G.text, marginBottom: 4 }}>No items yet</p>
          <p style={{ color: G.muted, fontSize: 14 }}>Click "+ Add New Item" to get started.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {displayed.map((item) => (
            <div key={item.id} style={{ ...styles.card, ...(item.isAvailable ? {} : styles.cardOff) }}>
              <div style={styles.cardTop}>
                <div style={styles.emojiBox}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemCat}>{item.category}</div>
                </div>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={item.isAvailable}
                    onChange={() => handleToggle(item)}
                    style={{ display: 'none' }}
                  />
                  <div style={{ ...styles.toggleTrack, background: item.isAvailable ? G.primary : G.border }}>
                    <div style={{ ...styles.toggleThumb, transform: item.isAvailable ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </div>
                </label>
              </div>
              <p style={styles.itemDesc}>{item.description}</p>
              <div style={styles.cardBottom}>
                <span style={styles.priceTag}>Rs. {item.price?.toLocaleString()}</span>
                {item.calories && <span style={styles.calTag}>{item.calories} kcal</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button style={styles.editBtn} onClick={() => openEdit(item)}>Edit</button>
                  <button style={styles.delBtn} onClick={() => handleDelete(item)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editItem ? 'Edit Item' : 'Add New Item'}</h2>
              <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Item Name *</label>
                <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Zinger Burger" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Price (Rs.) *</label>
                <input style={styles.input} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="650" />
              </div>
              <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
                <label style={styles.label}>Description</label>
                <textarea style={{ ...styles.input, height: 72, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description…" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Calories (optional)</label>
                <input style={styles.input} type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} placeholder="520" />
              </div>
              <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
                <label style={styles.label}>Emoji Icon</label>
                <div style={styles.emojiPicker}>
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      style={{ ...styles.emojiOption, ...(form.emoji === em ? styles.emojiOptionActive : {}) }}
                      onClick={() => setForm({ ...form, emoji: em })}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page:         { padding: '24px 28px', maxWidth: 1100, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle:    { fontSize: 26, fontWeight: 800, color: G.text, margin: 0 },
  pageSub:      { fontSize: 14, color: G.muted, marginTop: 4 },
  addBtn:       { padding: '10px 22px', background: G.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  branchRow:    { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  branchTab:    { padding: '8px 18px', borderRadius: 20, border: `1.5px solid ${G.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: G.muted },
  branchTabActive: { background: G.primary, borderColor: G.primary, color: '#fff' },

  flash:        { background: G.successBg, color: G.success, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontWeight: 600, fontSize: 14 },

  catRow:       { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  catBtn:       { padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${G.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: G.muted },
  catBtnActive: { background: G.primaryBg, borderColor: G.primary, color: G.primary },
  countText:    { fontSize: 13, color: G.muted, marginBottom: 16 },

  emptyBox:     { textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, border: `1.5px dashed ${G.border}` },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card:         { background: G.surface, borderRadius: 14, padding: 16, border: `1px solid ${G.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardOff:      { opacity: 0.55 },
  cardTop:      { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  emojiBox:     { width: 48, height: 48, borderRadius: 12, background: G.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  itemName:     { fontSize: 15, fontWeight: 700, color: G.text, marginBottom: 2 },
  itemCat:      { fontSize: 12, color: G.muted, fontWeight: 600 },
  toggle:       { cursor: 'pointer', flexShrink: 0 },
  toggleTrack:  { width: 40, height: 22, borderRadius: 11, position: 'relative', transition: 'background 0.2s' },
  toggleThumb:  { position: 'absolute', top: 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  itemDesc:     { fontSize: 13, color: G.muted, marginBottom: 12, lineHeight: 1.5 },
  cardBottom:   { display: 'flex', alignItems: 'center', gap: 8 },
  priceTag:     { fontSize: 15, fontWeight: 800, color: G.primary },
  calTag:       { fontSize: 12, color: G.muted, background: G.border, borderRadius: 6, padding: '2px 8px' },
  editBtn:      { padding: '5px 12px', borderRadius: 8, background: G.primaryBg, color: G.primary, border: `1px solid ${G.primary}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  delBtn:       { padding: '5px 12px', borderRadius: 8, background: G.errorBg, color: G.error, border: `1px solid ${G.error}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: 18, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: 800, color: G.text, margin: 0 },
  closeBtn:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: G.muted, padding: 4 },
  formGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 },
  formGroup:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:        { fontSize: 13, fontWeight: 600, color: G.muted },
  input:        { border: `1.5px solid ${G.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', color: G.text, width: '100%', boxSizing: 'border-box' },
  emojiPicker:  { display: 'flex', flexWrap: 'wrap', gap: 8 },
  emojiOption:  { width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${G.border}`, background: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emojiOptionActive: { border: `2px solid ${G.primary}`, background: G.primaryBg },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn:    { padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${G.border}`, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: G.text },
  saveBtn:      { padding: '10px 22px', borderRadius: 10, background: G.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};