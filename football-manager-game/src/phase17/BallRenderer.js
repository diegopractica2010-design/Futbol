(function () {
  "use strict";

  // ============================================================
  // FASE 17 — BallRenderer
  // Balon con: rotacion visual, sombra dinamica, estela de tiro.
  // No conoce logica de juego. Solo recibe (ctx, ball, animTime).
  // ============================================================

  window.FMG.Phase17 = window.FMG.Phase17 || {};

  var C = null;

  // Historial de posiciones para estela
  var TRAIL_LEN = 6;

  function BallRenderer() {
    this._rotation = 0;
    this._trail    = []; // [{x,y,alpha}]
    this._height   = 0;  // altura simulada (0=suelo)
    this._heightV  = 0;  // velocidad vertical simulada
  }

  // Actualizar estado interno del balon
  BallRenderer.prototype.update = function (ball) {
    if (!C) C = window.FMG.Phase16.C;

    var speed = Math.hypot(ball.vx, ball.vy);

    // Rotacion visual proporcional a velocidad
    var rollDir = ball.vx >= 0 ? 1 : -1;
    this._rotation += (ball.spin || speed * 0.08) * rollDir;

    // Estela: guardar posicion si hay velocidad
    if (speed > 2) {
      this._trail.push({ x: ball.x, y: ball.y, alpha: 0.35 });
      if (this._trail.length > TRAIL_LEN) this._trail.shift();
    } else {
      // Desvanecer estela
      if (this._trail.length > 0) this._trail.shift();
    }

    if (ball.z !== undefined) {
      this._height = ball.z;
      this._heightV = ball.vz || 0;
      return;
    }

    // Altura simulada: fallback para balones antiguos sin z.
    if (speed > 6 && this._height < 1) {
      this._heightV = speed * 0.18;
    }
    this._height  += this._heightV;
    this._heightV -= 0.4; // gravedad
    if (this._height < 0) { this._height = 0; this._heightV = 0; }
  };

  BallRenderer.prototype.draw = function (ctx, ball) {
    if (!C) C = window.FMG.Phase16.C;

    var r = 6;
    var h = Math.min(this._height, 12); // altura maxima visual

    // Estela
    for (var i = 0; i < this._trail.length; i++) {
      var tr = this._trail[i];
      var trAlpha = 0.02 + (i / Math.max(1, this._trail.length - 1)) * 0.16;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + trAlpha + ")";
      ctx.fill();
    }

    // Sombra dinamica: se aleja y achica segun altura
    var shadowScale = Math.max(0.3, 1 - h / 20);
    var shadowAlpha = Math.max(0.05, 0.25 * shadowScale);
    ctx.save();
    ctx.translate(ball.x + 2, ball.y + r - 1);
    ctx.scale(1, 0.35 * shadowScale);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0," + shadowAlpha + ")";
    ctx.fill();
    ctx.restore();

    // Balon (desplazado hacia arriba segun altura)
    var drawY = ball.y - h;

    ctx.save();
    ctx.translate(ball.x, drawY);
    var speed = Math.hypot(ball.vx || 0, ball.vy || 0);
    var angle = speed > 0.1 ? Math.atan2(ball.vy, ball.vx) : 0;
    ctx.rotate(angle);
    if (speed > 7) ctx.scale(1.45, 0.78);
    ctx.rotate(this._rotation);

    // Cuerpo blanco
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // 5 arcos negros sugieren paneles.
    ctx.strokeStyle = "rgba(0,0,0,0.78)";
    ctx.lineWidth   = 0.8;
    for (var j = 0; j < 5; j++) {
      var a = (j / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18, r * 0.58, a - 0.7, a + 0.7);
      ctx.stroke();
    }

    ctx.restore();
  };

  window.FMG.Phase17.BallRenderer = BallRenderer;
})();
