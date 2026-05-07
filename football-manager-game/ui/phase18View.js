(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }

    const C = FMG.Phase16.C;
    container.innerHTML =
      '<canvas id="p18-canvas" width="' + C.FIELD_W + '" height="' + C.FIELD_H + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';

    const canvas = container.querySelector("#p18-canvas");
    _game = FMG.Phase18.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase18View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 18 — IA de Partido</h2>
          <span class="chip">Formación · Marcaje · Presión · Desmarque</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          21 jugadores con roles, formación dinámica, árbol de decisión y LOD de IA.
        </p>
        <div id="p18-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#1a3a1a;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p18-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost"   data-action="p18-pause">Pausa / Reanudar</button>
          <button class="btn-ghost"   data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase18Action = function (action) {
    if (action === "p18-start") {
      const m = document.querySelector("#p18-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p18-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase18 = unmount;
})();
