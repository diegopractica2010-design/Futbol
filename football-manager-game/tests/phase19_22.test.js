const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function noop() {}

function makeContext(canvas) {
  return new Proxy({
    canvas,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 1,
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: "",
    lineCap: "butt"
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: noop });
      }
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
global.document = {
  createElement(tag) {
    return tag === "canvas" ? makeCanvas() : { style: {}, querySelector: () => null };
  }
};
global.addEventListener = noop;
global.removeEventListener = noop;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = noop;
global.performance = { now: () => 0 };
global.OffscreenCanvas = function OffscreenCanvas(width, height) {
  return makeCanvas(width, height);
};
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
FakeAudioContext.prototype.createBuffer = function (channels, length) {
  const data = new Float32Array(length);
  return { getChannelData: () => data };
};
FakeAudioContext.prototype.createBufferSource = function () {
  return { buffer: null, loop: false, connect: noop, disconnect: noop, start: noop, stop: noop };
};

global.AudioContext = FakeAudioContext;
global.webkitAudioContext = FakeAudioContext;

window.FMG = {};

[
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
  "src/phase23/index.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const C = FMG.Phase16.C;
const canvas = makeCanvas();
const game = FMG.Phase23.createGame(canvas);

assert.equal(canvas.width, C.FIELD_W + 60, "fase 21 debe expandir canvas con margenes laterales");
assert.equal(canvas.height, C.FIELD_H + 110, "fase 21 debe expandir canvas con margenes verticales");
assert.ok(game.gkMgr, "fase 19 debe inyectar manager de porteros");
assert.ok(game.camCtrl && game.replayBuf && game.replayPlay, "fase 20 debe exponer camara y replay");
assert.ok(game.phase22Data && game.finalHUD, "fase 22 debe exponer datos y HUD final");
assert.ok(game.stadiumAudio && game.stadiumAudio.available, "fase 23 debe inyectar audio de estadio");
assert.equal(game.match.userTeam.length, 11, "fase 18 debe jugar con once del usuario");
assert.equal(game.match.aiTeam.length, 11, "fase 18 debe jugar con once de la IA");

game.start();
for (let index = 0; index < 3; index += 1) {
  game._logicTick();
  game.hud.render(game.match, game.ball, game.anim);
}

const originalRandom = Math.random;
Math.random = () => 0;
const userGK = game.match.userTeam[0];
game.ball.ball.x = userGK.x + 18;
game.ball.ball.y = userGK.y - 12;
game.ball.ball.vx = -7;
game.ball.ball.vy = 0;
const saveResult = game.gkMgr.tickGoalkeeper(userGK, game.ball, game.match, game.match.userTeam, true);
Math.random = originalRandom;

assert.ok(saveResult.saveZone, "portero debe elegir zona de atajada");
assert.ok(game.gkMgr._animTimers[userGK.id], "atajada debe registrar animacion aunque pase a saque");

game.match.controlled = game.match.userTeam[10];
game.input._keys = { " ": true };
game._applyInput();
game.input._keys = {};
game._applyInput();
assert.ok(game.ball.ball.z >= 0, "fase 16 debe mantener altura del balon");
assert.ok(game.ball.ball.vz > 0 || game.ball.ball.assist, "pase largo debe levantar o asistir el balon");

game.input._keys = { e: true };
const previousControlled = game.match.controlled;
game.match._selectedUserIndex = game.match.userTeam.indexOf(previousControlled);
game._applyInput();
assert.notEqual(game.match.controlled, previousControlled, "fase 15/16 debe permitir cambio manual de jugador");

game.replayBuf.record(game.match, game.ball);
game.match.userTeam[1].x += 6;
game.ball.ball.x += 8;
game.replayBuf.record(game.match, game.ball);
game.replayPlay.start(game.replayBuf.getLast(2));
game.hud.render(game.match, game.ball, game.anim);
assert.equal(typeof game.replayPlay.active, "boolean", "replay debe poder renderizar desde el HUD final");
game.stadiumAudio.playNearMiss();
game.stadiumAudio.playFoul();
game.stadiumAudio.playChant("home");
assert.equal(game.stadiumAudio.enabled, true, "fase 23 debe activar audio procedural");

console.log("Phase 19-23 tests passed");
