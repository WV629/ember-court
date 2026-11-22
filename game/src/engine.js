// The duel engine: pure rules, no DOM. A state is plain data; every change goes through
// these functions so the autopilot, the screenshots and the UI all play the same game.

import { DUEL, SURGE } from './config.js';
import { CARDS, buildDeck, makeCardInstance, makeRng } from './cards.js';

let nextUid = 1;

/** A fresh duel. seed drives both decks and every random choice, so a game replays. */
export function newDuel(seed = 1) {
  nextUid = 1;
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    turn: 1,
    phase: 'title', // title | play | over
    active: 'player', // whose turn it is
    winner: null,
    log: [],
    playedThisTurn: [], // element ids played this turn, for Surge
    score: 0,
    stats: { cardsPlayed: 0, damageDealt: 0, creaturesSummoned: 0, turnsTaken: 0 },
    player: newSide('player', rng),
    enemy: newSide('enemy', rng),
  };
  drawCards(state, state.player, DUEL.startHand);
  drawCards(state, state.enemy, DUEL.startHand);
  return state;
}

function newSide(owner, rng) {
  return {
    owner,
    life: DUEL.startLife,
    shield: 0,
    mana: 1,
    maxMana: 1,
    deck: buildDeck(rng),
    hand: [],
    board: [],
    discard: [],
    fatigue: 0,
  };
}

export function otherSide(state, owner) {
  return owner === 'player' ? state.enemy : state.player;
}

function say(state, text) {
  state.log.unshift(text);
  if (state.log.length > 6) state.log.length = 6;
}

/** Draw n cards; an empty deck deals rising fatigue damage instead. */
export function drawCards(state, side, n) {
  for (let i = 0; i < n; i += 1) {
    if (side.hand.length >= DUEL.maxHand) { say(state, `${nameOf(side)}'s hand is full.`); return; }
    if (side.deck.length === 0) {
      side.fatigue += DUEL.fatigueDamage;
      hurt(state, side, side.fatigue, 'fatigue');
      say(state, `${nameOf(side)} draws from an empty deck and suffers ${side.fatigue} fatigue.`);
      continue;
    }
    side.hand.push(makeCardInstance(side.deck.pop(), side.owner, nextUid++));
  }
}

export function nameOf(side) {
  return side.owner === 'player' ? 'You' : 'Warden Vex';
}

/** Damage that shield soaks first. Returns the life damage actually dealt. */
export function hurt(state, side, amount, source = '') {
  if (amount <= 0) return 0;
  let left = amount;
  if (side.shield > 0) {
    const soaked = Math.min(side.shield, left);
    side.shield -= soaked;
    left -= soaked;
  }
  side.life -= left;
  if (side.owner === 'enemy') state.stats.damageDealt += left;
  if (side.life <= 0) {
    side.life = 0;
    endDuel(state, side.owner === 'player' ? 'enemy' : 'player');
  }
  return left;
}

function heal(state, side, amount) {
  side.life = Math.min(DUEL.startLife, side.life + amount);
}

function endDuel(state, winner) {
  if (state.phase === 'over') return;
  state.phase = 'over';
  state.winner = winner;
  state.score = state.stats.damageDealt * 10 + state.stats.cardsPlayed * 5
    + state.stats.creaturesSummoned * 3 + (winner === 'player' ? 500 : 0)
    - (state.turn - 1) * 4;
  if (state.score < 0) state.score = 0;
  say(state, winner === 'player' ? 'Victory! The Ember Court is yours.' : 'Defeat. The Hollow Court endures.');
}

/** The running score, live during play and final at the end of the duel. */
export function liveScore(state) {
  if (state.phase === 'over') return state.score;
  return state.stats.damageDealt * 10 + state.stats.cardsPlayed * 5
    + state.stats.creaturesSummoned * 3 - (state.turn - 1) * 4;
}

/** Start a turn for `owner`: refill mana, draw, then its creatures strike. */
export function startTurn(state, owner) {
  const side = owner === 'player' ? state.player : state.enemy;
  state.active = owner;
  state.playedThisTurn = [];
  if (owner === 'player') state.stats.turnsTaken += 1;
  side.maxMana = Math.min(DUEL.maxMana, state.turn);
  side.mana = side.maxMana;
  drawCards(state, side, 1);
  if (state.phase === 'over') return;
  strikePhase(state, side, otherSide(state, owner));
}

/**
 * Every creature on `side`'s board strikes: Guard creatures on the other side soak the
 * blows first, then the rest hits the opposing warden directly.
 */
export function strikePhase(state, side, foe) {
  for (const creature of [...side.board]) {
    if (state.phase === 'over') return;
    if (creature.atk <= 0) continue;
    const guards = foe.board.filter((c) => c.def.guard);
    if (guards.length > 0) {
      const guard = guards[0];
      damageCreature(state, guard, creature.atk, foe);
      say(state, `${creature.def.name} strikes ${guard.def.name} for ${creature.atk}.`);
    } else {
      hurt(state, foe, creature.atk, 'strike');
      say(state, `${creature.def.name} strikes ${nameOf(foe)} for ${creature.atk}.`);
    }
  }
}

function damageCreature(state, creature, amount, side) {
  creature.hp -= amount;
  if (creature.hp <= 0) destroyCreature(state, creature, side);
}

function destroyCreature(state, creature, side) {
  const index = side.board.indexOf(creature);
  if (index !== -1) side.board.splice(index, 1);
  side.discard.push(creature);
  say(state, `${creature.def.name} is destroyed.`);
  if (creature.def.onDefeat) {
    const foe = otherSide(state, side.owner);
    if (creature.def.onDefeat.damage) {
      hurt(state, foe, creature.def.onDefeat.damage, 'defeat');
      say(state, `${creature.def.name}'s last ember scorches ${nameOf(foe)} for ${creature.def.onDefeat.damage}.`);
    }
  }
}

/** Is this card playable right now (mana, board room, and a legal target exists)? */
export function canPlay(state, side, card) {
  if (state.phase !== 'play' || state.active !== side.owner) return false;
  if (card.def.cost > side.mana) return false;
  if (card.def.kind === 'creature' && side.board.length >= DUEL.maxBoard) return false;
  if (card.def.kind === 'spell' && card.def.target === 'any') {
    return true; // any target: the warden or any enemy creature
  }
  return true;
}

/** All legal targets for a card: creatures and wardens it may be aimed at. */
export function legalTargets(state, side, card) {
  const foe = otherSide(state, side.owner);
  if (card.def.kind === 'spell' && card.def.target === 'any') {
    return [{ kind: 'warden', owner: foe.owner }, ...foe.board.map((c) => ({ kind: 'creature', card: c, owner: foe.owner }))];
  }
  return [];
}

function surgeActive(state, card) {
  return state.playedThisTurn.includes(card.def.element);
}

/**
 * Play a card from `side`'s hand. For a spell with target 'any', pass a target
 * ({ kind: 'warden', owner } or { kind: 'creature', card }); other cards need none.
 * Returns true when the card was played.
 */
export function playCard(state, side, card, target = null) {
  if (!canPlay(state, side, card)) return false;
  const handIndex = side.hand.indexOf(card);
  if (handIndex === -1) return false;
  const surging = surgeActive(state, card);
  side.hand.splice(handIndex, 1);
  side.mana -= card.def.cost;
  state.playedThisTurn.push(card.def.element);
  state.stats.cardsPlayed += 1;
  const foe = otherSide(state, side.owner);

  if (card.def.kind === 'creature') {
    if (side.board.length >= DUEL.maxBoard) { side.hand.push(card); side.mana += card.def.cost; return false; }
    const placed = card;
    placed.summoning = true;
    if (surging) { placed.atk += SURGE.attackBonus; placed.hp += SURGE.attackBonus; placed.maxHp += SURGE.attackBonus; }
    side.board.push(placed);
    state.stats.creaturesSummoned += 1;
    say(state, `${nameOf(side)} summons ${placed.def.name}${surging ? ' — Surge! +2/+2' : ''}.`);
    applyEffect(state, side, foe, placed.def.onPlay, surging);
  } else {
    say(state, `${nameOf(side)} casts ${card.def.name}${surging ? ' — Surge!' : ''}.`);
    applyEffect(state, side, foe, card.def.effect, surging, target);
    side.discard.push(card);
  }
  return true;
}

function applyEffect(state, side, foe, effect, surging, target = null) {
  if (!effect) return;
  if (effect.draw) drawCards(state, side, effect.draw + (surging ? SURGE.drawBonus : 0));
  if (effect.heal) heal(state, side, effect.heal + (surging ? SURGE.healBonus : 0));
  if (effect.shield) side.shield += effect.shield + (surging ? SURGE.healBonus : 0);
  if (effect.summon) {
    for (let i = 0; i < effect.summon.count; i += 1) {
      if (side.board.length >= DUEL.maxBoard) break;
      const token = makeCardInstance(effect.summon.id, side.owner, nextUid++);
      side.board.push(token);
      state.stats.creaturesSummoned += 1;
    }
  }
  if (effect.damageAllEnemy) {
    for (const creature of [...foe.board]) damageCreature(state, creature, effect.damageAllEnemy, foe);
    say(state, `The ground shakes: every enemy creature takes ${effect.damageAllEnemy}.`);
  }
  if (effect.damage) {
    const amount = effect.damage + (surging ? SURGE.damageBonus : 0);
    if (!target || target.kind === 'warden') {
      const victim = target && target.owner === side.owner ? side : foe;
      hurt(state, victim, amount, 'spell');
      say(state, `${nameOf(victim)} takes ${amount} spell damage.`);
    } else if (target.kind === 'creature') {
      damageCreature(state, target.card, amount, foe);
      say(state, `${target.card.def.name} takes ${amount} spell damage.`);
    }
  }
}

/** End the current turn and hand the duel to the other side. */
export function endTurn(state) {
  if (state.phase !== 'play') return;
  if (state.active === 'player') {
    startTurn(state, 'enemy');
  } else {
    state.turn += 1;
    startTurn(state, 'player');
  }
}

/**
 * The enemy AI: a greedy heuristic that plays what it can, favouring lethal damage,
 * then big creatures, then removal, then defence. Returns a one-line plan of its intent
 * so the player can read it before the turn plays out.
 */
export function aiPlan(state) {
  const side = state.enemy;
  const moves = [];
  for (const card of [...side.hand]) {
    if (!canPlay(state, side, card)) continue;
    moves.push({ card, score: aiScoreCard(state, side, card) });
  }
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];
  if (!best) return { text: 'Vex holds, watching.', moves: [] };
  const kinds = {
    ember: 'a burning assault', tide: 'a rising tide', thorn: 'a thorny snare', stone: 'a stone wall',
  };
  return {
    text: `Vex plots ${kinds[best.card.def.element] || 'a move'} — ${best.card.def.name}.`,
    moves,
  };
}

function aiScoreCard(state, side, card) {
  const foe = state.player;
  const def = card.def;
  let score = def.cost * 2;
  if (def.kind === 'creature') score += def.atk * 3 + def.hp;
  if (def.effect?.damage) score += def.effect.damage * 4;
  if (def.effect?.heal && side.life < DUEL.startLife - 5) score += 12;
  if (def.effect?.shield && side.life < 15) score += 10;
  if (def.effect?.draw) score += 6;
  if (def.effect?.damageAllEnemy && foe.board.length > 0) score += foe.board.length * 5;
  if (foe.life <= (def.effect?.damage ?? def.atk ?? 0)) score += 100; // lethal
  if (state.playedThisTurn.includes(def.element)) score += 8; // chase the Surge
  return score;
}

/** Run the enemy's whole turn: plan, play cards one by one, then hand back. */
export function aiTakeTurn(state) {
  if (state.phase !== 'play' || state.active !== 'enemy') return [];
  const played = [];
  const plan = aiPlan(state);
  for (const move of plan.moves) {
    if (state.phase === 'over') break;
    const card = move.card;
    if (!state.enemy.hand.includes(card) || !canPlay(state, state.enemy, card)) continue;
    let target = null;
    if (card.def.kind === 'spell' && card.def.target === 'any') {
      const weak = state.player.board.filter((c) => c.hp <= (card.def.effect.damage ?? 0));
      target = weak.length > 0 && state.rng() < 0.5
        ? { kind: 'creature', card: weak[0] }
        : { kind: 'warden', owner: 'player' };
    }
    if (playCard(state, state.enemy, card, target)) played.push(card.def.name);
  }
  return played;
}
