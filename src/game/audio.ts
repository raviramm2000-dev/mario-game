type SoundName =
  | 'jump' | 'land' | 'coin' | 'powerup' | 'enemyDefeat' | 'playerHurt'
  | 'checkpoint' | 'bossAttack' | 'bossDefeat' | 'levelComplete' | 'gameOver'
  | 'buttonClick' | 'attack' | 'projectile' | 'death' | 'crystal' | 'star';

type MusicName = 'menu' | 'world1' | 'world2' | 'world3' | 'world4' | 'world5' | 'boss' | 'victory';

interface MusicState {
  name: MusicName;
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  intervalId: number | null;
  noteIndex: number;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentMusic: MusicState | null = null;
  private settings = { master: 0.7, music: 0.5, sfx: 0.6 };
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.updateVolumes();
      this.initialized = true;
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.settings = { master, music, sfx };
    this.updateVolumes();
  }

  private updateVolumes(): void {
    if (!this.masterGain || !this.musicGain || !this.sfxGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.master, t, 0.01);
    this.musicGain.gain.setTargetAtTime(this.settings.music, t, 0.01);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, t, 0.01);
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.3, slideTo?: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, vol = 0.2, filterFreq = 1000): void {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
    noise.stop(this.ctx.currentTime + duration);
  }

  playSound(name: SoundName): void {
    if (!this.ctx) return;
    this.resume();
    switch (name) {
      case 'jump': this.playTone(400, 0.15, 'square', 0.2, 800); break;
      case 'land': this.playNoise(0.08, 0.15, 500); break;
      case 'coin': this.playTone(880, 0.06, 'square', 0.2); setTimeout(() => this.playTone(1320, 0.1, 'square', 0.2), 50); break;
      case 'powerup': this.playTone(523, 0.08, 'square', 0.2); setTimeout(() => this.playTone(659, 0.08, 'square', 0.2), 80); setTimeout(() => this.playTone(784, 0.15, 'square', 0.2), 160); break;
      case 'enemyDefeat': this.playTone(200, 0.2, 'sawtooth', 0.2, 50); this.playNoise(0.15, 0.1, 800); break;
      case 'playerHurt': this.playTone(300, 0.2, 'sawtooth', 0.25, 100); break;
      case 'checkpoint': this.playTone(659, 0.1, 'sine', 0.2); setTimeout(() => this.playTone(880, 0.2, 'sine', 0.2), 100); break;
      case 'bossAttack': this.playTone(80, 0.3, 'sawtooth', 0.3, 40); this.playNoise(0.2, 0.15, 400); break;
      case 'bossDefeat': this.playTone(100, 0.5, 'sawtooth', 0.3, 50); setTimeout(() => this.playTone(200, 0.5, 'square', 0.2, 100), 200); break;
      case 'levelComplete': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.playTone(f, 0.2, 'square', 0.2), i * 120)); break;
      case 'gameOver': [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.playTone(f, 0.3, 'sawtooth', 0.2), i * 200)); break;
      case 'buttonClick': this.playTone(600, 0.04, 'square', 0.15); break;
      case 'attack': this.playNoise(0.1, 0.15, 2000); this.playTone(150, 0.08, 'sawtooth', 0.15); break;
      case 'projectile': this.playTone(800, 0.1, 'sawtooth', 0.15, 400); break;
      case 'death': this.playTone(400, 0.5, 'sawtooth', 0.25, 50); break;
      case 'crystal': this.playTone(1320, 0.1, 'sine', 0.2); setTimeout(() => this.playTone(1760, 0.2, 'sine', 0.2), 80); break;
      case 'star': [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => this.playTone(f, 0.15, 'square', 0.2), i * 80)); break;
    }
  }

  private musicPatterns: Record<MusicName, number[]> = {
    menu: [262, 330, 392, 523, 392, 330, 262, 330, 392, 523, 659, 523, 392, 330, 262, 196],
    world1: [392, 440, 494, 523, 494, 440, 392, 330, 392, 440, 494, 523, 587, 523, 494, 440],
    world2: [330, 392, 440, 494, 440, 392, 330, 262, 330, 392, 440, 494, 587, 494, 440, 392],
    world3: [440, 523, 587, 659, 587, 523, 440, 392, 440, 523, 587, 659, 698, 659, 587, 523],
    world4: [196, 233, 262, 311, 262, 233, 196, 175, 196, 233, 262, 311, 349, 311, 262, 233],
    world5: [147, 175, 196, 233, 196, 175, 147, 131, 147, 175, 196, 233, 262, 233, 196, 175],
    boss: [110, 147, 110, 175, 110, 196, 110, 147, 110, 175, 110, 196, 220, 196, 175, 147],
    victory: [523, 659, 784, 1047, 784, 659, 523, 659, 784, 1047, 1319, 1047, 784, 659, 523, 392],
  };

  private bassPatterns: Record<MusicName, number[]> = {
    menu: [131, 0, 131, 0, 165, 0, 165, 0],
    world1: [98, 0, 98, 0, 131, 0, 131, 0],
    world2: [82, 0, 82, 0, 110, 0, 110, 0],
    world3: [110, 0, 110, 0, 147, 0, 147, 0],
    world4: [65, 0, 65, 0, 87, 0, 87, 0],
    world5: [49, 0, 49, 0, 65, 0, 65, 0],
    boss: [55, 55, 55, 55, 73, 73, 73, 73],
    victory: [131, 0, 165, 0, 196, 0, 262, 0],
  };

  playMusic(name: MusicName): void {
    if (!this.ctx || !this.musicGain) return;
    if (this.currentMusic && this.currentMusic.name === name) return;
    this.stopMusic();
    this.resume();

    const melody = this.musicPatterns[name];
    const bass = this.bassPatterns[name];
    if (!melody) return;

    const state: MusicState = {
      name,
      oscillators: [],
      gainNode: this.musicGain,
      intervalId: null,
      noteIndex: 0,
    };

    const tempo = name === 'boss' ? 200 : name === 'menu' ? 350 : 280;
    const beatDuration = tempo / 1000;

    const playNextNote = () => {
      if (!this.ctx || !this.musicGain) return;
      const idx = state.noteIndex % melody.length;
      const freq = melody[idx];
      if (freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = name === 'boss' ? 'sawtooth' : 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beatDuration * 0.9);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + beatDuration);
      }

      const bassIdx = Math.floor(state.noteIndex / 2) % bass.length;
      const bassFreq = bass[bassIdx];
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bassFreq;
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beatDuration * 1.8);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + beatDuration * 2);
      }

      state.noteIndex++;
    };

    playNextNote();
    state.intervalId = window.setInterval(playNextNote, beatDuration * 1000);
    this.currentMusic = state;
  }

  stopMusic(): void {
    if (!this.currentMusic) return;
    if (this.currentMusic.intervalId !== null) {
      clearInterval(this.currentMusic.intervalId);
    }
    this.currentMusic = null;
  }

  isPlaying(name: MusicName): boolean {
    return this.currentMusic?.name === name;
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
