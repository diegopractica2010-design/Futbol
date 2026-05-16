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
        player.injuredWeeks = Math.max(player.injuredWeeks || 0, 1);
        player.energy = FMG.clamp(player.energy - 18, 25, 100);
        player.morale = FMG.clamp(player.morale - 6, 35, 100);
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.injuries += 1;
        player.injuryHistory = player.injuryHistory || [];
        player.injuryHistory.unshift({ week: state.currentWeek, duration: 1, detail: "Molestia muscular en entrenamiento" });
        player.injuryHistory = player.injuryHistory.slice(0, 8);
        player.moraleReason = "Molestia muscular";
        FMG.autoSelectLineup(state, state.userTeamId);
        return `${player.name} termino con una molestia muscular y estara una semana fuera.`;
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
    },
    {
      title: "Reunion de referentes",
      execute(state) {
        const leaders = state.players.filter((player) => player.teamId === state.userClub.id && !player.retired).sort((left, right) => (right.leadership || 50) - (left.leadership || 50)).slice(0, 3);
        leaders.forEach((player) => {
          player.morale = FMG.clamp(player.morale + 3, 0, 100);
          player.happiness = FMG.clamp((player.happiness || 55) + 2, 0, 100);
        });
        return `${leaders.map((player) => player.name).join(", ")} lideraron una reunion para ordenar el vestuario.`;
      }
    },
    {
      title: "Filtracion de prensa",
      execute(state) {
        const player = FMG.sample(state.players.filter((item) => item.teamId === state.userClub.id && !item.retired));
        player.happiness = FMG.clamp((player.happiness || 55) - 5, 0, 100);
        player.moraleReason = "Filtracion en prensa";
        if (state.career?.relations) state.career.relations.press = FMG.clamp(state.career.relations.press - 4, 0, 100);
        return `Una filtracion sobre el rol de ${player.name} incomodo al plantel y bajo su felicidad a ${player.happiness}/100.`;
      }
    },
    {
      title: "Promesa juvenil",
      execute(state) {
        const prospect = state.players.filter((player) => player.teamId === state.userClub.id && !player.retired && player.age <= 23).sort((left, right) => (right.potential || right.overall) - (left.potential || left.overall))[0];
        if (!prospect) return "El area formativa no encontro juveniles listos para subir exigencia esta semana.";
        prospect.morale = FMG.clamp(prospect.morale + 5, 0, 100);
        prospect.happiness = FMG.clamp((prospect.happiness || 55) + 4, 0, 100);
        return `${prospect.name} recibio elogios internos por su potencial ${prospect.potential || prospect.overall} y empuja por mas minutos.`;
      }
    },
    {
      title: "Viaje exigente",
      execute(state) {
        const squad = state.players.filter((player) => player.teamId === state.userClub.id && !player.retired);
        squad.forEach((player) => {
          player.energy = FMG.clamp(player.energy - 4, 0, 100);
        });
        return `${state.userClub.name} tuvo una semana logistica pesada y el plantel perdio energia antes de la fecha.`;
      }
    }
  ];

  FMG.applyWeeklyEvent = function (state) {
    if (FMG.rng() > 0.55) return null;
    const event = FMG.sample(eventPool);
    const detail = event.execute(state);
    const log = { week: state.currentWeek, title: event.title, detail };
    state.eventsLog.unshift(log);
    state.eventsLog = state.eventsLog.slice(0, 12);
    return log;
  };
})();
