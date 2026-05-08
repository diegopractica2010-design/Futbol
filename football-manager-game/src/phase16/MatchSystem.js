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
    [52,              C.FIELD_H / 2],
    [150,             C.FIELD_H * 0.18],
    [142,             C.FIELD_H * 0.38],
    [142,             C.FIELD_H * 0.62],
    [150,             C.FIELD_H * 0.82],
    [292,             C.FIELD_H * 0.24],
    [282,             C.FIELD_H * 0.50],
    [292,             C.FIELD_H * 0.76],
    [430,             C.FIELD_H * 0.24],
    [452,             C.FIELD_H * 0.50],
    [430,             C.FIELD_H * 0.76]
  ];

  const AWAY_POS = HOME_POS.map(([x, y]) => [C.FIELD_W - x, y]);

  function MatchSystem() {
    this.score       = [0, 0];
    this.tickCount   = 0;
    this.running     = false;
    this.paused      = false;
    this.finished    = false;
    this.controlled  = null;   // jugador usuario activo
    this._manualControlTicks = 0;
    this._selectedUserIndex = 10;
    this.userTeam    = HOME_POS.map(([x, y], i) => makePlayer("u" + i, x, y, 0));
    this.aiTeam      = AWAY_POS.map(([x, y], i) => makePlayer("a" + i, x, y, 1));
    this._allPlayers = this.userTeam.concat(this.aiTeam);
  }

  MatchSystem.prototype.start = function () {
    this.running  = true;
    this.paused   = false;
    this.finished = false;
    this._matchEndedEmitted = false;
    if (window.FMG.emitGameEvent) {
      window.FMG.emitGameEvent(window.FMG.EventTypes.MATCH_STARTED, {
        source: "phase16",
        tick: this.tickCount,
        score: this.score.slice()
      });
    }
  };

  MatchSystem.prototype.reset = function () {
    this.score     = [0, 0];
    this.tickCount = 0;
    this.running   = false;
    this.paused    = false;
    this.finished  = false;
    this.controlled = null;
    this._manualControlTicks = 0;
    this._selectedUserIndex = 10;
    this.userTeam  = HOME_POS.map(([x, y], i) => makePlayer("u" + i, x, y, 0));
    this.aiTeam    = AWAY_POS.map(([x, y], i) => makePlayer("a" + i, x, y, 1));
    this._allPlayers = this.userTeam.concat(this.aiTeam);
  };

  MatchSystem.prototype.kickoff = function () {
    HOME_POS.forEach(([x, y], i) => { this.userTeam[i].x = x; this.userTeam[i].y = y; });
    AWAY_POS.forEach(([x, y], i) => { this.aiTeam[i].x   = x; this.aiTeam[i].y   = y; });
  };

  MatchSystem.prototype.registerGoal = function (side) {
    // side: "goal-left" = marcó equipo usuario (ataca derecha), "goal-right" = marcó IA
    if (side === "goal-left")  this.score[0]++;
    if (side === "goal-right") this.score[1]++;
    if (window.FMG.emitGameEvent) {
      window.FMG.emitGameEvent(window.FMG.EventTypes.GOAL_SCORED, {
        side,
        team: side === "goal-left" ? 0 : 1,
        score: this.score.slice(),
        tick: this.tickCount
      });
    }
  };

  MatchSystem.prototype.advanceTick = function () {
    this.tickCount++;
    if (this.tickCount >= C.MATCH_SECS * C.FPS) {
      this.running  = false;
      this.finished = true;
      if (!this._matchEndedEmitted && window.FMG.emitGameEvent) {
        this._matchEndedEmitted = true;
        window.FMG.emitGameEvent(window.FMG.EventTypes.MATCH_ENDED, {
          source: "phase16",
          tick: this.tickCount,
          score: this.score.slice()
        });
      }
    }
  };

  MatchSystem.prototype.secondsLeft = function () {
    return Math.max(0, C.MATCH_SECS - Math.floor(this.tickCount / C.FPS));
  };

  // Actualiza qué jugador usuario está controlado (el más cercano al balón)
  MatchSystem.prototype.updateControlled = function (ballX, ballY) {
    if (this._manualControlTicks > 0 && this.userTeam[this._selectedUserIndex]) {
      this._manualControlTicks--;
      this.controlled = this.userTeam[this._selectedUserIndex];
      return;
    }

    let best = null, bestD = Infinity;
    this.userTeam.forEach((p, index) => {
      const d = Math.hypot(p.x - ballX, p.y - ballY);
      if (d < bestD) { bestD = d; best = p; this._selectedUserIndex = index; }
    });
    this.controlled = best;
  };

  MatchSystem.prototype.selectNextUser = function (direction) {
    const step = direction < 0 ? -1 : 1;
    this._selectedUserIndex = (this._selectedUserIndex + step + this.userTeam.length) % this.userTeam.length;
    this.controlled = this.userTeam[this._selectedUserIndex];
    this._manualControlTicks = C.FPS * 2;
    return this.controlled;
  };

  // Mueve un jugador dentro de los límites de la cancha
  MatchSystem.prototype.movePlayer = function (player, dx, dy, speed) {
    player.x = Math.max(C.PLAYER_R, Math.min(C.FIELD_W - C.PLAYER_R, player.x + dx * speed));
    player.y = Math.max(C.PLAYER_R, Math.min(C.FIELD_H - C.PLAYER_R, player.y + dy * speed));
  };

  // Todos los jugadores (para iteración en colisiones)
  MatchSystem.prototype.allPlayers = function () {
    return this._allPlayers;
  };

  window.FMG.Phase16.MatchSystem = MatchSystem;
})();
