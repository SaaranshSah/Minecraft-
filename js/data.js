/* ============================================================
   data.js — static configuration: modes, difficulties, defaults
   ============================================================ */

export const SLOT_COUNT = 9;

export const DEFAULT_LOADOUT = ['sword', 'pickaxe', 'axe', 'bow', 'apple', 'pearl', 'potion', 'cobble', 'bucket'];

/**
 * Community PvP hotbar layouts. Each preset fills all nine slots; picking one
 * replaces the loadout, and individual slots can still be swapped afterwards.
 */
export const HOTBAR_PRESETS = [
  {
    id: 'starter',
    name: 'Starter Kit',
    tag: 'Default',
    blurb: 'The balanced loadout the trainer ships with.',
    slots: ['sword', 'pickaxe', 'axe', 'bow', 'apple', 'pearl', 'potion', 'cobble', 'bucket'],
  },
  {
    id: 'classic',
    name: 'Classic PvP',
    tag: 'Balanced',
    blurb: 'Best for all-round PvP — sword, gapple, pearls and pots.',
    slots: ['sword', 'apple', 'pearl', 'potion', 'pickaxe', 'bucket', 'cobble', 'totem', 'carrot'],
  },
  {
    id: 'swordpearl',
    name: 'Sword & Pearl',
    tag: 'Aggressive',
    blurb: 'Instant pressure — pearls in slot 2, gapple right behind.',
    slots: ['sword', 'pearl', 'apple', 'potion', 'pickaxe', 'cobble', 'bucket', 'totem', 'carrot'],
  },
  {
    id: 'rush',
    name: 'Rush Hotbar',
    tag: 'Fast combos',
    blurb: 'Sword, axe and bow up front for 1v1 fights.',
    slots: ['sword', 'axe', 'bow', 'apple', 'pearl', 'pickaxe', 'bucket', 'cobble', 'totem'],
  },
  {
    id: 'crystal',
    name: 'Crystal PvP',
    tag: 'Advanced',
    blurb: 'Crystals and obsidian — keep the water bucket close.',
    slots: ['sword', 'pearl', 'apple', 'obsidian', 'crystal', 'bucket', 'totem', 'pickaxe', 'cobble'],
  },
  {
    id: 'bedrock',
    name: 'Bedrock Edition',
    tag: 'Survival',
    blurb: 'Lava-bucket clutches and simple, effective survival PvP.',
    slots: ['sword', 'axe', 'bow', 'apple', 'pearl', 'potion', 'pickaxe', 'lava', 'cobble'],
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    tag: 'Combo + crystal',
    blurb: 'Both worlds — sword combo pressure plus a crystal slot.',
    slots: ['sword', 'pearl', 'apple', 'crystal', 'potion', 'bucket', 'cobble', 'totem', 'obsidian'],
  },
  {
    id: 'cart',
    name: 'Cart PvP',
    tag: 'Blocks',
    blurb: 'Block-heavy minecart pressure with a bow fallback.',
    slots: ['sword', 'cobble', 'bow', 'pickaxe', 'totem', 'apple', 'pearl', 'obsidian', 'bucket'],
  },
  {
    id: 'uhc',
    name: 'UHC',
    tag: 'No regen',
    blurb: 'No natural regen — lava, shovel and a careful gapple.',
    slots: ['sword', 'cobble', 'shovel', 'apple', 'pearl', 'bucket', 'lava', 'bow', 'totem'],
  },
  {
    id: 'smp',
    name: 'SMP',
    tag: 'All-round',
    blurb: 'Trident, cobwebs and snowballs for chaotic servers.',
    slots: ['sword', 'trident', 'shovel', 'pickaxe', 'apple', 'pearl', 'cobweb', 'snowball', 'totem'],
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    tag: 'Clean & fast',
    blurb: 'Fewer distractions, faster switching — high CPS.',
    slots: ['sword', 'bow', 'apple', 'pearl', 'pickaxe', 'cobble', 'totem', 'carrot', 'bucket'],
  },
];

/** Which preset (if any) exactly matches a loadout. */
export function findPreset(loadout) {
  if (!Array.isArray(loadout)) return null;
  const key = loadout.join('|');
  return HOTBAR_PRESETS.find((preset) => preset.slots.join('|') === key) || null;
}

export const DEFAULT_BINDS = {
  slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'],
  actions: {
    attack: 'MouseLeft',
    use: 'MouseRight',
    prev: 'WheelUp',
    next: 'WheelDown',
    drop: 'KeyQ',
    inventory: 'KeyE',
    reset: 'KeyR',
    swap: 'KeyF',
  },
};

export const ACTION_DEFS = [
  { id: 'attack', label: 'Attack', desc: 'Left click swing animation', icon: 'sword' },
  { id: 'use', label: 'Use item', desc: 'Right click / eat / place', icon: 'apple' },
  { id: 'prev', label: 'Previous slot', desc: 'Walks the hotbar backwards', icon: 'arrowUp' },
  { id: 'next', label: 'Next slot', desc: 'Walks the hotbar forwards', icon: 'arrowUp' },
  { id: 'drop', label: 'Drop item', desc: 'Cosmetic drop feedback', icon: 'cobble' },
  { id: 'inventory', label: 'Inventory', desc: 'Quick inventory flash', icon: 'book' },
  { id: 'reset', label: 'Skip target', desc: 'Counts as a miss, issues a new target', icon: 'pearl' },
  { id: 'swap', label: 'Swap hands', desc: 'Off-hand flourish', icon: 'shield' },
];

export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'veryhard', 'extreme'];

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    bars: 1,
    window: 2200,
    length: 2,
    gap: 560,
    ramp: 0.05,
    pool: 'near',
    blurb: 'Slow switching, long reaction windows, basic adjacent combinations.',
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    bars: 2,
    window: 1500,
    length: 3,
    gap: 440,
    ramp: 0.06,
    pool: 'mixed',
    blurb: 'Moderate speed with more varied PvP-style sequences.',
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    bars: 3,
    window: 1050,
    length: 4,
    gap: 330,
    ramp: 0.07,
    pool: 'random',
    blurb: 'Faster sequences, randomized slot switching, shorter windows.',
  },
  veryhard: {
    id: 'veryhard',
    name: 'Very Hard',
    bars: 4,
    window: 780,
    length: 5,
    gap: 250,
    ramp: 0.08,
    pool: 'random',
    blurb: 'Rapid switching, complex randomized combinations.',
  },
  extreme: {
    id: 'extreme',
    name: 'Extreme',
    bars: 5,
    window: 560,
    length: 6,
    gap: 180,
    ramp: 0.09,
    pool: 'random',
    blurb: 'Very fast, unpredictable combinations. Pure muscle memory.',
  },
};

export const DEFAULT_CUSTOM = {
  mode: 'sequence', // 'sequence' | 'freestyle'
  window: 1300,
  length: 4,
  gap: 320,
  ramp: true,
  pool: 'mixed',
  slots: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  challenge: true,
  rate: 1500,
  lifetime: 2000,
};

export const DEFAULT_FREESTYLE = {
  challenge: false,
  rate: 1600,
  lifetime: 2200,
};

export const DEFAULT_TENHEARTS = {
  challenge: true,
  rate: 1700,
  lifetime: 2600,
};

export const DEFAULT_SETTINGS = {
  sfx: true,
  volume: 0.6,
  animations: true,
  particles: true,
  hudScale: 1,
  theme: 'nether',
  keyLabels: true,
  blockShortcuts: true,
  flashErrors: true,
};

export const MODE_META = {
  freestyle: { label: 'Freestyle', sub: 'Warm-up · no forced sequence', pill: 'free', infinite: true },
  training: { label: 'Difficulty Training', sub: 'Progressive sequences', pill: 'train' },
  tenhearts: { label: '10-Heart Mode', sub: 'No timer · no damage · endless', pill: 'heart', infinite: true },
  custom: { label: 'Custom Practice', sub: 'Your drill, your rules', pill: 'custom' },
};

export const MODE_LABELS = {
  freestyle: 'Freestyle',
  training: 'Difficulty',
  tenhearts: '10-Heart',
  custom: 'Custom',
};

export const MIN_WINDOW = 300;
export const MAX_WINDOW = 4000;

/** Sequence generation pools. */
export const POOL_LABELS = {
  near: 'Adjacent slots',
  mixed: 'Mixed distances',
  random: 'Fully random',
};
