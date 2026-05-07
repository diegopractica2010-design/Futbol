(function () {
  "use strict";
  const FMG = (window.FMG = window.FMG || {});

  // ============================================================
  // FASE 15 — Vista integrada al SPA
  // ============================================================

  let _loopId = null;
  let _state = null;
  let _canvas = null;
  let _ctx = null;

  function stopLoop() {
    if (_loopId) { cancelAnimationFrame(_loopId); _loopId = null; }
  }

  function startLoop() {
    stopLoop();
    const { tick, render } = FMG.Phase15;
    let last = 0;
    const TICK = 1000 / 60;

    function loop(ts) {
      _loopId = requestAnimationFrame(loop);
      if (ts - last >= TICK) {
        last = ts;
        tick(_state);
        render(_ctx, _state);
      }
    }
    _loopId = requestAnimationFrame(loop);
  }

  function bindKeys(state) {
    function onDown(e) {
      state.keys[e.key] = true;
      if (e.key === "p" || e.key === "P") state.paused = !state.paused;
      if ((e.key === "r" || e.key === "R") && state.finished) {
        Object.assign(state, FMG.Phase15.makeState());
        state.running = true;
      }
      // Evitar scroll con flechas
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
        e.preventDefault();
      }
    }
    function onUp(e) { state.keys[e.key] = false; }
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    // Guardar referencias para limpiar al salir
    state._onDown = onDown;
    state._onUp = onUp;
  }

  function unbindKeys(state) {
    if (state && state._onDown) {
      document.removeEventListener("keydown", state._onDown);
      document.removeEventListener("keyup", state._onUp);
    }
  }

  function mountGame(container) {
    stopLoop();
    unbindKeys(_state);

    _state = FMG.Phase15.makeState();
    _state.running = true;

    const { FIELD } = FMG.Phase15;
    container.innerHTML = `
      <canvas id="p15-canvas" width="${FIELD.w}" height="${FIELD.h}"
        style="display:block;max-width:100%;border-radius:8px;cursor:default;"></canvas>
    `;

    _canvas = container.querySelector("#p15-canvas");
    _ctx = _canvas.getContext("2d");

    bindKeys(_state);
    startLoop();
  }

  function unmount() {
    stopLoop();
    unbindKeys(_state);
    _state = null;
    _canvas = null;
    _ctx = null;
  }

  FMG.renderPhase15View = function () {
    return `
      <section class="card">
        <div class="section-title">
          <h2>Fase 15 — Partido Jugable</h2>
          <span class="chip">Vertical Slice</span>
        </div>
        <p class="muted" style="margin-bottom:16px;">
          Controla al jugador azul más cercano al balón. 1 minuto de partido real.
        </p>
        <div id="p15-mount" style="width:100%;overflow:hidden;border-radius:8px;background:#1a3a1a;"></div>
        <div class="button-row" style="margin-top:14px;">
          <button class="btn-primary" data-action="p15-start">Iniciar / Reiniciar</button>
          <button class="btn-ghost" data-action="p15-pause">Pausa / Reanudar</button>
          <button class="btn-ghost" data-action="change-route" data-route="dashboard">Volver</button>
        </div>
        <div class="log-item" style="margin-top:14px;">
          <strong>Controles</strong>
          <p class="muted">Mover: WASD o Flechas &nbsp;|&nbsp; Pase: Z o J &nbsp;|&nbsp; Tiro: X o K &nbsp;|&nbsp; Pausa: P &nbsp;|&nbsp; Reiniciar: R</p>
        </div>
      </section>
    `;
  };

  // Acciones del SPA para esta vista
  FMG.handlePhase15Action = function (action) {
    if (action === "p15-start") {
      const mount = document.querySelector("#p15-mount");
      if (mount) mountGame(mount);
      return true; // consumido, no re-renderizar
    }
    if (action === "p15-pause") {
      if (_state) _state.paused = !_state.paused;
      return true; // consumido
    }
    // Para cualquier otra accion (change-route, etc.) no consumir
    return false;
  };

  FMG.unmountPhase15 = unmount;
})();
