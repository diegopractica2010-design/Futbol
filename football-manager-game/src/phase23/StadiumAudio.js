(function () {
  "use strict";

  window.FMG = window.FMG || {};
  window.FMG.Phase23 = window.FMG.Phase23 || {};

  function StadiumAudio() {
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    this.available = !!AudioCtor;
    this.enabled = false;
    this.ctx = this.available ? new AudioCtor() : null;
    this.master = null;
    this.crowd = null;
    this.ambience = null;
    this.menu = null;
    this._noiseBuffer = null;
    this._lastKickAt = 0;
    this._lastStepAt = 0;
    this._lastWhistleAt = 0;
    this._chantTimer = 0;
    this._lastNearMissAt = 0;
    this._lastFoulAt = 0;
  }

  StadiumAudio.prototype.unlock = function () {
    if (!this.available || this.enabled) return;
    if (this.ctx.state === "suspended" && this.ctx.resume) this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(this.ctx.destination);
    this._noiseBuffer = makeNoiseBuffer(this.ctx, 1.8);
    this.enabled = true;
  };

  StadiumAudio.prototype.startMenuMusic = function () {
    this.unlock();
    if (!this.enabled || this.menu) return;
    this.menu = this._loopTone([220, 277, 330, 370], 0.028, 1.8, "sine");
  };

  StadiumAudio.prototype.stopMenuMusic = function () {
    stopLoop(this.menu);
    this.menu = null;
  };

  StadiumAudio.prototype.startMatch = function () {
    this.unlock();
    if (!this.enabled) return;
    this.stopMenuMusic();
    if (!this.ambience) this.ambience = this._loopNoise(0.09, 450, 2200);
    if (!this.crowd) this.crowd = this._loopNoise(0.14, 180, 1600);
    this.playWhistle();
  };

  StadiumAudio.prototype.stop = function () {
    stopLoop(this.crowd);
    stopLoop(this.ambience);
    stopLoop(this.menu);
    this.crowd = null;
    this.ambience = null;
    this.menu = null;
  };

  StadiumAudio.prototype.tick = function (match, ballSystem) {
    if (!this.enabled || !match || !ballSystem) return;
    var C = window.FMG.Phase16.C;
    var b = ballSystem.ball;
    var speed = Math.hypot(b.vx, b.vy);
    var danger = b.x < C.FIELD_W * 0.2 || b.x > C.FIELD_W * 0.8;
    var level = 0.12 + Math.min(0.16, speed * 0.012) + (danger ? 0.13 : 0);
    if (this.crowd) this._ramp(this.crowd.gain, level, 0.25);
    if (this.ambience) this._ramp(this.ambience.gain, 0.06 + (match.paused ? 0.02 : 0.04), 0.5);

    var now = this.ctx.currentTime;
    if (speed > 2.5 && now - this._lastKickAt > 0.16) {
      this.playBall(speed);
      this._lastKickAt = now;
    }

    if (now - this._lastStepAt > 0.24) {
      var movers = match.allPlayers().filter(function (p) {
        return Math.hypot(p.x - b.x, p.y - b.y) < 180;
      }).length;
      if (movers > 0) {
        this.playSteps(Math.min(1, movers / 12));
        this._lastStepAt = now;
      }
    }

    this._chantTimer++;
    if (this._chantTimer > 540) {
      this._chantTimer = 0;
      this.playChant(match.score && match.score[0] >= match.score[1] ? "home" : "away");
    }
  };

  StadiumAudio.prototype.playKick = function () {
    this.playBall(5);
  };

  StadiumAudio.prototype.playBall = function (power) {
    if (!this.enabled) return;
    var gain = Math.min(0.34, 0.06 + power * 0.025);
    this._thump(95 + power * 7, gain, 0.055);
    this._noiseBurst(gain * 0.34, 900, 3200, 0.045);
  };

  StadiumAudio.prototype.playSteps = function (intensity) {
    if (!this.enabled) return;
    this._noiseBurst(0.012 + intensity * 0.028, 120, 850, 0.035);
  };

  StadiumAudio.prototype.playGoal = function () {
    if (!this.enabled) return;
    this._noiseBurst(0.5, 120, 2800, 1.4);
    this._tone(523, 0.14, 0.22, "triangle", 0);
    this._tone(659, 0.12, 0.28, "triangle", 0.16);
    this._tone(784, 0.16, 0.45, "triangle", 0.32);
    this.playChant("home");
  };

  StadiumAudio.prototype.playNearMiss = function () {
    if (!this.enabled || this.ctx.currentTime - this._lastNearMissAt < 1.2) return;
    this._lastNearMissAt = this.ctx.currentTime;
    this._noiseBurst(0.26, 220, 2300, 0.75);
    this._tone(330, 0.08, 0.18, "sawtooth", 0.08);
  };

  StadiumAudio.prototype.playWhistle = function () {
    if (!this.enabled || this.ctx.currentTime - this._lastWhistleAt < 0.7) return;
    this._lastWhistleAt = this.ctx.currentTime;
    this._tone(1850, 0.16, 0.12, "sine", 0);
    this._tone(2300, 0.12, 0.1, "sine", 0.11);
  };

  StadiumAudio.prototype.playFoul = function () {
    if (!this.enabled || this.ctx.currentTime - this._lastFoulAt < 1) return;
    this._lastFoulAt = this.ctx.currentTime;
    this.playWhistle();
    this._noiseBurst(0.24, 160, 1900, 0.55);
  };

  StadiumAudio.prototype.playChant = function (clubSide) {
    if (!this.enabled) return;
    var base = clubSide === "away" ? 196 : 220;
    for (var i = 0; i < 5; i++) {
      this._tone(base * (i % 2 ? 1.12 : 1), 0.055, 0.18, "square", i * 0.22);
      this._noiseBurst(0.045, 260, 1300, 0.12, i * 0.22);
    }
  };

  StadiumAudio.prototype._tone = function (freq, gainValue, duration, type, delay) {
    var t = this.ctx.currentTime + (delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.04);
  };

  StadiumAudio.prototype._thump = function (freq, gainValue, duration) {
    this._tone(freq, gainValue, duration, "sine", 0);
  };

  StadiumAudio.prototype._noiseBurst = function (gainValue, lowFreq, highFreq, duration, delay) {
    if (!this._noiseBuffer) return;
    var t = this.ctx.currentTime + (delay || 0);
    var src = this.ctx.createBufferSource();
    var filter = this.ctx.createBiquadFilter();
    var gain = this.ctx.createGain();
    src.buffer = this._noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = (lowFreq + highFreq) * 0.5;
    filter.Q.value = Math.max(0.3, filter.frequency.value / Math.max(1, highFreq - lowFreq));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  };

  StadiumAudio.prototype._loopNoise = function (gainValue, lowFreq, highFreq) {
    var src = this.ctx.createBufferSource();
    var filter = this.ctx.createBiquadFilter();
    var gain = this.ctx.createGain();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = (lowFreq + highFreq) * 0.5;
    filter.Q.value = 0.85;
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    return { source: src, gain: gain };
  };

  StadiumAudio.prototype._loopTone = function (notes, gainValue, step, type) {
    var self = this;
    var stopped = false;
    function schedule() {
      if (stopped) return;
      var note = notes[Math.floor(Math.random() * notes.length)];
      self._tone(note, gainValue, step * 0.62, type, 0);
      setTimeout(schedule, step * 1000);
    }
    schedule();
    return { stop: function () { stopped = true; }, gain: null };
  };

  StadiumAudio.prototype._ramp = function (gain, value, time) {
    gain.gain.cancelScheduledValues(this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(value, this.ctx.currentTime + time);
  };

  function stopLoop(loop) {
    if (!loop) return;
    if (loop.stop) loop.stop();
    if (loop.source) {
      try { loop.source.stop(); } catch (err) {}
      try { loop.source.disconnect(); } catch (err2) {}
    }
  }

  function makeNoiseBuffer(ctx, seconds) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  window.FMG.Phase23.StadiumAudio = StadiumAudio;
})();
