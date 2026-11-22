// The autopilot: a simple heuristic player that plays the duel through the real engine.
// Screenshot scenes use it to reach a real mid-game, win and loss; its skill is tuned by
// how greedily it plays, so the win scene wins and the loss scene loses.

import { canPlay, endTurn, legalTargets, playCard, aiTakeTurn, startTurn } from './engine.js';

/** Score a card for the autopilot: damage and board presence first, defence when hurt. */
function scoreCard(state, side, card) {
  const foe = side.owner === 'player' ? state.enemy : state.player;
  const def = card.def;
  let score = def.cost;
  if (def.kind === 'creature') score += def.atk * 3 + def.hp * 1.5 + (def.guard ? 2 : 0);
  if (def.effect?.damage) score += def.effect.damage * 4;
  if (def.effect?.heal) score += side.life < 20 ? 14 : 3;
  if (def.effect?.shield) score += side.life < 15 ? 12 : 3;
  if (def.effect?.draw) score += 7;
  if (def.effect?.damageAllEnemy) score += foe.board.length * 6;
  if (def.effect?.summon) score += 10;
  if (state.playedThisTurn.includes(def.element)) score += 9; // chase the Surge
  if (foe.life <= (def.effect?.damage ?? def.atk ?? 0)) score += 200; // lethal now
  return score;
}

function pickTarget(state, side, card) {
  const foe = side.owner === 'player' ? state.enemy : state.player;
  const targets = legalTargets(state, side, card);
  if (targets.length === 0) return null;
  const damage = card.def.effect?.damage ?? 0;
  const killable = targets.find((t) => t.kind === 'creature' && t.card.hp <= damage);
  if (killable) return killable;
  const guard = targets.find((t) => t.kind === 'creature' && t.card.def.guard);
  if (guard && state.rng() < 0.4) return guard;
  return { kind: 'warden', owner: foe.owner };
}

/**
 * Play one full turn for `side`: every card it can afford, best first, then end the turn.
 * skill 1 plays everything greedily; skill 0 plays at most one weak card, then passes.
 */
export function autopilotTurn(state, side, skill = 1) {
  let played = 0;
  for (;;) {
    if (state.phase === 'over') return played;
    const options = side.hand
      .filter((card) => canPlay(state, side, card))
      .map((card) => ({ card, score: scoreCard(state, side, card) }))
      .sort((a, b) => b.score - a.score);
    if (options.length === 0) break;
    if (skill === 0 && (played >= 1 || options[0].score < 6)) break;
    const { card } = options[0];
    const target = pickTarget(state, side, card);
    if (!playCard(state, side, card, target)) break;
    played += 1;
  }
  return played;
}

/**
 * Play the duel forward with the autopilot on the player's seat and the AI on the
 * enemy's, up to `maxTurns` player turns. Returns 'player' | 'enemy' | null.
 */
export function playForward(state, maxTurns, skill = 1) {
  for (let i = 0; i < maxTurns; i += 1) {
    if (state.phase === 'over') return state.winner;
    autopilotTurn(state, state.player, skill);
    if (state.phase === 'over') return state.winner;
    endTurn(state); // player -> enemy: enemy draws, its creatures strike
    if (state.phase === 'over') return state.winner;
    aiTakeTurn(state);
    if (state.phase === 'over') return state.winner;
    endTurn(state); // enemy -> player: new turn, draw, strikes
  }
  return state.phase === 'over' ? state.winner : null;
}

/** Begin the duel: leave the title screen and open the first turn. */
export function beginDuel(state) {
  state.phase = 'play';
  startTurn(state, 'player');
}
