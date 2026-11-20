const _NEM_PRESET = window.NEMESIS_PRESET || {};
const _NEM_PRESET_SET =
  (_NEM_PRESET.interactionSets &&
    _NEM_PRESET.activeInteractionSet &&
    _NEM_PRESET.interactionSets[_NEM_PRESET.activeInteractionSet]) || null;
const _NEM_PRESET_MSG = (_NEM_PRESET_SET && _NEM_PRESET_SET.messages) || {};

const _DEFAULT_STATE_LABELS = {
  dominant: 'DOMINANTE',
  vigilant: 'VIGILE',
  alarmed: 'ALLARMATO',
  under_attack: 'SOTTO ATTACCO',
  defeated: 'SCONFITTO',
};

const _DEFAULT_PHASES = {
  dominant: { color: [216, 110, 51], count: 300, label: 'DOMINANTE' },
  vigilant: { color: [240, 160, 96], count: 230, label: 'VIGILE' },
  alarmed: { color: [228, 90, 40], count: 160, label: 'ALLARMATO' },
  under_attack: { color: [231, 76, 60], count: 95, label: 'SOTTO ATTACCO' },
  defeated: { color: [74, 101, 128], count: 45, label: 'SCONFITTO' },
};

const _DEFAULT_STATE_MSG = {
  dominant: [
    'NEMESIS stabile. Integrita {integrity}%.',
    'Sistema dominante in modalita {sessionModeLabel}.',
    'Core saldo. Stato: {stateLabel}.',
  ],
  vigilant: [
    'Rilevate intrusioni. Integrita al {integrity}%.',
    'NEMESIS vigile: monitoraggio intensificato.',
    'Pressione crescente in modalita {sessionModeLabel}.',
  ],
  alarmed: [
    'Soglia critica superata: {integrity}% integrita.',
    'Allarme operativo. Stato: {stateLabel}.',
    'Core stressato. Rischio in aumento.',
  ],
  under_attack: [
    'Sotto attacco diretto. Integrita {integrity}%.',
    'Fase critica: ogni flag e un impatto.',
    'Stato instabile: {stateLabel}.',
  ],
  defeated: [
    'NEMESIS compromesso: {integrity}% integrita.',
    'Core neutralizzato. Stato: {stateLabel}.',
    'Difese al collasso. Vantaggio umano.',
  ],
};

const _DEFAULT_TRIGGER_DEFAULT = {
  talking: 'Analisi in corso.',
  thinking: 'Processo decisionale attivo.',
  alert: 'Anomalia rilevata.',
  success: 'Evento confermato.',
  mock: 'Tentativo respinto.',
};

const NEM_STATE_LABELS = _NEM_PRESET.stateLabels || _DEFAULT_STATE_LABELS;
const NEM_PHASES = _NEM_PRESET.phases || _DEFAULT_PHASES;
const NEM_STATE_MSG = _NEM_PRESET_MSG.state || {};
const NEM_LOBBY_INTRO_MSG = _NEM_PRESET_MSG.lobby_intro || [];
const NEM_LOBBY_JOIN_MSG = _NEM_PRESET_MSG.lobby_join || [];
const NEM_LOBBY_LAST_SLOW_MSG = _NEM_PRESET_MSG.lobby_last_slow || [];
const NEM_CHALLENGE_COMPLETE_MSG = _NEM_PRESET_MSG.challenge_complete || {};
const NEM_WRONG_MSG = _NEM_PRESET_MSG.wrong || [];
const NEM_WRONG_STREAK_MSG = _NEM_PRESET_MSG.wrong_streak || [];
const NEM_PHASE_ANIM_MODE = (_NEM_PRESET_SET && _NEM_PRESET_SET.phaseAnimMode) || {};
const NEM_TRIGGER_DEFAULT =
  (_NEM_PRESET_SET && _NEM_PRESET_SET.triggerDefaults) ||
  _NEM_PRESET.triggerDefaults ||
  _DEFAULT_TRIGGER_DEFAULT;
const NEM_VISUAL_LEGACY = {
  lobby:     { color: [184, 92, 255], count: 700, label: 'LOBBY' },
  red:       { color: [210, 48, 52],  count: 500, label: 'FASE 2' },
  orange:    { color: [232, 118, 38], count: 300, label: 'FASE 3' },
  yellow:    { color: [255, 236, 160], count: 100, label: 'FASE 4' },
  yellowEnd: { color: [255, 236, 160], count: 50, label: 'FASE 5' },
  lastOne:   { color: [248, 248, 252], count: 25, label: 'FINALE' },
};

function nemBarColor(integrity) {
  if (integrity >= 75) return 'linear-gradient(90deg, #d86e33, #f0a060)';
  if (integrity >= 50) return 'linear-gradient(90deg, #c05818, #e8813d)';
  if (integrity >= 25) return 'linear-gradient(90deg, #b03010, #d86e33)';
  return 'linear-gradient(90deg, #e74c3c, #c0392b)';
}

function nemSessionModeLabel(sessionMode) {
  return sessionMode === 'competitive' ? 'COMPETITIVA' : 'CO-OP';
}

function nemFormatMessage(template, ctx) {
  return template
    .replace(/\{integrity\}/g, String(ctx.integrity))
    .replace(/\{stateLabel\}/g, String(ctx.stateLabel))
    .replace(/\{sessionModeLabel\}/g, String(ctx.sessionModeLabel))
    .replace(/\{team\}/g, String(ctx.team || 'Squadra'))
    .replace(/\{teams\}/g, String(ctx.teams || 'N/D'))
    .replace(/\{gameName\}/g, String(ctx.gameName || 'NEMESIS CTF'))
    .replace(/\{challengeCode\}/g, String(ctx.challengeCode || 'sfida'));
}

function nemPickMessage(state, ctx) {
  const pool = NEM_STATE_MSG[state] || NEM_STATE_MSG.dominant;
  return nemFormatMessage(pool[Math.floor(Math.random() * pool.length)], ctx);
}

function nemEmit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

let orbSmall = null;
let orbLarge = null;
let _nemMessageTimer = null;
let _nemAnimTimer = null;
let _nemAnimMode = 'idle';
let _nemState = 'dominant';
let _nemIntegrity = 100;
let _nemSessionMode = 'coop';
let _nemLastMessage = '';
let _nemLastSeenServerMessage = '';
let _nemSnapshot = null;
let _nemKnownTeams = new Set();
let _nemSolvedByTeam = new Map();
let _nemLastLobbyIntroAt = 0;
let _nemHasBaseline = false;
let _nemQueueTimer = null;
let _nemEventQueue = [];
let _nemLastMessageAt = 0;
let _nemLastEventAt = 0;
const NEM_MIN_GAP_MS = 15000;
const NEM_IDLE_INTERVAL_MS = 15000;
const NEM_IDLE_GAP_MS = 15000;
const NEM_MIN_DISPLAY_MS = 15000;
const NEM_QUEUE_MAX = 30;
let _nemQueueSeq = 0;
const _nemUsedStateMsg = new Map();
const _nemStateMsgOrder = new Map();
const _nemRecentMsgSig = new Map();
let _nemAudioCtx = null;
let _nemLastTypeBeepAt = 0;
const _nemTypewriterJobs = new WeakMap();
const _nemTypewriterTimers = new Set();
const _nemEventUsedIdx = new Map();
const _nemEventOrderIdx = new Map();
let _nemEnginePaused = false;
let _nemAudioEnabled = true;
/** Beeps durante il typewriter sui messaggi NEMESIS (separato da audioEnabled per resume contest). */
let _nemTypingSoundEnabled = true;
let _nemViewRole = 'admin';
const _nemDomIds = {
  canvasSmall: 'nem-canvas-small',
  canvasLarge: 'nem-canvas-large',
  barSmall: 'nem-bar-small',
  integritySmall: 'nem-integrity-small',
  stateSmall: 'nem-state-small',
  msgSmall: 'nem-msg-small',
  modeTag: 'nem-mode-tag',
  barLarge: 'nem-bar-large',
  integrityLarge: 'nem-integrity-large',
  stateLarge: 'nem-state-large',
  fsModeTag: 'nem-fs-mode-tag',
  msgLarge: 'nem-msg-large',
  fullscreenWrap: 'nem-fullscreen',
  dots: 'nem-challenge-dots',
  dotsFs: 'nem-challenge-dots-fs',
  scoreMini: 'nem-score-mini',
  scoreMiniFs: 'nem-score-mini-fs',
};

function _nemEl(key) {
  const id = _nemDomIds[key];
  return id ? document.getElementById(id) : null;
}

function configureNemesisView(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  if (typeof cfg.audioEnabled === 'boolean') _nemAudioEnabled = cfg.audioEnabled;
  if (typeof cfg.typingSoundEnabled === 'boolean') _nemTypingSoundEnabled = cfg.typingSoundEnabled;
  if (cfg.role) {
    const role = String(cfg.role);
    _nemViewRole = role === 'player' ? 'player' : 'admin';
  }
  if (cfg.dom && typeof cfg.dom === 'object') {
    Object.keys(cfg.dom).forEach((k) => {
      _nemDomIds[k] = cfg.dom[k];
    });
  }
}

function _nemEscHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _nemPick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function _nemShuffledIndices(len) {
  const idx = Array.from({ length: len }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx;
}

function _nemPickUniqueStateMessage(state, ctx) {
  const pool = NEM_STATE_MSG[state] || NEM_STATE_MSG.dominant || [];
  if (!pool.length) return '';
  if (!_nemUsedStateMsg.has(state)) _nemUsedStateMsg.set(state, new Set());
  if (!_nemStateMsgOrder.has(state)) _nemStateMsgOrder.set(state, _nemShuffledIndices(pool.length));
  const used = _nemUsedStateMsg.get(state);
  const order = _nemStateMsgOrder.get(state);
  while (order.length) {
    const idx = order.shift();
    if (used.has(idx)) continue;
    used.add(idx);
    return _nemResolveStateEntry(pool[idx], ctx);
  }
  _nemUsedStateMsg.set(state, new Set());
  _nemStateMsgOrder.set(state, _nemShuffledIndices(pool.length));
  const resetOrder = _nemStateMsgOrder.get(state);
  const resetUsed = _nemUsedStateMsg.get(state);
  const idx = resetOrder.shift();
  resetUsed.add(idx);
  return _nemResolveStateEntry(pool[idx], ctx);
}

function _nemPickSyncedAmbientMessage(state, ctx, now = Date.now()) {
  const pool = NEM_STATE_MSG[state] || NEM_STATE_MSG.dominant || [];
  if (!pool.length) return { text: '', mode: null };
  const bucket = Math.floor(now / NEM_IDLE_INTERVAL_MS);
  const seedStr = `${String(state || 'dominant')}|${bucket}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash * 31) + seedStr.charCodeAt(i)) >>> 0;
  }
  const idx = hash % pool.length;
  return _nemResolveStateEntry(pool[idx], ctx);
}

function _nemResolveStateEntry(entry, ctx) {
  if (typeof entry === 'string') {
    return { text: nemFormatMessage(entry, ctx), mode: null };
  }
  if (entry && typeof entry === 'object') {
    const text = nemFormatMessage(String(entry.text || ''), ctx);
    const mode = typeof entry.mode === 'string' ? entry.mode : null;
    return { text, mode };
  }
  return { text: '', mode: null };
}

function _nemPickUniqueEventMessage(poolKey, arr, ctx) {
  if (!arr || !arr.length) return '';
  if (!_nemEventUsedIdx.has(poolKey)) _nemEventUsedIdx.set(poolKey, new Set());
  if (!_nemEventOrderIdx.has(poolKey)) _nemEventOrderIdx.set(poolKey, _nemShuffledIndices(arr.length));
  const used = _nemEventUsedIdx.get(poolKey);
  const order = _nemEventOrderIdx.get(poolKey);
  while (order.length) {
    const idx = order.shift();
    if (used.has(idx)) continue;
    used.add(idx);
    return nemFormatMessage(arr[idx], ctx);
  }
  _nemEventUsedIdx.set(poolKey, new Set());
  _nemEventOrderIdx.set(poolKey, _nemShuffledIndices(arr.length));
  const idx = _nemEventOrderIdx.get(poolKey).shift();
  _nemEventUsedIdx.get(poolKey).add(idx);
  return nemFormatMessage(arr[idx], ctx);
}

function _nemBuildCtx(base, extra) {
  const snap = _nemSnapshot || {};
  const teamNames = ((snap.scoreboard || []).map((t) => t.team_name).filter(Boolean));
  return {
    integrity: base.integrity,
    stateLabel: base.stateLabel,
    sessionModeLabel: base.sessionModeLabel,
    teams: teamNames.length ? teamNames.join(', ') : 'nessuna squadra connessa',
    gameName: snap.sessionName || 'NEMESIS CTF',
    ...(extra || {}),
  };
}

function _nemGetLegacyPhaseVisual(snapshot, fallbackState) {
  if (!snapshot) return NEM_PHASES[fallbackState] || NEM_PHASES.dominant;
  if (snapshot.sessionStatus === 'pending') return NEM_VISUAL_LEGACY.lobby;
  const total = Math.max(0, Number(snapshot.total_challenges || (snapshot.challenges || []).length || 0));
  const solved = Math.max(0, Number(snapshot.total_solved || 0));
  if (total <= 0) return NEM_VISUAL_LEGACY.lobby;
  const remaining = Math.max(0, total - solved);
  const pct = solved / total;
  if (remaining === 1) return NEM_VISUAL_LEGACY.lastOne;
  if (pct < 0.25) return NEM_VISUAL_LEGACY.lobby;
  if (pct < 0.5) return NEM_VISUAL_LEGACY.red;
  if (pct < 0.75) return NEM_VISUAL_LEGACY.orange;
  if (pct < 0.9) return NEM_VISUAL_LEGACY.yellow;
  return NEM_VISUAL_LEGACY.yellowEnd;
}

function _nemGetAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!_nemAudioCtx) _nemAudioCtx = new Ctx();
  return _nemAudioCtx;
}

function _nemTypingBeep() {
  if (!_nemTypingSoundEnabled) return;
  if (!_nemAudioEnabled) return;
  const now = Date.now();
  if (now - _nemLastTypeBeepAt < 75) return;
  _nemLastTypeBeepAt = now;
  const ctx = _nemGetAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 980;
  gain.gain.value = 0.008;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.02);
}

function _nemTypewrite(el, text) {
  if (!el) return;
  const prev = _nemTypewriterJobs.get(el);
  if (prev) {
    clearInterval(prev);
    _nemTypewriterTimers.delete(prev);
  }
  el.classList.add('typing');
  el.textContent = '';
  let i = 0;
  const speed = Math.max(14, Math.min(30, Math.floor(1800 / Math.max(18, text.length))));
  const timer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(timer);
      _nemTypewriterTimers.delete(timer);
      _nemTypewriterJobs.delete(el);
      el.classList.remove('typing');
      return;
    }
    el.textContent += text[i++];
    _nemTypingBeep();
  }, speed);
  _nemTypewriterTimers.add(timer);
  _nemTypewriterJobs.set(el, timer);
}

function _nemShowNow(mode, msg, displayMs) {
  const ms = Math.max(NEM_MIN_DISPLAY_MS, Number.isFinite(displayMs) ? displayMs : 4200);
  if (mode) setNemesisMode(mode, mode === 'idle' ? 0 : Math.max(ms, 1800));
  if (msg) {
    _nemLastMessage = msg;
    _nemLastMessageAt = Date.now();
    nemEmit('nemesis:speak', { text: msg, mode: mode || _nemAnimMode });
    updateNemesisUI({ integrity_pct: _nemIntegrity, emotional_state: _nemState, last_message: msg }, _nemSessionMode, _nemSnapshot);
  }
}

function _nemPriorityFor(kind, mode) {
  if (kind === 'ambient') return 10;
  if (kind === 'lobby_join' || kind === 'lobby_intro') return 30;
  if (kind === 'lobby_last_slow') return 50;
  if (kind === 'challenge_complete') return 80;
  if (kind === 'wrong') return 85;
  if (kind === 'wrong_streak') return 95;
  if (mode === 'alert') return 90;
  if (mode === 'success') return 80;
  return 60;
}

function _nemMessageSignature(mode, msg, kind) {
  return `${String(kind || 'event')}|${String(mode || 'none')}|${String(msg || '').trim()}`;
}

function _nemPruneRecentSignatures(now) {
  _nemRecentMsgSig.forEach((ts, key) => {
    if (now - ts > 90000) _nemRecentMsgSig.delete(key);
  });
}

function _nemShouldDropAsDuplicate(sig, now) {
  _nemPruneRecentSignatures(now);
  const last = _nemRecentMsgSig.get(sig) || 0;
  return now - last < 45000;
}

function _nemFindWorstQueueIndex() {
  if (!_nemEventQueue.length) return -1;
  let idx = 0;
  for (let i = 1; i < _nemEventQueue.length; i++) {
    const a = _nemEventQueue[i];
    const b = _nemEventQueue[idx];
    if (a.priority < b.priority || (a.priority === b.priority && a.seq > b.seq)) {
      idx = i;
    }
  }
  return idx;
}

const _NEM_LOBBY_ONLY_KINDS = new Set(['lobby_intro', 'lobby_join', 'lobby_last_slow']);

function _nemCanEnqueueKind(kind) {
  const status = String(_nemSnapshot?.sessionStatus || '').toLowerCase();
  const isPlayer = _nemViewRole === 'player';
  if (!isPlayer) return true;
  if (status === 'pending') return _NEM_LOBBY_ONLY_KINDS.has(kind);
  if (status === 'active' && _NEM_LOBBY_ONLY_KINDS.has(kind)) return false;
  return true;
}

function _nemEnqueue(mode, msg, displayMs, kind, priority) {
  if (!msg) return;
  const finalKind = kind || 'event';
  if (!_nemCanEnqueueKind(finalKind)) return;
  const finalPriority = Number.isFinite(priority) ? priority : _nemPriorityFor(finalKind, mode);
  const now = Date.now();
  const sig = _nemMessageSignature(mode, msg, finalKind);
  if (_nemShouldDropAsDuplicate(sig, now)) return;
  if (_nemEventQueue.some((x) => x.sig === sig)) return;

  if (_nemEventQueue.length >= NEM_QUEUE_MAX) {
    const worstIdx = _nemFindWorstQueueIndex();
    if (worstIdx < 0) return;
    const worst = _nemEventQueue[worstIdx];
    if (worst.priority >= finalPriority) return;
    _nemEventQueue.splice(worstIdx, 1);
  }

  _nemEventQueue.push({
    mode,
    msg,
    displayMs,
    kind: finalKind,
    priority: finalPriority,
    seq: _nemQueueSeq++,
    sig,
  });
  if (finalKind !== 'ambient') _nemLastEventAt = Date.now();
}

function _nemProcessQueue() {
  if (_nemEnginePaused) return;
  if (!_nemEventQueue.length) return;
  const now = Date.now();
  let idx = 0;
  for (let i = 1; i < _nemEventQueue.length; i++) {
    const a = _nemEventQueue[i];
    const b = _nemEventQueue[idx];
    if (a.priority > b.priority || (a.priority === b.priority && a.seq < b.seq)) {
      idx = i;
    }
  }
  const candidate = _nemEventQueue[idx];
  const requiredGap = candidate.kind === 'ambient' ? NEM_IDLE_GAP_MS : NEM_MIN_GAP_MS;
  if (now - _nemLastMessageAt < requiredGap) return;
  const item = _nemEventQueue.splice(idx, 1)[0];
  _nemShowNow(item.mode, item.msg, item.displayMs);
  _nemRecentMsgSig.set(item.sig, Date.now());
}

function _nemRenderProgress(snapshot) {
  const dots = _nemEl('dots');
  const dotsFs = _nemEl('dotsFs');
  const board = _nemEl('scoreMini');
  const boardFs = _nemEl('scoreMiniFs');
  if ((!dots && !dotsFs) || (!board && !boardFs) || !snapshot) return;

  const challenges = snapshot.challenges || [];
  const dotsHtml = challenges.map((ch) => {
    const solved = !!ch.is_solved;
    const code = _nemEscHtml(ch.code || '---');
    return `<span class="nem-dot ${solved ? 'off' : 'on'}" title="${code}"></span>`;
  }).join('');
  if (dots) dots.innerHTML = dotsHtml;
  if (dotsFs) dotsFs.innerHTML = dotsHtml;

  const scoreRows = snapshot.scoreboard || [];
  if (!scoreRows.length) {
    const empty = '<div class="nem-score-empty">Nessuna squadra connessa</div>';
    if (board) board.innerHTML = empty;
    if (boardFs) boardFs.innerHTML = empty;
    return;
  }

  if (snapshot.sessionMode === 'coop') {
    const total = Math.max(1, Number(snapshot.total_solved || 0));
    const html = scoreRows.slice(0, 6).map((row) => {
      const solved = Number(row.challenges_solved || 0);
      const contrib = Math.round((solved / total) * 100);
      return `<div class="nem-score-row">
        <span class="nem-score-team">${_nemEscHtml(row.team_name || 'Team')}</span>
        <span class="nem-score-val">${contrib}% contrib</span>
      </div>`;
    }).join('');
    if (board) board.innerHTML = html;
    if (boardFs) boardFs.innerHTML = html;
  } else {
    const html = scoreRows.slice(0, 6).map((row, idx) => {
      return `<div class="nem-score-row">
        <span class="nem-score-team">${idx + 1}. ${_nemEscHtml(row.team_name || 'Team')}</span>
        <span class="nem-score-val">${Number(row.score || 0)} pt</span>
      </div>`;
    }).join('');
    if (board) board.innerHTML = html;
    if (boardFs) boardFs.innerHTML = html;
  }
}

function _nemHandleLobbyEvents(baseCtx) {
  const snap = _nemSnapshot;
  if (!snap) return;
  const now = Date.now();
  const currentTeams = new Set((snap.scoreboard || []).map((r) => r.team_name).filter(Boolean));

  if (snap.sessionStatus === 'pending') {
    if (!currentTeams.size && now - _nemLastLobbyIntroAt > 28000) {
      const text = nemFormatMessage(_nemPick(NEM_LOBBY_INTRO_MSG), _nemBuildCtx(baseCtx));
      if (text) triggerNemesis('talking', text, 6200, 'lobby_intro');
      _nemLastLobbyIntroAt = now;
    }
    currentTeams.forEach((team) => {
      if (!_nemKnownTeams.has(team)) {
        const msg = _nemPickUniqueEventMessage('lobby_join', NEM_LOBBY_JOIN_MSG, _nemBuildCtx(baseCtx, { team }));
        if (msg) triggerNemesis('talking', msg, 5600, 'lobby_join');
      }
    });
    if (currentTeams.size === 1 && now - _nemLastLobbyIntroAt > 32000) {
      const lastTeam = Array.from(currentTeams)[0];
      const msg = nemFormatMessage(_nemPick(NEM_LOBBY_LAST_SLOW_MSG), _nemBuildCtx(baseCtx, { team: lastTeam }));
      if (msg) triggerNemesis('mock', msg, 5200, 'lobby_last_slow');
      _nemLastLobbyIntroAt = now;
    }
    _nemKnownTeams = currentTeams;
  }
}

function _nemHandleSpectatorEvents(baseCtx, state) {
  const snap = _nemSnapshot;
  if (!snap) return;
  const currentTeams = new Set((snap.scoreboard || []).map((r) => r.team_name).filter(Boolean));

  const rows = snap.scoreboard || [];
  if (!_nemHasBaseline) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      _nemSolvedByTeam.set(String(r.team_name || ''), Number(r.challenges_solved || 0));
    }
    _nemHasBaseline = true;
    _nemKnownTeams = currentTeams;
    return;
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = String(row.team_name || '');
    if (!key) continue;
    const prev = _nemSolvedByTeam.get(key) || 0;
    const curr = Number(row.challenges_solved || 0);
    if (curr > prev) {
      const phasePool = NEM_CHALLENGE_COMPLETE_MSG[state] || [];
      const msg = _nemPickUniqueEventMessage(`challenge_complete:${state}`, phasePool, _nemBuildCtx(baseCtx, {
        team: key,
        challengeCode: 'sfida completata',
      }));
      if (msg) triggerNemesis('success', msg, 5000, 'challenge_complete');
    }
    _nemSolvedByTeam.set(key, curr);
  }

  _nemKnownTeams = currentTeams;
}

function ensureNemesisMessageRotation() {
  if (_nemMessageTimer) return;
  _nemMessageTimer = setInterval(() => {
    const now = Date.now();
    if (now - _nemLastEventAt < NEM_IDLE_INTERVAL_MS) return;
    const label = NEM_STATE_LABELS[_nemState] || String(_nemState).toUpperCase();
    const picked = _nemPickSyncedAmbientMessage(_nemState, _nemBuildCtx({
      integrity: _nemIntegrity,
      stateLabel: label,
      sessionModeLabel: nemSessionModeLabel(_nemSessionMode),
    }), now);
    if (picked && picked.text) {
      _nemEnqueue(
        picked.mode || NEM_PHASE_ANIM_MODE[_nemState] || 'thinking',
        picked.text,
        5200,
        'ambient'
      );
    }
  }, NEM_IDLE_INTERVAL_MS);
}

function setNemesisMode(mode, autoIdleMs = 0) {
  const valid = ['idle', 'talking', 'thinking', 'alert', 'success', 'mock'];
  if (!valid.includes(mode)) return;
  _nemAnimMode = mode;
  updateNemesisUI({ integrity_pct: _nemIntegrity, emotional_state: _nemState, last_message: _nemLastMessage }, _nemSessionMode, _nemSnapshot);
  nemEmit('nemesis:modechange', { mode });
  if (_nemAnimTimer) clearTimeout(_nemAnimTimer);
  if (autoIdleMs > 0 && mode !== 'idle') {
    _nemAnimTimer = setTimeout(() => {
      _nemAnimMode = 'idle';
      updateNemesisUI({ integrity_pct: _nemIntegrity, emotional_state: _nemState, last_message: _nemLastMessage }, _nemSessionMode, _nemSnapshot);
      nemEmit('nemesis:modechange', { mode: 'idle' });
    }, autoIdleMs);
  }
}

function triggerNemesis(mode, text, displayMs, kind, priority) {
  const msg = text || NEM_TRIGGER_DEFAULT[mode] || '';
  _nemEnqueue(mode, msg, displayMs, kind || 'event', priority);
}

function stopTypingAndAudio() {
  _nemTypewriterTimers.forEach((timer) => clearInterval(timer));
  _nemTypewriterTimers.clear();
  _nemTypewriterJobs.delete(_nemEl('msgSmall'));
  _nemTypewriterJobs.delete(_nemEl('msgLarge'));
  const msgSmall = _nemEl('msgSmall');
  const msgLarge = _nemEl('msgLarge');
  if (msgSmall) msgSmall.classList.remove('typing');
  if (msgLarge) msgLarge.classList.remove('typing');
  if (_nemAudioCtx && typeof _nemAudioCtx.suspend === 'function') {
    _nemAudioCtx.suspend().catch(() => {});
  }
}

function flushNemesisQueue() {
  _nemEventQueue.length = 0;
}

function pauseNemesisEngine() {
  _nemEnginePaused = true;
  stopTypingAndAudio();
}

function resumeNemesisEngine() {
  _nemEnginePaused = false;
  if (!_nemAudioEnabled) return;
  if (_nemAudioCtx && typeof _nemAudioCtx.resume === 'function') {
    _nemAudioCtx.resume().catch(() => {});
  }
}

window.NEMESIS = {
  configureView(cfg) { configureNemesisView(cfg); },
  setMode(mode, autoIdleMs = 0) { setNemesisMode(mode, autoIdleMs); },
  speak(text, mode = 'talking', displayMs = 4200) { triggerNemesis(mode, text, displayMs, 'event'); },
  speakBubble(text, displayMs = 4200) { triggerNemesis(null, text, displayMs, 'ambient'); },
  alert(text) { triggerNemesis('alert', text, 4200, 'event', 90); },
  success(text) { triggerNemesis('success', text, 3800, 'challenge_complete', 80); },
  mock(text) { triggerNemesis('mock', text, 4800, 'wrong_streak', 95); },
  thinking(text) { triggerNemesis('thinking', text, 4200, 'event'); },
  idle() { setNemesisMode('idle', 0); },
  pauseEngine() { pauseNemesisEngine(); },
  resumeEngine() { resumeNemesisEngine(); },
  flushQueue() { flushNemesisQueue(); },
  stopTypingAndAudio() { stopTypingAndAudio(); },
};

function initOrbs() {
  const smallCanvas = _nemEl('canvasSmall');
  const largeCanvas = _nemEl('canvasLarge');
  if (smallCanvas) orbSmall = new NemesisOrb(smallCanvas);
  if (largeCanvas) orbLarge = new NemesisOrb(largeCanvas);
  ensureNemesisMessageRotation();
  if (!_nemQueueTimer) {
    _nemQueueTimer = setInterval(_nemProcessQueue, 800);
  }
}

function updateNemesisUI(nemesis, sessionMode, snapshot) {
  if (!nemesis) return;
  const integrity = Math.max(0, Math.min(100, nemesis.integrity_pct ?? 100));
  const state = nemesis.emotional_state || 'dominant';
  const phase = _nemGetLegacyPhaseVisual(snapshot || _nemSnapshot, state);
  const label = NEM_STATE_LABELS[state] || state.toUpperCase();
  const sessionLabel = nemSessionModeLabel(sessionMode);
  if (snapshot) _nemSnapshot = snapshot;
  const baseCtx = _nemBuildCtx({ integrity, stateLabel: label, sessionModeLabel: sessionLabel });
  const generatedEntry = _nemPickSyncedAmbientMessage(state, baseCtx);

  // last_message dal server: trattalo come evento one-shot, non come override persistente.
  // Viene mostrato una volta sola tramite la coda normale; poi l'idle riprende da solo.
  const serverMsg = nemesis.last_message ? String(nemesis.last_message).trim() : '';
  if (serverMsg && serverMsg !== _nemLastSeenServerMessage) {
    _nemLastSeenServerMessage = serverMsg;
    _nemEnqueue(
      NEM_PHASE_ANIM_MODE[state] || 'talking',
      serverMsg,
      6000,
      'event',
      75
    );
  }

  // Render diretto:
  // - durante la finestra minima mostra l'ultimo evento locale
  // - scaduta la finestra torna all'idle sincronizzato (stesso pick su tutti i client)
  const nowTs = Date.now();
  const hasActiveEventMessage = !!_nemLastMessage && (nowTs - _nemLastMessageAt < NEM_MIN_DISPLAY_MS);
  const msg = hasActiveEventMessage
    ? _nemLastMessage
    : ((generatedEntry && generatedEntry.text) || '');

  _nemState = state;
  _nemIntegrity = integrity;
  _nemSessionMode = sessionMode || 'coop';

  if (!_nemAnimTimer) {
    const phaseMode = NEM_PHASE_ANIM_MODE[state];
    if (phaseMode) _nemAnimMode = phaseMode;
  }

  if (orbSmall) orbSmall.update(integrity, state, phase, _nemAnimMode);
  if (orbLarge) orbLarge.update(integrity, state, phase, _nemAnimMode);

  const pct = integrity + '%';
  const color = nemBarColor(integrity);

  const barSmall = _nemEl('barSmall');
  const integritySmall = _nemEl('integritySmall');
  const stateSmall = _nemEl('stateSmall');
  if (barSmall) {
    barSmall.style.width = pct;
    barSmall.style.background = color;
  }
  if (integritySmall) {
    integritySmall.textContent = _nemViewRole === 'player'
      ? (integrity + '% integrità')
      : (integrity + '% — ' + label);
  }
  if (stateSmall) stateSmall.textContent = _nemViewRole === 'player' ? label : '';

  const msgSmall = _nemEl('msgSmall');
  if (msgSmall) {
    if (msg) {
      const nextSmall = '"' + msg + '"';
      const prevSmall = msgSmall.dataset.nemRenderedMsg || '';
      msgSmall.classList.remove('hidden');
      if (prevSmall !== nextSmall) {
        _nemTypewrite(msgSmall, nextSmall);
        msgSmall.dataset.nemRenderedMsg = nextSmall;
      }
    } else {
      msgSmall.classList.add('hidden');
      msgSmall.textContent = '';
      msgSmall.dataset.nemRenderedMsg = '';
    }
  }

  const tag = _nemEl('modeTag');
  if (tag) {
    const spanClass = sessionMode === 'competitive' ? 'nem-mode-tag nem-mode-comp' : 'nem-mode-tag nem-mode-coop';
    tag.innerHTML = '';
    const span = document.createElement('span');
    span.className = spanClass;
    if (sessionMode === 'competitive') {
      if (_nemViewRole === 'player') {
        span.textContent = 'COMPETITIVA — IL TUO NEMESIS';
      } else {
        const leader = (_nemSnapshot && _nemSnapshot.leaderTeamName) ? String(_nemSnapshot.leaderTeamName) : '';
        const leaderSuffix = leader ? ` — NEMESIS DELLA SQUADRA ${leader.toUpperCase()}` : ' — NEMESIS DEL TEAM IN TESTA';
        span.textContent = `COMPETITIVA${leaderSuffix}`;
      }
    } else {
      span.textContent = 'CO-OP — NEMESIS CONDIVISO';
    }
    tag.appendChild(span);
  }

  const barLarge = _nemEl('barLarge');
  const integrityLarge = _nemEl('integrityLarge');
  const stateLarge = _nemEl('stateLarge');
  const fsModeTag = _nemEl('fsModeTag');
  if (barLarge) {
    barLarge.style.width = pct;
    barLarge.style.background = color;
  }
  if (integrityLarge) integrityLarge.textContent = integrity + '% integrità';
  if (stateLarge) stateLarge.textContent = label;
  if (fsModeTag && tag) fsModeTag.innerHTML = tag.innerHTML;

  const msgLarge = _nemEl('msgLarge');
  if (msgLarge) {
    if (msg) {
      const nextLarge = '"' + msg + '"';
      const prevLarge = msgLarge.dataset.nemRenderedMsg || '';
      msgLarge.style.display = '';
      if (prevLarge !== nextLarge) {
        _nemTypewrite(msgLarge, nextLarge);
        msgLarge.dataset.nemRenderedMsg = nextLarge;
      }
    } else {
      msgLarge.style.display = 'none';
      msgLarge.textContent = '';
      msgLarge.dataset.nemRenderedMsg = '';
    }
  }

  _nemRenderProgress(_nemSnapshot);
  _nemHandleLobbyEvents(baseCtx);
  if (_nemViewRole === 'admin') _nemHandleSpectatorEvents(baseCtx, state);

  nemEmit('nemesis:statechange', { integrity, state, sessionMode: _nemSessionMode, message: msg, mode: _nemAnimMode });
}

function _nemIsReferentPage() {
  return /referents\.html/i.test(window.location.pathname || '');
}

function _nemSpectatorSessionId() {
  return typeof _spectatorSessionId !== 'undefined' ? _spectatorSessionId : null;
}

function openFullscreen() {
  const qs = new URLSearchParams(window.location.search);
  if (!qs.get('nemesis')) {
    if (_nemIsReferentPage()) {
      window.open('/referents.html?nemesis=1', '_blank', 'noopener,noreferrer');
      return;
    }
    const sid = _nemSpectatorSessionId();
    if (sid) {
      const q = new URLSearchParams();
      q.set('spectator', String(sid));
      q.set('nemesis', '1');
      window.open(`/admin_dashboard.html?${q.toString()}`, '_blank', 'noopener,noreferrer');
      return;
    }
  }
  const wrap = _nemEl('fullscreenWrap');
  if (wrap) wrap.classList.add('show');
}

function closeFullscreen() {
  const qs = new URLSearchParams(window.location.search);
  if (qs.get('nemesis') === '1') {
    if (_nemIsReferentPage()) {
      window.location.href = '/referents.html';
      return;
    }
    const q = new URLSearchParams();
    const sid = _nemSpectatorSessionId();
    if (sid) q.set('spectator', String(sid));
    const suffix = q.toString();
    window.location.href = suffix ? `/admin_dashboard.html?${suffix}` : '/admin_dashboard.html';
    return;
  }
  const wrap = _nemEl('fullscreenWrap');
  if (wrap) wrap.classList.remove('show');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFullscreen();
});

window.addEventListener('nemesis:trigger', (e) => {
  const mode = e && e.detail ? e.detail.mode : null;
  const text = e && e.detail ? e.detail.text : '';
  const ms = e && e.detail ? Number(e.detail.ms || 0) : 0;
  const kind = e && e.detail ? String(e.detail.kind || 'event') : 'event';
  const priority = e && e.detail ? Number(e.detail.priority) : NaN;
  if (text) triggerNemesis(mode, text, ms || 4200, kind, Number.isFinite(priority) ? priority : undefined);
  else if (mode) setNemesisMode(mode, ms || 0);
});

function focusTeamNemesis(integrityPct, emotionalState) {
  updateNemesisUI({ integrity_pct: integrityPct, emotional_state: emotionalState, last_message: null }, 'competitive', _nemSnapshot);
}
