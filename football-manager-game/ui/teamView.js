import { currency } from "../src/utils.js";

export function renderTeamView(state) {
  const squad = state.players.filter((player) => player.teamId === state.userTeamId).sort((left, right) => right.overall - left.overall);
  return `
    <section class="card">
      <div class="section-title"><h2>Plantilla profesional</h2><span class="chip">${squad.length} jugadores</span></div>
      <div class="list">
        ${squad.map((player) => `
          <article class="list-row">
            <div>
              <strong>${player.name}</strong>
              <div class="meta">
                <span>${player.position}</span><span>${player.age} anos</span><span>OVR ${player.overall}</span><span>Salario ${currency(player.salary)}</span>
              </div>
            </div>
            <div>
              <div class="muted">Energia</div>
              <div class="energy-bar"><span style="width:${player.energy}%"></span></div>
            </div>
            <div>
              <div class="muted">Moral</div>
              <div class="morale-bar"><span style="width:${player.morale}%"></span></div>
              <div class="button-row" style="margin-top:10px;">
                <button class="btn-danger" data-action="sell-player" data-player-id="${player.id}">Vender</button>
              </div>
            </div>
          </article>`).join("")}
      </div>
    </section>
  `;
}
