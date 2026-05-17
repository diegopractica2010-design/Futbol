(function () {
  "use strict";

  // ============================================================
  // FASE 19 — GoalkeeperBrain.js
  // Logica exclusiva del portero.
  // Responsabilidades:
  //   - Posicionamiento base (entre arco y balon)
  //   - Salida a achicar angulo
  //   - Decidir si intentar atajar (delega a SaveSystem)
  //   - Saque corto / largo tras atajar
  // No dibuja. No conoce canvas.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase19 = window.FMG.Phase19 || {};

  var C = null;
  function rng() { return window.FMG && window.FMG.randomFloat ? window.FMG.randomFloat("phase19-goalkeeper") : 0.5; }

  // Zona de peligro: distancia al arco en la que el portero actua
  var DANGER_DIST   = 160;  // px — zona donde el portero sale
  var RUSH_DIST     = 60;   // px — zona donde sale a achicar
  var SAVE_ZONE_X   = 55;   // px desde la linea de gol donde el portero puede atajar

  // Atributo de portero: 0=malo, 1=excelente
  // Afecta probabilidad de atajar y precision de saque
  var DEFAULT_ATTR  = 0.72;

  // Estados del portero
  var GK_STATE = {
    POSITION: "position",   // posicionamiento normal
    RUSH:     "rush",       // salida a achicar
    SAVE:     "save",       // atajando
    THROW:    "throw",      // saque corto
    PUNT:     "punt",       // saque largo
    RECOVER:  "recover"     // recuperandose tras atajar
  };

  function GoalkeeperBrain(attackingRight, attribute) {
    this.attackingRight = attackingRight;
    this.attribute      = (attribute !== undefined) ? attribute : DEFAULT_ATTR;
    this.state          = GK_STATE.POSITION;
    this.stateTimer     = 0;   // ticks en estado actual
    this.saveResult     = null; // "saved" | "error" | null
    this.lastSaveZone   = null; // zona de la ultima atajada (para animacion)
  }

  // Calcular posicion base del portero
  GoalkeeperBrain.prototype._basePos = function (ball) {
    if (!C) C = window.FMG.Phase16.C;

    var lineX   = this.attackingRight ? C.PLAYER_R + 18 : C.FIELD_W - C.PLAYER_R - 18;
    var goalY   = C.FIELD_H / 2;
    var goalTop = (C.FIELD_H - C.GOAL_H) / 2;
    var goalBot = goalTop + C.GOAL_H;

    // Seguir el balon verticalmente, limitado al ancho del arco
    var trackY = goalY + (ball.y - goalY) * 0.6;
    trackY = Math.max(goalTop + C.PLAYER_R, Math.min(goalBot - C.PLAYER_R, trackY));

    return { x: lineX, y: trackY };
  };

  // Calcular posicion de salida a achicar (bisectriz del angulo)
  GoalkeeperBrain.prototype._rushPos = function (ball) {
    if (!C) C = window.FMG.Phase16.C;

    var lineX = this.attackingRight ? C.PLAYER_R + 18 : C.FIELD_W - C.PLAYER_R - 18;
    var goalY = C.FIELD_H / 2;

    // Avanzar hacia el balon hasta SAVE_ZONE_X desde la linea
    var maxAdvance = this.attackingRight
      ? lineX + SAVE_ZONE_X
      : lineX - SAVE_ZONE_X;

    var dx = ball.x - lineX;
    var dy = ball.y - goalY;
    var len = Math.hypot(dx, dy) || 1;

    // Avanzar proporcionalmente, sin pasar de maxAdvance
    var advance = Math.min(Math.abs(dx) * 0.45, SAVE_ZONE_X * 0.8);
    var rushX = this.attackingRight
      ? lineX + advance
      : lineX - advance;

    var rushY = goalY + (dy / len) * advance * 0.5;
    rushY = Math.max(C.PLAYER_R, Math.min(C.FIELD_H - C.PLAYER_R, rushY));

    return { x: rushX, y: rushY };
  };

  // Determinar zona de atajada segun posicion del balon relativa al arco
  GoalkeeperBrain.prototype._saveZone = function (ball) {
    if (!C) C = window.FMG.Phase16.C;
    var goalY   = C.FIELD_H / 2;
    var goalTop = (C.FIELD_H - C.GOAL_H) / 2;
    var dy      = ball.y - goalY;
    var relY    = dy / (C.GOAL_H / 2); // -1=arriba, 0=centro, 1=abajo

    if (relY < -0.45) return "high-left";
    if (relY >  0.45) return "high-right";
    if (Math.abs(relY) < 0.2) return "center";
    return relY < 0 ? "dive-left" : "dive-right";
  };

  // Tick principal — devuelve { targetX, targetY, speed, state, saveZone }
  GoalkeeperBrain.prototype.tick = function (gkPlayer, ball, saveSystem) {
    if (!C) C = window.FMG.Phase16.C;

    var b        = ball.ball;
    var ballDist = ball.distTo(gkPlayer);
    var ballSpeed = Math.hypot(b.vx, b.vy);

    this.stateTimer++;

    // ---- Maquina de estados ----

    switch (this.state) {

      case GK_STATE.RECOVER:
        // Recuperarse durante 30 ticks tras atajar
        if (this.stateTimer > 30) {
          this.state      = GK_STATE.POSITION;
          this.stateTimer = 0;
          this.saveResult = null;
        }
        return this._basePos(b);

      case GK_STATE.SAVE:
        // Atajando: el SaveSystem maneja el balon
        if (this.stateTimer > 18) {
          this.state      = GK_STATE.RECOVER;
          this.stateTimer = 0;
        }
        return { x: gkPlayer.x, y: gkPlayer.y, speed: 0, state: this.state, saveZone: this.lastSaveZone };

      case GK_STATE.THROW:
      case GK_STATE.PUNT:
        if (this.stateTimer > 20) {
          this.state      = GK_STATE.POSITION;
          this.stateTimer = 0;
        }
        return this._basePos(b);

      default: // POSITION y RUSH
        break;
    }

    // ---- Decidir estado ----

    // Balon viene hacia el arco con velocidad y esta en zona de peligro
    var comingToGoal = this.attackingRight
      ? b.vx < -1.5 && b.x < C.FIELD_W * 0.35
      : b.vx >  1.5 && b.x > C.FIELD_W * 0.65;

    if (comingToGoal && ballDist < DANGER_DIST) {
      // Intentar atajar
      var zone   = this._saveZone(b);
      var saved  = saveSystem.attempt(gkPlayer, ball, zone, this.attribute);

      if (saved !== null) {
        this.state        = GK_STATE.SAVE;
        this.stateTimer   = 0;
        this.saveResult   = saved ? "saved" : "error";
        this.lastSaveZone = zone;

        // Tras atajar: decidir saque
        if (saved) {
          this.state = rng() < 0.6 ? GK_STATE.THROW : GK_STATE.PUNT;
          this.stateTimer = 0;
        }
        return { x: gkPlayer.x, y: gkPlayer.y, speed: 0, state: this.state, saveZone: zone };
      }
    }

    // Salida a achicar si el balon esta muy cerca
    if (ballDist < RUSH_DIST) {
      this.state = GK_STATE.RUSH;
      var rp = this._rushPos(b);
      return { x: rp.x, y: rp.y, speed: 1.1, state: this.state, saveZone: null };
    }

    // Posicionamiento normal
    this.state = GK_STATE.POSITION;
    var bp = this._basePos(b);
    return { x: bp.x, y: bp.y, speed: 0.75, state: this.state, saveZone: null };
  };

  GoalkeeperBrain.GK_STATE = GK_STATE;
  window.FMG.Phase19.GoalkeeperBrain = GoalkeeperBrain;
})();
