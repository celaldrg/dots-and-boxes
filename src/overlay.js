/**
 * The game-over card shown over the board.
 */
import { playerNameKey, resultMessage } from './status.js';
import { byId, html } from './dom.js';

/**
 * @typedef {ReturnType<typeof import('./game.js').getState>} GameState
 * @typedef {(key: string, params?: Record<string, string | number>) => string} Translate
 *
 * @typedef {object} OverlayHandlers
 * @property {() => void} onPlayAgain
 * @property {() => void} onChangeSetup
 * @property {() => void} onShowBoard the card was closed to look at the final board
 *
 * @typedef {object} Overlay
 * @property {(state: GameState, recordLine: string, t: Translate) => void} show
 *   shows (or refreshes) the result; focuses "Play again" when it appears
 * @property {() => void} hide
 */

/**
 * Binds the overlay to its elements in the page.
 * @param {OverlayHandlers} handlers
 * @returns {Overlay}
 */
export function createOverlay(handlers) {
  const root = byId('overlay');
  const title = byId('result-title');
  const score = byId('result-score');
  const record = byId('result-record');
  const playAgain = byId('play-again');

  playAgain.addEventListener('click', () => handlers.onPlayAgain());
  byId('change-setup').addEventListener('click', () => handlers.onChangeSetup());
  byId('show-board').addEventListener('click', () => {
    root.hidden = true;
    handlers.onShowBoard();
  });

  return {
    show(state, recordLine, t) {
      const message = resultMessage(state);
      const name = message.player === null ? '' : t(playerNameKey(state.mode, message.player));
      title.textContent = t(message.key, { name });
      score.replaceChildren(
        html('span', { class: 'p0' }, String(state.scores[0])),
        document.createTextNode(' – '),
        html('span', { class: 'p1' }, String(state.scores[1])),
      );
      record.textContent = recordLine;
      record.hidden = recordLine === '';
      root.dataset.result = message.player === null ? 'draw' : `p${message.player}`;
      if (root.hidden) {
        root.hidden = false;
        playAgain.focus();
      }
    },
    hide() {
      root.hidden = true;
    },
  };
}
