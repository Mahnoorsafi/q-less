import React, { useEffect, useState } from 'react';
import {
  subscribeToQueue, subscribeToBranches, fetchBranchServices,
  callNextToken, skipToken, serveToken, assignToken, delayToken,
  updateStaffCount, toggleBranchOpen, updateBranchCapacity,
} from '../services/firebaseService';
import { useAdmin, isSuperAdmin } from '../context/AdminContext';
import './PageStyles.css';

const GREEN   = '#2D6A2E';
const GREEN_L = '#E8F5E9';

export default function QueuePage() {
  const adminProfile = useAdmin();
  const superAdmin   = isSuperAdmin(adminProfile);
  const lockedBranch = superAdmin ? null : adminProfile?.branchId ?? null;

  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch);
  const [branchInfo,     setBranchInfo]     = useState(null);
  const [queue,          setQueue]          = useState([]);
  const [services,       setServices]       = useState([]);
  const [actionLoading,  setActionLoading]  = useState(null);
  const [message,        setMessage]        = useState('');
  const [autoNext,       setAutoNext]       = useState(true);
  const [serviceFilter,  setServiceFilter]  = useState('All');

  // Assign modal
  const [showAssign,   setShowAssign]   = useState(false);
  const [assignName,   setAssignName]   = useState('');
  const [assignService,setAssignService]= useState('');
  const [assignLoading,setAssignLoading]= useState(false);

  // Delay modal
  const [showDelay,   setShowDelay]   = useState(false);
  const [delayTokenId,setDelayTokenId]= useState(null);
  const [delayMinutes,setDelayMinutes]= useState('5');
  const [delayLoading,setDelayLoading]= useState(false);

  // Takeaway order expansion
  const [expandedToken, setExpandedToken] = useState(null);

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      const visible = lockedBranch ? data.filter((b) => b.id === lockedBranch) : data;
      setBranches(visible);
      if (!selectedBranch && visible.length > 0) {
        setSelectedBranch(visible[0].id);
        setBranchInfo(visible[0]);
      } else if (selectedBranch) {
        setBranchInfo(visible.find((b) => b.id === selectedBranch) ?? null);
      }
    });
    return unsub;
  }, [selectedBranch, lockedBranch]);

  useEffect(() => {
    if (!selectedBranch) return;
    const unsub = subscribeToQueue(selectedBranch, setQueue);
    fetchBranchServices(selectedBranch).then(setServices).catch(() => {});
    return unsub;
  }, [selectedBranch]);

  function flash(msg, isError = false) {
    setMessage({ text: msg, error: isError });
    setTimeout(() => setMessage(''), 4000);
  }

  function selectBranch(id) {
    setSelectedBranch(id);
    setBranchInfo(branches.find((b) => b.id === id) ?? null);
  }

  // ── Queue actions ────────────────────────────────────────────────────────────

  async function handleCallNext() {
    if (!selectedBranch) return;
    setActionLoading('next');
    try {
      const token = await callNextToken(selectedBranch);
      flash(`📢 Called ${token.tokenCode} — ${token.userName}`);
    } catch {
      flash('⚠️ No waiting tokens in this branch.', true);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleServe(tokenId) {
    setActionLoading(tokenId);
    try {
      await serveToken(tokenId, selectedBranch);
      flash('✅ Served! Queue positions updated. Customers notified.');
      if (autoNext) {
        setTimeout(async () => {
          try { await callNextToken(selectedBranch); } catch {}
        }, 800);
      }
    } catch (e) {
      flash(`Could not serve: ${e.message}`, true);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSkip(tokenId) {
    setActionLoading(tokenId);
    try {
      await skipToken(tokenId, selectedBranch);
      flash('⏭️ Skipped. Queue positions updated. Customers notified.');
      if (autoNext) {
        setTimeout(async () => {
          try { await callNextToken(selectedBranch); } catch {}
        }, 800);
      }
    } catch (e) {
      flash(`Could not skip: ${e.message}`, true);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStaff(delta) {
    if (!selectedBranch) return;
    try {
      await updateStaffCount(selectedBranch, delta);
    } catch {}
  }

  async function handleToggleOpen() {
    if (!branchInfo) return;
    await toggleBranchOpen(selectedBranch, !branchInfo.isOpen);
  }

  async function handleToggleBusy() {
    if (!branchInfo) return;
    try {
      await updateBranchCapacity(selectedBranch, { isBusy: !branchInfo.isBusy });
      flash(branchInfo.isBusy ? '✅ Dine-in restored — restaurant accepting customers.' : '⚠️ Branch marked as FULL — dine-in shows waitlist.');
    } catch (e) { flash(`Error: ${e.message}`, true); }
  }

  async function handleToggleReservations() {
    if (!branchInfo) return;
    const current = branchInfo.reservationsOpen !== false; // default true
    try {
      await updateBranchCapacity(selectedBranch, { reservationsOpen: !current });
      flash(current ? '🔒 Reservations closed.' : '📋 Reservations re-opened.');
    } catch (e) { flash(`Error: ${e.message}`, true); }
  }

  async function handleOccupancy(delta) {
    if (!branchInfo) return;
    const cap     = branchInfo.tableCapacity    ?? 0;
    const current = branchInfo.currentOccupancy ?? 0;
    const next    = Math.max(0, Math.min(cap || 999, current + delta));
    try { await updateBranchCapacity(selectedBranch, { currentOccupancy: next }); } catch {}
  }

  async function handleAssignSubmit() {
    if (!assignName.trim() || !assignService) {
      flash('⚠️ Enter customer name and select a service.', true);
      return;
    }
    setAssignLoading(true);
    try {
      const svc = services.find((s) => s.id === assignService);
      const token = await assignToken(selectedBranch, assignName.trim(), svc?.name ?? assignService, svc?.name ?? 'Dine In');
      flash(`✅ Walk-in token ${token.tokenCode} assigned to ${assignName.trim()}`);
      setShowAssign(false); setAssignName(''); setAssignService('');
    } catch (e) {
      flash(`Error: ${e.message}`, true);
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleDelaySubmit() {
    const mins = parseInt(delayMinutes, 10);
    if (!mins || mins < 1) { flash('⚠️ Enter valid minutes.', true); return; }
    setDelayLoading(true);
    try {
      await delayToken(selectedBranch, delayTokenId, mins);
      flash(`⏳ ${mins}-min delay applied. All waiting customers notified.`);
      setShowDelay(false); setDelayTokenId(null); setDelayMinutes('5');
    } catch (e) {
      flash(`Error: ${e.message}`, true);
    } finally {
      setDelayLoading(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const SERVICE_TYPES = ['All', 'Dine In', 'Takeaway', 'Reservation'];

  const filteredQueue = serviceFilter === 'All'
    ? queue
    : queue.filter((t) => t.serviceName === serviceFilter || t.serviceType === serviceFilter);

  const calledToken   = filteredQueue.find((t) => t.status === 'called');
  const waitingTokens = filteredQueue.filter((t) => t.status === 'waiting');
  const servedCount   = queue.filter((t) => t.status === 'served').length;
  const skippedCount  = queue.filter((t) => t.status === 'skipped').length;
  const waitingCount  = waitingTokens.length;

  // AI delay suggestion based on queue load
  const staffCount   = branchInfo?.staffCount ?? 3;
  const avgSvcTime   = branchInfo?.avgServiceTime ?? 8;
  const suggestedDelay = Math.min(20, Math.max(2, Math.round((avgSvcTime * waitingCount) / staffCount)));

  // Next 6 waiting tokens for visual queue
  const upcomingTokens = waitingTokens.slice(0, 6);

  return (
    <div className="page queue-page">
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>🎫 Queue Monitor</h1>
          <p style={{ color: '#6B7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            {branchInfo ? `${branchInfo.name} — ${branchInfo.isOpen ? '🟢 Open' : '🔴 Closed'}` : 'Select a branch'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Auto-call next toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <div
              onClick={() => setAutoNext(!autoNext)}
              style={{
                width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background .2s',
                background: autoNext ? GREEN : '#D1D5DB', position: 'relative',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 9, background: '#fff',
                position: 'absolute', top: 2, left: autoNext ? 20 : 2, transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            Auto-call next
          </label>
          <button
            style={{ padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${branchInfo?.isOpen ? '#dc2626' : GREEN}`, background: '#fff', color: branchInfo?.isOpen ? '#dc2626' : GREEN, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            onClick={handleToggleOpen}
          >
            {branchInfo?.isOpen ? '🔴 Close Branch' : '🟢 Open Branch'}
          </button>
        </div>
      </div>

      {/* ── Branch selector ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {branches.map((b) => (
          <button key={b.id} onClick={() => selectBranch(b.id)}
            style={{ padding: '8px 20px', borderRadius: 24, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: selectedBranch === b.id ? GREEN : '#F3F4F6',
              color:      selectedBranch === b.id ? '#fff' : '#374151' }}
          >
            {b.name.replace('Olive ', '')}
            {b.queueLength > 0 && (
              <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {b.queueLength}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Service type filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SERVICE_TYPES.map((svc) => {
          const icons = { 'All': '🎫', 'Dine In': '🍽️', 'Takeaway': '🛍️', 'Reservation': '📋' };
          const count = svc === 'All' ? queue.filter((t) => ['waiting','called'].includes(t.status)).length
            : queue.filter((t) => (t.serviceName === svc || t.serviceType === svc) && ['waiting','called'].includes(t.status)).length;
          return (
            <button key={svc} onClick={() => setServiceFilter(svc)}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: serviceFilter === svc ? GREEN : '#F3F4F6',
                color:      serviceFilter === svc ? '#fff' : '#374151' }}
            >
              {icons[svc]} {svc} {count > 0 && <span style={{ marginLeft: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Capacity controls ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Dine-in busy toggle */}
        <button
          onClick={handleToggleBusy}
          style={{
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12,
            background: branchInfo?.isBusy ? '#FEF3C7' : GREEN_L,
            color:      branchInfo?.isBusy ? '#d97706' : GREEN,
          }}
        >
          {branchInfo?.isBusy ? '🪑 FULL — Click to Re-open Dine-In' : '🍽️ Dine-In: Open'}
        </button>

        {/* Reservations toggle */}
        <button
          onClick={handleToggleReservations}
          style={{
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12,
            background: branchInfo?.reservationsOpen === false ? '#FEE2E2' : GREEN_L,
            color:      branchInfo?.reservationsOpen === false ? '#dc2626' : GREEN,
          }}
        >
          {branchInfo?.reservationsOpen === false ? '🔒 Reservations: Closed' : '📋 Reservations: Open'}
        </button>

        {/* Table occupancy counter (only shown if tableCapacity is set) */}
        {(branchInfo?.tableCapacity ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', borderRadius: 10, padding: '6px 12px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>🪑 Seats:</span>
            <button onClick={() => handleOccupancy(-1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', color: '#374151' }}>−</button>
            <span style={{ fontWeight: 900, fontSize: 14, color: '#111827', minWidth: 40, textAlign: 'center' }}>
              {branchInfo?.currentOccupancy ?? 0}/{branchInfo?.tableCapacity}
            </span>
            <button onClick={() => handleOccupancy(+1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1.5px solid ${GREEN}`, background: GREEN_L, fontSize: 16, fontWeight: 900, cursor: 'pointer', color: GREEN }}>+</button>
          </div>
        )}
      </div>

      {/* ── Staff count controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: '#fff', borderRadius: 12, padding: '12px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>Active Staff</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: GREEN }}>{staffCount}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleStaff(-1)} disabled={staffCount <= 1}
            style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid #E5E7EB`, background: staffCount <= 1 ? '#F9FAFB' : '#fff', fontSize: 20, fontWeight: 900, cursor: staffCount <= 1 ? 'not-allowed' : 'pointer', color: '#374151' }}>
            −
          </button>
          <button onClick={() => handleStaff(+1)}
            style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${GREEN}`, background: GREEN_L, fontSize: 20, fontWeight: 900, cursor: 'pointer', color: GREEN }}>
            +
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...actionBtn(GREEN), fontSize: 13 }} onClick={() => setShowAssign(true)}>
            ➕ Assign Walk-In
          </button>
          <button
            style={{ ...actionBtn(GREEN), fontSize: 13, opacity: waitingCount === 0 ? 0.5 : 1 }}
            onClick={handleCallNext} disabled={actionLoading === 'next' || waitingCount === 0}
          >
            {actionLoading === 'next' ? '…' : `📢 Call Next`}
          </button>
        </div>
      </div>

      {/* ── Flash message ── */}
      {message && (
        <div style={{ background: message.error ? '#FEE2E2' : GREEN_L, color: message.error ? '#991B1B' : GREEN, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontWeight: 600, fontSize: 13 }}>
          {message.text}
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Waiting',  val: waitingCount,  color: GREEN,     bg: GREEN_L },
          { label: 'Serving',  val: calledToken ? 1 : 0, color: '#d97706', bg: '#fef3c7' },
          { label: 'Served',   val: servedCount,   color: '#16a34a', bg: '#d1fae5' },
          { label: 'Skipped',  val: skippedCount,  color: '#dc2626', bg: '#fee2e2' },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 18px' }}>
            <p style={{ fontSize: 30, fontWeight: 900, color: s.color, margin: 0 }}>{s.val}</p>
            <p style={{ fontSize: 12, color: s.color, margin: 0, fontWeight: 700, opacity: 0.8 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── NOW SERVING ── */}
      {calledToken ? (
        <div style={{ background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.08em' }}>🔔 Now Serving</p>
              <p style={{ fontSize: 52, fontWeight: 900, color: '#D97706', margin: '0 0 4px', letterSpacing: 2 }}>{calledToken.tokenCode}</p>
              <p style={{ color: '#78350F', margin: 0, fontSize: 14, fontWeight: 600 }}>
                {calledToken.userName} · {calledToken.serviceName}
              </p>
              <p style={{ color: '#92400E', margin: '4px 0 0', fontSize: 12 }}>
                ⏱ Est. {calledToken.estimatedWaitMinutes} min · Called at {calledToken.calledAt ? new Date(calledToken.calledAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <button style={actionBtn('#16A34A')} onClick={() => handleServe(calledToken.id)} disabled={!!actionLoading}>
                {actionLoading === calledToken.id ? '…' : '✓ Mark Served'}
              </button>
              <button style={actionBtn('#DC2626')} onClick={() => handleSkip(calledToken.id)} disabled={!!actionLoading}>
                ⏭ Skip
              </button>
              <button style={actionBtn('#7C3AED')} onClick={() => { setDelayTokenId(calledToken.id); setShowDelay(true); }} disabled={!!actionLoading}>
                ⏳ Delay
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#F9FAFB', border: '2px dashed #E5E7EB', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 28, marginBottom: 6 }}>😴</p>
          <p style={{ color: '#9CA3AF', fontWeight: 600, margin: 0, fontSize: 14 }}>No token currently being served</p>
          {waitingCount > 0 && (
            <button style={{ ...actionBtn(GREEN), marginTop: 12 }} onClick={handleCallNext} disabled={actionLoading === 'next'}>
              {actionLoading === 'next' ? '…' : `📢 Call Next (${waitingCount} waiting)`}
            </button>
          )}
        </div>
      )}

      {/* ── Visual queue strip ── */}
      {upcomingTokens.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 14, color: '#374151' }}>📋 Queue Preview</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {upcomingTokens.map((t, idx) => (
              <div key={t.id} style={{
                flexShrink: 0, width: 90, borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                background: idx === 0 ? GREEN_L : '#F9FAFB',
                border: `1.5px solid ${idx === 0 ? GREEN : '#E5E7EB'}`,
              }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: idx === 0 ? GREEN : '#9CA3AF' }}>#{idx + 1}</p>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 900, color: idx === 0 ? GREEN : '#374151', fontFamily: 'monospace' }}>{t.tokenCode}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.userName?.split(' ')[0] ?? '—'}
                </p>
              </div>
            ))}
            {waitingCount > 6 && (
              <div style={{ flexShrink: 0, width: 70, borderRadius: 12, padding: '12px 8px', textAlign: 'center', background: '#F3F4F6', border: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#6B7280' }}>+{waitingCount - 6}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Full token table ── */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>All Tokens</p>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filteredQueue.length} total{serviceFilter !== 'All' ? ` (${serviceFilter})` : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              <Th>#</Th><Th>Token</Th><Th>Customer</Th><Th>Service</Th><Th>Status</Th><Th>Est. Time</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>🌿 No active tokens</td></tr>
            ) : (
              filteredQueue.map((token) => {
                const sc          = STATUS_COLOR[token.status] ?? STATUS_COLOR.waiting;
                const isTakeaway  = token.serviceName === 'Takeaway' || token.serviceType === 'Takeaway';
                const hasOrder    = isTakeaway && token.orderItems && token.orderItems.length > 0;
                const isExpanded  = expandedToken === token.id;
                const prodTime    = token.estimatedProductionTime;
                return (
                  <React.Fragment key={token.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #F3F4F6', background: isExpanded ? '#FAFFF9' : 'transparent' }}>
                      <Td style={{ color: '#9CA3AF', width: 36 }}>{token.position ?? '—'}</Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{token.tokenCode}</strong>
                          {hasOrder && (
                            <button
                              onClick={() => setExpandedToken(isExpanded ? null : token.id)}
                              title="View order items"
                              style={{ background: '#FFF3E0', border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#d97706', cursor: 'pointer' }}
                            >
                              🛍️ {token.orderItems.length} item{token.orderItems.length !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </Td>
                      <Td>{token.userName}</Td>
                      <Td style={{ color: '#6B7280', fontSize: 13 }}>{token.serviceName}</Td>
                      <Td><span style={{ ...badge, background: sc.bg, color: sc.color }}>{token.status}</span></Td>
                      <Td style={{ fontSize: 13 }}>
                        {prodTime ? (
                          <span title="Kitchen production estimate">🕐 ~{prodTime} min</span>
                        ) : (
                          <span>{token.estimatedWaitMinutes} min</span>
                        )}
                      </Td>
                      <Td>
                        {token.status === 'waiting' && (
                          <button style={smallBtn('#6B7280')} onClick={() => handleSkip(token.id)} disabled={!!actionLoading}>Skip</button>
                        )}
                        {token.status === 'called' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={smallBtn('#16a34a')} onClick={() => handleServe(token.id)} disabled={!!actionLoading}>Serve ✓</button>
                            <button style={smallBtn('#7c3aed')} onClick={() => { setDelayTokenId(token.id); setShowDelay(true); }} disabled={!!actionLoading}>Delay</button>
                          </div>
                        )}
                      </Td>
                    </tr>
                    {/* Expanded order items row */}
                    {isExpanded && hasOrder && (
                      <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td colSpan={7} style={{ padding: '0 14px 12px 60px', background: '#FAFFF9' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {token.orderItems.map((oi, idx) => (
                              <div key={idx} style={{ background: '#FFF3E0', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                                {oi.name} × {oi.qty}
                                {oi.price ? <span style={{ color: '#d97706', marginLeft: 4 }}>Rs. {(oi.price * oi.qty).toLocaleString()}</span> : null}
                              </div>
                            ))}
                          </div>
                          {token.orderTotal > 0 && (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#374151' }}>
                              Total: Rs. {token.orderTotal.toLocaleString()}
                              {prodTime && <span style={{ marginLeft: 12, color: '#d97706' }}>🕐 Kitchen est: ~{prodTime} min</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Assign Walk-In Modal ── */}
      {showAssign && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginTop: 0 }}>➕ Assign Walk-In Token</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>Add a customer who walked in without the app.</p>
            <label style={lbl}>Customer Name</label>
            <input style={inp} placeholder="e.g. Ahmed Khan" value={assignName} onChange={(e) => setAssignName(e.target.value)} />
            <label style={lbl}>Service</label>
            <select style={inp} value={assignService} onChange={(e) => setAssignService(e.target.value)}>
              <option value="">— Select service —</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={actionBtn(GREEN)} onClick={handleAssignSubmit} disabled={assignLoading}>
                {assignLoading ? 'Assigning…' : '✓ Assign Token'}
              </button>
              <button style={actionBtn('#9CA3AF')} onClick={() => { setShowAssign(false); setAssignName(''); setAssignService(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delay Modal ── */}
      {showDelay && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginTop: 0 }}>⏳ Add Service Delay</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>
              All waiting customers will receive a notification about the extended wait.
            </p>

            {/* AI suggestion */}
            <div style={{ background: GREEN_L, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: GREEN }}>AI Suggested Delay</p>
                <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                  Based on {waitingCount} waiting × {avgSvcTime} min avg ÷ {staffCount} staff:
                  <strong style={{ color: GREEN, marginLeft: 4 }}>{suggestedDelay} min</strong>
                  <button onClick={() => setDelayMinutes(String(suggestedDelay))}
                    style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 6, border: `1px solid ${GREEN}`, background: '#fff', color: GREEN, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Use This
                  </button>
                </p>
              </div>
            </div>

            <label style={lbl}>Minutes to add</label>
            <input style={inp} type="number" min="1" max="60" value={delayMinutes} onChange={(e) => setDelayMinutes(e.target.value)} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={actionBtn('#7C3AED')} onClick={handleDelaySubmit} disabled={delayLoading}>
                {delayLoading ? 'Applying…' : '⏳ Apply Delay'}
              </button>
              <button style={actionBtn('#9CA3AF')} onClick={() => { setShowDelay(false); setDelayTokenId(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  waiting:   { bg: '#E8F5E9', color: '#2D6A2E' },
  called:    { bg: '#fef3c7', color: '#d97706' },
  served:    { bg: '#d1fae5', color: '#16a34a' },
  skipped:   { bg: '#fee2e2', color: '#dc2626' },
  cancelled: { bg: '#f1f5f9', color: '#94a3b8' },
};

function Th({ children }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6B7280', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', letterSpacing: '.05em' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '11px 14px', fontSize: 13, color: '#111827', ...style }}>{children}</td>;
}
function actionBtn(bg) {
  return { padding: '10px 20px', borderRadius: 10, background: bg, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
}
function smallBtn(bg) {
  return { padding: '5px 12px', borderRadius: 8, background: bg, color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' };
}

const badge   = { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal   = { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const lbl     = { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' };
const inp     = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 14, color: '#111827', marginBottom: 14, boxSizing: 'border-box', outline: 'none' };