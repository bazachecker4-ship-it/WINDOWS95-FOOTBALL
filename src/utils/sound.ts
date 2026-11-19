class SoundController {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playChip(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.05,
    endFreq?: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.linearRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playMove() {
    this.playChip(220, 0.06, "square", 0.045, 310);
  }

  playPass() {
    this.playChip(440, 0.07, "square", 0.045, 587);
  }

  playWhistle() {
    this.playChip(1560, 0.1, "square", 0.035, 1680);
    this.playChip(1620, 0.18, "square", 0.035, 1480, 0.12);
  }

  playBlitzStart() {
    this.playChip(330, 0.07, "square", 0.05);
    this.playChip(440, 0.07, "square", 0.05, undefined, 0.07);
    this.playChip(659, 0.1, "square", 0.05, undefined, 0.14);
  }

  playBlitzMark(isHuman: boolean) {
    this.playChip(isHuman ? 587 : 349, 0.055, "square", 0.045);
  }

  playBlitzWin(isBlue: boolean) {
    if (isBlue) {
      this.playChip(523, 0.08, "square", 0.05);
      this.playChip(659, 0.08, "square", 0.05, undefined, 0.08);
      this.playChip(784, 0.16, "square", 0.05, undefined, 0.16);
    } else {
      this.playChip(392, 0.09, "sawtooth", 0.045);
      this.playChip(294, 0.16, "sawtooth", 0.045, undefined, 0.09);
    }
  }

  playGoal() {
    this.playChip(392, 0.1, "square", 0.06);
    this.playChip(523, 0.1, "square", 0.06, undefined, 0.1);
    this.playChip(659, 0.1, "square", 0.06, undefined, 0.2);
    this.playChip(784, 0.28, "square", 0.07, undefined, 0.3);
    this.playCrowdCheer();
  }

  playSave() {
    this.playChip(294, 0.09, "sawtooth", 0.05, 196);
    this.playChip(494, 0.12, "square", 0.045, 587, 0.09);
  }

  playMomentumMax() {
    this.playChip(440, 0.06, "square", 0.045);
    this.playChip(554, 0.06, "square", 0.045, undefined, 0.06);
    this.playChip(659, 0.08, "square", 0.05, undefined, 0.12);
    this.playChip(880, 0.16, "triangle", 0.055, undefined, 0.19);
  }

  playTackle() {
    this.playChip(160, 0.07, "sawtooth", 0.05, 85);
  }

  playCrowdCheer() {
    this.playChip(261, 0.35, "sawtooth", 0.025, 329, 0.05);
    this.playChip(329, 0.35, "triangle", 0.03, 392, 0.08);
    this.playChip(392, 0.4, "square", 0.02, 523, 0.12);
  }
}

export const soundFX = new SoundController();
