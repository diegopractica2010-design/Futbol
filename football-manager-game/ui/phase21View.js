(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  let _game = null;

  function mount(container) {
    if (_game) { _game.dispose(); _game = null; }
    const C  = FMG.Phase16.C;
    const M  = FMG.Phase21.StadiumRenderer.MARGIN;
    const tw = C.FIELD_W + M.left + M.right;
    const th = C.FIELD_H + M.top  + M.bottom;
    container.innerHTML =
      '<canvas id="p21-canvas" width="' + tw + '" height="' + th + '" ' +
      'style="display:block;max-width:100%;border-radius:8px;"></canvas>';
    const canvas = container.querySelector("#p21-canvas");
    _game = FMG.Phase21.createGame(canvas);
    _game.input.bind();
    _game.start();
  }

  function unmount() {
    if (_game) { _game.dispose(); _game = null; }
  }

  FMG.renderPhase21View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 21 — Estadio y Presentación Visual</h2>
          <span class="chip">Césped · Arcos · Gradas · Publicidad · Banderas</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Césped con textura procedural · Normal map falso · Arcos 3D falso con redes · Público impostor · Banderas animadas · Publicidad lateral · Iluminación baked
        </p>
        <div id="p21-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#050a14;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p21-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost"   data-action="p21-pause">Pausa / Reanudar</button>
          <button class="btn-ghost"   data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD / Flechas &nbsp;|&nbsp; Sprint: Shift &nbsp;|&nbsp; Cambio: Q/E &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Pase largo: Espacio/L &nbsp;|&nbsp; Entrada: C &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  FMG.handlePhase21Action = function (action) {
    if (action === "p21-start") {
      const m = document.querySelector("#p21-mount");
      if (m) mount(m);
      return true;
    }
    if (action === "p21-pause") {
      if (_game) _game.match.paused = !_game.match.paused;
      return true;
    }
    return false;
  };

  FMG.unmountPhase21 = unmount;
})();
