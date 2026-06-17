import React from 'react';
import { NavLink } from 'react-router-dom';
import { isSuperAdmin } from '../context/AdminContext';

const ALL_NAV = [
  { to: '/dashboard',     emoji: '📊', label: 'Dashboard',    superOnly: false },
  { to: '/queue',         emoji: '🎫', label: 'Queue Monitor', superOnly: false },
  { to: '/menu',          emoji: '🍽️', label: 'Manage Menu',  superOnly: false },
  { to: '/services',      emoji: '⚙️', label: 'Services',     superOnly: false },
  { to: '/analytics',     emoji: '📈', label: 'Analytics',    superOnly: false },
  { to: '/notifications', emoji: '🔔', label: 'Notifications', superOnly: false },
  { to: '/branches',      emoji: '🏢', label: 'Branches & Roles', superOnly: true },
  { to: '/about',         emoji: '📋', label: 'About',        superOnly: false },
];

export default function Sidebar({ onLogout, adminProfile }) {
  const superAdmin = isSuperAdmin(adminProfile);
  const navItems = ALL_NAV.filter((item) => !item.superOnly || superAdmin);

  const roleBadge  = superAdmin ? 'Super Admin' : 'Branch Admin';
  const branchLabel = !superAdmin && adminProfile?.branchId
    ? adminProfile.branchId.toUpperCase()
    : 'All Branches';

  return (
    <aside style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.brand}>
        <div style={styles.logoWrap}>
          <span style={{ fontSize: 22 }}>🍀</span>
        </div>
        <div>
          <div style={styles.brandName}>Q-Less</div>
          <div style={styles.brandSub}>Admin Panel</div>
        </div>
      </div>

      {/* Role badge */}
      {adminProfile && (
        <div style={styles.roleBox}>
          <div style={styles.roleName}>{adminProfile.name || adminProfile.email}</div>
          <div style={styles.roleRow}>
            <span style={{ ...styles.rolePill, background: superAdmin ? 'rgba(255,255,255,0.25)' : 'rgba(255,200,0,0.35)' }}>
              {superAdmin ? '👑' : '🏪'} {roleBadge}
            </span>
          </div>
          {!superAdmin && (
            <div style={styles.branchLabel}>📍 {branchLabel}</div>
          )}
        </div>
      )}

      {/* Nav links */}
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            <span style={styles.navEmoji}>{item.emoji}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button style={styles.logoutBtn} onClick={onLogout}>
        <span style={{ marginRight: 8 }}>🚪</span>
        Sign Out
      </button>
    </aside>
  );
}

const styles = {
  sidebar:     { width: 220, minHeight: '100vh', background: '#2D6A2E', display: 'flex', flexDirection: 'column', padding: '20px 0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  brand:       { display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 0 },
  logoWrap:    { width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName:   { color: '#FFFFFF', fontWeight: 900, fontSize: 18, letterSpacing: 1 },
  brandSub:    { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },

  roleBox:     { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', marginBottom: 8 },
  roleName:    { color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roleRow:     { display: 'flex', alignItems: 'center', gap: 6 },
  rolePill:    { fontSize: 10, fontWeight: 700, color: '#fff', borderRadius: 20, padding: '3px 8px' },
  branchLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  nav:         { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px', flex: 1 },
  navLink:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' },
  navLinkActive:{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' },
  navEmoji:    { fontSize: 18, width: 24, textAlign: 'center' },
  logoutBtn:   { margin: '8px 10px 0 10px', padding: '10px 0', background: 'none', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
