(function () {
  "use strict";

  // ============================================================
  // FASE 16 — BallSystem
  // Responsabilidad: fisica del balon, rebotes, colisiones, goles.
  // No conoce IA ni input.
  // ============================================================

  const C = window.FMG.Phase16.C;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase16-ball") : 0.5; }

  function BallSystem() {
    this.ball = this._make();
  }

  BallSystem.prototype._make = function () {
    return { x: C.FIELD_W / 2, y: C.FIELD_H / 2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, assist: null };
  };

  BallSystem.prototype.reset = function () {
    this.ball = this._make();
  };

  // Aplica impulso al balon (pase o tiro)
  BallSystem.prototype.applyImpulse = function (vx, vy, options) {
    options = options || {};
    const error = options.error || 0;
    if (error) {
      vx += (rng() - 0.5) * error;
      vy += (rng() - 0.5) * error;
    }
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = options.lift || 0;
    this.ball.spin = options.spin || Math.hypot(vx, vy) * 0.08;
    this.ball.assist = options.targetX !== undefined
      ? { x: options.targetX, y: options.targetY, strength: options.assist || 0.012, ticks: options.assistTicks || 34 }
      : null;
  };

  // Colision balon-jugador: empuja el balon si hay contacto
  BallSystem.prototype.resolvePlayerCollision = function (player) {
    const b = this.ball;
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const d  = Math.hypot(dx, dy);
    const minD = C.PLAYER_R + C.BALL_R;

    if (d < minD && d > 0 && b.z < 10) {
      const nx = dx / d;
      const ny = dy / d;
      b.x = player.x + nx * (minD + 1);
      b.y = player.y + ny * (minD + 1);
      // Solo empuja si el balon esta casi quieto (no sobreescribir tiros)
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 3) {
        b.vx = nx * 2;
        b.vy = ny * 2;
      }
    }
  };

  // Mueve el balon un tick. Devuelve: null | "goal-left" | "goal-right"
  BallSystem.prototype.tick = function () {
    const b = this.ball;
    if (b.assist && b.assist.ticks > 0) {
      const dx = b.assist.x - b.x;
      const dy = b.assist.y - b.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = b.vx * (1 - b.assist.strength) + (dx / len) * speed * b.assist.strength;
      b.vy = b.vy * (1 - b.assist.strength) + (dy / len) * speed * b.assist.strength;
      b.assist.ticks--;
      if (b.assist.ticks <= 0) b.assist = null;
    }

    b.x += b.vx;
    b.y += b.vy;
    b.z = Math.max(0, b.z + b.vz);
    if (b.z > 0 || b.vz > 0) b.vz -= 0.42;
    if (b.z === 0 && b.vz < 0) b.vz *= -0.28;
    b.vx *= C.BALL_FRICTION;
    b.vy *= C.BALL_FRICTION;
    b.spin *= C.BALL_FRICTION;

    // Rebote bordes superior/inferior
    if (b.y - C.BALL_R < 0)          { b.y = C.BALL_R;            b.vy *= -0.7; }
    if (b.y + C.BALL_R > C.FIELD_H)  { b.y = C.FIELD_H - C.BALL_R; b.vy *= -0.7; }

    const goalTop = (C.FIELD_H - C.GOAL_H) / 2;
    const goalBot = goalTop + C.GOAL_H;

    // Borde izquierdo
    if (b.x - C.BALL_R < 0) {
      if (b.y >= goalTop && b.y <= goalBot) return "goal-right";
      b.x = C.BALL_R; b.vx *= -0.7;
    }
    // Borde derecho
    if (b.x + C.BALL_R > C.FIELD_W) {
      if (b.y >= goalTop && b.y <= goalBot) return "goal-left";
      b.x = C.FIELD_W - C.BALL_R; b.vx *= -0.7;
    }

    return null;
  };

  // Devuelve si un jugador esta cerca del balon (para IA y control)
  BallSystem.prototype.distTo = function (entity) {
    return Math.hypot(this.ball.x - entity.x, this.ball.y - entity.y);
  };

  window.FMG.Phase16.BallSystem = BallSystem;
})();
