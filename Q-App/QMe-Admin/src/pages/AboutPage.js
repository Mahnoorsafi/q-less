import React, { useEffect, useState } from 'react';
import { subscribeToBranches, fetchAllBranchStats, forceSeedDatabase } from '../services/firebaseService';
import './PageStyles.css';

const GREEN   = '#2D6A2E';
const GREEN_L = '#E8F5E9';

export default function AboutPage() {
  const [branches, setBranches] = useState([]);
  const [stats,    setStats]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [seeding,  setSeeding]  = useState(false);
  const [seedMsg,  setSeedMsg]  = useState('');

  useEffect(() => {
    const unsub = subscribeToBranches(setBranches);
    return unsub;
  }, []);

  async function handleSeedDB() {
    if (!window.confirm('This will DELETE all existing branch data and re-seed 3 Olive branches (Gulberg, F-10, DHA) with full menu items and services.\n\nContinue?')) return;
    setSeeding(true);
    setSeedMsg('');
    try {
      await forceSeedDatabase();
      setSeedMsg('✅ Database seeded successfully! 3 branches, 16 menu items, 3 services created.');
    } catch (err) {
      setSeedMsg(`❌ Seed failed: ${err?.message ?? 'Unknown error. Check Firestore rules and network.'}`);
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    fetchAllBranchStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalTokens = stats.reduce((a, b) => a + (b.total  ?? 0), 0);
  const totalServed = stats.reduce((a, b) => a + (b.served ?? 0), 0);
  const overallRate = totalTokens > 0 ? Math.round((totalServed / totalTokens) * 100) : 0;

  return (
    <div className="page">
      <h1>📋 About Q-Less</h1>
      <p style={{ color: '#6B7280', marginBottom: 28, marginTop: 4 }}>System information and branch overview</p>

      {/* Brand card */}
      <div style={{ background: GREEN, borderRadius: 16, padding: 28, marginBottom: 28, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🍀</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 28, letterSpacing: 2 }}>Q-LESS</h2>
            <p style={{ margin: '2px 0 0', opacity: 0.8, fontSize: 14 }}>Queue Smart, Live More.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['v1.0.0', 'Olive Restaurant Chain', '3 Branches', 'ISB · RWP'].map((tag) => (
            <span key={tag} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Overall stats */}
      <h2 style={{ marginBottom: 14, fontSize: 18 }}>Overall Branch Performance (Today)</h2>
      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading stats…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Tokens',     value: totalTokens,          color: GREEN,     bg: GREEN_L    },
            { label: 'Customers Served', value: totalServed,          color: '#16a34a', bg: '#d1fae5'  },
            { label: 'Service Rate',     value: `${overallRate}%`,    color: '#d97706', bg: '#fef3c7'  },
            { label: 'Active Branches',  value: branches.length,      color: '#7c3aed', bg: '#f5f3ff'  },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontSize: 11, margin: '0 0 6px', color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-branch summary */}
      <h2 style={{ marginBottom: 14, fontSize: 18 }}>Branch Details</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginBottom: 28 }}>
        {branches.map((b, i) => {
          const s = stats.find((x) => x.id === b.id) ?? {};
          const rate = s.total > 0 ? Math.round(((s.served ?? 0) / s.total) * 100) : 0;
          return (
            <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${['#2D6A2E','#4A9B4B','#86C987'][i % 3]}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{b.emoji ?? '🍃'}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#111827' }}>{b.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>📍 {b.address}</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: b.isOpen ? '#d1fae5' : '#fee2e2', color: b.isOpen ? '#16a34a' : '#dc2626' }}>
                  {b.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Queue',       val: b.queueLength ?? 0 },
                  { label: 'Staff',       val: b.staffCount  ?? 0 },
                  { label: 'Avg Service', val: `${b.avgServiceTime ?? 0} min` },
                  { label: 'Served Today',val: s.served ?? 0 },
                ].map((m) => (
                  <div key={m.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>{m.label}</p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>{m.val}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${rate}%`, height: '100%', background: GREEN, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{rate}% served</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6B7280' }}>📞 {b.phone ?? 'N/A'} · ⏰ {b.hours ?? 'N/A'}</p>
            </div>
          );
        })}
      </div>

      {/* Tech stack */}
      <h2 style={{ marginBottom: 14, fontSize: 18 }}>Technology Stack</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'React Native',    emoji: '📱' },
          { label: 'Expo SDK 56',     emoji: '🚀' },
          { label: 'Firebase',        emoji: '🔥' },
          { label: 'React (Web)',     emoji: '🌐' },
          { label: 'Flask + Python',  emoji: '🐍' },
          { label: 'Linear Regression ML', emoji: '🤖' },
          { label: 'Firestore',       emoji: '🗄️' },
        ].map((t) => (
          <div key={t.label} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <span>{t.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Team */}
      <h2 style={{ marginBottom: 14, fontSize: 18 }}>Development Team</h2>
      <div style={{ background: GREEN_L, borderRadius: 14, padding: 22, borderLeft: `4px solid ${GREEN}` }}>
        <p style={{ margin: '0 0 16px', fontWeight: 700, color: GREEN, fontSize: 14 }}>IIU · BSSE-F22 · Final Year Project</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          {['Hania Ramzan', 'Insiya Satti'].map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>{name[0]}</div>
              <span style={{ fontWeight: 700, color: '#111827' }}>{name}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, color: '#374151', fontSize: 13 }}>
          <strong>Supervised by:</strong> Ms. Maryam Amin<br />
          Department of Software Engineering, International Islamic University Islamabad
        </p>
      </div>

      {/* Dev Tools */}
      <h2 style={{ marginTop: 32, marginBottom: 14, fontSize: 18 }}>🛠️ Developer Tools</h2>
      <div style={{ background: '#FFF8E1', border: '1.5px solid #F59E0B', borderRadius: 14, padding: 22, marginBottom: 28 }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E', fontSize: 14 }}>⚠️ Database Management</p>
        <p style={{ margin: '0 0 16px', color: '#78350F', fontSize: 13 }}>
          Use <strong>"Seed / Reset Database"</strong> if branches, menu items, or services are missing.
          This deletes all branch data and re-creates the 3 Olive branches (Gulberg · F-10 · DHA) with 16 menu items and 3 services each.
        </p>
        <p style={{ margin: '0 0 16px', color: '#78350F', fontSize: 12 }}>
          <strong>If this button fails</strong>, your Firestore security rules are blocking writes. Go to
          <strong> Firebase Console → Firestore → Rules</strong> and set:
          <br /><code style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
            allow read, write: if true;
          </code>
          &nbsp;for testing, then deploy the proper <code>firestore.rules</code> file via Firebase CLI.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleSeedDB}
            disabled={seeding}
            style={{
              padding: '10px 22px', background: seeding ? '#9CA3AF' : '#D97706',
              color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700,
              fontSize: 14, cursor: seeding ? 'not-allowed' : 'pointer',
            }}
          >
            {seeding ? '⏳ Seeding database…' : '🌱 Seed / Reset Database'}
          </button>
        </div>
        {seedMsg && (
          <p style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: seedMsg.startsWith('✅') ? '#D1FAE5' : '#FEE2E2',
            color:      seedMsg.startsWith('✅') ? '#065F46' : '#991B1B',
          }}>
            {seedMsg}
          </p>
        )}
      </div>
    </div>
  );
}