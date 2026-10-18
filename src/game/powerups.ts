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
    const cx = px + 12;
    const cy = py + 12;
    const pulse = 1 + Math.sin(this.animTimer * 5) * 0.15;
    const r = 12 * pulse;

    const colors: Record<PowerupType, { outer: string; inner: string; glow: string; label: string }> = {
      starPower: { outer: '#ffd700', inner: '#ff8800', glow: 'rgba(255, 215, 0, 0.4)', label: '★' },
      fireOrb: { outer: '#ff5500', inner: '#ffcc00', glow: 'rgba(255, 85, 0, 0.45)', label: '🔥' },
      shieldCrystal: { outer: '#4da6ff', inner: '#e0f2fe', glow: 'rgba(77, 166, 255, 0.45)', label: '🛡' },
      speedCrystal: { outer: '#22c55e', inner: '#bbf7d0', glow: 'rgba(34, 197, 94, 0.45)', label: '⚡' },
      giantCrystal: { outer: '#d946ef', inner: '#f5d0fe', glow: 'rgba(217, 70, 239, 0.45)', label: '◆' },
    };
    const c = colors[this.type];

    ctx.save();

    // Radiant outer aura
    const aura = ctx.createRadialGradient(cx, cy, 3, cx, cy, 22 * pulse);
    aura.addColorStop(0, c.glow);
    aura.addColorStop(0.6, c.glow);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Floating orb base
    const orbGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    orbGrad.addColorStop(0, c.inner);
    orbGrad.addColorStop(0.7, c.outer);
    orbGrad.addColorStop(1, '#000000');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular border ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Label / Icon
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.label, cx, cy);

    ctx.restore();
  }
}
