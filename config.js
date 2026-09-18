/**
 * config.js
 * Static configuration only — no app state lives here.
 *
 * Categories are now fully dynamic (user-created/renamed/deleted), so
 * instead of hardcoding a color per category name, we cycle new
 * categories through a fixed palette of "slots". Each slot is a single
 * hex color; hexToRgba() derives a soft translucent tint from it at
 * render time, so we never need a matching CSS class per category.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ICON_CHOICES = ['⌨️','📊','💻','📱','🎬','🚿','🚶‍♀️','🌙','🍽️','🥛','📖','💧','🧘','😴','🏃','🍎','🥗','☕','✍️','🎯','💪','🌅','🔔','🧹','✨','💰','🎨','📞','🛏️','📈','🧠','🗂️','🏋️','🚴','🎓'];

const CATEGORY_ICON_CHOICES = ['📚','💚','🔁','🍎','✨','💼','🏋️','💰','🧠','🎨','🧘','📈','🏠','🎯','🗂️','🌱'];

// Muted, premium-palette-safe accent colors that new categories cycle through.
const COLOR_SLOTS = [
  '#5B3A8E', // royal purple
  '#6F9278', // sage
  '#C9A227', // champagne gold
  '#7C5AA6', // plum
  '#A15C6B', // dusty rose
  '#4A7C7C', // deep teal
  '#B08D2A', // amber
  '#5C6B8C'  // slate blue
];

function colorForIndex(i) {
  return COLOR_SLOTS[i % COLOR_SLOTS.length];
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Seed data used ONLY the first time defaultState() builds a brand-new
// challenge. These are not special-cased anywhere else in the app —
// the user can rename, recolor, hide, reorder, or delete every one of
// them exactly like any category they create themselves.
const DEFAULT_CATEGORY_SEED = [
  { name: 'Learning', icon: '📚' },
  { name: 'Health', icon: '💚' },
  { name: 'Habits', icon: '🔁' },
  { name: 'Food', icon: '🍎' }
];

const DEFAULT_TASK_SEED = {
  // keyed by seed category name above — only used at first-run
  'Learning': [
    ['⌨️', 'Typing Practice', '10:30 AM', '15 min'],
    ['💻', 'Freelancing + Lunch', '11:00 AM', '3 hr'],
    ['📊', 'Data Analytics Practice', '3:00 PM', '1 hr'],
    ['📱', 'Affiliate Marketing', '5:00 PM', '1 hr'],
    ['🎬', 'AI Video Creation', '6:00 PM', '1 hr']
  ],
  'Health': [
    ['🚿', 'Fresh Up', '4:00 PM', '1 hr'],
    ['🌙', 'Mild Relaxation', '8:00 PM', '1 hr'],
    ['🚶‍♀️', 'Light Exercise', '9:00 PM', '1 hr']
  ],
  'Habits': [
    ['🌅', 'Wake Up', '7:30 AM', '']
  ],
  'Food': [
    ['🥛', 'Buttermilk', '10:45 AM', ''],
    ['🍽️', 'Dinner', '7:00 PM', '1 hr']
  ]
};

const DEFAULT_MILESTONES = [
  { day: 1,   icon: '🌱', label: 'Started' },
  { day: 10,  icon: '🌿', label: 'First 10' },
  { day: 25,  icon: '🌳', label: 'Quarter' },
  { day: 50,  icon: '🏆', label: 'Halfway' },
  { day: 75,  icon: '🔥', label: '75 Days' },
  { day: 100, icon: '👑', label: 'Complete' }
];

const DEFAULT_OVERVIEW = {
  title: '🌱 100 Days Challenge',
  subtitle: 'Small Steps. Every Single Day.',
  goal: ''
};
