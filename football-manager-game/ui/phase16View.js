(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  // ============================================================
  // FASE 16 — Vista integrada al SPA
  // ============================================================

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }

    const C = FMG.Phase16.C;
    container.innerHTML =
      '<canvas id="p16-canvas" width="' + C.FIELD_W + '" height="' + C.FIELD_H + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';

    const canvas = container.querySelector("#p16-canvas");
    _game = FMG.Phase16.create(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase16View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 16 — Framework Modular</h2>
          <span class="chip">8 sistemas independientes</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          InputSystem · BallSystem · MatchSystem · AISystem · AnimationSystem · CameraSystem · HUDSystem · AudioSystem
        </p>
        <div id="p16-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#1a3a1a;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary"  data-action="p16-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost"    data-action="p16-pause">Pausa / Reanudar</button>
          <button class="btn-ghost"    data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase16Action = function (action) {
    if (action === "p16-start") {
      const m = document.querySelector("#p16-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p16-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase16 = unmount;
})();
