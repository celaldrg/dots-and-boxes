/**
 * Entry point: connects the game logic to the page, runs the computer player
 * and keeps the language, setup and record in storage.
 */
import { lineLabel } from './board.js';
import { canUndo, computerMove, createGame, getState, isComputerTurn, isOver, playLine, undo } from './game.js';
import { createDemoGame } from './demo.js';
import { normalizeLanguage, otherLanguage, translate } from './i18n.js';
import { normalizeSettings } from './settings.js';
import { normalizeStats, recordResult } from './stats.js';
import { playerInitialKey } from './status.js';
import { storage } from './storage.js';
import { applyTexts, byId } from './dom.js';
import { createBoardView } from './board-view.js';
import { createOverlay } from './overlay.js';
import { createPanel } from './panel.js';
import { createSetupDialog } from './setup-dialog.js';

/** Pause before each computer line, so its moves can be followed. */
const COMPUTER_DELAY_MS = 350;
const DEMO_SETTINGS = Object.freeze({ size: 5, mode: 'cpu', level: 'hard', starter: 0 });
const DEMO_SEED = 2026;

const demo = new URLSearchParams(window.location.search).has('demo');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const app = {
  lang: normalizeLanguage(storage.load('lang', null)),
  settings: demo ? { ...DEMO_SETTINGS } : normalizeSettings(storage.load('settings', null)),
  stats: normalizeStats(storage.load('stats', null)),
  game: null,
  timer: 0,
  countsForRecord: false,
  resultDismissed: false,
};

/** @type {import('./panel.js').Translate} */
const t = (key, params) => translate(app.lang, key, params);

const elements = {
  board: byId('board'),
  frame: byId('board-frame'),
  cursorLive: byId('cursor-live'),
  undo: byId('undo'),
  restart: byId('restart'),
};

const board = createBoardView(elements.board, { onPick: playHumanLine, onCursor: announceCursor });
const panel = createPanel();
const overlay = createOverlay({
  onPlayAgain: () => {
    startGame();
    elements.board.focus();
  },
  onChangeSetup: openSetup,
  onShowBoard: () => {
    app.resultDismissed = true;
    elements.board.focus();
  },
});
const setup = createSetupDialog({
  onStart: (settings) => {
    app.settings = settings;
    storage.save('settings', settings);
    startGame();
  },
});

/**
 * Starts a game and shows it.
 * @param {import('./game.js').Game} [game] defaults to a new game with the current settings
 * @param {boolean} [countsForRecord] whether its result goes into the record
 */
function startGame(game = createGame({ ...app.settings, seed: randomSeed() }), countsForRecord = true) {
  window.clearTimeout(app.timer);
  app.game = game;
  app.countsForRecord = countsForRecord && game.mode === 'cpu';
  app.resultDismissed = false;
  overlay.hide();
  board.reset(game.topology);
  clearCursorAnnouncement();
  panel.reset();
  render();
  scheduleComputer();
}

function render() {
  const state = getState(app.game);
  const interactive = !state.over && !state.computerTurn;
  board.update(state, { interactive, initials: [0, 1].map((player) => t(playerInitialKey(state.mode, player))) });
  panel.render(state, app.stats, t);
  elements.board.setAttribute('aria-label', t('boardLabel', { size: state.size }));
  elements.frame.dataset.turn = state.over ? 'over' : String(state.turn);
  elements.undo.disabled = !state.canUndo || state.over;
  elements.restart.classList.toggle('btn-accent', state.over);
  if (state.over && !app.resultDismissed) overlay.show(state, recordLine(state), t);
  else overlay.hide();
}

function playHumanLine(line) {
  if (isOver(app.game) || isComputerTurn(app.game)) return;
  const result = playLine(app.game, line);
  if (result) afterMove(result);
}

function afterMove(result) {
  if (result.over) recordFinishedGame();
  render();
  scheduleComputer();
}

function scheduleComputer() {
  window.clearTimeout(app.timer);
  if (!isComputerTurn(app.game)) return;
  app.timer = window.setTimeout(playComputerLine, reducedMotion.matches ? 0 : COMPUTER_DELAY_MS);
}

function playComputerLine() {
  if (!isComputerTurn(app.game)) return;
  afterMove(playLine(app.game, computerMove(app.game)));
}

function recordFinishedGame() {
  if (!app.countsForRecord) return;
  app.countsForRecord = false;
  app.stats = recordResult(app.stats, app.game.level, getState(app.game).outcome.winner);
  storage.save('stats', app.stats);
}

function recordLine(state) {
  if (state.mode !== 'cpu') return '';
  return t('levelRecord', { level: t(state.level), ...app.stats[state.level] });
}

function undoMove() {
  if (!canUndo(app.game) || isOver(app.game)) return;
  window.clearTimeout(app.timer);
  undo(app.game);
  render();
  scheduleComputer();
}

function openSetup() {
  if (!setup.isOpen()) setup.open(app.settings, t);
}

function announceCursor(line) {
  const key = app.game.lines[line] >= 0 ? 'cursorDrawn' : 'cursorOpen';
  elements.cursorLive.textContent = t(key, { line: lineLabel(app.game.topology, line) });
}

/** Drops the last cursor announcement once it is out of date (new language or new board). */
function clearCursorAnnouncement() {
  elements.cursorLive.textContent = '';
}

function setLanguage(lang) {
  app.lang = lang;
  storage.save('lang', lang);
  applyLanguage();
  render();
}

function applyLanguage() {
  document.documentElement.lang = app.lang;
  document.title = t('title');
  applyTexts(document, t);
  setup.relabel(t);
  clearCursorAnnouncement();
}

/** Global shortcuts: U (or Ctrl/Cmd+Z) undoes, N opens the new game dialog. */
function onShortcut(event) {
  if (event.defaultPrevented || event.altKey || event.repeat || setup.isOpen() || typeof event.key !== 'string') return;
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  if ((key === 'u' && !command) || (key === 'z' && command && !event.shiftKey)) {
    event.preventDefault();
    undoMove();
  } else if (key === 'n' && !command) {
    event.preventDefault();
    openSetup();
  }
}

function randomSeed() {
  return window.crypto.getRandomValues(new Uint32Array(1))[0];
}

byId('new-game').addEventListener('click', openSetup);
byId('lang').addEventListener('click', () => setLanguage(otherLanguage(app.lang)));
elements.undo.addEventListener('click', undoMove);
elements.restart.addEventListener('click', () => startGame());
document.addEventListener('keydown', onShortcut);

applyLanguage();
if (demo) startGame(createDemoGame({ level: DEMO_SETTINGS.level, seed: DEMO_SEED }), false);
else startGame();
