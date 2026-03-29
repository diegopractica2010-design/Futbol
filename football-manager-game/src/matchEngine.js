import { average, clamp, randomInt, sample } from "./utils.js";

function ratingFromSquad(players) {
  const starters = [...players].sort((left, right) => right.overall - left.overall).slice(0, 11);
  const quality = average(starters.map((player) => player.overall));
  const morale = average(starters.map((player) => player.morale));
  const energy = average(starters.map((player) => player.energy));
  return quality * 0.58 + morale * 0.22 + energy * 0.2;
}

function createGoalEvents(goals, squad) {
  if (goals === 0 || !squad.length) return [];
  return Array.from({ length: goals }, (_, index) => {
    const scorer = sample(squad.filter((player) => ["DEL", "MED", "EXT"].includes(player.position)) || squad);
    return {
      minute: randomInt(6, 89),
      scorer: scorer?.name || `Jugador ${index + 1}`
    };
  }).sort((left, right) => left.minute - right.minute);
}

export function computeTeamStrength(team, players) {
  const squad = players.filter((player) => player.teamId === team.id);
  const base = ratingFromSquad(squad);
  const tacticalBonus = team.style === "Presion" ? 3 : team.style === "Posesion" ? 2 : 1;
  return base + tacticalBonus + team.form * 0.6;
}

export function simulateMatch({ homeTeam, awayTeam, players }) {
  const homePlayers = players.filter((player) => player.teamId === homeTeam.id);
  const awayPlayers = players.filter((player) => player.teamId === awayTeam.id);
  const homeStrength = computeTeamStrength(homeTeam, players) + 4;
  const awayStrength = computeTeamStrength(awayTeam, players);

  let homeGoals = clamp(Math.round((homeStrength - 48) / 12) + randomInt(0, 2), 0, 5);
  let awayGoals = clamp(Math.round((awayStrength - 50) / 12) + randomInt(0, 2), 0, 5);

  if (Math.abs(homeStrength - awayStrength) < 4 && Math.random() > 0.56) {
    homeGoals = clamp(homeGoals - 1, 0, 4);
    awayGoals = clamp(awayGoals - 1, 0, 4);
  }

  if (homeStrength - awayStrength > 8 && Math.random() > 0.45) homeGoals = clamp(homeGoals + 1, 0, 5);
  if (awayStrength - homeStrength > 8 && Math.random() > 0.45) awayGoals = clamp(awayGoals + 1, 0, 5);

  homePlayers.forEach((player) => {
    player.energy = clamp(player.energy - randomInt(4, 10), 42, 100);
    player.morale = clamp(player.morale + (homeGoals >= awayGoals ? 2 : -2), 45, 100);
  });
  awayPlayers.forEach((player) => {
    player.energy = clamp(player.energy - randomInt(4, 10), 42, 100);
    player.morale = clamp(player.morale + (awayGoals >= homeGoals ? 2 : -2), 45, 100);
  });

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeGoals,
    awayGoals,
    homeEvents: createGoalEvents(homeGoals, homePlayers),
    awayEvents: createGoalEvents(awayGoals, awayPlayers),
    summary:
      homeGoals === awayGoals
        ? "Partido equilibrado con reparto de puntos."
        : homeGoals > awayGoals
          ? `${homeTeam.name} impuso su ritmo y fue mas efectivo.`
          : `${awayTeam.name} golpeo en los momentos clave.`
  };
}
