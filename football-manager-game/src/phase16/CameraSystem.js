(function () {
  "use strict";

  // ============================================================
  // FASE 16 — CameraSystem
  // Responsabilidad: escala responsive del canvas al contenedor.
  // Centraliza la transformacion coordenadas-juego -> canvas.
  // ============================================================

  const C = window.FMG.Phase16.C;

  function CameraSystem(canvas) {
    this.canvas  = canvas;
    this.scaleX  = 1;
    this.scaleY  = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._update();
  }

  CameraSystem.prototype._update = function () {
    const container = this.canvas.parentElement;
    if (!container) return;

    const maxW = container.clientWidth || C.FIELD_W;
    const scale = Math.min(1, maxW / C.FIELD_W);

    this.canvas.style.width  = Math.floor(C.FIELD_W * scale) + "px";
    this.canvas.style.height = Math.floor(C.FIELD_H * scale) + "px";

    this.scaleX  = scale;
    this.scaleY  = scale;
  };

  // Llamar al redimensionar ventana
  CameraSystem.prototype.onResize = function () {
    this._update();
  };

  // Convierte coordenadas de pantalla a coordenadas de juego (para clicks futuros)
  CameraSystem.prototype.toGame = function (screenX, screenY) {
    return {
      x: screenX / this.scaleX,
      y: screenY / this.scaleY
    };
  };

  window.FMG.Phase16.CameraSystem = CameraSystem;
})();
