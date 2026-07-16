(function () {
  "use strict";

  // ============================================================
  // FASE 16 — AISystem
  // Responsabilidad: mover el equipo rival cada tick.
  // Lee: match.aiTeam, ball.ball
  // Escribe: posiciones de aiTeam, impulso al balon
  // No conoce: input, HUD, animaciones
  // ============================================================

  const C = window.FMG.Phase16.C;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase16-ai") : 0.5; }

  function AISystem() {}

  AISystem.prototype.tick = function (match, ball) {
    const b       = ball.ball;
    const goalX   = 0;
    const goalY   = C.FIELD_H / 2;

    match.aiTeam.forEach(function (p, i) {
      var tx, ty;
      var bd = ball.distTo(p);

      if (i === 0) {
        // Portero: sigue el balon verticalmente cerca del arco
        tx = C.FIELD_W - 40;
        ty = C.FIELD_H / 2 + (b.y - C.FIELD_H / 2) * 0.4;
      } else if (bd < 120) {
        // Jugador mas cercano: persigue el balon
        tx = b.x;
        ty = b.y;
      } else {
        // Posicion ofensiva escalonada
        tx = C.FIELD_W - 180 - (i % 3) * 80;
        ty = C.FIELD_H / 2 + (i % 2 === 0 ? -80 : 80);
      }

      var ddx = tx - p.x;
      var ddy = ty - p.y;
      var len = Math.hypot(ddx, ddy) || 1;
      match.movePlayer(p, ddx / len, ddy / len, C.AI_SPEED);

      // Tiro si esta muy cerca del balon
      if (bd < C.PLAYER_R + C.BALL_R + 4 && rng() < 0.04) {
        var sx = goalX - b.x;
        var sy = goalY - b.y;
        var sl = Math.hypot(sx, sy) || 1;
        ball.applyImpulse((sx / sl) * C.SHOOT_POWER * 0.85, (sy / sl) * C.SHOOT_POWER * 0.85);
      }
    });
  };

  window.FMG.Phase16.AISystem = AISystem;
})();
