export function createInitialStandings(teams) {
  return teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  }));
}

export function updateStandings(standings, result) {
  const home = standings.find((entry) => entry.teamId === result.homeTeamId);
  const away = standings.find((entry) => entry.teamId === result.awayTeamId);

  home.played += 1;
  away.played += 1;
  home.goalsFor += result.homeGoals;
  home.goalsAgainst += result.awayGoals;
  away.goalsFor += result.awayGoals;
  away.goalsAgainst += result.homeGoals;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (result.homeGoals > result.awayGoals) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (result.homeGoals < result.awayGoals) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
}

export function sortStandings(standings) {
  return [...standings].sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
    if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
    return left.name.localeCompare(right.name, "es");
  });
}
