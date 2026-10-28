/**
 * Every string the page shows, in English and Turkish. Placeholders look like
 * {name} and are filled by translate().
 */

export const LANGUAGES = Object.freeze(['en', 'tr']);
const DEFAULT_LANGUAGE = 'en';

const en = {
  title: 'Dots and Boxes',
  newGame: 'New game',
  restart: 'Restart',
  undo: 'Undo',
  langButton: 'TR',
  langLabel: 'TR: switch to Turkish',
  scoresLabel: 'Scores',
  you: 'You',
  computer: 'Computer',
  player1: 'Player 1',
  player2: 'Player 2',
  youInitial: 'Y',
  computerInitial: 'C',
  player1Initial: '1',
  player2Initial: '2',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  turnYou: 'Your turn',
  turnComputer: 'Computer is thinking…',
  turnPlayer: '{name} to move',
  againYou: 'Box closed! Move again',
  againComputer: 'Computer closed a box and moves again',
  againPlayer: 'Box closed! {name} moves again',
  resultYouWin: 'You win!',
  resultComputerWins: 'The computer wins',
  resultPlayerWins: '{name} wins!',
  resultDraw: "It's a draw",
  gameOver: 'Game over',
  levelRecord: '{level}: {wins} won · {losses} lost · {draws} drawn',
  playAgain: 'Play again',
  changeSetup: 'Change setup',
  showBoard: 'Show board',
  hintTouch: 'Tap near a line between two dots to draw it.',
  hintKeys: 'Click a line, or use the arrow keys and Enter. U undoes, N opens a new game.',
  boardLabel: 'Board of {size} by {size} boxes',
  boardHelp: 'Arrow keys choose a line, Enter or Space draws it.',
  cursorOpen: '{line}, free',
  cursorDrawn: '{line}, already drawn',
  moves: 'Moves',
  noMoves: 'No lines drawn yet.',
  closedBoxes: '+{count}',
  record: 'Record against the computer',
  recordCaption: 'won – lost – drawn',
  recordEmpty: 'Finish a game against the computer to start your record.',
  setupTitle: 'New game',
  boardSize: 'Board size',
  sizeOption: '{n} × {n}',
  mode: 'Mode',
  modeCpu: 'Against the computer',
  modePvp: 'Two players',
  level: 'Computer level',
  starter: 'First move',
  start: 'Start',
  cancel: 'Cancel',
  sourceOnGithub: 'Source on GitHub',
};

/** @type {typeof en} */
const tr = {
  title: 'Noktalar ve Kutular',
  newGame: 'Yeni oyun',
  restart: 'Yeniden başlat',
  undo: 'Geri al',
  langButton: 'EN',
  langLabel: 'EN: İngilizceye geç',
  scoresLabel: 'Skorlar',
  you: 'Sen',
  computer: 'Bilgisayar',
  player1: 'Oyuncu 1',
  player2: 'Oyuncu 2',
  youInitial: 'S',
  computerInitial: 'B',
  player1Initial: '1',
  player2Initial: '2',
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
  turnYou: 'Sıra sende',
  turnComputer: 'Bilgisayar düşünüyor…',
  turnPlayer: 'Sıra: {name}',
  againYou: 'Kutu senin! Yine oyna',
  againComputer: 'Bilgisayar kutu kapattı, yine oynuyor',
  againPlayer: 'Kutu kapandı! {name} yine oynar',
  resultYouWin: 'Kazandın!',
  resultComputerWins: 'Bilgisayar kazandı',
  resultPlayerWins: '{name} kazandı!',
  resultDraw: 'Berabere',
  gameOver: 'Oyun bitti',
  levelRecord: '{level}: {wins} galibiyet · {losses} mağlubiyet · {draws} beraberlik',
  playAgain: 'Yine oyna',
  changeSetup: 'Ayarları değiştir',
  showBoard: 'Tahtayı göster',
  hintTouch: 'Çizmek için iki nokta arasındaki çizgiye dokun.',
  hintKeys: 'Bir çizgiye tıkla ya da ok tuşları ve Enter ile oyna. U geri alır, N yeni oyun açar.',
  boardLabel: '{size} x {size} kutuluk oyun tahtası',
  boardHelp: 'Ok tuşları çizgi seçer, Enter ya da Boşluk çizer.',
  cursorOpen: '{line}, boş',
  cursorDrawn: '{line}, zaten çizili',
  moves: 'Hamleler',
  noMoves: 'Henüz çizgi çizilmedi.',
  closedBoxes: '+{count}',
  record: 'Bilgisayara karşı sonuçların',
  recordCaption: 'galibiyet – mağlubiyet – beraberlik',
  recordEmpty: 'Bilgisayara karşı bir oyunu bitirdiğinde sonuçların burada görünür.',
  setupTitle: 'Yeni oyun',
  boardSize: 'Tahta boyutu',
  sizeOption: '{n} × {n}',
  mode: 'Oyun türü',
  modeCpu: 'Bilgisayara karşı',
  modePvp: 'İki oyuncu',
  level: 'Bilgisayar seviyesi',
  starter: 'İlk hamle',
  start: 'Başla',
  cancel: 'Vazgeç',
  sourceOnGithub: 'Kaynak kodu GitHub’da',
};

/** All strings by language, read-only. */
export const MESSAGES = Object.freeze({ en: Object.freeze(en), tr: Object.freeze(tr) });

/**
 * A supported language code: the value itself when it is one, else English.
 * @param {unknown} value
 * @returns {'en' | 'tr'}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * The language the toggle switches to.
 * @param {'en' | 'tr'} lang
 * @returns {'en' | 'tr'}
 */
export function otherLanguage(lang) {
  return lang === 'tr' ? 'en' : 'tr';
}

/**
 * Looks up a string and fills its {placeholders}. Unknown keys fall back to
 * English, then to the key itself; unknown placeholders are left as they are.
 * @param {'en' | 'tr'} lang
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = MESSAGES[normalizeLanguage(lang)];
  const text = Object.hasOwn(table, key) ? table[key] : Object.hasOwn(en, key) ? en[key] : key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}
