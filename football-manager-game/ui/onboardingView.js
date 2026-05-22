(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderOnboardingView = function () {
    return `
      <section class="game-entry">
        <div class="game-entry__hero">
          <span class="eyebrow">FM Chile 26</span>
          <h1 class="hero-title">El futbol chileno, en tus manos</h1>
          <p class="hero-copy">Elige si quieres dirigir un club completo o crear tu propio futbolista. Mercado, vestuario, prensa, tabla, carrera y partido en vivo conviven en una sola experiencia.</p>
          <div class="chips">
            <span class="chip">Modo Manager</span>
            <span class="chip">Carrera Jugador</span>
            <span class="chip">Partido en vivo</span>
            <span class="chip">Temporadas completas</span>
          </div>
        </div>

        <div class="mode-select-grid">
          <article class="mode-card mode-card--manager">
            <span class="eyebrow">Manager</span>
            <h2>Dirige el club</h2>
            <p class="muted">Toma decisiones de plantilla, mercado, finanzas, prensa y tactica. Cada resultado mueve la tabla, el vestuario y la confianza del directorio.</p>
            <div class="mode-card__features">
              <span>Fichajes</span>
              <span>Tacticas</span>
              <span>Visualizador 3D</span>
              <span>Drama semanal</span>
            </div>
            <button class="btn-primary" data-action="finish-onboarding">Empezar como manager</button>
          </article>

          <article class="mode-card mode-card--player">
            <span class="eyebrow">Jugador</span>
            <h2>Crea tu carrera</h2>
            <p class="muted">Crea un futbolista, entrena atributos, gana minutos, responde al DT y escucha a tu agente. Es un modo separado de la partida de manager.</p>
            <div class="mode-card__features">
              <span>Crear jugador</span>
              <span>Entrenamientos</span>
              <span>Confianza DT</span>
              <span>Mercado</span>
            </div>
            <button class="btn-primary" data-action="start-player-career">Empezar carrera jugador</button>
          </article>
        </div>

        <div class="hero-actions">
          <button class="btn-secondary" data-action="import-save-start">Cargar partida guardada</button>
        </div>
      </section>
    `;
  };
})();
