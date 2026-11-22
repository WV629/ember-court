// The table: every pixel the player sees, built from the duel state as plain DOM.
// Cards are real DOM, not canvas, so their values stay legible at thumbnail size.
// Re-renders are cheap and whole; entrance animations fire only for cards the
// renderer has not shown before, tracked by uid.

import { DUEL, ELEMENTS } from './config.js';
import { legalTargets, liveScore } from './engine.js';

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function elementChip(element) {
  const info = ELEMENTS[element];
  const chip = el('span', `element-chip element-${element}`);
  chip.textContent = `${info.glyph} ${info.name}`;
  return chip;
}

function manaCrystals(side) {
  const wrap = el('div', 'mana');
  for (let i = 0; i < DUEL.maxMana; i += 1) {
    const gem = el('span', `mana-gem${i < side.mana ? ' lit' : ''}${i < side.maxMana ? '' : ''}`);
    gem.textContent = '◆';
    wrap.appendChild(gem);
  }
  wrap.appendChild(el('span', 'mana-count', `${side.mana}/${side.maxMana}`));
  return wrap;
}

function lifeBlock(side) {
  const wrap = el('div', 'life-block');
  const heart = el('span', 'life-heart', '♥');
  wrap.appendChild(heart);
  wrap.appendChild(el('span', 'life-number', String(side.life)));
  if (side.shield > 0) {
    const shield = el('span', 'shield-bubble', `🛡 ${side.shield}`);
    wrap.appendChild(shield);
  }
  return wrap;
}

/** One card face. `faceDown` shows the card back; `mini` shrinks it for the board. */
export function cardFace(card, { faceDown = false, mini = false, playable = false, selected = false, fresh = false } = {}) {
  const def = card.def;
  const node = el('div', `card element-${def.element}${mini ? ' mini' : ''}${playable ? ' playable' : ''}${selected ? ' selected' : ''}${fresh ? ' fresh' : ''}`);
  if (faceDown) {
    node.classList.add('face-down');
    node.appendChild(el('div', 'card-back', '♠'));
    return node;
  }
  const cost = el('div', 'card-cost', String(def.cost));
  node.appendChild(cost);
  node.appendChild(el('div', 'card-art', def.art));
  node.appendChild(el('div', 'card-name', def.name));
  const badge = el('div', 'card-element');
  badge.appendChild(elementChip(def.element));
  node.appendChild(badge);
  node.appendChild(el('div', 'card-text', def.text));
  if (def.kind === 'creature') {
    const stats = el('div', 'card-stats');
    stats.appendChild(el('span', 'card-atk', `⚔ ${card.atk}`));
    stats.appendChild(el('span', 'card-hp', `♥ ${card.hp}`));
    if (def.guard) stats.appendChild(el('span', 'card-guard', mini ? '🛡' : '🛡 Guard'));
    node.appendChild(stats);
  } else {
    node.appendChild(el('div', 'card-kind', '✦ Spell'));
  }
  return node;
}

/**
 * Render the whole table into #stage. `ui` carries the interaction state (the selected
 * card, the last life totals for damage floaters, the set of card uids already shown).
 */
export function renderTable(stage, state, ui, handlers) {
  stage.innerHTML = '';
  const table = el('div', 'table');
  stage.appendChild(table);

  // Opponent's side: portrait, life, mana, intent, and a fanned face-down hand.
  const enemyArea = el('div', 'side-area enemy-area');
  const enemyPortrait = el('div', 'portrait enemy-portrait');
  enemyPortrait.appendChild(el('div', 'portrait-glyph', '👑'));
  enemyPortrait.appendChild(el('div', 'portrait-name', 'Warden Vex'));
  enemyPortrait.appendChild(lifeBlock(state.enemy));
  enemyPortrait.appendChild(manaCrystals(state.enemy));
  enemyPortrait.dataset.target = 'enemy-warden';
  enemyArea.appendChild(enemyPortrait);
  const enemyHand = el('div', 'hand enemy-hand');
  state.enemy.hand.forEach((card, i) => {
    const back = cardFace(card, { faceDown: true, mini: true });
    back.style.setProperty('--fan', String(i - (state.enemy.hand.length - 1) / 2));
    enemyHand.appendChild(back);
  });
  enemyArea.appendChild(enemyHand);
  const intent = el('div', 'intent', ui.intent || 'Vex watches the table.');
  enemyArea.appendChild(intent);
  table.appendChild(enemyArea);

  // The enemy's board: creatures in play, each a target for spells.
  const enemyBoard = el('div', 'board enemy-board');
  state.enemy.board.forEach((card) => {
    const node = cardFace(card, { mini: true, fresh: !ui.seen.has(card.uid) });
    node.dataset.target = `creature:${card.uid}`;
    ui.seen.add(card.uid);
    enemyBoard.appendChild(node);
  });
  if (state.enemy.board.length === 0) enemyBoard.appendChild(el('div', 'board-empty', 'No creatures in play'));
  table.appendChild(enemyBoard);

  // The middle of the table: turn banner, Surge chips, and the duel log.
  const mid = el('div', 'mid-row');
  const banner = el('div', 'turn-banner');
  banner.textContent = state.phase === 'over'
    ? (state.winner === 'player' ? 'Victory!' : 'Defeat')
    : state.active === 'player' ? `Your turn — Turn ${state.turn}` : 'Vex is taking a turn…';
  mid.appendChild(banner);
  const surge = el('div', 'surge-row');
  if (state.playedThisTurn.length > 0) {
    surge.appendChild(el('span', 'surge-label', 'Surge played:'));
    for (const element of [...new Set(state.playedThisTurn)]) surge.appendChild(elementChip(element));
    surge.appendChild(el('span', 'surge-hint', 'Play another of the same element for +2!'));
  } else {
    surge.appendChild(el('span', 'surge-hint', 'Play two cards of one element in a turn to Surge them (+2).'));
  }
  mid.appendChild(surge);
  const counts = el('div', 'deck-counts');
  counts.appendChild(el('span', 'deck-count', `🂠 Deck ${state.player.deck.length}`));
  counts.appendChild(el('span', 'deck-count', `Discard ${state.player.discard.length}`));
  counts.appendChild(el('span', 'deck-count', `Score ${liveScore(state)}`));
  mid.appendChild(counts);
  const log = el('div', 'duel-log');
  state.log.forEach((line) => log.appendChild(el('div', 'log-line', line)));
  mid.appendChild(log);
  table.appendChild(mid);

  // The player's board.
  const playerBoard = el('div', 'board player-board');
  state.player.board.forEach((card) => {
    const node = cardFace(card, { mini: true, fresh: !ui.seen.has(card.uid) });
    ui.seen.add(card.uid);
    playerBoard.appendChild(node);
  });
  if (state.player.board.length === 0) playerBoard.appendChild(el('div', 'board-empty', 'Your creatures will stand here'));
  table.appendChild(playerBoard);

  // The player's side: portrait, life, mana, deck counts, hand, and End Turn.
  const playerArea = el('div', 'side-area player-area');
  const playerPortrait = el('div', 'portrait player-portrait');
  playerPortrait.appendChild(el('div', 'portrait-glyph', '🔥'));
  playerPortrait.appendChild(el('div', 'portrait-name', 'You — Ember Warden'));
  playerPortrait.appendChild(lifeBlock(state.player));
  playerPortrait.appendChild(manaCrystals(state.player));
  playerArea.appendChild(playerPortrait);
  const hand = el('div', 'hand player-hand');
  // A big hand fans tighter so it never runs off the table: the overlap grows
  // with the hand, keeping the whole fan inside the stage.
  const handSize = state.player.hand.length;
  const overlap = handSize > 1
    ? Math.max(6, Math.ceil((handSize * 118 - 640) / (2 * (handSize - 1))))
    : 6;
  state.player.hand.forEach((card, i) => {
    const playable = ui.canPlay ? ui.canPlay(card) : false;
    const node = cardFace(card, {
      playable,
      selected: ui.selected === card.uid,
      fresh: !ui.seen.has(card.uid),
    });
    node.style.setProperty('--fan', String(i - (state.player.hand.length - 1) / 2));
    node.style.margin = `0 ${-overlap}px`;
    node.dataset.card = String(card.uid);
    ui.seen.add(card.uid);
    hand.appendChild(node);
  });
  playerArea.appendChild(hand);
  const endTurn = el('button', 'end-turn', state.active === 'player' ? '⚔ End Turn' : 'Vex is playing…');
  endTurn.disabled = state.active !== 'player' || state.phase !== 'play';
  playerArea.appendChild(endTurn);
  table.appendChild(playerArea);

  // Damage floaters: life fell since the last render, so a number drifts up.
  floatLifeChange(stage, state, ui);

  wireTargets(stage, state, ui, handlers);
  return { endTurn };
}

function floatLifeChange(stage, state, ui) {
  for (const owner of ['player', 'enemy']) {
    const side = state[owner];
    const before = ui.lastLife[owner];
    if (before !== undefined && side.life < before) {
      const floater = el('div', 'floater damage', `−${before - side.life}`);
      floater.style.left = owner === 'player' ? '18%' : '18%';
      floater.style.top = owner === 'player' ? '78%' : '12%';
      stage.appendChild(floater);
      setTimeout(() => floater.remove(), 1200);
    }
    ui.lastLife[owner] = side.life;
  }
}

function wireTargets(stage, state, ui, handlers) {
  stage.querySelectorAll('[data-card]').forEach((node) => {
    node.addEventListener('click', () => handlers.onCardClick(Number(node.dataset.card)));
  });
  stage.querySelectorAll('[data-target]').forEach((node) => {
    node.addEventListener('click', () => handlers.onTargetClick(node.dataset.target));
  });
  const endTurn = stage.querySelector('.end-turn');
  if (endTurn) endTurn.addEventListener('click', () => handlers.onEndTurn());
}

/** The title screen: name, promise, how to play, and the Play button. */
export function renderTitle(stage, handlers) {
  const overlay = el('div', 'overlay title-screen');
  overlay.appendChild(el('div', 'title-kicker', 'A DUEL OF ELEMENTS'));
  overlay.appendChild(el('h1', 'title-name', 'Ember Court'));
  overlay.appendChild(el('div', 'title-sub', 'Outwit Warden Vex in a turn-based card duel. Four elements, one court, thirty life.'));
  const rules = el('div', 'title-rules');
  rules.appendChild(el('div', 'rule', '🔥 Play cards with mana — it grows every turn.'));
  rules.appendChild(el('div', 'rule', '⚔ Creatures strike at the start of your turn. Guards soak the blows.'));
  rules.appendChild(el('div', 'rule', '✦ Surge: play two cards of one element in a turn and the second hits +2.'));
  rules.appendChild(el('div', 'rule', '♥ Reduce Vex to 0 life before he does the same to you.'));
  overlay.appendChild(rules);
  const play = el('button', 'big-button', '▶  Play the Duel');
  play.addEventListener('click', () => handlers.onPlay());
  overlay.appendChild(play);
  overlay.appendChild(el('div', 'title-foot', 'Keyboard: 1–7 select a card · Enter ends the turn · Esc cancels'));
  stage.appendChild(overlay);
}

/** The end screen: victory or defeat, the duel's numbers, and Play Again. */
export function renderEnd(stage, state, handlers) {
  const won = state.winner === 'player';
  const overlay = el('div', `overlay end-screen ${won ? 'win' : 'loss'}`);
  overlay.appendChild(el('div', 'end-kicker', won ? 'THE COURT IS YOURS' : 'THE HOLLOW COURT ENDURES'));
  overlay.appendChild(el('h1', 'end-name', won ? 'Victory!' : 'Defeat'));
  overlay.appendChild(el('div', 'end-sub', won
    ? 'Warden Vex bows. The embers answer to you now.'
    : 'Vex keeps the court — for now. Shuffle up and try again.'));
  const stats = el('div', 'end-stats');
  const add = (label, value) => {
    const row = el('div', 'stat-row');
    row.appendChild(el('span', 'stat-label', label));
    row.appendChild(el('span', 'stat-value', String(value)));
    stats.appendChild(row);
  };
  add('Score', state.score);
  add('Turns', state.stats.turnsTaken);
  add('Cards played', state.stats.cardsPlayed);
  add('Damage dealt', state.stats.damageDealt);
  add('Creatures summoned', state.stats.creaturesSummoned);
  overlay.appendChild(stats);
  const again = el('button', 'big-button', '↻  Play Again');
  again.addEventListener('click', () => handlers.onPlayAgain());
  overlay.appendChild(again);
  stage.appendChild(overlay);
}

/** The legally playable targets for the selected card, for the input layer. */
export function targetsFor(state, side, card) {
  return legalTargets(state, side, card);
}
