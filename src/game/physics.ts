import { GAME_CONFIG } from './config';

export class Physics {
  gravity: number;

  constructor(gravity = GAME_CONFIG.gravity) {
    this.gravity = gravity;
  }

  applyGravity(entity: { vy: number; onGround: boolean }, dt: number): void {
    if (!entity.onGround) {
      entity.vy += this.gravity * dt;
      const maxFall = GAME_CONFIG.maxFallSpeed;
      if (entity.vy > maxFall) entity.vy = maxFall;
    }
  }

  applyHorizontal(
    entity: { vx: number; onGround: boolean },
    dir: number,
    dt: number,
    speed: number = GAME_CONFIG.playerSpeed,
    accel: number = GAME_CONFIG.playerAcceleration,
    friction: number = GAME_CONFIG.playerFriction,
    airControl: number = GAME_CONFIG.airControl
  ): void {
    if (dir !== 0) {
      const a = entity.onGround ? accel : accel * airControl;
      entity.vx += dir * a * dt;
      const max = speed;
      if (entity.vx > max) entity.vx = max;
      if (entity.vx < -max) entity.vx = -max;
    } else if (entity.onGround) {
      const fr = friction * dt;
      if (entity.vx > 0) entity.vx = Math.max(0, entity.vx - fr);
      else if (entity.vx < 0) entity.vx = Math.min(0, entity.vx + fr);
    } else {
      const fr = friction * 0.3 * dt;
      if (entity.vx > 0) entity.vx = Math.max(0, entity.vx - fr);
      else if (entity.vx < 0) entity.vx = Math.min(0, entity.vx + fr);
    }
  }

  jump(entity: { vy: number; onGround: boolean }, force: number = GAME_CONFIG.jumpForce): boolean {
    if (entity.onGround) {
      entity.vy = -force;
      entity.onGround = false;
      return true;
    }
    return false;
  }

  variableJump(entity: { vy: number }, jumpHeld: boolean): void {
    if (!jumpHeld && entity.vy < -200) {
      entity.vy = -200;
    }
  }
}
