(function () {
  "use strict";

  // ============================================================
  // FASE 20 — BroadcastHUD.js
  // Marcador televisivo estilo FIFA.
  // Dibuja SOBRE la transformacion de camara (coordenadas de pantalla).
  // No conoce logica de juego. Solo recibe datos y dibuja.
  // ============================================================

  window.FMG.Phase20 = window.FMG.Phase20 || {};

  var C = null;

  // Colores del marcador TV
  var TV = {
    bg:         "rgba(8,12,20,0.88)",
    bgAccent:   "rgba(20,108,67,0.92)",
    text:       "#ffffff",
    muted:      "rgba(255,255,255,0.65)",
    score:      "#f0c040",
    replayBg:   "rgba(0,0,0,0.72)",
    replayText: "#f0c040",
    modeBg:     "rgba(0,0,0,0.55)"
  };

  function BroadcastHUD() {}

  function _screenW(ctx) {
    return ctx && ctx.canvas ? ctx.canvas.width : (C ? C.FIELD_W : 780);
  }

  function _screenH(ctx) {
    return ctx && ctx.canvas ? ctx.canvas.height : (C ? C.FIELD_H : 520);
  }

  // Marcador principal (esquina superior izquierda, estilo TV)
  BroadcastHUD.prototype.drawScoreboard = function (ctx, match, cameraMode) {
    if (!C) C = window.FMG.Phase16.C;

    var secs = match.secondsLeft ? match.secondsLeft() : 0;
    var mm   = String(Math.floor(secs / 60)).padStart(2, "0");
    var ss   = String(secs % 60).padStart(2, "0");

    var x = 12, y = 10;
    var w = 220, h = 44;

    // Fondo del marcador
    ctx.fillStyle = TV.bg;
    _roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Franja de color izquierda (equipo usuario)
    ctx.fillStyle = "#1a6fc4";
    _roundRect(ctx, x, y, 8, h, [6, 0, 0, 6]);
    ctx.fill();

    // Franja de color derecha (equipo IA)
    ctx.fillStyle = "#c42b1a";
    _roundRect(ctx, x + w - 8, y, 8, h, [0, 6, 6, 0]);
    ctx.fill();

    // Nombres de equipos
    ctx.fillStyle = TV.text;
    ctx.font      = "bold 11px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("AZUL", x + 14, y + 16);
    ctx.textAlign = "right";
    ctx.fillText("ROJO", x + w - 14, y + 16);

    // Marcador central
    ctx.fillStyle = TV.score;
    ctx.font      = "bold 20px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(match.score[0] + " - " + match.score[1], x + w / 2, y + 28);

    // Tiempo (debajo del marcador)
    ctx.fillStyle = TV.bg;
    _roundRect(ctx, x + w / 2 - 28, y + h, 56, 18, [0, 0, 5, 5]);
    ctx.fill();
    ctx.fillStyle = TV.muted;
    ctx.font      = "bold 11px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mm + ":" + ss, x + w / 2, y + h + 13);

    // Indicador de modo de camara (esquina superior derecha)
    if (cameraMode && cameraMode !== "broadcast") {
      var modeLabel = { zoom: "ZOOM", shot: "TIRO", celebrate: "GOL", replay: "REPETICION" }[cameraMode] || cameraMode.toUpperCase();
      var sw = _screenW(ctx);
      ctx.fillStyle = TV.modeBg;
      _roundRect(ctx, sw - 110, y, 98, 24, 5);
      ctx.fill();
      ctx.fillStyle = TV.replayText;
      ctx.font      = "bold 11px 'Segoe UI',Arial,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("\u25B6 " + modeLabel, sw - 61, y + 16);
    }
  };

  // Overlay de replay (cinta negra superior + inferior + texto)
  BroadcastHUD.prototype.drawReplayOverlay = function (ctx, frameProgress) {
    if (!C) C = window.FMG.Phase16.C;

    var barH = 38;
    var sw = _screenW(ctx);
    var sh = _screenH(ctx);
    ctx.fillStyle = TV.replayBg;
    ctx.fillRect(0, 0, sw, barH);
    ctx.fillRect(0, sh - barH, sw, barH);

    // Texto REPETICION
    ctx.fillStyle = TV.replayText;
    ctx.font      = "bold 18px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("\u25C4\u25C4 REPETICION", 16, 25);

    // Velocidad
    ctx.fillStyle = TV.muted;
    ctx.font      = "11px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("0.3\u00D7", sw - 16, 25);

    // Barra de progreso del replay
    var barW = sw - 32;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    _roundRect(ctx, 16, sh - barH + 8, barW, 6, 3);
    ctx.fill();
    ctx.fillStyle = TV.replayText;
    _roundRect(ctx, 16, sh - barH + 8, barW * frameProgress, 6, 3);
    ctx.fill();
  };

  // Overlay de gol (texto grande centrado)
  BroadcastHUD.prototype.drawGoalOverlay = function (ctx, scoringTeam, score) {
    if (!C) C = window.FMG.Phase16.C;

    var teamName = scoringTeam === 0 ? "AZUL" : "ROJO";
    var teamColor = scoringTeam === 0 ? "#1a6fc4" : "#c42b1a";

    // Fondo semitransparente
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    var sw = _screenW(ctx);
    var sh = _screenH(ctx);
    ctx.fillRect(0, sh / 2 - 55, sw, 110);

    // GOL!
    ctx.fillStyle = TV.score;
    ctx.font      = "bold 64px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u00A1GOL!", sw / 2, sh / 2 + 8);

    // Nombre del equipo
    ctx.fillStyle = teamColor;
    ctx.font      = "bold 18px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(teamName, sw / 2, sh / 2 - 22);

    // Marcador actualizado
    ctx.fillStyle = TV.text;
    ctx.font      = "bold 22px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(score[0] + " - " + score[1], sw / 2, sh / 2 + 40);
  };

  // Overlay de fin de partido
  BroadcastHUD.prototype.drawFinalOverlay = function (ctx, match) {
    if (!C) C = window.FMG.Phase16.C;

    var sw = _screenW(ctx);
    var sh = _screenH(ctx);
    ctx.fillStyle = "rgba(8,12,20,0.82)";
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = TV.text;
    ctx.font      = "bold 14px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PARTIDO TERMINADO", sw / 2, sh / 2 - 50);

    ctx.font      = "bold 52px 'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = TV.score;
    ctx.fillText(match.score[0] + "  \u2014  " + match.score[1], sw / 2, sh / 2 + 10);

    ctx.font      = "bold 14px 'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = TV.muted;
    ctx.fillText("AZUL  vs  ROJO", sw / 2, sh / 2 - 20);

    ctx.font      = "13px 'Segoe UI',Arial,sans-serif";
    ctx.fillText("Presiona R para reiniciar", sw / 2, sh / 2 + 55);
  };

  // Barra de controles (parte inferior)
  BroadcastHUD.prototype.drawControls = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var sw = _screenW(ctx);
    var sh = _screenH(ctx);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, sh - 20, sw, 20);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font      = "10px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WASD/Flechas: Mover | Shift: Sprint | Q/E: Cambio | Z/J: Pase | Espacio/L: Largo | C: Entrada | X/K: Tiro | P: Pausa", sw / 2, sh - 6);
  };

  // Overlay de pausa
  BroadcastHUD.prototype.drawPause = function (ctx) {
    if (!C) C = window.FMG.Phase16.C;
    var sw = _screenW(ctx);
    var sh = _screenH(ctx);
    ctx.fillStyle = "rgba(8,12,20,0.65)";
    ctx.fillRect(0, 0, sw, sh);
    ctx.fillStyle = TV.text;
    ctx.font      = "bold 36px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSA", sw / 2, sh / 2);
    ctx.font      = "14px 'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = TV.muted;
    ctx.fillText("Presiona P para continuar", sw / 2, sh / 2 + 30);
  };

  // ---- Helper: roundRect compatible ----
  function _roundRect(ctx, x, y, w, h, r) {
    if (typeof r === "number") r = [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + r[0], y);
    ctx.lineTo(x + w - r[1], y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    ctx.lineTo(x + w, y + h - r[2]);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    ctx.lineTo(x + r[3], y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    ctx.lineTo(x, y + r[0]);
    ctx.quadraticCurveTo(x, y, x + r[0], y);
    ctx.closePath();
  }

  window.FMG.Phase20.BroadcastHUD = BroadcastHUD;
})();
