/* ============================================================
   pixelart.js — Minecraft-style pixel icons, generated as SVG
   Every icon is a character grid rendered into merged <rect> runs,
   so it stays razor sharp at any HUD scale.
   ============================================================ */

export const PALETTE = {
  k: '#101010', // outline
  w: '#ffffff',
  W: '#e4e4e4',
  g: '#c2c2c2',
  G: '#8f8f8f',
  d: '#5a5a5a',
  D: '#333333',
  s: '#9a9a9a',
  S: '#6e6e6e',
  c: '#7ff7e4',
  C: '#37ccb6',
  B: '#1c8b7c',
  E: '#0f6f60',
  b: '#8a5a2f',
  n: '#c99a5e',
  N: '#5c3a1c',
  y: '#ffd94a',
  Y: '#d9a017',
  r: '#e33b2e',
  R: '#a31f18',
  p: '#b578ee',
  P: '#5b2a91',
  o: '#ff9a3c',
  l: '#8ee05a',
  e: '#4e9e2a',
  t: '#4fa3ef',
  T: '#2a5fc0',
  h: '#e6b58f',
  m: '#ff7fbf',
  i: '#454545',
};

/* character grids: '.' = transparent */
const RAW = {
  /* ---- logo: grass block ---- */
  logo: [
    'kkkkkkkkkkkkkkkk',
    'klllllllllllllek',
    'klelelelelelelek',
    'klllllllllllllek',
    'keleleleleleleik',
    'kkkkkkkkkkkkkkkk',
    'kbbnbbbnbbbnbbbk',
    'kbnbbbnbbbnbbnbk',
    'kbbnbbbnbbbnbbbk',
    'kbnbbbnbbbnbbnbk',
    'kbbnbbbnbbbnbbbk',
    'kbnbbbnbbbnbbnbk',
    'kbbnbbbnbbbnbbbk',
    'kbnbbbnbbbnbbnbk',
    'kbbnbbbnbbbnbbbk',
    'kkkkkkkkkkkkkkkk',
  ],

  /* ---- diamond sword ---- */
  sword: [
    '.............kk.',
    '............kcCk',
    '...........kcCCk',
    '..........kcCCk.',
    '.........kcCCk..',
    '........kcCCk...',
    '.......kcCCk....',
    '......kcCCk.....',
    '.....kcCCk......',
    '....kcCCk.......',
    '...kyyyyk.......',
    '..kykkkyk.......',
    '.knyk.kbk.......',
    'knyk..kbk.......',
    'knk...kk........',
    'kk..............',
  ],

  /* ---- diamond pickaxe ---- */
  pickaxe: [
    '................',
    '....kkkkkkkk....',
    '..kkccccccccckk.',
    '.kcccCCCCCCCccck',
    '.kCkkkkkkkkkkkCk',
    '.kCk...kbk...kCk',
    '.kkk...kbk...kkk',
    '.......kbk......',
    '......kbk.......',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '..kbk...........',
    '.kbk............',
    '.kk.............',
    '................',
  ],

  /* ---- iron axe ---- */
  axe: [
    '................',
    '...kkkkkkk......',
    '..kccccccck.....',
    '.kccCCCCCCCk....',
    '.kcCCCCCCCCk....',
    '.kccCCCCCCk.....',
    '..kccccccck.....',
    '...kkkkkkbkk....',
    '........kbk.....',
    '........kbk.....',
    '........kbk.....',
    '........kbk.....',
    '........kbk.....',
    '........kkk.....',
    '................',
    '................',
  ],



  /* ---- bow ---- */
  bow: [
    '.....kkkk.......',
    '....kbbbbk......',
    '...kbnnkbbk.....',
    '..kbnnk..wk.....',
    '..kbnk...wk.....',
    '.kbnk...wk......',
    '.kbnk..wk.......',
    '.kbnk..wk.......',
    '.kbnk..wk.......',
    '.kbnk..wk.......',
    '.kbnk...wk......',
    '..kbnk...wk.....',
    '..kbnnk..wk.....',
    '...kbnnkwwk.....',
    '....kbbbbk......',
    '.....kkkk.......',
  ],

  /* ---- golden apple ---- */
  apple: [
    '................',
    '.......kk.......',
    '.......kbk..kk..',
    '.......kbk.kllk.',
    '....kkkbbkkllk..',
    '...kyyyyyyyykk..',
    '..kyYyyyyyyyyk..',
    '.kyYyyyyyyyyyyk.',
    '.kyyWyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '....kkkkkkkk....',
    '................',
  ],

  /* ---- ender pearl ---- */
  pearl: [
    '......kkkk......',
    '....kkcccCkk....',
    '...kcCllllCck...',
    '..kcClleeeelCk..',
    '..kClleeEEeelCk.',
    '.kcCllEEEEEElCk.',
    '.kcCleEEEEEEelCk',
    '.kcCleEEEEEEelCk',
    '.kcCleEEEEEEelCk',
    '..kClleEEEEllCk.',
    '..kcClleeeellCk.',
    '...kccCllllCck..',
    '....kkccCCkk....',
    '......kkkk......',
    '................',
    '................',
  ],

  /* ---- splash potion ---- */
  potion: [
    '......kkk.......',
    '......kGk.......',
    '......kGk.......',
    '.....kkGkk......',
    '....kGGGGGk.....',
    '....kGkkkGk.....',
    '...kGk...kGk....',
    '...kGk...kGk....',
    '..kGGk...kGGk...',
    '..kGrrrrrrrGk...',
    '.kGrrrrwrrrrGk..',
    '.kGrrrrrrrrrGk..',
    '.kGrrrrrrrrrGk..',
    '..kGrrrrrrrGk...',
    '...kkkkkkkkk....',
    '................',
  ],

  /* ---- cobblestone ---- */
  cobble: [
    'kkkkkkkkkkkkkkkk',
    'kSsssssSsssssssk',
    'kssSsgssssSssssk',
    'ksssSsssSsssgSsk',
    'kSssGssssssssSsk',
    'ksssSssssSsssSsk',
    'kssssssssSssssSk',
    'kSssSssssgssSssk',
    'ksssssSssssssssk',
    'kssSssGsssSsssSk',
    'ksssssssSsssssgk',
    'kSsssssssssSsssk',
    'ksssSsssSsssSssk',
    'ksssssssgssssSsk',
    'kssSssssssssssSk',
    'kkkkkkkkkkkkkkkk',
  ],

  /* ---- water bucket ---- */
  bucket: [
    '................',
    '..kkkkkkkkkkk...',
    '.kgggggggggggk..',
    '.kgtttttttttgk..',
    '.kgTtttTttttgk..',
    '.kgtttttttttgk..',
    '.kgtTtttTtttgk..',
    '.kgggggggggggk..',
    '..kgggggggggk...',
    '..kGgggggggGk...',
    '...kGgggggGk....',
    '...kGgggggGk....',
    '....kGgggGk.....',
    '....kGGGGGk.....',
    '.....kkkkk......',
    '................',
  ],

  /* ---- arrows ---- */
  arrows: [
    '............kk..',
    '...........kggk.',
    '..........kgGgk.',
    '.........kgGgk..',
    '........kgGgk...',
    '.......kgGgk....',
    '......kgGgk.....',
    '.....kgGgk......',
    '....kgGgk.......',
    '...kgGgk........',
    '..kkGGkk........',
    '.kwwkGk.........',
    'kwwwkkk.........',
    '.kwwk...........',
    '..kwk...........',
    '...k............',
  ],

  /* ---- shield ---- */
  shield: [
    '..kkkkkkkkkkk...',
    '.kbbbbbbbbbbbk..',
    'kbGGGGGGGGGGGbk.',
    'kbGsssssssssGbk.',
    'kbGsSSSSSSSsGbk.',
    'kbGsSsssssSsGbk.',
    'kbGsSsSSsSsGbk..',
    'kbGsSsSSsSsGbk..',
    'kbGsSsssssSsGbk.',
    'kbGsSSSSSSSsGbk.',
    '.kbGsssssssGbk..',
    '.kbbGGGGGGGbbk..',
    '..kbbbbbbbbbk...',
    '...kbbbbbbbk....',
    '....kbbbbbk.....',
    '.....kkkkk......',
  ],

  /* ---- golden carrot ---- */
  carrot: [
    '................',
    '..........kkk...',
    '.........kllek..',
    '........klllek..',
    '.......kllelk...',
    '......kllelk....',
    '.....koolk......',
    '....koook.......',
    '...koyyok.......',
    '..koyyyyok......',
    '.koyyyyyok......',
    'koyyyyyk........',
    'koyyyyk.........',
    'kyyyyk..........',
    '.kkkk...........',
    '................',
  ],

  /* ---- diamond ---- */
  diamond: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kcccccccck...',
    '..kcCccccCCck...',
    '..kcCCccCCCck...',
    '...kcCCCCCCk....',
    '....kcCCCCk.....',
    '.....kcCCk......',
    '......kck.......',
    '.......k........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],

  /* ---- enchanted book ---- */
  book: [
    '................',
    '...kkkkkkkkkk...',
    '..kPPPPPPPPPPk..',
    '.kPppppppppppPk.',
    '.kPpwwwwwwwwpPk.',
    '.kPpwwwwwwwwpPk.',
    '.kPpwwwwwwwwpPk.',
    '.kPpwwwwwwwwpPk.',
    '.kPpwwwwwwwwpPk.',
    '.kPppppppppppPk.',
    '.kPPPPPPPPPPPPk.',
    '..kSSSSSSSSSSk..',
    '..kSSSSSSSSSSk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
};

/* non-square sprites */
const RAW_SMALL = {
  /* full heart 9x9 */
  heart: [
    '..kk.kk..',
    '.krrkrrk.',
    'krwrrrrrk',
    'krrrrrrrk',
    '.krrrrrk.',
    '..krrrk..',
    '...krk...',
    '....k....',
    '.........',
  ],
  /* empty heart 9x9 */
  heartEmpty: [
    '..kk.kk..',
    '.kDDkDDk.',
    'kDDDDDDDk',
    'kDDDDDDDk',
    '.kDDDDDk.',
    '..kDDDk..',
    '...kDk...',
    '....k....',
    '.........',
  ],
  /* drumstick 9x9 */
  hunger: [
    '....kkkk.',
    '...knnnnk',
    '..knoNnnk',
    '..knnnnnk',
    '.knnnnk..',
    '.knnkk...',
    'kWwkk....',
    'kwwk.....',
    '.kk......',
  ],
  hungerEmpty: [
    '......kk.',
    '.....kDDk',
    '....kDDDk',
    '...kDDDDk',
    '..kDDDDk.',
    '.kDDDDk..',
    'kDDDkk...',
    'kDDk.....',
    '.kk......',
  ],
  /* tiny arrow used inside prompts */
  up: [
    '...k...',
    '..kkk..',
    '.kkkkk.',
    'kkkkkkk',
    '...k...',
    '...k...',
    '...k...',
  ],
};

const SMALL_SIZE = {
  heart: 9, heartEmpty: 9, hunger: 9, hungerEmpty: 9, up: 7,
};

/* metadata used by the UI */
export const ITEMS = {
  sword:   { name: 'Diamond Sword',  stack: null },
  pickaxe: { name: 'Diamond Pickaxe', stack: null },
  axe:     { name: 'Iron Axe',       stack: null },
  bow:     { name: 'Bow',            stack: null },
  apple:   { name: 'Golden Apple',   stack: 8 },
  pearl:   { name: 'Ender Pearl',    stack: 16 },
  potion:  { name: 'Splash Potion',  stack: 1 },
  cobble:  { name: 'Cobblestone',    stack: 64 },
  bucket:  { name: 'Water Bucket',   stack: 1 },
  arrows:  { name: 'Arrows',         stack: 32 },
  shield:  { name: 'Shield',         stack: null },
  carrot:  { name: 'Golden Carrot',  stack: 4 },
  diamond: { name: 'Diamond',        stack: 12 },
  book:    { name: 'Enchanted Book', stack: 1 },
};

export const ITEM_IDS = Object.keys(ITEMS);

/** Merge horizontal runs of identical pixels into rects. */
function rowsToRects(rows) {
  const out = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      if (ch !== '.' && PALETTE[ch]) {
        out.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PALETTE[ch]}"/>`);
      } else if (ch !== '.' && !PALETTE[ch]) {
        // fail loudly in dev consoles rather than drawing invisible pixels
        if (typeof console !== 'undefined') console.warn('[px] unknown palette char:', ch, 'row', y);
      }
      x += run;
    }
  }
  return out.join('');
}

const ALL_SPRITES = () => {
  const map = {};
  for (const [id, rows] of Object.entries(RAW)) map[id] = { rows, w: rows[0].length, h: rows.length };
  for (const [id, rows] of Object.entries(RAW_SMALL)) map[id] = { rows, w: SMALL_SIZE[id], h: SMALL_SIZE[id] };
  return map;
};

let sheetBuilt = false;

/** Inject <symbol> definitions into the hidden sprite sheet svg. */
export function buildSpriteSheet(target = document.getElementById('px-sprites')) {
  if (!target) return;
  if (sheetBuilt && target.childElementCount) return;
  const sprites = ALL_SPRITES();
  let html = '';
  for (const [id, { rows, w, h }] of Object.entries(sprites)) {
    html += `<symbol id="px-${id}" viewBox="0 0 ${w} ${h}">${rowsToRects(rows)}</symbol>`;
  }
  target.innerHTML = html;
  sheetBuilt = true;
}

/** Inline svg markup for an icon id. */
export function icon(id, cls = '') {
  return `<svg class="pxicon ${cls}" viewBox="0 0 ${spriteSize(id)} ${spriteSize(id)}" aria-hidden="true"><use href="#px-${id}"></use></svg>`;
}

/** Set of icon ids (used to guard against bad saved loadouts). */
export function hasIcon(id) {
  return Object.prototype.hasOwnProperty.call(RAW, id) || Object.prototype.hasOwnProperty.call(RAW_SMALL, id);
}

function spriteSize(id) {
  const sprites = ALL_SPRITES();
  return sprites[id] ? sprites[id].w : 16;
}

export function itemName(id) {
  return ITEMS[id] ? ITEMS[id].name : 'Item';
}

export function itemStack(id) {
  return ITEMS[id] ? ITEMS[id].stack : null;
}
