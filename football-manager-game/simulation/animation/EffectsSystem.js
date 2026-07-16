(function () {
  "use strict";

  // ============================================================
  // FASE 17 — EffectsSystem
  // Particulas: polvo al correr, destello de gol, impacto de tiro.
  // Pool fijo de particulas — cero allocations en runtime.
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var POOL_SIZE = 80;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase17-effects") : 0.5; }

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
    this._goalText = 0;
    this._shot = null;
    this._foul = null;
    this._offside = null;
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
      var angle = rng() * Math.PI * 2;
      var mag   = rng() * 0.6 + 0.2;
      this._spawn(
        x + (rng() - 0.5) * 6,
        y + 8 + rng() * 3,
        Math.cos(angle) * mag,
        Math.sin(angle) * mag - 0.3,
        12 + rng() * 8,
        1.5 + rng() * 1.5,
        "rgba(180,160,120,0.5)",
        "dust"
      );
    }
  };

  // Chispas al impactar el balon (pase/tiro)
  EffectsSystem.prototype.spawnKickSparks = function (x, y, power) {
    var count = Math.round(power * 0.8);
    for (var i = 0; i < count; i++) {
      var angle = rng() * Math.PI * 2;
      var mag   = rng() * power * 0.25 + 0.5;
      this._spawn(
        x, y,
        Math.cos(angle) * mag,
        Math.sin(angle) * mag,
        8 + rng() * 6,
        1 + rng() * 1.5,
        "rgba(255,220,80,0.8)",
        "spark"
      );
    }
  };

  // Ring de gol (onda expansiva)
  EffectsSystem.prototype.triggerGoalRing = function (x, y) {
    this._ringFlash = 40;
    this._goalText = 120;
    this._ringX     = x;
    this._ringY     = y;
    this._ringR     = 0;
    // Chispas adicionales
    for (var i = 0; i < 30; i++) {
      var angle = (i / 30) * Math.PI * 2;
      this._spawn(
        x, y,
        Math.cos(angle) * (3 + rng() * 3),
        Math.sin(angle) * (3 + rng() * 3),
        25 + rng() * 15,
        2 + rng() * 2,
        "rgba(255,220,50,0.9)",
        "spark"
      );
    }
  };

  EffectsSystem.prototype.triggerShotRipple = function (x, y) {
    this._shot = { x: x, y: y, life: 30, maxLife: 30 };
  };

  EffectsSystem.prototype.triggerFoulFlash = function (x, y) {
    this._foul = { x: x, y: y, life: 48, maxLife: 48 };
  };

  EffectsSystem.prototype.triggerOffside = function (y) {
    this._offside = { y: y, life: 90, maxLife: 90 };
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
    if (this._goalText > 0) this._goalText--;
    if (this._shot && --this._shot.life <= 0) this._shot = null;
    if (this._foul && --this._foul.life <= 0) this._foul = null;
    if (this._offside && --this._offside.life <= 0) this._offside = null;
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

    if (this._goalText > 0) {
      var goalT = this._goalText / 120;
      var goalScale = goalT > 0.85 ? 0.5 + ((1 - goalT) / 0.15) * 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = goalT < 0.2 ? goalT / 0.2 : 1;
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.scale(goalScale, goalScale);
      ctx.fillStyle = "#f9a825";
      ctx.font = "900 54px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚽ GOL!", 0, 0);
      ctx.restore();
    }

    if (this._shot) {
      var shotP = 1 - this._shot.life / this._shot.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - shotP;
      ctx.strokeStyle = "rgba(220,35,35,0.86)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this._shot.x, this._shot.y, shotP * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this._foul) {
      var foulP = 1 - this._foul.life / this._foul.maxLife;
      var r = 12 + foulP * 18;
      ctx.save();
      ctx.globalAlpha = 1 - foulP;
      ctx.fillStyle = "rgba(255,210,40,0.35)";
      ctx.strokeStyle = "rgba(255,225,70,0.9)";
      ctx.beginPath();
      for (var h = 0; h < 6; h++) {
        var a = Math.PI / 6 + h * Math.PI / 3;
        var hx = this._foul.x + Math.cos(a) * r;
        var hy = this._foul.y + Math.sin(a) * r;
        if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this._offside) {
      var offA = this._offside.life / this._offside.maxLife;
      ctx.save();
      ctx.globalAlpha = offA;
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(0, this._offside.y);
      ctx.lineTo(ctx.canvas.width, this._offside.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f2f5ee";
      ctx.font = "900 24px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FUERA DE JUEGO", ctx.canvas.width / 2, this._offside.y - 8);
      ctx.restore();
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
