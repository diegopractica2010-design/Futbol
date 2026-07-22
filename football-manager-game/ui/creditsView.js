(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderCreditsView = function () {
    return `
      <section class="panel">
        <span class="eyebrow">Version ${FMG.CURRENT_VERSION}</span>
        <h1 class="hero-title">Creditos</h1>
        <p class="hero-copy">Football Manager Chile es un simulador local en JavaScript, empaquetado con Vite. Guarda todo en tu navegador mediante localStorage y no envia datos a servidores.</p>
        <div class="content-grid" style="margin-top:18px;">
          <article class="card"><h2>Equipo</h2><p class="muted">Desarrollo, simulacion y direccion de producto: proyecto Football Manager Chile.</p></article>
          <article class="card"><h2>Agradecimientos</h2><p class="muted">A la cultura futbolera chilena y a los clubes representados en esta version jugable.</p></article>
          <article class="card"><h2>Ejecucion local</h2><p class="muted">Instala dependencias con <code>npm install</code> y levanta el juego con <code>npm run dev</code>.</p></article>
          <article class="card"><h2>Soporte</h2><p class="muted"><a href="mailto:bugs@footballmanagerchile.local">Reportar bugs</a></p></article>
        </div>
      </section>
    `;
  };
})();
