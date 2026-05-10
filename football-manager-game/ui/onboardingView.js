(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderOnboardingView = function () {
    return `
      <section class="panel onboarding-view">
        <span class="eyebrow">Primer ingreso</span>
        <h1 class="hero-title">Football Manager Chile</h1>
        <div class="content-grid" style="margin-top:18px;">
          <article class="log-item"><strong>1. Elige tu club</strong><p class="muted">Los grandes tienen mas presupuesto, pero tambien mas presion del directorio.</p></article>
          <article class="log-item"><strong>2. Decide cada semana</strong><p class="muted">Puedes simular partidos o jugarlos en vivo. Las decisiones tacticas importan.</p></article>
          <article class="log-item"><strong>3. Sostiene el proyecto</strong><p class="muted">Finanzas, mercado y vestuario definen si peleas arriba o entras en crisis.</p></article>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" data-action="finish-onboarding">Elegir club</button>
          <button class="btn-secondary" data-action="import-save-start">Tengo un archivo guardado</button>
        </div>
      </section>
    `;
  };
})();
