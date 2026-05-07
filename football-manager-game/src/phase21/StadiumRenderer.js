(function () {
  "use strict";

  // ============================================================
  // FASE 21 — StadiumRenderer.js
  // Fondo del estadio: cielo nocturno, gradas, focos baked.
  // Se genera UNA VEZ en init() -> OffscreenCanvas.
  // Cada frame: ctx.drawImage(baked, 0, 0) — cero recalculo.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var C = null;

  // Margen del estadio alrededor de la cancha (px)
  var MARGIN = { top: 55, bottom: 55, left: 30, right: 30 };

  function StadiumRenderer() {
    this._baked = null; // OffscreenCanvas o canvas auxiliar
  }

  StadiumRenderer.prototype.init = function (totalW, totalH) {
    if (!C) C = window.FMG.Phase16.C;

    var baked = _makeCanvas(totalW, totalH);
    var ctx   = baked.getContext("2d");

    this._drawBackground(ctx, totalW, totalH);
    this._drawStands(ctx, totalW, totalH);
    this._drawFloodlights(ctx, totalW, totalH);
    this._drawRunningTrack(ctx, totalW, totalH);

    this._baked = baked;
  };

  StadiumRenderer.prototype.draw = function (ctx) {
    if (this._baked) ctx.drawImage(this._baked, 0, 0);
  };

  // ---- Capas internas ----

  StadiumRenderer.prototype._drawBackground = function (ctx, w, h) {
    // Cielo nocturno con gradiente
    var sky = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    sky.addColorStop(0,   "#050a14");
    sky.addColorStop(0.6, "#0a1628");
    sky.addColorStop(1,   "#0d1f3c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Estrellas (puntos aleatorios pero deterministicos)
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    var rng = _seededRng(42);
    for (var i = 0; i < 60; i++) {
      var sx = rng() * w;
      var sy = rng() * h * 0.28;
      var sr = rng() * 1.2 + 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  StadiumRenderer.prototype._drawStands = function (ctx, w, h) {
    var rng = _seededRng(7);

    // Gradiente de gradas (perspectiva falsa: mas oscuro arriba)
    var standGrad = ctx.createLinearGradient(0, 0, 0, h * 0.38);
    standGrad.addColorStop(0,   "#1a1a2e");
    standGrad.addColorStop(0.5, "#16213e");
    standGrad.addColorStop(1,   "#0f3460");
    ctx.fillStyle = standGrad;
    ctx.fillRect(0, 0, w, h * 0.38);
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    // Filas de asientos (lineas horizontales con variacion de color)
    var rowColors = ["#c0392b","#2980b9","#f39c12","#27ae60","#8e44ad","#e74c3c","#3498db"];
    var rowH = 4;

    // Gradas superiores
    for (var row = 0; row < 8; row++) {
      var ry = row * (rowH + 2) + 8;
      ctx.fillStyle = rowColors[row % rowColors.length];
      ctx.globalAlpha = 0.18 + rng() * 0.12;
      ctx.fillRect(0, ry, w, rowH);
    }

    // Gradas inferiores
    for (var row2 = 0; row2 < 8; row2++) {
      var ry2 = h - (row2 * (rowH + 2) + 8 + rowH);
      ctx.fillStyle = rowColors[(row2 + 3) % rowColors.length];
      ctx.globalAlpha = 0.18 + rng() * 0.12;
      ctx.fillRect(0, ry2, w, rowH);
    }

    ctx.globalAlpha = 1;

    // Separador gradas/cancha (borde oscuro)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h * 0.35, w, 8);
    ctx.fillRect(0, h * 0.62, w, 8);
  };

  StadiumRenderer.prototype._drawFloodlights = function (ctx, w, h) {
    // 4 focos en las esquinas (luz baked como gradiente radial)
    var positions = [
      [0, 0], [w, 0], [0, h], [w, h]
    ];
    positions.forEach(function (pos) {
      var grd = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], w * 0.55);
      grd.addColorStop(0,    "rgba(255,248,220,0.12)");
      grd.addColorStop(0.4,  "rgba(255,248,220,0.05)");
      grd.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    });

    // Postes de luz (lineas finas en esquinas)
    ctx.strokeStyle = "rgba(200,200,180,0.35)";
    ctx.lineWidth   = 2;
    [[8, 0, 8, h * 0.32], [w - 8, 0, w - 8, h * 0.32],
     [8, h, 8, h * 0.68], [w - 8, h, w - 8, h * 0.68]].forEach(function (l) {
      ctx.beginPath();
      ctx.moveTo(l[0], l[1]);
      ctx.lineTo(l[2], l[3]);
      ctx.stroke();
    });
  };

  StadiumRenderer.prototype._drawRunningTrack = function (ctx, w, h) {
    // Pista atletica alrededor de la cancha (banda rojiza)
    var mx = MARGIN.left, my = MARGIN.top;
    var fw = w - mx - MARGIN.right;
    var fh = h - my - MARGIN.bottom;
    var trackW = 14;

    ctx.fillStyle = "rgba(160,60,30,0.55)";
    // Superior
    ctx.fillRect(mx - trackW, my - trackW, fw + trackW * 2, trackW);
    // Inferior
    ctx.fillRect(mx - trackW, my + fh, fw + trackW * 2, trackW);
    // Izquierda
    ctx.fillRect(mx - trackW, my, trackW, fh);
    // Derecha
    ctx.fillRect(mx + fw, my, trackW, fh);
  };

  // ---- Helpers ----

  function _makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(w, h);
    }
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // RNG determinista simple (evita Math.random para resultados consistentes)
  function _seededRng(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  StadiumRenderer.MARGIN = MARGIN;
  window.FMG.Phase21.StadiumRenderer = StadiumRenderer;
})();
