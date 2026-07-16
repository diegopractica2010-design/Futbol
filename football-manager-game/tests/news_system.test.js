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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 11, "fase 11 debe usar estado versionado desde 11");
assert.ok(FMG.gameState.worldNews, "debe existir mundo de noticias");
assert.ok(FMG.gameState.worldNews.rivalries.length >= 3, "debe registrar rivalidades");
assert.ok(FMG.gameState.worldNews.items.some((item) => item.title.includes("Colo-Colo")), "la noticia inicial debe usar el club real");

const fixture = {
  week: FMG.gameState.currentWeek,
  matches: [{ homeTeamId: "colo-colo", awayTeamId: "u-de-chile" }]
};
const preview = FMG.generateFixturePreviews(FMG.gameState, fixture)[0];
assert.ok(preview, "debe generar previa");
assert.equal(preview.type, "preview", "previa debe tener tipo correcto");
assert.ok(preview.title.includes("Superclasico"), "clasico debe usar rivalidad real");
assert.ok(preview.body.includes("Colo-Colo"), "previa debe usar nombre real del local");
assert.ok(preview.body.includes("Universidad de Chile"), "previa debe usar nombre real del rival");

const userScorer = FMG.gameState.players.find((player) => player.teamId === "colo-colo" && ["DEL", "EXT", "MED"].includes(player.position));
userScorer.seasonStats.goals = 4;
const result = {
  week: FMG.gameState.currentWeek,
  homeTeamId: "colo-colo",
  awayTeamId: "u-de-chile",
  homeGoals: 2,
  awayGoals: 1,
  homeEvents: [{ minute: 12, scorer: userScorer.name, playerId: userScorer.id, xg: 0.31 }],
  awayEvents: [{ minute: 60, scorer: "Rival Directo", playerId: "rival", xg: 0.2 }],
  stats: {
    home: { shotsOnTarget: 6, xg: 1.8 },
    away: { shotsOnTarget: 3, xg: 0.9 }
  },
  cards: [{ minute: 70, teamId: "u-de-chile", playerId: "rival", playerName: "Rival Directo", color: "red" }],
  injuries: [],
  timeline: []
};
const postNews = FMG.generatePostMatchNews(FMG.gameState, result);
assert.ok(postNews.some((item) => item.type === "chronicle"), "debe generar cronica post partido");
assert.ok(postNews.some((item) => item.type === "fans"), "debe generar reaccion de hinchas");
assert.ok(postNews.some((item) => item.type === "player-quote"), "debe generar declaracion de jugador");
assert.ok(postNews.some((item) => item.type === "classic"), "clasico debe generar evento especial");
assert.ok(FMG.gameState.worldNews.pressQuestions.length > 0, "debe generar preguntas de prensa");

for (let index = 0; index < 3; index += 1) {
  FMG.generatePostMatchNews(FMG.gameState, {
    ...result,
    week: FMG.gameState.currentWeek + index + 1,
    homeGoals: 3,
    awayGoals: 0,
    homeEvents: [{ minute: 8, scorer: userScorer.name, playerId: userScorer.id, xg: 0.4 }],
    awayEvents: [],
    cards: []
  });
}
assert.ok(FMG.gameState.worldNews.items.some((item) => item.type === "streak" && item.title.includes("Colo-Colo")), "racha positiva debe generar noticia contextual");

const unhappy = FMG.gameState.players.find((player) => player.teamId === "colo-colo");
unhappy.happiness = 20;
unhappy.morale = 30;
unhappy.moraleReason = "Quiere mas minutos";
const contextual = FMG.generateContextualWeeklyNews(FMG.gameState, { title: "Test semanal", detail: "Evento con datos de prueba" });
assert.ok(contextual.length > 0, "debe generar eventos semanales contextuales");
assert.ok(FMG.gameState.worldNews.items.some((item) => item.type === "dressing-room" && item.body.includes(unhappy.name)), "crisis de vestuario debe usar jugador real");

FMG.buildTransferMarket(FMG.gameState);
FMG.gameState.currentWeek += 1;
const rumors = FMG.generateMarketRumors(FMG.gameState);
assert.ok(rumors.length > 0, "debe generar rumores de mercado");
assert.ok(rumors[0].body.includes("OVR"), "rumor debe usar datos reales del jugador");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar noticias");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 10;
delete parsed.worldNews;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin noticias");
assert.ok(FMG.gameState.version >= 11, "save debe migrar a version 11 o superior");
assert.ok(FMG.gameState.worldNews, "save migrado debe crear noticias");

console.log("Phase 11 tests passed");
