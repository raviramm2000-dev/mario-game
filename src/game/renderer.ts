import type { WorldTheme } from './level';
import { clamp } from './utils';

interface BgElement {
  x: number;
  y: number;
  size: number;
  speed: number;
  variant: number;
}

export class BackgroundRenderer {
  private theme: WorldTheme;
  private clouds: BgElement[] = [];
  private stars: BgElement[] = [];
  private hills: { x: number; y: number; w: number; h: number; dark: boolean }[] = [];
  private viewWidth: number;
  private viewHeight: number;
  private levelWidth: number;
  private levelHeight: number;
  private dayNight: 'day' | 'sunset' | 'night' = 'day';
  private weatherParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private weather: 'none' | 'rain' | 'snow' | 'fog' = 'none';

  constructor(theme: WorldTheme, viewWidth: number, viewHeight: number, levelWidth: number, levelHeight: number) {
    this.theme = theme;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.levelWidth = levelWidth;
    this.levelHeight = levelHeight;
    this.generateElements();
  }

  setTheme(theme: WorldTheme): void {
    this.theme = theme;
    this.generateElements();
  }

  setDayNight(mode: 'day' | 'sunset' | 'night'): void {
    this.dayNight = mode;
  }

  setWeather(weather: 'none' | 'rain' | 'snow' | 'fog'): void {
    this.weather = weather;
  }

  setViewSize(w: number, h: number): void {
    this.viewWidth = w;
    this.viewHeight = h;
  }

  private generateElements(): void {
    this.clouds = [];
    this.stars = [];
    this.hills = [];

    for (let i = 0; i < 15; i++) {
      this.clouds.push({
        x: Math.random() * this.levelWidth,
        y: 50 + Math.random() * 200,
        size: 40 + Math.random() * 80,
        speed: 0.1 + Math.random() * 0.2,
        variant: Math.floor(Math.random() * 3),
      });
    }

    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * this.levelWidth,
        y: Math.random() * 300,
        size: 1 + Math.random() * 2,
        speed: 0.02,
        variant: Math.floor(Math.random() * 3),
      });
    }

    for (let i = 0; i < 10; i++) {
      this.hills.push({
        x: i * 400 + Math.random() * 200,
        y: this.viewHeight - 200,
        w: 300 + Math.random() * 200,
        h: 100 + Math.random() * 150,
        dark: i % 2 === 0,
      });
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.speed * 20 * dt;
      if (c.x > this.levelWidth + 100) c.x = -100;
    }

    if (this.weather !== 'none') {
      if (this.weatherParticles.length < 80) {
        this.weatherParticles.push({
          x: Math.random() * this.viewWidth,
          y: -10,
          vx: this.weather === 'rain' ? -50 : this.weather === 'snow' ? -10 : 0,
          vy: this.weather === 'rain' ? 600 : this.weather === 'snow' ? 80 : 20,
          life: 1,
        });
      }
      for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
        const p = this.weatherParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > this.viewHeight) this.weatherParticles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    this.renderSky(ctx);
    this.renderStars(ctx, camX);
    this.renderClouds(ctx, camX);
    this.renderHills(ctx, camX);
    this.renderWeather(ctx);
  }

  private renderSky(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    if (this.dayNight === 'night') {
      grad.addColorStop(0, '#0a0a1a');
      grad.addColorStop(0.5, '#1a1a2a');
      grad.addColorStop(1, '#2a2a3a');
    } else if (this.dayNight === 'sunset') {
      grad.addColorStop(0, '#ff6b35');
      grad.addColorStop(0.4, '#ff9558');
      grad.addColorStop(1, '#ffddaa');
    } else {
      grad.addColorStop(0, this.theme.bgGradient[0]);
      grad.addColorStop(0.5, this.theme.bgGradient[1]);
      grad.addColorStop(1, this.theme.bgGradient[2]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  private renderStars(ctx: CanvasRenderingContext2D, camX: number): void {
    if (this.dayNight !== 'night') return;
    for (const s of this.stars) {
      const x = s.x - camX * s.speed;
      const wrappedX = ((x % this.viewWidth) + this.viewWidth) % this.viewWidth;
      const twinkle = 0.5 + Math.sin(performance.now() * 0.003 + s.variant) * 0.5;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      ctx.fillRect(wrappedX, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderClouds(ctx: CanvasRenderingContext2D, camX: number): void {
    for (const c of this.clouds) {
      const x = c.x - camX * c.speed;
      if (x < -200 || x > this.viewWidth + 200) continue;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = this.theme.clouds;
      const y = c.y;
      ctx.beginPath();
      ctx.arc(x, y, c.size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + c.size * 0.3, y - c.size * 0.2, c.size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + c.size * 0.6, y, c.size * 0.45, 0, Math.PI * 2);
      ctx.arc(x + c.size * 0.3, y + c.size * 0.15, c.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderHills(ctx: CanvasRenderingContext2D, camX: number): void {
    for (const h of this.hills) {
      const x = h.x - camX * 0.3;
      if (x < -h.w || x > this.viewWidth + h.w) continue;
      ctx.fillStyle = h.dark ? this.theme.hillsDark : this.theme.hills;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.quadraticCurveTo(x + h.w / 2, this.viewHeight - h.h, x + h.w, this.viewHeight);
      ctx.fill();
    }

    for (const h of this.hills) {
      const x = h.x - camX * 0.5 - 200;
      if (x < -h.w || x > this.viewWidth + h.w) continue;
      ctx.fillStyle = this.theme.hillsDark;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.quadraticCurveTo(x + h.w / 2, this.viewHeight - h.h * 0.7, x + h.w, this.viewHeight);
      ctx.fill();
    }
  }

  private renderWeather(ctx: CanvasRenderingContext2D): void {
    if (this.weather === 'none') return;
    for (const p of this.weatherParticles) {
      if (this.weather === 'rain') {
        ctx.strokeStyle = 'rgba(150,180,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 4, p.y + 12);
        ctx.stroke();
      } else if (this.weather === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(p.x, p.y, 2, 2);
      } else if (this.weather === 'fog') {
        ctx.fillStyle = 'rgba(180,200,180,0.05)';
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }
  }
}

export function renderPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: string,
  camX: number,
  camY: number,
  colors: string[]
): void {
  const px = Math.round(x - camX);
  const py = Math.round(y - camY);
  const w = Math.round(width);
  const h = Math.round(height);

  if (px + w < 0 || px > ctx.canvas.width) return;

  ctx.fillStyle = colors[0];
  ctx.fillRect(px, py, w, h);

  if (type === 'grass') {
    ctx.fillStyle = colors[0];
    ctx.fillRect(px, py, w, 4);
    ctx.fillStyle = '#4a8a2a';
    ctx.fillRect(px, py + 4, w, 4);
    ctx.fillStyle = colors[1];
    ctx.fillRect(px, py + 8, w, h - 8);
    ctx.fillStyle = colors[2];
    for (let i = 0; i < w; i += 8) {
      ctx.fillRect(px + i, py + h - 4, 4, 4);
    }
  } else if (type === 'cloud') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 10, py + 10, 10, 0, Math.PI * 2);
    ctx.arc(px + w - 10, py + 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 10, py, w - 20, 20);
  ctx.globalAlpha = 0.7;
    ctx.fillRect(px, py + 10, w, 10);
    ctx.globalAlpha = 1;
  } else if (type === 'crystal') {
    ctx.fillStyle = colors[0];
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = colors[1];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(px + i, py);
      ctx.lineTo(px + i + 8, py + h / 2);
      ctx.lineTo(px + i, py + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors[2];
    ctx.fillRect(px, py, w, 2);
  } else if (type === 'lava') {
    const flicker = Math.sin(performance.now() * 0.005 + x * 0.01) * 3;
    ctx.fillStyle = colors[0];
    ctx.fillRect(px, py + flicker, w, h);
    ctx.fillStyle = colors[1];
    ctx.fillRect(px, py + 4 + flicker, w, h - 4);
    ctx.fillStyle = '#ffff00';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(px, py + flicker, w, 3);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = colors[1];
    ctx.fillRect(px, py + 2, w, h - 2);
    ctx.fillStyle = colors[2];
    ctx.fillRect(px, py + h - 4, w, 4);
    ctx.fillStyle = colors[0];
    ctx.fillRect(px, py, w, 3);
  }
}

export function renderHazard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  type: string,
  camX: number,
  camY: number
): void {
  const px = Math.round(x - camX);
  const py = Math.round(y - camY);

  if (type === 'spike') {
    ctx.fillStyle = '#cccccc';
    const spikeW = 10;
    for (let i = 0; i < width; i += spikeW) {
      ctx.beginPath();
      ctx.moveTo(px + i, py + height);
      ctx.lineTo(px + i + spikeW / 2, py);
      ctx.lineTo(px + i + spikeW, py + height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#888888';
    ctx.fillRect(px, py + height - 4, width, 4);
  } else if (type === 'lava') {
    renderPlatform(ctx, x, y, width, height, 'lava', camX, camY, ['#ff4400', '#cc2200', '#991100']);
  }
}

export function renderCheckpoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  activated: boolean,
  camX: number,
  camY: number,
  animTimer: number
): void {
  const px = Math.round(x - camX);
  const py = Math.round(y - camY);

  ctx.fillStyle = '#6a6a7a';
  ctx.fillRect(px + 8, py, 4, 50);

  if (activated) {
    const wave = Math.sin(animTimer * 4) * 4;
    ctx.fillStyle = '#44ff44';
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 5);
    ctx.lineTo(px + 30 + wave, py + 15);
    ctx.lineTo(px + 12, py + 25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#22cc22';
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 20);
    ctx.lineTo(px + 25 + wave, py + 28);
    ctx.lineTo(px + 12, py + 36);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 5);
    ctx.lineTo(px + 25, py + 15);
    ctx.lineTo(px + 12, py + 25);
    ctx.closePath();
    ctx.fill();
  }
}

export function renderFinish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  camX: number,
  camY: number,
  animTimer: number
): void {
  const px = Math.round(x - camX);
  const py = Math.round(y - camY);

  ctx.fillStyle = '#6a6a7a';
  ctx.fillRect(px + 15, py - 40, 4, 120);

  const wave = Math.sin(animTimer * 3) * 3;
  const flagH = 50;
  const stripeH = 8;
  for (let i = 0; i < flagH; i += stripeH * 2) {
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(px + 19, py - 40 + i + wave, 35, stripeH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 19, py - 40 + i + stripeH + wave, 35, stripeH);
  }

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(px + 17, py + 80, 6, 0, Math.PI * 2);
  ctx.fill();
}
