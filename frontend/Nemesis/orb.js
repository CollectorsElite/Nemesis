/* ============================================================
   NEMESIS — orb engine + UI update + fullscreen
   Compatibile con admin_dashboard.html
   ============================================================ */
class NemesisOrb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.CX = this.W / 2;
    this.CY = this.H / 2;

    this.ANIM_STATES = {
      idle:     { chaos: 0.15, speed: 0.45, pulseAmp: 4,  pulseFreq: 0.9 },
      talking:  { chaos: 0.42, speed: 1.25, pulseAmp: 11, pulseFreq: 2.2 },
      thinking: { chaos: 0.27, speed: 0.82, pulseAmp: 8,  pulseFreq: 1.5 },
      alert:    { chaos: 0.85, speed: 2.00, pulseAmp: 22, pulseFreq: 4.0 },
      success:  { chaos: 0.34, speed: 1.00, pulseAmp: 9,  pulseFreq: 1.7 },
      mock:     { chaos: 0.52, speed: 1.35, pulseAmp: 12, pulseFreq: 2.6 },
    };

    const base = this.ANIM_STATES.idle;
    this.integrity = 100;
    this.state = 'dominant';
    this.animMode = 'idle';
    this.MAX_PARTICLES = 300;
    this.MIN_PARTICLES = 45;
    this._activeCount = 300;
    this.particles = this._createParticles(this.MAX_PARTICLES);
    this.cfg = {
      color: [216, 110, 51],
      speed: base.speed,
      radius: this.W * 0.28,
      chaos: base.chaos,
      pulseAmp: base.pulseAmp,
      pulseFreq: base.pulseFreq,
    };
    this.targetCfg = { ...this.cfg };
    this.t = 0;
    this._dead = false;
    this._draw();
  }

  _createParticles(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.005 + Math.random() * 0.016,
        size: 0.7 + Math.random() * 1.4,
        offset: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.007,
      });
    }
    return arr;
  }

  update(integrity, state, phaseVisual, animMode) {
    this.integrity = Math.max(0, Math.min(100, integrity ?? 100));
    this.state = state || 'dominant';
    this.animMode = animMode || 'idle';
    const anim = this.ANIM_STATES[this.animMode] || this.ANIM_STATES.idle;
    const visual = phaseVisual || { color: [216, 110, 51], count: 300 };
    this.targetCfg = {
      color: [...visual.color],
      speed: anim.speed,
      radius: this.W * 0.28,
      chaos: anim.chaos,
      pulseAmp: anim.pulseAmp,
      pulseFreq: anim.pulseFreq,
    };
    this._activeCount = Math.max(this.MIN_PARTICLES, Math.min(this.MAX_PARTICLES, Math.round(visual.count)));
  }

  destroy() { this._dead = true; }
  _lerp(a, b, k) { return a + (b - a) * k; }
  _lerpC(a, b, k) { return [this._lerp(a[0], b[0], k), this._lerp(a[1], b[1], k), this._lerp(a[2], b[2], k)]; }
  _rgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }

  _draw() {
    if (this._dead) return;
    const k = 0.045;
    const cfg = this.cfg;
    const tgt = this.targetCfg;
    cfg.speed = this._lerp(cfg.speed, tgt.speed, k);
    cfg.radius = this._lerp(cfg.radius, tgt.radius, k);
    cfg.chaos = this._lerp(cfg.chaos, tgt.chaos, k);
    cfg.pulseAmp = this._lerp(cfg.pulseAmp, tgt.pulseAmp, k);
    cfg.pulseFreq = this._lerp(cfg.pulseFreq, tgt.pulseFreq, k);
    cfg.color = this._lerpC(cfg.color, tgt.color, 0.055);

    const ctx = this.ctx;
    const { W, H, CX, CY } = this;
    ctx.clearRect(0, 0, W, H);
    this.t += 0.016 * cfg.speed;

    const pulse = Math.sin(this.t * cfg.pulseFreq) * cfg.pulseAmp;
    const baseR = cfg.radius + pulse;

    const glow = ctx.createRadialGradient(CX, CY, baseR * 0.2, CX, CY, baseR * 1.7);
    glow.addColorStop(0, this._rgba(cfg.color, 0.13));
    glow.addColorStop(0.5, this._rgba(cfg.color, 0.05));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, baseR * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    const core = ctx.createRadialGradient(CX - baseR * 0.18, CY - baseR * 0.18, 0, CX, CY, baseR * 0.52);
    core.addColorStop(0, this._rgba(cfg.color, 0.20));
    core.addColorStop(1, this._rgba(cfg.color, 0.00));
    ctx.beginPath();
    ctx.arc(CX, CY, baseR * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();

    const count = this._activeCount || this.MAX_PARTICLES;
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.theta += (p.phaseSpeed * cfg.speed) + p.drift;
      p.phase += p.phaseSpeed * 1.2;

      const nx = Math.sin(p.phase * 1.8 + p.offset) * cfg.chaos * 20;
      const ny = Math.cos(p.phase * 2.2 + p.offset * 1.4) * cfg.chaos * 20;
      const r = baseR + Math.sin(p.phase + this.t) * 5 + nx * 0.35;
      const phi = p.phi + Math.sin(this.t * 0.38 + p.offset) * cfg.chaos * 0.38;

      const x3 = r * Math.sin(phi) * Math.cos(p.theta);
      const y3 = r * Math.cos(phi);
      const z3 = r * Math.sin(phi) * Math.sin(p.theta);
      const zN = (z3 + r) / (2 * r);
      const sx = CX + x3 + nx * 0.25;
      const sy = CY + y3 + ny * 0.25;
      const a = 0.22 + zN * 0.78;
      const sz = p.size * (0.35 + zN * 0.95);

      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fillStyle = this._rgba(cfg.color, a * 0.88);
      ctx.fill();

      if (i % 4 === 0) {
        for (let j = i + 1; j < Math.min(i + 6, count); j++) {
          const q = this.particles[j];
          const r2 = baseR + Math.sin(q.phase + this.t) * 5;
          const qx = CX + r2 * Math.sin(q.phi) * Math.cos(q.theta);
          const qy = CY + r2 * Math.cos(q.phi);
          const dx = sx - qx;
          const dy = sy - qy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 28) {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(qx, qy);
            ctx.strokeStyle = this._rgba(cfg.color, (1 - d / 28) * 0.16 * a);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    ctx.save();
    ctx.translate(CX, CY);
    const ringR = baseR + 8;
    const segs = 60;
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * Math.PI * 2 + this.t * 0.28;
      const a2 = ((i + 0.68) / segs) * Math.PI * 2 + this.t * 0.28;
      if (Math.sin(a1 * 3 + this.t * 1.8) < 0.18) continue;
      const al = 0.10 + 0.40 * ((Math.sin(a1 * 2 + this.t) + 1) / 2);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, a1, a2);
      ctx.strokeStyle = this._rgba(cfg.color, al);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
    requestAnimationFrame(() => this._draw());
  }
}

