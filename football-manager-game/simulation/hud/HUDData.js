(function () {
  "use strict";

  // ============================================================
  // FASE 22 — HUDData.js
  // Recolecta y normaliza datos del juego para el HUD.
  // Punto unico de acceso: ningun componente HUD toca game state.
  // Se llama una vez por frame antes de dibujar el HUD.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase22 = window.FMG.Phase22 || {};

  var C = null;

  // Estadisticas acumuladas del partido
  function MatchStats() {
    this.shots      = [0, 0];
    this.shotsOnTarget = [0, 0];
    this.fouls      = [0, 0];
    this.corners    = [0, 0];
    this.possession = [50, 50]; // porcentaje
    this._possFrames = [0, 0];  // frames con posesion por equipo
  }

  MatchStats.prototype.update = function (ball, match) {
    // Posesion: quien esta mas cerca del balon
    var b = ball.ball;
    var minDist = Infinity, closestTeam = -1;
    var players = match.allPlayers();
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < minDist) { minDist = d; closestTeam = p.team; }
    }
    if (closestTeam >= 0 && minDist < 60) {
      this._possFrames[closestTeam]++;
      var total = this._possFrames[0] + this._possFrames[1] || 1;
      this.possession[0] = Math.round(this._possFrames[0] / total * 100);
      this.possession[1] = 100 - this.possession[0];
    }
  };

  MatchStats.prototype.registerShot = function (team, onTarget) {
    this.shots[team]++;
    if (onTarget) this.shotsOnTarget[team]++;
  };

  MatchStats.prototype.registerFoul = function (team) {
    this.fouls[team]++;
  };

  function HUDData() {
    this.stats = new MatchStats();
    // Estado de potencia de tiro/pase
    this.powerCharge  = 0;    // 0..1
    this.powerActive  = false;
    this.powerType    = "pass"; // "pass" | "shoot"
    // Lower thirds pendientes
    this.lowerThirds  = [];   // [{ text, subtext, timer, maxTimer, color }]
    // Tarjetas del partido
    this.cards        = [];   // [{ team, playerName, color, minute }]
    // Cambios realizados
    this.substitutions = 0;
    this.maxSubs       = 5;
    this._storyFlags   = {};
  }

  // Llamar cada frame para actualizar datos derivados
  HUDData.prototype.update = function (match, ball) {
    if (!C) C = window.FMG.Phase16.C;
    this.stats.update(ball, match);
    this.tickBroadcastEvents(match);

    // Decrementar timers de lower thirds
    var write = 0;
    for (var i = 0; i < this.lowerThirds.length; i++) {
      var lt = this.lowerThirds[i];
      lt.timer--;
      if (lt.timer > 0) {
        this.lowerThirds[write] = lt;
        write++;
      }
    }
    this.lowerThirds.length = write;
  };

  // Agregar lower third (evento del partido)
  HUDData.prototype.pushLowerThird = function (text, subtext, color, durationTicks) {
    this.lowerThirds.unshift({
      text:     text,
      subtext:  subtext || "",
      timer:    durationTicks || 180,
      maxTimer: durationTicks || 180,
      color:    color || "#f0c040"
    });
    // Maximo 2 lower thirds simultaneos
    this.lowerThirds = this.lowerThirds.slice(0, 2);
  };

  // Registrar tarjeta
  HUDData.prototype.registerCard = function (team, playerName, color, minute) {
    this.cards.push({ team, playerName, color, minute });
    this.cards = this.cards.slice(-6); // maximo 6 tarjetas visibles
  };

  HUDData.prototype.registerSubstitution = function (team, outName, inName, minute) {
    if (this.substitutions >= this.maxSubs) return;
    this.substitutions++;
    this.pushLowerThird(
      "CAMBIO " + (team === 0 ? "AZUL" : "ROJO"),
      (outName || "Sale jugador") + "  >  " + (inName || "Entra jugador") + "  " + minute + "'",
      team === 0 ? "#4a9eff" : "#ff4a4a",
      210
    );
  };

  HUDData.prototype.tickBroadcastEvents = function (match) {
    if (!C) C = window.FMG.Phase16.C;
    var elapsed = Math.floor(match.tickCount / C.FPS);
    var minute = Math.max(1, Math.min(90, Math.round((match.tickCount / (C.MATCH_SECS * C.FPS)) * 90)));

    if (elapsed >= 18 && !this._storyFlags.firstCard) {
      this._storyFlags.firstCard = true;
      this.stats.registerFoul(1);
      this.registerCard(1, "Def. Der", "yellow", minute);
      this.pushLowerThird("TARJETA AMARILLA", "Def. Der, ROJO  " + minute + "'", "#f0c040", 220);
    }

    if (elapsed >= 42 && !this._storyFlags.firstSub) {
      this._storyFlags.firstSub = true;
      this.registerSubstitution(0, "Mediocampista", "Volante mixto", minute);
    }
  };

  // Construir snapshot para el HUD (datos normalizados)
  HUDData.prototype.snapshot = function (match, ball, animMgr) {
    if (!C) C = window.FMG.Phase16.C;

    var controlled = match.controlled;
    var ps = null;
    if (controlled && animMgr && animMgr._states) {
      ps = animMgr._states[controlled.id];
    }

    // Stamina del jugador controlado (basada en speed del PlayerState)
    var stamina = 1;
    if (ps) {
      // Stamina = 1 - (blendWeight * 0.4) — sprint gasta mas
      stamina = Math.max(0.05, 1 - ps.blendWeight * 0.4);
    }

    return {
      score:        match.score,
      secondsLeft:  match.secondsLeft(),
      controlled:   controlled,
      controlledName: controlled ? _playerName(controlled.id) : null,
      stamina:      stamina,
      action:       ps ? ps.action : "idle",
      speed:        ps ? ps.speed  : 0,
      ballPos:      { x: ball.ball.x, y: ball.ball.y },
      ballSpeed:    Math.hypot(ball.ball.vx, ball.ball.vy),
      userTeam:     match.userTeam,
      aiTeam:       match.aiTeam,
      stats:        this.stats,
      powerCharge:  this.powerCharge,
      powerActive:  this.powerActive,
      powerType:    this.powerType,
      lowerThirds:  this.lowerThirds,
      cards:        this.cards,
      substitutions: this.substitutions,
      maxSubs:      this.maxSubs,
      finished:     match.finished,
      paused:       match.paused
    };
  };

  // Nombre legible por ID de jugador
  function _playerName(id) {
    var names = {
      u0:"Portero", u1:"Lat. Izq", u2:"Def. Central", u3:"Def. Central", u4:"Lat. Der",
      u5:"Volante Izq", u6:"Mediocentro", u7:"Volante Der",
      u8:"Extremo Izq", u9:"Delantero", u10:"Extremo Der"
    };
    return names[id] || id.toUpperCase();
  }

  window.FMG.Phase22.HUDData   = HUDData;
  window.FMG.Phase22.MatchStats = MatchStats;
})();
