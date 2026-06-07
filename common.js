/* ===========================================================
   common.js  —  shared helpers for all Play Time! games
   - blocks multi-touch, pinch-zoom, double-tap zoom
   - audio: chime (correct), "uh oh" (wrong), applause (win)
   - speech: speak a word with a male voice, slow & clear
   =========================================================== */

/* ---------- NO MULTITOUCH / NO ZOOM ---------- */
(function () {
  // block pinch-zoom / multi-finger gestures (we only want single-finger drag)
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // block iOS gesture events (pinch)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  // block double-tap-to-zoom — but only when two taps land in the SAME spot quickly,
  // so a normal first tap (and drag taps) are never swallowed
  let lastTouch = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', function (e) {
    const now = Date.now();
    const t = e.changedTouches[0];
    if (t && now - lastTouch < 300 &&
        Math.abs(t.clientX - lastX) < 30 && Math.abs(t.clientY - lastY) < 30) {
      e.preventDefault();
    }
    lastTouch = now;
    if (t) { lastX = t.clientX; lastY = t.clientY; }
  }, { passive: false });
})();

/* ---------- AUDIO ---------- */
let _actx = null;
function _ctx() {
  _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}

// happy ascending chime on a correct match
function playCorrect() {
  try {
    const a = _ctx();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = a.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.27);
    });
  } catch (e) {}
}

// applause / clapping when everything is matched
// applause — place applause.mp3 next to the html files
const _applause = new Audio('applause.mp3'); _applause.preload = 'auto';
function playWin() { try { _applause.currentTime = 0; _applause.play(); } catch (e) {} }

// custom "uh oh" sound — place uhoh.mp3 next to the html files
const _uhoh = new Audio('uhoh.mp3'); _uhoh.preload = 'auto';
function sayUhOh() { try { _uhoh.currentTime = 0; _uhoh.play(); } catch (e) {} }

/* ---------- GAME FLOW (auto-advance to next game) ----------
   The order games play in. After a game's win screen, call
   scheduleNextGame() to move to the next one automatically. */
const GAME_ORDER = [
  'name-spell.html',
  'family-match.html',
  'match-the-popsicle.html',
  'number-caterpillar.html',
  'fruit-match.html',
  'shape-match.html',
  'animal-match.html',
  'find-color.html',
   'trace-line.html' 
];

function nextGameUrl() {
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const i = GAME_ORDER.indexOf(here);
  if (i === -1) return GAME_ORDER[0];          // unknown page -> start of flow
  return GAME_ORDER[(i + 1) % GAME_ORDER.length]; // loop back to first after last
}

// call after showing the win screen; auto-goes to the next game in `delay` ms
function scheduleNextGame(delay) {
  delay = delay || 4000;
  const url = nextGameUrl();
  setTimeout(function () { location.href = url; }, delay);
}

/* ---------- SPEECH (male voice, slow & clear) ---------- */
let _voice = null;
function _pickVoice() {
  const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!vs.length) return;
  const pref = ['daniel', 'alex', 'fred', 'david', 'aaron', 'tom', 'oliver', 'arthur', 'google uk english male', 'male'];
  _voice = vs.find(v => pref.some(p => v.name.toLowerCase().includes(p)))
        || vs.find(v => v.lang.startsWith('en')) || vs[0];
}
if ('speechSynthesis' in window) { _pickVoice(); window.speechSynthesis.onvoiceschanged = _pickVoice; }
function speak(text, pitch = 1.0, rate = 0.7) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    if (_voice) u.voice = _voice;
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- AUDIO UNLOCK (mobile/iPad need a user gesture) ----------
   On the first tap anywhere, resume the Web Audio context and "prime"
   the mp3 elements by playing them muted+paused once. Without this,
   browsers silently block applause.mp3 / uhoh.mp3 the first time. */
(function () {
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // resume the Web Audio context (for the chime)
    try { _ctx(); } catch (e) {}
    // prime the mp3 audio elements
    [_applause, _uhoh].forEach(function (a) {
      try {
        a.muted = true;
        const p = a.play();
        if (p && p.then) {
          p.then(function () {
            a.pause(); a.currentTime = 0; a.muted = false;
          }).catch(function () { a.muted = false; });
        } else {
          a.pause(); a.currentTime = 0; a.muted = false;
        }
      } catch (e) { a.muted = false; }
    });
    // nudge speech synthesis awake (some browsers need this)
    try { if ('speechSynthesis' in window) window.speechSynthesis.resume(); } catch (e) {}
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('click', unlock, true);
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('click', unlock, true);
})();