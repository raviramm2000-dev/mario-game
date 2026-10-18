export const GAME_CONFIG = {
  gravity: 2000,
  playerSpeed: 280,
  playerAcceleration: 1800,
  playerFriction: 1600,
  jumpForce: 680,
  maxFallSpeed: 1200,
  airControl: 0.7,
  maxLives: 3,
  maxHealth: 3,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  invincibilityTime: 1.5,
  attackCooldown: 0.35,
  attackRange: 40,
  attackDamage: 1,
  projectileSpeed: 500,
  projectileLifetime: 1.5,
  checkpointRadius: 40,
  coinValue: 10,
  starShardValue: 50,
  secretCrystalValue: 250,
  enemyDefeatScore: 100,
  levelCompleteScore: 1000,
  bossDefeatScore: 5000,
  timeWarning: 30,
  timeCritical: 10,
  baseTimeLimit: 300,
} as const;

export const VIEW = {
  width: 1280,
  height: 720,
  minWidth: 320,
  minHeight: 180,
} as const;

export const COLORS = {
  sky: ['#4a90d9', '#6ab0e9', '#8acaf5'],
  ground: ['#5a8a3a', '#4a7a2a', '#3a6a1a'],
  dirt: ['#8a6a4a', '#7a5a3a', '#6a4a2a'],
  stone: ['#888899', '#777788', '#666677'],
  ice: ['#a0e0ff', '#80c0e0', '#60a0c0'],
  crystal: ['#ff60ff', '#cc40cc', '#992099'],
  wood: ['#a07a4a', '#806a3a', '#604a2a'],
  castle: ['#666688', '#555577', '#444466'],
  lava: ['#ff4400', '#cc2200', '#991100'],
  water: ['#3380cc', '#2260aa', '#114088'],
  cloud: ['#ffffff', '#e0e0f0', '#c0c0d0'],
  metal: ['#aaaaaa', '#888888', '#666666'],
  player: {
    skin: '#f0c090',
    jacket: '#3060c0',
    jacketDark: '#2040a0',
    trousers: '#2a2a3a',
    boots: '#6a4020',
    scarf: '#c03030',
    backpack: '#8a5a2a',
    hair: '#4a2a10',
    eye: '#1a1a2a',
  },
} as const;

export const TILE_TYPES: Record<string, {
  solid: boolean;
  slippery: boolean;
  damaging: boolean;
  breakable: boolean;
  oneWay: boolean;
  colors: readonly string[] | string[];
}> = {
  grass: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.ground },
  dirt: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.dirt },
  stone: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.stone },
  ice: { solid: true, slippery: true, damaging: false, breakable: false, oneWay: false, colors: COLORS.ice },
  crystal: { solid: true, slippery: false, damaging: false, breakable: true, oneWay: false, colors: COLORS.crystal },
  wood: { solid: true, slippery: false, damaging: false, breakable: true, oneWay: false, colors: COLORS.wood },
  castle: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.castle },
  lava: { solid: false, slippery: false, damaging: true, breakable: false, oneWay: false, colors: COLORS.lava },
  water: { solid: false, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.water },
  cloud: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: true, colors: COLORS.cloud },
  metal: { solid: true, slippery: false, damaging: false, breakable: false, oneWay: false, colors: COLORS.metal },
  spike: { solid: false, slippery: false, damaging: true, breakable: false, oneWay: false, colors: ['#cccccc', '#aaaaaa', '#888888'] },
};

export const DIFFICULTY: Record<string, {
  enemySpeedMult: number;
  enemyDamageMult: number;
  timeMult: number;
  playerHealth: number;
  hazardMult: number;
}> = {
  easy: { enemySpeedMult: 0.8, enemyDamageMult: 0.5, timeMult: 1.3, playerHealth: 5, hazardMult: 0.7 },
  normal: { enemySpeedMult: 1.0, enemyDamageMult: 1.0, timeMult: 1.0, playerHealth: 3, hazardMult: 1.0 },
  hard: { enemySpeedMult: 1.3, enemyDamageMult: 1.5, timeMult: 0.8, playerHealth: 2, hazardMult: 1.3 },
};

export type DifficultyKey = 'easy' | 'normal' | 'hard';
