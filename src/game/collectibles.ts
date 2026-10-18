import { ParticleSystem } from './particles';
import { GAME_CONFIG } from './config';

type CollectibleType = 'coin' | 'starShard' | 'secretCrystal' | 'goldenStar';

export interface CollectibleCallbacks {
  onCoin: () => void;
  onStarShard: () => void;
  onSecretCrystal: (id: number) => void;
  onGoldenStar: () => void;
}

export class Collectible {
  type: CollectibleType;
  x: number;
  y: number;
  width: number;
  height: number;
  collected = false;
  animTimer = 0;
  baseY: number;
  id: number;
  private particles: ParticleSystem;
  private callbacks: CollectibleCallbacks;

  constructor(type: CollectibleType, x: number, y: number, particles: ParticleSystem, callbacks: CollectibleCallbacks, id = 0) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.id = id;
    this.particles = particles;
    this.callbacks = callbacks;

    switch (type) {
      case 'coin': this.width = 16; this.height = 16; break;
      case 'starShard': this.width = 18; this.height = 18; break;
      case 'secretCrystal': this.width = 22; this.height = 22; break;
      case 'goldenStar': this.width = 24; this.height = 24; break;
    }
  }

  update(dt: number): void {
    if (this.collected) return;
    this.animTimer += dt;
    this.y = this.baseY + Math.sin(this.animTimer * 3) * 4;
  }

  checkCollision(playerBox: { x: number; y: number; width: number; height: number }): boolean {
    if (this.collected) return false;
    if (this.x < playerBox.x + playerBox.width && this.x + this.width > playerBox.x &&
        this.y < playerBox.y + playerBox.height && this.y + this.height > playerBox.y) {
      this.collect();
      return true;
    }
    return false;
  }

  private collect(): void {
    this.collected = true;
    switch (this.type) {
      case 'coin':
        this.particles.spark(this.x + this.width / 2, this.y + this.height / 2, '#ffd700');
        this.callbacks.onCoin();
        break;
      case 'starShard':
        this.particles.burst(this.x + this.width / 2, this.y + this.height / 2, '#88ccff', 10);
        this.callbacks.onStarShard();
        break;
      case 'secretCrystal':
        this.particles.burst(this.x + this.width / 2, this.y + this.height / 2, '#ff44ff', 15);
        this.callbacks.onSecretCrystal(this.id);
        break;
      case 'goldenStar':
        this.particles.explosion(this.x + this.width / 2, this.y + this.height / 2, '#ffd700', 20);
        this.callbacks.onGoldenStar();
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.collected) return;
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    const pulse = 1 + Math.sin(this.animTimer * 4) * 0.12;

    ctx.save();

    switch (this.type) {
      case 'coin': {
        // Spinning 3D gold coin effect
        const spin = Math.cos(this.animTimer * 5);
        const spinW = Math.max(2, Math.abs(spin) * 8 * pulse);
        const cx = px + 8;
        const cy = py + 8;

        // Radiant golden aura
        const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
        aura.addColorStop(0, 'rgba(255, 230, 100, 0.45)');
        aura.addColorStop(1, 'rgba(255, 180, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();

        // Outer coin edge
        ctx.fillStyle = '#b8860b';
        ctx.beginPath();
        ctx.ellipse(cx, cy, spinW + 1, 8 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main gold face
        const coinGrad = ctx.createLinearGradient(cx - spinW, cy - 8, cx + spinW, cy + 8);
        coinGrad.addColorStop(0, '#ffe066');
        coinGrad.addColorStop(0.5, '#ffd700');
        coinGrad.addColorStop(1, '#d49b00');
        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, spinW, 7.5 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin star/detail if facing mostly front
        if (Math.abs(spin) > 0.4) {
          ctx.fillStyle = '#fff8b3';
          ctx.beginPath();
          ctx.ellipse(cx - spinW * 0.25, cy - 2, spinW * 0.4, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'starShard': {
        const cx = px + 9;
        const cy = py + 9;

        // Soft cyan aura
        const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
        aura.addColorStop(0, 'rgba(150, 220, 255, 0.6)');
        aura.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fill();

        // Diamond gem
        const r = 9 * pulse;
        const gemGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        gemGrad.addColorStop(0, '#e6f7ff');
        gemGrad.addColorStop(0.4, '#80d4ff');
        gemGrad.addColorStop(1, '#1890ff');

        ctx.fillStyle = gemGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.85, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.85, cy);
        ctx.closePath();
        ctx.fill();

        // Specular glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.7);
        ctx.lineTo(cx + r * 0.4, cy);
        ctx.lineTo(cx, cy + r * 0.1);
        ctx.lineTo(cx - r * 0.4, cy);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'secretCrystal': {
        const cx = px + 11;
        const cy = py + 11;
        const r = 11 * pulse;

        // Magical magenta bloom
        const aura = ctx.createRadialGradient(cx, cy, 3, cx, cy, 20);
        aura.addColorStop(0, 'rgba(255, 120, 255, 0.65)');
        aura.addColorStop(1, 'rgba(200, 40, 200, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();

        // Hexagonal crystal prism
        const crystalGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        crystalGrad.addColorStop(0, '#ffffff');
        crystalGrad.addColorStop(0.3, '#ff77ff');
        crystalGrad.addColorStop(0.7, '#cc22cc');
        crystalGrad.addColorStop(1, '#660066');

        ctx.fillStyle = crystalGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.85, cy - r * 0.4);
        ctx.lineTo(cx + r * 0.85, cy + r * 0.4);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.85, cy + r * 0.4);
        ctx.lineTo(cx - r * 0.85, cy - r * 0.4);
        ctx.closePath();
        ctx.fill();

        // Internal facets
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.moveTo(cx - r * 0.85, cy);
        ctx.lineTo(cx + r * 0.85, cy);
        ctx.stroke();
        break;
      }

      case 'goldenStar': {
        const cx = px + 12;
        const cy = py + 12;
        const r = 13 * pulse;

        // Radiant star bloom
        const aura = ctx.createRadialGradient(cx, cy, 3, cx, cy, 22);
        aura.addColorStop(0, 'rgba(255, 240, 140, 0.8)');
        aura.addColorStop(0.5, 'rgba(255, 200, 0, 0.3)');
        aura.addColorStop(1, 'rgba(255, 170, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fill();

        // Golden 5-point star
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Center shiny core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}
