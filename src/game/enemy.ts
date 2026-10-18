import { CollisionSystem, SolidObject } from './collision';
import { clamp, rand } from './utils';
import { ParticleSystem } from './particles';

type EnemyType = 'slime' | 'bat' | 'spikeBug' | 'fireSpirit' | 'shadowKnight';
type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'hurt' | 'dead';

export interface EnemyCallbacks {
  onDefeat: (enemy: Enemy) => void;
  onPlayerContact: (enemy: Enemy) => void;
  onShoot: (x: number, y: number, vx: number, vy: number, owner: string) => void;
}

export class Enemy {
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx = 0;
  vy = 0;
  prevX: number;
  prevY: number;
  onGround = false;
  alive = true;
  health = 1;
  maxHealth = 1;
  facing: 1 | -1 = -1;
  aiState: AIState = 'patrol';
  patrolStartX: number;
  patrolRange: number;
  speed: number;
  damage = 1;
  animTimer = 0;
  animFrame = 0;
  hurtTimer = 0;
  deathTimer = 0;
  shootTimer = 0;
  shootCooldown = 2;
  canBeStomped = true;
  scoreValue = 100;
  gravityAffected = true;
  flying = false;
  baseY: number;
  bobAmount = 0;
  bobTimer = 0;
  private callbacks: EnemyCallbacks;
  private collision: CollisionSystem;
  private particles: ParticleSystem;

  constructor(
    type: EnemyType,
    x: number,
    y: number,
    collision: CollisionSystem,
    particles: ParticleSystem,
    callbacks: EnemyCallbacks,
    patrolRange = 100,
    speedMult = 1
  ) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.patrolStartX = x;
    this.patrolRange = patrolRange;
    this.baseY = y;
    this.collision = collision;
    this.particles = particles;
    this.callbacks = callbacks;

    switch (type) {
      case 'slime':
        this.width = 28; this.height = 22; this.speed = 60 * speedMult;
        this.health = 1; this.canBeStomped = true; this.scoreValue = 100;
        break;
      case 'bat':
        this.width = 24; this.height = 18; this.speed = 80 * speedMult;
        this.health = 1; this.canBeStomped = true; this.flying = true;
        this.gravityAffected = false; this.scoreValue = 150; this.bobAmount = 30;
        break;
      case 'spikeBug':
        this.width = 26; this.height = 24; this.speed = 120 * speedMult;
        this.health = 2; this.canBeStomped = false; this.scoreValue = 200;
        break;
      case 'fireSpirit':
        this.width = 26; this.height = 26; this.speed = 50 * speedMult;
        this.health = 2; this.canBeStomped = true; this.flying = true;
        this.gravityAffected = false; this.scoreValue = 250;
        this.shootCooldown = 2.5; this.bobAmount = 20;
        break;
      case 'shadowKnight':
        this.width = 32; this.height = 44; this.speed = 70 * speedMult;
        this.health = 3; this.canBeStomped = false; this.scoreValue = 300;
        this.shootCooldown = 0;
        break;
    }
    this.maxHealth = this.health;
  }

  update(dt: number, solids: SolidObject[], playerX: number, playerY: number): void {
    if (!this.alive) {
      this.deathTimer += dt;
      this.vy += 800 * dt;
      this.y += this.vy * dt;
      this.animTimer += dt;
      return;
    }

    this.animTimer += dt;
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this.aiState = 'hurt';
    }

    const distToPlayer = Math.abs(this.x - playerX);

    switch (this.type) {
      case 'slime': this.updateSlime(dt, solids); break;
      case 'bat': this.updateBat(dt, playerX, playerY); break;
      case 'spikeBug': this.updateSpikeBug(dt, solids, playerX); break;
      case 'fireSpirit': this.updateFireSpirit(dt, playerX, playerY); break;
      case 'shadowKnight': this.updateShadowKnight(dt, solids, playerX, distToPlayer); break;
    }

    if (this.gravityAffected) {
      this.vy += 1200 * dt;
      if (this.vy > 800) this.vy = 800;
    }

    this.x += this.vx * dt;
    this.collision.resolveCollision(this, solids);

    this.y += this.vy * dt;
    this.onGround = false;
    const yResult = this.collision.resolveCollision(this, solids);
    if (yResult.bottom) {
      this.onGround = true;
    }

    if (this.y > 2000) {
      this.alive = false;
    }

    this.animFrame = Math.floor(this.animTimer * 8) % 4;
  }

  private updateSlime(dt: number, solids: SolidObject[]): void {
    if (this.aiState === 'hurt') {
      this.vx *= 0.9;
      return;
    }
    this.aiState = 'patrol';
    if (this.facing > 0) this.vx = this.speed;
    else this.vx = -this.speed;

    if (this.x > this.patrolStartX + this.patrolRange) this.facing = -1;
    if (this.x < this.patrolStartX - this.patrolRange) this.facing = 1;

    const ahead = { x: this.x + this.facing * this.width, y: this.y + this.height + 4, width: 4, height: 4 };
    let hasGround = false;
    for (const s of solids) {
      if (s.oneWay) continue;
      if (ahead.x < s.x + s.width && ahead.x + ahead.width > s.x && ahead.y < s.y + s.height && ahead.y + ahead.height > s.y) {
        hasGround = true;
        break;
      }
    }
    if (!hasGround && this.onGround) this.facing *= -1;
  }

  private updateBat(dt: number, playerX: number, playerY: number): void {
    this.bobTimer += dt;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 250) {
      this.aiState = 'chase';
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed * 0.7;
    } else {
      this.aiState = 'patrol';
      this.vx = Math.sin(this.bobTimer * 1.5) * this.speed * 0.6;
      this.vy = Math.cos(this.bobTimer * 2) * this.bobAmount;
    }
    if (this.vx > 0) this.facing = 1;
    else if (this.vx < 0) this.facing = -1;
  }

  private updateSpikeBug(dt: number, solids: SolidObject[], playerX: number): void {
    const dist = Math.abs(playerX - this.x);
    if (dist < 200) {
      this.aiState = 'chase';
      this.vx = playerX > this.x ? this.speed : -this.speed;
    } else {
      this.aiState = 'patrol';
      if (this.facing > 0) this.vx = this.speed;
      else this.vx = -this.speed;
      if (this.x > this.patrolStartX + this.patrolRange) this.facing = -1;
      if (this.x < this.patrolStartX - this.patrolRange) this.facing = 1;
    }
    if (this.vx > 0) this.facing = 1;
    else this.facing = -1;
  }

  private updateFireSpirit(dt: number, playerX: number, playerY: number): void {
    this.bobTimer += dt;
    this.y = this.baseY + Math.sin(this.bobTimer * 2) * this.bobAmount;

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.shootCooldown;
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 400) {
        const speed = 200;
        this.callbacks.onShoot(this.x + this.width / 2, this.y + this.height / 2, (dx / dist) * speed, (dy / dist) * speed, 'enemy');
      }
    }
    this.vx = 0;
  }

  private updateShadowKnight(dt: number, solids: SolidObject[], playerX: number, distToPlayer: number): void {
    if (distToPlayer < 180) {
      this.aiState = 'chase';
      this.vx = playerX > this.x ? this.speed : -this.speed;
    } else {
      this.aiState = 'patrol';
      if (this.facing > 0) this.vx = this.speed * 0.5;
      else this.vx = -this.speed * 0.5;
      if (this.x > this.patrolStartX + this.patrolRange) this.facing = -1;
      if (this.x < this.patrolStartX - this.patrolRange) this.facing = 1;
    }
    if (this.vx > 0) this.facing = 1;
    else this.facing = -1;
  }

  takeDamage(amount = 1, fromStomp = false): void {
    if (!this.alive || this.hurtTimer > 0) return;
    this.health -= amount;
    this.hurtTimer = 0.3;
    this.particles.spark(this.x + this.width / 2, this.y + this.height / 2, '#ff4444');
    if (this.health <= 0) {
      this.die(fromStomp);
    } else {
      this.vx = fromStomp ? -this.facing * 100 : this.facing * -100;
      this.vy = -200;
    }
  }

  private die(_fromStomp: boolean): void {
    this.alive = false;
    this.aiState = 'dead';
    this.deathTimer = 0;
    this.vy = -300;
    this.vx = rand(-50, 50);
    this.particles.burst(this.x + this.width / 2, this.y + this.height / 2, this.type === 'fireSpirit' ? '#ff6600' : '#88ff88', 16);
    this.callbacks.onDefeat(this);
  }

  checkPlayerCollision(playerBox: { x: number; y: number; width: number; height: number; vy: number; isInvincible: boolean }): boolean {
    if (!this.alive || playerBox.isInvincible) return false;
    if (this.x < playerBox.x + playerBox.width && this.x + this.width > playerBox.x &&
        this.y < playerBox.y + playerBox.height && this.y + this.height > playerBox.y) {
      this.callbacks.onPlayerContact(this);
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    if (!this.alive && this.deathTimer > 0.5) return;

    ctx.save();
    ctx.translate(px + this.width / 2, py + this.height);
    if (this.facing < 0) ctx.scale(-1, 1);

    if (!this.alive) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer);
      ctx.rotate(this.deathTimer * 3);
    }

    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    switch (this.type) {
      case 'slime': this.drawSlime(ctx); break;
      case 'bat': this.drawBat(ctx); break;
      case 'spikeBug': this.drawSpikeBug(ctx); break;
      case 'fireSpirit': this.drawFireSpirit(ctx); break;
      case 'shadowKnight': this.drawShadowKnight(ctx); break;
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.maxHealth > 1 && this.alive && this.health < this.maxHealth) {
      const bw = this.width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px, py - 6, bw, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(px, py - 6, bw * (this.health / this.maxHealth), 4);
    }
  }

  private drawSlime(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const squish = Math.sin(this.animTimer * 6) * 3;

    // HD Gelatinous Slime Dome
    const slimeGrad = ctx.createLinearGradient(0, -h + squish, 0, 0);
    slimeGrad.addColorStop(0, '#6ee7b7');
    slimeGrad.addColorStop(0.4, '#10b981');
    slimeGrad.addColorStop(1, '#047857');

    ctx.fillStyle = slimeGrad;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(-w / 2, -h + squish, 0, -h + squish);
    ctx.quadraticCurveTo(w / 2, -h + squish, w / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Inner Glowing Core
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(0, -h * 0.4 + squish * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Specular Gelatin Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.22, -h * 0.72 + squish * 0.8, 4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Eyes with Highlights
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(-5, -h * 0.45 + squish, 3, 0, Math.PI * 2);
    ctx.arc(5, -h * 0.45 + squish, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-6, -h * 0.48 + squish, 1.2, 0, Math.PI * 2);
    ctx.arc(4, -h * 0.48 + squish, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBat(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const flap = Math.sin(this.animTimer * 16) * 7;

    // Bat Membranous Wings with joints
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h / 2);
    ctx.lineTo(-w / 2 - 10, -h / 2 - 8 + flap);
    ctx.lineTo(-w / 2 - 2, -h / 2 + 2 + flap * 0.5);
    ctx.lineTo(-w / 2 - 6, -h / 2 + 8 + flap);
    ctx.lineTo(-w / 4, -h / 2 + 4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w / 4, -h / 2);
    ctx.lineTo(w / 2 + 10, -h / 2 - 8 + flap);
    ctx.lineTo(w / 2 + 2, -h / 2 + 2 + flap * 0.5);
    ctx.lineTo(w / 2 + 6, -h / 2 + 8 + flap);
    ctx.lineTo(w / 4, -h / 2 + 4);
    ctx.closePath();
    ctx.fill();

    // Bat Body & Ears
    const bodyGrad = ctx.createLinearGradient(0, -h, 0, 0);
    bodyGrad.addColorStop(0, '#6d28d9');
    bodyGrad.addColorStop(1, '#2e1065');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, w / 4, h / 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h + 4);
    ctx.lineTo(-w * 0.28, -h - 3);
    ctx.lineTo(-w * 0.08, -h + 2);
    ctx.moveTo(w * 0.2, -h + 4);
    ctx.lineTo(w * 0.28, -h - 3);
    ctx.lineTo(w * 0.08, -h + 2);
    ctx.fill();

    // Glowing Crimson Eyes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-3.5, -h * 0.55, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5, -h * 0.55, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSpikeBug(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;

    // Hardened Chitin Shell
    const shellGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    shellGrad.addColorStop(0, '#dc2626');
    shellGrad.addColorStop(0.6, '#991b1b');
    shellGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w / 2, -h + 4, w, h - 4, 8) : ctx.fillRect(-w / 2, -h + 4, w, h - 4);
    ctx.fill();

    // Metallic Steel Spikes
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 4; i++) {
      const sx = -w / 2 + 4 + i * 6;
      ctx.beginPath();
      ctx.moveTo(sx, -h + 4);
      ctx.lineTo(sx + 2.5, -h - 4);
      ctx.lineTo(sx + 5, -h + 4);
      ctx.closePath();
      ctx.fill();
    }

    // Carapace rim highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(-w / 2 + 2, -h + 6, w - 4, 2);

    // Glowing Black Visage & Angry Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-w * 0.35, -h + 10, w * 0.7, 6);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-5, -h + 11, 3, 3);
    ctx.fillRect(2, -h + 11, 3, 3);
  }

  private drawFireSpirit(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const flicker = Math.sin(this.animTimer * 12) * 4;

    // Radiant Heat Bloom
    const bloom = ctx.createRadialGradient(0, -h / 2, 2, 0, -h / 2, w * 0.8 + flicker);
    bloom.addColorStop(0, 'rgba(255, 240, 100, 0.7)');
    bloom.addColorStop(0.4, 'rgba(255, 100, 0, 0.35)');
    bloom.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(0, -h / 2, w * 0.8 + flicker, 0, Math.PI * 2);
    ctx.fill();

    // Fire Orb Core
    const fireGrad = ctx.createRadialGradient(0, -h / 2, 1, 0, -h / 2, w / 2);
    fireGrad.addColorStop(0, '#ffffff');
    fireGrad.addColorStop(0.3, '#fde047');
    fireGrad.addColorStop(0.7, '#ea580c');
    fireGrad.addColorStop(1, '#9a3412');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(0, -h / 2, w / 2 + flicker * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Dancing Eyes
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.arc(-4, -h / 2, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawShadowKnight(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;

    // Dark Plate Armor
    const armorGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    armorGrad.addColorStop(0, '#334155');
    armorGrad.addColorStop(0.5, '#1e293b');
    armorGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = armorGrad;
    ctx.fillRect(-w / 2, -h, w, h);

    // Steel Edge Trims
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-w / 2, -h, w, 3);
    ctx.fillRect(-w / 2, -h + 16, w, 2);
    ctx.fillRect(-w / 2, -4, w, 4);

    // Glowing Crimson Visor Slit
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-w * 0.35, -h + 8, w * 0.7, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -h + 9, 4, 2);

    // Shoulder Pauldrons
    ctx.fillStyle = '#475569';
    ctx.fillRect(-w / 2 - 4, -h + 4, 5, 12);
    ctx.fillRect(w / 2 - 1, -h + 4, 5, 12);
  }
}
