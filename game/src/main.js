// Boot: read ?shot=, build the stage, and run the duel.
// In a shot scene the game is staged by the autopilot and frozen on one frame so a
// screenshot catches it; in normal play the table is live and the enemy takes its
// turn one card at a time, so its moves can be followed.

import { STAGE } from './config.js';
import { newDuel, startTurn, endTurn, aiPlan, playCard } from './engine.js';
import { renderTable, renderTitle, renderEnd } from './render.js';
import { makeHandlers, newUi } from './input.js';
import { stageShot } from './shots.js';
import { sfx } from './audio.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');

function scaleStage() {
  const scale = Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', scaleStage);
scaleStage();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1');

let state;
let ui = newUi();
let handlers;

function toast(text) {
  status.textContent = text;
}

function rerender() {
  stage.innerHTML = '';
  if (state.phase === 'title') {
    renderTitle(stage, { onPlay: startGame });
    return;
  }
  renderTable(stage, state, ui, handlers);
  if (state.phase === 'over') {
    renderEnd(stage, state, { onPlayAgain: restart });
  }
}

function saveBest() {
  try {
    const best = Number(window.localStorage.getItem('ember-court.best') || '0');
    if (state.score > best) window.localStorage.setItem('ember-court.best', String(state.score));
  } catch {
    // Private mode or no storage: the best score is a nicety, never a failure.
  }
}

function finishDuel() {
  sfx(state.winner === 'player' ? 'win' : 'lose');
  saveBest();
  rerender();
}

function playEnemyCard(card) {
  if (!state.enemy.hand.includes(card)) return;
  let target = null;
  if (card.def.kind === 'spell' && card.def.target === 'any') {
    const damage = card.def.effect?.damage ?? 0;
    const weak = state.player.board.find((c) => c.hp <= damage);
    target = weak ? { kind: 'creature', card: weak } : { kind: 'warden', owner: 'player' };
  }
  if (playCard(state, state.enemy, card, target)) sfx('play');
}

/** The enemy's turn, played out one card per beat so the player can follow it. */
function enemyTurn() {
  endTurn(state); // player -> enemy: the enemy draws, its creatures strike, mana refills
  rerender();
  if (state.phase === 'over') { finishDuel(); return; }
  const plan = aiPlan(state);
  ui.intent = plan.text;
  rerender();
  const cards = plan.moves.map((m) => m.card);
  let i = 0;
  const playNext = () => {
    if (state.phase === 'over' || i >= cards.length) {
      endTurn(state); // enemy -> player: a new turn begins
      ui.intent = 'Vex watches the table.';
      if (state.phase === 'over') finishDuel();
      else rerender();
      return;
    }
    playEnemyCard(cards[i]);
    i += 1;
    rerender();
    setTimeout(playNext, 650);
  };
  setTimeout(playNext, 650);
}

function wireHandlers() {
  handlers = makeHandlers(state, ui, {
    rerender,
    toast,
    sfx,
    onGameOver: finishDuel,
    enemyTurn,
  });
  ui.canPlay = (card) => handlers.canPlayCard(card);
  document.addEventListener('keydown', (event) => handlers.onKey(event));
}

function startGame() {
  state.phase = 'play';
  ui = newUi();
  wireHandlers();
  startTurn(state, 'player');
  rerender();
}

function restart() {
  state = newDuel(seed);
  ui = newUi();
  wireHandlers();
  state.phase = 'play';
  startTurn(state, 'player');
  rerender();
}

if (shot) {
  // A screenshot scene: stage it, freeze it, and show exactly that frame.
  const staged = stageShot(shot, seed);
  state = staged.state;
  ui = newUi();
  ui.intent = shot === 'win'
    ? 'Vex plots a burning assault — too late.'
    : shot === 'loss'
      ? 'Vex plots a burning assault — Ember Bolt.'
      : shot === 'play'
        ? 'Vex plots a thorny snare — Briar Wolf.'
        : 'Vex watches the table.';
  wireHandlers();
  rerender();
} else {
  state = newDuel(seed);
  wireHandlers();
  rerender();
}
