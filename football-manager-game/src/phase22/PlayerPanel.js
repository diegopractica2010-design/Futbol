(function () {
  "use strict";

  // ============================================================
  // FASE 22 — PlayerPanel.js
  // Panel del jugador controlado: nombre, stamina, accion.
  // Esquina inferior izquierda del canvas.
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var PANEL_W = 160;
  var PANEL_H = 52;
  var PAD     = 8;

  // Colores de accion
  var ACTION_COLORS = {
    idle:     "rgba(255,255,255,0.4)",
    walk:     "#4a9eff",
    trot:     "#4aff8a",
    sprint:   "#ff9f4a",
    pass:     "#f0c040",
    shoot:    "#ff4a4a",
    control:  "#4aff8a",
    tackle:   "#ff6b35",
    celebrate:"#f0c040",
    fall:     "#ff4a4a"
  };

  var ACTION_LABELS = {
    idle:     "EN POSICION",
    walk:     "CAMINANDO",
    trot:     "TROTANDO",
    sprint:   "SPRINT",
    pass:     "PASE",
    shoot:    "TIRO",
    control:  "CONTROL",
    tackle:   "ENTRADA",
    celebrate:"CELEBRANDO",
    fall:     "CAIDA"
  };

  function PlayerPanel() {}

  PlayerPanel.prototype.draw = function (ctx, snap, canvasH) {
    if (!snap.controlled) return;

    var x = PAD;
    var y = canvasH - PANEL_H - PAD - 22;

    // Fondo
    ctx.fillStyle = "rgba(8,12,20,0.85)";
    _rr(ctx, x, y, PANEL_W, PANEL_H, 5);
    ctx.fill();

    // Franja de color del equipo
    ctx.fillStyle = "#1a6fc4";
    _rr(ctx, x, y, 5, PANEL_H, [5, 0, 0, 5]);
    ctx.fill();

    // Nombre del jugador
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 12px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(snap.controlledName || "JUGADOR", x + 12, y + 16);

    // Accion actual
    var actionColor = ACTION_COLORS[snap.action] || "rgba(255,255,255,0.4)";
    var actionLabel = ACTION_LABELS[snap.action] || snap.action.toUpperCase();
    ctx.fillStyle = actionColor;
    ctx.font      = "bold 9px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(actionLabel, x + 12, y + 28);

    // Barra de stamina
    var barX = x + 12;
    var barY = y + 34;
    var barW = PANEL_W - 24;
    var barH = 7;

    // Fondo barra
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    _rr(ctx, barX, barY, barW, barH, 3);
    ctx.fill();

    // Relleno barra (color segun nivel)
    var stamina = snap.stamina;
    var staminaColor = stamina > 0.6 ? "#4aff8a" : stamina > 0.3 ? "#f0c040" : "#ff4a4a";
    ctx.fillStyle = staminaColor;
    _rr(ctx, barX, barY, Math.max(4, barW * stamina), barH, 3);
    ctx.fill();

    // Label stamina
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font      = "8px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("STAMINA", x + PANEL_W - 4, y + 28);
  };

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

  window.FMG.Phase22.PlayerPanel = PlayerPanel;
})();
