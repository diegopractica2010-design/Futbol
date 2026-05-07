(function () {
  "use strict";

  // ============================================================
  // FASE 17 — EffectsSystem
  // Particulas: polvo al correr, destello de gol, impacto de tiro.
  // Pool fijo de particulas — cero allocations en runtime.
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var POOL_SIZE = 80;

  function Particle() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.r = 2;
    this.color = "#ffffff";
    this.type = "dust"; // dust | spark | ring
  }

  function EffectsSystem() {
    this._pool = [];
    for (var i = 0; i < POOL_SIZE; i++) this._pool.push(new Particle());
    this._ringFlash = 0;   // frames de ring de gol
    this._ringX     = 0;
    this._ringY     = 0;
    this._ringR     = 0;
  }

  EffectsSystem.prototype._spawn = function (x, y, vx, vy, life, r, color, type) {
    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      if (!p.active) {
        p.active  = true;
        p.x = x; p.y = y;
        p.vx = vx; p.vy = vy;
        p.life = life; p.maxLife = life;
        p.r = r;
        p.color = color;
        p.type  = type || "dust";
        return;
      }
    }
    // Pool lleno: ignorar (no allocar)
  };

  // Polvo al correr/sprint
  EffectsSystem.prototype.spawnDust = function (x, y, speed) {
    if (speed < 1.5) return;
    var count = speed > 2.5 ? 2 : 1;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var mag   = Math.random() * 0.6 + 0.2;
      this._spawn(
        x + (Math.random() - 0.5) * 6,
        y + 8 + Math.random() * 3,
        Math.cos(angle) * mag,
        Math.sin(angle) * mag - 0.3,
        12 + Math.random() * 8,
        1.5 + Math.random() * 1.5,
        "rgba(180,160,120,0.5)",
        "dust"
      );
    }
  };

  // Chispas al impactar el balon (pase/tiro)
  EffectsSystem.prototype.spawnKickSparks = function (x, y, power) {
    var count = Math.round(power * 0.8);
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var mag   = Math.random() * power * 0.25 + 0.5;
      this._spawn(
        x, y,
        Math.cos(angle) * mag,
        Math.sin(angle) * mag,
        8 + Math.random() * 6,
        1 + Math.random() * 1.5,
        "rgba(255,220,80,0.8)",
        "spark"
      );
    }
  };

  // Ring de gol (onda expansiva)
  EffectsSystem.prototype.triggerGoalRing = function (x, y) {
    this._ringFlash = 40;
    this._ringX     = x;
    this._ringY     = y;
    this._ringR     = 0;
    // Chispas adicionales
    for (var i = 0; i < 16; i++) {
      var angle = (i / 16) * Math.PI * 2;
      this._spawn(
        x, y,
        Math.cos(angle) * (3 + Math.random() * 3),
        Math.sin(angle) * (3 + Math.random() * 3),
        25 + Math.random() * 15,
        2 + Math.random() * 2,
        "rgba(255,220,50,0.9)",
        "spark"
      );
    }
  };

  EffectsSystem.prototype.tick = function () {
    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      if (!p.active) continue;
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.05; // gravedad leve
      p.life--;
      if (p.life <= 0) p.active = false;
    }
    if (this._ringFlash > 0) {
      this._ringFlash--;
      this._ringR += 4;
    }
  };

  EffectsSystem.prototype.draw = function (ctx) {
    // Ring de gol
    if (this._ringFlash > 0) {
      var alpha = this._ringFlash / 40;
      ctx.beginPath();
      ctx.arc(this._ringX, this._ringY, this._ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,220,50," + alpha + ")";
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // Particulas
    for (var i = 0; i < this._pool.length; i++) {
      var p = this._pool[i];
      if (!p.active) continue;
      var lifeRatio = p.life / p.maxLife;
      ctx.globalAlpha = lifeRatio;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * lifeRatio, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  window.FMG.Phase17.EffectsSystem = EffectsSystem;
})();
