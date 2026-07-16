(function () {
  "use strict";

  // ============================================================
  // FASE 22 — PowerMeter.js
  // Barra de potencia de tiro/pase.
  // Arco circular sobre el jugador controlado (coordenadas de mundo).
  // Se dibuja DENTRO de la transformacion de camara.
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var C = null;

  var RADIUS   = 20;
  var LINE_W   = 4;
  var COLORS   = {
    pass:  "#4a9eff",
    shoot: "#ff4a4a",
    bg:    "rgba(255,255,255,0.15)"
  };

  function PowerMeter() {
    this._charge    = 0;    // 0..1
    this._active    = false;
    this._type      = "pass";
    this._chargeDir = 1;    // oscila arriba y abajo
  }

  // Llamar cada tick cuando la tecla esta presionada
  PowerMeter.prototype.charge = function (type) {
    this._active = true;
    this._type   = type;
    this._charge += 0.035 * this._chargeDir;
    if (this._charge >= 1) { this._charge = 1; this._chargeDir = -1; }
    if (this._charge <= 0) { this._charge = 0; this._chargeDir =  1; }
  };

  // Llamar cuando se suelta la tecla — devuelve el valor y resetea
  PowerMeter.prototype.release = function () {
    var val      = this._charge;
    this._charge = 0;
    this._active = false;
    this._chargeDir = 1;
    return val;
  };

  PowerMeter.prototype.isActive = function () { return this._active; };
  PowerMeter.prototype.getValue = function () { return this._charge; };

  // Dibujar sobre el jugador (en coordenadas de mundo, dentro de camara transform)
  PowerMeter.prototype.drawOnPlayer = function (ctx, playerX, playerY) {
    if (!this._active || this._charge <= 0) return;
    if (!C) C = window.FMG.Phase16.C;

    var cx = playerX;
    var cy = playerY - C.PLAYER_R - RADIUS - 4;

    // Arco de fondo
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, -Math.PI / 2, Math.PI * 1.5);
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth   = LINE_W;
    ctx.stroke();

    // Arco de carga
    var endAngle = -Math.PI / 2 + this._charge * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, -Math.PI / 2, endAngle);
    ctx.strokeStyle = COLORS[this._type] || COLORS.pass;
    ctx.lineWidth   = LINE_W;
    ctx.stroke();

    // Porcentaje en el centro
    ctx.fillStyle  = "#ffffff";
    ctx.font       = "bold 9px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign  = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(this._charge * 100) + "%", cx, cy);
    ctx.textBaseline = "alphabetic";

    // Icono de tipo (P=pase, T=tiro)
    ctx.fillStyle = COLORS[this._type] || COLORS.pass;
    ctx.font      = "bold 7px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(this._type === "shoot" ? "T" : "P", cx, cy + 10);
  };

  window.FMG.Phase22.PowerMeter = PowerMeter;
})();
