import { clamp, lerp } from './utils';

export class Camera {
  x = 0;
  y = 0;
  targetX = 0;
  targetY = 0;
  width: number;
  height: number;
  levelWidth: number;
  levelHeight: number;
  smoothing = 0.12;
  shakeAmount = 0;
  shakeX = 0;
  shakeY = 0;
  zoom = 1;

  constructor(viewWidth: number, viewHeight: number, levelWidth = 5000, levelHeight = 720) {
    this.width = viewWidth;
    this.height = viewHeight;
    this.levelWidth = levelWidth;
    this.levelHeight = levelHeight;
  }

  setLevelBounds(width: number, height: number): void {
    this.levelWidth = width;
    this.levelHeight = height;
  }

  follow(targetX: number, targetY: number, targetWidth: number, targetHeight: number): void {
    this.targetX = targetX + targetWidth / 2 - this.width / 2;
    this.targetY = targetY + targetHeight / 2 - this.height / 2;
  }

  update(dt: number): void {
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    this.x = clamp(this.x, 0, Math.max(0, this.levelWidth - this.width));
    this.y = clamp(this.y, 0, Math.max(0, this.levelHeight - this.height));

    if (this.shakeAmount > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= 0.85;
      if (this.shakeAmount < 0.5) this.shakeAmount = 0;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  get viewX(): number {
    return this.x + this.shakeX;
  }

  get viewY(): number {
    return this.y + this.shakeY;
  }

  setViewSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.shakeAmount = 0;
  }
}
