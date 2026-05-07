(function () {
  "use strict";

  // ============================================================
  // FASE 21 — AdvertRenderer.js
  // Publicidad lateral baked: banners con sponsors en bordes.
  // Generado UNA VEZ en init(). Costo por frame: 1 drawImage.
  // ============================================================

  window.FMG.Phase21 = window.FMG.Phase21 || {};

  var C = null;

  // Sponsors ficticios con colores de marca
  var SPONSORS = [
    { text: "FUTBOL CL",  bg: "#c0392b", fg: "#ffffff" },
    { text: "BANCO SUR",  bg: "#1a5276", fg: "#f0c040" },
    { text: "CERVEZA X",  bg: "#f39c12", fg: "#1a1a1a" },
    { text: "TELECOM",    bg: "#1e8449", fg: "#ffffff" },
    { text: "AUTO PLUS",  bg: "#2c3e50", fg: "#e8e8e8" },
    { text: "SPORT TV",   bg: "#8e44ad", fg: "#ffffff" },
    { text: "ENERGIA GO", bg: "#e74c3c", fg: "#f1c40f" },
    { text: "BANCO SUR",  bg: "#1a5276", fg: "#f0c040" }
  ];

  var BANNER_H = 12; // altura del banner lateral

  function AdvertRenderer() {
    this._baked = null;
  }

  AdvertRenderer.prototype.init = function (totalW, totalH, fieldOffsetX, fieldOffsetY, fieldW, fieldH) {
    if (!C) C = window.FMG.Phase16.C;

    var baked = _makeCanvas(totalW, totalH);
    var ctx   = baked.getContext("2d");

    // Banner superior (sobre la cancha)
    this._drawBannerRow(ctx, fieldOffsetX, fieldOffsetY - BANNER_H - 2, fieldW, BANNER_H, SPONSORS);

    // Banner inferior
    this._drawBannerRow(ctx, fieldOffsetX, fieldOffsetY + fieldH + 2, fieldW, BANNER_H, SPONSORS.slice().reverse());

    this._baked = baked;
  };

  AdvertRenderer.prototype._drawBannerRow = function (ctx, x, y, totalW, h, sponsors) {
    var segW = Math.floor(totalW / sponsors.length);
    sponsors.forEach(function (sp, i) {
      var sx = x + i * segW;
      // Fondo del banner
      ctx.fillStyle = sp.bg;
      ctx.fillRect(sx, y, segW, h);
      // Separador
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(sx + segW - 1, y, 1, h);
      // Texto
      ctx.fillStyle  = sp.fg;
      ctx.font       = "bold " + Math.floor(h * 0.72) + "px 'Segoe UI',Arial,sans-serif";
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sp.text, sx + segW / 2, y + h / 2);
    });
    ctx.textBaseline = "alphabetic";
  };

  AdvertRenderer.prototype.draw = function (ctx) {
    if (this._baked) ctx.drawImage(this._baked, 0, 0);
  };

  function _makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  AdvertRenderer.BANNER_H = BANNER_H;
  window.FMG.Phase21.AdvertRenderer = AdvertRenderer;
})();
