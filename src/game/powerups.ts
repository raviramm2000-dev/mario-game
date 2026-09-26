import { ParticleSystem } from './particles';
import { Player } from './player';

type PowerupType = 'starPower' | 'fireOrb' | 'shieldCrystal' | 'speedCrystal' | 'giantCrystal';

export interface PowerupCallbacks {
  onCollect: (type: PowerupType) => void;
}

export class PowerUp {
  type: PowerupType;
  x: number;
  y: number;
  width = 24;
  height = 24;
  collected = false;
  animTimer = 0;
  baseY: number;
  private particles: ParticleSystem;
  private callbacks: PowerupCallbacks;
  private player: Player;

  constructor(type: PowerupType, x: number, y: number, particles: ParticleSystem, callbacks: PowerupCallbacks, player: Player) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.particles = particles;
    this.callbacks = callbacks;
    this.player = player;
  }

  update(dt: number): void {
    if (this.collected) return;
    this.animTimer += dt;
    this.y = this.baseY + Math.sin(this.animTimer * 2) * 5;
  }

  checkCollision(playerBox: { x: number; y: number; width: number; height: number }): boolean {
    if (this.collected) return false;
    if (this.x < playerBox.x + playerBox.width && this.x + this.width > playerBox.x &&
        this.y < playerBox.y + playerBox.height && this.y + this.height > playerBox.y) {
      this.apply();
      return true;
    }
    return false;
  }

  private apply(): void {
    this.collected = true;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    switch (this.type) {
      case 'starPower':
        this.player.starPowerTimer = 8;
        this.particles.burst(cx, cy, '#ffd700', 20);
        break;
      case 'fireOrb':
        this.player.hasFireOrb = true;
        this.player.fireOrbTimer = 12;
        this.particles.burst(cx, cy, '#ff6600', 20);
        break;
      case 'shieldCrystal':
        this.player.shieldActive = true;
        this.particles.burst(cx, cy, '#60a0ff', 20);
        break;
      case 'speedCrystal':
        this.player.speedBoostTimer = 8;
        this.particles.burst(cx, cy, '#44ff44', 20);
        break;
      case 'giantCrystal':
        this.player.giantTimer = 8;
        this.particles.burst(cx, cy, '#ff44ff', 20);
        break;
    }
    this.callbacks.onCollect(this.type);
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.collected) return;
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    const pulse = 1 + Math.sin(this.animTimer * 5) * 0.2;
    const r = 12 * pulse;

    const colors: Record<PowerupType, { outer: string; inner: string; icon: string }> = {
      starPower: { outer: '#ffd700', inner: '#ffaa00', icon: '★' },
      fireOrb: { outer: '#ff6600', inner: '#ff4400', icon: '🔥' },
      shieldCrystal: { outer: '#60a0ff', inner: '#3080dd', icon: '🛡' },
      speedCrystal: { outer: '#44ff44', inner: '#22cc22', icon: '⚡' },
      giantCrystal: { outer: '#ff44ff', inner: '#cc22cc', icon: '◆' },
    };
    const c = colors[this.type];

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = c.outer;
    ctx.beginPath();
    ctx.arc(px + 12, py + 12, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = c.outer;
    ctx.beginPath();
    ctx.arc(px + 12, py + 12, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.inner;
    ctx.beginPath();
    ctx.arc(px + 12, py + 12, r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons: Record<PowerupType, string> = {
      starPower: '★',
      fireOrb: 'F',
      shieldCrystal: 'S',
      speedCrystal: '>>',
      giantCrystal: 'G',
    };
    ctx.fillText(icons[this.type], px + 12, py + 12);
  }
}
