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
  "src/performance.js",
  "src/gameState.js",
  "src/squad.js",
  "simulation/engine/constants.js",
  "simulation/engine/InputSystem.js",
  "simulation/engine/BallSystem.js",
  "simulation/engine/MatchSystem.js",
  "simulation/engine/AISystem.js",
  "simulation/engine/AnimationSystem.js",
  "simulation/engine/CameraSystem.js",
  "simulation/engine/HUDSystem.js",
  "simulation/engine/AudioSystem.js",
  "simulation/engine/index.js",
  "simulation/animation/PlayerState.js",
  "simulation/animation/AnimationClip.js",
  "simulation/animation/BlendTree.js",
  "simulation/animation/PlayerRenderer.js",
  "simulation/animation/BallRenderer.js",
  "simulation/animation/EffectsSystem.js",
  "simulation/animation/index.js",
  "simulation/ai/Formation.js",
  "simulation/ai/PlayerRole.js",
  "simulation/ai/DecisionSystem.js",
  "simulation/ai/MovementSystem.js",
  "simulation/ai/TeamBrain.js",
  "simulation/ai/index.js",
  "simulation/goalkeeper/GoalkeeperBrain.js",
  "simulation/goalkeeper/SaveSystem.js",
  "simulation/goalkeeper/GoalkeeperAnimClip.js",
  "simulation/goalkeeper/index.js",
  "simulation/broadcast/CameraState.js",
  "simulation/broadcast/CameraController.js",
  "simulation/broadcast/ReplayBuffer.js",
  "simulation/broadcast/ReplayPlayer.js",
  "simulation/broadcast/BroadcastHUD.js",
  "simulation/broadcast/index.js",
  "simulation/stadium/StadiumRenderer.js",
  "simulation/stadium/CrowdRenderer.js",
  "simulation/stadium/AdvertRenderer.js",
  "simulation/stadium/PitchRenderer.js",
  "simulation/stadium/GoalRenderer.js",
  "simulation/stadium/index.js",
  "simulation/hud/RadarMinimap.js",
  "simulation/hud/PowerMeter.js",
  "simulation/hud/PlayerPanel.js",
  "simulation/hud/MatchStatsPanel.js",
  "simulation/hud/LowerThird.js",
  "simulation/hud/HUDData.js",
  "simulation/hud/FinalHUD.js",
  "simulation/hud/index.js",
  "simulation/audio/StadiumAudio.js",
  "simulation/audio/index.js",
  "simulation/tactics/TacticsApplier.js",
  "simulation/tactics/AttributeModifier.js",
  "simulation/tactics/TeamBrainWithTactics.js",
  "simulation/tactics/index.js"
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
