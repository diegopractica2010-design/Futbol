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

  var C = null;

  var GRASS_DARK  = "#2a6b35";
  var GRASS_LIGHT = "#2f7a3d";
  var LINE_COLOR  = "rgba(255,255,255,0.92)";
  var LINE_GLOW   = "rgba(255,255,255,0.18)";

  function PitchRenderer() {
    this._baked = null;
  }

  PitchRenderer.prototype.init = function (fw, fh) {
    if (!C) C = window.FMG.Phase16.C;

    var baked = _makeCanvas(fw, fh);
    var ctx   = baked.getContext("2d");

    this._drawGrassStripes(ctx, fw, fh);
    this._drawGrassTexture(ctx, fw, fh);
    this._drawLightBake(ctx, fw, fh);
    this._drawFieldLines(ctx, fw, fh);

    this._baked = baked;
  };

  PitchRenderer.prototype._drawGrassStripes = function (ctx, fw, fh) {
    var stripeW = fw / 10;
    for (var i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? GRASS_DARK : GRASS_LIGHT;
      ctx.fillRect(i * stripeW, 0, stripeW, fh);
    }
  };

  PitchRenderer.prototype._drawGrassTexture = function (ctx, fw, fh) {
    // Ruido de valor: muestrear en grid 8x8 e interpolar
    var gridX = 24, gridY = 16;
    var cellW = fw / gridX, cellH = fh / gridY;
    var rng   = _seededRng(99);

    // Generar grid de valores
    var grid = [];
    for (var gy = 0; gy <= gridY; gy++) {
      grid[gy] = [];
      for (var gx = 0; gx <= gridX; gx++) {
        grid[gy][gx] = rng();
      }
    }

    // Dibujar rectangulos con alpha variable (simula hierba)
    for (var cy = 0; cy < gridY; cy++) {
      for (var cx = 0; cx < gridX; cx++) {
        var v = (grid[cy][cx] + grid[cy][cx+1] + grid[cy+1][cx] + grid[cy+1][cx+1]) / 4;
        var alpha = (v - 0.5) * 0.12; // muy sutil
        if (alpha > 0) {
          ctx.fillStyle   = "rgba(255,255,255," + alpha + ")";
        } else {
          ctx.fillStyle   = "rgba(0,0,0," + (-alpha) + ")";
        }
        ctx.fillRect(cx * cellW, cy * cellH, cellW + 1, cellH + 1);
      }
    }
  };

  PitchRenderer.prototype._drawLightBake = function (ctx, fw, fh) {
    // Normal map falso: gradiente radial desde las 4 esquinas (focos)
    // Simula iluminacion de estadio nocturno
    var corners = [[0,0],[fw,0],[0,fh],[fw,fh]];
    corners.forEach(function (pos) {
      var grd = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], fw * 0.75);
      grd.addColorStop(0,   "rgba(255,248,210,0.10)");
      grd.addColorStop(0.5, "rgba(255,248,210,0.04)");
      grd.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, fw, fh);
    });

    // Sombra central muy leve (centro del campo ligeramente mas oscuro)
    var center = ctx.createRadialGradient(fw/2, fh/2, 0, fw/2, fh/2, fw * 0.4);
    center.addColorStop(0,   "rgba(0,0,0,0.04)");
    center.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, fw, fh);
  };

  PitchRenderer.prototype._drawFieldLines = function (ctx, fw, fh) {
    var goalH  = C.GOAL_H;
    var goalT  = (fh - goalH) / 2;
    var areaH  = 120, areaW = 60;
    var smallH = 60,  smallW = 26;
    var penX   = 50;  // punto de penal desde linea de gol

    // Glow sutil bajo las lineas
    ctx.shadowColor = LINE_GLOW;
    ctx.shadowBlur  = 4;

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1.8;

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

    ctx.shadowBlur = 0;
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

  function _seededRng(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  window.FMG.Phase21.PitchRenderer = PitchRenderer;
})();
