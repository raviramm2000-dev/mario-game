import type { AABB } from './types';
import { aabbIntersect } from './utils';

export interface CollisionResult {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  platform: AABB | null;
}

export interface SolidObject extends AABB {
  type?: string;
  oneWay?: boolean;
  breakable?: boolean;
  slippery?: boolean;
  damaging?: boolean;
  vx?: number;
  vy?: number;
  prevX?: number;
  prevY?: number;
}

export class CollisionSystem {
  resolveCollision(
    entity: AABB & { vx: number; vy: number; onGround: boolean; prevX: number; prevY: number },
    solids: SolidObject[]
  ): CollisionResult {
    const result: CollisionResult = { top: false, bottom: false, left: false, right: false, platform: null };

    for (const solid of solids) {
      if (solid.oneWay) {
        const prevBottom = entity.prevY + entity.height;
        const currBottom = entity.y + entity.height;
        if (entity.vy >= 0 && prevBottom <= solid.y + 2 && currBottom >= solid.y) {
          if (entity.x + entity.width > solid.x && entity.x < solid.x + solid.width) {
            entity.y = solid.y - entity.height;
            entity.vy = 0;
            entity.onGround = true;
            result.bottom = true;
            result.platform = solid;
          }
        }
        continue;
      }

      if (!aabbIntersect(entity, solid)) continue;

      const prevLeft = entity.prevX;
      const prevRight = entity.prevX + entity.width;
      const prevTop = entity.prevY;
      const prevBottom = entity.prevY + entity.height;

      const solidLeft = solid.x;
      const solidRight = solid.x + solid.width;
      const solidTop = solid.y;
      const solidBottom = solid.y + solid.height;

      if (entity.vy > 0 && prevBottom <= solidTop + 1) {
        entity.y = solidTop - entity.height;
        entity.vy = 0;
        entity.onGround = true;
        result.bottom = true;
        result.platform = solid;
      } else if (entity.vy < 0 && prevTop >= solidBottom - 1) {
        entity.y = solidBottom;
        entity.vy = 0;
        result.top = true;
      } else if (entity.vx > 0 && prevRight <= solidLeft + 1) {
        entity.x = solidLeft - entity.width;
        entity.vx = 0;
        result.right = true;
      } else if (entity.vx < 0 && prevLeft >= solidRight - 1) {
        entity.x = solidRight;
        entity.vx = 0;
        result.left = true;
      } else {
        const overlapX = Math.min(entity.x + entity.width - solid.x, solid.x + solid.width - entity.x);
        const overlapY = Math.min(entity.y + entity.height - solid.y, solid.y + solid.height - entity.y);
        if (overlapX < overlapY) {
          if (entity.x + entity.width / 2 < solid.x + solid.width / 2) {
            entity.x = solidLeft - entity.width;
          } else {
            entity.x = solidRight;
          }
          entity.vx = 0;
        } else {
          if (entity.y + entity.height / 2 < solid.y + solid.height / 2) {
            entity.y = solidTop - entity.height;
            entity.vy = 0;
            entity.onGround = true;
            result.bottom = true;
            result.platform = solid;
          } else {
            entity.y = solidBottom;
            entity.vy = 0;
            result.top = true;
          }
        }
      }
    }

    return result;
  }

  checkOverlap(a: AABB, b: AABB): boolean {
    return aabbIntersect(a, b);
  }
}
