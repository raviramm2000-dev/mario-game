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
  health = GAME_CONFIG.maxHealth;
  lives = GAME_CONFIG.maxLives;
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
        y: this.y + 8,
        width: GAME_CONFIG.attackRange,
        height: this.height - 16,
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

    switch (this.animState) {
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

    if (this.starPowerTimer > 0) {
      ctx.globalAlpha = 0.7 + Math.sin(this.animTimer * 20) * 0.3;
    }

    ctx.save();
    ctx.translate(px + this.width / 2, py + this.height);
    if (this.facing < 0) ctx.scale(-1, 1);

    const bob = this.walkBob;
    const c = COLORS.player;

    if (this.animState === 'death') {
      ctx.rotate = ((): number => { return 0; })();
      ctx.save();
      ctx.translate(0, -this.height / 2);
      ctx.rotate(this.animFrame * 0.3);
      this.drawBody(ctx, c, 0);
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    this.drawBody(ctx, c, bob);

    if (this.animState === 'attack') {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6;
      const swingW = 16 + this.animFrame * 6;
      ctx.fillRect(this.width / 2, -this.height + 12, swingW, 6);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (this.starPowerTimer > 0) {
      ctx.globalAlpha = 0.4 + Math.sin(this.animTimer * 15) * 0.2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + this.height / 2, this.width, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.shieldActive) {
      ctx.strokeStyle = '#60a0ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + this.height / 2, this.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.hasFireOrb) {
      ctx.fillStyle = '#ff6600';
      ctx.globalAlpha = 0.5 + Math.sin(this.animTimer * 10) * 0.3;
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawBody(ctx: CanvasRenderingContext2D, c: typeof COLORS.player, bob: number): void {
    const w = this.width;
    const h = this.height;
    const legOffset = this.animState === 'run' ? Math.sin(this.animTimer * 12) * 4 : 0;

    // Boots
    ctx.fillStyle = c.boots;
    ctx.fillRect(-w / 2 + 3, -6, 8, 6);
    ctx.fillRect(w / 2 - 11, -6 + legOffset, 8, 6);

    // Trousers
    ctx.fillStyle = c.trousers;
    ctx.fillRect(-w / 2 + 3, -14, 8, 8);
    ctx.fillRect(w / 2 - 11, -14 + legOffset, 8, 8);

    // Backpack
    ctx.fillStyle = c.backpack;
    ctx.fillRect(-w / 2 - 2, -h + 16 + bob, 6, 14);

    // Jacket body
    ctx.fillStyle = c.jacket;
    ctx.fillRect(-w / 2 + 2, -h + 18 + bob, w - 4, h - 24);
    ctx.fillStyle = c.jacketDark;
    ctx.fillRect(-w / 2 + 2, -h + 18 + bob, w - 4, 4);

    // Scarf
    ctx.fillStyle = c.scarf;
    ctx.fillRect(-w / 2 + 2, -h + 16 + bob, w - 4, 4);
    const scarfFlow = this.animState === 'run' ? Math.sin(this.animTimer * 12) * 3 : Math.sin(this.animTimer * 3) * 1;
    ctx.fillRect(-w / 2 - 4 + scarfFlow, -h + 18 + bob, 4, 8);

    // Arms
    ctx.fillStyle = c.jacket;
    if (this.animState === 'run') {
      const armSwing = Math.sin(this.animTimer * 12) * 3;
      ctx.fillRect(-w / 2 - 1, -h + 22 + bob + armSwing, 5, 10);
      ctx.fillRect(w / 2 - 4, -h + 22 + bob - armSwing, 5, 10);
    } else if (this.animState === 'attack') {
      ctx.fillRect(w / 2 - 2, -h + 20 + bob, 8, 6);
      ctx.fillRect(-w / 2 - 1, -h + 22 + bob, 5, 10);
    } else if (this.crouching) {
      ctx.fillRect(-w / 2 - 1, -h + 24 + bob, 5, 8);
      ctx.fillRect(w / 2 - 4, -h + 24 + bob, 5, 8);
    } else {
      ctx.fillRect(-w / 2 - 1, -h + 22 + bob, 5, 12);
      ctx.fillRect(w / 2 - 4, -h + 22 + bob, 5, 12);
    }

    // Head
    ctx.fillStyle = c.skin;
    ctx.fillRect(-w / 2 + 5, -h + 4 + bob, w - 10, 14);

    // Hair
    ctx.fillStyle = c.hair;
    ctx.fillRect(-w / 2 + 5, -h + 2 + bob, w - 10, 4);
    ctx.fillRect(-w / 2 + 3, -h + 4 + bob, 4, 6);

    // Eyes
    ctx.fillStyle = c.eye;
    const blink = Math.floor(this.animTimer * 3) % 8 === 0 && this.animState === 'idle';
    if (!blink) {
      ctx.fillRect(w / 2 - 8, -h + 8 + bob, 2, 2);
      ctx.fillRect(w / 2 - 12, -h + 8 + bob, 2, 2);
    } else {
      ctx.fillRect(w / 2 - 8, -h + 9 + bob, 2, 1);
      ctx.fillRect(w / 2 - 12, -h + 9 + bob, 2, 1);
    }

    // Mouth
    if (this.animState === 'hurt') {
      ctx.fillRect(w / 2 - 10, -h + 13 + bob, 4, 1);
    } else if (this.animState === 'victory') {
      ctx.fillRect(w / 2 - 11, -h + 12 + bob, 6, 2);
    } else {
      ctx.fillRect(w / 2 - 10, -h + 13 + bob, 3, 1);
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
