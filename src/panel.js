/**
 * Score cards, status line, move history and the record against the computer.
 */
import { LEVELS } from './ai.js';
import { getTopology, lineLabel } from './board.js';
import { COMPUTER } from './game.js';
import { playerInitialKey, playerNameKey, statusMessage } from './status.js';
import { byId, html, setClass } from './dom.js';

/**
 * @typedef {ReturnType<typeof import('./game.js').getState>} GameState
 * @typedef {(key: string, params?: Record<string, string | number>) => string} Translate
 *
 * @typedef {object} Panel
 * @property {() => void} reset forgets the shown scores (a new game starts)
 * @property {(state: GameState, stats: import('./stats.js').Stats, t: Translate) => void} render
 */

/**
 * Binds the panel to its elements in the page.
 * @returns {Panel}
 */
export function createPanel() {
  const players = [0, 1].map((player) => ({
    card: byId(`player-${player}`),
    avatar: byId(`avatar-${player}`),
    name: byId(`name-${player}`),
    detail: byId(`detail-${player}`),
    score: byId(`score-${player}`),
  }));
  const status = byId('status');
  const history = { list: byId('history'), empty: byId('history-empty'), count: byId('move-count') };
  const record = { grid: byId('record-grid'), caption: byId('record-caption'), empty: byId('record-empty') };
  let shownScores = [0, 0];
  history.list.addEventListener('scroll', () => markScrolled(history.list), { passive: true });

  return {
    reset() {
      shownScores = [0, 0];
    },
    render(state, stats, t) {
      renderPlayers(players, state, shownScores, t);
      shownScores = [...state.scores];
      renderStatus(status, state, t);
      renderHistory(history, state, t);
      renderRecord(record, stats, state, t);
    },
  };
}

function renderPlayers(players, state, shownScores, t) {
  const winner = state.outcome ? state.outcome.winner : null;
  players.forEach((view, player) => {
    const active = !state.over && state.turn === player;
    setClass(view.card, `player p${player}${active ? ' active' : ''}${winner === player ? ' winner' : ''}`);
    view.avatar.textContent = t(playerInitialKey(state.mode, player));
    view.name.textContent = t(playerNameKey(state.mode, player));
    const detail = state.mode === 'cpu' && player === COMPUTER ? t(state.level) : '';
    view.detail.textContent = detail;
    view.detail.hidden = detail === '';
    view.score.textContent = String(state.scores[player]);
    if (state.scores[player] > shownScores[player]) bump(view.score);
  });
}

/** Replays the short "score went up" animation. */
function bump(element) {
  element.classList.remove('bump');
  void element.offsetWidth; // a reflow lets the same animation start again
  element.classList.add('bump');
}

function renderStatus(element, state, t) {
  const message = statusMessage(state);
  const name = message.player === null ? '' : t(playerNameKey(state.mode, message.player));
  element.textContent = t(message.key, { name });
  setClass(element, message.player === null ? 'status' : `status p${message.player}`);
}

function renderHistory(view, state, t) {
  const topology = getTopology(state.size);
  const items = state.history.map((move, index) => moveItem(move, index, state.mode, topology, t));
  view.list.replaceChildren(...items);
  view.list.hidden = items.length === 0;
  view.empty.hidden = items.length > 0;
  view.count.textContent = items.length > 0 ? String(items.length) : '';
  view.count.hidden = items.length === 0;
  view.list.scrollTop = view.list.scrollHeight;
  markScrolled(view.list);
}

/** Fades the top edge of the list while earlier moves are scrolled out of view. */
function markScrolled(list) {
  list.classList.toggle('scrolled', list.scrollTop > 0);
}

function moveItem(move, index, mode, topology, t) {
  const item = html('li', { class: `move p${move.player}` });
  item.append(
    html('span', { class: 'move-no' }, `${index + 1}.`),
    html('span', { class: 'chip', 'aria-hidden': 'true' }, t(playerInitialKey(mode, move.player))),
    html('span', { class: 'visually-hidden' }, t(playerNameKey(mode, move.player))),
    html('span', { class: 'move-line' }, lineLabel(topology, move.line)),
  );
  if (move.boxes.length > 0) {
    item.append(html('span', { class: 'move-boxes' }, t('closedBoxes', { count: move.boxes.length })));
  }
  return item;
}

function renderRecord(view, stats, state, t) {
  const played = LEVELS.some((level) => stats[level].wins + stats[level].losses + stats[level].draws > 0);
  view.grid.hidden = !played;
  view.caption.hidden = !played;
  view.empty.hidden = played;
  view.grid.replaceChildren(...LEVELS.map((level) => recordCell(level, stats[level], state, t)));
}

function recordCell(level, counts, state, t) {
  const current = state.mode === 'cpu' && state.level === level;
  const cell = html('div', { class: current ? 'record-cell current' : 'record-cell' });
  cell.append(
    html('span', { class: 'record-level' }, t(level)),
    html('span', { class: 'record-nums' }, `${counts.wins}–${counts.losses}–${counts.draws}`),
  );
  return cell;
}
