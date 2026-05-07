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

    var r = C.BALL_R;
    var h = Math.min(this._height, 12); // altura maxima visual

    // Estela
    for (var i = 0; i < this._trail.length; i++) {
      var tr = this._trail[i];
      var trAlpha = tr.alpha * (i / this._trail.length);
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, r * 0.6 * (i / this._trail.length), 0, Math.PI * 2);
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
    ctx.rotate(this._rotation);

    // Cuerpo blanco
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f5f0";
    ctx.fill();

    // Pentagono central (simula costura)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "#222222";
    ctx.fill();

    // 5 hexagonos alrededor (simplificados como lineas radiales)
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth   = 0.8;
    for (var j = 0; j < 5; j++) {
      var a = (j / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
      ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      ctx.stroke();
    }

    // Brillo
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    ctx.restore();
  };

  window.FMG.Phase17.BallRenderer = BallRenderer;
})();
