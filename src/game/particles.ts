import { clamp } from './utils';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  shrink: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.particles = [];
  }

  emit(x: number, y: number, count: number, opts: Partial<Particle> = {}): void {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const angle = opts.vx !== undefined && opts.vy !== undefined
        ? Math.atan2(opts.vy, opts.vx) + (Math.random() - 0.5) * 2
        : Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: opts.vx !== undefined ? opts.vx + (Math.random() - 0.5) * 50 : Math.cos(angle) * speed,
        vy: opts.vy !== undefined ? opts.vy + (Math.random() - 0.5) * 50 : Math.sin(angle) * speed,
        life: 0,
        maxLife: opts.maxLife ?? 0.5 + Math.random() * 0.5,
        size: opts.size ?? 2 + Math.random() * 3,
        color: opts.color ?? '#fff',
        gravity: opts.gravity ?? 400,
        shrink: opts.shrink ?? true,
      });
    }
  }

  burst(x: number, y: number, color: string, count = 12): void {
    this.emit(x, y, count, { color, maxLife: 0.6, size: 3, gravity: 200 });
  }

  dust(x: number, y: number, dir = 0): void {
    this.emit(x, y, 4, { color: '#d0c0a0', maxLife: 0.3, size: 2, gravity: -50, vx: dir * 30, vy: -20 });
  }

  spark(x: number, y: number, color: string): void {
    this.emit(x, y, 8, { color, maxLife: 0.4, size: 2, gravity: 100 });
  }

  explosion(x: number, y: number, color = '#ff8800', count = 20): void {
    this.emit(x, y, count, { color, maxLife: 0.8, size: 4, gravity: 300, vx: 0, vy: 0 });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife;
      const size = p.shrink ? p.size * t : p.size;
      ctx.globalAlpha = clamp(t, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX - size / 2, p.y - camY - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
  }
}
