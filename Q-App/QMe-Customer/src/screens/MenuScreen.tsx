import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, TextInput, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToMenuItems, generateToken, Branch, MenuItem, OrderItem,
} from '../services/firebaseService';
import { getWaitTime, estimateWaitFallback } from '../services/aiService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const CATEGORIES = ['All', 'Burgers', 'Pasta', 'Drinks', 'Desserts', 'Snacks'] as const;

// Fallback prep times per category (minutes) used when item.prepTime is not set
const CATEGORY_PREP: Record<string, number> = {
  Burgers: 12, Pasta: 15, Drinks: 4, Desserts: 8, Snacks: 6,
};

function parseBranchClosingHour(hours: string | undefined): number {
  if (!hours) return 21;
  const m = hours.match(/[–\-]\s*(\d+):\d+\s*(AM|PM)/i);
  if (!m) return 21;
  let h = parseInt(m[1], 10);
  if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[2].toUpperCase() === 'AM' && h === 12) h = 0;
  return h;
}

export default function MenuScreen() {
  const navigation    = useNavigation<any>();
  const route         = useRoute<any>();
  const { user }      = useAuth();

  const branch: Branch   = route.params?.branch;
  const serviceType: string = route.params?.serviceType ?? 'Dine In';
  const serviceId: string   = route.params?.serviceId   ?? 'dine_in';

  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [category, setCategory]     = useState<string>('All');
  const [search, setSearch]         = useState('');
  const [cart, setCart]             = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [menuError, setMenuError]   = useState<string | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showMenuError(msg: string) {
    setMenuError(msg);
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setMenuError(null), 4000);
    if (Platform.OS !== 'web') Alert.alert('Notice', msg);
  }

  useEffect(() => {
    const unsub = subscribeToMenuItems(branch.id, (items) => {
      setMenuItems(items);
      setLoading(false);
    });
    return unsub;
  }, [branch.id]);

  // Show ALL items — unavailable ones are grayed out rather than hidden
  const filtered = menuItems
    .filter((it) => {
      const matchCat = category === 'All' || it.category === category;
      const matchSearch = !search.trim() || it.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      return 0;
    });

  function addToCart(itemId: string) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = { ...prev };
      if ((next[itemId] ?? 0) > 1) {
        next[itemId] -= 1;
      } else {
        delete next[itemId];
      }
      return next;
    });
  }

  const cartItems: OrderItem[] = Object.entries(cart)
    .map(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === itemId);
      if (!item) return null;
      return { itemId, name: item.name, price: item.price, qty };
    })
    .filter(Boolean) as OrderItem[];

  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  // Production time estimate — only relevant for Takeaway
  // = (sum of each item's prepTime × qty) divided by active staff (parallel cooking)
  // + fraction of current queue wait to account for orders already in progress
  const isTakeaway = serviceType === 'Takeaway';
  const productionEstimate: number = (() => {
    if (!isTakeaway || cartItems.length === 0) return 0;
    const orderPrepTime = cartItems.reduce((sum, oi) => {
      const item = menuItems.find((m) => m.id === oi.itemId);
      const pt   = item?.prepTime ?? CATEGORY_PREP[item?.category ?? ''] ?? 10;
      return sum + pt * oi.qty;
    }, 0);
    const staff = Math.max(branch.staffCount ?? 1, 1);
    // Parallel cooking: divide total item prep time by staff, then add a fraction of queue backlog
    const queueBacklog = Math.round((branch.queueLength ?? 0) * (branch.avgServiceTime ?? 8) / staff / 2);
    return Math.max(5, Math.ceil(orderPrepTime / staff) + queueBacklog);
  })();

  async function handleGetToken() {
    if (!user) {
      showMenuError('Please log in to get a token.');
      return;
    }
    if (isTakeaway && cartItems.length === 0) {
      showMenuError('Please add at least one item to your order before getting a token.');
      return;
    }
    setGenerating(true);
    try {
      let estimatedWait = 10;
      try {
        const r = await getWaitTime(branch.id, branch.queueLength, branch.avgServiceTime, branch.staffCount);
        estimatedWait = r.estimated_wait_minutes;
      } catch {
        const fb = estimateWaitFallback(branch.queueLength, branch.avgServiceTime);
        estimatedWait = fb.estimated_wait_minutes;
      }

      // Use actual branch closing hour, not a hardcoded constant
      const closingHour = parseBranchClosingHour(branch.hours);
      const now = new Date();
      if (now.getHours() >= closingHour) {
        showMenuError('This branch is closed for the day. Please pre-schedule for another day.');
        setGenerating(false);
        return;
      }
      const closingTime = new Date(now);
      closingTime.setHours(closingHour, 0, 0, 0);
      if (new Date(now.getTime() + estimatedWait * 60 * 1000) > closingTime) {
        showMenuError('The queue may extend past closing time. Please pre-schedule for another day.');
        setGenerating(false);
        return;
      }

      const newToken = await generateToken({
        userId:               user.uid,
        userName:             user.name,
        branchId:             branch.id,
        branchName:           branch.name,
        serviceId,
        serviceName:          serviceType,
        serviceType,
        estimatedWaitMinutes:    estimatedWait,
        estimatedProductionTime: isTakeaway && productionEstimate > 0 ? productionEstimate : undefined,
        orderItems:           cartItems,
        orderTotal:           cartTotal,
      });

      navigation.navigate('TokenStatus', { tokenId: newToken.id, token: newToken });
    } catch (err: any) {
      showMenuError(`Could not generate token — ${err?.message ?? 'check your connection and try again.'}`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <AppHeader subtitle={`Browse Menu · ${branch.name}`} showBack showProfile={false} />

      {/* Inline error banner */}
      {menuError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️  {menuError}</Text>
        </View>
      )}

      {/* Service type toggle */}
      <View style={styles.serviceToggleRow}>
        <Text style={styles.serviceTypeChip}>{serviceType === 'Dine In' ? '🍽️' : '🛍️'} {serviceType}</Text>
        <Text style={styles.branchChip}>📍 {branch.name.replace('Olive ', '')}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search food items…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category filter */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
          alwaysBounceHorizontal={false}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Menu items grid */}
      <FlatList<MenuItem>
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        numColumns={1}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySub}>Try a different category or search term</Text>
          </View>
        }
        renderItem={({ item }) => {
          const qty         = cart[item.id] ?? 0;
          const unavailable = !item.isAvailable;
          return (
            <View style={styles.menuCard}>
              <View style={styles.menuIconWrap}>
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.menuInfo}>
                <View style={styles.menuNameRow}>
                  <Text style={styles.menuName}>{item.name}</Text>
                </View>
                <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.menuBottom}>
                  <Text style={styles.menuPrice}>Rs. {item.price.toLocaleString()}</Text>
                  {item.calories && (
                    <Text style={styles.menuCal}>{item.calories} kcal</Text>
                  )}
                </View>
              </View>
              {!unavailable && (
                <View style={styles.qtyControl}>
                  {qty > 0 ? (
                    <>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyNum}>{qty}</Text>
                    </>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.addBtn, qty > 0 && styles.addBtnActive]}
                    onPress={() => addToCart(item.id)}
                  >
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Frosted overlay — item visible through fog, tap shows reason */}
              {unavailable && (
                <TouchableOpacity
                  style={[
                    styles.unavailableOverlay,
                    Platform.OS === 'web'
                      ? ({ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as any)
                      : null,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => showMenuError(`${item.name} is currently not available at this branch.`)}
                >
                  <View style={styles.unavailablePill}>
                    <Text style={styles.unavailablePillText}>🚫 Not Available</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Persistent footer */}
      <View style={styles.cartFooter}>
        <View style={styles.cartInfo}>
          {cartCount > 0 ? (
            <>
              <Text style={styles.cartCount}>{cartCount} item{cartCount !== 1 ? 's' : ''} · Rs. {cartTotal.toLocaleString()}</Text>
              {isTakeaway && productionEstimate > 0 ? (
                <View style={styles.prodEstRow}>
                  <Text style={styles.prodEstLabel}>🕐 Estimated ready in </Text>
                  <Text style={styles.prodEstValue}>~{productionEstimate} min</Text>
                </View>
              ) : (
                <Text style={styles.cartTotal}>Rs. {cartTotal.toLocaleString()}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.cartCount}>No items selected{isTakeaway ? '' : ' (optional)'}</Text>
              <Text style={styles.cartHint}>
                {isTakeaway ? 'Add items to see your estimated ready time' : 'You can join the queue without ordering'}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[styles.tokenBtn, generating && styles.disabledBtn]}
          onPress={handleGetToken}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.tokenBtnText}>{isTakeaway ? '🎫 Get Token' : '🎫 Join Queue'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:          { flex: 1, backgroundColor: COLORS.background },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  serviceToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface, gap: 8 },
  serviceTypeChip:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primaryBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  branchChip:       { fontSize: FONT.sm, color: COLORS.textSecondary },

  searchWrap:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, marginBottom: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, ...SHADOW.sm },
  searchIcon:     { fontSize: 16, marginRight: 8 },
  searchInput:    { flex: 1, fontSize: FONT.md, color: COLORS.textPrimary },

  categoryBar:     { height: 58, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.separator, justifyContent: 'center' },
  categoryContent: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catChip:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryBg, borderWidth: 1.5, borderColor: COLORS.primaryLight },
  catChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText:         { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  catTextActive:   { color: '#FFFFFF' },

  listContent:    { paddingHorizontal: 16, paddingBottom: 120 },
  emptyWrap:      { alignItems: 'center', paddingTop: 60 },
  emptyEmoji:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: FONT.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptySub:       { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 4 },

  menuCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, overflow: 'hidden', ...SHADOW.sm },
  menuIconWrap:   { width: 54, height: 54, borderRadius: 12, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  menuEmoji:      { fontSize: 26 },
  menuInfo:       { flex: 1, minWidth: 0 },
  menuName:       { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  menuDesc:       { fontSize: FONT.xs, color: COLORS.textSecondary, lineHeight: 16, marginBottom: 6, flexShrink: 1 },
  menuBottom:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  menuPrice:      { fontSize: FONT.sm, fontWeight: '800', color: COLORS.primary },
  menuCal:        { fontSize: FONT.xs, color: COLORS.textMuted },

  qtyControl:     { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  qtyBtn:         { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.errorBg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:     { fontSize: 18, fontWeight: '700', color: COLORS.error, lineHeight: 22 },
  qtyNum:         { fontSize: FONT.sm, fontWeight: '800', color: COLORS.textPrimary, minWidth: 16, textAlign: 'center' },
  addBtn:         { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  addBtnActive:   { backgroundColor: COLORS.primary },
  addBtnText:     { fontSize: 20, fontWeight: '700', color: COLORS.primary, lineHeight: 24 },

  cartFooter:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 22, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.lg, gap: 10 },
  cartInfo:       { flex: 1, minWidth: 0 },
  cartCount:      { fontSize: FONT.xs, color: COLORS.textSecondary },
  cartTotal:      { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary },
  tokenBtn:       { paddingVertical: 13, paddingHorizontal: 18, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, ...SHADOW.md, flexShrink: 0 },
  tokenBtnText:   { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.sm },
  disabledBtn:    { opacity: 0.6 },

  cartHint:        { fontSize: FONT.xs, color: COLORS.textMuted, marginTop: 2 },
  prodEstRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  prodEstLabel:    { fontSize: FONT.xs, color: COLORS.textSecondary },
  prodEstValue:    { fontSize: FONT.sm, fontWeight: '800', color: COLORS.primary },

  errorBanner:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.errorBg, borderRadius: RADIUS.md, padding: 12, marginHorizontal: 16, marginTop: 8, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  errorBannerText:     { color: COLORS.error, fontWeight: '600', fontSize: FONT.sm, flex: 1 },

  menuNameRow:        { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 },

  unavailableOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(245,240,232,0.62)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  unavailablePill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  unavailablePillText: { fontSize: FONT.sm, fontWeight: '800', color: COLORS.error },
});