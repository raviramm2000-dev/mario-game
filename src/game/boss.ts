import { CollisionSystem, SolidObject } from './collision';
import { ParticleSystem } from './particles';
import { clamp, rand } from './utils';

export type BossType = 'rockGolem' | 'skyDragon' | 'voidKing';

type BossPhase = 1 | 2 | 3 | 4;
type BossAction = 'idle' | 'groundSlam' | 'rockThrow' | 'charge' | 'fireball' | 'dive' | 'wind' | 'energyProjectile' | 'teleport' | 'shockwave' | 'summon' | 'laser' | 'meteor' | 'hurt';

export interface BossCallbacks {
  onShoot: (x: number, y: number, vx: number, vy: number, owner: string, damage?: number) => void;
  onDefeat: (boss: Boss) => void;
  onHurtPlayer: (damage: number) => void;
  onSummon: (type: string, x: number, y: number) => void;
  onShake: (amount: number) => void;
}

export class Boss {
  type: BossType;
  name: string;
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
  health: number;
  maxHealth: number;
  phase: BossPhase = 1;
  currentAction: BossAction = 'idle';
  actionTimer = 0;
  actionCooldown = 2;
  invincibilityTimer = 0;
  facing: 1 | -1 = -1;
  animTimer = 0;
  animFrame = 0;
  hurtTimer = 0;
  deathTimer = 0;
  weakPointExposed = false;
  weakPointTimer = 0;
  teleportX = 0;
  teleportY = 0;
  private callbacks: BossCallbacks;
  private collision: CollisionSystem;
  private particles: ParticleSystem;
  private playerX = 0;
  private playerY = 0;

  constructor(
    type: BossType,
    x: number,
    y: number,
    collision: CollisionSystem,
    particles: ParticleSystem,
    callbacks: BossCallbacks
  ) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.collision = collision;
    this.particles = particles;
    this.callbacks = callbacks;

    switch (type) {
      case 'rockGolem':
        this.name = 'Rock Golem';
        this.width = 80; this.height = 100; this.health = 10; this.maxHealth = 10;
        break;
      case 'skyDragon':
        this.name = 'Sky Dragon';
        this.width = 100; this.height = 70; this.health = 15; this.maxHealth = 15;
        break;
      case 'voidKing':
        this.name = 'Void King';
        this.width = 70; this.height = 110; this.health = 25; this.maxHealth = 25;
        break;
    }
  }

  update(dt: number, solids: SolidObject[], playerX: number, playerY: number): void {
    this.playerX = playerX;
    this.playerY = playerY;
    this.animTimer += dt;
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.alive) {
      this.deathTimer += dt;
      this.vy += 500 * dt;
      this.y += this.vy * dt;
      this.collision.resolveCollision(this, solids);
      return;
    }

    if (this.invincibilityTimer > 0) this.invincibilityTimer -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.weakPointTimer > 0) this.weakPointTimer -= dt;
    else this.weakPointExposed = false;

    const healthPct = this.health / this.maxHealth;
    if (this.type === 'voidKing') {
      if (healthPct < 0.25 && this.phase < 4) this.phase = 4;
      else if (healthPct < 0.5 && this.phase < 3) this.phase = 3;
      else if (healthPct < 0.75 && this.phase < 2) this.phase = 2;
    } else {
      if (healthPct < 0.5 && this.phase < 2) this.phase = 2;
    }

    this.actionTimer -= dt;
    if (this.actionTimer <= 0 && this.currentAction === 'idle') {
      this.chooseAction();
    }

    this.executeAction(dt);

    this.vy += 1000 * dt;
    if (this.vy > 800) this.vy = 800;

    this.x += this.vx * dt;
    this.collision.resolveCollision(this, solids);
    this.y += this.vy * dt;
    this.onGround = false;
    const yResult = this.collision.resolveCollision(this, solids);
    if (yResult.bottom) this.onGround = true;

    if (playerX > this.x) this.facing = 1;
    else this.facing = -1;

    this.animFrame = Math.floor(this.animTimer * 6) % 4;
  }

  private chooseAction(): void {
    const phaseMult = this.phase === 1 ? 1 : this.phase === 2 ? 0.7 : 0.5;
    this.actionCooldown = (1.5 + Math.random() * 1.5) * phaseMult;

    if (this.type === 'rockGolem') {
      const r = Math.random();
      if (r < 0.4) this.startAction('groundSlam');
      else if (r < 0.7) this.startAction('rockThrow');
      else this.startAction('charge');
    } else if (this.type === 'skyDragon') {
      const r = Math.random();
      if (r < 0.4) this.startAction('fireball');
      else if (r < 0.7) this.startAction('dive');
      else this.startAction('wind');
    } else {
      const r = Math.random();
      if (this.phase >= 3) {
        if (r < 0.2) this.startAction('laser');
        else if (r < 0.4) this.startAction('meteor');
        else if (r < 0.6) this.startAction('summon');
        else if (r < 0.75) this.startAction('teleport');
        else if (r < 0.9) this.startAction('energyProjectile');
        else this.startAction('shockwave');
      } else {
        if (r < 0.3) this.startAction('energyProjectile');
        else if (r < 0.55) this.startAction('teleport');
        else if (r < 0.8) this.startAction('shockwave');
        else this.startAction('summon');
      }
    }
  }

  private startAction(action: BossAction): void {
    this.currentAction = action;
    this.actionTimer = 0;
    switch (action) {
      case 'groundSlam': this.actionTimer = 0; break;
      case 'charge': this.vx = this.facing * 300; this.actionTimer = 0; break;
      case 'dive': this.vy = -400; this.vx = this.facing * 200; break;
      case 'teleport':
        this.invincibilityTimer = 0.5;
        this.particles.burst(this.x + this.width / 2, this.y + this.height / 2, '#9933ff', 20);
        break;
      default: break;
    }
  }

  private executeAction(dt: number): void {
    this.actionTimer += dt;

    switch (this.currentAction) {
      case 'groundSlam':
        if (this.actionTimer > 0.5 && this.onGround) {
          this.callbacks.onShake(15);
          this.particles.burst(this.x + this.width / 2, this.y + this.height, '#aa6633', 20);
          this.currentAction = 'idle';
          this.actionTimer = 0;
          this.weakPointExposed = true;
          this.weakPointTimer = 2;
        }
        break;

      case 'rockThrow':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.4) {
          const dx = this.playerX - this.x;
          const speed = 300;
          this.callbacks.onShoot(this.x + this.width / 2, this.y, dx * 0.01 * speed / 100, -200, 'boss', 1);
        }
        if (this.actionTimer > 1) {
          this.currentAction = 'idle';
          this.actionTimer = 0;
        }
        break;

      case 'charge':
        if (this.actionTimer > 1.5) {
          this.vx = 0;
          this.currentAction = 'idle';
          this.actionTimer = 0;
          this.weakPointExposed = true;
          this.weakPointTimer = 1.5;
        }
        break;

      case 'fireball':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.35) {
          const dx = this.playerX - this.x;
          const dy = this.playerY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = 250;
          this.callbacks.onShoot(this.x + this.width / 2, this.y + this.height / 2, (dx / dist) * speed, (dy / dist) * speed, 'boss', 1);
        }
        if (this.actionTimer > 1) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'dive':
        if (this.onGround && this.actionTimer > 0.5) {
          this.callbacks.onShake(10);
          this.currentAction = 'idle';
          this.actionTimer = 0;
        }
        break;

      case 'wind':
        if (this.actionTimer < 1) {
          const dir = this.facing;
          this.particles.emit(this.x + this.width / 2, this.y + this.height / 2, 2, { color: '#aaccff', vx: dir * 200, vy: 0, maxLife: 0.5, size: 4, gravity: 0 });
        }
        if (this.actionTimer > 1.5) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'energyProjectile':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.35) {
          const dx = this.playerX - this.x;
          const dy = this.playerY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = 300;
          this.callbacks.onShoot(this.x + this.width / 2, this.y + this.height / 2, (dx / dist) * speed, (dy / dist) * speed, 'boss', 1);
        }
        if (this.actionTimer > 0.8) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'teleport':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.35) {
          this.x = rand(this.x - 200, this.x + 200);
          this.particles.burst(this.x + this.width / 2, this.y + this.height / 2, '#9933ff', 20);
        }
        if (this.actionTimer > 0.6) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'shockwave':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.35) {
          this.callbacks.onShake(12);
          this.callbacks.onShoot(this.x, this.y + this.height - 10, -200, 0, 'boss', 1);
          this.callbacks.onShoot(this.x + this.width, this.y + this.height - 10, 200, 0, 'boss', 1);
        }
        if (this.actionTimer > 1) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'summon':
        if (this.actionTimer > 0.3 && this.actionTimer < 0.35) {
          this.callbacks.onSummon('slime', this.x + rand(-100, 100), this.y);
        }
        if (this.actionTimer > 1) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'laser':
        if (this.actionTimer > 0.5 && this.actionTimer < 1.5) {
          const speed = 600;
          this.callbacks.onShoot(this.x + this.width / 2, this.y + this.height / 2, this.facing * speed, 0, 'boss', 2);
        }
        if (this.actionTimer > 2) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      case 'meteor':
        if (this.actionTimer < 1) {
          if (Math.random() < 0.3) {
            const mx = this.playerX + rand(-100, 100);
            this.callbacks.onShoot(mx, 0, 0, 400, 'boss', 1);
          }
        }
        if (this.actionTimer > 1.5) { this.currentAction = 'idle'; this.actionTimer = 0; }
        break;

      default:
        if (this.actionTimer > this.actionCooldown) {
          this.currentAction = 'idle';
          this.actionTimer = 0;
        }
        break;
    }
  }

  takeDamage(amount = 1, fromStomp = false): boolean {
    if (!this.alive || this.invincibilityTimer > 0) return false;
    if (this.type === 'rockGolem' && !this.weakPointExposed && fromStomp) return false;
    if (this.type === 'skyDragon' && !fromStomp) return false;

    this.health -= amount;
    this.hurtTimer = 0.2;
    this.invincibilityTimer = 0.3;
    this.particles.spark(this.x + this.width / 2, this.y + this.height / 2, '#ffff00');

    if (this.health <= 0) {
      this.die();
    }
    return true;
  }

  private die(): void {
    this.alive = false;
    this.deathTimer = 0;
    this.vy = -400;
    this.particles.explosion(this.x + this.width / 2, this.y + this.height / 2, '#ff8800', 40);
    this.callbacks.onShake(20);
    this.callbacks.onDefeat(this);
  }

  checkPlayerCollision(playerBox: { x: number; y: number; width: number; height: number; vy: number; isInvincible: boolean }): boolean {
    if (!this.alive || playerBox.isInvincible) return false;
    if (this.x < playerBox.x + playerBox.width && this.x + this.width > playerBox.x &&
        this.y < playerBox.y + playerBox.height && this.y + this.height > playerBox.y) {
      this.callbacks.onHurtPlayer(1);
      return true;
    }
    return false;
  }

  getWeakPoint(): { x: number; y: number; width: number; height: number } | null {
    if (!this.weakPointExposed) return null;
    switch (this.type) {
      case 'rockGolem':
        return { x: this.x + this.width / 2 - 12, y: this.y + 10, width: 24, height: 24 };
      case 'skyDragon':
        return { x: this.x + this.width / 2 - 10, y: this.y + 20, width: 20, height: 20 };
      default:
        return { x: this.x + this.width / 2 - 10, y: this.y + 30, width: 20, height: 20 };
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    if (!this.alive && this.deathTimer > 1) return;

    ctx.save();
    ctx.translate(px + this.width / 2, py + this.height);
    if (this.facing < 0) ctx.scale(-1, 1);

    if (!this.alive) {
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer);
      ctx.rotate(this.deathTimer * 2);
    }
    if (this.hurtTimer > 0) ctx.globalAlpha = 0.5;

    switch (this.type) {
      case 'rockGolem': this.drawRockGolem(ctx); break;
      case 'skyDragon': this.drawSkyDragon(ctx); break;
      case 'voidKing': this.drawVoidKing(ctx); break;
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.alive) {
      const bw = this.width + 20;
      const bx = px - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, py - 12, bw, 6);
      const hpPct = this.health / this.maxHealth;
      ctx.fillStyle = hpPct > 0.5 ? '#44ff44' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';
      ctx.fillRect(bx, py - 12, bw * hpPct, 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, py - 12, bw, 6);
    }
  }

  private drawRockGolem(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;

    // Rock granite body with chiseled depth
    const rockGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    rockGrad.addColorStop(0, '#756858');
    rockGrad.addColorStop(0.5, '#5c5042');
    rockGrad.addColorStop(1, '#3b3228');
    ctx.fillStyle = rockGrad;
    ctx.fillRect(-w / 2, -h, w, h);

    // Granite plate bevel highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-w / 2, -h, w, 4);
    ctx.fillRect(-w / 2, -h, 4, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(w / 2 - 4, -h, 4, h);
    ctx.fillRect(-w / 2, -4, w, 4);

    // Magma vein cracks
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h + 24);
    ctx.lineTo(-w / 8, -h + 45);
    ctx.lineTo(-w / 4, -h + 65);
    ctx.moveTo(w / 4, -h + 30);
    ctx.lineTo(w / 8, -h + 55);
    ctx.stroke();

    // Runic Glyphs across stone chest
    const runeGlow = 0.5 + Math.sin(this.animTimer * 4) * 0.5;
    ctx.strokeStyle = `rgba(255, 100, 255, ${0.4 + runeGlow * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 4, -h + 40, w / 2, 24);

    // Massive Stone Fists
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-w / 2 - 12, -h + 35, 14, 42);
    ctx.fillRect(w / 2 - 2, -h + 35, 14, 42);
    ctx.fillStyle = '#ff6600'; // magma knuckles
    ctx.fillRect(-w / 2 - 10, -h + 70, 10, 4);
    ctx.fillRect(w / 2, -h + 70, 10, 4);

    // Weak Point Core / Eye
    if (this.weakPointExposed) {
      const pulse = Math.sin(this.animTimer * 14) * 4;
      const coreAura = ctx.createRadialGradient(0, -h + 24, 2, 0, -h + 24, 24 + pulse);
      coreAura.addColorStop(0, '#ffffff');
      coreAura.addColorStop(0.3, '#ff44ff');
      coreAura.addColorStop(0.8, 'rgba(180, 0, 255, 0.4)');
      coreAura.addColorStop(1, 'rgba(180, 0, 255, 0)');
      ctx.fillStyle = coreAura;
      ctx.beginPath();
      ctx.arc(0, -h + 24, 24 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -h + 24, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Menacing glowing molten eyes
      ctx.fillStyle = '#ff3300';
      ctx.fillRect(-14, -h + 20, 8, 5);
      ctx.fillRect(6, -h + 20, 8, 5);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(-12, -h + 21, 4, 3);
      ctx.fillRect(8, -h + 21, 4, 3);
    }
  }

  private drawSkyDragon(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const flap = Math.sin(this.animTimer * 8) * 12;

    // Draconic body gradient
    const dragonGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    dragonGrad.addColorStop(0, '#2b78c9');
    dragonGrad.addColorStop(0.5, '#1e5494');
    dragonGrad.addColorStop(1, '#0e2b52');
    ctx.fillStyle = dragonGrad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w / 2, -h + 10, w, h - 10, 16) : ctx.fillRect(-w / 2, -h + 10, w, h - 10);
    ctx.fill();

    // Dragon Underbelly Scales
    ctx.fillStyle = '#7ac5f8';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-w / 4 + i * (w / 5), -8, 8, 0, Math.PI, true);
      ctx.fill();
    }

    // Majestic Dragon Wings
    ctx.fillStyle = 'rgba(77, 166, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10, -h + 20);
    ctx.lineTo(-w / 2 - 32, -h - 10 + flap);
    ctx.lineTo(-w / 2 - 12, -h + 15 + flap * 0.5);
    ctx.lineTo(-w / 2 - 28, -h + 5 + flap);
    ctx.lineTo(-w / 2 + 5, -h + 35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w / 2 - 10, -h + 20);
    ctx.lineTo(w / 2 + 32, -h - 10 - flap);
    ctx.lineTo(w / 2 + 12, -h + 15 - flap * 0.5);
    ctx.lineTo(w / 2 + 28, -h + 5 - flap);
    ctx.lineTo(w / 2 - 5, -h + 35);
    ctx.closePath();
    ctx.fill();

    // Dragon Head & Horns
    ctx.fillStyle = '#103d75';
    ctx.fillRect(w / 2 - 18, -h + 2, 28, 18);
    // Golden Horns
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 4, -h + 2);
    ctx.lineTo(w / 2 - 12, -h - 14);
    ctx.lineTo(w / 2, -h);
    ctx.closePath();
    ctx.fill();

    // Glowing Dragon Eye
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(w / 2 - 6, -h + 6, 6, 4);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(w / 2 - 4, -h + 7, 3, 2);

    // Glowing core weak point
    if (this.weakPointExposed) {
      const pulse = Math.sin(this.animTimer * 12) * 3;
      const coreAura = ctx.createRadialGradient(w / 2 - 6, -h + 12, 1, w / 2 - 6, -h + 12, 16 + pulse);
      coreAura.addColorStop(0, '#ffffff');
      coreAura.addColorStop(0.4, '#44ffaa');
      coreAura.addColorStop(1, 'rgba(0, 255, 120, 0)');
      ctx.fillStyle = coreAura;
      ctx.beginPath();
      ctx.arc(w / 2 - 6, -h + 12, 16 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawVoidKing(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const aura = Math.sin(this.animTimer * 5) * 6;

    // Cosmic Void Vortex Aura
    const voidAura = ctx.createRadialGradient(0, -h / 2, w * 0.3, 0, -h / 2, w * 1.2 + aura);
    voidAura.addColorStop(0, 'rgba(140, 40, 255, 0.45)');
    voidAura.addColorStop(0.6, 'rgba(60, 10, 120, 0.25)');
    voidAura.addColorStop(1, 'rgba(20, 0, 40, 0)');
    ctx.fillStyle = voidAura;
    ctx.beginPath();
    ctx.arc(0, -h / 2, w * 1.2 + aura, 0, Math.PI * 2);
    ctx.fill();

    // Dark Regal Cloak
    const cloakGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    cloakGrad.addColorStop(0, '#1c0529');
    cloakGrad.addColorStop(0.5, '#2e0b42');
    cloakGrad.addColorStop(1, '#0f0217');
    ctx.fillStyle = cloakGrad;
    ctx.fillRect(-w / 2, -h, w, h);

    // Crimson Cloak Lining
    ctx.fillStyle = '#8b004b';
    ctx.fillRect(-w / 2 + 4, -h + 8, 4, h - 16);
    ctx.fillRect(w / 2 - 8, -h + 8, 4, h - 16);

    // Crown of the Void
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(-w / 4, -h - 8, w / 2, 8);
    // Crown spires
    ctx.fillStyle = '#c026d3';
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h - 8);
    ctx.lineTo(-w / 4 + 4, -h - 18);
    ctx.lineTo(-w / 4 + 8, -h - 8);
    ctx.lineTo(0, -h - 22);
    ctx.lineTo(w / 4 - 8, -h - 8);
    ctx.lineTo(w / 4 - 4, -h - 18);
    ctx.lineTo(w / 4, -h - 8);
    ctx.closePath();
    ctx.fill();

    // Dark Visage & Piercing Eyes
    ctx.fillStyle = '#05020a';
    ctx.fillRect(-w / 3, -h + 10, (w * 2) / 3, 20);

    // Piercing Glowing Eyes
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-12, -h + 16, 7, 5);
    ctx.fillRect(5, -h + 16, 7, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -h + 17, 3, 3);
    ctx.fillRect(7, -h + 17, 3, 3);

    // Floating Cosmic Void Shards (orbiting particles)
    for (let i = 0; i < 4; i++) {
      const a = this.animTimer * 2 + i * (Math.PI / 2);
      const sx = Math.cos(a) * (w * 0.7);
      const sy = -h / 2 + Math.sin(a) * (h * 0.35);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
}
