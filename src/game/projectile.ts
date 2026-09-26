import { clamp } from './utils';

export interface ProjectileInit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  owner: 'player' | 'enemy' | 'boss';
  lifetime: number;
  color: string;
  size: number;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  owner: string;
  lifetime: number;
  color: string;
  size: number;
  alive = true;
  animTimer = 0;

  constructor(opts: ProjectileInit) {
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx;
    this.vy = opts.vy;
    this.damage = opts.damage;
    this.owner = opts.owner;
    this.lifetime = opts.lifetime;
    this.color = opts.color;
    this.size = opts.size;
    this.width = opts.size * 2;
    this.height = opts.size * 2;
  }

  update(dt: number, levelWidth: number, levelHeight: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;
    this.animTimer += dt;
    if (this.lifetime <= 0) this.alive = false;
    if (this.x < -50 || this.x > levelWidth + 50 || this.y < -50 || this.y > levelHeight + 50) {
      this.alive = false;
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    const pulse = 1 + Math.sin(this.animTimer * 20) * 0.2;
    const r = this.size * pulse;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(px + this.size, py + this.size, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(px + this.size, py + this.size, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + this.size, py + this.size, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  getHitbox() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
