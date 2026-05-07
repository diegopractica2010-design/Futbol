(function () {
  "use strict";

  // ============================================================
  // FASE 22 — FinalHUD.js
  // Orquestador del HUD completo.
  // Dibuja todos los componentes en orden correcto.
  // Unico punto de entrada para el render del HUD.
  // Coordenadas de pantalla (despues de endWorldTransform).
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var C = null;

  function FinalHUD(canvasW, canvasH) {
    this._cw      = canvasW;
    this._ch      = canvasH;
    this._radar   = new window.FMG.Phase22.RadarMinimap();
    this._player  = new window.FMG.Phase22.PlayerPanel();
    this._stats   = new window.FMG.Phase22.MatchStatsPanel();
    this._lower   = new window.FMG.Phase22.LowerThird();
    this._power   = new window.FMG.Phase22.PowerMeter();
    this._hudData = null; // se asigna desde index.js
  }

  // Dibujar HUD completo en coordenadas de pantalla
  FinalHUD.prototype.draw = function (ctx, snap) {
    if (!C) C = window.FMG.Phase16.C;

    var cw = this._cw;
    var ch = this._ch;

    this._drawScoreboard(ctx, snap, cw);
    this._drawBroadcastStatus(ctx, snap, cw);

    this._radar.draw(ctx, snap, cw, ch);
    this._player.draw(ctx, snap, ch);
    this._stats.draw(ctx, snap, cw, ch);
    this._lower.draw(ctx, snap, cw, ch);
  };

  // Dibujar potencia sobre el jugador (en coordenadas de mundo, dentro de camara)
  FinalHUD.prototype.drawPowerInWorld = function (ctx, snap) {
    if (!snap.controlled || !this._power.isActive()) return;
    this._power.drawOnPlayer(ctx, snap.controlled.x, snap.controlled.y);
  };

  FinalHUD.prototype._drawScoreboard = function (ctx, snap) {
    var secs = snap.secondsLeft || 0;
    var mm = String(Math.floor(secs / 60)).padStart(2, "0");
    var ss = String(secs % 60).padStart(2, "0");
    var x = 14;
    var y = 12;
    var w = 258;
    var h = 48;

    ctx.fillStyle = "rgba(7,11,18,0.91)";
    _rr(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.fillStyle = "#1a6fc4";
    _rr(ctx, x, y, 8, h, [6, 0, 0, 6]);
    ctx.fill();
    ctx.fillStyle = "#c42b1a";
    _rr(ctx, x + w - 8, y, 8, h, [0, 6, 6, 0]);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "bold 8px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIGA MASTER", x + w / 2, y + 10);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("AZUL", x + 17, y + 30);
    ctx.textAlign = "right";
    ctx.fillText("ROJO", x + w - 17, y + 30);

    ctx.fillStyle = "#f0c040";
    ctx.font = "bold 22px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(snap.score[0] + " - " + snap.score[1], x + w / 2, y + 34);

    ctx.fillStyle = "rgba(7,11,18,0.91)";
    _rr(ctx, x + w / 2 - 31, y + h - 1, 62, 19, [0, 0, 5, 5]);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "bold 11px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(mm + ":" + ss, x + w / 2, y + h + 13);
  };

  FinalHUD.prototype._drawBroadcastStatus = function (ctx, snap, canvasW) {
    if (!snap.finished && !snap.paused) return;
    var label = snap.finished ? "FINAL" : "PAUSA";
    var x = canvasW / 2 - 55;
    var y = 14;
    ctx.fillStyle = snap.finished ? "rgba(240,192,64,0.94)" : "rgba(7,11,18,0.88)";
    _rr(ctx, x, y, 110, 28, 6);
    ctx.fill();
    ctx.fillStyle = snap.finished ? "#111722" : "#ffffff";
    ctx.font = "bold 14px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + 55, y + 19);
  };

  // Acceso al PowerMeter para que index.js lo controle
  Object.defineProperty(FinalHUD.prototype, "power", {
    get: function () { return this._power; }
  });

  window.FMG.Phase22.FinalHUD = FinalHUD;

  function _rr(ctx, x, y, w, h, r) {
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
})();
