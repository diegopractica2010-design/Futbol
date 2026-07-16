(function () {
  "use strict";

  // ============================================================
  // FASE 22 — LowerThird.js
  // Lower thirds tipo TV con animacion de entrada/salida.
  // Aparecen en la parte inferior para eventos del partido.
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var LT_W    = 320;
  var LT_H    = 36;
  var LT_PAD  = 8;
  var ANIM_IN = 20;  // ticks de entrada
  var ANIM_OUT = 20; // ticks de salida

  function LowerThird() {}

  LowerThird.prototype.draw = function (ctx, snap, canvasW, canvasH) {
    if (!snap.lowerThirds || snap.lowerThirds.length === 0) return;

    snap.lowerThirds.forEach(function (lt, i) {
      var progress = lt.timer / lt.maxTimer;

      // Animacion: slide desde abajo al entrar, slide hacia abajo al salir
      var slideY = 0;
      if (lt.timer > lt.maxTimer - ANIM_IN) {
        // Entrando
        var t = 1 - (lt.timer - (lt.maxTimer - ANIM_IN)) / ANIM_IN;
        slideY = (1 - _easeOut(t)) * (LT_H + 10);
      } else if (lt.timer < ANIM_OUT) {
        // Saliendo
        slideY = (1 - lt.timer / ANIM_OUT) * (LT_H + 10);
      }

      var x = canvasW / 2 - LT_W / 2;
      var y = canvasH - LT_H - LT_PAD - 22 - i * (LT_H + 4) + slideY;

      // Fondo con franja de color
      ctx.fillStyle = "rgba(8,12,20,0.92)";
      _rr(ctx, x, y, LT_W, LT_H, 4);
      ctx.fill();

      // Franja de color izquierda
      ctx.fillStyle = lt.color || "#f0c040";
      _rr(ctx, x, y, 5, LT_H, [4, 0, 0, 4]);
      ctx.fill();

      // Texto principal
      ctx.fillStyle = "#ffffff";
      ctx.font      = "bold 13px 'Segoe UI',Arial,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(lt.text, x + 14, y + 15);

      // Subtexto
      if (lt.subtext) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font      = "10px 'Segoe UI',Arial,sans-serif";
        ctx.fillText(lt.subtext, x + 14, y + 28);
      }

      // Barra de progreso (tiempo restante)
      var barW = (LT_W - 14) * progress;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 5, y + LT_H - 3, LT_W - 5, 3);
      ctx.fillStyle = lt.color || "#f0c040";
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x + 5, y + LT_H - 3, barW, 3);
      ctx.globalAlpha = 1;
    });
  };

  function _easeOut(t) {
    return 1 - Math.pow(1 - t, 2);
  }

  function _rr(ctx, x, y, w, h, r) {
    if (typeof r === "number") r = [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + r[0], y); ctx.lineTo(x + w - r[1], y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    ctx.lineTo(x + w, y + h - r[2]);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    ctx.lineTo(x + r[3], y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    ctx.lineTo(x, y + r[0]);
    ctx.quadraticCurveTo(x, y, x + r[0], y);
    ctx.closePath();
  }

  window.FMG.Phase22.LowerThird = LowerThird;
})();
