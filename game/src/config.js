// Every tuning number, colour and layout constant for Ember Court, in one place.
// The table is a fixed 1280x720 logical stage; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const STAGE = { width: 1280, height: 720 };

export const DUEL = {
  startLife: 30,
  startHand: 4,
  maxHand: 10,
  maxBoard: 5,
  maxMana: 10,
  deckSize: 30,
  fatigueDamage: 1,
};

export const PALETTE = {
  table: '#1d3a2a',
  tableEdge: '#122619',
  felt: '#265136',
  gold: '#e8b64c',
  goldDim: '#a67c2e',
  ink: '#f4ead2',
  muted: '#b9a98a',
  panel: '#241a12',
  panelEdge: '#4a3a26',
  ember: '#e4572e',
  tide: '#3a86d8',
  thorn: '#57a773',
  stone: '#b08954',
  danger: '#e5484d',
  mana: '#4fc3f7',
  shield: '#7dd3fc',
};

// The four elements. Each one is told apart by colour AND shape, never by text alone:
// Ember is a red triangle, Tide a blue circle, Thorn a green diamond, Stone a gold square.
export const ELEMENTS = {
  ember: { name: 'Ember', color: '#e4572e', dark: '#8f2d12', glyph: '▲', shape: 'triangle' },
  tide: { name: 'Tide', color: '#3a86d8', dark: '#1d4e89', glyph: '●', shape: 'circle' },
  thorn: { name: 'Thorn', color: '#57a773', dark: '#2c5a3d', glyph: '◆', shape: 'diamond' },
  stone: { name: 'Stone', color: '#b08954', dark: '#6b4e24', glyph: '■', shape: 'square' },
};

/** Surge: playing a second card of the same element in one turn empowers it. */
export const SURGE = { attackBonus: 2, damageBonus: 2, healBonus: 2, drawBonus: 1 };

export const FONT = 'Georgia, "Times New Roman", serif';
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best duel result is kept between visits (this browser only). */
export const BEST_KEY = 'ember-court.best';
