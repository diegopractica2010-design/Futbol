(function () {
  "use strict";

  // ============================================================
  // FASE 21 — PitchRenderer.js
  // Cesped con textura procedural + normal map falso.
  // Tecnica:
  //   1. Franjas alternadas (verde oscuro/claro)
  //   2. Ruido de valor simplificado (textura de hierba)
  //   3. Gradiente de luz desde focos (normal map falso)
  //   4. Lineas de cancha con glow sutil
  // Todo baked en init(). Costo por frame: 1 drawImage.
  // ============================================================

  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var GRASS_DARK  = "#1e3d0f";
  var GRASS_LIGHT = "#244d13";
  var LINE_COLOR  = "rgba(255,255,255,0.75)";

  function PitchRenderer() {
    this._baked = null;
  }

  PitchRenderer.prototype.init = function (fw, fh) {
    var baked = _makeCanvas(fw, fh);
    var ctx   = baked.getContext("2d");

    this._drawGrassStripes(ctx, fw, fh);
    this._drawWornPatches(ctx, fw, fh);
    this._drawLightBake(ctx, fw, fh);
    this._drawFieldLines(ctx, fw, fh);
    this._drawCrowdBand(ctx, fw, fh);
    this._drawCornerVignette(ctx, fw, fh, 0, 0);
    this._drawCornerVignette(ctx, fw, fh, fw, 0);
    this._drawCornerVignette(ctx, fw, fh, 0, fh);
    this._drawCornerVignette(ctx, fw, fh, fw, fh);

    this._baked = baked;
  };

  PitchRenderer.prototype._drawGrassStripes = function (ctx, fw, fh) {
    var stripeW = fw / 10;
    for (var i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? GRASS_DARK : GRASS_LIGHT;
      ctx.fillRect(i * stripeW, 0, stripeW, fh);
    }
  };

  PitchRenderer.prototype._drawWornPatches = function (ctx, fw, fh) {
    ctx.fillStyle = "rgba(101,67,33,0.06)";
    ctx.fillRect(0, fh / 2 - 42, 70, 84);
    ctx.fillRect(fw - 70, fh / 2 - 42, 70, 84);
    ctx.beginPath();
    ctx.ellipse(44, fh / 2, 28, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fw - 44, fh / 2, 28, 52, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  PitchRenderer.prototype._drawLightBake = function (ctx, fw, fh) {
    var center = ctx.createRadialGradient(fw / 2, fh / 2, 0, fw / 2, fh / 2, fw * 0.72);
    center.addColorStop(0, "rgba(255,255,200,0.04)");
    center.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, fw, fh);
  };

  PitchRenderer.prototype._drawCrowdBand = function (ctx, fw, fh) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, fw, 18);
    ctx.fillRect(0, fh - 18, fw, 18);
    ctx.fillRect(0, 0, 18, fh);
    ctx.fillRect(fw - 18, 0, 18, fh);
  };

  PitchRenderer.prototype._drawCornerVignette = function (ctx, fw, fh, x, y) {
    var r = Math.max(fw, fh) * 0.48;
    var g = ctx.createRadialGradient(x, y, r * 0.14, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.24)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, fw, fh);
  };

  PitchRenderer.prototype._drawFieldLines = function (ctx, fw, fh) {
    var areaH  = 120, areaW = 60;
    var smallH = 60,  smallW = 26;
    var penX   = 50;  // punto de penal desde linea de gol

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1.2;

    // Borde exterior
    ctx.strokeRect(1, 1, fw - 2, fh - 2);

    // Linea media
    ctx.beginPath();
    ctx.moveTo(fw / 2, 0);
    ctx.lineTo(fw / 2, fh);
    ctx.stroke();

    // Circulo central
    ctx.beginPath();
    ctx.arc(fw / 2, fh / 2, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Punto central
    ctx.fillStyle = LINE_COLOR;
    ctx.beginPath();
    ctx.arc(fw / 2, fh / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Area grande izquierda
    ctx.strokeRect(0, (fh - areaH) / 2, areaW, areaH);
    // Area chica izquierda
    ctx.strokeRect(0, (fh - smallH) / 2, smallW, smallH);
    // Punto de penal izquierdo
    ctx.beginPath();
    ctx.arc(penX, fh / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Area grande derecha
    ctx.strokeRect(fw - areaW, (fh - areaH) / 2, areaW, areaH);
    // Area chica derecha
    ctx.strokeRect(fw - smallW, (fh - smallH) / 2, smallW, smallH);
    // Punto de penal derecho
    ctx.beginPath();
    ctx.arc(fw - penX, fh / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Arcos de area (semicirculos fuera del area grande)
    ctx.beginPath();
    ctx.arc(penX, fh / 2, 52, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fw - penX, fh / 2, 52, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();

    // Esquinas (cuartos de circulo)
    var cr = 8;
    [[0,0,0,Math.PI/2],[fw,0,Math.PI/2,Math.PI],[0,fh,-Math.PI/2,0],[fw,fh,Math.PI,-Math.PI/2]].forEach(function(q){
      ctx.beginPath();
      ctx.arc(q[0], q[1], cr, q[2], q[3]);
      ctx.stroke();
    });
  };

  PitchRenderer.prototype.draw = function (ctx, offsetX, offsetY) {
    if (this._baked) ctx.drawImage(this._baked, offsetX, offsetY);
  };

  function _makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  window.FMG.Phase21.PitchRenderer = PitchRenderer;
})();
