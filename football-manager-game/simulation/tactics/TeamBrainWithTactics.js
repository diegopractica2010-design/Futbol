(function () {
  "use strict";

  // ============================================================
  // FASE 24 — TeamBrainWithTactics.js
  // Extiende TeamBrain de Fase 18 para aplicar tácticas.
  // Modifica: presión, formación, roles, desmarques.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  var AttributeModifier = null;

  function TeamBrainWithTactics(teamIndex, attackingRight, tacticsPlan) {
    var TB = window.FMG.Phase18.TeamBrain;
    TB.call(this, teamIndex, attackingRight);  // herencia

    this.tacticsPlan = tacticsPlan || null;
    this._attributeModifier = null;
  }

  // Herencia prototípica
  TeamBrainWithTactics.prototype = Object.create(window.FMG.Phase18.TeamBrain.prototype);
  TeamBrainWithTactics.prototype.constructor = TeamBrainWithTactics;

  TeamBrainWithTactics.prototype.init = function () {
    window.FMG.Phase18.TeamBrain.prototype.init.call(this);  // init padre
    if (!AttributeModifier) AttributeModifier = window.FMG.Phase24.AttributeModifier;
    this._attributeModifier = new AttributeModifier();
  };

  // Override: tick con aplicación de tácticas
  TeamBrainWithTactics.prototype.tick = function (players, rivals, ball, match, tick) {
    // Aplicar tácticas antes de correr IA
    if (this.tacticsPlan) {
      this._applyFormationModifiers(players);
      this._applyRoleModifiers(players);
      this._applyInstructionModifiers(players);
    }

    // Correr IA de Fase 18
    window.FMG.Phase18.TeamBrain.prototype.tick.call(this, players, rivals, ball, match, tick);
  };

  // Aplicar modificadores de formación
  TeamBrainWithTactics.prototype._applyFormationModifiers = function (players) {
    if (!this.tacticsPlan || !this.tacticsPlan.formation) return;

    var C = window.FMG.Phase16.C;

    // Ajustar posiciones base según mentalidad
    var mentalityOffset = 1.0;
    if (this.tacticsPlan.mentality === "attacking") {
      mentalityOffset = 1.15;  // subir más hacia arriba
    } else if (this.tacticsPlan.mentality === "defensive") {
      mentalityOffset = 0.85;  // retroceder
    }

    // También afecta línea defensiva
    if (this.tacticsPlan.defensiveLine === "high") {
      mentalityOffset *= 1.1;
    } else if (this.tacticsPlan.defensiveLine === "deep") {
      mentalityOffset *= 0.9;
    }

    // Guardar offset para que FormationSystem lo use
    players._formationOffset = mentalityOffset;
  };

  // Aplicar roles a los jugadores
  TeamBrainWithTactics.prototype._applyRoleModifiers = function (players) {
    if (!this.tacticsPlan || !this.tacticsPlan.playerRoles) return;

    var self = this;
    players.forEach(function (player, idx) {
      var position = getPositionFromSlot(idx);
      var role = self.tacticsPlan.playerRoles[position];

      if (role) {
        player._tacticRole = role;

        // Modificar parámetros de IA según rol
        var aggMod = self._attributeModifier.getAggressionModifier(player, role);
        player._roleAggression = aggMod;
      }
    });
  };

  // Aplicar instrucciones individuales
  TeamBrainWithTactics.prototype._applyInstructionModifiers = function (players) {
    if (!this.tacticsPlan || !this.tacticsPlan.instructions) return;

    var self = this;
    players.forEach(function (player) {
      var instr = self.tacticsPlan.instructions[player.id];
      if (instr) {
        player._instruction = instr;
      }
    });
  };

  function getPositionFromSlot(slotIndex) {
    if (slotIndex === 0) return "POR";
    if (slotIndex <= 4) return "DEF";
    if (slotIndex <= 7) return "MED";
    if (slotIndex <= 9) return "EXT";
    return "DEL";
  }

  window.FMG.Phase24.TeamBrainWithTactics = TeamBrainWithTactics;
})();
