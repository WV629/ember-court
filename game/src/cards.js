// The cards of Ember Court: every definition, the deck builder and the seeded shuffle.
// Four elements, two card kinds. Creatures stay on the board and strike at the start of
// their owner's turn; spells resolve at once. A creature with Guard soaks strikes first.

import { ELEMENTS } from './config.js';

/**
 * A card definition. kind: 'creature' | 'spell'.
 * Creature: atk / hp, guard soaks strikes, onPlay is a one-off effect when it enters.
 * Spell: effect describes what it does; target: 'enemy' | 'ally' | 'any' | 'self' | 'none'.
 * surge: what the Surge bonus adds when this is the second card of its element this turn.
 */
export const CARDS = {
  emberImp: {
    id: 'emberImp', name: 'Ember Imp', element: 'ember', kind: 'creature', cost: 1,
    atk: 2, hp: 1, art: '🔥', text: 'A spark with teeth.',
  },
  cinderHound: {
    id: 'cinderHound', name: 'Cinder Hound', element: 'ember', kind: 'creature', cost: 2,
    atk: 3, hp: 2, art: '🐺', text: 'It hunts in the smoke.',
  },
  flameKnight: {
    id: 'flameKnight', name: 'Flame Knight', element: 'ember', kind: 'creature', cost: 4,
    atk: 5, hp: 4, art: '⚔️', text: 'His blade is always lit.',
  },
  ashPhoenix: {
    id: 'ashPhoenix', name: 'Ash Phoenix', element: 'ember', kind: 'creature', cost: 6,
    atk: 6, hp: 5, art: '🦅', text: 'On defeat: scorch the foe for 3.',
    onDefeat: { damage: 3, target: 'enemy' },
  },
  emberBolt: {
    id: 'emberBolt', name: 'Ember Bolt', element: 'ember', kind: 'spell', cost: 2,
    art: '☄️', text: 'Deal 4 damage. Surge: deal 6.',
    effect: { damage: 4 }, surge: { damage: 2 }, target: 'any',
  },
  courtsVerdict: {
    id: 'courtsVerdict', name: "Court's Verdict", element: 'ember', kind: 'spell', cost: 5,
    art: '👑', text: 'Deal 6 damage. Surge: deal 8.',
    effect: { damage: 6 }, surge: { damage: 2 }, target: 'any',
  },
  tideSprite: {
    id: 'tideSprite', name: 'Tide Sprite', element: 'tide', kind: 'creature', cost: 1,
    atk: 1, hp: 2, art: '🧚', text: 'On play: draw a card.',
    onPlay: { draw: 1 },
  },
  waveSerpent: {
    id: 'waveSerpent', name: 'Wave Serpent', element: 'tide', kind: 'creature', cost: 3,
    atk: 3, hp: 3, art: '🐍', text: 'It rides the undertow.',
  },
  tidecaller: {
    id: 'tidecaller', name: 'Tidecaller', element: 'tide', kind: 'creature', cost: 4,
    atk: 2, hp: 5, art: '🧜', text: 'On play: draw 2 cards.',
    onPlay: { draw: 2 },
  },
  tideSurge: {
    id: 'tideSurge', name: 'Tide Surge', element: 'tide', kind: 'spell', cost: 2,
    art: '🌊', text: 'Draw 2 cards. Surge: draw 3.',
    effect: { draw: 2 }, surge: { draw: 1 }, target: 'none',
  },
  thornSprout: {
    id: 'thornSprout', name: 'Thorn Sprout', element: 'thorn', kind: 'creature', cost: 1,
    atk: 1, hp: 3, art: '🌱', text: 'On play: mend 2 life.',
    onPlay: { heal: 2 },
  },
  briarWolf: {
    id: 'briarWolf', name: 'Briar Wolf', element: 'thorn', kind: 'creature', cost: 3,
    atk: 4, hp: 3, art: '🐺', text: 'Thorns grow where it runs.',
  },
  thornGiant: {
    id: 'thornGiant', name: 'Thorn Giant', element: 'thorn', kind: 'creature', cost: 5,
    atk: 5, hp: 6, art: '🌳', text: 'On play: mend 4 life.',
    onPlay: { heal: 4 },
  },
  thornMend: {
    id: 'thornMend', name: 'Thorn Mend', element: 'thorn', kind: 'spell', cost: 2,
    art: '🌿', text: 'Mend 6 life. Surge: mend 8.',
    effect: { heal: 6 }, surge: { heal: 2 }, target: 'self',
  },
  wildBloom: {
    id: 'wildBloom', name: 'Wild Bloom', element: 'thorn', kind: 'spell', cost: 4,
    art: '🌸', text: 'Summon two 2/2 Sprouts and mend 3.',
    effect: { summon: { id: 'bloomSprout', count: 2 }, heal: 3 }, target: 'none',
  },
  bloomSprout: {
    id: 'bloomSprout', name: 'Bloom Sprout', element: 'thorn', kind: 'creature', cost: 0,
    atk: 2, hp: 2, art: '🌷', text: 'Bloomed, not summoned by hand.',
    token: true,
  },
  stoneGolem: {
    id: 'stoneGolem', name: 'Stone Golem', element: 'stone', kind: 'creature', cost: 3,
    atk: 2, hp: 5, art: '🗿', text: 'Guard: soaks strikes first.',
    guard: true,
  },
  graniteWarden: {
    id: 'graniteWarden', name: 'Granite Warden', element: 'stone', kind: 'creature', cost: 5,
    atk: 4, hp: 7, art: '🛡️', text: 'Guard: soaks strikes first.',
    guard: true,
  },
  stoneWall: {
    id: 'stoneWall', name: 'Stone Wall', element: 'stone', kind: 'spell', cost: 2,
    art: '🧱', text: 'Gain 6 shield. Surge: gain 8.',
    effect: { shield: 6 }, surge: { shield: 2 }, target: 'self',
  },
  quakeSlam: {
    id: 'quakeSlam', name: 'Quake Slam', element: 'stone', kind: 'spell', cost: 3,
    art: '💥', text: 'Deal 3 damage to all enemy creatures.',
    effect: { damageAllEnemy: 3 }, target: 'none',
  },
};

/** How many copies of each card a 30-card deck holds (tokens are never in a deck). */
const DECK_LIST = [
  ['emberImp', 3], ['cinderHound', 2], ['flameKnight', 2], ['ashPhoenix', 1],
  ['emberBolt', 2], ['courtsVerdict', 1],
  ['tideSprite', 2], ['waveSerpent', 2], ['tidecaller', 1], ['tideSurge', 2],
  ['thornSprout', 2], ['briarWolf', 2], ['thornGiant', 1], ['thornMend', 2], ['wildBloom', 1],
  ['stoneGolem', 2], ['graniteWarden', 1], ['stoneWall', 2], ['quakeSlam', 1],
];

/** A tiny seeded RNG (mulberry32) so screenshot scenes replay exactly. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh 30-card deck, shuffled with the given rng. */
export function buildDeck(rng) {
  const deck = [];
  for (const [id, count] of DECK_LIST) {
    for (let i = 0; i < count; i += 1) deck.push(id);
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** A live card instance on the table or in a hand. */
export function makeCardInstance(id, owner, uid) {
  const def = CARDS[id];
  return {
    uid, id, owner, def,
    atk: def.atk ?? 0,
    hp: def.hp ?? 0,
    maxHp: def.hp ?? 0,
    summoning: false,
  };
}

/** The element badge data for a card: colour, shape glyph and name. */
export function elementBadge(element) {
  return ELEMENTS[element];
}
