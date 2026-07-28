'use strict';

const PROGRESS_KEY = 'typing_progress_v1';
const SESSIONS_KEY = 'typing_sessions_v1';   // 每次完成的练习记录（趋势线用）
const KB_VISIBLE_KEY = 'typing_kb_visible_v1'; // 键盘显隐开关状态

// 组合键小工具：主字符 + 上档字符（用于显示数字与符号共用同一颗键的传统布局）
function kPair(b, s) { return b + (s || ''); }

// 传统英文键盘布局：数字与符号共用同一颗键（! 和 1、@ 和 2 …），其余符号归位到各自真实位置
const KB_ROWS = [
  [kPair('1', '!'), kPair('2', '@'), kPair('3', '#'), kPair('4', '$'), kPair('5', '%'),
   kPair('6', '^'), kPair('7', '&'), kPair('8', '*'), kPair('9', '('), kPair('0', ')'),
   kPair('-', '_'), kPair('=', '+')],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', kPair('[', '{'), kPair(']', '}')],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', kPair(';', ':'), kPair("'", '"')],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', kPair(',', '<'), kPair('.', '>'), kPair('/', '?')],
];

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
  // 常用符号（含上档符号，均按主字符所在键的手指）
  ',': '右食指', '.': '右食指', '/': '右食指', '<': '右食指', '>': '右食指', '?': '右食指',
  "'": '右手小指', '"': '右手小指',
  '[': '右小指', ']': '右小指', '{': '右小指', '}': '右小指',
  '(': '右小指', ')': '右小指', '-': '右小指', '_': '右小指',
  '=': '右小指', '+': '右小指', '\\': '右小指', '|': '右小指',
  ':': '右小指',
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
  kbVisible: true,
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

// 趋势线：每次完成的练习记录
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function saveSession(rec) {
  const arr = loadSessions();
  arr.push(rec);
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr.slice(-100)));
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
  document.getElementById('trend-view').hidden = name !== 'trend';
  if (name === 'play' && state.kbVisible) {
    requestAnimationFrame(() => requestAnimationFrame(positionFingers));
  }
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

// ---------- 屏幕键盘通用渲染 ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 生成一颗键的 DOM：composite 为组合键（如 "1!"），单字符键正常显示，组合键上档符号在上、主字符在下
function makeKeyEl(composite, opts) {
  opts = opts || {};
  const b = document.createElement('div');
  let cls = 'key';
  if (opts.bump) cls += ' bump';
  if (opts.focus) cls += ' focus';
  b.className = cls;
  b.dataset.key = composite;
  if (composite === ' ') {
    b.classList.add('space');
    b.innerHTML = '<span class="k-base">空格</span>';
  } else if (composite.length === 1) {
    b.innerHTML = '<span class="k-base">' + escapeHtml(composite) + '</span>';
  } else {
    const base = composite[0];
    const shift = composite.slice(1);
    b.innerHTML = '<span class="k-shift">' + escapeHtml(shift) + '</span>'
      + '<span class="k-base">' + escapeHtml(base) + '</span>';
  }
  return b;
}

// ---------- 课前教材（小课堂） ----------
function buildLessonKeyboard(focus) {
  const kb = document.getElementById('lesson-keyboard');
  kb.innerHTML = '';
  const focusSet = new Set(focus || []);
  // 焦点匹配：组合键包含焦点字符、或被焦点组合键直接命中都算
  const isFocus = (comp) => focusSet.has(comp) || Array.from(comp).some((c) => focusSet.has(c));
  KB_ROWS.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'kb-row';
    row.forEach((kcomp) => {
      r.appendChild(makeKeyEl(kcomp, {
        bump: (kcomp === 'f' || kcomp === 'j'),
        focus: isFocus(kcomp),
      }));
    });
    kb.appendChild(r);
  });
  const spaceRow = document.createElement('div');
  spaceRow.className = 'kb-row';
  spaceRow.appendChild(makeKeyEl(' ', { focus: isFocus(' ') }));
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
    if (base != null && (k.dataset.key === base || (k.dataset.key && k.dataset.key.includes(base)))) {
      k.classList.add('active');
    }
  });
  const hint = document.getElementById('finger-hint');
  hint.textContent = key != null ? '用：' + fingerFor(key) : '';
  let fname = null;
  if (key != null && base != null) fname = FINGER[base] || null;
  highlightHand(fname, base);
}

// ---------- 虚拟手型（透明，覆盖在键盘上） ----------
const HAND_FINGERS = [
  { name: '左小指', home: 'a' },
  { name: '左无名指', home: 's' },
  { name: '左中指', home: 'd' },
  { name: '左食指', home: 'f' },
  { name: '右食指', home: 'j' },
  { name: '右中指', home: 'k' },
  { name: '右无名指', home: 'l' },
  { name: '右手小指', home: ';' },
  { name: '大拇指', home: ' ' },
];

function keyElementFor(key) {
  const keys = document.querySelectorAll('#keyboard .key');
  for (const k of keys) {
    const dk = k.dataset.key || '';
    if (dk === key || dk.includes(key)) return k;
  }
  return null;
}

function keyCenterInKb(key) {
  const el = keyElementFor(key);
  if (!el) return null;
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
}

function buildHand() {
  const kb = document.getElementById('keyboard');
  if (!kb) return;
  let overlay = kb.querySelector('.hand-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'hand-overlay';
    kb.appendChild(overlay);
  }
  if (!overlay.querySelector('.hand-palm')) {
    const palm = document.createElement('div');
    palm.className = 'hand-palm';
    overlay.appendChild(palm);
  }
  HAND_FINGERS.forEach((f) => {
    let fe = overlay.querySelector('.hand-finger[data-finger="' + f.name + '"]');
    if (!fe) {
      fe = document.createElement('div');
      fe.className = 'hand-finger';
      fe.dataset.finger = f.name;
      fe.innerHTML = '<div class="hf-body"><div class="hf-tip"></div><div class="hf-bar"></div></div>';
      overlay.appendChild(fe);
    }
    fe._home = f.home;
  });
  positionFingers();
}

function positionFingers() {
  const kb = document.getElementById('keyboard');
  if (!kb) return;
  const overlay = kb.querySelector('.hand-overlay');
  if (!overlay) return;
  overlay.querySelectorAll('.hand-finger').forEach((fe) => {
    const c = keyCenterInKb(fe._home);
    if (c) {
      fe.style.left = c.x + 'px';
      fe.style.top = c.y + 'px';
    }
  });
}

function highlightHand(fingerName, targetKey) {
  const kb = document.getElementById('keyboard');
  if (!kb) return;
  const overlay = kb.querySelector('.hand-overlay');
  if (!overlay || !fingerName) return;
  const fe = overlay.querySelector('.hand-finger[data-finger="' + fingerName + '"]');
  if (!fe) return;
  let dx = 0, dy = 0;
  if (targetKey) {
    const homeC = keyCenterInKb(fe._home);
    const tgtC = keyCenterInKb(targetKey);
    if (homeC && tgtC) {
      dx = tgtC.x - homeC.x;
      dy = tgtC.y - homeC.y;
    }
  }
  // 先回位，再强制 reflow，让滑动过渡重新生效
  fe.classList.remove('pressing');
  fe.style.transform = '';
  void fe.offsetWidth;
  if (dx !== 0 || dy !== 0) {
    fe.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  fe.classList.add('pressing');
  clearTimeout(fe._t);
  fe._t = setTimeout(() => {
    fe.style.transform = '';
    fe.classList.remove('pressing');
  }, 230);
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
  saveSession({
    ts: Date.now(),
    wpm: m.wpm,
    acc: m.acc,
    errRate: m.errorRate,
    level: state.level.id,
    errors: m.errors,
  });
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

// ---------- 键盘显隐开关 ----------
function applyKbVisibility() {
  const area = document.getElementById('kb-area');
  if (area) area.style.display = state.kbVisible ? '' : 'none';
  const lk = document.getElementById('lesson-keyboard');
  if (lk) lk.style.display = state.kbVisible ? '' : 'none';
  const chk = document.getElementById('kb-hide-check');
  if (chk) chk.checked = !state.kbVisible; // 勾选 = 隐藏
  if (state.kbVisible && state.view === 'play') {
    requestAnimationFrame(() => requestAnimationFrame(positionFingers));
  }
}

// ---------- 趋势线 ----------
function renderTrend() {
  const arr = loadSessions();
  const chart = document.getElementById('trend-chart');
  const summary = document.getElementById('trend-summary');
  if (!arr.length) {
    chart.innerHTML = '';
    summary.textContent = '还没有练习记录～先去练几关，回来就能看到你的进步曲线啦！';
    showView('trend');
    return;
  }
  const W = 640, H = 300, padL = 42, padR = 18, padT = 26, padB = 38;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = arr.length;
  const maxWpm = Math.max.apply(null, arr.map((s) => s.wpm).concat([20]));
  const niceMax = Math.max(10, Math.ceil(maxWpm / 10) * 10);
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yW = (v) => padT + innerH * (1 - v / niceMax);
  const yA = (v) => padT + innerH * (1 - v / 100);

  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const yy = padT + innerH * (1 - g / 4);
    const wv = Math.round((niceMax * g) / 4);
    grid += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="#e6eef6" stroke-width="1"/>';
    grid += '<text x="' + (padL - 6) + '" y="' + (yy + 4) + '" font-size="10" fill="#7a8aa0" text-anchor="end">' + wv + '</text>';
  }

  const wPts = arr.map((s, i) => x(i) + ',' + yW(s.wpm)).join(' ');
  const aPts = arr.map((s, i) => x(i) + ',' + yA(s.acc)).join(' ');
  const wLine = '<polyline fill="none" stroke="#2f9be0" stroke-width="2.5" points="' + wPts + '"/>';
  const aLine = '<polyline fill="none" stroke="#3fb96b" stroke-width="2.5" points="' + aPts + '"/>';

  let dots = '';
  arr.forEach((s, i) => {
    dots += '<circle cx="' + x(i) + '" cy="' + yW(s.wpm) + '" r="3.5" fill="#2f9be0"/>';
    dots += '<circle cx="' + x(i) + '" cy="' + yA(s.acc) + '" r="3.5" fill="#3fb96b"/>';
  });

  let xlab = '';
  const lab = (i, txt) => '<text x="' + x(i) + '" y="' + (H - padB + 18) + '" font-size="10" fill="#7a8aa0" text-anchor="middle">' + txt + '</text>';
  xlab += lab(0, '第1次');
  if (n > 2) xlab += lab(Math.floor(n / 2), '第' + Math.floor(n / 2) + '次');
  xlab += lab(n - 1, '第' + n + '次');

  const legend =
    '<rect x="' + padL + '" y="8" width="12" height="12" rx="3" fill="#2f9be0"/>' +
    '<text x="' + (padL + 18) + '" y="18" font-size="11" fill="#27384a">速度(WPM)</text>' +
    '<rect x="' + (padL + 110) + '" y="8" width="12" height="12" rx="3" fill="#3fb96b"/>' +
    '<text x="' + (padL + 128) + '" y="18" font-size="11" fill="#27384a">正确率(%)</text>';

  chart.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="打字进步趋势">' +
    grid + wLine + aLine + dots + xlab + legend + '</svg>';

  const avgWpm = Math.round(arr.reduce((a, s) => a + s.wpm, 0) / n);
  const avgAcc = Math.round(arr.reduce((a, s) => a + s.acc, 0) / n);
  const first = arr[0], last = arr[n - 1];
  const trend = last.wpm > first.wpm ? '（↑ 速度进步了！）' : (last.wpm < first.wpm ? '（速度略有波动）' : '');
  summary.innerHTML =
    '共 ' + n + ' 次练习 · 平均速度 ' + avgWpm + ' WPM · 平均正确率 ' + avgAcc + '%<br>' +
    '第一次 ' + first.wpm + ' WPM → 最近一次 ' + last.wpm + ' WPM ' + trend;
  showView('trend');
}

// ---------- 屏幕键盘 ----------
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'kb-row';
    row.forEach((kcomp) => {
      r.appendChild(makeKeyEl(kcomp, { bump: (kcomp === 'f' || kcomp === 'j') }));
    });
    kb.appendChild(r);
  });
  const spaceRow = document.createElement('div');
  spaceRow.className = 'kb-row';
  spaceRow.appendChild(makeKeyEl(' '));
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
  buildHand();
  window.addEventListener('resize', positionFingers);
  state.kbVisible = localStorage.getItem(KB_VISIBLE_KEY) !== '0';
  applyKbVisibility();
  renderHome();

  document.getElementById('sound-toggle').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    document.getElementById('sound-toggle').textContent = '声音：' + (state.soundOn ? '开' : '关');
    if (state.soundOn) ensureAudio();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('确定要清空所有练习进度吗？')) {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(SESSIONS_KEY);
      renderHome();
    }
  });

  const kbHideChk = document.getElementById('kb-hide-check');
  if (kbHideChk) {
    kbHideChk.addEventListener('change', () => {
      state.kbVisible = !kbHideChk.checked; // 勾选 = 隐藏
      try { localStorage.setItem(KB_VISIBLE_KEY, state.kbVisible ? '1' : '0'); } catch (e) {}
      applyKbVisibility();
    });
  }

  const trendBtn = document.getElementById('trend-btn');
  if (trendBtn) trendBtn.addEventListener('click', renderTrend);
  const trendBack = document.getElementById('trend-back');
  if (trendBack) trendBack.addEventListener('click', renderHome);

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
