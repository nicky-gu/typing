'use strict';

const PROGRESS_KEY = 'typing_progress_v1';

const KB_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

// 每个键对应的手指（标准指法）
const FINGER = {
  a: '左手小指', s: '左无名指', d: '左中指', f: '左食指', g: '左食指',
  q: '左小指', w: '左无名指', e: '左中指', r: '左食指', t: '左食指',
  z: '左小指', x: '左无名指', c: '左中指', v: '左食指', b: '左食指',
  ';': '右手小指', l: '右无名指', k: '右中指', j: '右食指', h: '右食指',
  p: '右小指', o: '右无名指', i: '右中指', u: '右食指', y: '右食指',
  m: '右食指', n: '右食指', ' ': '大拇指',
};

const state = {
  view: 'home',
  level: null,
  text: '',
  typed: [],
  startTime: null,
  endTime: null,
  finished: false,
  soundOn: true,
};

let audioCtx = null;

// ---------- 进度（本地优先） ----------
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { levels: {} };
  } catch (e) {
    return { levels: {} };
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (e) { /* 忽略写入失败 */ }
}

// ---------- 音效（Web Audio，无外部资源） ----------
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type) {
  if (!state.soundOn || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.value = 0.05;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
function playKeySound(correct) {
  ensureAudio();
  if (correct) beep(680, 0.06, 'sine');
  else beep(170, 0.12, 'square');
}

// ---------- 指标计算 ----------
function computeMetrics() {
  const typed = state.typed;
  const text = state.text;
  let correct = 0;
  const n = Math.min(typed.length, text.length);
  for (let i = 0; i < n; i++) {
    if (typed[i] === text[i]) correct++;
  }
  const ms = state.startTime ? (state.endTime || Date.now()) - state.startTime : 0;
  const minutes = ms / 60000;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const acc = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  const errors = typed.length - correct;
  return { wpm, acc, errors, correct, ms };
}

// ---------- 视图切换 ----------
function showView(name) {
  state.view = name;
  document.getElementById('home-view').hidden = name !== 'home';
  document.getElementById('play-view').hidden = name !== 'play';
  document.getElementById('result-view').hidden = name !== 'result';
}

function renderHome() {
  const prog = loadProgress();
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  LESSONS.forEach((lv) => {
    const p = prog.levels[lv.id] || { stars: 0, bestWpm: 0, bestAcc: 0 };
    const card = document.createElement('button');
    card.className = 'level-card';
    card.dataset.level = lv.id;
    const earned = '★'.repeat(p.stars);
    const empty = '☆'.repeat(3 - p.stars);
    card.innerHTML =
      '<div class="lv-title">' + lv.title + '</div>' +
      '<div class="lv-desc">' + lv.desc + '</div>' +
      '<div class="lv-stars">' + earned + empty + '</div>' +
      '<div class="lv-best">最佳 ' + p.bestWpm + ' WPM · ' + p.bestAcc + '%</div>';
    grid.appendChild(card);
  });
  const totalSec = prog.totalSec || 0;
  const sessions = prog.sessions || 0;
  const mins = Math.floor(totalSec / 60);
  document.getElementById('home-stats').textContent =
    '累计练习 ' + mins + ' 分钟 · 完成 ' + sessions + ' 次';
  showView('home');
}

function startLevel(levelId) {
  const lv = LESSONS.find((l) => l.id === levelId);
  if (!lv) return;
  state.level = lv;
  state.text = lv.texts[Math.floor(Math.random() * lv.texts.length)];
  state.typed = [];
  state.startTime = null;
  state.endTime = null;
  state.finished = false;
  ensureAudio();
  document.getElementById('m-wpm').textContent = '0';
  document.getElementById('m-acc').textContent = '100%';
  document.getElementById('m-time').textContent = '0s';
  document.getElementById('m-err').textContent = '0';
  renderText();
  showView('play');
  updateMetrics();
}

function renderText() {
  const c = document.getElementById('text-display');
  c.innerHTML = '';
  for (let i = 0; i < state.text.length; i++) {
    const span = document.createElement('span');
    const ch = state.text[i];
    span.textContent = ch === ' ' ? ' ' : ch;
    if (i < state.typed.length) {
      span.className = state.typed[i] === ch ? 'correct' : 'wrong';
    } else if (i === state.typed.length) {
      span.className = 'current';
    } else {
      span.className = 'pending';
    }
    c.appendChild(span);
  }
  highlightKey(state.text[state.typed.length] != null ? state.text[state.typed.length] : null);
}

function updateMetrics() {
  const m = computeMetrics();
  document.getElementById('m-wpm').textContent = m.wpm;
  document.getElementById('m-acc').textContent = m.acc + '%';
  document.getElementById('m-err').textContent = m.errors;
  document.getElementById('m-time').textContent = Math.floor(m.ms / 1000) + 's';
}

function highlightKey(key) {
  const keys = document.querySelectorAll('#keyboard .key');
  keys.forEach((k) => k.classList.remove('active'));
  if (key != null) {
    const el = document.querySelector('#keyboard .key[data-key="' + key + '"]');
    if (el) el.classList.add('active');
  }
  const hint = document.getElementById('finger-hint');
  hint.textContent = key != null ? '用：' + (FINGER[key] || '任意手指') : '';
}

function finishLevel() {
  state.finished = true;
  state.endTime = Date.now();
  const m = computeMetrics();
  const stars = m.acc >= 98 ? 3 : m.acc >= 92 ? 2 : m.acc >= 80 ? 1 : 0;
  const prog = loadProgress();
  const prev = prog.levels[state.level.id] || { bestWpm: 0, bestAcc: 0, stars: 0, plays: 0 };
  prog.levels[state.level.id] = {
    bestWpm: Math.max(prev.bestWpm, m.wpm),
    bestAcc: Math.max(prev.bestAcc, m.acc),
    stars: Math.max(prev.stars, stars),
    plays: prev.plays + 1,
  };
  prog.totalSec = (prog.totalSec || 0) + Math.round(m.ms / 1000);
  prog.sessions = (prog.sessions || 0) + 1;
  saveProgress(prog);
  renderResult(m, stars);
}

function renderResult(m, stars) {
  showView('result');
  const earned = '★'.repeat(stars);
  const empty = '☆'.repeat(3 - stars);
  document.getElementById('result-stars').textContent = earned + empty;
  document.getElementById('r-wpm').textContent = m.wpm;
  document.getElementById('r-acc').textContent = m.acc + '%';
  document.getElementById('r-time').textContent = Math.floor(m.ms / 1000) + 's';
  document.getElementById('r-err').textContent = m.errors;
  let msg;
  if (stars === 3) msg = '太棒了！你已经是打字小勇士啦！';
  else if (stars === 2) msg = '很好！再细心一点就能拿三星！';
  else if (stars === 1) msg = '不错哦，继续练习会更准更快！';
  else msg = '别灰心，多练几次就好啦！';
  document.getElementById('result-msg').textContent = msg;
}

// ---------- 屏幕键盘 ----------
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'kb-row';
    row.forEach((k) => {
      const b = document.createElement('div');
      b.className = 'key';
      b.dataset.key = k;
      b.textContent = k === ' ' ? '空格' : k;
      r.appendChild(b);
    });
    kb.appendChild(r);
  });
  const spaceRow = document.createElement('div');
  spaceRow.className = 'kb-row';
  const sp = document.createElement('div');
  sp.className = 'key space';
  sp.dataset.key = ' ';
  sp.textContent = '空格';
  spaceRow.appendChild(sp);
  kb.appendChild(spaceRow);
}

// ---------- 输入处理 ----------
window.addEventListener('keydown', (e) => {
  if (state.view !== 'play' || state.finished) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (state.typed.length > 0) state.typed.pop();
    renderText();
    updateMetrics();
    return;
  }

  if (e.key.length === 1) {
    if (state.startTime === null) state.startTime = Date.now();
    const expected = state.text[state.typed.length];
    const correct = e.key === expected;
    state.typed.push(e.key);
    e.preventDefault();
    playKeySound(correct);
    renderText();
    updateMetrics();
    if (state.typed.length >= state.text.length) finishLevel();
  }
});

// ---------- 事件绑定 ----------
function init() {
  buildKeyboard();
  renderHome();

  document.getElementById('sound-toggle').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    document.getElementById('sound-toggle').textContent = '声音：' + (state.soundOn ? '开' : '关');
    if (state.soundOn) ensureAudio();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('确定要清空所有练习进度吗？')) {
      localStorage.removeItem(PROGRESS_KEY);
      renderHome();
    }
  });

  document.getElementById('back-btn').addEventListener('click', () => renderHome());

  document.getElementById('level-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.level-card');
    if (card) startLevel(card.dataset.level);
  });

  document.getElementById('retry-btn').addEventListener('click', () => startLevel(state.level.id));
  document.getElementById('home-btn').addEventListener('click', () => renderHome());
}

document.addEventListener('DOMContentLoaded', init);
