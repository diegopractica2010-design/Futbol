(function () {
  "use strict";

  // ============================================================
  // FASE 16 — MatchSystem
  // Responsabilidad: estado del partido (score, tiempo, jugadores).
  // Es el modelo de datos. Los otros sistemas lo leen y modifican.
  // ============================================================

  const C = window.FMG.Phase16.C;

  function makePlayer(id, x, y, team) {
    return { id, x, y, team };
  }

  const HOME_POS = [
    [60,              C.FIELD_H / 2],
    [180,             C.FIELD_H / 2 - 100],
    [180,             C.FIELD_H / 2 + 100],
    [300,             C.FIELD_H / 2 - 60],
    [300,             C.FIELD_H / 2 + 60]
  ];

  const AWAY_POS = HOME_POS.map(([x, y]) => [C.FIELD_W - x, y]);

  function MatchSystem() {
    this.score       = [0, 0];
    this.tickCount   = 0;
    this.running     = false;
    this.paused      = false;
    this.finished    = false;
    this.controlled  = null;   // jugador usuario activo
    this.userTeam    = HOME_POS.map(([x, y], i) => makePlayer("u" + i, x, y, 0));
    this.aiTeam      = AWAY_POS.map(([x, y], i) => makePlayer("a" + i, x, y, 1));
  }

  MatchSystem.prototype.start = function () {
    this.running  = true;
    this.paused   = false;
    this.finished = false;
  };

  MatchSystem.prototype.reset = function () {
    this.score     = [0, 0];
    this.tickCount = 0;
    this.running   = false;
    this.paused    = false;
    this.finished  = false;
    this.controlled = null;
    this.userTeam  = HOME_POS.map(([x, y], i) => makePlayer("u" + i, x, y, 0));
    this.aiTeam    = AWAY_POS.map(([x, y], i) => makePlayer("a" + i, x, y, 1));
  };

  MatchSystem.prototype.kickoff = function () {
    HOME_POS.forEach(([x, y], i) => { this.userTeam[i].x = x; this.userTeam[i].y = y; });
    AWAY_POS.forEach(([x, y], i) => { this.aiTeam[i].x   = x; this.aiTeam[i].y   = y; });
  };

  MatchSystem.prototype.registerGoal = function (side) {
    // side: "goal-left" = marcó equipo usuario (ataca derecha), "goal-right" = marcó IA
    if (side === "goal-left")  this.score[0]++;
    if (side === "goal-right") this.score[1]++;
  };

  MatchSystem.prototype.advanceTick = function () {
    this.tickCount++;
    if (this.tickCount >= C.MATCH_SECS * C.FPS) {
      this.running  = false;
      this.finished = true;
    }
  };

  MatchSystem.prototype.secondsLeft = function () {
    return Math.max(0, C.MATCH_SECS - Math.floor(this.tickCount / C.FPS));
  };

  // Actualiza qué jugador usuario está controlado (el más cercano al balón)
  MatchSystem.prototype.updateControlled = function (ballX, ballY) {
    let best = null, bestD = Infinity;
    this.userTeam.forEach((p) => {
      const d = Math.hypot(p.x - ballX, p.y - ballY);
      if (d < bestD) { bestD = d; best = p; }
    });
    this.controlled = best;
  };

  // Mueve un jugador dentro de los límites de la cancha
  MatchSystem.prototype.movePlayer = function (player, dx, dy, speed) {
    player.x = Math.max(C.PLAYER_R, Math.min(C.FIELD_W - C.PLAYER_R, player.x + dx * speed));
    player.y = Math.max(C.PLAYER_R, Math.min(C.FIELD_H - C.PLAYER_R, player.y + dy * speed));
  };

  // Todos los jugadores (para iteración en colisiones)
  MatchSystem.prototype.allPlayers = function () {
    return this.userTeam.concat(this.aiTeam);
  };

  window.FMG.Phase16.MatchSystem = MatchSystem;
})();
