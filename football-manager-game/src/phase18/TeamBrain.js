(function () {
  "use strict";

  // ============================================================
  // FASE 18 — TeamBrain.js
  // Coordinacion de equipo: quien presiona, quien cubre.
  // Ejecuta tiros y pases de la IA.
  // Decisiones cada 6-15 ticks (100-250ms a 60fps).
  // ============================================================

  window.FMG.Phase18 = window.FMG.Phase18 || {};

  var C          = null;
  var Formation  = null;
  var PlayerRole = null;
  var Decision   = null;
  var ACTION     = null;

  // Update throttling IA: cerca cada frame, media 100ms, lejos 300ms.
  var DECISION_NEAR = 1;
  var DECISION_MID  = 6;
  var DECISION_FAR  = 18;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase18-team-brain") : 0.5; }

  function TeamBrain(teamIndex, attackingRight) {
    this.teamIndex      = teamIndex;      // 0=usuario, 1=IA
    this.attackingRight = attackingRight;
    this._decisions     = {};  // playerId -> { decision, decisionTick }
    this._formation     = null;
    this._decSys        = null;
    this._movSys        = null;
    this.tacticsPlan    = null;
  }

  TeamBrain.prototype.init = function () {
    C          = window.FMG.Phase16.C;
    Formation  = window.FMG.Phase18.Formation;
    PlayerRole = window.FMG.Phase18.PlayerRole;
    Decision   = window.FMG.Phase18.DecisionSystem;
    ACTION     = window.FMG.Phase18.ACTION;

    this._formation = new Formation();
    this._decSys    = new window.FMG.Phase18.DecisionSystem();
    this._movSys    = new window.FMG.Phase18.MovementSystem();
  };

  TeamBrain.prototype.setTacticsPlan = function (plan) {
    this.tacticsPlan = plan || null;
  };

  // Tick principal del equipo
  // players: array de jugadores de ESTE equipo
  // rivals:  array de jugadores del equipo RIVAL
  // ball:    BallSystem
  // match:   MatchSystem
  // tick:    numero de tick global
  TeamBrain.prototype.tick = function (players, rivals, ball, match, tick) {
    if (!this._formation) this.init();

    var b          = ball.ball;
    var ballSpeed  = Math.hypot(b.vx, b.vy);

    // Determinar quien tiene el balon
    var possessorId = this._findPossessor(players, rivals, ball);
    var teamHasBall = possessorId !== null &&
                      players.some(function (p) { return p.id === possessorId; });

    // Fase de juego del equipo
    var phase = this._formation.getPhase(teamHasBall, b.x, this.attackingRight);

    var self = this;

    players.forEach(function (player, idx) {
      var teamIndex = typeof player._teamIndex === "number" ? player._teamIndex : idx;
      var role     = decorateRole(PlayerRole.get(teamIndex), player);
      var ballDist = ball.distTo(player);

      // Intervalo de decision segun distancia
      var decInterval = ballDist < 150 ? DECISION_NEAR :
                        ballDist < 320 ? DECISION_MID  : DECISION_FAR;

      var lastDec = self._decisions[player.id];
      var needsDecision = !lastDec || (tick - lastDec.tick) >= decInterval;

      if (needsDecision) {
        var basePos = self._formation.getBase(teamIndex, self.attackingRight, phase, self.tacticsPlan);
        var hasBall = possessorId === player.id;

        var ctx = {
          player:         player,
          playerIndex:    teamIndex,
          role:           role,
          team:           self.teamIndex,
          ball:           b,
          hasBall:        hasBall,
          ballDist:       ballDist,
          basePos:        basePos,
          rivals:         rivals,
          teammates:      players,
          attackingRight: self.attackingRight,
          phase:          phase,
          teamHasBall:    teamHasBall,
          tacticsPlan:    self.tacticsPlan
        };

        var decision = self._decSys.decide(ctx);
        self._decisions[player.id] = { decision: decision, tick: tick };

        // Ejecutar tiro o pase inmediatamente (no se acumulan)
        if (hasBall) {
          if (decision.action === ACTION.SHOOT) {
            self._executeShoot(player, decision, ball, ballSpeed);
          } else if (decision.action === ACTION.PASS) {
            self._executePass(player, decision, ball, players);
          }
        }
      }

      // Ejecutar movimiento con LOD
      var dec = self._decisions[player.id];
      if (dec) {
        self._movSys.execute(player, dec.decision, ballDist, tick, match);
      }
    });
  };

  // Encontrar al jugador mas cercano al balon (poseedor)
  TeamBrain.prototype._findPossessor = function (players, rivals, ball) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var d = ball.distTo(p);
      if (d < bestD) { bestD = d; best = p; }
    }
    for (var j = 0; j < rivals.length; j++) {
      var r = rivals[j];
      var rd = ball.distTo(r);
      if (rd < bestD) { bestD = rd; best = r; }
    }
    // Solo es poseedor si esta muy cerca
    return (bestD < 22) ? best.id : null;
  };

  // Ejecutar tiro de la IA
  TeamBrain.prototype._executeShoot = function (player, decision, ball, ballSpeed) {
    // Solo tirar si el balon esta cerca y no tiene mucha velocidad
    if (ball.distTo(player) > 28 || ballSpeed > 4) return;
    var accuracy = player._shootAccuracy || 0.65;
    if (rng() > 0.035 + accuracy * 0.04) return;

    var dx  = decision.targetX - ball.ball.x;
    var dy  = decision.targetY - ball.ball.y;
    var len = Math.hypot(dx, dy) || 1;
    // Agregar imprecision realista desde atributos, moral y cansancio.
    var spread = (rng() - 0.5) * (1.15 - accuracy) * 0.7;
    ball.applyImpulse(
      (dx / len + spread) * C.SHOOT_POWER * 0.88,
      (dy / len + spread) * C.SHOOT_POWER * 0.88,
      { error: (1 - accuracy) * 0.55, lift: 1.6, spin: 1.2 }
    );
  };

  // Ejecutar pase de la IA
  TeamBrain.prototype._executePass = function (player, decision, ball, teammates) {
    if (ball.distTo(player) > 28) return;
    var accuracy = player._passAccuracy || 0.82;
    if (rng() > 0.025 + accuracy * 0.04) return;

    var dx  = decision.targetX - ball.ball.x;
    var dy  = decision.targetY - ball.ball.y;
    var len = Math.hypot(dx, dy) || 1;
    ball.applyImpulse(
      (dx / len) * C.PASS_POWER * 0.9,
      (dy / len) * C.PASS_POWER * 0.9,
      {
        targetX: decision.targetX,
        targetY: decision.targetY,
        assist: 0.006 + accuracy * 0.012,
        error: (1 - accuracy) * 1.05,
        spin: 0.5 + accuracy * 0.35
      }
    );
  };

  TeamBrain.prototype.reset = function () {
    this._decisions = {};
    if (this._movSys) this._movSys.reset();
  };

  function decorateRole(baseRole, player) {
    var role = Object.assign({}, baseRole);
    if (player._pressRadiusModifier) role.pressRadius *= player._pressRadiusModifier;
    if (player._markRadiusModifier) role.markRadius *= player._markRadiusModifier;
    if (player._shootDistanceModifier) role.shootDist *= player._shootDistanceModifier;
    if (player._roleAggression) role.aggression *= player._roleAggression;
    if (player._roleBehavior) {
      if (Number.isFinite(player._roleBehavior.press)) role.pressRadius *= 1 + player._roleBehavior.press * 0.12;
      if (Number.isFinite(player._roleBehavior.mark)) role.markRadius *= 1 + player._roleBehavior.mark * 0.10;
      if (Number.isFinite(player._roleBehavior.shoot)) role.shootDist *= 1 + player._roleBehavior.shoot * 0.10;
      if (Number.isFinite(player._roleBehavior.screen)) role.stayBack = true;
      if (Number.isFinite(player._roleBehavior.roam) && player._roleBehavior.roam > 0.5) role.stayBack = false;
    }
    return role;
  }

  window.FMG.Phase18.TeamBrain = TeamBrain;
})();
