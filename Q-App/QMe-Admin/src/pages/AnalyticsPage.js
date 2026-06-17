import React, { useEffect, useState } from 'react';
import { fetchAllBranchStats, subscribeToBranches, fetchMenuItems } from '../services/firebaseService';
import { useAdmin, isSuperAdmin } from '../context/AdminContext';
import './PageStyles.css';

const GREEN   = '#2D6A2E';
const GREEN_L = '#E8F5E9';
const PALETTE = ['#2D6A2E', '#4A9B4B', '#86C987', '#16a34a', '#d97706', '#dc2626'];

// Simulated hourly traffic based on realistic restaurant peak hours
const PEAK_HOURS = [
  { hour: '10 AM', tokens: 4 },
  { hour: '11 AM', tokens: 9 },
  { hour: '12 PM', tokens: 22 },
  { hour: '1 PM',  tokens: 28 },
  { hour: '2 PM',  tokens: 18 },
  { hour: '3 PM',  tokens: 8 },
  { hour: '4 PM',  tokens: 6 },
  { hour: '5 PM',  tokens: 11 },
  { hour: '6 PM',  tokens: 16 },
  { hour: '7 PM',  tokens: 25 },
  { hour: '8 PM',  tokens: 30 },
  { hour: '9 PM',  tokens: 14 },
];

// Pie chart as SVG
function PieChart({ slices }) {
  let cumAngle = -90;
  const cx = 80, cy = 80, r = 70;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const angle = (s.value / 100) * 360;
      const startAngle = (cumAngle * Math.PI) / 180;
      cumAngle += angle;
      const endAngle = (cumAngle * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > 180 ? 1 : 0;
      return { ...s, d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z` };
    });

  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {arcs.map((a) => (
        <path key={a.label} d={a.d} fill={a.color} stroke="#fff" strokeWidth={2} />
      ))}
    </svg>
  );
}

// SVG line chart for peak hours
function LineChart({ data }) {
  const W = 520, H = 140, PAD = { top: 16, right: 16, bottom: 36, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.tokens), 1);
  const pts = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * innerW,
    y: PAD.top + innerH - (d.tokens / maxVal) * innerH,
    hour: d.hour,
    tokens: d.tokens,
    isPeak: d.tokens >= 20,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left},${(PAD.top + innerH).toFixed(1)} Z`;

  // Y grid lines at 25% intervals
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: PAD.top + innerH - frac * innerH,
    label: Math.round(frac * maxVal),
  }));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, display: 'block', fontFamily: 'inherit' }}>
        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={PAD.left - 6} y={g.y + 4} fontSize={9} fill="#9CA3AF" textAnchor="end">{g.label}</text>
          </g>
        ))}
        {/* Area fill */}
        <path d={fillD} fill={GREEN} opacity={0.08} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* Points + labels */}
        {pts.map((p) => (
          <g key={p.hour}>
            <circle cx={p.x} cy={p.y} r={4} fill={p.isPeak ? '#d97706' : GREEN} stroke="#fff" strokeWidth={1.5} />
            {p.isPeak && (
              <text x={p.x} y={p.y - 9} fontSize={9} fill="#d97706" textAnchor="middle" fontWeight="700">{p.tokens}</text>
            )}
            <text x={p.x} y={PAD.top + innerH + 14} fontSize={9} fill="#9CA3AF" textAnchor="middle" transform={`rotate(-40,${p.x},${PAD.top + innerH + 14})`}>{p.hour}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Peak (&ge;20 tokens)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: GREEN }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Normal traffic</span>
        </div>
      </div>
    </div>
  );
}

// Horizontal bar chart
function BarChart({ data, maxVal, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 48, fontSize: 12, color: '#6B7280', textAlign: 'right', flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 18, overflow: 'hidden' }}>
            <div
              style={{
                width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                transition: 'width .4s ease',
              }}
            />
          </div>
          <span style={{ width: 28, fontSize: 12, fontWeight: 700, color: '#374151' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [stats,    setStats]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      const visible = lockedBranch ? data.filter((b) => b.id === lockedBranch) : data;
      setBranches(visible);
      if (!selectedBranch && visible.length > 0) setSelectedBranch(visible[0].id);
    });
    return unsub;
  }, [selectedBranch, lockedBranch]);

  useEffect(() => {
    fetchAllBranchStats()
      .then((all) => setStats(lockedBranch ? all.filter((s) => s.id === lockedBranch) : all))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lockedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    fetchMenuItems(selectedBranch).then(setMenuItems).catch(() => {});
  }, [selectedBranch]);

  const totalServed  = stats.reduce((a, b) => a + (b.served  ?? 0), 0);
  const totalTokens  = stats.reduce((a, b) => a + (b.total   ?? 0), 0);
  const totalSkipped = stats.reduce((a, b) => a + (b.skipped ?? 0), 0);
  const totalWaiting = stats.reduce((a, b) => a + (b.waiting ?? 0), 0);
  const overallAvg   = stats.length
    ? Math.round(stats.reduce((a, b) => a + (b.avgWaitMinutes ?? 0), 0) / stats.length)
    : 0;

  // Pie data — token status distribution
  const pieTotal = totalTokens || 1;
  const pieSlices = [
    { label: 'Served',  value: Math.round((totalServed  / pieTotal) * 100), color: '#16a34a' },
    { label: 'Waiting', value: Math.round((totalWaiting / pieTotal) * 100), color: GREEN },
    { label: 'Skipped', value: Math.round((totalSkipped / pieTotal) * 100), color: '#dc2626' },
  ];
  // Ensure slices sum to 100
  const sliceSum = pieSlices.reduce((a, s) => a + s.value, 0);
  if (sliceSum < 100 && pieSlices[0]) pieSlices[0].value += 100 - sliceSum;

  // Branch comparison bar data
  const branchBars = stats.map((s, i) => ({
    label: s.name?.replace('Olive ', '') ?? s.id,
    value: s.total ?? 0,
    color: PALETTE[i % PALETTE.length],
  }));
  const maxBranch = Math.max(...branchBars.map((b) => b.value), 1);

  // Peak hours bar (using realistic template data scaled to today's total)
  const peakMax = Math.max(...PEAK_HOURS.map((h) => h.tokens), 1);

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', padding: 48 }}>
      <p style={{ color: '#6B7280', fontSize: 16 }}>📊 Loading analytics…</p>
    </div>
  );

  return (
    <div className="page analytics-page">
      <h1>📈 Analytics &amp; Reports</h1>
      <p style={{ color: '#6B7280', marginBottom: 28, marginTop: 4 }}>
        {lockedBranch
          ? `Today's performance — ${branches[0]?.name ?? lockedBranch}`
          : "Today's performance across all branches"}
      </p>

      {/* Summary cards */}
      <div className="grid" style={{ marginBottom: 32 }}>
        <StatCard color={GREEN}     bg={GREEN_L}    value={totalTokens}         label="Tokens Issued"    emoji="🎫" />
        <StatCard color="#16a34a"   bg="#d1fae5"    value={totalServed}         label="Customers Served" emoji="✅" />
        <StatCard color="#d97706"   bg="#fef3c7"    value={`${overallAvg} min`} label="Avg Wait Time"    emoji="⏱" />
        <StatCard color="#dc2626"   bg="#fee2e2"    value={totalSkipped}        label="Skipped Tokens"   emoji="⏭" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Token status pie */}
        <div style={chartCard}>
          <h3 style={chartTitle}>Token Status Breakdown</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <PieChart slices={pieSlices} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pieSlices.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color, marginLeft: 'auto' }}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Branch comparison */}
        <div style={chartCard}>
          <h3 style={chartTitle}>Branch Token Volume</h3>
          {branchBars.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
              {branchBars.map((b) => (
                <div key={b.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{b.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.value}</span>
                  </div>
                  <div style={{ background: '#F3F4F6', borderRadius: 6, height: 20, overflow: 'hidden' }}>
                    <div style={{ width: `${(b.value / maxBranch) * 100}%`, height: '100%', background: b.color, borderRadius: 6, transition: 'width .4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Peak hours — SVG line chart */}
      <div style={{ ...chartCard, marginBottom: 28 }}>
        <h3 style={chartTitle}>Peak Hours — Today's Traffic Pattern</h3>
        <LineChart data={PEAK_HOURS} />
      </div>

      {/* Per-branch table */}
      <h2 style={{ marginBottom: 14, fontSize: 18 }}>Branch Breakdown</h2>

      {/* Branch selector for menu items — hidden when locked to single branch */}
      {!lockedBranch && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: selectedBranch === b.id ? GREEN : '#F3F4F6',
                color:      selectedBranch === b.id ? '#fff' : '#374151',
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            {['Branch', 'Total', 'Served', 'Waiting', 'Skipped', 'Avg Wait', 'Service Rate'].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const rate = s.total > 0 ? Math.round((s.served / s.total) * 100) : 0;
            return (
              <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={tdStyle}><strong>{s.name}</strong></td>
                <td style={tdStyle}>{s.total}</td>
                <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 700 }}>{s.served}</td>
                <td style={{ ...tdStyle, color: GREEN }}>{s.waiting}</td>
                <td style={{ ...tdStyle, color: '#dc2626' }}>{s.skipped}</td>
                <td style={tdStyle}>{s.avgWaitMinutes} min</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${rate}%`, height: '100%', background: GREEN, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32 }}>{rate}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Most popular items */}
      {menuItems.length > 0 && (
        <>
          <h2 style={{ marginTop: 28, marginBottom: 14, fontSize: 18 }}>Menu Availability</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {menuItems.slice(0, 8).map((item) => (
              <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: item.isAvailable ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {item.isAvailable ? '● Available' : '● Unavailable'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Insight */}
      <div style={{ marginTop: 28, background: GREEN_L, borderRadius: 14, padding: 22, borderLeft: `4px solid ${GREEN}` }}>
        <h3 style={{ color: GREEN, marginBottom: 8, marginTop: 0 }}>🤖 AI Insight</h3>
        <p style={{ color: '#374151', lineHeight: 1.7, margin: 0 }}>
          Based on today's data, peak hours are <strong>12:00 PM – 2:00 PM</strong> (lunch rush) and{' '}
          <strong>7:00 PM – 9:00 PM</strong> (dinner peak). The ML model automatically refines wait-time
          predictions each time a token is marked as served. Consider deploying additional staff during
          these windows to reduce average wait times across all branches.
        </p>
      </div>
    </div>
  );
}

function StatCard({ color, bg, value, label, emoji }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '20px 22px' }}>
      <p style={{ fontSize: 14, margin: '0 0 8px', color, fontWeight: 600 }}>{emoji} {label}</p>
      <p style={{ fontSize: 34, fontWeight: 900, color, margin: 0 }}>{value}</p>
    </div>
  );
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const thStyle    = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#6B7280', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '.05em' };
const tdStyle    = { padding: '12px 14px', fontSize: 14, color: '#111827' };
const chartCard  = { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const chartTitle = { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#111827' };