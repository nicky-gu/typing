'use strict';

const PROGRESS_KEY = 'typing_progress_v1';

const KB_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

// 数字行下方的常用符号（小键盘提示用）
const KB_SYMBOLS = [',', '.', "'", '"', ';', ':', '?', '!', '(', ')', '[', ']', '-', '=', '@', '#'];

// 每个键对应的手指（标准指法，传统 QWERTY 英文键盘）
const FINGER = {
  // 字母
  a: '左手小指', s: '左无名指', d: '左中指', f: '左食指', g: '左食指',
  q: '左小指', w: '左无名指', e: '左中指', r: '左食指', t: '左食指',
  z: '左小指', x: '左无名指', c: '左中指', v: '左食指', b: '左食指',
  ';': '右手小指', l: '右无名指', k: '右中指', j: '右食指', h: '右食指',
  p: '右小指', o: '右无名指', i: '右中指', u: '右食指', y: '右食指',
  m: '右食指', n: '右食指',
  // 数字（与上方符号同键，手指一致）
  '1': '左手小指', '2': '左无名指', '3': '左中指', '4': '左食指', '5': '左食指',
  '6': '右食指', '7': '右食指', '8': '右中指', '9': '右无名指', '0': '右小指',
  // 常用符号
  ',': '右食指', '.': '右食指', '/': '右食指', "'": '右手小指', '[': '右小指',
  ']': '右小指', '(': '右小指', ')': '右小指', '-': '右小指', '=': '右小指',
  ':': '右小指', '?': '右食指', '"': '右手小指', '{': '右小指', '}': '右小指',
  '+': '右小指',
  '!': '左手小指', '@': '左无名指', '#': '左中指', '$': '左食指', '%': '左食指',
  '^': '右食指', '&': '右食指', '*': '右中指', ' ': '大拇指',
};

// 取字符对应的手指提示（大写字母提示需按 Shift）
function fingerFor(ch) {
  if (ch >= 'A' && ch <= 'Z') {
    return 'Shift + ' + (FINGER[ch.toLowerCase()] || '任意手指');
  }
  return FINGER[ch] || '任意手指';
}

const state = {
  view: 'home',
  level: null,
  textIndex: 0,
  text: '',
  typed: [],
  startTime: null,
  endTime: null,
  finished: false,
  soundOn: true,
  duration: 0,        // 秒；0 = 不限（打完本段即结束）
  deadline: null,     // 限时模式的截止时间戳
  timerId: null,
  totals: { keystrokes: 0, correct: 0, errors: 0 },
  lessonLevelId: null,
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

// ---------- 时间格式化 ----------
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' + s : s);
}

// ---------- 指标计算（整场累计） ----------
function computeSessionMetrics() {
  const keystrokes = state.totals.keystrokes;
  const correct = state.totals.correct;
  const errors = state.totals.errors;
  const ms = state.startTime ? ((state.endTime || Date.now()) - state.startTime) : 0;
  const minutes = ms / 60000;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const acc = keystrokes > 0 ? Math.round((correct / keystrokes) * 100) : 100;
  const errorRate = keystrokes > 0 ? Math.round((errors / keystrokes) * 100) : 0;
  return { wpm, acc, errors, correct, keystrokes, ms, errorRate };
}

// ---------- 视图切换 ----------
function showView(name) {
  state.view = name;
  document.getElementById('home-view').hidden = name !== 'home';
  document.getElementById('lesson-view').hidden = name !== 'lesson';
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
    const badge = lv.random ? '<div class="lv-badge">🎲 随机</div>' : '';
    card.innerHTML =
      '<div class="lv-title">' + lv.title + '</div>' +
      badge +
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

// ---------- 课前教材（小课堂） ----------
function buildLessonKeyboard(focus) {
  const kb = document.getElementById('lesson-keyboard');
  kb.innerHTML = '';
  const focusSet = new Set(focus || []);
  const renderRow = (row) => {
    const r = document.createElement('div');
    r.className = 'kb-row';
    row.forEach((k) => {
      const b = document.createElement('div');
      b.className = 'key' + (focusSet.has(k) ? ' focus' : '');
      b.dataset.key = k;
      b.textContent = k === ' ' ? '空格' : k;
      r.appendChild(b);
    });
    kb.appendChild(r);
  };
  KB_ROWS.forEach(renderRow);
  const symRow = document.createElement('div');
  symRow.className = 'kb-row';
  KB_SYMBOLS.forEach((k) => {
    const b = document.createElement('div');
    b.className = 'key' + (focusSet.has(k) ? ' focus' : '');
    b.dataset.key = k;
    b.textContent = k;
    symRow.appendChild(b);
  });
  kb.appendChild(symRow);
  const spaceRow = document.createElement('div');
  spaceRow.className = 'kb-row';
  const sp = document.createElement('div');
  sp.className = 'key space' + (focusSet.has(' ') ? ' focus' : '');
  sp.dataset.key = ' ';
  sp.textContent = '空格';
  spaceRow.appendChild(sp);
  kb.appendChild(spaceRow);
}

function showLesson(levelId) {
  const lv = LESSONS.find((l) => l.id === levelId);
  if (!lv) return;
  state.lessonLevelId = levelId;
  document.getElementById('lesson-title').textContent = lv.title;
  document.getElementById('lesson-goal').textContent = (lv.material && lv.material.goal) || '';
  document.getElementById('lesson-tip').textContent = (lv.material && lv.material.tip) || '';
  document.getElementById('lesson-example').textContent = (lv.material && lv.material.example) || '';
  buildLessonKeyboard(lv.focus);
  showView('lesson');
}

function startLevel(levelId) {
  const lv = LESSONS.find((l) => l.id === levelId);
  if (!lv) return;
  stopTimer();
  state.level = lv;
  state.textIndex = Math.floor(Math.random() * lv.texts.length);
  state.text = lv.texts[state.textIndex];
  state.typed = [];
  state.totals = { keystrokes: 0, correct: 0, errors: 0 };
  state.startTime = null;
  state.endTime = null;
  state.finished = false;
  state.deadline = null;
  ensureAudio();
  document.getElementById('m-wpm').textContent = '0';
  document.getElementById('m-acc').textContent = '100%';
  document.getElementById('m-err').textContent = '0';
  document.getElementById('m-time').textContent =
    state.duration > 0 ? '剩 ' + fmtTime(state.duration) : '0s';
  renderText();
  showView('play');
  updateMetrics();
}

function advanceText() {
  const texts = state.level.texts;
  let idx;
  if (state.level.random) {
    // 随机练习：随机抽取（尽量不与当前段重复）
    do {
      idx = Math.floor(Math.random() * texts.length);
    } while (texts.length > 1 && idx === state.textIndex);
  } else {
    idx = (state.textIndex + 1) % texts.length;
  }
  state.textIndex = idx;
  state.text = texts[idx];
  state.typed = [];
  renderText();
}

function renderText() {
  const c = document.getElementById('text-display');
  c.innerHTML = '';
  for (let i = 0; i < state.text.length; i++) {
    const span = document.createElement('span');
    const ch = state.text[i];
    span.textContent = ch === ' ' ? ' ' : ch;
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
  const m = computeSessionMetrics();
  document.getElementById('m-wpm').textContent = m.wpm;
  document.getElementById('m-acc').textContent = m.acc + '%';
  document.getElementById('m-err').textContent = m.errors;
  const tEl = document.getElementById('m-time');
  if (state.duration > 0) {
    const remain = state.deadline ? (state.deadline - Date.now()) / 1000 : state.duration;
    tEl.textContent = '剩 ' + fmtTime(remain);
  } else {
    const ms = state.startTime ? Date.now() - state.startTime : 0;
    tEl.textContent = Math.floor(ms / 1000) + 's';
  }
}

function highlightKey(key) {
  const keys = document.querySelectorAll('#keyboard .key');
  const base = key == null ? null
    : (key >= 'A' && key <= 'Z' ? key.toLowerCase() : key);
  keys.forEach((k) => {
    k.classList.remove('active');
    if (base != null && k.dataset.key === base) k.classList.add('active');
  });
  const hint = document.getElementById('finger-hint');
  hint.textContent = key != null ? '用：' + fingerFor(key) : '';
}

// ---------- 计时器（限时模式） ----------
function startTimer() {
  stopTimer();
  state.deadline = Date.now() + state.duration * 1000;
  state.timerId = setInterval(() => {
    const remain = (state.deadline - Date.now()) / 1000;
    if (remain <= 0) {
      updateMetrics();
      endSession();
      return;
    }
    updateMetrics();
  }, 250);
}
function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function endSession() {
  if (state.finished) return;
  state.finished = true;
  state.endTime = Date.now();
  stopTimer();
  const m = computeSessionMetrics();
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
  document.getElementById('result-title').textContent =
    state.duration > 0 ? '时间到！来看看成绩' : '完成啦！';
  const earned = '★'.repeat(stars);
  const empty = '☆'.repeat(3 - stars);
  document.getElementById('result-stars').textContent = earned + empty;
  document.getElementById('r-wpm').textContent = m.wpm;
  document.getElementById('r-acc').textContent = m.acc + '%';
  document.getElementById('r-errrate').textContent = m.errorRate + '%';
  document.getElementById('r-time').textContent = fmtTime(m.ms / 1000);
  document.getElementById('r-chars').textContent = m.correct;
  document.getElementById('r-keys').textContent = m.keystrokes;
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
  const symRow = document.createElement('div');
  symRow.className = 'kb-row';
  KB_SYMBOLS.forEach((k) => {
    const b = document.createElement('div');
    b.className = 'key';
    b.dataset.key = k;
    b.textContent = k;
    symRow.appendChild(b);
  });
  kb.appendChild(symRow);
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
    return;
  }

  if (e.key.length === 1) {
    if (state.startTime === null) {
      state.startTime = Date.now();
      if (state.duration > 0) startTimer();
    }
    const expected = state.text[state.typed.length];
    const correct = e.key === expected;
    state.typed.push(e.key);
    state.totals.keystrokes++;
    if (correct) state.totals.correct++;
    else state.totals.errors++;
    e.preventDefault();
    playKeySound(correct);
    renderText();
    updateMetrics();
    if (state.typed.length >= state.text.length) {
      if (state.duration > 0) advanceText();
      else endSession();
    }
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

  document.getElementById('back-btn').addEventListener('click', () => {
    stopTimer();
    renderHome();
  });

  document.querySelectorAll('.dur-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.duration = parseInt(b.dataset.dur, 10) || 0;
    });
  });

  document.getElementById('level-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.level-card');
    if (card) showLesson(card.dataset.level);
  });

  document.getElementById('lesson-back').addEventListener('click', () => renderHome());
  document.getElementById('lesson-start').addEventListener('click', () => {
    if (state.lessonLevelId) startLevel(state.lessonLevelId);
  });

  document.getElementById('retry-btn').addEventListener('click', () => startLevel(state.level.id));
  document.getElementById('home-btn').addEventListener('click', () => {
    stopTimer();
    renderHome();
  });
}

document.addEventListener('DOMContentLoaded', init);
