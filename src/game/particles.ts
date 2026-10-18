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
  shape?: 'square' | 'circle' | 'sparkle' | 'ring';
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private enabled = true;
  private maxParticles = 200;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.particles = [];
  }

  setMaxParticles(max: number): void {
    this.maxParticles = max;
    if (this.particles.length > max) {
      this.particles.splice(0, this.particles.length - max);
    }
  }

  emit(x: number, y: number, count: number, opts: Partial<Particle> = {}): void {
    if (!this.enabled) return;
    const canAdd = Math.min(count, this.maxParticles - this.particles.length);
    for (let i = 0; i < canAdd; i++) {
      const angle = opts.vx !== undefined && opts.vy !== undefined
        ? Math.atan2(opts.vy, opts.vx) + (Math.random() - 0.5) * 1.5
        : Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: opts.vx !== undefined ? opts.vx + (Math.random() - 0.5) * 40 : Math.cos(angle) * speed,
        vy: opts.vy !== undefined ? opts.vy + (Math.random() - 0.5) * 40 : Math.sin(angle) * speed,
        life: 0,
        maxLife: opts.maxLife ?? 0.4 + Math.random() * 0.4,
        size: opts.size ?? 2 + Math.random() * 3,
        color: opts.color ?? '#fff',
        gravity: opts.gravity ?? 300,
        shrink: opts.shrink ?? true,
        shape: opts.shape ?? 'circle',
      });
    }
  }

  burst(x: number, y: number, color: string, count = 12): void {
    this.emit(x, y, count, { color, maxLife: 0.6, size: 4, gravity: 150, shape: 'circle' });
  }

  dust(x: number, y: number, dir = 0): void {
    // Jump dust puff
    this.emit(x, y, 6, {
      color: '#e8dcce',
      maxLife: 0.35,
      size: 4,
      gravity: -30,
      vx: dir * 40,
      vy: -25,
      shape: 'circle',
    });
  }

  landing(x: number, y: number): void {
    // Landing dust clouds puffing left and right
    this.emit(x - 6, y, 5, { color: '#e0d5c5', maxLife: 0.35, size: 5, gravity: -20, vx: -60, vy: -15, shape: 'circle' });
    this.emit(x + 6, y, 5, { color: '#e0d5c5', maxLife: 0.35, size: 5, gravity: -20, vx: 60, vy: -15, shape: 'circle' });
  }

  spark(x: number, y: number, color: string): void {
    this.emit(x, y, 8, { color, maxLife: 0.4, size: 3, gravity: 80, shape: 'sparkle' });
  }

  coinSparkle(x: number, y: number): void {
    this.emit(x, y, 10, { color: '#ffd700', maxLife: 0.5, size: 3.5, gravity: -40, shape: 'sparkle' });
  }

  crystalGlow(x: number, y: number): void {
    this.emit(x, y, 14, { color: '#ff66ff', maxLife: 0.6, size: 4, gravity: -30, shape: 'sparkle' });
  }

  explosion(x: number, y: number, color = '#ff8800', count = 20): void {
    this.emit(x, y, count, { color, maxLife: 0.7, size: 5, gravity: 250, shape: 'circle' });
  }

  bossImpact(x: number, y: number): void {
    this.emit(x, y, 30, { color: '#ff44ff', maxLife: 0.9, size: 6, gravity: 300, shape: 'sparkle' });
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
      const alpha = clamp(t, 0, 1);
      const px = p.x - camX;
      const py = p.y - camY;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'sparkle') {
        // 4-pointed glowing sparkle
        ctx.fillRect(px - size, py - size * 0.25, size * 2, size * 0.5);
        ctx.fillRect(px - size * 0.25, py - size, size * 0.5, size * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - size * 0.4, py - size * 0.4, size * 0.8, size * 0.8);
      } else {
        // Soft circle
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  get count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
  }
}
