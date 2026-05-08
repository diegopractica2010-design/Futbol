const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function noop() {}

function makeContext(canvas) {
  return new Proxy({ canvas, fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineWidth: 1, globalAlpha: 1 }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: noop });
      if (prop === "measureText") return (text) => ({ width: String(text).length * 7 });
      return noop;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function makeCanvas(width = 780, height = 520) {
  return {
    width,
    height,
    style: {},
    getContext() {
      if (!this._ctx) this._ctx = makeContext(this);
      return this._ctx;
    }
  };
}

global.window = global;
global.document = { createElement: (tag) => tag === "canvas" ? makeCanvas() : { style: {}, querySelector: () => null } };
global.addEventListener = noop;
global.removeEventListener = noop;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = noop;
global.performance = { now: () => 0 };
global.OffscreenCanvas = function OffscreenCanvas(width, height) { return makeCanvas(width, height); };

function makeAudioParam() {
  return {
    value: 0,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    cancelScheduledValues() {}
  };
}

function FakeAudioContext() {
  this.currentTime = 0;
  this.sampleRate = 48000;
  this.destination = {};
  this.state = "running";
}
FakeAudioContext.prototype.resume = function () {};
FakeAudioContext.prototype.createGain = function () { return { gain: makeAudioParam(), connect: noop, disconnect: noop }; };
FakeAudioContext.prototype.createOscillator = function () { return { type: "sine", frequency: makeAudioParam(), connect: noop, start: noop, stop: noop }; };
FakeAudioContext.prototype.createBiquadFilter = function () { return { type: "bandpass", frequency: { value: 0 }, Q: { value: 0 }, connect: noop, disconnect: noop }; };
FakeAudioContext.prototype.createBuffer = function (channels, length) { return { getChannelData: () => new Float32Array(length) }; };
FakeAudioContext.prototype.createBufferSource = function () { return { buffer: null, loop: false, connect: noop, disconnect: noop, start: noop, stop: noop }; };
global.AudioContext = FakeAudioContext;
global.webkitAudioContext = FakeAudioContext;

window.FMG = {};

[
  "src/utils.js",
  "src/gameState.js",
  "src/squad.js",
  "src/phase16/constants.js",
  "src/phase16/InputSystem.js",
  "src/phase16/BallSystem.js",
  "src/phase16/MatchSystem.js",
  "src/phase16/AISystem.js",
  "src/phase16/AnimationSystem.js",
  "src/phase16/CameraSystem.js",
  "src/phase16/HUDSystem.js",
  "src/phase16/AudioSystem.js",
  "src/phase16/index.js",
  "src/phase17/PlayerState.js",
  "src/phase17/AnimationClip.js",
  "src/phase17/BlendTree.js",
  "src/phase17/PlayerRenderer.js",
  "src/phase17/BallRenderer.js",
  "src/phase17/EffectsSystem.js",
  "src/phase17/index.js",
  "src/phase18/Formation.js",
  "src/phase18/PlayerRole.js",
  "src/phase18/DecisionSystem.js",
  "src/phase18/MovementSystem.js",
  "src/phase18/TeamBrain.js",
  "src/phase18/index.js",
  "src/phase19/GoalkeeperBrain.js",
  "src/phase19/SaveSystem.js",
  "src/phase19/GoalkeeperAnimClip.js",
  "src/phase19/index.js",
  "src/phase20/CameraState.js",
  "src/phase20/CameraController.js",
  "src/phase20/ReplayBuffer.js",
  "src/phase20/ReplayPlayer.js",
  "src/phase20/BroadcastHUD.js",
  "src/phase20/index.js",
  "src/phase21/StadiumRenderer.js",
  "src/phase21/CrowdRenderer.js",
  "src/phase21/AdvertRenderer.js",
  "src/phase21/PitchRenderer.js",
  "src/phase21/GoalRenderer.js",
  "src/phase21/index.js",
  "src/phase22/RadarMinimap.js",
  "src/phase22/PowerMeter.js",
  "src/phase22/PlayerPanel.js",
  "src/phase22/MatchStatsPanel.js",
  "src/phase22/LowerThird.js",
  "src/phase22/HUDData.js",
  "src/phase22/FinalHUD.js",
  "src/phase22/index.js",
  "src/phase23/StadiumAudio.js",
  "src/phase23/index.js",
  "src/phase24/TacticsApplier.js",
  "src/phase24/AttributeModifier.js",
  "src/phase24/TeamBrainWithTactics.js",
  "src/phase24/index.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;

function player(id, teamId, position, overall, morale, energy, attrs) {
  return { id, name: id, teamId, position, age: 25, overall, morale, energy, value: 1, salary: 1, attributes: attrs || {} };
}

const state = {
  teams: [{ id: "home", name: "Home" }, { id: "away", name: "Away" }],
  players: [],
  userTeamId: "home",
  currentWeek: 1,
  fixtures: [{ week: 1, homeTeamId: "home", awayTeamId: "away" }],
  tactics: { teamSettings: {}, trainingUsedWeek: 0 }
};

["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "EXT", "EXT", "DEL", "MED"].forEach((pos, index) => {
  state.players.push(player(`h${index}`, "home", pos, 72 + (index % 5), index === 9 ? 42 : 82, 90, {
    speed: 68 + index,
    passing: 70 + index,
    shooting: 62 + index,
    defense: 66 + index,
    physical: 70,
    technique: 72 + index,
    mentality: 74
  }));
});
["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "EXT", "EXT", "DEL", "MED"].forEach((pos, index) => {
  state.players.push(player(`a${index}`, "away", pos, 70 + (index % 4), 74, 86));
});

FMG.preparePlayersForSeason(state.players);
FMG.initializeTeamPlans(state);

const homePlan = FMG.getTeamPlan(state, "home");
homePlan.formation = "3-5-2";
homePlan.mentality = "attacking";
homePlan.pressing = "high";
homePlan.tempo = "fast";
homePlan.width = "wide";
homePlan.defensiveLine = "high";
homePlan.playerRoles.DEF = "attacking";
homePlan.instructions.h8 = "takeRisks";
FMG.autoSelectLineup(state, "home");

const awayPlan = FMG.getTeamPlan(state, "away");
awayPlan.formation = "4-4-2";
awayPlan.mentality = "defensive";
awayPlan.pressing = "low";
FMG.autoSelectLineup(state, "away");

const canvas = makeCanvas();
const game = FMG.Phase24.createGame(canvas, state);
game.start();
game._logicTick();

assert.equal(game.match.userTeam[0].realPlayerId, "h0", "fase 24 debe hidratar jugadores reales del manager");
assert.equal(game.match.userTacticsPlan.formation, "3-5-2", "partido debe conocer la formacion del usuario");
assert.equal(game.matchAI._userBrain.tacticsPlan.formation, "3-5-2", "TeamBrain debe recibir el plan tactico");
assert.ok(game.match._userTacticsPressure > game.match._aiTacticsPressure, "mentalidad y pressing deben modificar presion");

const formation = new FMG.Phase18.Formation();
const base352 = formation.getBase(4, true, "neutral", homePlan);
const base442 = formation.getBase(4, true, "neutral", awayPlan);
assert.notEqual(Math.round(base352.y), Math.round(base442.y), "formacion debe cambiar posiciones base");

const runner = game.match.userTeam.find((item) => item.realPlayerId === "h8");
assert.equal(runner._instruction, "takeRisks", "instrucciones individuales deben llegar al jugador de cancha");
assert.ok(runner._riskModifier > 1, "instruccion de riesgo debe aumentar desmarques");

const modifier = new FMG.Phase24.AttributeModifier();
const freshFast = { attributes: { speed: 90 }, fatigue: 0, injuryReduction: 1 };
const tiredInjured = { attributes: { speed: 90 }, fatigue: 70, injuryReduction: 0.72 };
assert.ok(modifier.getEffectiveSpeed(freshFast) > modifier.getEffectiveSpeed(tiredInjured), "cansancio y lesiones deben reducir velocidad");

const confident = { attributes: { passing: 82, technique: 82 }, morale: 90, fatigue: 0, injuryReduction: 1 };
const nervous = { attributes: { passing: 82, technique: 82 }, morale: 40, fatigue: 0, injuryReduction: 1 };
assert.ok(modifier.getPassAccuracy(confident) > modifier.getPassAccuracy(nervous), "moral debe afectar precision");

const initialFatigue = runner.fatigue;
game.tacticsApplier.tick(game.match, state, FMG.Phase16.C.MATCH_SECS * FMG.Phase16.C.FPS);
assert.ok(runner.fatigue > initialFatigue, "fatiga debe crecer durante el partido");
assert.ok(Number.isFinite(runner._passAccuracy) && Number.isFinite(runner._shootAccuracy), "atributos deben producir pase y tiro efectivos");

console.log("Phase 24 tests passed");
