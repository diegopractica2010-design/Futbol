(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.UIAudio = {
    ctx: null,
    init() {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
    },
    _noise(duration, vol, cutoff) {
      if (!this.ctx) return;
      const bufSize = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.floor(i * 1.618033) % 7 - 3) / 6;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff || 400;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
      src.stop(this.ctx.currentTime + duration);
    },
    beep(freq, duration, type) {
      freq = freq || 440; duration = duration || 0.1; type = type || "sine";
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    },
    confirm() {
      this.beep(523, 0.08);
      setTimeout(() => this.beep(659, 0.12), 80);
    },
    error() {
      this.beep(220, 0.25, "sawtooth");
    },
    goal() {
      [523, 659, 784, 1046].forEach((freq, index) => setTimeout(() => this.beep(freq, 0.15), index * 90));
      setTimeout(() => this._noise(0.6, 0.06, 800), 100);
    },
    // Crowd noise simulated with filtered white-noise layers
    crowd(intensity) {
      const vol = (intensity || 50) / 1200;
      this._noise(0.8, vol, 350 + (intensity || 50) * 2);
    },
    // Late-game tension: low drone + heartbeat pulse
    tension(minute) {
      if (!this.ctx || (minute || 0) < 80) return;
      this.beep(82, 0.9, "sine");
      setTimeout(() => this.beep(78, 0.6, "sine"), 600);
    },
    // Derby atmosphere: crowd swell
    derby() {
      this._noise(1.2, 0.10, 600);
      setTimeout(() => this._noise(0.8, 0.07, 900), 800);
    },
    // Comeback energy: rising chord
    comeback() {
      [392, 440, 523].forEach((freq, i) => setTimeout(() => this.beep(freq, 0.28), i * 120));
      setTimeout(() => this._noise(0.4, 0.05, 1000), 350);
    },
    // Desperation: urgent low pulse
    desperation() {
      this.beep(180, 0.4, "triangle");
      setTimeout(() => this.beep(175, 0.3, "triangle"), 450);
    },
    // Pressure ambience: crowd murmur
    pressure(level) {
      const vol = (level || 50) / 1500;
      this._noise(0.5, vol, 280 + (level || 50));
    },
    // Nervous crowd while losing late
    nervousCrowd() {
      this._noise(1.0, 0.05, 250);
      this.beep(220, 0.3, "sine");
    },
    // Apply audio based on live match humanAI state
    applyMatchAtmosphere(liveMatch, humanAI) {
      if (!liveMatch) return;
      const minute = Number(liveMatch.minute) || 0;
      if (minute >= 85) this.tension(minute);
      if (humanAI) {
        const homeDesp = (humanAI.desperation && humanAI.desperation.home) || 0;
        const awayDesp = (humanAI.desperation && humanAI.desperation.away) || 0;
        if (Math.max(homeDesp, awayDesp) > 0.5) this.desperation();
        const homePanic = (humanAI.panic && humanAI.panic.home) || 0;
        const awayPanic = (humanAI.panic && humanAI.panic.away) || 0;
        if (Math.max(homePanic, awayPanic) > 0.5) this.nervousCrowd();
      }
    }
  };
})();
