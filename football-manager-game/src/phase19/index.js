(function () {
  "use strict";

  // ============================================================
  // FASE 19 — index.js
  // Inyecta porteros reales en Phase18Game.
  // Reemplaza la logica del portero (indice 0) en ambos TeamBrains.
  // Conecta GoalkeeperAnimClip con el AnimationManager de Fase 17.
  // No modifica ningun archivo anterior.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase19 = window.FMG.Phase19 || {};

  var C = null;

  // ---- GoalkeeperManager: gestiona los 2 porteros ----

  function GoalkeeperManager() {
    this._brains     = {};  // playerId -> GoalkeeperBrain
    this._saveSys    = {};  // playerId -> SaveSystem
    this._animTimers = {};  // playerId -> { zone, timer, maxTimer }
  }

  GoalkeeperManager.prototype._getOrCreate = function (player, attackingRight) {
    var id = player.id;
    if (!this._brains[id]) {
      this._brains[id]  = new window.FMG.Phase19.GoalkeeperBrain(attackingRight, 0.72);
      this._saveSys[id] = new window.FMG.Phase19.SaveSystem();
    }
    return { brain: this._brains[id], save: this._saveSys[id] };
  };

  // Tick de un portero
  // Devuelve la decision de movimiento para que TeamBrain la ejecute
  GoalkeeperManager.prototype.tickGoalkeeper = function (gkPlayer, ball, match, teammates, attackingRight) {
    if (!C) C = window.FMG.Phase16.C;

    var sys    = this._getOrCreate(gkPlayer, attackingRight);
    var brain  = sys.brain;
    var saveSys = sys.save;

    saveSys.tick();

    var result = brain.tick(gkPlayer, ball, saveSys);

    // Ejecutar saque si corresponde
    var GK_STATE = window.FMG.Phase19.GoalkeeperBrain.GK_STATE;
    if (brain.state === GK_STATE.THROW && brain.stateTimer === 1) {
      saveSys.shortThrow(gkPlayer, ball, teammates);
    } else if (brain.state === GK_STATE.PUNT && brain.stateTimer === 1) {
      saveSys.punt(gkPlayer, ball, attackingRight);
    }

    // Registrar animacion si hay atajada. El brain puede pasar a THROW/PUNT
    // en el mismo tick, asi que el evento vive en result.saveZone.
    if (result.saveZone) {
      this._animTimers[gkPlayer.id] = { zone: result.saveZone, timer: 0, maxTimer: 18 };
    }

    return result;
  };

  // Obtener pose de animacion del portero
  GoalkeeperManager.prototype.getAnimPose = function (playerId, defaultPose) {
    var GkClip = window.FMG.Phase19.GoalkeeperAnimClip;
    if (!GkClip) return defaultPose;

    var anim = this._animTimers[playerId];
    if (!anim) return GkClip.ready(performance.now() / 1000);

    anim.timer++;
    var t = Math.min(anim.timer / anim.maxTimer, 1);

    if (anim.timer >= anim.maxTimer) {
      delete this._animTimers[playerId];
    }

    return GkClip.forZone(anim.zone, t);
  };

  GoalkeeperManager.prototype.reset = function () {
    this._brains     = {};
    this._saveSys    = {};
    this._animTimers = {};
  };

  // ---- Fabrica: crea Phase18Game con porteros reales ----

  window.FMG.Phase19.createGame = function (canvas) {
    C = window.FMG.Phase16.C;

    var game   = window.FMG.Phase18.createGame(canvas);
    var gkMgr  = new GoalkeeperManager();
    game.gkMgr = gkMgr;

    // Parchear _logicTick para procesar porteros ANTES del TeamBrain
    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var match = game.match;
      var ball  = game.ball;

      if (!match.running || match.paused) return;

      // Portero usuario (indice 0 de userTeam)
      var userGK = match.userTeam[0];
      if (userGK && match.controlled !== userGK) {
        var uResult = gkMgr.tickGoalkeeper(userGK, ball, match, match.userTeam, true);
        if (uResult.speed > 0) {
          var udx = uResult.x - userGK.x;
          var udy = uResult.y - userGK.y;
          var ulen = Math.hypot(udx, udy) || 1;
          if (ulen > 3) match.movePlayer(userGK, udx / ulen, udy / ulen, C.AI_SPEED * uResult.speed);
        }
      }

      // Portero IA (indice 0 de aiTeam)
      var aiGK = match.aiTeam[0];
      if (aiGK) {
        var aResult = gkMgr.tickGoalkeeper(aiGK, ball, match, match.aiTeam, false);
        if (aResult.speed > 0) {
          var adx = aResult.x - aiGK.x;
          var ady = aResult.y - aiGK.y;
          var alen = Math.hypot(adx, ady) || 1;
          if (alen > 3) match.movePlayer(aiGK, adx / alen, ady / alen, C.AI_SPEED * aResult.speed);
        }
      }

      // Resto del tick (IA de campo, fisica, goles, animaciones)
      origLogic();
    };

    // Parchear AnimationManager para usar poses de portero
    if (game.animMgr) {
      var origAnimRender = game.animMgr.render.bind(game.animMgr);
      game.animMgr.render = function (ctx, match, ball) {
        var self = game.animMgr;
        var GkClip = window.FMG.Phase19.GoalkeeperAnimClip;

        // Efectos
        self._effects.draw(ctx);

        // Dibujar todos los jugadores con pose correcta
        var allTeams = [
          { team: match.aiTeam,   isUser: false },
          { team: match.userTeam, isUser: true  }
        ];

        allTeams.forEach(function (entry) {
          entry.team.forEach(function (p, idx) {
            var ps   = self._getState(p);
            var isGK = idx === 0;
            var pose;

            if (isGK && GkClip) {
              pose = gkMgr.getAnimPose(p.id, null);
              if (!pose) pose = self._blendTree.evaluate(ps);
            } else {
              pose = self._blendTree.evaluate(ps);
            }

            var isControlled = entry.isUser && p === match.controlled;
            self._playerRen.draw(ctx, ps, pose, isControlled);
          });
        });

        // Balon
        self._ballRen.draw(ctx, ball.ball);
      };
    }

    // Parchear reset
    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      gkMgr.reset();
    };

    return game;
  };
})();
