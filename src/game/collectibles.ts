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
    const pulse = 1 + Math.sin(this.animTimer * 4) * 0.15;

    switch (this.type) {
      case 'coin':
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(px + 8, py + 8, 7 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(px + 8, py + 8, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(px + 6, py + 6, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'starShard':
        ctx.fillStyle = '#88ccff';
        ctx.beginPath();
        ctx.moveTo(px + 9, py);
        ctx.lineTo(px + 18, py + 9);
        ctx.lineTo(px + 9, py + 18);
        ctx.lineTo(px, py + 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.moveTo(px + 9, py + 3);
        ctx.lineTo(px + 15, py + 9);
        ctx.lineTo(px + 9, py + 15);
        ctx.lineTo(px + 3, py + 9);
        ctx.closePath();
        ctx.fill();
        break;

      case 'secretCrystal':
        ctx.fillStyle = '#ff44ff';
        ctx.beginPath();
        ctx.moveTo(px + 11, py);
        ctx.lineTo(px + 22, py + 8);
        ctx.lineTo(px + 18, py + 22);
        ctx.lineTo(px + 4, py + 22);
        ctx.lineTo(px, py + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff88ff';
        ctx.beginPath();
        ctx.moveTo(px + 11, py + 3);
        ctx.lineTo(px + 18, py + 10);
        ctx.lineTo(px + 11, py + 18);
        ctx.lineTo(px + 4, py + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffaaff';
        ctx.fillRect(px + 9, py + 6, 4, 4);
        break;

      case 'goldenStar':
        const r = 12 * pulse;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x = px + 12 + Math.cos(angle) * r;
          const y = py + 12 + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(px + 12, py + 12, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }
}
