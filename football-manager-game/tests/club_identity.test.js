const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; }
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
  "src/career.js",
  "src/news.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/gameEngine.js",
  "ui/playerView.js",
  "ui/rivalView.js",
  "ui/calendarView.js",
  "ui/tableView.js",
  "ui/matchView.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 12, "fase 12 debe usar estado versionado desde 12");
assert.ok(FMG.getClubIdentity("colo-colo").initials, "debe tener identidad visual por club");
assert.ok(FMG.clubBadge(FMG.gameState.userClub).includes("club-badge"), "debe renderizar emblema simple");
assert.ok(FMG.gameState.ui, "debe tener estado de UI final");

const player = FMG.gameState.players.find((item) => item.teamId === FMG.gameState.userTeamId && !item.retired);
FMG.selectSquadPlayer(FMG.gameState, player.id);
const playerHtml = FMG.renderPlayerDetailView(FMG.gameState);
assert.ok(playerHtml.includes(player.name), "vista de jugador debe usar jugador real");
assert.ok(playerHtml.includes("Atributos"), "vista de jugador debe mostrar atributos");
assert.ok(playerHtml.includes("aria-label"), "vista de jugador debe incluir labels accesibles");

const rival = FMG.gameState.teams.find((team) => team.id !== FMG.gameState.userTeamId);
assert.equal(FMG.selectRivalClub(FMG.gameState, rival.id).ok, true, "debe seleccionar club rival");
const rivalHtml = FMG.renderRivalClubView(FMG.gameState);
assert.ok(rivalHtml.includes(rival.name), "vista rival debe usar club real");
assert.ok(rivalHtml.includes("Plantel destacado"), "vista rival debe mostrar informe de plantel");

FMG.setCalendarFilter(FMG.gameState, "mine");
const calendarHtml = FMG.renderCalendarView(FMG.gameState);
assert.ok(calendarHtml.includes("Calendario"), "debe renderizar calendario");
assert.ok(calendarHtml.includes("Mi club"), "calendario debe tener filtros visibles");
assert.ok(calendarHtml.includes("club-badge"), "calendario debe mostrar emblemas");

FMG.setTableViewOption(FMG.gameState, "sort", "goals");
FMG.setTableViewOption(FMG.gameState, "filter", "mine");
const tableHtml = FMG.renderTableView(FMG.gameState);
assert.ok(tableHtml.includes("Ordenar por goles"), "tabla debe exponer ordenamiento con tooltip");
assert.ok(tableHtml.includes("Mi club"), "tabla debe exponer filtro");

const upcoming = FMG.getUpcomingFixture();
const matchHtml = FMG.renderMatchView(FMG.gameState, upcoming);
assert.ok(matchHtml.includes("club-badge"), "vista de partido mejorada debe incluir emblemas");
assert.ok(matchHtml.includes("Previa tactica") || matchHtml.includes("descansa"), "vista de partido debe conservar previa tactica o descanso contextual");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar UI final");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 11;
delete parsed.ui;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin UI final");
assert.ok(FMG.gameState.version >= 12, "save debe migrar a version 12 o superior");
assert.ok(FMG.gameState.ui, "save migrado debe crear estado UI");

console.log("Phase 12 tests passed");
