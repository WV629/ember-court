// Input: mouse clicks and keyboard shortcuts, translated into engine calls.
// Click a card to select it; click a highlighted target to play it there.
// Spells that need no target play at once. 1-7 selects, Enter ends the turn.

import { canPlay, endTurn, legalTargets, playCard } from './engine.js';

/** Fresh interaction state for one duel. */
export function newUi() {
  return {
    selected: null,
    intent: 'Vex watches the table.',
    seen: new Set(),
    lastLife: {},
  };
}

/**
 * The handlers the renderer wires up. `hooks` lets the app animate the enemy turn
 * and play sounds around each step; `rerender` redraws the table after every action.
 */
export function makeHandlers(state, ui, hooks) {
  const rerender = () => hooks.rerender();

  function selectedCard() {
    if (ui.selected === null) return null;
    return state.player.hand.find((c) => c.uid === ui.selected) ?? null;
  }

  function onCardClick(uid) {
    if (state.phase !== 'play' || state.active !== 'player') return;
    const card = state.player.hand.find((c) => c.uid === uid);
    if (!card) return;
    if (ui.selected === uid) { ui.selected = null; rerender(); return; }
    if (!canPlay(state, state.player, card)) {
      hooks.toast(card.def.cost > state.player.mana ? 'Not enough mana.' : 'Cannot play that now.');
      return;
    }
    ui.selected = uid;
    hooks.sfx('select');
    if (card.def.kind === 'spell' && card.def.target !== 'any') {
      // A spell with no target plays at once; one with 'any' waits for a target.
      playSelected(null);
      return;
    }
    if (card.def.kind === 'creature') {
      playSelected(null);
      return;
    }
    rerender();
  }

  function playSelected(target) {
    const card = selectedCard();
    if (!card) return;
    if (card.def.kind === 'spell' && card.def.target === 'any' && !target) return;
    if (playCard(state, state.player, card, target)) {
      hooks.sfx('play');
      ui.selected = null;
      rerender();
      if (state.phase === 'over') hooks.onGameOver();
    } else {
      hooks.toast('That play is not legal.');
      rerender();
    }
  }

  function onTargetClick(target) {
    const card = selectedCard();
    if (!card) return;
    if (card.def.kind === 'spell' && card.def.target === 'any') {
      if (target === 'enemy-warden') {
        playSelected({ kind: 'warden', owner: 'enemy' });
      } else if (target.startsWith('creature:')) {
        const uid = Number(target.slice('creature:'.length));
        const victim = state.enemy.board.find((c) => c.uid === uid);
        if (victim) playSelected({ kind: 'creature', card: victim });
      }
    }
  }

  function onEndTurn() {
    if (state.phase !== 'play' || state.active !== 'player') return;
    ui.selected = null;
    hooks.sfx('end');
    hooks.enemyTurn();
  }

  function onKey(event) {
    if (state.phase !== 'play') return;
    if (event.key >= '1' && event.key <= '7') {
      const index = Number(event.key) - 1;
      const card = state.player.hand[index];
      if (card) onCardClick(card.uid);
    } else if (event.key === 'Enter') {
      onEndTurn();
    } else if (event.key === 'Escape') {
      ui.selected = null;
      rerender();
    }
  }

  return {
    onCardClick,
    onTargetClick,
    onEndTurn,
    onKey,
    selectedCard,
    /** Whether a card in hand can be played right now (for the renderer). */
    canPlayCard: (card) => canPlay(state, state.player, card),
    /** Legal targets for the selected card, for highlighting. */
    selectedTargets: () => {
      const card = selectedCard();
      return card ? legalTargets(state, state.player, card) : [];
    },
  };
}
