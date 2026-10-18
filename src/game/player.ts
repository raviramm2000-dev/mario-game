import { GAME_CONFIG, COLORS } from './config';
import { Physics } from './physics';
import { CollisionSystem, SolidObject } from './collision';
import type { InputState } from './input';
import { clamp } from './utils';

type AnimState = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'hurt' | 'death' | 'victory' | 'crouch';

export interface PlayerCallbacks {
  onJump: () => void;
  onLand: () => void;
  onAttack: () => void;
  onHurt: () => void;
  onDeath: () => void;
  onStompEnemy: (enemy: any) => void;
}

export class Player {
  x: number;
  y: number;
  width = 28;
  height = 40;
  vx = 0;
  vy = 0;
  prevX: number;
  prevY: number;
  onGround = false;
  facing: 1 | -1 = 1;
  alive = true;
  health: number = GAME_CONFIG.maxHealth;
  lives: number = GAME_CONFIG.maxLives;
  invincibilityTimer = 0;
  attackTimer = 0;
  animState: AnimState = 'idle';
  animTimer = 0;
  animFrame = 0;
  coyoteTimer = 0;
  jumpBufferTimer = 0;
  jumpHeld = false;
  canDoubleJump = false;
  usedDoubleJump = false;
  crouching = false;
  hasFireOrb = false;
  fireOrbTimer = 0;
  starPowerTimer = 0;
  shieldActive = false;
  speedBoostTimer = 0;
  giantTimer = 0;
  spawnX: number;
  spawnY: number;
  checkpointX: number;
  checkpointY: number;
  attackHitbox = { x: 0, y: 0, width: 0, height: 0 };
  hitstopTimer = 0;
  walkBob = 0;

  private physics: Physics;
  private collision: CollisionSystem;
  private callbacks: PlayerCallbacks;
  private wasOnGround = false;

  constructor(x: number, y: number, physics: Physics, collision: CollisionSystem, callbacks: PlayerCallbacks) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.spawnX = x;
    this.spawnY = y;
    this.checkpointX = x;
    this.checkpointY = y;
    this.physics = physics;
    this.collision = collision;
    this.callbacks = callbacks;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.health = GAME_CONFIG.maxHealth;
    this.invincibilityTimer = 0;
    this.attackTimer = 0;
    this.animState = 'idle';
    this.onGround = false;
    this.facing = 1;
    this.usedDoubleJump = false;
    this.hasFireOrb = false;
    this.fireOrbTimer = 0;
    this.starPowerTimer = 0;
    this.shieldActive = false;
    this.speedBoostTimer = 0;
    this.giantTimer = 0;
    this.crouching = false;
  }

  setCheckpoint(x: number, y: number): void {
    this.checkpointX = x;
    this.checkpointY = y;
  }

  respawnAtCheckpoint(): void {
    this.reset(this.checkpointX, this.checkpointY);
  }

  takeDamage(amount = 1): boolean {
    if (this.invincibilityTimer > 0 || this.starPowerTimer > 0 || !this.alive) return false;
    if (this.shieldActive) {
      this.shieldActive = false;
      this.invincibilityTimer = 1.0;
      this.callbacks.onHurt();
      return false;
    }
    this.health -= amount;
    this.invincibilityTimer = GAME_CONFIG.invincibilityTime;
    this.hitstopTimer = 0.1;
    this.animState = 'hurt';
    this.animTimer = 0;
    this.callbacks.onHurt();
    if (this.health <= 0) {
      this.die();
    }
    return true;
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.animState = 'death';
    this.animTimer = 0;
    this.vy = -400;
    this.vx = 0;
    this.lives--;
    this.callbacks.onDeath();
  }

  loseLife(): void {
    this.lives--;
    this.health = GAME_CONFIG.maxHealth;
  }

  update(dt: number, input: InputState, solids: SolidObject[]): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (!this.alive) {
      this.prevX = this.x;
      this.prevY = this.y;
      this.vy += this.physics.gravity * dt;
      this.y += this.vy * dt;
      this.animTimer += dt;
      return;
    }

    this.prevX = this.x;
    this.prevY = this.y;

    if (this.invincibilityTimer > 0) this.invincibilityTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.fireOrbTimer > 0) this.fireOrbTimer -= dt;
    else this.hasFireOrb = false;
    if (this.starPowerTimer > 0) this.starPowerTimer -= dt;
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
    if (this.giantTimer > 0) this.giantTimer -= dt;

    if (this.onGround) {
      this.coyoteTimer = GAME_CONFIG.coyoteTime;
      this.usedDoubleJump = false;
    } else {
      this.coyoteTimer -= dt;
    }

    if (input.jumpPressed) {
      this.jumpBufferTimer = GAME_CONFIG.jumpBufferTime;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    this.crouching = input.down && this.onGround;

    let dir = 0;
    if (!this.crouching) {
      if (input.left) dir = -1;
      if (input.right) dir = 1;
    }

    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    const speedMult = this.speedBoostTimer > 0 ? 1.5 : 1;
    this.physics.applyHorizontal(
      this,
      dir,
      dt,
      GAME_CONFIG.playerSpeed * speedMult,
      GAME_CONFIG.playerAcceleration,
      GAME_CONFIG.playerFriction
    );

    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        if (this.physics.jump(this)) {
          this.jumpBufferTimer = 0;
          this.coyoteTimer = 0;
          this.callbacks.onJump();
          this.animState = 'jump';
        }
      } else if (!this.usedDoubleJump && this.canDoubleJump) {
        this.physics.jump(this, GAME_CONFIG.jumpForce * 0.85);
        this.usedDoubleJump = true;
        this.jumpBufferTimer = 0;
        this.callbacks.onJump();
        this.animState = 'jump';
      }
    }

    this.physics.variableJump(this, input.jump);
    this.physics.applyGravity(this, dt);

    this.x += this.vx * dt;
    const xResult = this.collision.resolveCollision(this, solids);
    if (xResult.left || xResult.right) {
      // handled
    }

    this.y += this.vy * dt;
    this.wasOnGround = this.onGround;
    this.onGround = false;
    const yResult = this.collision.resolveCollision(this, solids);

    if (yResult.bottom && !this.wasOnGround && this.vy === 0) {
      this.callbacks.onLand();
    }

    if (yResult.platform && (yResult.platform as SolidObject).vx !== undefined) {
      const p = yResult.platform as SolidObject;
      if (p.vx) this.x += p.vx * dt;
    }

    if (this.y > 2000) {
      this.die();
    }

    if (input.attackPressed && this.attackTimer <= 0) {
      this.attackTimer = GAME_CONFIG.attackCooldown;
      this.animState = 'attack';
      this.animTimer = 0;
      this.callbacks.onAttack();
      const ax = this.facing > 0 ? this.x + this.width : this.x - GAME_CONFIG.attackRange;
      this.attackHitbox = {
        x: ax,
        y: this.y + 4,
        width: GAME_CONFIG.attackRange + 12,
        height: this.height - 8,
      };
    } else {
      this.attackHitbox = { x: 0, y: 0, width: 0, height: 0 };
    }

    this.updateAnimation(dt, dir);
  }

  private updateAnimation(dt: number, dir: number): void {
    this.animTimer += dt;

    if (!this.alive) {
      this.animState = 'death';
    } else if (this.invincibilityTimer > GAME_CONFIG.invincibilityTime - 0.3) {
      this.animState = 'hurt';
    } else if (this.attackTimer > GAME_CONFIG.attackCooldown - 0.2) {
      this.animState = 'attack';
    } else if (this.crouching) {
      this.animState = 'crouch';
    } else if (!this.onGround) {
      this.animState = this.vy < 0 ? 'jump' : 'fall';
    } else if (dir !== 0) {
      this.animState = 'run';
    } else {
      this.animState = 'idle';
    }

    const state = this.animState as string;
    switch (state) {
      case 'idle': this.animFrame = Math.floor(this.animTimer * 3) % 4; break;
      case 'run': this.animFrame = Math.floor(this.animTimer * 12) % 6; break;
      case 'jump': this.animFrame = 0; break;
      case 'fall': this.animFrame = 1; break;
      case 'attack': this.animFrame = Math.floor(this.animTimer * 20) % 3; break;
      case 'hurt': this.animFrame = 0; break;
      case 'death': this.animFrame = Math.min(3, Math.floor(this.animTimer * 8)); break;
      case 'crouch': this.animFrame = 0; break;
      case 'victory': this.animFrame = Math.floor(this.animTimer * 6) % 4; break;
    }

    if (this.animState === 'run' && this.onGround) {
      this.walkBob = Math.sin(this.animTimer * 12) * 2;
    } else {
      this.walkBob = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    if (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer * 20) % 2 === 0 && this.alive) {
      return;
    }

    // HD Drop Shadow on the floor beneath player
    if (this.alive && this.onGround) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(px + this.width / 2, py + this.height + 1, this.width * 0.6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.starPowerTimer > 0) {
      ctx.globalAlpha = 0.85 + Math.sin(this.animTimer * 20) * 0.15;
    }

    ctx.save();
    ctx.translate(px + this.width / 2, py + this.height);
    if (this.facing < 0) ctx.scale(-1, 1);

    const bob = this.walkBob;
    const c = COLORS.player;

    if (this.animState === 'death') {
      ctx.save();
      ctx.translate(0, -this.height / 2);
      ctx.rotate(this.animFrame * 0.4);
      this.drawBody(ctx, c, 0);
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    this.drawBody(ctx, c, bob);

    // HD Sword Attack Swing Arc
    if (this.animState === 'attack') {
      const swingProgress = (GAME_CONFIG.attackCooldown - this.attackTimer) / GAME_CONFIG.attackCooldown;
      const angle = -0.8 + swingProgress * 2.2;
      ctx.save();
      ctx.translate(this.width / 4, -this.height * 0.55 + bob);

      // Energy Slash Arc
      const grad = ctx.createLinearGradient(0, -28, 48, 20);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.3, 'rgba(100, 220, 255, 0.85)');
      grad.addColorStop(1, 'rgba(74, 144, 255, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 36, -0.6, angle, false);
      ctx.stroke();

      // Blade gleam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 35, angle - 0.4, angle, false);
      ctx.stroke();

      // Gleam tip
      const tipX = Math.cos(angle) * 36;
      const tipY = Math.sin(angle) * 36;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();

    // HD Star Power Radiant Halo
    if (this.starPowerTimer > 0) {
      ctx.save();
      const pulse = 1 + Math.sin(this.animTimer * 12) * 0.15;
      const auraGrad = ctx.createRadialGradient(
        px + this.width / 2, py + this.height / 2, 8,
        px + this.width / 2, py + this.height / 2, this.width * 1.5 * pulse
      );
      auraGrad.addColorStop(0, 'rgba(255, 240, 100, 0.5)');
      auraGrad.addColorStop(0.7, 'rgba(255, 215, 0, 0.25)');
      auraGrad.addColorStop(1, 'rgba(255, 170, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + this.height / 2, this.width * 1.5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Spinning sparkle stars
      const t = performance.now() * 0.005;
      for (let i = 0; i < 4; i++) {
        const a = t + i * (Math.PI / 2);
        const sx = px + this.width / 2 + Math.cos(a) * 26;
        const sy = py + this.height / 2 + Math.sin(a) * 26;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // HD Shield Crystal Bubble
    if (this.shieldActive) {
      ctx.save();
      const pulse = 1 + Math.sin(this.animTimer * 6) * 0.06;
      const shieldGrad = ctx.createRadialGradient(
        px + this.width / 2, py + this.height / 2, this.width * 0.4,
        px + this.width / 2, py + this.height / 2, this.width * 0.95 * pulse
      );
      shieldGrad.addColorStop(0, 'rgba(100, 180, 255, 0.05)');
      shieldGrad.addColorStop(0.8, 'rgba(100, 200, 255, 0.25)');
      shieldGrad.addColorStop(1, 'rgba(180, 230, 255, 0.7)');

      ctx.fillStyle = shieldGrad;
      ctx.strokeStyle = 'rgba(160, 230, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + this.height / 2, this.width * 0.9 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hexagon accents
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + this.animTimer;
        const hx = px + this.width / 2 + Math.cos(a) * (this.width * 0.75);
        const hy = py + this.height / 2 + Math.sin(a) * (this.width * 0.75);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // HD Fire Orb
    if (this.hasFireOrb) {
      ctx.save();
      const orbA = performance.now() * 0.006;
      const orbX = px + this.width / 2 + Math.cos(orbA) * 22;
      const orbY = py + this.height / 2 - 8 + Math.sin(orbA) * 12;

      const fireGrad = ctx.createRadialGradient(orbX, orbY, 1, orbX, orbY, 12);
      fireGrad.addColorStop(0, '#ffffff');
      fireGrad.addColorStop(0.3, '#ffcc00');
      fireGrad.addColorStop(0.7, '#ff5500');
      fireGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');

      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBody(ctx: CanvasRenderingContext2D, c: typeof COLORS.player, bob: number): void {
    const w = this.width;
    const h = this.height;
    const legOffset = this.animState === 'run' ? Math.sin(this.animTimer * 12) * 5 : 0;

    // HD Boots with soles and trim
    ctx.fillStyle = '#4a2810';
    ctx.fillRect(-w / 2 + 2, -6, 9, 3);
    ctx.fillRect(w / 2 - 11, -6 + legOffset, 9, 3);
    ctx.fillStyle = c.boots;
    ctx.fillRect(-w / 2 + 3, -8, 8, 5);
    ctx.fillRect(w / 2 - 11, -8 + legOffset, 8, 5);
    ctx.fillStyle = '#8a5830';
    ctx.fillRect(-w / 2 + 3, -9, 8, 1);
    ctx.fillRect(w / 2 - 11, -9 + legOffset, 8, 1);

    // Trousers with seam highlights
    ctx.fillStyle = c.trousers;
    ctx.fillRect(-w / 2 + 3, -15, 8, 7);
    ctx.fillRect(w / 2 - 11, -15 + legOffset, 8, 7);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(-w / 2 + 5, -15, 3, 7);
    ctx.fillRect(w / 2 - 9, -15 + legOffset, 3, 7);

    // Adventurer Backpack
    ctx.fillStyle = '#6a4018';
    ctx.fillRect(-w / 2 - 4, -h + 16 + bob, 7, 15);
    ctx.fillStyle = '#8a5a28';
    ctx.fillRect(-w / 2 - 3, -h + 18 + bob, 5, 11);
    ctx.fillStyle = '#ffd700'; // buckle
    ctx.fillRect(-w / 2 - 2, -h + 23 + bob, 3, 2);

    // Jacket & adventurer vest
    ctx.fillStyle = c.jacketDark;
    ctx.fillRect(-w / 2 + 2, -h + 18 + bob, w - 4, h - 23);
    ctx.fillStyle = c.jacket;
    ctx.fillRect(-w / 2 + 3, -h + 19 + bob, w - 6, h - 25);

    // Belt and buckle
    ctx.fillStyle = '#221105';
    ctx.fillRect(-w / 2 + 2, -18 + bob, w - 4, 3);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-1, -18 + bob, 4, 3);

    // Scarf / Hero Cape (with fluttering flow)
    ctx.fillStyle = '#a02020';
    ctx.fillRect(-w / 2 + 2, -h + 16 + bob, w - 4, 4);
    ctx.fillStyle = c.scarf;
    ctx.fillRect(-w / 2 + 3, -h + 16 + bob, w - 6, 3);

    // Fluttering tails
    const scarfFlow = this.animState === 'run' ? Math.sin(this.animTimer * 14) * 5 : Math.sin(this.animTimer * 4) * 2;
    ctx.fillStyle = c.scarf;
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 1, -h + 17 + bob);
    ctx.lineTo(-w / 2 - 8 + scarfFlow, -h + 19 + bob);
    ctx.lineTo(-w / 2 - 6 + scarfFlow * 1.2, -h + 27 + bob);
    ctx.lineTo(-w / 2 - 1, -h + 22 + bob);
    ctx.closePath();
    ctx.fill();

    // Arms & Hands
    ctx.fillStyle = c.jacket;
    if (this.animState === 'run') {
      const armSwing = Math.sin(this.animTimer * 12) * 4;
      ctx.fillRect(-w / 2 - 2, -h + 21 + bob + armSwing, 5, 10);
      ctx.fillRect(w / 2 - 3, -h + 21 + bob - armSwing, 5, 10);
      ctx.fillStyle = c.skin;
      ctx.fillRect(-w / 2 - 1, -h + 30 + bob + armSwing, 4, 3);
      ctx.fillRect(w / 2 - 2, -h + 30 + bob - armSwing, 4, 3);
    } else if (this.animState === 'attack') {
      ctx.fillRect(w / 2 - 2, -h + 19 + bob, 9, 6);
      ctx.fillRect(-w / 2 - 2, -h + 21 + bob, 5, 10);
      ctx.fillStyle = c.skin;
      ctx.fillRect(w / 2 + 6, -h + 20 + bob, 4, 4);
    } else if (this.crouching) {
      ctx.fillRect(-w / 2 - 1, -h + 23 + bob, 5, 8);
      ctx.fillRect(w / 2 - 4, -h + 23 + bob, 5, 8);
      ctx.fillStyle = c.skin;
      ctx.fillRect(-w / 2, -h + 30 + bob, 4, 3);
      ctx.fillRect(w / 2 - 3, -h + 30 + bob, 4, 3);
    } else {
      ctx.fillRect(-w / 2 - 2, -h + 21 + bob, 5, 11);
      ctx.fillRect(w / 2 - 3, -h + 21 + bob, 5, 11);
      ctx.fillStyle = c.skin;
      ctx.fillRect(-w / 2 - 1, -h + 31 + bob, 4, 3);
      ctx.fillRect(w / 2 - 2, -h + 31 + bob, 4, 3);
    }

    // Head
    ctx.fillStyle = c.skin;
    ctx.fillRect(-w / 2 + 5, -h + 4 + bob, w - 10, 14);

    // Hair with locks & gradient tone
    ctx.fillStyle = '#2d1505';
    ctx.fillRect(-w / 2 + 4, -h + 2 + bob, w - 8, 5);
    ctx.fillStyle = c.hair;
    ctx.fillRect(-w / 2 + 5, -h + 3 + bob, w - 9, 4);
    ctx.fillRect(-w / 2 + 3, -h + 5 + bob, 4, 7);
    ctx.fillStyle = '#6d4020'; // hair highlight
    ctx.fillRect(-w / 2 + 7, -h + 3 + bob, 4, 2);

    // Eyes with white highlight shine
    const blink = Math.floor(this.animTimer * 3) % 9 === 0 && this.animState === 'idle';
    if (!blink) {
      // Eye base
      ctx.fillStyle = c.eye;
      ctx.fillRect(w / 2 - 9, -h + 8 + bob, 3, 4);
      ctx.fillRect(w / 2 - 14, -h + 8 + bob, 3, 4);
      // Iris shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w / 2 - 9, -h + 8 + bob, 1, 1);
      ctx.fillRect(w / 2 - 14, -h + 8 + bob, 1, 1);
    } else {
      ctx.fillStyle = c.eye;
      ctx.fillRect(w / 2 - 9, -h + 10 + bob, 3, 1);
      ctx.fillRect(w / 2 - 14, -h + 10 + bob, 3, 1);
    }

    // Mouth / Expression
    if (this.animState === 'hurt') {
      ctx.fillStyle = '#8a2020';
      ctx.fillRect(w / 2 - 11, -h + 13 + bob, 4, 2);
    } else if (this.animState === 'victory') {
      ctx.fillStyle = '#8a2020';
      ctx.fillRect(w / 2 - 12, -h + 13 + bob, 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w / 2 - 11, -h + 13 + bob, 4, 1);
    } else {
      ctx.fillStyle = '#a05040';
      ctx.fillRect(w / 2 - 11, -h + 14 + bob, 3, 1);
    }
  }

  getAttackHitbox() {
    if (this.attackTimer <= 0) return null;
    return this.attackHitbox;
  }

  get isInvincible(): boolean {
    return this.invincibilityTimer > 0 || this.starPowerTimer > 0;
  }
}
