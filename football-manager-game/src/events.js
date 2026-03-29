(function () {
  const FMG = (window.FMG = window.FMG || {});

  const eventPool = [
    {
      title: "Sponsor sorpresa",
      execute(state) {
        const amount = FMG.randomInt(7000000, 18000000);
        FMG.registerFinanceEntry(state.finances, "income", "Bono extraordinario de sponsor", amount);
        return `Un sponsor regional activo una bonificacion por ${amount.toLocaleString("es-CL")} CLP.`;
      }
    },
    {
      title: "Lesion menor",
      execute(state) {
        const squad = state.players.filter((player) => player.teamId === state.userClub.id);
        const player = FMG.sample(squad);
        player.energy = FMG.clamp(player.energy - 18, 25, 100);
        player.morale = FMG.clamp(player.morale - 6, 35, 100);
        return `${player.name} termino con una molestia muscular y baja su energia.`;
      }
    },
    {
      title: "Semana de entrenamiento",
      execute(state) {
        const squad = state.players.filter((player) => player.teamId === state.userClub.id);
        squad.forEach((player) => {
          player.energy = FMG.clamp(player.energy + 6, 0, 100);
          player.morale = FMG.clamp(player.morale + 4, 0, 100);
        });
        return "La plantilla respondio muy bien a la semana de entrenamiento y subio el animo general.";
      }
    },
    {
      title: "Venta de camisetas",
      execute(state) {
        const amount = FMG.randomInt(3000000, 9000000);
        FMG.registerFinanceEntry(state.finances, "income", "Merchandising destacado", amount);
        return `La tienda oficial vendio por encima de lo esperado y sumo ${amount.toLocaleString("es-CL")} CLP.`;
      }
    },
    {
      title: "Premio interno",
      execute(state) {
        const amount = -FMG.randomInt(2000000, 7000000);
        FMG.registerFinanceEntry(state.finances, "expense", "Premio por rendimiento", amount);
        return "El directorio autorizo un premio interno para sostener la competitividad del plantel.";
      }
    }
  ];

  FMG.applyWeeklyEvent = function (state) {
    if (Math.random() > 0.55) return null;
    const event = FMG.sample(eventPool);
    const detail = event.execute(state);
    const log = { week: state.currentWeek, title: event.title, detail };
    state.eventsLog.unshift(log);
    state.eventsLog = state.eventsLog.slice(0, 12);
    return log;
  };
})();
