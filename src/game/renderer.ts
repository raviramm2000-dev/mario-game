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
  private farMountains: { x: number; y: number; w: number; h: number }[] = [];
  private midMountains: { x: number; y: number; w: number; h: number }[] = [];
  private hills: { x: number; y: number; w: number; h: number; dark: boolean }[] = [];
  private viewWidth: number;
  private viewHeight: number;
  private levelWidth: number;
  private levelHeight: number;
  private dayNight: 'day' | 'sunset' | 'night' = 'day';
  private weatherParticles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
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
    this.farMountains = [];
    this.midMountains = [];
    this.hills = [];

    // Layer 2: Clouds
    for (let i = 0; i < 20; i++) {
      this.clouds.push({
        x: Math.random() * (this.levelWidth + 400),
        y: 40 + Math.random() * 220,
        size: 50 + Math.random() * 90,
        speed: 0.08 + Math.random() * 0.18,
        variant: Math.floor(Math.random() * 3),
      });
    }

    // Stars for night/dusk
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * (this.levelWidth + 600),
        y: Math.random() * 380,
        size: 1 + Math.random() * 2.5,
        speed: 0.015,
        variant: Math.floor(Math.random() * 4),
      });
    }

    // Layer 3: Far silhouette mountains
    for (let i = 0; i < 12; i++) {
      this.farMountains.push({
        x: i * 360 + Math.random() * 100,
        y: this.viewHeight - 240,
        w: 420 + Math.random() * 200,
        h: 220 + Math.random() * 160,
      });
    }

    // Layer 4: Mid mountains
    for (let i = 0; i < 14; i++) {
      this.midMountains.push({
        x: i * 300 + Math.random() * 80,
        y: this.viewHeight - 190,
        w: 360 + Math.random() * 160,
        h: 170 + Math.random() * 120,
      });
    }

    // Layer 5: Rolling hills
    for (let i = 0; i < 16; i++) {
      this.hills.push({
        x: i * 280 + Math.random() * 120,
        y: this.viewHeight - 150,
        w: 340 + Math.random() * 180,
        h: 110 + Math.random() * 90,
        dark: i % 2 === 0,
      });
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.speed * 25 * dt;
      if (c.x > this.levelWidth + 200) c.x = -200;
    }

    if (this.weather !== 'none') {
      const maxCount = this.weather === 'fog' ? 20 : 100;
      if (this.weatherParticles.length < maxCount) {
        this.weatherParticles.push({
          x: Math.random() * (this.viewWidth + 200) - 100,
          y: -20,
          vx: this.weather === 'rain' ? -70 : this.weather === 'snow' ? -15 + Math.random() * 10 : 10,
          vy: this.weather === 'rain' ? 680 : this.weather === 'snow' ? 85 + Math.random() * 40 : 25,
          life: 1,
          size: this.weather === 'snow' ? 2 + Math.random() * 3 : 1,
        });
      }
      for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
        const p = this.weatherParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > this.viewHeight + 20) this.weatherParticles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    this.renderSky(ctx);
    this.renderSunOrMoon(ctx, camX);
    this.renderStars(ctx, camX);
    this.renderClouds(ctx, camX);
    this.renderFarMountains(ctx, camX);
    this.renderMidMountains(ctx, camX);
    this.renderHills(ctx, camX);
    this.renderWeather(ctx);
  }

  private renderSky(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    if (this.dayNight === 'night') {
      grad.addColorStop(0, '#060614');
      grad.addColorStop(0.45, '#12122b');
      grad.addColorStop(1, '#202042');
    } else if (this.dayNight === 'sunset') {
      grad.addColorStop(0, '#d94b26');
      grad.addColorStop(0.35, '#f37a38');
      grad.addColorStop(0.7, '#f8b461');
      grad.addColorStop(1, '#fde3a7');
    } else {
      grad.addColorStop(0, this.theme.bgGradient[0]);
      grad.addColorStop(0.5, this.theme.bgGradient[1]);
      grad.addColorStop(1, this.theme.bgGradient[2]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  private renderSunOrMoon(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    if (this.dayNight === 'night') {
      // Crescent Moon with soft ethereal atmospheric glow
      const mx = this.viewWidth * 0.78 - camX * 0.01;
      const my = 90;
      const moonGlow = ctx.createRadialGradient(mx, my, 16, mx, my, 80);
      moonGlow.addColorStop(0, 'rgba(230, 240, 255, 0.45)');
      moonGlow.addColorStop(0.5, 'rgba(180, 210, 255, 0.15)');
      moonGlow.addColorStop(1, 'rgba(150, 190, 255, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(mx, my, 80, 0, Math.PI * 2);
      ctx.fill();

      // Moon body
      ctx.fillStyle = '#f5f7fa';
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();

      // Shadow overlay to form crescent
      ctx.fillStyle = '#12122b';
      ctx.beginPath();
      ctx.arc(mx + 8, my - 4, 19, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Golden Sun with radiant corona
      const sx = this.viewWidth * 0.75 - camX * 0.01;
      const sy = this.dayNight === 'sunset' ? 140 : 80;
      const sunGlow = ctx.createRadialGradient(sx, sy, 20, sx, sy, 110);
      if (this.dayNight === 'sunset') {
        sunGlow.addColorStop(0, 'rgba(255, 230, 160, 0.7)');
        sunGlow.addColorStop(0.4, 'rgba(255, 120, 50, 0.3)');
        sunGlow.addColorStop(1, 'rgba(255, 100, 30, 0)');
      } else {
        sunGlow.addColorStop(0, 'rgba(255, 255, 230, 0.8)');
        sunGlow.addColorStop(0.4, 'rgba(255, 220, 120, 0.25)');
        sunGlow.addColorStop(1, 'rgba(255, 210, 80, 0)');
      }
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, 110, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.dayNight === 'sunset' ? '#fffae0' : '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderStars(ctx: CanvasRenderingContext2D, camX: number): void {
    if (this.dayNight !== 'night' && this.dayNight !== 'sunset') return;
    const alphaMult = this.dayNight === 'sunset' ? 0.35 : 1;
    for (const s of this.stars) {
      const x = s.x - camX * s.speed;
      const wrappedX = ((x % this.viewWidth) + this.viewWidth) % this.viewWidth;
      const twinkle = 0.4 + Math.sin(performance.now() * 0.003 + s.variant) * 0.6;
      ctx.globalAlpha = twinkle * alphaMult;
      ctx.fillStyle = s.variant === 0 ? '#ffd700' : s.variant === 1 ? '#88ccff' : '#ffffff';

      // 4-pointed sparkle for larger stars
      if (s.size > 2) {
        ctx.beginPath();
        ctx.arc(wrappedX, s.y, s.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(wrappedX - s.size * 1.5, s.y - 0.5, s.size * 3, 1);
        ctx.fillRect(wrappedX - 0.5, s.y - s.size * 1.5, 1, s.size * 3);
      } else {
        ctx.fillRect(wrappedX, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderClouds(ctx: CanvasRenderingContext2D, camX: number): void {
    for (const c of this.clouds) {
      const x = c.x - camX * c.speed;
      if (x < -200 || x > this.viewWidth + 200) continue;

      const y = c.y;
      const r = c.size;

      // Volumetric cloud shading with gradient
      const cloudGrad = ctx.createLinearGradient(x, y - r * 0.4, x, y + r * 0.4);
      if (this.dayNight === 'night') {
        cloudGrad.addColorStop(0, 'rgba(70, 75, 110, 0.4)');
        cloudGrad.addColorStop(1, 'rgba(40, 45, 75, 0.5)');
      } else if (this.dayNight === 'sunset') {
        cloudGrad.addColorStop(0, 'rgba(255, 230, 210, 0.7)');
        cloudGrad.addColorStop(1, 'rgba(230, 130, 110, 0.55)');
      } else {
        cloudGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        cloudGrad.addColorStop(1, 'rgba(215, 225, 245, 0.7)');
      }

      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.arc(x + r * 0.35, y - r * 0.18, r * 0.48, 0, Math.PI * 2);
      ctx.arc(x + r * 0.75, y - r * 0.05, r * 0.38, 0, Math.PI * 2);
      ctx.arc(x + r * 0.4, y + r * 0.15, r * 0.35, 0, Math.PI * 2);
      ctx.arc(x - r * 0.25, y + r * 0.05, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderFarMountains(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    for (const m of this.farMountains) {
      const x = m.x - camX * 0.08;
      if (x < -m.w || x > this.viewWidth + m.w) continue;

      const grad = ctx.createLinearGradient(x, m.y, x, this.viewHeight);
      if (this.dayNight === 'night') {
        grad.addColorStop(0, '#151530');
        grad.addColorStop(1, '#0e0e22');
      } else if (this.dayNight === 'sunset') {
        grad.addColorStop(0, '#662244');
        grad.addColorStop(1, '#441530');
      } else {
        grad.addColorStop(0, '#5075a5');
        grad.addColorStop(1, '#3b5880');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.lineTo(x + m.w * 0.45, m.y - m.h);
      ctx.lineTo(x + m.w * 0.52, m.y - m.h + 15);
      ctx.lineTo(x + m.w * 0.7, m.y - m.h * 0.7);
      ctx.lineTo(x + m.w, this.viewHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderMidMountains(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    for (const m of this.midMountains) {
      const x = m.x - camX * 0.18;
      if (x < -m.w || x > this.viewWidth + m.w) continue;

      const grad = ctx.createLinearGradient(x, m.y, x, this.viewHeight);
      if (this.dayNight === 'night') {
        grad.addColorStop(0, '#1a1d3d');
        grad.addColorStop(1, '#111228');
      } else if (this.dayNight === 'sunset') {
        grad.addColorStop(0, '#782d4b');
        grad.addColorStop(1, '#531b34');
      } else {
        grad.addColorStop(0, '#3e658e');
        grad.addColorStop(1, '#2c4b6e');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.lineTo(x + m.w * 0.38, m.y - m.h);
      ctx.lineTo(x + m.w * 0.65, m.y - m.h * 0.6);
      ctx.lineTo(x + m.w, this.viewHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderHills(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    // Back hills
    for (const h of this.hills) {
      const x = h.x - camX * 0.32;
      if (x < -h.w || x > this.viewWidth + h.w) continue;
      ctx.fillStyle = h.dark ? this.theme.hillsDark : this.theme.hills;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.quadraticCurveTo(x + h.w / 2, this.viewHeight - h.h, x + h.w, this.viewHeight);
      ctx.fill();
    }

    // Front hills with subtle gradient highlight
    for (const h of this.hills) {
      const x = h.x - camX * 0.48 - 180;
      if (x < -h.w || x > this.viewWidth + h.w) continue;
      const grad = ctx.createLinearGradient(x, this.viewHeight - h.h * 0.8, x, this.viewHeight);
      grad.addColorStop(0, this.theme.hills);
      grad.addColorStop(1, this.theme.hillsDark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, this.viewHeight);
      ctx.quadraticCurveTo(x + h.w / 2, this.viewHeight - h.h * 0.75, x + h.w, this.viewHeight);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderWeather(ctx: CanvasRenderingContext2D): void {
    if (this.weather === 'none') return;
    ctx.save();
    for (const p of this.weatherParticles) {
      if (this.weather === 'rain') {
        ctx.strokeStyle = 'rgba(180, 215, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 5, p.y + 16);
        ctx.stroke();
      } else if (this.weather === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.weather === 'fog') {
        ctx.fillStyle = 'rgba(210, 225, 240, 0.06)';
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }
    ctx.restore();
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
  colors: readonly string[] | string[]
): void {
  const px = Math.round(x - camX);
  const py = Math.round(y - camY);
  const w = Math.round(width);
  const h = Math.round(height);

  if (px + w < 0 || px > ctx.canvas.width) return;

  ctx.save();

  // Subtle drop shadow underneath platform
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(px + 3, py + h, w - 6, 4);

  // Platform main body with bevel / gradient
  const baseGrad = ctx.createLinearGradient(px, py, px, py + h);
  baseGrad.addColorStop(0, colors[0]);
  baseGrad.addColorStop(0.3, colors[1] || colors[0]);
  baseGrad.addColorStop(1, colors[2] || colors[1] || colors[0]);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(px, py, w, h);

  if (type === 'grass') {
    // Lush Grass Surface
    ctx.fillStyle = '#6ab83e';
    ctx.fillRect(px, py, w, 5);

    // Overhanging grass blades & fringe
    ctx.fillStyle = '#4a9028';
    for (let i = 0; i < w; i += 6) {
      const bladeH = 3 + ((i * 7) % 5);
      ctx.fillRect(px + i, py + 5, 4, bladeH);
    }

    // Dirt pebbles & depth texture
    ctx.fillStyle = colors[2] || '#3a2010';
    for (let i = 4; i < w - 6; i += 16) {
      ctx.fillRect(px + i, py + 12 + (i % 6), 5, 4);
    }
    // Bottom edge shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(px, py + h - 3, w, 3);

  } else if (type === 'crystal') {
    // Prismatic crystalline platform with glowing facets
    const crystalGrad = ctx.createLinearGradient(px, py, px + w, py + h);
    crystalGrad.addColorStop(0, '#ff77ff');
    crystalGrad.addColorStop(0.5, '#cc22cc');
    crystalGrad.addColorStop(1, '#771177');
    ctx.fillStyle = crystalGrad;
    ctx.fillRect(px, py, w, h);

    // Facet diagonals
    ctx.strokeStyle = 'rgba(255, 200, 255, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < w; i += 24) {
      ctx.beginPath();
      ctx.moveTo(px + i, py);
      ctx.lineTo(px + i + 12, py + h);
      ctx.stroke();
    }
    // Specular top highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(px, py, w, 2);

  } else if (type === 'ice') {
    // Glacial frosty ice with translucent gleam
    const iceGrad = ctx.createLinearGradient(px, py, px, py + h);
    iceGrad.addColorStop(0, '#c8f2ff');
    iceGrad.addColorStop(0.4, '#80d2f5');
    iceGrad.addColorStop(1, '#50a8d8');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(px, py, w, h);

    // Surface sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(px, py, w, 3);

    // Frost crack lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 8; i < w - 8; i += 28) {
      ctx.beginPath();
      ctx.moveTo(px + i, py + 3);
      ctx.lineTo(px + i + 8, py + h * 0.6);
      ctx.lineTo(px + i + 14, py + h * 0.9);
      ctx.stroke();
    }

  } else if (type === 'lava') {
    // Glowing bubbling magma with warm light emission
    const flicker = Math.sin(performance.now() * 0.006 + x * 0.02) * 3;
    const lavaGrad = ctx.createLinearGradient(px, py, px, py + h);
    lavaGrad.addColorStop(0, '#ffcc00');
    lavaGrad.addColorStop(0.3, '#ff4400');
    lavaGrad.addColorStop(1, '#881100');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(px, py + flicker, w, h);

    // Surface lava crest
    ctx.fillStyle = '#ffff66';
    ctx.fillRect(px, py + flicker, w, 3);

    // Glowing heat aura on top
    ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
    ctx.fillRect(px, py - 6 + flicker, w, 6);

  } else if (type === 'cloud') {
    // Fluffy cloud platform with rounded edges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(px, py, w, h, 10) : ctx.fillRect(px, py, w, h);
    ctx.fill();

    // Soft puff accents
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 12, py + 6, 8, 0, Math.PI * 2);
    ctx.arc(px + w / 2, py + 3, 10, 0, Math.PI * 2);
    ctx.arc(px + w - 12, py + 6, 8, 0, Math.PI * 2);
    ctx.fill();

  } else if (type === 'wood') {
    // Planks with wood grain
    ctx.fillStyle = colors[0];
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = colors[2] || '#4a2a10';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 32) {
      ctx.beginPath();
      ctx.moveTo(px + i, py);
      ctx.lineTo(px + i, py + h);
      ctx.stroke();
      // Nail heads
      ctx.fillStyle = '#221105';
      ctx.fillRect(px + i + 4, py + 3, 2, 2);
      ctx.fillRect(px + i + 4, py + h - 5, 2, 2);
    }

  } else {
    // Stone / Castle with beveled blocks
    ctx.fillStyle = colors[1];
    ctx.fillRect(px, py + 2, w, h - 2);

    // Beveled highlight and shadow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(px, py, w, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(px, py + h - 3, w, 3);

    // Brick mortar lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 24; i < w; i += 32) {
      ctx.fillRect(px + i, py + 2, 2, h - 4);
    }
  }

  ctx.restore();
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
    ctx.save();
    const spikeW = 12;
    for (let i = 0; i < width; i += spikeW) {
      const curW = Math.min(spikeW, width - i);

      // Steel Spike with metallic bevel
      ctx.fillStyle = '#b0b8c0';
      ctx.beginPath();
      ctx.moveTo(px + i, py + height);
      ctx.lineTo(px + i + curW / 2, py);
      ctx.lineTo(px + i + curW, py + height);
      ctx.closePath();
      ctx.fill();

      // Gleam edge
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px + i + curW * 0.3, py + height);
      ctx.lineTo(px + i + curW / 2, py);
      ctx.lineTo(px + i + curW * 0.5, py + height);
      ctx.closePath();
      ctx.fill();

      // Dark edge
      ctx.fillStyle = '#606870';
      ctx.beginPath();
      ctx.moveTo(px + i + curW / 2, py);
      ctx.lineTo(px + i + curW, py + height);
      ctx.lineTo(px + i + curW * 0.7, py + height);
      ctx.closePath();
      ctx.fill();
    }
    // Spike base
    ctx.fillStyle = '#484e55';
    ctx.fillRect(px, py + height - 3, width, 3);
    ctx.restore();

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

  ctx.save();

  // Stone base pedestal
  ctx.fillStyle = '#4a4a58';
  ctx.fillRect(px + 4, py + 42, 16, 8);
  ctx.fillStyle = '#6a6a7a';
  ctx.fillRect(px + 6, py + 40, 12, 3);

  // Metallic flagpole
  ctx.fillStyle = '#b0b8c8';
  ctx.fillRect(px + 10, py, 4, 42);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(px + 12, py, 4, 0, Math.PI * 2);
  ctx.fill();

  if (activated) {
    // Animated glowing magical emerald flag
    const wave = Math.sin(animTimer * 4.5) * 5;
    const wave2 = Math.sin(animTimer * 4.5 + 1) * 3;

    // Outer glow
    ctx.fillStyle = 'rgba(74, 255, 107, 0.35)';
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 4);
    ctx.lineTo(px + 36 + wave, py + 14 + wave2);
    ctx.lineTo(px + 14, py + 26);
    ctx.closePath();
    ctx.fill();

    // Flag body with emerald gradient
    const flagGrad = ctx.createLinearGradient(px + 14, py + 4, px + 36, py + 26);
    flagGrad.addColorStop(0, '#5aff7a');
    flagGrad.addColorStop(1, '#1ab840');
    ctx.fillStyle = flagGrad;
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 4);
    ctx.lineTo(px + 34 + wave, py + 14 + wave2);
    ctx.lineTo(px + 14, py + 24);
    ctx.closePath();
    ctx.fill();

    // Golden star emblem on flag
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 22 + wave * 0.5, py + 14 + wave2 * 0.5, 3, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Inactive dormant grey banner
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 6);
    ctx.lineTo(px + 28, py + 15);
    ctx.lineTo(px + 14, py + 24);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
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

  ctx.save();

  // Ornate Golden Spire Base
  ctx.fillStyle = '#8a6a20';
  ctx.fillRect(px + 8, py + 72, 18, 10);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(px + 10, py + 70, 14, 4);

  // Mast
  ctx.fillStyle = '#e8ecf2';
  ctx.fillRect(px + 15, py - 40, 5, 112);

  // Radiant Golden Star Top
  const starPulse = 1 + Math.sin(animTimer * 4) * 0.15;
  const starGlow = ctx.createRadialGradient(px + 17, py - 42, 2, px + 17, py - 42, 18 * starPulse);
  starGlow.addColorStop(0, 'rgba(255, 240, 100, 0.9)');
  starGlow.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');
  starGlow.addColorStop(1, 'rgba(255, 200, 0, 0)');
  ctx.fillStyle = starGlow;
  ctx.beginPath();
  ctx.arc(px + 17, py - 42, 18 * starPulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(px + 17, py - 42, 8, 0, Math.PI * 2);
  ctx.fill();

  // Checkered Satin Finish Flag waving dynamically
  const wave = Math.sin(animTimer * 3.5) * 6;
  const wave2 = Math.sin(animTimer * 3.5 + 1.2) * 4;
  const flagW = 44;
  const flagH = 48;
  const sqSize = 8;

  for (let row = 0; row < flagH / sqSize; row++) {
    for (let col = 0; col < flagW / sqSize; col++) {
      const isRed = (row + col) % 2 === 0;
      ctx.fillStyle = isRed ? '#ff3b30' : '#ffffff';
      const colWave = (col / (flagW / sqSize)) * wave;
      const rowWave = (row / (flagH / sqSize)) * wave2;
      ctx.fillRect(px + 20 + col * sqSize + colWave, py - 38 + row * sqSize + rowWave, sqSize, sqSize);
    }
  }

  ctx.restore();
}
