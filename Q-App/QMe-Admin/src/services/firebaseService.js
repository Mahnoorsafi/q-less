/**
 * firebaseService.js  —  Admin app Firestore operations
 *
 * Admin capabilities:
 *   - Real-time queue monitoring per branch
 *   - Call next token / skip token
 *   - Mark token as served (triggers ML log)
 *   - CRUD on branch services
 *   - Send notifications to customers
 *   - Read analytics from token history
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, serverTimestamp, query, where, orderBy,
  increment, runTransaction, Timestamp,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from './firebase';

const AI_API_URL = 'http://localhost:5000';

// ─── Branch helpers ───────────────────────────────────────────────────────────

export function subscribeToBranches(cb) {
  return onSnapshot(collection(db, 'branches'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToBranch(branchId, cb) {
  return onSnapshot(doc(db, 'branches', branchId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function updateBranchService(branchId, serviceId, data) {
  await updateDoc(doc(db, 'branches', branchId, 'services', serviceId), data);
}

export async function fetchBranchServices(branchId) {
  const snap = await getDocs(collection(db, 'branches', branchId, 'services'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeToServices(branchId, cb) {
  return onSnapshot(collection(db, 'branches', branchId, 'services'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

const DEFAULT_SERVICES = [
  { id: 'dine_in',     name: 'Dine In',     avgServiceTime: 10, isAvailable: true, description: 'Enjoy your meal at the restaurant',  icon: '🍽️' },
  { id: 'takeaway',    name: 'Takeaway',     avgServiceTime: 6,  isAvailable: true, description: 'Order and pick up your food',          icon: '🛍️' },
  { id: 'reservation', name: 'Reservation',  avgServiceTime: 5,  isAvailable: true, description: 'Reserve a table for your group',       icon: '📅' },
];

export async function seedServicesIfEmpty(branchId) {
  const snap = await getDocs(collection(db, 'branches', branchId, 'services'));
  if (!snap.empty) return;
  for (const svc of DEFAULT_SERVICES) {
    const { id, ...data } = svc;
    await setDoc(doc(db, 'branches', branchId, 'services', id), data);
  }
}

export async function addBranchService(branchId, data) {
  await addDoc(collection(db, 'branches', branchId, 'services'), data);
}

export async function deleteBranchService(branchId, serviceId) {
  await deleteDoc(doc(db, 'branches', branchId, 'services', serviceId));
}

// ─── Queue operations ─────────────────────────────────────────────────────────

/** Real-time stream of all active + today's served/skipped tokens for a branch */
export function subscribeToQueue(branchId, cb) {
  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status', 'in', ['waiting', 'called', 'served', 'skipped']),
  );
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return onSnapshot(q,
    (snap) => {
      const tokens = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => {
          // Always show active tokens; for served/skipped, today only
          if (t.status === 'waiting' || t.status === 'called') return true;
          const created = t.createdAt?.toDate?.();
          return created && created >= startOfDay;
        })
        .sort((a, b) => {
          const aScheduled = a.isPreScheduled && a.scheduledTime;
          const bScheduled = b.isPreScheduled && b.scheduledTime;
          if (!aScheduled && bScheduled) return -1;
          if (aScheduled && !bScheduled) return 1;
          if (aScheduled && bScheduled) return (a.scheduledTime?.seconds ?? 0) - (b.scheduledTime?.seconds ?? 0);
          return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
        });
      cb(tokens);
    },
    (err) => { console.error('subscribeToQueue error:', err.message, err.code); cb([]); },
  );
}

/** Call the next waiting token for a branch */
export async function callNextToken(branchId) {
  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status', '==', 'waiting'),
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('No waiting tokens');

  // Sort client-side: oldest token first
  const sorted = snap.docs.sort(
    (a, b) => (a.data().createdAt?.seconds ?? 0) - (b.data().createdAt?.seconds ?? 0),
  );
  const next = sorted[0];
  await updateDoc(next.ref, { status: 'called', calledAt: serverTimestamp() });

  // Push notification to customer
  const data = next.data();
  await sendNotification(data.userId, {
    title: 'Your turn!',
    body:  `Token ${data.tokenCode} — please proceed to the counter at ${data.branchName}.`,
    tokenId: next.id,
  });

  return { id: next.id, ...data };
}

/** Skip a specific token — notifies skipped customer, refreshes all positions */
export async function skipToken(tokenId, branchId) {
  const tokenRef  = doc(db, 'tokens', tokenId);
  const branchRef = doc(db, 'branches', branchId);
  const tokenSnap = await getDoc(tokenRef);
  await runTransaction(db, async (tx) => {
    tx.update(tokenRef, { status: 'skipped' });
    tx.update(branchRef, { queueLength: increment(-1) });
  });
  if (tokenSnap.exists()) {
    const { userId, tokenCode, branchName } = tokenSnap.data();
    if (userId && userId !== 'walk-in') {
      await sendNotification(userId, {
        title: '⏭️ Token Skipped',
        body:  `Token ${tokenCode} was skipped at ${branchName}. Please approach the counter if you are still available.`,
        tokenId,
      });
    }
  }
  await refreshWaitingPositions(branchId);
}

/** Mark token as served — decrements queue length and logs to ML */
export async function serveToken(tokenId, branchId) {
  const tokenRef  = doc(db, 'tokens', tokenId);
  const branchRef = doc(db, 'branches', branchId);

  const tokenSnap  = await getDoc(tokenRef);
  const branchSnap = await getDoc(branchRef);
  if (!tokenSnap.exists()) throw new Error('Token not found');

  const tokenData  = tokenSnap.data();
  const branchData = branchSnap.data() ?? {};

  const servedAt   = new Date();
  const createdAt  = tokenData.createdAt?.toDate?.() ?? servedAt;
  const actualWait = Math.round((servedAt - createdAt) / 60000);

  await runTransaction(db, async (tx) => {
    tx.update(tokenRef,  { status: 'served', servedAt: serverTimestamp() });
    tx.update(branchRef, { queueLength: increment(-1) });
  });

  await refreshWaitingPositions(branchId);

  // Log real data to ML model for continuous improvement
  logToMLModel({
    queue_length:         branchData.queueLength ?? 1,
    avg_service_time:     branchData.avgServiceTime ?? 10,
    hour_of_day:          createdAt.getHours(),
    day_of_week:          createdAt.getDay(),
    staff_count:          branchData.staffCount ?? 3,
    branch_id:            branchId,
    actual_wait_minutes:  actualWait,
  });

  return { id: tokenId, ...tokenData };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function sendNotification(userId, { title, body, tokenId }) {
  await addDoc(collection(db, 'notifications', userId, 'messages'), {
    title,
    body,
    tokenId: tokenId ?? null,
    read:    false,
    createdAt: serverTimestamp(),
  });
}

// ─── Queue position refresh ───────────────────────────────────────────────────

/** After a serve or skip, renumber all waiting tokens 1,2,3… and notify each customer */
async function refreshWaitingPositions(branchId) {
  const branchSnap = await getDoc(doc(db, 'branches', branchId));
  const avgSvcTime = branchSnap.exists() ? (branchSnap.data().avgServiceTime ?? 8) : 8;

  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status', '==', 'waiting'),
  );
  const snap = await getDocs(q);
  const sorted = snap.docs.sort(
    (a, b) => (a.data().createdAt?.seconds ?? 0) - (b.data().createdAt?.seconds ?? 0),
  );
  await Promise.all(
    sorted.map((d, idx) =>
      updateDoc(d.ref, { position: idx + 1, estimatedWaitMinutes: (idx + 1) * avgSvcTime }),
    ),
  );
  await Promise.all(
    sorted.map((d, idx) => {
      const { userId, tokenCode, branchName } = d.data();
      if (!userId || userId === 'walk-in') return Promise.resolve();
      const pos = idx + 1;
      return sendNotification(userId, {
        title: pos === 1 ? '⚡ You\'re Next!' : '📋 Queue Updated',
        body:  pos === 1
          ? `Token ${tokenCode} — Get ready, you\'re first in line at ${branchName}!`
          : `Token ${tokenCode} — You\'re now #${pos} in queue (~${pos * avgSvcTime} min wait).`,
        tokenId: d.id,
      });
    }),
  );
}

/** Broadcast a message to all users who have tokens at a branch */
export async function broadcastToBranch(branchId, title, body) {
  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status', 'in', ['waiting', 'called']),
  );
  const snap = await getDocs(q);
  const sends = snap.docs.map((d) =>
    sendNotification(d.data().userId, { title, body, tokenId: d.id }),
  );
  await Promise.all(sends);
}

// ─── Admin role management ────────────────────────────────────────────────────

export function subscribeToAdmins(cb) {
  return onSnapshot(collection(db, 'admins'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addAdminRole({ uid, email, name, role, branchId }) {
  await setDoc(doc(db, 'admins', uid), {
    uid, email, name,
    role:     role ?? 'branch_admin',
    branchId: branchId ?? null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Create a brand-new Firebase Auth account for a branch admin, then write their
 * admins/{uid} role doc.  Uses a secondary app instance so the current super-admin
 * session is NOT disrupted.
 */
export async function createBranchAdmin({ email, password, name, role, branchId }) {
  const tempName = `temp-admin-${Date.now()}`;
  const tempApp  = initializeApp(firebaseConfig, tempName);
  const tempAuth = getAuth(tempApp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    const uid  = cred.user.uid;
    await setDoc(doc(db, 'admins', uid), {
      uid, email, name,
      role:      role ?? 'branch_admin',
      branchId:  branchId ?? null,
      createdAt: serverTimestamp(),
    });
    return uid;
  } finally {
    await deleteApp(tempApp).catch(() => {});
  }
}

export async function updateAdminRole(uid, { role, branchId }) {
  await updateDoc(doc(db, 'admins', uid), { role, branchId: branchId ?? null });
}

export async function removeAdminRole(uid) {
  await deleteDoc(doc(db, 'admins', uid));
}

// ─── Branch management ────────────────────────────────────────────────────────

export async function addBranch(data) {
  const { id, ...rest } = data;
  await setDoc(doc(db, 'branches', id), {
    ...rest,
    staffCount:    rest.staffCount    ?? 3,
    isOpen:        rest.isOpen        ?? false,
    queueLength:   0,
    tokenCounter:  100,
    avgServiceTime: rest.avgServiceTime ?? 10,
    createdAt:     serverTimestamp(),
  });
  // Seed default services
  const SERVICES = [
    { id: 'dine_in',     name: 'Dine In',     avgServiceTime: 10, isAvailable: true, description: 'Dine at the restaurant', icon: '🍽️' },
    { id: 'takeaway',    name: 'Takeaway',    avgServiceTime: 6,  isAvailable: true, description: 'Order and pick up',       icon: '🛍️' },
    { id: 'reservation', name: 'Reservation', avgServiceTime: 5,  isAvailable: true, description: 'Reserve a table',        icon: '📅' },
  ];
  for (const svc of SERVICES) {
    const { id: svcId, ...svcData } = svc;
    await setDoc(doc(db, 'branches', id, 'services', svcId), svcData);
  }
}

/**
 * Update branch capacity / availability controls:
 *   isBusy          — true when restaurant is full; dine-in shows waitlist option
 *   currentOccupancy— currently occupied seats (used for display)
 *   reservationsOpen— false to block new reservation tokens
 */
export async function updateBranchCapacity(branchId, { isBusy, currentOccupancy, reservationsOpen }) {
  const update = {};
  if (isBusy          !== undefined) update.isBusy           = isBusy;
  if (currentOccupancy !== undefined) update.currentOccupancy = currentOccupancy;
  if (reservationsOpen !== undefined) update.reservationsOpen = reservationsOpen;
  await updateDoc(doc(db, 'branches', branchId), update);
}

/** Broadcast to every registered app user (all UIDs in the users collection) */
export async function broadcastToAll(title, body) {
  const snap = await getDocs(collection(db, 'users'));
  const sends = snap.docs.map((d) =>
    sendNotification(d.id, { title, body }),
  );
  await Promise.all(sends);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function fetchTodayStats(branchId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
  );
  const snap = await getDocs(q);
  // Filter today's tokens client-side to avoid composite index requirement
  const tokens = snap.docs
    .map((d) => d.data())
    .filter((t) => {
      const created = t.createdAt?.toDate?.() ?? new Date(0);
      return created >= startOfDay;
    });

  const served   = tokens.filter((t) => t.status === 'served');
  const skipped  = tokens.filter((t) => t.status === 'skipped');
  const waiting  = tokens.filter((t) => t.status === 'waiting' || t.status === 'called');

  const avgWait = served.length
    ? Math.round(
        served.reduce((sum, t) => {
          const created = t.createdAt?.toDate?.() ?? new Date();
          const served_ = t.servedAt?.toDate?.() ?? new Date();
          return sum + (served_ - created) / 60000;
        }, 0) / served.length,
      )
    : 0;

  return {
    total:    tokens.length,
    served:   served.length,
    skipped:  skipped.length,
    waiting:  waiting.length,
    avgWaitMinutes: avgWait,
  };
}

export async function fetchAllBranchStats() {
  const branchSnap = await getDocs(collection(db, 'branches'));
  const results = await Promise.all(
    branchSnap.docs.map(async (d) => {
      const stats = await fetchTodayStats(d.id);
      return { id: d.id, name: d.data().name, ...stats };
    }),
  );
  return results;
}

// ─── Menu management ─────────────────────────────────────────────────────────

export async function fetchMenuItems(branchId) {
  const snap = await getDocs(collection(db, 'branches', branchId, 'menu'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeToMenuItems(branchId, cb) {
  return onSnapshot(collection(db, 'branches', branchId, 'menu'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addMenuItem(branchId, data) {
  await addDoc(collection(db, 'branches', branchId, 'menu'), {
    ...data,
    isAvailable: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateMenuItem(branchId, itemId, data) {
  await updateDoc(doc(db, 'branches', branchId, 'menu', itemId), data);
}

export async function deleteMenuItem(branchId, itemId) {
  await deleteDoc(doc(db, 'branches', branchId, 'menu', itemId));
}

export async function toggleMenuItem(branchId, itemId, isAvailable) {
  await updateDoc(doc(db, 'branches', branchId, 'menu', itemId), { isAvailable });
}

// ─── Branch settings ─────────────────────────────────────────────────────────

/** Increment (+1) or decrement (-1) staff count for a branch (min 1) */
export async function updateStaffCount(branchId, delta) {
  const branchRef  = doc(db, 'branches', branchId);
  const branchSnap = await getDoc(branchRef);
  if (!branchSnap.exists()) return;
  const current = branchSnap.data().staffCount ?? 1;
  const next = Math.max(1, current + delta);
  await updateDoc(branchRef, { staffCount: next });
  return next;
}

/** Toggle branch open/closed */
export async function toggleBranchOpen(branchId, isOpen) {
  await updateDoc(doc(db, 'branches', branchId), { isOpen });
}

// ─── ML feedback ─────────────────────────────────────────────────────────────

function logToMLModel(params) {
  fetch(`${AI_API_URL}/log`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  }).catch(() => {});
}

// ─── Walk-in token assignment ─────────────────────────────────────────────────

/** Admin assigns a token to a walk-in customer manually */
export async function assignToken(branchId, customerName, serviceName, serviceType = 'Dine In') {
  const branchRef = doc(db, 'branches', branchId);
  let newToken;

  await runTransaction(db, async (tx) => {
    const branchSnap = await tx.get(branchRef);
    if (!branchSnap.exists()) throw new Error('Branch not found');

    const data        = branchSnap.data();
    const nextCounter = (data.tokenCounter ?? 100) + 1;
    const tokenCode   = `${data.tokenPrefix ?? 'TKN'}-${String(nextCounter).padStart(3, '0')}`;
    const position    = (data.queueLength ?? 0) + 1;
    const estWait     = (data.avgServiceTime ?? 8) * position;

    const tokenData = {
      tokenCode,
      userId:               'walk-in',
      userName:             customerName,
      branchId,
      branchName:           data.name,
      serviceId:            'walk_in',
      serviceName,
      serviceType,
      orderItems:           [],
      orderTotal:           0,
      status:               'waiting',
      position,
      estimatedWaitMinutes: estWait,
      isPreScheduled:       false,
      scheduledTime:        null,
      createdAt:            serverTimestamp(),
      calledAt:             null,
      servedAt:             null,
    };

    const tokenRef = doc(collection(db, 'tokens'));
    tx.set(tokenRef, tokenData);
    tx.update(branchRef, { queueLength: increment(1), tokenCounter: increment(1) });
    newToken = { id: tokenRef.id, ...tokenData };
  });

  return newToken;
}

// ─── Database Seeding (Admin utility) ────────────────────────────────────────

const SEED_MENU_ITEMS = [
  { id: 'zinger_burger',   name: 'Zinger Burger',        description: 'Crispy chicken burger with special Olive sauce',        price: 650,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 520 },
  { id: 'beef_burger',     name: 'Classic Beef Burger',   description: 'Juicy beef patty with lettuce, tomato & cheese',        price: 550,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 580 },
  { id: 'mushroom_burger', name: 'Mushroom Swiss Burger', description: 'Grilled patty topped with Swiss cheese & mushrooms',    price: 700,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 610 },
  { id: 'alfredo_pasta',   name: 'Creamy Alfredo Pasta',  description: 'Rich creamy pasta with mushrooms & parmesan',           price: 750,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 680 },
  { id: 'arrabbiata',      name: 'Penne Arrabbiata',      description: 'Spicy tomato sauce with fresh basil & penne',           price: 650,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 540 },
  { id: 'bolognese',       name: 'Spaghetti Bolognese',   description: 'Classic slow-cooked meat sauce over spaghetti',         price: 700,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 620 },
  { id: 'matcha_latte',    name: 'Iced Matcha Latte',     description: 'Smooth ceremonial matcha with fresh milk & ice',        price: 450,  category: 'Drinks',   emoji: '🍵', isAvailable: true, calories: 180 },
  { id: 'cappuccino',      name: 'Cappuccino',             description: 'Rich double-shot espresso with silky foamed milk',      price: 350,  category: 'Drinks',   emoji: '☕', isAvailable: true, calories: 120 },
  { id: 'lemonade',        name: 'Fresh Lemonade',         description: 'Chilled freshly squeezed lemonade with mint',           price: 300,  category: 'Drinks',   emoji: '🍋', isAvailable: true, calories: 90  },
  { id: 'bubble_tea',      name: 'Bubble Tea',             description: 'Creamy milk tea with chewy tapioca pearls',             price: 500,  category: 'Drinks',   emoji: '🧋', isAvailable: true, calories: 320 },
  { id: 'lotus_cake',      name: 'Lotus Cheesecake',       description: 'Rich NY cheesecake with Lotus Biscoff crumb base',      price: 550,  category: 'Desserts', emoji: '🎂', isAvailable: true, calories: 420 },
  { id: 'lava_cake',       name: 'Chocolate Lava Cake',    description: 'Warm chocolate cake with molten fudge center',          price: 500,  category: 'Desserts', emoji: '🍫', isAvailable: true, calories: 480 },
  { id: 'creme_brulee',    name: 'Crème Brûlée',           description: 'Classic French vanilla custard with caramel top',       price: 480,  category: 'Desserts', emoji: '🍮', isAvailable: true, calories: 350 },
  { id: 'garlic_bread',    name: 'Garlic Bread',           description: 'Crispy toasted bread with herb garlic butter',          price: 250,  category: 'Snacks',   emoji: '🥖', isAvailable: true, calories: 290 },
  { id: 'loaded_fries',    name: 'Loaded Fries',           description: 'Crispy golden fries with cheese sauce & jalapeños',     price: 350,  category: 'Snacks',   emoji: '🍟', isAvailable: true, calories: 460 },
  { id: 'caesar_salad',    name: 'Caesar Salad',           description: 'Crisp romaine with Caesar dressing & croutons',         price: 400,  category: 'Snacks',   emoji: '🥗', isAvailable: true, calories: 280 },
];

const SEED_SERVICES = [
  { id: 'dine_in',     name: 'Dine In',     avgServiceTime: 10, isAvailable: true, description: 'Enjoy your meal at the restaurant', icon: '🍽️' },
  { id: 'takeaway',    name: 'Takeaway',    avgServiceTime: 6,  isAvailable: true, description: 'Order and pick up your food',       icon: '🛍️' },
  { id: 'reservation', name: 'Reservation', avgServiceTime: 5,  isAvailable: true, description: 'Reserve a table for your group',    icon: '📅' },
];

const SEED_BRANCHES = [
  { id: 'gulberg', name: 'Olive Gulberg',     address: 'Gulberg Greens, F-7/2, Islamabad', lat: 33.7215, lng: 73.0433, staffCount: 4, isOpen: true, queueLength: 0, avgServiceTime: 10, tokenCounter: 100, tokenPrefix: 'GUL', phone: '+92 51 123 4567', hours: '11:00 AM – 11:00 PM', emoji: '🍀' },
  { id: 'f10',     name: 'Olive F-10 Markaz', address: 'F-10 Markaz, Islamabad',           lat: 33.6996, lng: 72.9811, staffCount: 3, isOpen: true, queueLength: 0, avgServiceTime:  9, tokenCounter: 100, tokenPrefix: 'F10', phone: '+92 51 234 5678', hours: '11:00 AM – 11:00 PM', emoji: '🌿' },
  { id: 'dha',     name: 'Olive DHA Phase 2', address: 'DHA Phase 2, Rawalpindi',          lat: 33.5651, lng: 73.1219, staffCount: 3, isOpen: true, queueLength: 0, avgServiceTime: 11, tokenCounter: 100, tokenPrefix: 'DHA', phone: '+92 51 345 6789', hours: '11:00 AM – 10:30 PM', emoji: '🌱' },
];

/**
 * Wipes all branch data and re-seeds 3 Olive branches with full menu + services.
 * Callable from the admin panel — the admin user must be authenticated.
 */
export async function forceSeedDatabase() {
  const oldSnap = await getDocs(collection(db, 'branches'));
  for (const d of oldSnap.docs) {
    await deleteDoc(d.ref);
  }
  for (const branch of SEED_BRANCHES) {
    const { id, ...data } = branch;
    await setDoc(doc(db, 'branches', id), data);
    for (const svc of SEED_SERVICES) {
      const { id: svcId, ...svcData } = svc;
      await setDoc(doc(db, 'branches', id, 'services', svcId), svcData);
    }
    for (const item of SEED_MENU_ITEMS) {
      const { id: itemId, ...itemData } = item;
      await setDoc(doc(db, 'branches', id, 'menu', itemId), itemData);
    }
  }
}

/** Admin delays a called token — adds extra minutes to all waiting tokens and notifies them */
export async function delayToken(branchId, calledTokenId, extraMinutes) {
  const waitingQ = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status',   '==', 'waiting'),
  );
  const snap = await getDocs(waitingQ);

  const updates = snap.docs.map((d) => {
    const update = { estimatedWaitMinutes: (d.data().estimatedWaitMinutes ?? 0) + extraMinutes };
    // Also delay the production estimate for takeaway tokens
    if (d.data().estimatedProductionTime != null) {
      update.estimatedProductionTime = (d.data().estimatedProductionTime ?? 0) + extraMinutes;
    }
    return updateDoc(d.ref, update);
  });
  // Also extend the called token itself
  updates.push(
    updateDoc(doc(db, 'tokens', calledTokenId), {
      estimatedWaitMinutes: increment(extraMinutes),
    }),
  );
  await Promise.all(updates);

  // Notify all affected customers
  const notifPromises = snap.docs.map((d) =>
    sendNotification(d.data().userId, {
      title: '⏳ Queue Delay',
      body:  `Your estimated wait has been extended by ${extraMinutes} minute${extraMinutes !== 1 ? 's' : ''} due to an ongoing service delay.`,
      tokenId: d.id,
    }),
  );
  await Promise.all(notifPromises);
}