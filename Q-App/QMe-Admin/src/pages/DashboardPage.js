import React, { useEffect, useState } from 'react';
import { subscribeToBranches, fetchTodayStats, subscribeToQueue } from '../services/firebaseService';
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
  warning:   '#F59E0B',
  warningBg: '#FEF3C7',
  info:      '#3B82F6',
  infoBg:    '#DBEAFE',
};

export default function DashboardPage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);
  const [branchInfo,     setBranchInfo]     = useState(null);
  const [stats,          setStats]          = useState(null);
  const [queue,          setQueue]          = useState([]);
  const [loading,        setLoading]        = useState(true);

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      const visible = lockedBranch ? data.filter((b) => b.id === lockedBranch) : data;
      setBranches(visible);
      if (!selectedBranch && visible.length > 0) {
        setSelectedBranch(visible[0].id);
        setBranchInfo(visible[0]);
      }
    });
    return unsub;
  }, [selectedBranch, lockedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    fetchTodayStats(selectedBranch)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));

    const queueUnsub = subscribeToQueue(selectedBranch, setQueue);
    return queueUnsub;
  }, [selectedBranch]);

  function handleBranchChange(id) {
    setSelectedBranch(id);
    setBranchInfo(branches.find((b) => b.id === id) ?? null);
  }

  const calledToken  = queue.find((t) => t.status === 'called');
  const waitingCount = queue.filter((t) => t.status === 'waiting').length;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>
            {branchInfo ? branchInfo.name : 'Dashboard'}
          </h1>
          <p style={styles.pageSub}>📅 {today}</p>
        </div>
        {!lockedBranch && (
          <div style={styles.branchRow}>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => handleBranchChange(b.id)}
                style={{ ...styles.branchTab, ...(selectedBranch === b.id ? styles.branchTabActive : {}) }}
              >
                {b.name.replace('Olive ', '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: G.muted, padding: 20 }}>Loading stats…</p>
      ) : (
        <>
          {/* Stats cards */}
          <div style={styles.statsGrid}>
            <StatCard label="Total Tokens" value={stats?.total ?? 0}   bg={G.infoBg}    color={G.info}    emoji="🎫" />
            <StatCard label="Active"        value={stats?.waiting ?? 0} bg={G.warningBg} color={G.warning}  emoji="⏳" />
            <StatCard label="Served"        value={stats?.served ?? 0}  bg={G.successBg} color={G.success}  emoji="✅" />
            <StatCard label="Skipped"       value={stats?.skipped ?? 0} bg={G.errorBg}   color={G.error}    emoji="⏭️" />
          </div>

          {/* Live queue highlight */}
          <div style={styles.liveRow}>
            {/* Next token panel */}
            <div style={styles.liveCard}>
              <div style={styles.liveHeader}>
                <span style={styles.liveTitle}>🔴 Live Queue</span>
                <span style={styles.liveBadge}>{waitingCount} waiting</span>
              </div>
              {calledToken ? (
                <div style={styles.calledBox}>
                  <p style={styles.calledLabel}>Currently Serving</p>
                  <p style={styles.calledCode}>{calledToken.tokenCode}</p>
                  <p style={styles.calledName}>{calledToken.userName}</p>
                  <p style={styles.calledService}>{calledToken.serviceType} · {calledToken.serviceName}</p>
                </div>
              ) : (
                <div style={styles.noCalledBox}>
                  <span style={{ fontSize: 36 }}>😴</span>
                  <p style={{ color: G.muted, marginTop: 8, fontSize: 14 }}>No token currently being served</p>
                </div>
              )}
            </div>

            {/* Branch status */}
            <div style={styles.liveCard}>
              <p style={styles.liveTitle}>📍 Branch Status</p>
              {branchInfo && (
                <div style={styles.branchStatusGrid}>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Status</span>
                    <span style={{ ...styles.bsValue, color: branchInfo.isOpen ? G.success : G.error }}>
                      {branchInfo.isOpen ? '● Open' : '● Closed'}
                    </span>
                  </div>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Staff</span>
                    <span style={styles.bsValue}>{branchInfo.staffCount} active</span>
                  </div>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Queue</span>
                    <span style={styles.bsValue}>{branchInfo.queueLength} in line</span>
                  </div>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Avg Time</span>
                    <span style={styles.bsValue}>{branchInfo.avgServiceTime} min</span>
                  </div>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Phone</span>
                    <span style={styles.bsValue}>{branchInfo.phone ?? '—'}</span>
                  </div>
                  <div style={styles.bsItem}>
                    <span style={styles.bsLabel}>Hours</span>
                    <span style={styles.bsValue}>{branchInfo.hours ?? '—'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div style={styles.quickGrid}>
            {[
              { emoji: '🎫', label: 'Manage Queue',  href: '/queue' },
              { emoji: '🍽️', label: 'Manage Menu',   href: '/menu' },
              { emoji: '📈', label: 'Analytics',      href: '/analytics' },
              { emoji: '🔔', label: 'Notifications',  href: '/notifications' },
            ].map((q) => (
              <a key={q.label} href={q.href} style={styles.quickCard}>
                <span style={styles.quickEmoji}>{q.emoji}</span>
                <span style={styles.quickLabel}>{q.label}</span>
                <span style={styles.quickArrow}>›</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, bg, color, emoji }) {
  return (
    <div style={{ ...styles.statCard, background: bg }}>
      <div style={styles.statTop}>
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <span style={{ ...styles.statValue, color }}>{value}</span>
      </div>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

const styles = {
  page:         { padding: '24px 28px', maxWidth: 1100, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  pageHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  pageTitle:    { fontSize: 26, fontWeight: 800, color: G.text, margin: 0 },
  pageSub:      { fontSize: 14, color: G.muted, marginTop: 4 },
  branchRow:    { display: 'flex', gap: 8, flexWrap: 'wrap' },
  branchTab:    { padding: '8px 18px', borderRadius: 20, border: `1.5px solid ${G.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: G.muted },
  branchTabActive: { background: G.primary, borderColor: G.primary, color: '#fff' },

  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard:     { borderRadius: 14, padding: 20 },
  statTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statValue:    { fontSize: 36, fontWeight: 900 },
  statLabel:    { fontSize: 14, color: G.muted, fontWeight: 600, margin: 0 },

  liveRow:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  liveCard:     { background: G.surface, borderRadius: 14, padding: 20, border: `1px solid ${G.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  liveHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveTitle:    { fontSize: 15, fontWeight: 700, color: G.text },
  liveBadge:    { background: G.warningBg, color: G.warning, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 },
  calledBox:    { textAlign: 'center', padding: '16px 0' },
  calledLabel:  { fontSize: 12, color: G.muted, fontWeight: 600, marginBottom: 4 },
  calledCode:   { fontSize: 48, fontWeight: 900, color: G.warning, margin: '0 0 4px 0' },
  calledName:   { fontSize: 16, fontWeight: 700, color: G.text, margin: '0 0 4px 0' },
  calledService:{ fontSize: 13, color: G.muted },
  noCalledBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' },

  branchStatusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  bsItem:       { display: 'flex', flexDirection: 'column', gap: 2 },
  bsLabel:      { fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bsValue:      { fontSize: 14, fontWeight: 700, color: G.text },

  quickGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  quickCard:    { display: 'flex', alignItems: 'center', gap: 10, background: G.surface, borderRadius: 12, padding: '14px 16px', border: `1px solid ${G.border}`, textDecoration: 'none', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  quickEmoji:   { fontSize: 24 },
  quickLabel:   { flex: 1, fontSize: 14, fontWeight: 600, color: G.text },
  quickArrow:   { fontSize: 20, color: G.muted, fontWeight: 300 },
};