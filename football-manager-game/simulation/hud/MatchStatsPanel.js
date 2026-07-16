(function () {
  "use strict";

  // ============================================================
  // FASE 22 — MatchStatsPanel.js
  // Panel de estadisticas rapidas del partido.
  // Centro inferior del canvas.
  // ============================================================

  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var PANEL_W = 214;
  var PANEL_H = 96;
  var PAD     = 8;

  function MatchStatsPanel() {}

  MatchStatsPanel.prototype.draw = function (ctx, snap, canvasW, canvasH) {
    var x = canvasW - PANEL_W - 14;
    var y = 14;

    // Fondo
    ctx.fillStyle = "rgba(8,12,20,0.82)";
    _rr(ctx, x, y, PANEL_W, PANEL_H, 5);
    ctx.fill();

    var stats = snap.stats;
    var rows = [
      ["POSESION",  snap.stats.possession[0] + "%", snap.stats.possession[1] + "%"],
      ["TIROS",     snap.stats.shots[0],             snap.stats.shots[1]],
      ["AL ARCO",   snap.stats.shotsOnTarget[0],     snap.stats.shotsOnTarget[1]],
      ["FALTAS",    snap.stats.fouls[0],              snap.stats.fouls[1]]
    ];

    var rowH = 13;

    // Header
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font      = "bold 8px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ESTADISTICAS", x + PANEL_W / 2, y + 10);

    rows.forEach(function (row, i) {
      var ry = y + 16 + i * rowH + rowH * 0.65;

      // Label central
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font      = "8px 'Segoe UI',Arial,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(row[0], x + PANEL_W / 2, ry);

      // Valor izquierdo (usuario)
      ctx.fillStyle = "#4a9eff";
      ctx.font      = "bold 10px 'Segoe UI',Arial,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(row[1]), x + 10, ry);

      // Valor derecho (IA)
      ctx.fillStyle = "#ff4a4a";
      ctx.textAlign = "right";
      ctx.fillText(String(row[2]), x + PANEL_W - 10, ry);

      // Barra de posesion (solo primera fila)
      if (i === 0) {
        var barX = x + 10, barY = ry + 2, barW = PANEL_W - 20, barH = 3;
        var pct  = snap.stats.possession[0] / 100;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = "#4a9eff";
        ctx.fillRect(barX, barY, barW * pct, barH);
        ctx.fillStyle = "#ff4a4a";
        ctx.fillRect(barX + barW * pct, barY, barW * (1 - pct), barH);
      }
    });

    _drawCardsAndSubs(ctx, snap, x, y + 70, PANEL_W);
  };

  function _drawCardsAndSubs(ctx, snap, x, y, w) {
    var yellow = snap.cards.filter(function (card) { return card.color === "yellow"; }).length;
    var red = snap.cards.filter(function (card) { return card.color === "red"; }).length;

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x + 10, y - 4, w - 20, 1);

    ctx.font = "bold 8px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("DISCIPLINA", x + 10, y + 7);

    ctx.fillStyle = "#f0c040";
    _rr(ctx, x + 83, y, 7, 10, 1);
    ctx.fill();
    ctx.fillStyle = "#ff4a4a";
    _rr(ctx, x + 105, y, 7, 10, 1);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px 'Segoe UI',Arial,sans-serif";
    ctx.fillText(String(yellow), x + 93, y + 8);
    ctx.fillText(String(red), x + 115, y + 8);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("CAMBIOS " + snap.substitutions + "/" + snap.maxSubs, x + w - 10, y + 8);

    if (snap.cards.length > 0) {
      var lastCard = snap.cards[snap.cards.length - 1];
      var cardColor = lastCard.color === "red" ? "#ff4a4a" : "#f0c040";
      ctx.fillStyle = cardColor;
      ctx.textAlign = "center";
      ctx.font = "bold 8px 'Segoe UI',Arial,sans-serif";
      ctx.fillText((lastCard.color === "red" ? "ROJA" : "AMARILLA") + " " + lastCard.playerName, x + w / 2, y + 22);
    }
  }

  function _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  window.FMG.Phase22.MatchStatsPanel = MatchStatsPanel;
})();
