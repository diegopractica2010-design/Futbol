(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const FIELD_WIDTH = 105;
  const FIELD_HEIGHT = 68;

  const clamp = FMG.clamp || ((v, lo, hi) => Math.min(hi, Math.max(lo, v)));

  // ============================================================
  // DETERMINISTIC RNG — mulberry32
  // ============================================================
  function mulberry32(seed) {
    return FMG.mulberry32 ? FMG.mulberry32(seed >>> 0) : fallbackMulberry32(seed);
  }

  function fallbackMulberry32(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(value) {
    if (FMG.hashText) return FMG.hashText(value) || 1;
    const text = String(value || "");
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h * 31) + text.charCodeAt(i)) >>> 0;
    return h || 1;
  }

  function colorToCss(color, fallback) {
    if (typeof color === "number") return "#" + color.toString(16).padStart(6, "0");
    return color || fallback;
  }

  function resolveClubIdentity(teamId, fallback) {
    const identity = FMG.getClubIdentity ? FMG.getClubIdentity(teamId) : null;
    return {
      primary: colorToCss(identity?.primary, colorToCss(fallback, "#f6f6f1")),
      secondary: colorToCss(identity?.secondary, "#1763a6"),
      accent: colorToCss(identity?.accent, "#f9a825")
    };
  }

  function makePosition(x, y, z) {
    x = Number(x) || 0; y = Number(y) || 0; z = Number(z) || 0;
    return {
      x, y, z,
      set(nx, ny, nz) { this.x = +nx || 0; this.y = +ny || 0; this.z = +nz || 0; return this; },
      copy(src) { this.x = +src?.x || 0; this.y = +src?.y || 0; this.z = +src?.z || 0; return this; }
    };
  }

  // ============================================================
  // BROADCAST PITCH RENDERER  (Phase 1)
  // ============================================================
  class BroadcastPitchRenderer {
    constructor() { this._offscreen = null; this._sig = ""; }

    draw(ctx, bounds) {
      const sig = Math.round(bounds.x) + "," + Math.round(bounds.y) + "," + Math.round(bounds.width) + "," + Math.round(bounds.height);
      if (!this._offscreen || this._sig !== sig) {
        this._offscreen = this._build(bounds);
        this._sig = sig;
      }
      ctx.drawImage(this._offscreen, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    toScreen(point, bounds) {
      const nx = clamp(((+point?.x || 0) + FIELD_WIDTH / 2) / FIELD_WIDTH, 0, 1);
      const ny = clamp(((+point?.z || 0) + FIELD_HEIGHT / 2) / FIELD_HEIGHT, 0, 1);
      return { x: bounds.x + nx * bounds.width, y: bounds.y + ny * bounds.height };
    }

    fromScreen(point, bounds) {
      return {
        x: clamp((point.x - bounds.x) / bounds.width, 0, 1) * FIELD_WIDTH - FIELD_WIDTH / 2,
        y: 0,
        z: clamp((point.y - bounds.y) / bounds.height, 0, 1) * FIELD_HEIGHT - FIELD_HEIGHT / 2
      };
    }

    _build(bounds) {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(bounds.width * dpr));
      cv.height = Math.max(1, Math.round(bounds.height * dpr));
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);
      this._drawAll(ctx, bounds.width, bounds.height);
      return cv;
    }

    _drawAll(ctx, W, H) {
      const rng = mulberry32(hashSeed("pitch2025"));
      const mX = W / FIELD_WIDTH, mY = H / FIELD_HEIGHT;
      const map = (x, z) => ({ x: (x + FIELD_WIDTH / 2) * mX, y: (z + FIELD_HEIGHT / 2) * mY });

      // === BASE GRASS ===
      ctx.fillStyle = "#1e3d0f";
      ctx.fillRect(0, 0, W, H);

      // Mow stripes — alternating ~38 px bands with slight irregularity
      const strH = 38;
      const nStripes = Math.ceil(H / strH) + 2;
      for (let i = 0; i < nStripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#1e3d0f" : "#244d13";
        ctx.fillRect(0, i * strH, W, strH);
      }

      // Vertical depth darkening toward far (top) side
      const depthGrad = ctx.createLinearGradient(0, 0, 0, H);
      depthGrad.addColorStop(0, "rgba(0,0,0,0.14)");
      depthGrad.addColorStop(0.38, "rgba(0,0,0,0.05)");
      depthGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = depthGrad;
      ctx.fillRect(0, 0, W, H);

      // ~800 organic texture dots
      for (let i = 0; i < 800; i++) {
        const dx = rng() * W, dy = rng() * H;
        const a = 0.02 + rng() * 0.04;
        ctx.fillStyle = "rgba(0,0,0," + a + ")";
        ctx.beginPath();
        ctx.arc(dx, dy, 0.5 + rng() * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wear zones — penalty areas slightly lighter
      const areaW = 40.32 * mX, areaH = 16.5 * mY;
      ctx.fillStyle = "rgba(101,67,33,0.06)";
      ctx.fillRect((W - areaW) / 2, 0, areaW, areaH);
      ctx.fillRect((W - areaW) / 2, H - areaH, areaW, areaH);

      // Center circle worn patch
      ctx.fillStyle = "rgba(101,67,33,0.035)";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 9.15 * Math.min(mX, mY) * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Goalmouth dirt patches
      const gmW = 7.32 * mX * 2.6;
      ctx.fillStyle = "rgba(101,67,33,0.06)";
      ctx.fillRect((W - gmW) / 2, 0, gmW, 9 * mY);
      ctx.fillRect((W - gmW) / 2, H - 9 * mY, gmW, 9 * mY);

      // === FIELD LINES — realistic painted, not neon ===
      const LC = "rgba(255,255,255,0.75)";
      ctx.strokeStyle = LC;
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "miter";

      // Outer boundary
      ctx.strokeRect(1, 1, W - 2, H - 2);

      // Halfway line
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 9.15 * Math.min(mX, mY), 0, Math.PI * 2);
      ctx.stroke();

      // Center spot
      ctx.fillStyle = LC;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 2.2, 0, Math.PI * 2); ctx.fill();

      // Penalty zones both ends
      this._penaltyZone(ctx, map, mX, mY, -FIELD_HEIGHT / 2, 1, LC);
      this._penaltyZone(ctx, map, mX, mY, FIELD_HEIGHT / 2, -1, LC);

      // Corner arcs
      const cr = 1.5 * Math.min(mX, mY);
      [[0, 0, 0, Math.PI / 2], [W, 0, Math.PI / 2, Math.PI], [W, H, Math.PI, 1.5 * Math.PI], [0, H, 1.5 * Math.PI, Math.PI * 2]].forEach(([x, y, s, e]) => {
        ctx.beginPath(); ctx.arc(x, y, cr, s, e); ctx.stroke();
      });

      // === PSEUDO-3D GOALS ===
      this._goal3D(ctx, W, H, mX, mY, "top");
      this._goal3D(ctx, W, H, mX, mY, "bottom");

      const light = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, W * 0.72);
      light.addColorStop(0, "rgba(255,255,200,0.04)");
      light.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, W, 18);
      ctx.fillRect(0, H - 18, W, 18);
      ctx.fillRect(0, 0, 18, H);
      ctx.fillRect(W - 18, 0, 18, H);

      this._drawCornerVignette(ctx, W, H, 0, 0);
      this._drawCornerVignette(ctx, W, H, W, 0);
      this._drawCornerVignette(ctx, W, H, 0, H);
      this._drawCornerVignette(ctx, W, H, W, H);
    }

    _drawCornerVignette(ctx, W, H, x, y) {
      const r = Math.max(W, H) * 0.48;
      const g = ctx.createRadialGradient(x, y, r * 0.14, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,0.24)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    _penaltyZone(ctx, map, mX, mY, gz, dir, LC) {
      const aD = 16.5, aW = 40.32, sD = 5.5, sW = 18.32;
      const a1 = map(-aW / 2, gz), a2 = map(aW / 2, gz + dir * aD);
      const s1 = map(-sW / 2, gz), s2 = map(sW / 2, gz + dir * sD);
      ctx.strokeStyle = LC; ctx.lineWidth = 1.2;
      ctx.strokeRect(Math.min(a1.x, a2.x), Math.min(a1.y, a2.y), Math.abs(a2.x - a1.x), Math.abs(a2.y - a1.y));
      ctx.strokeRect(Math.min(s1.x, s2.x), Math.min(s1.y, s2.y), Math.abs(s2.x - s1.x), Math.abs(s2.y - s1.y));
      const ps = map(0, gz + dir * 11);
      ctx.fillStyle = LC;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = LC; ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (dir > 0) ctx.arc(ps.x, ps.y, 9.15 * Math.min(mX, mY), Math.PI * 0.14, Math.PI * 0.86);
      else ctx.arc(ps.x, ps.y, 9.15 * Math.min(mX, mY), Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
    }

    _goal3D(ctx, W, H, mX, mY, side) {
      const postW = 7.32 * mX;
      const px = (W - postW) / 2;
      const barH = 2.44 * mY;
      const isTop = side === "top";
      const goalY = isTop ? 0 : H;
      const depth = 4.5 * mY * (isTop ? 1 : -1);

      ctx.save();

      // Front posts
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      const postTop = isTop ? goalY : goalY - barH;
      ctx.fillRect(px - 2.5, postTop, 3, barH);
      ctx.fillRect(px + postW, postTop, 3, barH);

      // Crossbar
      ctx.fillRect(px - 2.5, isTop ? goalY : goalY - barH, postW + 5.5, 2.8);

      // Back frame (perspective depth)
      ctx.fillStyle = "rgba(210,210,210,0.45)";
      const backTop = isTop ? goalY + depth : goalY - barH + depth;
      ctx.fillRect(px - 1, backTop, 2, barH);
      ctx.fillRect(px + postW + 1, backTop, 2, barH);
      ctx.fillRect(px - 1, backTop, postW + 3, 2);

      // Net lines
      ctx.strokeStyle = "rgba(255,255,255,0.13)";
      ctx.lineWidth = 0.6;
      const netCols = 7, netRows = 5;
      for (let c = 0; c <= netCols; c++) {
        const nx = px + (c / netCols) * postW;
        const lean = (c - netCols / 2) * 1.2;
        ctx.beginPath();
        ctx.moveTo(nx, isTop ? goalY : goalY - barH);
        ctx.lineTo(nx + lean, isTop ? goalY + depth : goalY - barH + depth);
        ctx.stroke();
      }
      for (let r = 0; r <= netRows; r++) {
        const ry = isTop ? goalY + (r / netRows) * depth : goalY - barH + (r / netRows) * depth;
        ctx.beginPath(); ctx.moveTo(px, ry); ctx.lineTo(px + postW, ry); ctx.stroke();
      }

      // Goal shadow
      const sg = ctx.createLinearGradient(px, isTop ? goalY : goalY - barH, px, isTop ? goalY + depth * 2.2 : goalY + depth * 2.2);
      sg.addColorStop(0, "rgba(0,0,0,0.1)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(px - 6, isTop ? goalY : goalY + depth, postW + 14, Math.abs(depth) * 2.2);

      ctx.restore();
    }
  }

  // ============================================================
  // BROADCAST CAMERA  (Phase 2)
  // ============================================================
  class BroadcastCamera {
    constructor() {
      this.panX = 0; this.panY = 0; this.zoom = 1;
      this.tX = 0; this.tY = 0; this.tZoom = 1;
      this.vX = 0; this.vY = 0; this.vZ = 0;
      this.shakeAmt = 0;
      this._shakeRng = mulberry32(hashSeed("camshake"));
      this._prevBx = 0; this._prevBz = 0;
    }

    onGoal()    { this.tZoom = 1.16; this.shakeAmt = 6.5; setTimeout(() => { this.tZoom = 1; }, 1600); }
    onShot()    { this.tZoom = 1.09; setTimeout(() => { this.tZoom = 1; }, 750); }
    onCounter() { this.tZoom = 0.90; setTimeout(() => { this.tZoom = 1; }, 1000); }
    onDesperation() { this.tZoom = 0.93; setTimeout(() => { this.tZoom = 1; }, 1200); }
    onPanic()   { this.shakeAmt = 3.5; }

    trackBall(ballPos, momentum, humanAI) {
      if (!ballPos) return;
      const bx = (ballPos.x / FIELD_WIDTH);
      const bz = (ballPos.z / FIELD_HEIGHT);
      // Velocity anticipation: lean ahead of ball movement direction
      const vx = bx - this._prevBx || 0;
      const vz = bz - this._prevBz || 0;
      this._prevBx = bx; this._prevBz = bz;
      const anticipateX = vx * 1.8;
      const anticipateZ = vz * 1.4;
      const tx = bx + anticipateX;
      const tz = bz + anticipateZ;
      const dx = tx - this.tX, dz = tz - this.tY;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) { this.tX += dx * 0.32; this.tY += dz * 0.32; }
      this.tX = clamp(this.tX, -0.18, 0.18);
      this.tY = clamp(this.tY, -0.18, 0.18);
      // Momentum-driven zoom: attacking pressure shows wide view, close attack shows tight
      if (momentum !== undefined) {
        const gap = Math.abs((momentum || 50) - 50);
        if (gap > 25 && Math.abs(bz) > 0.25) this.tZoom = clamp(1 + gap * 0.003, 1, 1.08);
      }
      // Desperation camera: widen when desperate team pushes forward
      if (humanAI) {
        const homeDesp = humanAI.desperation && humanAI.desperation.home || 0;
        const awayDesp = humanAI.desperation && humanAI.desperation.away || 0;
        const maxDesp = Math.max(homeDesp, awayDesp);
        if (maxDesp > 0.5 && this.tZoom >= 1) this.tZoom = clamp(1 - maxDesp * 0.06, 0.91, 1);
      }
    }

    update(dt) {
      const a = clamp(dt / 240, 0, 1);
      this.vX = this.vX * 0.72 + (this.tX - this.panX) * a;
      this.vY = this.vY * 0.72 + (this.tY - this.panY) * a;
      this.vZ = this.vZ * 0.72 + (this.tZoom - this.zoom) * a;
      this.panX += this.vX; this.panY += this.vY; this.zoom += this.vZ;
      this.zoom = clamp(this.zoom, 0.86, 1.22);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 0.036);
    }

    getShakeOffset() {
      if (this.shakeAmt <= 0) return { x: 0, y: 0 };
      const r = this._shakeRng;
      return { x: (r() - 0.5) * this.shakeAmt, y: (r() - 0.5) * this.shakeAmt };
    }

    transformBounds(bounds) {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const z = this.zoom;
      return {
        x: cx - (bounds.width * z) / 2 + this.panX * bounds.width,
        y: cy - (bounds.height * z) / 2 + this.panY * bounds.height,
        width: bounds.width * z,
        height: bounds.height * z
      };
    }
  }

  // ============================================================
  // ANIMATION SYSTEM  (API preserved)
  // ============================================================
  class TacticalAnimationSystem {
    constructor(options = {}) {
      this.defaultDuration = Math.max(1, Number(options.defaultDuration) || 600);
      this.animations = [];
      this.sequence = 0;
    }

    movePosition(position, targetPos, duration, options) {
      if (!position) return null;
      duration = Math.max(1, Number(duration) || this.defaultDuration);
      options = options || {};
      const prev = this.animations.find(a => a.position === position);
      const anim = {
        id: ++this.sequence, position,
        start: { x: +position.x || 0, y: +position.y || 0, z: +position.z || 0 },
        target: { x: +targetPos?.x || 0, y: +targetPos?.y || 0, z: +targetPos?.z || 0 },
        duration, elapsed: 0,
        easing: options.easing || "smooth",
        inertia: isFinite(+options.inertia) ? +options.inertia : 0.42,
        blend: isFinite(+options.blend) ? +options.blend : 0.64,
        velocity: prev?.velocity ? { ...prev.velocity } : { x: 0, y: 0, z: 0 },
        onComplete: options.onComplete || null
      };
      this.animations = this.animations.filter(a => a.position !== position);
      this.animations.push(anim);
      return anim.id;
    }

    update(deltaMs) {
      const dt = Math.max(0, Number(deltaMs) || 0);
      if (!this.animations.length || !dt) return;
      const done = [];
      this.animations = this.animations.filter(anim => {
        anim.elapsed = Math.min(anim.duration, anim.elapsed + dt);
        const p = clamp(anim.elapsed / anim.duration, 0, 1);
        const e = this._ease(p, anim.easing);
        const dx = anim.start.x + (anim.target.x - anim.start.x) * e;
        const dy = anim.start.y + (anim.target.y - anim.start.y) * e;
        const dz = anim.start.z + (anim.target.z - anim.start.z) * e;
        const pull = clamp(anim.blend, 0.1, 1), carry = clamp(anim.inertia, 0, 0.82);
        anim.velocity.x = anim.velocity.x * carry + (dx - anim.position.x) * pull;
        anim.velocity.y = anim.velocity.y * carry + (dy - anim.position.y) * pull;
        anim.velocity.z = anim.velocity.z * carry + (dz - anim.position.z) * pull;
        anim.position.x += anim.velocity.x;
        anim.position.y += anim.velocity.y;
        anim.position.z += anim.velocity.z;
        if (p >= 1) {
          anim.position.x = anim.target.x; anim.position.y = anim.target.y; anim.position.z = anim.target.z;
          done.push(anim); return false;
        }
        return true;
      });
      done.forEach(a => { if (typeof a.onComplete === "function") a.onComplete(a); });
    }

    snapshot() {
      return {
        sequence: this.sequence,
        animations: this.animations.map(a => ({
          id: a.id, start: { ...a.start }, target: { ...a.target },
          duration: a.duration, elapsed: a.elapsed, easing: a.easing, velocity: { ...a.velocity }
        }))
      };
    }

    clear() { this.animations = []; }

    _ease(p, easing) {
      if (easing === "linear") return p;
      if (easing === "quick") return 1 - Math.pow(1 - p, 2);
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    }
  }

  // ============================================================
  // PARTICLE POOL  (Phase 7)
  // ============================================================
  class ParticlePool {
    constructor(max) { this.max = max || 140; this.p = []; }

    emit(x, y, vx, vy, color, life, size) {
      if (this.p.length >= this.max) return;
      this.p.push({ x, y, vx, vy, color, life, maxLife: life, size });
    }

    update(dt) {
      this.p = this.p.filter(p => {
        p.x += p.vx * dt * 0.055;
        p.y += p.vy * dt * 0.055;
        p.vy += 0.045 * dt;
        p.life -= dt;
        return p.life > 0;
      });
    }

    draw(ctx) {
      this.p.forEach(p => {
        const a = clamp(p.life / p.maxLife, 0, 1) * 0.88;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      });
    }

    clear() { this.p = []; }
  }

  // ============================================================
  // BALL TRAIL  (Phase 4)
  // ============================================================
  class BallTrail {
    constructor() { this.pts = []; this.maxPts = 6; }

    push(x, y, speed) {
      this.pts.push({ x, y, speed, age: 0 });
      if (this.pts.length > this.maxPts) this.pts.shift();
    }

    update(dt) {
      this.pts.forEach(p => p.age += dt);
      this.pts = this.pts.filter(p => p.age < 260);
    }

    draw(ctx) {
      if (this.pts.length < 2) return;
      ctx.save();
      for (let i = 1; i < this.pts.length; i++) {
        const p = this.pts[i], q = this.pts[i - 1];
        const rank = i / Math.max(1, this.pts.length - 1);
        const a = clamp(0.02 + rank * 0.16, 0.02, 0.18) * clamp(1 - p.age / 260, 0, 1);
        ctx.strokeStyle = "rgba(255,255,255," + a + ")";
        ctx.lineWidth = clamp(p.speed * 0.08, 0.8, 3.2);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ============================================================
  // CROWD RENDERER  (Phase 1)
  // ============================================================
  class CrowdRenderer {
    constructor() { this._bmp = null; this._sig = ""; }

    draw(ctx, bounds, intensity) {
      intensity = clamp(intensity || 0.65, 0.2, 1);
      const sig = Math.round(bounds.width) + "," + Math.round(intensity * 8);
      if (!this._bmp || this._sig !== sig) { this._bmp = this._build(bounds.width, intensity); this._sig = sig; }
      ctx.save();
      ctx.globalAlpha = 0.82;
      // top stands
      ctx.drawImage(this._bmp, bounds.x, bounds.y - 26, bounds.width, 26);
      // bottom stands (mirrored)
      ctx.save();
      ctx.translate(0, bounds.y + bounds.height + 26);
      ctx.scale(1, -1);
      ctx.drawImage(this._bmp, bounds.x, 0, bounds.width, 26);
      ctx.restore();
      ctx.restore();
    }

    _build(W, intensity) {
      const rng = mulberry32(hashSeed("crowd24"));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(W)); cv.height = 26;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#0c1812"; ctx.fillRect(0, 0, cv.width, 26);
      const shirts = ["#c62828","#1565c0","#f9a825","#fff","#2e7d32","#6a1b9a","#00838f","#e65100","#ad1457"];
      const cols = Math.floor(cv.width / 5);
      for (let i = 0; i < cols; i++) {
        const x = i * 5 + rng() * 2.5;
        const h = 9 + rng() * 7, ry = 26 - h;
        ctx.fillStyle = "#19281e"; ctx.fillRect(x, ry, 4, h);
        if (rng() < intensity) {
          ctx.fillStyle = shirts[Math.floor(rng() * shirts.length)];
          ctx.globalAlpha = 0.5 + rng() * 0.35;
          ctx.fillRect(x, ry + 3, 3, h - 5);
          ctx.globalAlpha = 1;
        }
      }
      return cv;
    }
  }

  // ============================================================
  // CINEMATIC EVENT CONTROLLER  (Phase 7)
  // ============================================================
  class CinematicController {
    constructor() {
      this.flashAlpha = 0;
      this.flashColor = "rgba(255,255,255,1)";
      this.events = [];
    }

    triggerGoal(x, y, teamColor, particles) {
      this.flashAlpha = 0.72;
      this.flashColor = teamColor || "rgba(255,220,80,1)";
      const rng = mulberry32(hashSeed("goalfx" + Math.round(x + y)));
      const cols = [teamColor || "#f9a825", "#ffffff", "#ffd54f"];
      for (let i = 0; i < 30; i++) {
        const angle = rng() * Math.PI * 2;
        const spd = 3.5 + rng() * 6.5;
        particles.emit(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd - 5.5,
          cols[Math.floor(rng() * cols.length)], 1200 + rng() * 800, 3 + rng() * 3);
      }
      this.events.push({ type: "goal", life: 2600, maxLife: 2600 });
    }

    triggerShot(x, y, particles) {
      void particles;
      this.events.push({ type: "shot", x, y, life: 500, maxLife: 500 });
    }

    // Phase 7 — foul/card flash
    triggerFoul(isRed) {
      this.flashAlpha = isRed ? 0.28 : 0.18;
      this.flashColor = isRed ? "rgba(180,30,20,1)" : "rgba(220,160,0,1)";
      this.events.push({ type: isRed ? "red-card" : "yellow-card", life: 1800, maxLife: 1800 });
    }

    triggerFoulAt(x, y) {
      this.flashAlpha = 0.18;
      this.flashColor = "rgba(220,160,0,1)";
      this.events.push({ type: "foul-hex", x, y, life: 800, maxLife: 800 });
    }

    triggerOffside(y, text) {
      this.events.push({ type: "offside", y, text: text || "FUERA DE JUEGO", life: 1500, maxLife: 1500 });
    }

    // Phase 7 — VAR freeze style
    triggerVAR(text) {
      this.events = this.events.filter(e => e.type !== "var");
      this.events.push({ type: "var", life: 2400, maxLife: 2400, text: text || "VAR" });
    }

    update(dt) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.0028);
      this.events = this.events.filter(e => { e.life -= dt; return e.life > 0; });
    }

    drawFlash(ctx, W, H) {
      if (this.flashAlpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    drawGoalOverlay(ctx, W, H) {
      const ev = this.events.find(e => e.type === "goal");
      if (!ev) return;
      const t = ev.life / ev.maxLife;
      const fadeIn = t > 0.85 ? (1 - t) / 0.15 : 1;
      const fadeOut = t < 0.2 ? t / 0.2 : 1;
      const alpha = Math.min(fadeIn, fadeOut);
      const scale = t > 0.85 ? 0.5 + fadeIn * 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H / 2 - 18);
      ctx.scale(scale, scale);
      ctx.font = "900 68px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#f9a825";
      ctx.fillText("⚽ GOL!", 0, 0);
      ctx.restore();
    }

    drawEventOverlays(ctx, W, H) {
      this.events.forEach(ev => {
        if (ev.type === "shot") this._drawShotRipple(ctx, ev);
        if (ev.type === "foul-hex") this._drawFoulHex(ctx, ev);
        if (ev.type === "offside") this._drawOffside(ctx, W, H, ev);
      });
    }

    _drawShotRipple(ctx, ev) {
      const p = 1 - ev.life / ev.maxLife;
      ctx.save();
      ctx.globalAlpha = clamp(1 - p, 0, 1);
      ctx.strokeStyle = "rgba(220,35,35,0.86)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ev.x, ev.y, p * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    _drawFoulHex(ctx, ev) {
      const p = 1 - ev.life / ev.maxLife;
      const r = 12 + p * 18;
      ctx.save();
      ctx.globalAlpha = clamp(1 - p, 0, 1);
      ctx.fillStyle = "rgba(255,210,40,0.35)";
      ctx.strokeStyle = "rgba(255,225,70,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const x = ev.x + Math.cos(a) * r;
        const y = ev.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _drawOffside(ctx, W, H, ev) {
      const p = 1 - ev.life / ev.maxLife;
      const alpha = p < 0.12 ? p / 0.12 : ev.life / ev.maxLife;
      const y = clamp(ev.y || H / 2, 72, H - 32);
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "900 26px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#f2f5ee";
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = 10;
      ctx.fillText(ev.text, W / 2, y - 8);
      ctx.restore();
    }

    // Phase 7 — card badge overlay
    drawCardOverlay(ctx, W, _H) {
      const card = this.events.find(e => e.type === "yellow-card" || e.type === "red-card");
      if (!card) return;
      const t = card.life / card.maxLife;
      const alpha = t > 0.85 ? clamp((1 - t) / 0.15, 0, 1) : t < 0.15 ? clamp(t / 0.15, 0, 1) : 1;
      const isRed = card.type === "red-card";
      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      const cX = W - 64, cY = 72;
      ctx.fillStyle = isRed ? "#b71c1c" : "#f9a825";
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 14;
      this._roundRectFill(ctx, cX, cY, 38, 52, 5);
      ctx.shadowColor = "transparent";
      ctx.restore();
    }

    // Phase 7 — VAR overlay
    drawVAROverlay(ctx, W, H) {
      const ev = this.events.find(e => e.type === "var");
      if (!ev) return;
      const t = ev.life / ev.maxLife;
      const alpha = t > 0.9 ? clamp((1 - t) / 0.1, 0, 1) : t < 0.15 ? clamp(t / 0.15, 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha = alpha * 0.88;
      // Thin VAR bar at bottom
      ctx.fillStyle = "rgba(8,18,14,0.94)";
      ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, H - 41, W, 1);
      // VAR label
      ctx.fillStyle = "#e8c466";
      ctx.font = "900 14px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("VAR", 18, H - 20);
      ctx.fillStyle = "rgba(240,245,235,0.82)";
      ctx.font = "600 12px \"Segoe UI\", Arial, sans-serif";
      ctx.fillText(ev.text || "Revision en curso...", 58, H - 20);
      // Blinking indicator
      const blink = Math.sin(performance.now() * 0.006) > 0;
      if (blink) {
        ctx.fillStyle = "#e8c466";
        ctx.beginPath(); ctx.arc(W - 24, H - 20, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    _roundRectFill(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ============================================================
  // MATCH VISUALIZER — MAIN CLASS
  // ============================================================
  class MatchVisualizer {
    constructor(containerElement) {
      this.container = containerElement;
      this.canvas = null;
      this.context = null;
      this.renderer = null;

      this.pitchRenderer = new BroadcastPitchRenderer();
      this.camera = new BroadcastCamera();
      this.crowd = new CrowdRenderer();
      this.particles = new ParticlePool(150);
      this.ballTrail = new BallTrail();
      this.cinematic = new CinematicController();

      this.tacticalEngine = FMG.TacticalPositioningEngine ? new FMG.TacticalPositioningEngine() : null;
      this.atmosphere = FMG.MatchAtmosphereController ? new FMG.MatchAtmosphereController() : null;

      this.players = {};
      this.ball = null;
      this.animationFrameId = null;
      this.isRunning = false;
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
      this.animationSystem = new TacticalAnimationSystem({ defaultDuration: 600 });

      this.config = { fieldWidth: FIELD_WIDTH, fieldHeight: FIELD_HEIGHT, targetFrameTime: 1000 / 60 };

      this.matchState = {
        homeTeamId: null, awayTeamId: null,
        homeGoals: 0, awayGoals: 0,
        minute: 0, possession: 50, momentum: 50,
        lastEvent: null, playerPositions: {}
      };

      this.flowPaths = [];
      this.tacticalOverlays = { supportLines: [], pressZones: [], shapeLines: { home: [], away: [] }, phase: null };
      this.presentation = null;
      this.teamColors = { home: "#f6f6f1", away: "#1763a6" };
      this.teamIdentities = {
        home: { primary: "#f6f6f1", secondary: "#111111", accent: "#f9a825" },
        away: { primary: "#1763a6", secondary: "#ffffff", accent: "#f9a825" }
      };

      this._cssWidth = 0;
      this._cssHeight = 0;
      this._prevBallScr = null;
      this._lastFrameTime = 0;
      this._resizeHandler = null;

      // Phase 6 — storytelling state
      this._story = {
        dominantSide: "neutral",   // "home" | "away" | "neutral"
        intensity: 0,              // 0–1 final-minutes intensity
        tintAlpha: 0,              // current overlay alpha
        tintColor: "rgba(0,0,0,0)"
      };

      // Phase 5 — chaos state (deterministic, per-minute slot)
      this._chaosMinuteSlot = -1;
      this._chaosMod = {};  // per-player chaos offsets for current slot
    }

    // ----------------------------------------------------------
    // PUBLIC API  (preserved exactly from original)
    // ----------------------------------------------------------
    init() {
      if (this.canvas) return;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "match-tactical-canvas";
      this.canvas.style.cssText = "display:block;width:100%;height:100%;";
      this.context = this.canvas.getContext("2d");
      if (!this.context) throw new Error("Canvas 2D renderer unavailable");
      this.renderer = {
        domElement: this.canvas,
        setSize: (w, h) => this._resizeCanvas(w, h),
        render: () => this.render()
      };
      this.container.appendChild(this.canvas);
      this._resizeHandler = () => this.onWindowResize();
      window.addEventListener("resize", this._resizeHandler);
      this.onWindowResize();
      this.startRendering();
    }

    setTeamInfo(homeTeamId, homeTeamColor, awayTeamId, awayTeamColor) {
      this.matchState.homeTeamId = homeTeamId;
      this.matchState.awayTeamId = awayTeamId;
      this.teamIdentities.home = resolveClubIdentity(homeTeamId, homeTeamColor);
      this.teamIdentities.away = resolveClubIdentity(awayTeamId, awayTeamColor);
      this.teamColors.home = this.teamIdentities.home.primary;
      this.teamColors.away = this.teamIdentities.away.secondary;
    }

    addPlayer(playerId, startPos, isHome, meta) {
      meta = meta || {};
      const pid = String(playerId);
      const pos = makePosition(startPos?.x, startPos?.y, startPos?.z);
      const rng = mulberry32(hashSeed(pid + "init"));
      const driftSeed = hashSeed(pid);
      const driftPeriod = driftSeed % 6 + 7;
      const driftPhase = driftSeed * 1.3;
      this.players[pid] = {
        id: pid, isHome,
        name: meta.name || pid,
        positionCode: meta.position || "",
        energy: Number(meta.energy) || 75,
        mesh: { position: pos },
        position: pos,
        targetPosition: makePosition(pos.x, pos.y, pos.z),
        basePosition: makePosition(pos.x, pos.y, pos.z),
        // Layer 2 — role drift
        driftPeriod, driftPhase,
        driftPhX: driftPhase, driftPhZ: driftPhase + Math.PI / 2,
        driftRX: (Math.PI * 2) / driftPeriod, driftRZ: (Math.PI * 2) / driftPeriod,
        driftAX: 1.2, driftAZ: 1,
        // Layer 3 — micro restlessness
        restPh: rng() * Math.PI * 2, restRate: 0.55 + rng() * 0.9,
        jitterX: 0, jitterZ: 0, jitterSlot: -1,
        number: meta.number || meta.shirtNumber || String(pid).slice(-2),
        // Kinematics
        facing: 0, speed: 0, prevX: pos.x, prevZ: pos.z,
        // FIX 1: render positions computed every frame (drift + rest layered here)
        renderX: pos.x, renderZ: pos.z,
        hasBall: false
      };
      this.matchState.playerPositions[pid] = { x: pos.x, y: pos.y, z: pos.z, isHome };
    }

    createBall() {
      const pos = makePosition(0, 0.22, 0);
      this.ball = {
        position: pos,
        targetPosition: makePosition(0, 0.22, 0),
        // FIX 2: render positions interpolate slowly toward position (lerp 0.08/frame)
        renderX: 0, renderZ: 0, renderY: 0.22,
        spin: 0, spinRate: 0,
        squash: 1, bouncePhase: 0, lastSpeed: 0
      };
    }

    updateMatchState(minute, homeGoals, awayGoals, possession) {
      this.matchState.minute = minute;
      this.matchState.homeGoals = homeGoals;
      this.matchState.awayGoals = awayGoals;
      this.matchState.possession = possession !== undefined ? possession : 50;
    }

    setMatchContext(context) {
      context = context || {};
      this.matchState.momentum = Number(context.momentum) || this.matchState.momentum || 50;
      this.matchState.lastEvent = context.lastEvent || null;
      if (context.presentation) this.presentation = context.presentation;
      if (context.gameState && context.liveMatch && this.atmosphere) {
        this.presentation = this.atmosphere.sync(context.gameState, context.liveMatch);
      }

      // Sync player energy
      const players = context.players || {};
      Object.keys(players).forEach(id => {
        if (!this.players[id]) return;
        this.players[id].name = players[id].name || this.players[id].name;
        this.players[id].energy = Number(players[id].energy) || this.players[id].energy;
      });

      // Trigger cinematics from last event
      const ev = context.lastEvent;
      if (ev && !ev._vis_handled) {
        ev._vis_handled = true;
        const isHome = ev.teamId === this.matchState.homeTeamId;
        const teamColor = isHome ? this.teamColors.home : this.teamColors.away;
        if (ev.type === "goal") {
          this.camera.onGoal();
          const goalZ = isHome ? FIELD_HEIGHT / 2 - 2 : -FIELD_HEIGHT / 2 + 2;
          const gs = this.pitchRenderer.toScreen({ x: 0, z: goalZ }, this.bounds);
          this.cinematic.triggerGoal(gs.x, gs.y, teamColor, this.particles);
        } else if (ev.type === "shot" || ev.type === "shot-on-target") {
          this.camera.onShot();
          if (this.ball) {
            const bs = this.pitchRenderer.toScreen(this.ball.position, this.bounds);
            this.cinematic.triggerShot(bs.x, bs.y, this.particles);
            this.ball.squash = 1.4;
          }
        } else if (ev.type === "chance") {
          this.camera.onCounter();
        } else if (ev.type === "red-card") {
          this.cinematic.triggerFoul(true);
          this.cinematic.triggerVAR("Tarjeta roja — revision completada");
        } else if (ev.type === "yellow-card") {
          const fs = this._eventScreenPosition(ev);
          this.cinematic.triggerFoulAt(fs.x, fs.y);
        } else if (ev.type === "foul") {
          const fs = this._eventScreenPosition(ev);
          this.cinematic.triggerFoulAt(fs.x, fs.y);
        } else if (ev.type === "offside") {
          const fs = this._eventScreenPosition(ev);
          this.cinematic.triggerOffside(fs.y, "FUERA DE JUEGO");
        } else if (ev.type === "narrative") {
          // Pressure narrative events from matchNarrative.js — cinematic camera response
          const lm = this._liveMatch;
          const humanAI = lm && lm.humanAI;
          if (humanAI) {
            const homeDesp = (humanAI.desperation && humanAI.desperation.home) || 0;
            const awayDesp = (humanAI.desperation && humanAI.desperation.away) || 0;
            if (Math.max(homeDesp, awayDesp) > 0.4) this.camera.onDesperation();
            const homePanic = (humanAI.panic && humanAI.panic.home) || 0;
            const awayPanic = (humanAI.panic && humanAI.panic.away) || 0;
            if (Math.max(homePanic, awayPanic) > 0.5) this.camera.onPanic();
          }
        }
      }

      // Phase 6 — update storytelling state
      this._updateStoryState();
    }

    moveTeamShape(liveMatch) {
      if (!liveMatch) return;
      if (this.tacticalEngine) {
        const t = this.tacticalEngine.compute(liveMatch, this.players, this.ball?.position);
        this.tacticalOverlays = t.overlays;
        Object.keys(t.targets).forEach(id => this.animatePlayerMove(id, t.targets[id], 1400));
        if (this.ball && t.ball) this.animateBallMove(t.ball, 420);
        return;
      }
      const minute = Number(liveMatch.minute) || 0;
      const homePoss = Number(liveMatch.result?.stats?.home?.possession) || this.matchState.possession || 50;
      const momentum = Number(liveMatch.momentum) || 50;
      const timeline = Array.isArray(liveMatch.result?.timeline) ? liveMatch.result.timeline : [];
      const lastEv = timeline[timeline.length - 1] || null;
      const evTeam = lastEv && lastEv.minute >= minute - 2 ? lastEv.teamId : null;
      const t = performance.now() * 0.001;

      Object.keys(this.players).forEach(id => {
        const pl = this.players[id];
        const base = pl.basePosition || pl.mesh.position;
        const sideSign = pl.isHome ? 1 : -1;
        const hasBallBias = pl.isHome ? homePoss - 50 : 50 - homePoss;
        const momBias = pl.isHome ? momentum - 50 : 50 - momentum;

        // Layer 2: role drift (sinusoidal, unique per player)
        const driftX = Math.sin(t * pl.driftRX + pl.driftPhX) * pl.driftAX;
        const driftZ = Math.cos(t * pl.driftRZ + pl.driftPhZ) * pl.driftAZ;

        const ownsEv = evTeam && ((pl.isHome && evTeam === liveMatch.homeTeamId) || (!pl.isHome && evTeam === liveMatch.awayTeamId));
        const evLift = ownsEv ? 4.5 : 0;
        const roleDepth = pl.positionCode === "POR" ? 0 : pl.positionCode === "DEF" ? 2 : pl.positionCode === "MED" ? 5 : 8;

        // Layer 4: ball awareness — nearby players react to ball proximity
        let ballAttrX = 0, ballAttrZ = 0;
        if (this.ball) {
          const bdx = this.ball.position.x - pl.mesh.position.x;
          const bdz = this.ball.position.z - pl.mesh.position.z;
          const bdist = Math.hypot(bdx, bdz);
          if (bdist < 18 && bdist > 0.5) {
            const ballPull = pl.positionCode === "DEL" || pl.positionCode === "EXT" ? 0.22 :
                             pl.positionCode === "MED" ? 0.14 : 0.06;
            const normX = bdx / bdist, normZ = bdz / bdist;
            // Attackers attracted toward ball; defenders maintain marking oscillation
            if (pl.isHome === (liveMatch.homeTeamId === evTeam) || !evTeam) {
              ballAttrX = normX * ballPull * (18 - bdist) * 0.18;
              ballAttrZ = normZ * ballPull * (18 - bdist) * 0.18;
            } else {
              // Marking oscillation: hover around ball proximity
              const markRng = mulberry32(hashSeed(id + ":mark:" + Math.floor(minute / 2)));
              const oscAngle = markRng() * Math.PI * 2;
              ballAttrX = Math.cos(oscAngle) * 1.8;
              ballAttrZ = Math.sin(oscAngle) * 1.8;
            }
          }
        }

        // Layer 5: fatigue at 60'+ & 75'+
        const fatRng = mulberry32(hashSeed(id + ":fat:" + Math.floor(minute / 4)));
        let fatX = 0, fatZ = 0;
        if (minute > 60) {
          const f = clamp((minute - 60) / 30, 0, 1);
          fatX = (fatRng() - 0.5) * f * 2.2;
          fatZ = (fatRng() - 0.5) * f * 2.2;
        }

        // Phase 5 — chaos nudge (deterministic per minute slot)
        const chaos = this._getChaosNudge(id, minute, momentum);

        this.animatePlayerMove(id, {
          x: clamp(base.x + driftX + hasBallBias * 0.08 + fatX + ballAttrX + chaos.x, -FIELD_WIDTH / 2 + 5, FIELD_WIDTH / 2 - 5),
          y: 0,
          z: clamp(base.z + driftZ * 0.6 + sideSign * (hasBallBias * 0.16 + momBias * 0.12 + evLift + roleDepth) + fatZ + ballAttrZ + chaos.z, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2)
        }, 1400);
      });
    }

    addFlowPath(fromPos, toPos, color) {
      if (!fromPos || !toPos) return;
      color = color || "rgba(232,196,102,0.8)";
      this.flowPaths.push({ from: { x: fromPos.x, y: fromPos.y || 0, z: fromPos.z }, to: { x: toPos.x, y: toPos.y || 0, z: toPos.z }, color, ttl: 900 });
      this.flowPaths = this.flowPaths.slice(-8);
    }

    animatePlayerMove(playerId, targetPos, duration) {
      const pl = this.players[playerId];
      if (!pl) return;
      duration = duration || 1400;
      const blended = this._blendTarget(playerId, targetPos);
      const dist = Math.hypot(blended.x - (pl.mesh.position.x || 0), blended.z - (pl.mesh.position.z || 0));
      const rng = mulberry32(hashSeed(playerId + ":stag:" + this.matchState.minute));
      const stagger = (rng() * 90) - 25;
      const dur = Math.max(260, duration + stagger + Math.min(140, dist * 8));
      const inertia = dist > 10 ? 0.52 : 0.44;
      const blend = dist > 10 ? 0.52 : 0.62;
      pl.targetPosition.copy(blended);
      this.animationSystem.movePosition(pl.mesh.position, blended, dur, { inertia, blend });
    }

    _blendTarget(playerId, targetPos) {
      const pl = this.players[playerId];
      if (!pl || !targetPos) return targetPos;
      const minute = Number(this.matchState.minute) || 0;
      const rng = mulberry32(hashSeed(playerId + ":" + Math.floor(minute / 3) + ":" + (pl.positionCode || "")));
      const lane = (rng() * 9 - 4) * 0.18;
      const stride = (rng() * 7 - 3) * 0.16;
      const spPulse = Math.sin((minute * 0.19) + rng() * Math.PI * 2) * 0.22;
      const pres = pl.positionCode === "POR" ? 0.25 : pl.positionCode === "DEF" ? 0.65 : pl.positionCode === "MED" ? 0.9 : 1.15;
      return {
        x: clamp((+targetPos.x || 0) + (lane + spPulse) * pres, -FIELD_WIDTH / 2 + 5, FIELD_WIDTH / 2 - 5),
        y: +targetPos.y || 0,
        z: clamp((+targetPos.z || 0) + (stride - spPulse * 0.6) * pres, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2)
      };
    }

    animateBallMove(targetPos, duration) {
      if (!this.ball) this.createBall();
      duration = duration || 1000;
      // Sync render position to current physics position before new move starts
      // (prevents render position lagging from a stale previous position)
      if (this.ball.renderX === 0 && this.ball.renderZ === 0) {
        this.ball.renderX = this.ball.position.x;
        this.ball.renderZ = this.ball.position.z;
        this.ball.renderY = this.ball.position.y;
      }
      this.ball.targetPosition.copy(targetPos);
      const dist = Math.hypot(targetPos.x - this.ball.position.x, targetPos.z - this.ball.position.z);
      this.ball.spinRate = dist / Math.max(1, duration) * 200;
      if (duration < 500) this.ball.squash = 1.32;
      this.animationSystem.movePosition(this.ball.position, targetPos, duration, { easing: "quick", inertia: 0.18, blend: 0.82 });
    }

    animateShot(targetPos, duration) { this.animateBallMove(targetPos, duration || 400); }

    animatePass(fromPlayerId, toPlayerId) {
      const from = this.players[fromPlayerId];
      const to = this.players[toPlayerId];
      if (!from || !to) return;
      if (!this.ball) this.createBall();
      this.ball.position.copy(from.mesh.position);
      this.animateBallMove(to.mesh.position, 480);
    }

    startRendering() {
      if (this.isRunning) return;
      this.isRunning = true;
      let last = performance.now();
      const loop = (now) => {
        if (!this.isRunning) return;
        const dt = Math.min(64, now - last);
        last = now;
        this.updateAnimations(dt);
        this.render();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    }

    stopRendering() {
      this.isRunning = false;
      if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    }

    onWindowResize() {
      if (!this.container || !this.canvas) return;
      const w = Math.max(640, this.container.clientWidth || 960);
      const h = Math.max(400, this.container.clientHeight || Math.round(w * 0.565));
      this._resizeCanvas(w, h);
    }

    dispose() {
      this.stopRendering();
      if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null; this.context = null; this.renderer = null;
      this.players = {}; this.ball = null; this.flowPaths = [];
      this.tacticalOverlays = { supportLines: [], pressZones: [], shapeLines: { home: [], away: [] }, phase: null };
      this.presentation = null;
      this.animationSystem.clear();
      this.particles.clear();
      this.ballTrail = new BallTrail();
    }

    _eventScreenPosition(event) {
      if (event?.playerId && this.players[event.playerId]) {
        const pl = this.players[event.playerId];
        return this.pitchRenderer.toScreen({ x: pl.renderX || pl.mesh.position.x, z: pl.renderZ || pl.mesh.position.z }, this.bounds);
      }
      if (this.ball) {
        return this.pitchRenderer.toScreen({ x: this.ball.renderX, z: this.ball.renderZ }, this.bounds);
      }
      return { x: this.bounds.x + this.bounds.width / 2, y: this.bounds.y + this.bounds.height / 2 };
    }

    updateAnimations(deltaMs) {
      const dt = Math.max(0, Number(deltaMs) || this.config.targetFrameTime);
      this.animationSystem.update(dt);
      this.atmosphere?.update(this.bounds, dt);
      this.particles.update(dt);
      this.ballTrail.update(dt);
      this.cinematic.update(dt);
      this.camera.update(dt);

      // FIX 2: Ball render position — slow lerp toward physics position (0.08/frame)
      if (this.ball) {
        this.ball.spin = (this.ball.spin + this.ball.spinRate * dt * 0.01) % (Math.PI * 2);
        this.ball.spinRate *= 0.97;
        this.ball.squash = 1 + (this.ball.squash - 1) * 0.84;
        this.ball.bouncePhase = (this.ball.bouncePhase + dt * 0.0045) % (Math.PI * 2);

        // Smooth visual interpolation: ~25 frames to reach physics position
        const ballLerp = clamp(0.08 * (dt / 16), 0.02, 0.18);
        this.ball.renderX += (this.ball.position.x - this.ball.renderX) * ballLerp;
        this.ball.renderZ += (this.ball.position.z - this.ball.renderZ) * ballLerp;
        this.ball.renderY += (this.ball.position.y - this.ball.renderY) * ballLerp;

        // Trail uses render position (smooth)
        const bs = this.pitchRenderer.toScreen({ x: this.ball.renderX, z: this.ball.renderZ }, this.bounds);
        if (this._prevBallScr) {
          const spd = Math.hypot(bs.x - this._prevBallScr.x, bs.y - this._prevBallScr.y) / Math.max(1, dt);
          this.ball.lastSpeed = spd;
          if (spd > 0.4) this.ballTrail.push(bs.x, bs.y, spd * 55);
        }
        this._prevBallScr = bs;
        const lm = this._liveMatch;
        this.camera.trackBall(
          { x: this.ball.renderX, z: this.ball.renderZ },
          lm ? (Number(lm.momentum) || 50) : undefined,
          lm ? lm.humanAI : undefined
        );
      }

      // FIX 1: Player render positions — updated every frame with drift + restlessness
      const t = performance.now() * 0.001;
      Object.values(this.players).forEach(pl => {
        const nx = pl.mesh.position.x, nz = pl.mesh.position.z;
        const spd = Math.hypot(nx - pl.prevX, nz - pl.prevZ);
        pl.speed = spd;
        if (spd > 0.008) pl.facing = Math.atan2(nx - pl.prevX, -(nz - pl.prevZ));
        pl.prevX = nx; pl.prevZ = nz;

        const slotSize = 0.7 + (hashSeed(pl.id + ":jitter-period") % 8) / 10;
        const jitterSlot = Math.floor(t / slotSize);
        if (pl.jitterSlot !== jitterSlot) {
          const jr = mulberry32(hashSeed(pl.id + Math.floor(performance.now() / 900)));
          pl.jitterX = (jr() - 0.5) * 0.6;
          pl.jitterZ = (jr() - 0.5) * 0.6;
          pl.jitterSlot = jitterSlot;
        }

        const fatigueAmp = (this.matchState.minute || 0) > 60 ? 1.15 : 1;
        const driftX = Math.sin(t * pl.driftRX + pl.driftPhX) * pl.driftAX * fatigueAmp;
        const driftZ = Math.cos(t * pl.driftRZ + pl.driftPhZ) * pl.driftAZ * fatigueAmp;

        let forwardBiasX = 0;
        let forwardBiasZ = 0;
        if (pl.hasBall) {
          const travel = this.ball
            ? { x: this.ball.targetPosition.x - this.ball.position.x, z: this.ball.targetPosition.z - this.ball.position.z }
            : { x: Math.sin(pl.facing), z: -Math.cos(pl.facing) };
          const dist = Math.hypot(travel.x, travel.z) || 1;
          forwardBiasX = (travel.x / dist) * 1;
          forwardBiasZ = (travel.z / dist) * 1;
        }

        // Combine: physics position + continuous visual layers
        pl.renderX = clamp(nx + driftX + pl.jitterX + forwardBiasX, -FIELD_WIDTH / 2 + 2, FIELD_WIDTH / 2 - 2);
        pl.renderZ = clamp(nz + driftZ + pl.jitterZ + forwardBiasZ, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2);

        // Keep restlessness values for GK weight shift override
        pl._restX = pl.jitterX;
        pl._restY = pl.jitterZ;
      });

      this._updateBallCarrier();
      this._resolveRenderCollisions();

      // Phase 3 — collision resolution (soft nudge)
      this._resolveCollisions();

      // Phase 3 — goalkeeper behavior
      this._updateGKBehavior(dt);

      // Flow paths decay
      this.flowPaths.forEach(p => p.ttl -= dt);
      this.flowPaths = this.flowPaths.filter(p => p.ttl > 0);
      this._syncPositionState();
    }

    getAnimationSnapshot() {
      return {
        players: Object.fromEntries(Object.keys(this.players).map(id => [id, {
          x: this.players[id].mesh.position.x, y: this.players[id].mesh.position.y, z: this.players[id].mesh.position.z,
          target: { x: this.players[id].targetPosition.x, y: this.players[id].targetPosition.y, z: this.players[id].targetPosition.z }
        }])),
        ball: this.ball ? {
          x: this.ball.position.x, y: this.ball.position.y, z: this.ball.position.z,
          target: { x: this.ball.targetPosition.x, y: this.ball.targetPosition.y, z: this.ball.targetPosition.z }
        } : null,
        animations: this.animationSystem.snapshot()
      };
    }

    renderHUDOverlay() { this.render(); }

    // ----------------------------------------------------------
    // RENDER PIPELINE
    // ----------------------------------------------------------
    render() {
      if (!this.context || !this.canvas) return;
      const ctx = this.context;

      // FIX 3: Re-assert DPR transform every frame — guards against resize mid-frame reset
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = this._cssWidth || this.canvas.width / dpr;
      const H = this._cssHeight || this.canvas.height / dpr;
      this._computeBounds(this.canvas.width, this.canvas.height);

      // FIX 3: clearRect once, using CSS dimensions (after transform re-asserted)
      ctx.clearRect(0, 0, W, H);

      // 1. Stadium background
      this._drawBackground(ctx, W, H);
      this._drawStadiumSurroundings(ctx, W, H);

      // 2. Camera transform — apply to pitch, players, ball
      ctx.save();
      const camB = this.camera.transformBounds(this.bounds);
      const shk = this.camera.getShakeOffset();
      if (shk.x || shk.y) ctx.translate(shk.x, shk.y);

      this.pitchRenderer.draw(ctx, camB);
      this.crowd.draw(ctx, camB, clamp((this.presentation?.crowd || 65) / 100, 0.25, 1));
      this._drawFloodlightFalloff(ctx, camB);
      // Phase 6 — storytelling tint on pitch
      this._drawStorytellingOverlay(ctx, camB);
      this._drawTacticalZones(ctx, camB);
      this._drawTacticalIntelligence(ctx, camB);
      this._drawFlowPaths(ctx, camB);
      this._drawPlayers(ctx, camB);
      this._drawBall(ctx, camB);

      ctx.restore();

      // 3. Screen-space effects
      this.particles.draw(ctx);
      this.cinematic.drawFlash(ctx, W, H);
      this.cinematic.drawGoalOverlay(ctx, W, H);
      this.cinematic.drawEventOverlays(ctx, W, H);
      // Phase 7 — card / VAR overlays
      this.cinematic.drawCardOverlay(ctx, W, H);
      this.cinematic.drawVAROverlay(ctx, W, H);

      // 4. Broadcast HUD (top layer)
      this._drawBroadcastHUD(ctx, W, H);
      this._drawPresentationOverlay(ctx, W, H);
    }

    // ----------------------------------------------------------
    // DRAWING METHODS
    // ----------------------------------------------------------
    _drawBackground(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a1810");
      g.addColorStop(1, "#040b06");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    _drawStadiumSurroundings(ctx, W, H) {
      const b = this.bounds;
      // Floodlight radial bloom
      const rg = ctx.createRadialGradient(W / 2, b.y + b.height / 2, b.height * 0.12, W / 2, b.y + b.height / 2, W * 0.62);
      rg.addColorStop(0, "rgba(255,250,205,0.07)");
      rg.addColorStop(0.55, "rgba(255,250,205,0.025)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);

      // Ad boards
      this._drawAdBoards(ctx, b);

      // Weather tint
      if (this.presentation?.weather?.tint) {
        ctx.save(); ctx.globalAlpha = 0.055;
        ctx.fillStyle = this.presentation.weather.tint;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    _drawAdBoards(ctx, b) {
      const boards = ["#c62828","#1565c0","#f9a825","#2e7d32","#6a1b9a","#0277bd","#ad1457","#00838f"];
      const labels = ["BANCO CHILE","SCOTIABANK","ENTEL","JUMBO","MOVISTAR","LATAM","FALABELLA","CORONA"];
      const n = boards.length;
      const bW = b.width / n, bH = 7;
      const bY = b.y + b.height + 2;
      ctx.save();
      boards.forEach((col, i) => {
        ctx.globalAlpha = 0.58;
        ctx.fillStyle = col;
        ctx.fillRect(b.x + i * bW, bY, bW - 1, bH);
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 5px \"Segoe UI\", sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[i], b.x + i * bW + bW / 2, bY + bH / 2);
      });
      ctx.restore();
    }

    _drawFloodlightFalloff(ctx, bounds) {
      const g = ctx.createRadialGradient(
        bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.height * 0.18,
        bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width * 0.72
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.65, "rgba(0,0,0,0.03)");
      g.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = g;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    _drawTacticalZones(ctx, bounds) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 0.6;
      ctx.setLineDash([3, 9]);
      for (let i = 1; i < 3; i++) {
        const y = bounds.y + (bounds.height / 3) * i;
        ctx.beginPath(); ctx.moveTo(bounds.x, y); ctx.lineTo(bounds.x + bounds.width, y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    _drawTacticalIntelligence(ctx, bounds) {
      const ov = this.tacticalOverlays || {};
      const scale = bounds.width / FIELD_WIDTH;
      ctx.save();
      (ov.pressZones || []).forEach(z => {
        const c = this.pitchRenderer.toScreen(z.center, bounds);
        const r = Math.max(8, z.radius * scale);
        ctx.strokeStyle = z.side === "home" ? "rgba(232,196,102," + z.intensity + ")" : "rgba(93,167,232," + z.intensity + ")";
        ctx.fillStyle = z.side === "home" ? "rgba(232,196,102,0.05)" : "rgba(93,167,232,0.05)";
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      });
      ctx.setLineDash([]);
      ["home", "away"].forEach(side => {
        const line = ov.shapeLines?.[side] || [];
        if (line.length < 2) return;
        ctx.strokeStyle = side === "home" ? "rgba(246,247,238,0.16)" : "rgba(93,167,232,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        line.forEach((pt, i) => {
          const s = this.pitchRenderer.toScreen(pt, bounds);
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    _drawFlowPaths(ctx, bounds) {
      ctx.save();
      this.flowPaths.forEach(path => {
        const from = this.pitchRenderer.toScreen(path.from, bounds);
        const to = this.pitchRenderer.toScreen(path.to, bounds);
        const a = clamp(path.ttl / 900, 0, 1);
        ctx.strokeStyle = "rgba(232,196,102," + (0.14 + a * 0.48) + ")";
        ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.setLineDash([]);
        // Arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.fillStyle = "rgba(232,196,102," + (0.28 + a * 0.48) + ")";
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - 9 * Math.cos(angle - 0.38), to.y - 9 * Math.sin(angle - 0.38));
        ctx.lineTo(to.x - 9 * Math.cos(angle + 0.38), to.y - 9 * Math.sin(angle + 0.38));
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }

    _drawPlayers(ctx, bounds) {
      const minute = this.matchState.minute || 0;
      const baseR = 14;

      Object.values(this.players).forEach(pl => {
        // FIX 1: use renderX/renderZ — updated every frame with drift+rest baked in
        const raw = this.pitchRenderer.toScreen({ x: pl.renderX, z: pl.renderZ }, bounds);
        const sx = raw.x;
        const sy = raw.y;
        const isGK = pl.positionCode === "POR";
        const energy = clamp(pl.energy, 0, 100) / 100;
        const isSprint = pl.speed > 0.1;
        const fatigueA = minute > 75 ? 0.76 + energy * 0.24 : 1;
        const identity = pl.isHome ? this.teamIdentities.home : this.teamIdentities.away;
        const color = pl.isHome ? identity.primary : identity.secondary;
        const r = baseR;

        ctx.save();
        ctx.globalAlpha = fatigueA;
        ctx.translate(sx, sy);
        ctx.rotate(pl.facing);

        void isSprint;

        // Drop shadow
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        if (pl.hasBall) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "rgba(255,255,0," + (0.25 + pulse * 0.15) + ")";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r + 5 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // GK diamond marker
        if (isGK) {
          ctx.strokeStyle = "rgba(255,220,55,0.9)"; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -(r - 2)); ctx.lineTo(r - 2, 0); ctx.lineTo(0, r - 2); ctx.lineTo(-(r - 2), 0);
          ctx.closePath(); ctx.stroke();
        }

        ctx.shadowColor = "transparent";

        ctx.restore();

        // Label & energy bar (not rotated)
        ctx.save();
        ctx.translate(sx, sy);
        ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 3;
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 10px \"Segoe UI\", sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(pl.number).slice(-2), 0, 0.5);
        ctx.shadowColor = "transparent";

        const bW = r * 2.3;
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fillRect(-bW / 2, r + 3, bW, 2.5);
        ctx.fillStyle = energy > 0.6 ? "#5dca8a" : energy > 0.35 ? "#e8c466" : "#e26565";
        ctx.fillRect(-bW / 2, r + 3, bW * energy, 2.5);
        ctx.restore();
      });
    }

    _drawBall(ctx, bounds) {
      if (!this.ball) return;
      // FIX 2: draw using renderX/Z (slow lerp) not physics position (instant snap)
      const scr = this.pitchRenderer.toScreen({ x: this.ball.renderX, z: this.ball.renderZ }, bounds);
      const lift = clamp(Number(this.ball.renderY) || 0, 0, 4);
      const bounce = lift < 0.5 ? Math.abs(Math.sin(this.ball.bouncePhase)) * 1.8 : 0;
      const bX = scr.x;
      const bY = scr.y - lift * 5 - bounce;
      const r = 6;
      const sq = this.ball.squash || 1;

      // Trail
      this.ballTrail.draw(ctx);

      // Shadow
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(bX + 1.5, scr.y + 3.5, r * 0.92, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.translate(bX, bY);
      ctx.rotate(Math.atan2(this.ball.targetPosition.z - this.ball.position.z, this.ball.targetPosition.x - this.ball.position.x));
      ctx.scale(sq, 1 / sq);

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Five black arcs suggesting football panels.
      const sp = this.ball.spin || 0;
      ctx.strokeStyle = "rgba(0,0,0,0.78)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = sp + i * Math.PI * 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18, r * 0.58, a - 0.7, a + 0.7);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawBroadcastHUD(ctx, W, _H) {
      const barH = 54;

      // Bar background
      const bg = ctx.createLinearGradient(0, 0, 0, barH);
      bg.addColorStop(0, "rgba(8,18,12,0.98)");
      bg.addColorStop(1, "rgba(5,11,8,0.94)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, barH);

      // Divider
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fillRect(0, barH - 1, W, 1);

      // Club color accent strips
      ctx.globalAlpha = 0.68;
      ctx.fillStyle = this.teamColors.home;
      ctx.fillRect(0, 0, 4, barH);
      ctx.fillStyle = this.teamColors.away;
      ctx.fillRect(W - 4, 0, 4, barH);
      ctx.globalAlpha = 1;

      // Score
      ctx.fillStyle = "#f2f5ee";
      ctx.font = "900 30px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(this.matchState.homeGoals + "  -  " + this.matchState.awayGoals, W / 2, barH / 2 - 3);

      // Minute
      const min = this.matchState.minute;
      const minText = min >= 90 ? "FT" : min + "'";
      ctx.font = "600 12px \"Segoe UI\", Arial, sans-serif";
      ctx.fillStyle = min >= 80 ? "#e26565" : "rgba(235,240,230,0.68)";
      ctx.fillText(minText, W / 2, barH - 11);

      // Possession bar strip
      const posH = 3, posY = barH + 1;
      const homePct = clamp(this.matchState.possession, 0, 100) / 100;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = this.teamColors.home;
      ctx.fillRect(0, posY, W * homePct, posH);
      ctx.fillStyle = this.teamColors.away;
      ctx.fillRect(W * homePct, posY, W * (1 - homePct), posH);
      ctx.globalAlpha = 1;

      // Momentum dot
      const momX = clamp(this.matchState.momentum / 100, 0, 1) * W;
      ctx.fillStyle = "#f9a825";
      ctx.beginPath(); ctx.arc(momX, posY + posH / 2, 4, 0, Math.PI * 2); ctx.fill();

      // Possession label
      ctx.font = "500 9px \"Segoe UI\", Arial, sans-serif";
      ctx.fillStyle = "rgba(230,238,225,0.5)";
      ctx.textAlign = "left";
      ctx.fillText(Math.round(this.matchState.possession) + "% pos", 12, barH / 2 + 14);

      // Last event text
      if (this.matchState.lastEvent) {
        const txt = String(this.matchState.lastEvent.text || this.matchState.lastEvent.type || "").slice(0, 52);
        ctx.font = "500 9px \"Segoe UI\", Arial, sans-serif";
        ctx.fillStyle = "rgba(230,238,225,0.5)";
        ctx.textAlign = "right";
        ctx.fillText(txt, W - 12, barH / 2 + 14);
      }

      // Weather (top right micro label)
      if (this.presentation?.weather?.label) {
        ctx.font = "400 8px \"Segoe UI\", sans-serif";
        ctx.fillStyle = "rgba(230,238,225,0.34)";
        ctx.textAlign = "right";
        ctx.fillText(this.presentation.weather.label, W - 12, 11);
      }
    }

    _drawPresentationOverlay(ctx, W, _H) {
      const pres = this.presentation;
      if (!pres) return;
      const alpha = this.atmosphere?.transitionAlpha || 0;
      const show = alpha > 0.02 || pres.stage === "intro" || pres.stage === "halftime" || pres.stage === "fulltime";
      if (!show) return;
      const bA = Math.max(alpha, pres.stage === "intro" ? 0.72 : 0.3);
      ctx.save();
      ctx.globalAlpha = clamp(bA, 0, 0.88);
      ctx.fillStyle = "rgba(5,12,9,0.94)";
      ctx.fillRect(22, 72, Math.min(480, W - 44), 70);
      ctx.fillStyle = "rgba(232,184,74,0.88)";
      ctx.fillRect(22, 72, 4, 70);
      ctx.fillStyle = "#eff3ec";
      ctx.font = "800 18px \"Segoe UI\", Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(pres.headline || "").slice(0, 42), 38, 101);
      ctx.font = "500 11px \"Segoe UI\", Arial, sans-serif";
      ctx.fillStyle = "rgba(238,242,236,0.66)";
      ctx.fillText(String(pres.strapline || "").slice(0, 68), 38, 122);
      ctx.restore();
    }

    // ----------------------------------------------------------
    // INTERNAL HELPERS
    // ----------------------------------------------------------
    _resizeCanvas(width, height) {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._cssWidth = width;
      this._cssHeight = height;
    }

    _computeBounds(width, height) {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssW = this._cssWidth || width / dpr;
      const cssH = this._cssHeight || height / dpr;
      const topHud = 62, margin = 24;
      const avW = cssW - margin * 2;
      const avH = cssH - topHud - margin;
      const pitchRatio = FIELD_WIDTH / FIELD_HEIGHT;
      let pW = avW, pH = pW / pitchRatio;
      if (pH > avH) { pH = avH; pW = pH * pitchRatio; }
      this.bounds = {
        x: (cssW - pW) / 2,
        y: topHud + (avH - pH) / 2,
        width: pW, height: pH
      };
    }

    _syncPositionState() {
      Object.keys(this.players).forEach(id => {
        const pl = this.players[id];
        this.matchState.playerPositions[id] = {
          x: pl.mesh.position.x, y: pl.mesh.position.y, z: pl.mesh.position.z, isHome: pl.isHome
        };
      });
    }

    _updateBallCarrier() {
      let best = null;
      let bestD = Infinity;
      Object.values(this.players).forEach(pl => {
        pl.hasBall = false;
        if (!this.ball) return;
        const d = Math.hypot(pl.mesh.position.x - this.ball.position.x, pl.mesh.position.z - this.ball.position.z);
        if (d < bestD) { bestD = d; best = pl; }
      });
      if (best && bestD < 4.2) best.hasBall = true;
    }

    _resolveRenderCollisions() {
      const ids = Object.keys(this.players);
      const minDist = Math.max(1.9, 18 / Math.max(1, this.bounds.width / FIELD_WIDTH));
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = this.players[ids[i]];
          const b = this.players[ids[j]];
          const dx = a.renderX - b.renderX;
          const dz = a.renderZ - b.renderZ;
          const dist = Math.hypot(dx, dz);
          if (dist >= minDist || dist <= 0.001) continue;
          const push = (minDist - dist) * 0.52;
          const nx = dx / dist;
          const nz = dz / dist;
          a.renderX = clamp(a.renderX + nx * push, -FIELD_WIDTH / 2 + 2, FIELD_WIDTH / 2 - 2);
          a.renderZ = clamp(a.renderZ + nz * push, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2);
          b.renderX = clamp(b.renderX - nx * push, -FIELD_WIDTH / 2 + 2, FIELD_WIDTH / 2 - 2);
          b.renderZ = clamp(b.renderZ - nz * push, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2);
        }
      }
    }

    // ================================================================
    // PHASE 3 — COLLISION RESOLUTION
    // ================================================================
    _resolveCollisions() {
      const ids = Object.keys(this.players);
      const minDist = 3.5; // metros de campo
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = this.players[ids[i]];
          const b = this.players[ids[j]];
          const dx = a.mesh.position.x - b.mesh.position.x;
          const dz = a.mesh.position.z - b.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < minDist && dist > 0.01) {
            const push = (minDist - dist) * 0.14;
            const nx = dx / dist, nz = dz / dist;
            a.mesh.position.x = clamp(a.mesh.position.x + nx * push, -FIELD_WIDTH / 2 + 2, FIELD_WIDTH / 2 - 2);
            a.mesh.position.z = clamp(a.mesh.position.z + nz * push, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2);
            b.mesh.position.x = clamp(b.mesh.position.x - nx * push, -FIELD_WIDTH / 2 + 2, FIELD_WIDTH / 2 - 2);
            b.mesh.position.z = clamp(b.mesh.position.z - nz * push, -FIELD_HEIGHT / 2 + 2, FIELD_HEIGHT / 2 - 2);
          }
        }
      }
    }

    // ================================================================
    // PHASE 3 — GOALKEEPER BEHAVIOR
    // ================================================================
    _updateGKBehavior(_dt) {
      const t = performance.now() * 0.001;
      const minute = this.matchState.minute || 0;
      Object.values(this.players).forEach(pl => {
        if (pl.positionCode !== "POR") return;
        const base = pl.basePosition;
        const isHome = pl.isHome;
        // GK stays on goal line + patrol range ±4m
        const ballFar = !this.ball || Math.abs(this.ball.position.z - base.z) > 18;
        const patrolX = ballFar ? Math.sin(t * 0.55 + (isHome ? 0 : Math.PI)) * 4 : 0;
        // Track ball: shift slightly toward ball x
        let ballTrackX = 0;
        if (this.ball) {
          const bdx = this.ball.position.x - pl.mesh.position.x;
          ballTrackX = clamp(bdx * (ballFar ? 0.12 : 0.32), -5, 5);
        }
        // Weight shift oscillation (alive feel)
        const weightShift = Math.sin(t * 1.2 + (isHome ? 1.4 : 2.8)) * 0.6;
        const targetX = clamp(base.x + patrolX + ballTrackX + weightShift, -3.66 * 2, 3.66 * 2);
        // GK z: stay close to goal line but step out on danger
        const danger = this.ball && Math.abs(this.ball.position.z - base.z) < 18;
        const stepOut = danger ? (isHome ? 2 : -2) : 0;
        const targetZ = clamp(base.z + stepOut, -FIELD_HEIGHT / 2 + 1, FIELD_HEIGHT / 2 - 1);
        // Urgency: move faster if ball is close
        const urgency = this.ball ? clamp(1 - Math.abs(this.ball.position.z - pl.mesh.position.z) / 25, 0, 1) : 0;
        const dur = 280 + (1 - urgency) * 400;
        pl.targetPosition.set(targetX, 0, targetZ);
        this.animationSystem.movePosition(pl.mesh.position, { x: targetX, y: 0, z: targetZ }, dur, { inertia: 0.38, blend: 0.58 });
        // Slight weight animation via restlessness override
        pl._restX = weightShift * 0.8;
        pl._restY = Math.cos(t * 1.8 + (isHome ? 0 : 1)) * 0.35;
        void minute;
      });
    }

    // ================================================================
    // PHASE 5 — CHAOS ENGINE (now reads liveMatch.humanAI for realism)
    // ================================================================
    _getChaosNudge(playerId, minute, momentum) {
      const slot = Math.floor(minute / 2);
      // Rebuild chaos table when minute slot changes
      if (slot !== this._chaosMinuteSlot) {
        this._chaosMinuteSlot = slot;
        this._chaosMod = {};
      }
      if (this._chaosMod[playerId]) return this._chaosMod[playerId];

      const rng = mulberry32(hashSeed(playerId + ":chaos:" + slot));
      const pl = this.players[playerId];
      if (!pl) { this._chaosMod[playerId] = { x: 0, z: 0 }; return this._chaosMod[playerId]; }

      // Read real humanAI values from liveMatch if available
      const liveMatch = this._liveMatch;
      const humanAI = liveMatch && liveMatch.humanAI;
      const sideKey = pl.isHome ? "home" : "away";
      const humanPosError = humanAI && humanAI.positionError ? clamp(Number(humanAI.positionError[sideKey]) || 0, 0, 4) : 0;
      const humanPanic = humanAI && humanAI.panic ? clamp(Number(humanAI.panic[sideKey]) || 0, 0, 80) / 80 : 0;
      const humanDesp = humanAI && humanAI.desperation ? clamp(Number(humanAI.desperation[sideKey]) || 0, 0, 1) : 0;

      const pressuref = clamp(Math.abs(momentum - 50) / 50, 0, 1); // 0 = balanced, 1 = one-sided
      // Amplify chaos by real positionError and panic (scales existing effects)
      const errorScale = 1 + humanPosError * 0.45 + humanPanic * 0.6;
      let cx = 0, cz = 0;

      // Defensive panic — defenders scramble. Now uses real panic value from humanAI
      if (pl.positionCode === "DEF" && (momentum < 35 && pl.isHome || momentum > 65 && !pl.isHome)) {
        const panicAmp = Math.max(pressuref, humanPanic);
        cx = (rng() - 0.5) * 4.5 * panicAmp * errorScale;
        cz = (rng() - 0.5) * 3.5 * panicAmp * errorScale;
      }
      // Desperation forward push — DEF and MED surge forward when team is desperate
      else if (humanDesp > 0.4 && (pl.positionCode === "DEF" || pl.positionCode === "MED")) {
        const dir = pl.isHome ? 1 : -1;
        cx = (rng() - 0.5) * 2.8 * humanDesp;
        cz = rng() * 5 * humanDesp * dir;
      }
      // Attacking overload — forwards cluster in box
      else if ((pl.positionCode === "DEL" || pl.positionCode === "EXT") && pressuref > 0.4) {
        cx = (rng() - 0.5) * 3 * pressuref;
        cz = rng() * 2 * pressuref * (pl.isHome ? 1 : -1);
      }
      // Second ball / scramble — midfielders rush
      else if (pl.positionCode === "MED" && rng() < 0.3) {
        cx = (rng() - 0.5) * 2.8;
        cz = (rng() - 0.5) * 2.2;
      }
      // Desperate tracking — late minute high-energy runs
      else if (minute > 80 && rng() < 0.25) {
        const dir = pl.isHome ? 1 : -1;
        cz = rng() * 4 * dir;
        cx = (rng() - 0.5) * 2;
      }

      this._chaosMod[playerId] = { x: cx, z: cz };
      return this._chaosMod[playerId];
    }

    // ================================================================
    // PHASE 6 — MATCH STORYTELLING
    // ================================================================
    _updateStoryState() {
      const minute = this.matchState.minute || 0;
      const momentum = this.matchState.momentum || 50;
      const possession = this.matchState.possession || 50;

      // Dominant side
      if (momentum > 62 && possession > 57) this._story.dominantSide = "home";
      else if (momentum < 38 && possession < 43) this._story.dominantSide = "away";
      else this._story.dominantSide = "neutral";

      // Final minutes intensity (80'+)
      this._story.intensity = minute >= 80 ? clamp((minute - 80) / 10, 0, 1) : 0;

      // Tint: warm for dominating home, cool for dominating away, red-hot for final mins
      if (this._story.intensity > 0.3) {
        this._story.tintColor = "rgba(180,60,20,1)";
        this._story.tintAlpha = this._story.intensity * 0.055;
      } else if (this._story.dominantSide === "home") {
        this._story.tintColor = "rgba(255,180,60,1)";
        this._story.tintAlpha = clamp((momentum - 62) / 38, 0, 1) * 0.04;
      } else if (this._story.dominantSide === "away") {
        this._story.tintColor = "rgba(60,130,220,1)";
        this._story.tintAlpha = clamp((38 - momentum) / 38, 0, 1) * 0.04;
      } else {
        this._story.tintAlpha = 0;
      }
    }

    _drawStorytellingOverlay(ctx, bounds) {
      if (this._story.tintAlpha <= 0.002) return;
      ctx.save();
      ctx.globalAlpha = this._story.tintAlpha;
      ctx.fillStyle = this._story.tintColor;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();

      // Final minutes — frantic edge pulse
      if (this._story.intensity > 0.1) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
        const edgeGrad = ctx.createRadialGradient(
          bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.height * 0.38,
          bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width * 0.72
        );
        edgeGrad.addColorStop(0, "rgba(0,0,0,0)");
        edgeGrad.addColorStop(1, "rgba(160,40,10," + (this._story.intensity * pulse * 0.12) + ")");
        ctx.save();
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.restore();
      }

      // Compact defensive shape — away team deeper line indicator when defending
      if (this._story.dominantSide === "home") {
        const defZ = bounds.y + bounds.height * 0.82;
        ctx.save();
        ctx.strokeStyle = "rgba(93,167,232,0.14)";
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(bounds.x, defZ);
        ctx.lineTo(bounds.x + bounds.width, defZ);
        ctx.stroke();
        ctx.restore();
      } else if (this._story.dominantSide === "away") {
        const defZ = bounds.y + bounds.height * 0.18;
        ctx.save();
        ctx.strokeStyle = "rgba(232,196,102,0.14)";
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(bounds.x, defZ);
        ctx.lineTo(bounds.x + bounds.width, defZ);
        ctx.stroke();
        ctx.restore();
      }
    }

  }

  // ------------------------------------------------------------------
  // EXPORTS  (keep original names for backward compat)
  // ------------------------------------------------------------------
  FMG.TacticalAnimationSystem = TacticalAnimationSystem;
  FMG.TacticalPitchRenderer = BroadcastPitchRenderer;
  FMG.MatchVisualizer = MatchVisualizer;
})();
