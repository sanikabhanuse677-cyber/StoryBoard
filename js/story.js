/* ================================================
   STORYBOARD NARRATOR — story.js
   Complete narration engine:
   • Web Speech API with gender + baby modes
   • Voice switch mid-story without restart
   • Generative ambient music (Web AudioContext)
   • Typewriter reveal per line
   • Avatar speaking animation + wave bars
   • Smooth line highlighting & scroll
   • Full keyboard control
   ================================================ */

'use strict';

/* ── Toast ─────────────────────────────────────── */
function showToast(msg, ms) {
  ms = ms || 2800;
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, ms);
}

/* ═══════════════════════════════════════════════
   AMBIENT MUSIC ENGINE
═══════════════════════════════════════════════ */
function AmbientMusic() {
  this.ctx       = null;
  this.master    = null;
  this.targetVol = 0.22;
  this.running   = false;
  this.drones    = [];
  this.timers    = [];
}

AmbientMusic.prototype.init = function () {
  if (this.ctx) return true;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx    = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);
    return true;
  } catch (e) {
    console.warn('AudioContext init failed:', e);
    return false;
  }
};

AmbientMusic.prototype._drone = function (freq, vol) {
  if (!this.ctx) return;
  var ctx  = this.ctx;
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();
  var filt = ctx.createBiquadFilter();
  var lfo  = ctx.createOscillator();
  var lfoG = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  lfo.frequency.setValueAtTime(0.2 + Math.random() * 0.3, ctx.currentTime);
  lfoG.gain.setValueAtTime(freq * 0.004, ctx.currentTime);
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);
  lfo.start();

  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(700, ctx.currentTime);
  filt.Q.setValueAtTime(0.6, ctx.currentTime);

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol || 0.018, ctx.currentTime + 5);

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(this.master);
  osc.start();

  this.drones.push({ osc: osc, lfo: lfo, gain: gain });
};

AmbientMusic.prototype._pad = function (base) {
  var ratios = [1, 1.25, 1.5, 2];
  var self = this;
  ratios.forEach(function (r) {
    self._drone(base * r, 0.015 + Math.random() * 0.01);
  });
};

AmbientMusic.prototype._schedulePulse = function () {
  if (!this.running) return;
  var self  = this;
  var ctx   = this.ctx;
  var freqs = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00];
  var freq  = freqs[Math.floor(Math.random() * freqs.length)];

  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();
  var filt = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(freq * 1.8, ctx.currentTime);
  filt.Q.setValueAtTime(2.5, ctx.currentTime);

  var now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.028, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(this.master);
  osc.start(now);
  osc.stop(now + 4.5);

  var delay = 3500 + Math.random() * 5000;
  var tid = setTimeout(function () { self._schedulePulse(); }, delay);
  this.timers.push(tid);
};

AmbientMusic.prototype.start = function () {
  if (!this.init()) return;
  if (this.running) return;
  this.running = true;

  if (this.ctx.state === 'suspended') { this.ctx.resume(); }

  this._pad(65.41);
  this._pad(87.31);
  setTimeout(this._schedulePulse.bind(this), 2500);

  this.master.gain.cancelScheduledValues(this.ctx.currentTime);
  this.master.gain.setValueAtTime(0, this.ctx.currentTime);
  this.master.gain.linearRampToValueAtTime(this.targetVol, this.ctx.currentTime + 3.5);
};

AmbientMusic.prototype.stop = function () {
  if (!this.ctx || !this.running) return;
  var self = this;
  this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.8);
  this.timers.forEach(function (t) { clearTimeout(t); });
  this.timers  = [];
  this.running = false;
  setTimeout(function () {
    self.drones.forEach(function (d) {
      try { d.osc.stop(); } catch (e) {}
      try { d.lfo.stop(); } catch (e) {}
    });
    self.drones = [];
  }, 2200);
};

AmbientMusic.prototype.setVolume = function (v) {
  this.targetVol = parseFloat(v);
  if (!this.ctx || !this.master) return;
  this.master.gain.cancelScheduledValues(this.ctx.currentTime);
  this.master.gain.linearRampToValueAtTime(this.targetVol, this.ctx.currentTime + 0.35);
};

AmbientMusic.prototype.duck = function () {
  if (!this.ctx || !this.master) return;
  this.master.gain.cancelScheduledValues(this.ctx.currentTime);
  this.master.gain.linearRampToValueAtTime(this.targetVol * 0.3, this.ctx.currentTime + 0.3);
};

AmbientMusic.prototype.unduck = function () {
  if (!this.ctx || !this.master) return;
  this.master.gain.cancelScheduledValues(this.ctx.currentTime);
  this.master.gain.linearRampToValueAtTime(this.targetVol, this.ctx.currentTime + 0.9);
};

/* ═══════════════════════════════════════════════
   VOICE ENGINE
═══════════════════════════════════════════════ */
function VoiceEngine() {
  this.synth    = window.speechSynthesis || null;
  this.voices   = [];
  this.gender   = 'male';
  this.baby     = false;
  this._ready   = false;
  this._kaTimer = null;

  if (!this.synth) return;

  var self = this;
  function load() {
    var v = self.synth.getVoices();
    if (v.length > 0) { self.voices = v; self._ready = true; }
  }
  load();
  if (this.synth.onvoiceschanged !== undefined) {
    this.synth.onvoiceschanged = load;
  }
  setTimeout(load, 400);
  setTimeout(load, 1200);
}

VoiceEngine.prototype.getVoice = function () {
  if (!this._ready || !this.voices.length) return null;
  var lang = this.voices.filter(function (v) { return v.lang.startsWith('en'); });
  var pool = lang.length ? lang : this.voices;

  if (this.gender === 'female') {
    var fkw = ['female','woman','girl','zira','samantha','victoria','karen','moira','tessa','fiona','veena','allison','ava','susan','kate'];
    var fv = pool.find(function (v) {
      var n = v.name.toLowerCase();
      return fkw.some(function (k) { return n.includes(k); });
    });
    return fv || pool[Math.min(1, pool.length - 1)];
  } else {
    var mkw = ['male','man','alex','daniel','fred','jorge','thomas','james','ryan','reed','mark','oliver','google uk english male'];
    var mv = pool.find(function (v) {
      var n = v.name.toLowerCase();
      return mkw.some(function (k) { return n.includes(k); });
    });
    return mv || pool[0];
  }
};

VoiceEngine.prototype.speak = function (text, onStart, onEnd) {
  var self = this;
  if (!this.synth) {
    if (onStart) onStart();
    var approxMs = Math.max(1200, text.length * 60);
    setTimeout(function () { if (onEnd) onEnd(); }, approxMs);
    return;
  }

  this.cancel();

  var utt = new SpeechSynthesisUtterance(text);
  this._currentUtterance = utt;
  var voice = this.getVoice();
  if (voice) utt.voice = voice;

  if (this.baby) {
    utt.pitch = 2.0;
    utt.rate  = 0.72;
  } else {
    utt.pitch = this.gender === 'female' ? 1.15 : 0.82;
    utt.rate  = this.gender === 'female' ? 0.95 : 0.88;
  }
  utt.volume = 1.0;
  utt.lang   = 'en-US';

  utt.onstart = function () { if (onStart) onStart(); };
  utt.onend = function () {
    if (self._currentUtterance !== utt) return;
    clearInterval(self._kaTimer);
    self._kaTimer = null;
    if (onEnd) onEnd();
  };
  utt.onerror = function () {
    if (self._currentUtterance !== utt) return;
    clearInterval(self._kaTimer);
    self._kaTimer = null;
    if (onEnd) onEnd();
  };

  this.synth.speak(utt);

  /* Chrome keep-alive: silence after ~15 s — nudge the engine */
  this._kaTimer = setInterval(function () {
    if (!self.synth.speaking) {
      clearInterval(self._kaTimer);
      self._kaTimer = null;
      return;
    }
    self.synth.pause();
    self.synth.resume();
  }, 10000);
};

/* FIX 2: cancel() no longer calls pause()/resume() — that can re-trigger
   speech on Chrome instead of stopping it cleanly. */
VoiceEngine.prototype.cancel = function () {
  clearInterval(this._kaTimer);
  this._kaTimer = null;

  if (this.synth) {
    try { this.synth.cancel(); } catch (e) {}
  }

  this._currentUtterance = null;
};

VoiceEngine.prototype.supported = function () {
  return !!this.synth;
};

/* ═══════════════════════════════════════════════
   TYPEWRITER
   FIX 4: tracks the active timer ID on the element
   so a second call cancels the first mid-animation.
═══════════════════════════════════════════════ */
function typewriter(el, text, onDone) {
  /* Cancel any in-progress animation on this element */
  if (el._twTimer) {
    clearTimeout(el._twTimer);
    el._twTimer = null;
  }

  el.textContent = '';
  var cursor = document.createElement('span');
  cursor.className = 'tw-cursor';
  el.appendChild(cursor);

  var i     = 0;
  var CHUNK = 3;
  var DELAY = 16;

  function tick() {
    if (i >= text.length) {
      cursor.remove();
      el.textContent = text;
      el._twTimer = null;
      if (onDone) onDone();
      return;
    }
    var chunk = text.slice(i, i + CHUNK);
    cursor.insertAdjacentText('beforebegin', chunk);
    i += CHUNK;
    el._twTimer = setTimeout(tick, DELAY + Math.random() * 10);
  }
  el._twTimer = setTimeout(tick, 20);
}

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
var App = (function () {

  /* ── State ──────────────────────────────────── */
  var story         = null;
  var lines         = [];
  var lineEls       = [];
  var currentIdx    = 0;
  var isPlaying     = false;
  var pendingGender = null;
  var speechToken   = 0;
  var music = new AmbientMusic();
  var voice = new VoiceEngine();

  /* ── Avatar config ──────────────────────────── */
  var AVATARS = {
    male:   { emoji: '🧔', name: 'The Chronicler',   c1: '#7c3aed', c2: '#2563eb' },
    female: { emoji: '👩', name: 'The Enchantress',  c1: '#db2777', c2: '#7c3aed' },
    baby:   { emoji: '🐣', name: 'The Little Bard',  c1: '#d97706', c2: '#ef4444' }
  };

  function $id(id) { return document.getElementById(id); }

  /* ── Load story from localStorage ─────────────*/
  function loadStory() {
    var raw = null;
    try { raw = localStorage.getItem('sb_current'); } catch (e) {}
    if (!raw) { window.location.href = 'index.html'; return; }

    try { story = JSON.parse(raw); }
    catch (e) { window.location.href = 'index.html'; return; }

    lines = story.lines || [];

    $id('meta-genre').textContent = story.genre || '';
    $id('meta-title').textContent = story.title || 'Untitled';
    document.title = 'StoryBoard — ' + (story.title || 'Story');

    buildLineEls();
    refreshProgress();
  }

  /* ── Build DOM line elements ─────────────────── */
  function buildLineEls() {
    var container = $id('lines-wrapper');
    container.innerHTML = '';
    lineEls = [];

    lines.forEach(function (text, i) {
      if (i > 0 && i % 4 === 0) {
        var div = document.createElement('div');
        div.className = 'scene-divider';
        div.innerHTML = '<div class="sdiv-line"></div><div class="sdiv-dot"></div><div class="sdiv-line"></div>';
        container.appendChild(div);
        (function (d, delay) {
          setTimeout(function () { d.classList.add('shown'); }, delay);
        })(div, 60 + i * 30);
      }

      var el = document.createElement('div');
      el.className = 'story-line';
      el.textContent = text;
      container.appendChild(el);
      lineEls.push(el);

      (function (e, delay) {
        setTimeout(function () { e.classList.add('shown'); }, delay);
      })(el, 80 + i * 38);
    });
  }

  /* ── Narrate a line ─────────────────────────── */
  function narrateLine(idx) {
    if (idx >= lines.length) {
      onStoryEnd();
      return;
    }

    currentIdx = idx;
    refreshProgress();

    speechToken++;
    var myToken = speechToken;

    lineEls.forEach(function (el, i) {
      el.classList.remove('active', 'done');
      if (i < idx) el.classList.add('done');
      if (i === idx) el.classList.add('active');
    });

    var activeEl = lineEls[idx];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      typewriter(activeEl, lines[idx], null);
    }

    music.duck();
    setSpeaking(true);

    var finished = false;

    /* FIX 1: proceed() is called only by voice.speak's onEnd callback.
       The failsafe setTimeout calls a wrapper that checks finished, preventing
       double-invocation when speech ends normally before the timeout fires. */
    function proceed() {
      if (finished) return;
      finished = true;

      if (myToken !== speechToken) return;

      setSpeaking(false);
      music.unduck();

      if (!isPlaying) return;

      if (pendingGender) {
        voice.gender = pendingGender;
        pendingGender = null;
        updateAvatar();
      }

      var pause = 250 + Math.random() * 150;
      setTimeout(function () {
        if (isPlaying && myToken === speechToken) {
          narrateLine(currentIdx + 1);
        }
      }, pause);
    }

    voice.speak(lines[idx], null, proceed);

    /* Failsafe: advance if speech API hangs — but only if proceed()
       hasn't already fired from the onEnd callback. */
    var maxTime = Math.max(2500, lines[idx].length * 80);
    setTimeout(proceed, maxTime);
  }

  /* ── Avatar ─────────────────────────────────── */
  function updateAvatar() {
    var key = voice.baby ? 'baby' : voice.gender;
    var cfg = AVATARS[key] || AVATARS.male;
    var faceEl  = $id('avatar-face');
    var emojiEl = $id('avatar-emoji');
    var nameEl  = $id('narrator-name');
    var b1      = $id('amb1');
    var b2      = $id('amb2');

    if (faceEl) {
      faceEl.style.transform  = 'rotateY(90deg)';
      faceEl.style.transition = 'transform 0.22s ease';
      setTimeout(function () {
        if (emojiEl) emojiEl.textContent = cfg.emoji;
        if (nameEl)  nameEl.textContent  = cfg.name;
        faceEl.style.transform = 'rotateY(0deg)';
      }, 220);
    }
    if (b1) b1.style.background = cfg.c1;
    if (b2) b2.style.background = cfg.c2;
  }

  function setSpeaking(active) {
    var face  = $id('avatar-face');
    var waves = $id('wave-bars');
    if (!face || !waves) return;
    if (active) {
      face.classList.add('speaking');
      waves.classList.add('active');
    } else {
      face.classList.remove('speaking');
      waves.classList.remove('active');
    }
  }

  /* ── Progress ───────────────────────────────── */
  function refreshProgress() {
    var total = lines.length;
    var idx   = currentIdx;
    var pct   = total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;

    var fill  = $id('prog-fill');
    var cur   = $id('prog-cur');
    var tot   = $id('prog-tot');
    var badge = $id('progress-badge');

    if (fill)  fill.style.width = Math.min(pct, 100) + '%';
    if (cur)   cur.textContent  = 'Line ' + (idx + 1);
    if (tot)   tot.textContent  = 'of ' + total;
    if (badge) badge.textContent = (idx + 1) + ' / ' + total;
  }

  /* ── Play / Pause UI ────────────────────────── */
  function setPlayUI(playing) {
    var icon  = $id('play-icon');
    var label = $id('play-label');
    if (icon)  icon.textContent  = playing ? '⏸' : '▶';
    if (label) label.textContent = playing ? 'Pause' : 'Play';
  }

  /* ── Story end ──────────────────────────────── */
  function onStoryEnd() {
    isPlaying = false;
    setSpeaking(false);
    setPlayUI(false);
    music.unduck();

    lineEls.forEach(function (el) {
      el.classList.remove('active');
      el.classList.add('done');
    });

    var fill  = $id('prog-fill');
    var cur   = $id('prog-cur');
    var badge = $id('progress-badge');
    var total = lines.length;
    if (fill)  fill.style.width  = '100%';
    if (cur)   cur.textContent   = 'Line ' + total;
    if (badge) badge.textContent = total + ' / ' + total;

    /* FIX 6: scroll the narrative panel if it exists, otherwise the wrapper. */
    var endCard = $id('end-card');
    if (endCard) {
      endCard.classList.add('visible');
      setTimeout(function () {
        endCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }

    showToast('✨ Story complete. Thank you for listening.');
    setTimeout(function () { music.stop(); }, 3200);
  }

  /* ═══════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════ */

  function togglePlay() {
    var endCard = $id('end-card');
    if (endCard && endCard.classList.contains('visible')) {
      showToast('Story is complete. Press ↩ to restart.');
      return;
    }

    if (isPlaying) {
      isPlaying = false;
      voice.cancel();
      setSpeaking(false);
      music.unduck();
      setPlayUI(false);
      showToast('⏸ Paused');
    } else {
      if (!voice.supported()) {
        showToast('⚠ Speech synthesis not available in this browser.');
      }
      music.start();
      isPlaying = true;
      setPlayUI(true);
      narrateLine(currentIdx);
      showToast('▶ Narrating…');
    }
  }

  function setVoice(gender) {
    voice.gender = gender;

    var bm = $id('btn-male');
    var bf = $id('btn-female');
    if (bm) bm.classList.toggle('active', gender === 'male');
    if (bf) bf.classList.toggle('active', gender === 'female');

    if (isPlaying) {
      pendingGender = gender;
      showToast(gender === 'male' ? '♂ Switching narrator after this line…' : '♀ Switching narrator after this line…');
    } else {
      updateAvatar();
      showToast(gender === 'male' ? '♂ Male narrator selected' : '♀ Female narrator selected');
    }
  }

  function toggleBaby() {
    voice.baby = !voice.baby;

    var btn = $id('btn-baby');
    var tag = $id('baby-tag');
    if (btn) btn.classList.toggle('active', voice.baby);
    if (tag) tag.textContent = voice.baby ? 'ON' : 'OFF';

    updateAvatar();

    if (isPlaying) {
      speechToken++;
      voice.cancel();
      setSpeaking(false);
      music.unduck();
      setTimeout(function () {
        if (isPlaying) narrateLine(currentIdx);
      }, 200);
    }

    showToast(voice.baby ? '🍼 Baby voice ON' : '🍼 Baby voice OFF');
  }

  /* FIX 5: restart() increments speechToken so any stale
     in-flight proceed() calls are ignored after reset. */
  function restart() {
    speechToken++;
    voice.cancel();
    setSpeaking(false);
    isPlaying     = false;
    setPlayUI(false);
    music.unduck();
    currentIdx    = 0;
    pendingGender = null;

    lineEls.forEach(function (el) {
      el.classList.remove('active', 'done');
    });

    var fill  = $id('prog-fill');
    var cur   = $id('prog-cur');
    var badge = $id('progress-badge');
    var total = lines.length;
    if (fill)  fill.style.width  = '0%';
    if (cur)   cur.textContent   = 'Line 0';
    if (badge) badge.textContent = '0 / ' + total;

    var endCard = $id('end-card');
    if (endCard) endCard.classList.remove('visible');

    /* Scroll to top — prefer the scrollable panel, fall back to wrapper */
    var panel = document.querySelector('.narrative-panel');
    if (panel) {
      panel.scrollTop = 0;
    } else {
      var wrapper = $id('lines-wrapper');
      if (wrapper) wrapper.scrollTop = 0;
    }

    showToast('↩ Restarted');
  }

  function skip(dir) {
    var wasPlaying = isPlaying;
    speechToken++;
    voice.cancel();
    setSpeaking(false);
    music.unduck();

    var next = currentIdx + dir;
    if (next < 0) next = 0;
    if (next >= lines.length) next = lines.length - 1;
    currentIdx = next;

    if (wasPlaying) {
      narrateLine(currentIdx);
    } else {
      refreshProgress();
      lineEls.forEach(function (el, i) {
        el.classList.remove('active', 'done');
        if (i < currentIdx) el.classList.add('done');
        if (i === currentIdx) el.classList.add('active');
      });
      var el = lineEls[currentIdx];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function setVolume(v) {
    music.setVolume(v);
  }

  /* ── Init ───────────────────────────────────── */
  function init() {
    loadStory();
    updateAvatar();

    if (!voice.supported()) {
      showToast('ℹ Speech synthesis not supported — text-only mode.');
    }

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          skip(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          skip(-1);
          break;
        case 'r': case 'R':
          restart();
          break;
        case 'b': case 'B':
          toggleBaby();
          break;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    togglePlay: togglePlay,
    setVoice:   setVoice,
    toggleBaby: toggleBaby,
    restart:    restart,
    skip:       skip,
    setVolume:  setVolume
  };

})();