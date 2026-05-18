const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = global;
global.document = undefined;
global.navigator = { deviceMemory: 8, hardwareConcurrency: 8 };
global.performance = { now: () => 10, memory: { usedJSHeapSize: 1500000 } };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = String(value); },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; },
  key(index) { return Object.keys(this.data)[index] || null; },
  get length() { return Object.keys(this.data).length; }
};

[
  "src/utils.js",
  "src/architecture.js",
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
  "src/managerEcosystem.js",
  "src/worldMediaPressure.js",
  "src/advancedTransferMarket.js",
  "src/advancedYouthAcademy.js",
  "src/squadPsychology.js",
  "src/gameEngine.js",
  "src/runtimeHardening.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const initialPlayers = FMG.gameState.players.length;
const initialSeason = FMG.gameState.seasonNumber;

const tenYear = FMG.runLongTermSimulation({
  years: 10,
  accelerated: true,
  transferLoopsPerYear: 16,
  maxRegensPerYear: 18,
  sampleEveryYears: 2
});
assert.equal(tenYear.ok, true, "10-year simulation debe mantenerse estable");
assert.equal(tenYear.years, 10, "10-year simulation debe reportar anos");
assert.ok(tenYear.snapshots.length >= 2, "10-year simulation debe muestrear el mundo");
assert.equal(tenYear.detections.entityExplosion, false, "10-year simulation no debe explotar entidades");
assert.equal(tenYear.detections.footballRealismDecay, false, "10-year simulation debe preservar realismo");

const twentyFive = FMG.runLongTermSimulation({
  years: 25,
  accelerated: true,
  transferLoopsPerYear: 20,
  maxRegensPerYear: 16,
  sampleEveryYears: 5
});
assert.equal(twentyFive.ok, true, "25-year simulation debe mantenerse estable");
assert.equal(twentyFive.detections.memoryCollapse, false, "25-year simulation no debe colapsar memoria");
assert.equal(twentyFive.detections.economicInstability, false, "25-year simulation no debe romper economia");

const fifty = FMG.runLongTermSimulation({
  years: 50,
  accelerated: true,
  transferLoopsPerYear: 24,
  maxRegensPerYear: 14,
  sampleEveryYears: 10
});
assert.equal(fifty.ok, true, "50-year simulation debe mantenerse estable");
assert.equal(fifty.detections.entityExplosion, false, "50-year simulation no debe explotar entidades");
assert.equal(fifty.detections.worldHomogenization, false, "50-year simulation no debe homogenizar el mundo");
assert.ok(FMG.gameState.seasonNumber >= initialSeason + 85, "timeline acelerado debe avanzar decadas acumuladas");
assert.ok(FMG.gameState.players.length < initialPlayers + FMG.gameState.teams.length * 80, "retirement/regens no deben disparar crecimiento masivo");
assert.ok(FMG.gameState.market.transferHistory.length > 0, "massive transfer simulation debe dejar historial");
assert.ok(FMG.gameState.players.some((player) => player.retired), "massive retirement cycle debe retirar jugadores");
assert.ok(FMG.gameState.players.some((player) => player.lineageParentId), "retirement cycle debe crear regens");

const entropy = FMG.worldEntropyAnalyzer.analyze(FMG.gameState);
const evolution = FMG.footballEvolutionAnalyzer.analyze(FMG.gameState);
assert.equal(entropy.entityExplosion, false, "WorldEntropyAnalyzer debe detectar escala segura");
assert.equal(evolution.footballRealismDecay, false, "FootballEvolutionAnalyzer debe preservar realismo");
assert.ok(entropy.teamDistributionEntropy > 0, "WorldEntropyAnalyzer debe medir entropia");
assert.ok(evolution.transferVolume > 0, "FootballEvolutionAnalyzer debe medir volumen de transferencias");

const scalingReport = FMG.generateWorldScalingReport();
const footballReport = FMG.generateFootballEvolutionReport();
const stabilityReport = FMG.generateLongTermStabilityReport();
assert.ok(scalingReport.entropy.latest, "world scaling report debe incluir entropia");
assert.ok(footballReport.evolution.latest, "football evolution report debe incluir evolucion");
assert.equal(stabilityReport.scalableWorld, true, "long-term stability report debe validar escalabilidad");
assert.equal(stabilityReport.realismPreserved, true, "long-term stability report debe validar realismo");
assert.equal(stabilityReport.runtimeStable, true, "long-term stability report debe validar runtime");

const setReport = FMG.runLongTermSimulationSet({
  transferLoopsPerYear: 4,
  maxRegensPerYear: 8,
  sampleEveryYears: 25
});
assert.equal(setReport.tenYear.years, 10, "set debe correr 10 anos");
assert.equal(setReport.twentyFiveYear.years, 25, "set debe correr 25 anos");
assert.equal(setReport.fiftyYear.years, 50, "set debe correr 50 anos");

console.log("Long-term world simulation tests passed");
