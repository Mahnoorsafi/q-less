import React, { useEffect, useState } from 'react';
import {
  subscribeToBranches, sendNotification, broadcastToBranch, subscribeToQueue, broadcastToAll,
} from '../services/firebaseService';
import { useAdmin, isSuperAdmin } from '../context/AdminContext';
import './PageStyles.css';

const GREEN   = '#2D6A2E';
const GREEN_L = '#E8F5E9';

export default function NotificationsPage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);
  const [queue,          setQueue]          = useState([]);
  const [mode,           setMode]           = useState('broadcast');
  const [selectedUser,   setSelectedUser]   = useState('');
  const [title,          setTitle]          = useState('');
  const [body,           setBody]           = useState('');
  const [sending,        setSending]        = useState(false);
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
    const unsub = subscribeToQueue(selectedBranch, setQueue);
    return unsub;
  }, [selectedBranch]);

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }

  const uniqueUsers = [
    ...new Map(queue.map((t) => [t.userId, { uid: t.userId, name: t.userName }])).values(),
  ];

  async function handleSend() {
    if (!title.trim() || !body.trim()) { flash('Please fill in title and message.'); return; }
    setSending(true);
    try {
      if (mode === 'all') {
        await broadcastToAll(title, body);
        flash('✅ Broadcast sent to all registered app users.');
      } else if (mode === 'broadcast') {
        await broadcastToBranch(selectedBranch, title, body);
        flash(`✅ Broadcast sent to ${uniqueUsers.length} customer(s) at this branch.`);
      } else {
        if (!selectedUser) { flash('Select a customer first.'); setSending(false); return; }
        await sendNotification(selectedUser, { title, body });
        flash('✅ Notification sent!');
      }
      setTitle('');
      setBody('');
    } catch {
      flash('Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  const templates = [
    { label: '⚠️ Delay',          title: 'Service Delay',      body: 'We are experiencing higher than usual wait times. Thank you for your patience.' },
    { label: '🔒 Closing',        title: 'Branch Closing Soon', body: 'This branch will close in 30 minutes. Please plan accordingly.' },
    { label: '🎉 Almost Ready',   title: 'Almost Your Turn!',   body: 'You are next in the queue. Please be ready at the counter.' },
    { label: '📢 Promo',          title: 'Special Offer Today!', body: 'Enjoy 20% off all menu items today at this branch. Show your token at billing.' },
  ];

  return (
    <div className="page notifications-page">
      <h1>🔔 Send Notifications</h1>
      <p style={{ color: '#6B7280', marginBottom: 24, marginTop: 4 }}>Broadcast to a branch or message individual customers</p>

      {/* Branch tabs */}
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

      {message && (
        <div style={{ background: GREEN_L, color: GREEN, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { val: 'all',        label: '🌐 All Users' },
          { val: 'broadcast',  label: `📢 Branch (${uniqueUsers.length})` },
          { val: 'individual', label: '👤 Individual' },
        ].map((m) => (
          <button
            key={m.val}
            onClick={() => setMode(m.val)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: mode === m.val ? GREEN : 'transparent',
              color:      mode === m.val ? '#fff' : '#6B7280',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'individual' && (
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Select Customer</label>
          <select style={inputStyle} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            <option value="">— choose customer —</option>
            {uniqueUsers.map((u) => (
              <option key={u.uid} value={u.uid}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Quick templates */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Quick Templates</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {templates.map((t) => (
            <button
              key={t.label}
              onClick={() => { setTitle(t.title); setBody(t.body); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid #E5E7EB`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Notification Title</label>
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Almost Your Turn!"
          />
        </div>
        <div>
          <label style={labelStyle}>Message Body</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
          />
        </div>
        <button
          style={{
            padding: '14px', borderRadius: 12, background: sending ? '#9CA3AF' : GREEN,
            color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: sending ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? 'Sending…' : '📤 Send Notification'}
        </button>
      </div>

      {/* Preview */}
      {(title || body) && (
        <div style={{ marginTop: 28, border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 10, textTransform: 'uppercase' }}>📱 Preview</p>
          <div style={{ background: GREEN_L, borderRadius: 12, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 28 }}>🍀</span>
            <div>
              <p style={{ fontWeight: 800, color: '#111827', margin: '0 0 4px', fontSize: 15 }}>{title || '(No title)'}</p>
              <p style={{ color: '#374151', margin: 0, fontSize: 13, lineHeight: 1.5 }}>{body || '(No message)'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 };
const inputStyle = { border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };