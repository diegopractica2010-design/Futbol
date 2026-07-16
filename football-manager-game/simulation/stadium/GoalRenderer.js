(function () {
  "use strict";

  // ============================================================
  // FASE 21 — GoalRenderer.js
  // Arcos con perspectiva falsa + redes con lineas diagonales.
  // Tecnica: trapezoide para simular profundidad 3D.
  // Baked en init(). Costo por frame: 1 drawImage.
  // ============================================================

  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var C = null;

  var POST_COLOR  = "#f0f0f0";
  var NET_COLOR   = "rgba(220,220,220,0.35)";
  var NET_SHADOW  = "rgba(0,0,0,0.18)";
  var DEPTH       = 14; // profundidad del arco en px

  function GoalRenderer() {
    this._baked = null;
  }

  GoalRenderer.prototype.init = function (totalW, totalH, fieldOffsetX, fieldOffsetY, fieldW, fieldH) {
    if (!C) C = window.FMG.Phase16.C;

    var baked = _makeCanvas(totalW, totalH);
    var ctx   = baked.getContext("2d");

    var goalT = fieldOffsetY + (fieldH - C.GOAL_H) / 2;
    var goalB = goalT + C.GOAL_H;

    // Arco izquierdo (fuera del campo, a la izquierda)
    this._drawGoal(ctx, fieldOffsetX, goalT, goalB, "left");

    // Arco derecho
    this._drawGoal(ctx, fieldOffsetX + fieldW, goalT, goalB, "right");

    this._baked = baked;
  };

  GoalRenderer.prototype._drawGoal = function (ctx, lineX, goalT, goalB, side) {
    var goalW  = C.GOAL_W + 2;
    var depth  = DEPTH;
    var goalH  = goalB - goalT;

    // Direccion de profundidad
    var dir    = side === "left" ? -1 : 1;
    var backX  = lineX + dir * goalW;

    // ---- Sombra del arco ----
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(lineX,         goalT + 4);
    ctx.lineTo(backX,         goalT + depth + 4);
    ctx.lineTo(backX,         goalB + depth + 4);
    ctx.lineTo(lineX,         goalB + 4);
    ctx.closePath();
    ctx.fill();

    // ---- Red (fondo del arco) ----
    // Cara trasera
    ctx.fillStyle = "rgba(30,30,30,0.55)";
    ctx.fillRect(
      Math.min(lineX, backX), goalT + depth,
      goalW, goalH
    );

    // Lineas de red diagonales
    ctx.strokeStyle = NET_COLOR;
    ctx.lineWidth   = 0.8;
    var netX0 = Math.min(lineX, backX);
    var netX1 = Math.max(lineX, backX);
    var netStep = 8;

    ctx.save();
    ctx.beginPath();
    ctx.rect(netX0, goalT, goalW, goalH + depth);
    ctx.clip();

    // Diagonales /
    for (var d = -goalH; d < goalW + goalH; d += netStep) {
      ctx.beginPath();
      ctx.moveTo(netX0 + d,          goalT);
      ctx.lineTo(netX0 + d + goalH,  goalT + goalH + depth);
      ctx.stroke();
    }
    // Diagonales \
    for (var d2 = 0; d2 < goalW + goalH * 2; d2 += netStep) {
      ctx.beginPath();
      ctx.moveTo(netX0 + d2,         goalT + goalH + depth);
      ctx.lineTo(netX0 + d2 - goalH, goalT);
      ctx.stroke();
    }
    ctx.restore();

    // ---- Postes (lineas blancas gruesas) ----
    ctx.strokeStyle = POST_COLOR;
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = "round";

    // Poste vertical delantero izquierdo
    ctx.beginPath();
    ctx.moveTo(lineX, goalT);
    ctx.lineTo(lineX, goalB);
    ctx.stroke();

    // Larguero (horizontal superior)
    ctx.beginPath();
    ctx.moveTo(lineX, goalT);
    ctx.lineTo(backX, goalT + depth);
    ctx.stroke();

    // Larguero inferior (base)
    ctx.beginPath();
    ctx.moveTo(lineX, goalB);
    ctx.lineTo(backX, goalB + depth);
    ctx.stroke();

    // Poste trasero
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(backX, goalT + depth);
    ctx.lineTo(backX, goalB + depth);
    ctx.stroke();

    // Brillo en el poste delantero
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(lineX + (side === "left" ? 1 : -1), goalT);
    ctx.lineTo(lineX + (side === "left" ? 1 : -1), goalB);
    ctx.stroke();

    ctx.lineCap = "butt";
  };

  GoalRenderer.prototype.draw = function (ctx) {
    if (this._baked) ctx.drawImage(this._baked, 0, 0);
  };

  function _makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  window.FMG.Phase21.GoalRenderer = GoalRenderer;
})();
