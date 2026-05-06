const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) {
    this.data[key] = value;
  },
  getItem(key) {
    return this.data[key] || null;
  }
};

[
  "src/utils.js",
  "src/gameState.js",
  "src/table.js",
  "src/squad.js",
  "src/matchEngine.js",
  "src/finances.js",
  "src/events.js",
  "src/transfers.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 4, "fase 4 debe usar estado versionado desde 4");

const defaultPlan = FMG.getTeamPlan(FMG.gameState, "colo-colo");
assert.equal(defaultPlan.mentality, "balanced", "debe migrar mentalidad por defecto");
assert.equal(defaultPlan.pressing, "medium", "debe migrar presion por defecto");
assert.equal(defaultPlan.playerRoles.DEF, "defensive", "debe crear roles por posicion");

assert.equal(FMG.setTeamTactic(FMG.gameState, "mentality", "attacking").ok, true, "debe cambiar mentalidad");
assert.equal(FMG.setTeamTactic(FMG.gameState, "pressing", "high").ok, true, "debe cambiar presion");
assert.equal(FMG.setTeamTactic(FMG.gameState, "tempo", "fast").ok, true, "debe cambiar ritmo");
assert.equal(FMG.setTeamTactic(FMG.gameState, "passing", "direct").ok, true, "debe cambiar pase");
assert.equal(FMG.setTeamTactic(FMG.gameState, "width", "wide").ok, true, "debe cambiar anchura");
assert.equal(FMG.setTeamTactic(FMG.gameState, "defensiveLine", "high").ok, true, "debe cambiar linea defensiva");
assert.equal(FMG.setPositionRole(FMG.gameState, "MED", "attacking").ok, true, "debe cambiar rol por posicion");

const starter = FMG.getMatchSquad(FMG.gameState, "colo-colo").find((player) => player.position === "MED") || FMG.getMatchSquad(FMG.gameState, "colo-colo")[0];
assert.equal(FMG.setPlayerInstruction(FMG.gameState, starter.id, "pressMore").ok, true, "debe asignar instruccion individual");

const attackingProfile = FMG.getTacticalMatchProfile(FMG.gameState, "colo-colo");
assert.ok(attackingProfile.attack > 8, "plan ofensivo debe subir ataque");
assert.ok(attackingProfile.risk > 8, "plan ofensivo debe subir riesgo");
assert.ok(attackingProfile.fatigue > 4, "presion y ritmo altos deben subir desgaste");

FMG.setTeamTactic(FMG.gameState, "mentality", "defensive");
FMG.setTeamTactic(FMG.gameState, "pressing", "low");
FMG.setTeamTactic(FMG.gameState, "tempo", "slow");
FMG.setTeamTactic(FMG.gameState, "passing", "short");
FMG.setTeamTactic(FMG.gameState, "width", "narrow");
FMG.setTeamTactic(FMG.gameState, "defensiveLine", "deep");
FMG.setPositionRole(FMG.gameState, "MED", "defensive");

const defensiveProfile = FMG.getTacticalMatchProfile(FMG.gameState, "colo-colo");
assert.ok(defensiveProfile.defense > attackingProfile.defense, "plan defensivo debe mejorar defensa relativa");
assert.ok(defensiveProfile.risk < attackingProfile.risk, "plan defensivo debe bajar riesgo");
assert.ok(defensiveProfile.fatigue < attackingProfile.fatigue, "plan defensivo debe bajar desgaste");

const rivalPlan = FMG.getTeamPlan(FMG.gameState, "u-de-chile");
rivalPlan.mentality = "balanced";
rivalPlan.pressing = "medium";
rivalPlan.tempo = "normal";
rivalPlan.passing = "mixed";
rivalPlan.width = "balanced";
rivalPlan.defensiveLine = "standard";

let defensiveShots = 0;
let attackingShots = 0;
let defensiveEnergy = 0;
let attackingEnergy = 0;
const samples = 120;

for (let index = 0; index < samples; index += 1) {
  FMG.setTeamTactic(FMG.gameState, "mentality", "defensive");
  FMG.setTeamTactic(FMG.gameState, "pressing", "low");
  FMG.setTeamTactic(FMG.gameState, "tempo", "slow");
  FMG.setTeamTactic(FMG.gameState, "passing", "short");
  FMG.setTeamTactic(FMG.gameState, "width", "narrow");
  FMG.setTeamTactic(FMG.gameState, "defensiveLine", "deep");
  const beforeDef = FMG.getMatchSquad(FMG.gameState, "colo-colo").reduce((sum, player) => sum + player.energy, 0);
  const defensive = FMG.simulateMatch({
    homeTeam: FMG.gameState.teams.find((team) => team.id === "colo-colo"),
    awayTeam: FMG.gameState.teams.find((team) => team.id === "u-de-chile"),
    players: FMG.gameState.players,
    state: FMG.gameState
  });
  const afterDef = FMG.getMatchSquad(FMG.gameState, "colo-colo").reduce((sum, player) => sum + player.energy, 0);
  defensiveShots += defensive.stats.home.shots;
  defensiveEnergy += beforeDef - afterDef;

  FMG.getMatchSquad(FMG.gameState, "colo-colo").forEach((player) => { player.energy = 90; });
  FMG.setTeamTactic(FMG.gameState, "mentality", "attacking");
  FMG.setTeamTactic(FMG.gameState, "pressing", "high");
  FMG.setTeamTactic(FMG.gameState, "tempo", "fast");
  FMG.setTeamTactic(FMG.gameState, "passing", "direct");
  FMG.setTeamTactic(FMG.gameState, "width", "wide");
  FMG.setTeamTactic(FMG.gameState, "defensiveLine", "high");
  const beforeAtt = FMG.getMatchSquad(FMG.gameState, "colo-colo").reduce((sum, player) => sum + player.energy, 0);
  const attacking = FMG.simulateMatch({
    homeTeam: FMG.gameState.teams.find((team) => team.id === "colo-colo"),
    awayTeam: FMG.gameState.teams.find((team) => team.id === "u-de-chile"),
    players: FMG.gameState.players,
    state: FMG.gameState
  });
  const afterAtt = FMG.getMatchSquad(FMG.gameState, "colo-colo").reduce((sum, player) => sum + player.energy, 0);
  attackingShots += attacking.stats.home.shots;
  attackingEnergy += beforeAtt - afterAtt;
  FMG.getMatchSquad(FMG.gameState, "colo-colo").forEach((player) => { player.energy = 90; });
}

assert.ok(attackingShots > defensiveShots, "plan ofensivo debe producir mas remates en muestra amplia");
assert.ok(attackingEnergy > defensiveEnergy, "plan ofensivo debe gastar mas energia en muestra amplia");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar tacticas avanzadas");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 3;
delete parsed.tactics.teamSettings["colo-colo"].mentality;
delete parsed.tactics.teamSettings["colo-colo"].playerRoles;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe cargar save anterior y migrar tacticas");
assert.ok(FMG.gameState.version >= 4, "save antiguo debe migrar a version 4 o superior");
assert.ok(FMG.getTeamPlan(FMG.gameState, "colo-colo").playerRoles.DEF, "save migrado debe tener roles");

console.log("Phase 4 tests passed");
