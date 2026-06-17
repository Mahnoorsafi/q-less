/**
 * reseed.ts
 * Run this once from HomeScreen (or call forceSeedBranches()) to
 * overwrite old Lahore data with the new Islamabad/RWP branches.
 *
 * Safe to call multiple times — it overwrites all branch documents.
 */
import {
  collection, doc, getDocs, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const MENU_ITEMS = [
  { id: 'zinger_burger',   name: 'Zinger Burger',        description: 'Crispy chicken burger with special Olive sauce',     price: 650,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 520 },
  { id: 'beef_burger',     name: 'Classic Beef Burger',   description: 'Juicy beef patty with lettuce, tomato & cheese',     price: 550,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 580 },
  { id: 'mushroom_burger', name: 'Mushroom Swiss Burger', description: 'Grilled patty topped with Swiss cheese & mushrooms', price: 700,  category: 'Burgers',  emoji: '🍔', isAvailable: true, calories: 610 },
  { id: 'alfredo_pasta',   name: 'Creamy Alfredo Pasta',  description: 'Rich creamy pasta with mushrooms & parmesan',        price: 750,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 680 },
  { id: 'arrabbiata',      name: 'Penne Arrabbiata',      description: 'Spicy tomato sauce with fresh basil & penne',        price: 650,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 540 },
  { id: 'bolognese',       name: 'Spaghetti Bolognese',   description: 'Classic slow-cooked meat sauce over spaghetti',      price: 700,  category: 'Pasta',    emoji: '🍝', isAvailable: true, calories: 620 },
  { id: 'matcha_latte',    name: 'Iced Matcha Latte',     description: 'Smooth ceremonial matcha with fresh milk & ice',     price: 450,  category: 'Drinks',   emoji: '🍵', isAvailable: true, calories: 180 },
  { id: 'cappuccino',      name: 'Cappuccino',             description: 'Rich double-shot espresso with silky foamed milk',   price: 350,  category: 'Drinks',   emoji: '☕', isAvailable: true, calories: 120 },
  { id: 'lemonade',        name: 'Fresh Lemonade',         description: 'Chilled freshly squeezed lemonade with mint',        price: 300,  category: 'Drinks',   emoji: '🍋', isAvailable: true, calories: 90  },
  { id: 'bubble_tea',      name: 'Bubble Tea',             description: 'Creamy milk tea with chewy tapioca pearls',          price: 500,  category: 'Drinks',   emoji: '🧋', isAvailable: true, calories: 320 },
  { id: 'lotus_cake',      name: 'Lotus Cheesecake',       description: 'Rich NY cheesecake with Lotus Biscoff crumb base',   price: 550,  category: 'Desserts', emoji: '🎂', isAvailable: true, calories: 420 },
  { id: 'lava_cake',       name: 'Chocolate Lava Cake',    description: 'Warm chocolate cake with molten fudge center',       price: 500,  category: 'Desserts', emoji: '🍫', isAvailable: true, calories: 480 },
  { id: 'creme_brulee',    name: 'Crème Brûlée',           description: 'Classic French vanilla custard with caramel top',    price: 480,  category: 'Desserts', emoji: '🍮', isAvailable: true, calories: 350 },
  { id: 'garlic_bread',    name: 'Garlic Bread',           description: 'Crispy toasted bread with herb garlic butter',       price: 250,  category: 'Snacks',   emoji: '🥖', isAvailable: true, calories: 290 },
  { id: 'loaded_fries',    name: 'Loaded Fries',           description: 'Crispy golden fries with cheese sauce & jalapeños',  price: 350,  category: 'Snacks',   emoji: '🍟', isAvailable: true, calories: 460 },
  { id: 'caesar_salad',    name: 'Caesar Salad',           description: 'Crisp romaine with Caesar dressing & croutons',      price: 400,  category: 'Snacks',   emoji: '🥗', isAvailable: true, calories: 280 },
];

const SERVICES = [
  { id: 'dine_in',     name: 'Dine In',     avgServiceTime: 10, isAvailable: true, description: 'Enjoy your meal at the restaurant',   icon: '🍽️' },
  { id: 'takeaway',    name: 'Takeaway',    avgServiceTime: 6,  isAvailable: true, description: 'Order and pick up your food',          icon: '🛍️' },
  { id: 'reservation', name: 'Reservation', avgServiceTime: 5,  isAvailable: true, description: 'Reserve a table for your group',       icon: '📅' },
];

const BRANCHES = [
  { id: 'gulberg', name: 'Olive Gulberg',     address: 'Gulberg Greens, F-7/2, Islamabad', lat: 33.7215, lng: 73.0433, staffCount: 4, isOpen: true, queueLength: 0, avgServiceTime: 10, tokenCounter: 100, tokenPrefix: 'GUL', phone: '+92 51 123 4567', hours: '11:00 AM – 11:00 PM', emoji: '🍀' },
  { id: 'f10',     name: 'Olive F-10 Markaz', address: 'F-10 Markaz, Islamabad',           lat: 33.6996, lng: 72.9811, staffCount: 3, isOpen: true, queueLength: 0, avgServiceTime:  9, tokenCounter: 100, tokenPrefix: 'F10', phone: '+92 51 234 5678', hours: '11:00 AM – 11:00 PM', emoji: '🌿' },
  { id: 'dha',     name: 'Olive DHA Phase 2', address: 'DHA Phase 2, Rawalpindi',          lat: 33.5651, lng: 73.1219, staffCount: 3, isOpen: true, queueLength: 0, avgServiceTime: 11, tokenCounter: 100, tokenPrefix: 'DHA', phone: '+92 51 345 6789', hours: '11:00 AM – 10:30 PM', emoji: '🌱' },
];

/**
 * Wipes all branch data and reseeds with Islamabad/RWP locations.
 * Call once from a dev/debug screen.
 */
export async function forceSeedBranches() {
  // Delete old branch docs
  const oldSnap = await getDocs(collection(db, 'branches'));
  for (const d of oldSnap.docs) {
    await deleteDoc(d.ref);
  }

  // Write new branches + services + menu
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