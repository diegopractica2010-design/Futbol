(function () {
  "use strict";

  // ============================================================
  // FASE 21 — CrowdRenderer.js
  // Publico impostor: rectangulos de colores en gradas.
  // Base baked en init(). Banderas animadas (unica parte dinamica).
  // Costo por frame: ~8 drawImage + N lineas de bandera.
  // ============================================================

  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var C = null;

  // Colores de camisetas del publico
  var CROWD_COLORS = [
    "#c0392b","#e74c3c","#2980b9","#3498db","#f39c12",
    "#f1c40f","#27ae60","#2ecc71","#8e44ad","#ffffff",
    "#1a1a2e","#e8e8e8","#ff6b35","#004e89"
  ];

  // Banderas: posicion relativa [rx, ry] en el canvas total
  var FLAG_POSITIONS = [
    [0.08, 0.06], [0.22, 0.04], [0.38, 0.07], [0.55, 0.05],
    [0.70, 0.06], [0.85, 0.04], [0.12, 0.94], [0.30, 0.96],
    [0.50, 0.93], [0.68, 0.95], [0.82, 0.94]
  ];

  function CrowdRenderer() {
    this._baked    = null;
    this._flags    = [];
    this._animTime = 0;
  }

  CrowdRenderer.prototype.init = function (totalW, totalH) {
    if (!C) C = window.FMG.Phase16.C;

    var baked = _makeCanvas(totalW, totalH);
    var ctx   = baked.getContext("2d");
    var rng   = _seededRng(13);

    this._drawCrowdRows(ctx, totalW, totalH, rng);
    this._baked = baked;

    // Preparar datos de banderas
    this._flags = FLAG_POSITIONS.map(function (pos, i) {
      return {
        x:     pos[0] * totalW,
        y:     pos[1] * totalH,
        color: CROWD_COLORS[i % CROWD_COLORS.length],
        phase: i * 0.7,
        len:   14 + (i % 3) * 4
      };
    });
  };

  CrowdRenderer.prototype._drawCrowdRows = function (ctx, w, h, rng) {
    var personW = 5, personH = 7;
    var rowH    = personH + 3;

    // Gradas superiores (filas 0-6)
    for (var row = 0; row < 7; row++) {
      var y = row * rowH + 6;
      for (var col = 0; col < Math.floor(w / (personW + 2)); col++) {
        var x = col * (personW + 2) + (row % 2) * 3;
        var color = CROWD_COLORS[Math.floor(rng() * CROWD_COLORS.length)];
        var bright = 0.4 + rng() * 0.4;
        ctx.globalAlpha = bright;
        ctx.fillStyle   = color;
        ctx.fillRect(x, y, personW, personH);
        // Cabeza (circulo pequeño)
        ctx.beginPath();
        ctx.arc(x + personW / 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#f5c89a";
        ctx.fill();
      }
    }

    // Gradas inferiores
    for (var row3 = 0; row3 < 7; row3++) {
      var y3 = h - (row3 * rowH + 6 + personH);
      for (var col3 = 0; col3 < Math.floor(w / (personW + 2)); col3++) {
        var x3 = col3 * (personW + 2) + (row3 % 2) * 3;
        var color3 = CROWD_COLORS[Math.floor(rng() * CROWD_COLORS.length)];
        var bright3 = 0.4 + rng() * 0.4;
        ctx.globalAlpha = bright3;
        ctx.fillStyle   = color3;
        ctx.fillRect(x3, y3, personW, personH);
        ctx.beginPath();
        ctx.arc(x3 + personW / 2, y3 - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#f5c89a";
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  };

  // Dibujar base baked + banderas animadas
  CrowdRenderer.prototype.draw = function (ctx, tick) {
    if (this._baked) ctx.drawImage(this._baked, 0, 0);

    // Banderas: unica parte animada (muy barata)
    this._animTime = tick * 0.04;
    var t = this._animTime;

    this._flags.forEach(function (flag) {
      var wave = Math.sin(t + flag.phase) * 4;
      var poleH = 18;

      // Palo
      ctx.strokeStyle = "rgba(200,200,180,0.7)";
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(flag.x, flag.y);
      ctx.lineTo(flag.x, flag.y - poleH);
      ctx.stroke();

      // Tela de la bandera (bezier para efecto de ondeo)
      ctx.fillStyle   = flag.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(flag.x, flag.y - poleH);
      ctx.bezierCurveTo(
        flag.x + flag.len * 0.4, flag.y - poleH + wave,
        flag.x + flag.len * 0.7, flag.y - poleH + wave * 0.5,
        flag.x + flag.len,       flag.y - poleH + wave * 0.3
      );
      ctx.lineTo(flag.x + flag.len, flag.y - poleH + 7 + wave * 0.3);
      ctx.bezierCurveTo(
        flag.x + flag.len * 0.7, flag.y - poleH + 7 + wave * 0.5,
        flag.x + flag.len * 0.4, flag.y - poleH + 7 + wave,
        flag.x,                  flag.y - poleH + 7
      );
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
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

  window.FMG.Phase21.CrowdRenderer = CrowdRenderer;
})();
