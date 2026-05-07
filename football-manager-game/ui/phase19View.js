(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }
    const C = FMG.Phase16.C;
    container.innerHTML =
      '<canvas id="p19-canvas" width="' + C.FIELD_W + '" height="' + C.FIELD_H + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p19-canvas");
    _game = FMG.Phase19.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase19View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 19 — Porteros</h2>
          <span class="chip">Posicionamiento · Atajadas · Saques · Error por atributo</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Salida a achicar · Atajada lateral · Atajada alta · Despeje · Saque corto/largo · Fake magnetizado
        </p>
        <div id="p19-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#1a3a1a;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p19-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost"   data-action="p19-pause">Pausa / Reanudar</button>
          <button class="btn-ghost"   data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase19Action = function (action) {
    if (action === "p19-start") {
      const m = document.querySelector("#p19-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p19-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase19 = unmount;
})();
