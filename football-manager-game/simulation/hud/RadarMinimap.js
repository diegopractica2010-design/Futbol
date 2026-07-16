(function () {
  "use strict";

  // ============================================================
  // FASE 22 — RadarMinimap.js
  // Minimapa cenital: posiciones de jugadores + balon.
  // Esquina inferior derecha del canvas.
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var C = null;

  var MAP_W  = 110;
  var MAP_H  = 72;
  var MAP_PAD = 8;  // padding desde el borde del canvas

  function RadarMinimap() {}

  RadarMinimap.prototype.draw = function (ctx, snap, canvasW, canvasH) {
    if (!C) C = window.FMG.Phase16.C;

    var x = canvasW - MAP_W - MAP_PAD;
    var y = canvasH - MAP_H - MAP_PAD - 22; // sobre la barra de controles

    // Fondo
    ctx.fillStyle = "rgba(8,12,20,0.82)";
    _rr(ctx, x, y, MAP_W, MAP_H, 5);
    ctx.fill();

    // Borde
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth   = 1;
    _rr(ctx, x, y, MAP_W, MAP_H, 5);
    ctx.stroke();

    // Cancha (rectangulo verde)
    var fx = x + 6, fy = y + 6;
    var fw = MAP_W - 12, fh = MAP_H - 12;
    ctx.fillStyle = "#1e5c28";
    ctx.fillRect(fx, fy, fw, fh);

    // Linea media
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(fx + fw / 2, fy);
    ctx.lineTo(fx + fw / 2, fy + fh);
    ctx.stroke();

    // Circulo central
    ctx.beginPath();
    ctx.arc(fx + fw / 2, fy + fh / 2, fh * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Arcos (lineas en extremos)
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(fx, fy + fh * 0.25, fw * 0.1, fh * 0.5);
    ctx.strokeRect(fx + fw * 0.9, fy + fh * 0.25, fw * 0.1, fh * 0.5);

    // Funcion de conversion coordenadas mundo -> minimapa
    var toMap = function (wx, wy) {
      return {
        x: fx + (wx / C.FIELD_W) * fw,
        y: fy + (wy / C.FIELD_H) * fh
      };
    };

    // Jugadores equipo usuario (azul)
    snap.userTeam.forEach(function (p) {
      var mp = toMap(p.x, p.y);
      ctx.fillStyle = p === snap.controlled ? "#f0c040" : "#4a9eff";
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, p === snap.controlled ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Jugadores equipo IA (rojo)
    snap.aiTeam.forEach(function (p) {
      var mp = toMap(p.x, p.y);
      ctx.fillStyle = "#ff4a4a";
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Balon (blanco)
    var bp = toMap(snap.ballPos.x, snap.ballPos.y);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font      = "bold 8px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RADAR", x + MAP_W / 2, y + MAP_H - 2);
  };

  function _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  window.FMG.Phase22.RadarMinimap = RadarMinimap;
})();
