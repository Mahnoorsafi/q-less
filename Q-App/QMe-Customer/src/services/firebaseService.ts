/**
 * firebaseService.ts — all Firestore operations for the Q-Less customer app.
 *
 * Collections:
 *   branches/{branchId}               — branch info + live queue stats
 *   branches/{id}/services/{svcId}    — per-branch services (Dine In, Takeaway…)
 *   branches/{id}/menu/{itemId}       — food menu items
 *   tokens/{tokenId}                  — all queue tokens
 *   notifications/{uid}/messages/{id} — per-user notifications
 */

import {
  collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc,
  onSnapshot, serverTimestamp, query, where,
  Timestamp, runTransaction, increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Branch = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  staffCount: number;
  isOpen: boolean;
  queueLength: number;
  avgServiceTime: number;
  tokenPrefix: string;
  tokenCounter: number;
  phone?: string;
  hours?: string;
  emoji?: string;
  isBusy?: boolean;           // admin-set: restaurant is full, dine-in shows waitlist
  tableCapacity?: number;     // total seating capacity
  currentOccupancy?: number;  // currently occupied seats/tables
  reservationsOpen?: boolean; // false = admin has closed reservations
};

export type Service = {
  id: string;
  name: string;
  avgServiceTime: number;
  isAvailable: boolean;
  description: string;
  icon?: string;
  unavailableUntil?: string | null; // e.g. "6:00 PM" — set by admin when closing
  closedReason?: string | null;     // e.g. "Restaurant at capacity"
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Burgers' | 'Pasta' | 'Drinks' | 'Desserts' | 'Snacks';
  emoji: string;
  isAvailable: boolean;
  calories?: number;
  prepTime?: number;          // minutes to prepare this item (used for production estimate)
};

export type OrderItem = {
  itemId: string;
  name: string;
  price: number;
  qty: number;
};

export type TokenStatus = 'waiting' | 'called' | 'served' | 'skipped' | 'cancelled';

export type Token = {
  id: string;
  tokenCode: string;
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  orderItems?: OrderItem[];
  orderTotal?: number;
  estimatedProductionTime?: number; // minutes — takeaway: kitchen prep estimate
  status: TokenStatus;
  position: number;
  estimatedWaitMinutes: number;
  isPreScheduled: boolean;
  scheduledTime: Timestamp | null;
  createdAt: Timestamp;
  calledAt: Timestamp | null;
  servedAt: Timestamp | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
  tokenId?: string;
};

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function fetchBranches(): Promise<Branch[]> {
  const snap = await getDocs(collection(db, 'branches'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch));
}

// Normalise raw Firestore branch data so both isOpen (boolean) and
// status ('live' / 'open' string set by the admin panel) are honoured.
function normalizeBranch(id: string, data: Record<string, any>): Branch {
  const statusOpen = data.status === 'live' || data.status === 'open' || data.status === 'active';
  return {
    ...data,
    id,
    isOpen: data.isOpen === true || statusOpen,
  } as Branch;
}

export function subscribeToBranches(cb: (branches: Branch[]) => void) {
  return onSnapshot(collection(db, 'branches'), (snap) => {
    cb(snap.docs.map((d) => normalizeBranch(d.id, d.data())));
  });
}

export async function fetchBranchById(branchId: string): Promise<Branch | null> {
  const snap = await getDoc(doc(db, 'branches', branchId));
  if (!snap.exists()) return null;
  return normalizeBranch(snap.id, snap.data()!);
}

export function subscribeToBranch(branchId: string, cb: (branch: Branch | null) => void) {
  return onSnapshot(doc(db, 'branches', branchId), (snap) => {
    cb(snap.exists() ? normalizeBranch(snap.id, snap.data()!) : null);
  });
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function fetchServices(branchId: string): Promise<Service[]> {
  const snap = await getDocs(collection(db, 'branches', branchId, 'services'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service));
}

export function subscribeToServices(branchId: string, cb: (services: Service[]) => void) {
  return onSnapshot(collection(db, 'branches', branchId, 'services'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service)));
  });
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

export async function fetchMenuItems(branchId: string): Promise<MenuItem[]> {
  const snap = await getDocs(collection(db, 'branches', branchId, 'menu'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
}

export function subscribeToMenuItems(branchId: string, cb: (items: MenuItem[]) => void): () => void {
  return onSnapshot(collection(db, 'branches', branchId, 'menu'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem)));
  });
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

export async function generateToken(params: {
  userId: string;
  userName: string;
  branchId: string;
  branchName: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  estimatedWaitMinutes: number;
  estimatedProductionTime?: number;
  orderItems?: OrderItem[];
  orderTotal?: number;
  isPreScheduled?: boolean;
  scheduledTime?: Date | null;
}): Promise<Token> {
  const branchRef = doc(db, 'branches', params.branchId);
  let newToken!: Token;

  await runTransaction(db, async (tx) => {
    const branchSnap = await tx.get(branchRef);
    if (!branchSnap.exists()) throw new Error('Branch not found');

    // Daily counter — resets each day, unique per branch
    const today      = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const dailyRef   = doc(db, 'branches', params.branchId, 'dailyCounters', today);
    const dailySnap  = await tx.get(dailyRef);

    const currentQueue: number = Math.max(0, branchSnap.data().queueLength ?? 0);
    const prefix: string       = branchSnap.data().tokenPrefix ?? 'TKN';

    const dailyCount = (dailySnap.exists() ? (dailySnap.data().count as number ?? 0) : 0) + 1;
    const tokenCode  = `${prefix}-${String(dailyCount).padStart(3, '0')}`;
    const position   = currentQueue + 1;

    const tokenData = {
      tokenCode,
      userId:               params.userId,
      userName:             params.userName,
      branchId:             params.branchId,
      branchName:           params.branchName,
      serviceId:            params.serviceId,
      serviceName:          params.serviceName,
      serviceType:          params.serviceType,
      orderItems:           params.orderItems ?? [],
      orderTotal:           params.orderTotal ?? 0,
      estimatedProductionTime: params.estimatedProductionTime ?? null,
      status:               'waiting' as TokenStatus,
      position,
      estimatedWaitMinutes: params.estimatedWaitMinutes,
      isPreScheduled:       params.isPreScheduled ?? false,
      scheduledTime:        params.scheduledTime
        ? Timestamp.fromDate(params.scheduledTime)
        : null,
      createdAt:  serverTimestamp(),
      calledAt:   null,
      servedAt:   null,
    };

    const tokenRef = doc(collection(db, 'tokens'));
    tx.set(tokenRef, tokenData);
    tx.set(dailyRef, { count: dailyCount });
    tx.update(branchRef, { queueLength: increment(1) });

    newToken = { id: tokenRef.id, ...tokenData } as unknown as Token;
  });

  return newToken;
}

export function subscribeToToken(tokenId: string, cb: (token: Token | null) => void) {
  return onSnapshot(doc(db, 'tokens', tokenId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Token) : null);
  });
}

export type QueueSlot = { id: string; tokenCode: string; position: number; status: 'waiting' | 'called' };

/** Subscribe to the live queue for a branch — returns simplified slots (no personal data) sorted by position */
export function subscribeToWaitingQueue(branchId: string, cb: (slots: QueueSlot[]) => void) {
  const q = query(
    collection(db, 'tokens'),
    where('branchId', '==', branchId),
    where('status', 'in', ['waiting', 'called']),
  );
  return onSnapshot(q, (snap) => {
    const slots = snap.docs
      .map((d) => ({
        id: d.id,
        tokenCode: d.data().tokenCode as string,
        position: d.data().position as number ?? 0,
        status: d.data().status as 'waiting' | 'called',
        createdAt: d.data().createdAt,
        isPreScheduled: d.data().isPreScheduled as boolean ?? false,
        scheduledTime: d.data().scheduledTime,
      }))
      .sort((a, b) => {
        // Immediate tokens come first (sorted by createdAt), pre-scheduled last (sorted by scheduledTime)
        const aScheduled = a.isPreScheduled && a.scheduledTime;
        const bScheduled = b.isPreScheduled && b.scheduledTime;
        if (!aScheduled && bScheduled) return -1;
        if (aScheduled && !bScheduled) return 1;
        if (aScheduled && bScheduled) return (a.scheduledTime?.seconds ?? 0) - (b.scheduledTime?.seconds ?? 0);
        return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
      })
      .map((s, idx) => ({ id: s.id, tokenCode: s.tokenCode, position: idx + 1, status: s.status }));
    cb(slots);
  });
}

export async function getActiveToken(userId: string): Promise<Token | null> {
  const q = query(
    collection(db, 'tokens'),
    where('userId', '==', userId),
    where('status', 'in', ['waiting', 'called']),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sorted = snap.docs.sort(
    (a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0),
  );
  return { id: sorted[0].id, ...sorted[0].data() } as Token;
}

export function subscribeToActiveToken(userId: string, cb: (token: Token | null) => void) {
  const q = query(
    collection(db, 'tokens'),
    where('userId', '==', userId),
    where('status', 'in', ['waiting', 'called']),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { cb(null); return; }
    const sorted = snap.docs.sort(
      (a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0),
    );
    cb({ id: sorted[0].id, ...sorted[0].data() } as Token);
  });
}

export async function cancelToken(tokenId: string, branchId: string) {
  await runTransaction(db, async (tx) => {
    const tokenRef  = doc(db, 'tokens', tokenId);
    const branchRef = doc(db, 'branches', branchId);
    tx.update(tokenRef,  { status: 'cancelled' });
    tx.update(branchRef, { queueLength: increment(-1) });
  });
}

export async function rescheduleToken(tokenId: string, newTime: Date) {
  const tokenRef = doc(db, 'tokens', tokenId);
  await runTransaction(db, async (tx) => {
    const tokenSnap = await tx.get(tokenRef);
    if (!tokenSnap.exists()) throw new Error('Token not found');
    const { branchId } = tokenSnap.data();
    const branchSnap = await tx.get(doc(db, 'branches', branchId));
    const queueLength = Math.max(0, branchSnap.exists() ? (branchSnap.data().queueLength ?? 0) : 0);
    const avgSvcTime = branchSnap.exists() ? (branchSnap.data().avgServiceTime ?? 10) : 10;
    tx.update(tokenRef, {
      scheduledTime: Timestamp.fromDate(newTime),
      isPreScheduled: true,
      position: queueLength,                        // move to end
      estimatedWaitMinutes: queueLength * avgSvcTime,
      createdAt: serverTimestamp(),                  // re-sort to end of queue
    });
  });
}

export async function fetchUserTokenHistory(userId: string): Promise<Token[]> {
  const q = query(
    collection(db, 'tokens'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Token))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export function subscribeToNotifications(userId: string, cb: (notifs: Notification[]) => void) {
  return onSnapshot(collection(db, 'notifications', userId, 'messages'), (snap) => {
    const notifs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Notification))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(notifs);
  });
}

export async function markNotificationRead(userId: string, msgId: string) {
  await updateDoc(doc(db, 'notifications', userId, 'messages', msgId), { read: true });
}

export async function markAllNotificationsRead(userId: string) {
  const q = query(
    collection(db, 'notifications', userId, 'messages'),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  { id: 'zinger_burger',  name: 'Zinger Burger',        description: 'Crispy chicken burger with special Olive sauce',  price: 650,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 520, prepTime: 12 },
  { id: 'beef_burger',    name: 'Classic Beef Burger',   description: 'Juicy beef patty with lettuce, tomato & cheese',  price: 550,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 580, prepTime: 12 },
  { id: 'mushroom_burger',name: 'Mushroom Swiss Burger', description: 'Grilled patty topped with Swiss cheese & mushrooms', price: 700, category: 'Burgers', emoji: '🍔', isAvailable: true, calories: 610, prepTime: 14 },
  { id: 'alfredo_pasta',  name: 'Creamy Alfredo Pasta',  description: 'Rich creamy pasta with mushrooms & parmesan',    price: 750,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 680, prepTime: 15 },
  { id: 'arrabbiata',     name: 'Penne Arrabbiata',      description: 'Spicy tomato sauce with fresh basil & penne',    price: 650,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 540, prepTime: 13 },
  { id: 'bolognese',      name: 'Spaghetti Bolognese',   description: 'Classic slow-cooked meat sauce over spaghetti',  price: 700,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 620, prepTime: 16 },
  { id: 'matcha_latte',   name: 'Iced Matcha Latte',     description: 'Smooth ceremonial matcha with fresh milk & ice', price: 450,  category: 'Drinks',   emoji: '🍵', isAvailable: true, calories: 180, prepTime: 4 },
  { id: 'cappuccino',     name: 'Cappuccino',             description: 'Rich double-shot espresso with silky foamed milk', price: 350, category: 'Drinks',  emoji: '☕', isAvailable: true, calories: 120, prepTime: 3 },
  { id: 'lemonade',       name: 'Fresh Lemonade',         description: 'Chilled freshly squeezed lemonade with mint',   price: 300,  category: 'Drinks',   emoji: '🍋', isAvailable: true, calories: 90,  prepTime: 3 },
  { id: 'bubble_tea',     name: 'Bubble Tea',             description: 'Creamy milk tea with chewy tapioca pearls',      price: 500,  category: 'Drinks',   emoji: '🧋', isAvailable: true, calories: 320, prepTime: 5 },
  { id: 'lotus_cake',     name: 'Lotus Cheesecake',       description: 'Rich New York cheesecake with Biscoff crumb base', price: 550, category: 'Desserts', emoji: '🎂', isAvailable: true, calories: 420, prepTime: 6 },
  { id: 'lava_cake',      name: 'Chocolate Lava Cake',    description: 'Warm chocolate cake with molten fudge center',   price: 500,  category: 'Desserts', emoji: '🍫', isAvailable: true, calories: 480, prepTime: 10 },
  { id: 'creme_brulee',   name: 'Crème Brûlée',           description: 'Classic French vanilla custard with caramel top', price: 480, category: 'Desserts', emoji: '🍮', isAvailable: true, calories: 350, prepTime: 8 },
  { id: 'garlic_bread',   name: 'Garlic Bread',           description: 'Crispy toasted bread with herb garlic butter',   price: 250,  category: 'Snacks',   emoji: '🥖', isAvailable: true, calories: 290, prepTime: 5 },
  { id: 'loaded_fries',   name: 'Loaded Fries',           description: 'Crispy golden fries with cheese sauce & jalapeños', price: 350, category: 'Snacks', emoji: '🍟', isAvailable: true, calories: 460, prepTime: 7 },
  { id: 'caesar_salad',   name: 'Caesar Salad',           description: 'Crisp romaine with Caesar dressing & croutons', price: 400,  category: 'Snacks',   emoji: '🥗', isAvailable: true, calories: 280, prepTime: 5 },
];

const SERVICES = [
  { id: 'dine_in',     name: 'Dine In',     avgServiceTime: 10, isAvailable: true, description: 'Enjoy your meal at the restaurant',   icon: '🍽️' },
  { id: 'takeaway',    name: 'Takeaway',    avgServiceTime: 6,  isAvailable: true, description: 'Order and pick up your food',          icon: '🛍️' },
  { id: 'reservation', name: 'Reservation', avgServiceTime: 5,  isAvailable: true, description: 'Reserve a table for your group',       icon: '📅' },
];

const BRANCHES = [
  {
    id: 'gulberg',
    name: 'Olive Gulberg',
    address: 'Gulberg Greens, F-7/2, Islamabad',
    lat:  33.7215,
    lng:  73.0433,
    staffCount:     4,
    isOpen:         true,
    queueLength:    0,
    avgServiceTime: 10,
    tokenCounter:   100,
    tokenPrefix:    'GUL',
    phone:          '+92 51 123 4567',
    hours:          '11:00 AM – 11:00 PM',
    emoji:          '🍀',
  },
  {
    id: 'f10',
    name: 'Olive F-10 Markaz',
    address: 'F-10 Markaz, Islamabad',
    lat:  33.6996,
    lng:  72.9811,
    staffCount:     3,
    isOpen:         true,
    queueLength:    0,
    avgServiceTime: 9,
    tokenCounter:   100,
    tokenPrefix:    'F10',
    phone:          '+92 51 234 5678',
    hours:          '11:00 AM – 11:00 PM',
    emoji:          '🌿',
  },
  {
    id: 'dha',
    name: 'Olive DHA Phase 2',
    address: 'DHA Phase 2, Rawalpindi',
    lat:  33.5651,
    lng:  73.1219,
    staffCount:     3,
    isOpen:         true,
    queueLength:    0,
    avgServiceTime: 11,
    tokenCounter:   100,
    tokenPrefix:    'DHA',
    phone:          '+92 51 345 6789',
    hours:          '11:00 AM – 10:30 PM',
    emoji:          '🌱',
  },
];

export async function seedBranchesIfEmpty() {
  const snap = await getDocs(collection(db, 'branches'));
  if (!snap.empty) return;

  for (const branch of BRANCHES) {
    const { id, ...data } = branch;
    await setDoc(doc(db, 'branches', id), data);

    for (const svc of SERVICES) {
      const { id: svcId, ...svcData } = svc;
      await setDoc(doc(db, 'branches', id, 'services', svcId), svcData);
    }

    for (const item of MENU_ITEMS) {
      const { id: itemId, ...itemData } = item;
      await setDoc(doc(db, 'branches', id, 'menu', itemId), itemData);
    }
  }
}

/** Count how many pre-scheduled tokens exist for a branch within a 15-min slot window. */
export async function countPreScheduledForSlot(branchId: string, slotTime: Date): Promise<number> {
  const slotStart = new Date(slotTime);
  const slotEnd   = new Date(slotTime.getTime() + 15 * 60 * 1000);
  const q = query(
    collection(db, 'tokens'),
    where('branchId',     '==', branchId),
    where('isPreScheduled','==', true),
    where('status',       'in', ['waiting', 'called']),
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const t = d.data().scheduledTime?.toDate?.();
    return t && t >= slotStart && t < slotEnd;
  }).length;
}

/** Save a customer review for a completed token. */
export async function submitReview(
  tokenId: string,
  branchId: string,
  userId: string,
  rating: number,
  comment: string,
): Promise<void> {
  await addDoc(collection(db, 'reviews'), {
    tokenId,
    branchId,
    userId,
    rating,
    comment: comment.trim(),
    createdAt: serverTimestamp(),
  });
}

/** Re-seed menu items if a branch exists but has no menu. */
export async function seedMenuIfEmpty(branchId: string) {
  const menuSnap = await getDocs(collection(db, 'branches', branchId, 'menu'));
  if (!menuSnap.empty) return;
  for (const item of MENU_ITEMS) {
    const { id: itemId, ...itemData } = item;
    await setDoc(doc(db, 'branches', branchId, 'menu', itemId), itemData);
  }
}

// ─── User profile / avatar ─────────────────────────────────────────────────────

export async function updateUserProfile(uid: string, updates: { name?: string; phone?: string }): Promise<void> {
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
}

/** Persist the avatar base64 data URI (or null to remove) into the user's Firestore doc. */
export async function saveUserAvatar(uid: string, url: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), { avatar: url ?? null }, { merge: true });
}

/** Load the stored avatar URL from Firestore. Returns null if not set. */
export async function loadUserAvatar(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return (snap.data().avatar as string) ?? null;
  } catch {
    return null;
  }
}

export async function ensureUserProfile(uid: string, name: string, email: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    await setDoc(doc(db, 'users', uid), { uid, name, email, createdAt: serverTimestamp() });
  }
}