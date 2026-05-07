(function () {
  "use strict";

  // ============================================================
  // FASE 16 — InputSystem
  // Responsabilidad: capturar y exponer estado del teclado.
  // No conoce jugadores, balon ni cancha.
  // ============================================================

  const PREVENT_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

  function InputSystem() {
    this._keys = {};
    this._onDown = null;
    this._onUp = null;
    this._onRestart = null; // callback externo para reinicio
  }

  InputSystem.prototype.bind = function (onRestartCb) {
    this._onRestart = onRestartCb || null;
    const self = this;

    this._onDown = function (e) {
      self._keys[e.key] = true;
      if (PREVENT_KEYS.has(e.key)) e.preventDefault();
    };

    this._onUp = function (e) {
      self._keys[e.key] = false;
    };

    document.addEventListener("keydown", this._onDown);
    document.addEventListener("keyup",   this._onUp);
  };

  InputSystem.prototype.unbind = function () {
    if (this._onDown) document.removeEventListener("keydown", this._onDown);
    if (this._onUp)   document.removeEventListener("keyup",   this._onUp);
    this._onDown = null;
    this._onUp   = null;
    this._keys   = {};
  };

  // Consultas de estado — el resto del sistema llama estos métodos
  InputSystem.prototype.isDown   = function (key) { return !!this._keys[key]; };
  InputSystem.prototype.isDirUp  = function () { return this.isDown("ArrowUp")    || this.isDown("w"); };
  InputSystem.prototype.isDirDown= function () { return this.isDown("ArrowDown")  || this.isDown("s"); };
  InputSystem.prototype.isDirLeft= function () { return this.isDown("ArrowLeft")  || this.isDown("a"); };
  InputSystem.prototype.isDirRight=function () { return this.isDown("ArrowRight") || this.isDown("d"); };
  InputSystem.prototype.isPass   = function () { return this.isDown("z") || this.isDown("j"); };
  InputSystem.prototype.isLongPass = function () { return this.isDown(" ") || this.isDown("l") || this.isDown("L"); };
  InputSystem.prototype.isShoot  = function () { return this.isDown("x") || this.isDown("k"); };
  InputSystem.prototype.isSprint = function () { return this.isDown("Shift"); };
  InputSystem.prototype.isTackle = function () { return this.isDown("c") || this.isDown("C"); };
  InputSystem.prototype.isSwitch = function () { return this.isDown("q") || this.isDown("Q") || this.isDown("e") || this.isDown("E"); };
  InputSystem.prototype.isPause  = function () { return this.isDown("p") || this.isDown("P"); };
  InputSystem.prototype.isRestart= function () { return this.isDown("r") || this.isDown("R"); };

  // Consumir tecla de accion (evita disparo continuo)
  InputSystem.prototype.consume = function (key) { this._keys[key] = false; };

  window.FMG.Phase16.InputSystem = InputSystem;
})();
