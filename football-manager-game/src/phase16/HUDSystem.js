(function () {
  "use strict";

  // ============================================================
  // FASE 16 — HUDSystem
  // Responsabilidad: TODO el render canvas 2D.
  // Solo dibuja. No modifica estado de juego.
  // ============================================================

  const C = window.FMG.Phase16.C;

  function HUDSystem(ctx) {
    this.ctx = ctx;
  }

  // --- Cancha ---

  HUDSystem.prototype._drawField = function () {
    const ctx = this.ctx;
    for (var i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? C.COLOR_GRASS : C.COLOR_GRASS_ALT;
      ctx.fillRect(i * (C.FIELD_W / 10), 0, C.FIELD_W / 10, C.FIELD_H);
    }

    ctx.strokeStyle = C.COLOR_LINE;
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, C.FIELD_W - 2, C.FIELD_H - 2);

    // Linea media
    ctx.beginPath();
    ctx.moveTo(C.FIELD_W / 2, 0);
    ctx.lineTo(C.FIELD_W / 2, C.FIELD_H);
    ctx.stroke();

    // Circulo central
    ctx.beginPath();
    ctx.arc(C.FIELD_W / 2, C.FIELD_H / 2, 50, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = C.COLOR_LINE;
    ctx.beginPath();
    ctx.arc(C.FIELD_W / 2, C.FIELD_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Areas
    ctx.strokeRect(0,              (C.FIELD_H - 120) / 2, 60, 120);
    ctx.strokeRect(C.FIELD_W - 60, (C.FIELD_H - 120) / 2, 60, 120);

    // Postes
    var gt = (C.FIELD_H - C.GOAL_H) / 2;
    ctx.strokeStyle = C.COLOR_GOAL;
    ctx.lineWidth   = 4;
    ctx.strokeRect(-C.GOAL_W,    gt, C.GOAL_W, C.GOAL_H);
    ctx.strokeRect(C.FIELD_W,    gt, C.GOAL_W, C.GOAL_H);
  };

  // --- Jugadores ---

  HUDSystem.prototype._drawPlayer = function (p, isControlled) {
    const ctx = this.ctx;

    // Sombra
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + C.PLAYER_R - 2, C.PLAYER_R * 0.9, C.PLAYER_R * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    ctx.fillStyle = p.team === 0 ? C.COLOR_USER_TEAM : C.COLOR_AI_TEAM;
    ctx.beginPath();
    ctx.arc(p.x, p.y, C.PLAYER_R, 0, Math.PI * 2);
    ctx.fill();

    if (isControlled) {
      ctx.strokeStyle = C.COLOR_CONTROLLED;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, C.PLAYER_R + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // --- Balon ---

  HUDSystem.prototype._drawBall = function (ball) {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    var h = Math.min(ball.z || 0, 14);
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + C.BALL_R - 1, C.BALL_R * Math.max(0.35, 0.9 - h * 0.03), C.BALL_R * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = C.COLOR_BALL;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y - h, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth   = 1;
    ctx.stroke();
  };

  // --- Marcador y tiempo ---

  HUDSystem.prototype._drawScorebar = function (match) {
    const ctx  = this.ctx;
    const secs = match.secondsLeft();
    const mm   = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss   = String(secs % 60).padStart(2, "0");

    ctx.fillStyle = C.COLOR_HUD_BG;
    ctx.fillRect(0, 0, C.FIELD_W, 36);

    ctx.fillStyle  = C.COLOR_HUD_TEXT;
    ctx.font       = "bold 16px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign  = "center";
    ctx.fillText("Azul " + match.score[0] + "  \u2014  " + mm + ":" + ss + "  \u2014  " + match.score[1] + " Rojo", C.FIELD_W / 2, 23);

    // Barra de controles
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, C.FIELD_H - 22, C.FIELD_W, 22);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font      = "11px 'Segoe UI',Arial,sans-serif";
    ctx.fillText("WASD/Flechas: Mover | Shift: Sprint | Q/E: Cambio | Z/J: Pase | Espacio/L: Largo | C: Entrada | X/K: Tiro | P: Pausa", C.FIELD_W / 2, C.FIELD_H - 7);
  };

  // --- Overlays ---

  HUDSystem.prototype._drawGoalFlash = function (anim) {
    const ctx = this.ctx;
    ctx.fillStyle = C.COLOR_GOAL_FLASH;
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    ctx.fillStyle = "rgba(255,220,50,0.9)";
    ctx.font      = "bold 48px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u00a1GOL!", C.FIELD_W / 2, C.FIELD_H / 2);
  };

  HUDSystem.prototype._drawPause = function () {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(10,20,12,0.6)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 32px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSA", C.FIELD_W / 2, C.FIELD_H / 2);
  };

  HUDSystem.prototype._drawFinished = function (match) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(10,20,12,0.78)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 36px 'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Partido terminado", C.FIELD_W / 2, C.FIELD_H / 2 - 30);
    ctx.font = "bold 28px 'Segoe UI',Arial,sans-serif";
    ctx.fillText("Azul " + match.score[0] + "  \u2014  " + match.score[1] + " Rojo", C.FIELD_W / 2, C.FIELD_H / 2 + 20);
    ctx.font      = "16px 'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Presiona R para reiniciar", C.FIELD_W / 2, C.FIELD_H / 2 + 60);
  };

  // --- Frame completo ---

  HUDSystem.prototype.render = function (match, ball, anim) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, C.FIELD_W, C.FIELD_H);

    this._drawField();

    // Dibujar IA primero, luego usuario encima
    match.aiTeam.forEach((p) => this._drawPlayer(p, false));
    match.userTeam.forEach((p) => this._drawPlayer(p, p === match.controlled));

    this._drawBall(ball.ball);
    this._drawScorebar(match);

    if (anim.isGoalFlashing())  this._drawGoalFlash(anim);
    if (match.finished)         this._drawFinished(match);
    else if (match.paused)      this._drawPause();
  };

  window.FMG.Phase16.HUDSystem = HUDSystem;
})();
