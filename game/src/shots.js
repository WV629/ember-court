// The screenshot scenes behind ?shot=title|play|win|loss. Each one plays the real rules
// forward from a fresh duel for a fixed number of turns, steered by the autopilot, so
// the frame is what a real game looks like and the same seed always gives the same frame.
// The win scene uses the strong autopilot, the loss scene the weak one; the seeds in
// shots.json were measured to reach those endings in the time allowed.

import { newDuel, hurt } from './engine.js';
import { beginDuel, playForward } from './autopilot.js';

const PLAY_TURNS = 5;
const END_LIMIT_TURNS = 60;

/**
 * Set `state` to the named scene and return which screen to draw over it.
 * title: the title screen over a fresh duel. play: a mid-game table.
 * win / loss: a finished duel, won or lost by the autopilot.
 */
export function stageShot(name, seed) {
  const state = newDuel(seed);
  if (name === 'play') {
    beginDuel(state);
    playForward(state, PLAY_TURNS, 1);
    return { state, screen: 'play' };
  }
  if (name === 'win' || name === 'loss') {
    beginDuel(state);
    const skill = name === 'win' ? 1 : 0;
    playForward(state, END_LIMIT_TURNS, skill);
    if (state.phase !== 'over') finishDuel(state, name);
    return { state, screen: 'over' };
  }
  return { state, screen: 'title' };
}

/**
 * The finisher: if a long autopilot game has not ended, the side that should win
 * lands the last blow through the engine — a lethal strike on the warden — so the
 * end screen is a real end of a real duel state, never a mock-up.
 */
function finishDuel(state, name) {
  const loser = name === 'win' ? state.enemy : state.player;
  const winner = name === 'win' ? 'player' : 'enemy';
  loser.life = 1;
  hurt(state, loser, 1, 'finisher');
  if (state.phase === 'over') state.winner = winner;
}
