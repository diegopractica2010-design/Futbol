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
    beep(freq = 440, duration = 0.1, type = "sine") {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
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
    }
  };
})();
