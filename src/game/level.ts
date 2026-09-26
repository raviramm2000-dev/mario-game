import type { LevelData, PlatformData, EnemySpawnData, PowerupSpawnData, HazardData, MovingPlatformData } from './types';
import { GAME_CONFIG } from './config';

function makeGround(width: number, height: number, y: number, type = 'grass'): PlatformData[] {
  const plats: PlatformData[] = [];
  plats.push({ x: 0, y, width, height, type });
  return plats;
}

function makePlatform(x: number, y: number, w: number, h: number, type = 'grass'): PlatformData {
  return { x, y, width: w, height: h, type };
}

export interface WorldTheme {
  name: string;
  bgGradient: [string, string, string];
  hills: string;
  hillsDark: string;
  clouds: string;
  accent: string;
  groundType: string;
  platformType: string;
  music: 'world1' | 'world2' | 'world3' | 'world4' | 'world5';
}

export const WORLD_THEMES: WorldTheme[] = [
  {
    name: 'Green Meadows',
    bgGradient: ['#4a90d9', '#6ab0e9', '#a0d8f0'],
    hills: '#5a9a3a',
    hillsDark: '#3a7a2a',
    clouds: '#ffffff',
    accent: '#7ec850',
    groundType: 'grass',
    platformType: 'grass',
    music: 'world1',
  },
  {
    name: 'Crystal Caves',
    bgGradient: ['#1a0a2a', '#2a1a3a', '#3a2a4a'],
    hills: '#4a3a5a',
    hillsDark: '#2a1a3a',
    clouds: '#6a5a7a',
    accent: '#cc44ff',
    groundType: 'stone',
    platformType: 'crystal',
    music: 'world2',
  },
  {
    name: 'Sky Islands',
    bgGradient: ['#88ccff', '#aae0ff', '#cceeff'],
    hills: '#aaddff',
    hillsDark: '#88ccee',
    clouds: '#ffffff',
    accent: '#ffffff',
    groundType: 'cloud',
    platformType: 'cloud',
    music: 'world3',
  },
  {
    name: 'Shadow Forest',
    bgGradient: ['#0a1a0a', '#1a2a1a', '#2a3a2a'],
    hills: '#1a3a1a',
    hillsDark: '#0a2a0a',
    clouds: '#2a3a2a',
    accent: '#44aa44',
    groundType: 'wood',
    platformType: 'wood',
    music: 'world4',
  },
  {
    name: 'Star Castle',
    bgGradient: ['#2a0a1a', '#3a1a2a', '#4a2a3a'],
    hills: '#4a2a3a',
    hillsDark: '#3a1a2a',
    clouds: '#5a3a4a',
    accent: '#ff6600',
    groundType: 'castle',
    platformType: 'castle',
    music: 'world5',
  },
];

export function generateLevel(world: number, level: number): LevelData {
  const theme = WORLD_THEMES[world - 1];
  const isBoss = level === 4;
  const levelWidth = 4000 + level * 500 + world * 200;
  const levelHeight = 720;
  const groundY = 620;
  const timeLimit = Math.round(GAME_CONFIG.baseTimeLimit * (1.2 - (world - 1) * 0.05));

  const platforms: PlatformData[] = [];
  const enemies: EnemySpawnData[] = [];
  const coins: { x: number; y: number }[] = [];
  const starShards: { x: number; y: number }[] = [];
  const secretCrystals: { x: number; y: number }[] = [];
  const powerups: PowerupSpawnData[] = [];
  const checkpoints: { x: number; y: number }[] = [];
  const hazards: HazardData[] = [];
  const movingPlatforms: MovingPlatformData[] = [];

  if (isBoss) {
    platforms.push(...makeGround(levelWidth, 100, groundY, theme.groundType));
    platforms.push(makePlatform(0, 0, 50, groundY, 'castle'));
    platforms.push(makePlatform(levelWidth - 50, 0, 50, groundY, 'castle'));

    if (world === 5) {
      platforms.push(makePlatform(200, 400, 100, 20, 'castle'));
      platforms.push(makePlatform(levelWidth - 300, 400, 100, 20, 'castle'));
    }

    const bossType = world === 1 ? 'rockGolem' : world === 3 ? 'skyDragon' : 'voidKing';
    enemies.push({ type: bossType === 'rockGolem' ? 'slime' : 'bat', x: levelWidth / 2, y: 300, patrolRange: 200 });

    coins.push({ x: 200, y: 500 });
    coins.push({ x: levelWidth - 250, y: 500 });
    powerups.push({ type: 'shieldCrystal', x: 300, y: 500 });
    powerups.push({ type: 'fireOrb', x: levelWidth - 350, y: 500 });

    return {
      name: `World ${world} - Boss`,
      world, level, width: levelWidth, height: levelHeight,
      spawn: { x: 100, y: 500 },
      theme: theme.name, timeLimit, isBoss: true,
      platforms, tiles: [], enemies, coins, starShards, secretCrystals,
      powerups, checkpoints, hazards, movingPlatforms,
      finish: { x: levelWidth - 100, y: groundY - 80 },
      bgTheme: theme.name, dayNight: 'day', weather: 'none',
    };
  }

  platforms.push(...makeGround(levelWidth, 100, groundY, theme.groundType));

  const numPlatforms = 6 + level * 2 + world;
  let lastX = 400;
  for (let i = 0; i < numPlatforms; i++) {
    const gap = 150 + Math.random() * 150;
    const px = lastX + gap;
    const py = groundY - 80 - Math.random() * 200;
    const pw = 80 + Math.random() * 120;
    platforms.push(makePlatform(px, py, pw, 20, theme.platformType));
    lastX = px + pw;

    for (let j = 0; j < Math.floor(pw / 30); j++) {
      coins.push({ x: px + 10 + j * 30, y: py - 30 });
    }

    if (Math.random() < 0.2) {
      powerups.push({ type: pickPowerup(), x: px + pw / 2, y: py - 40 });
    }
  }

  if (world >= 2) {
    for (let i = 0; i < 3 + level; i++) {
      const hx = 800 + Math.random() * (levelWidth - 1600);
      hazards.push({ x: hx, y: groundY - 30, width: 40, height: 30, type: 'spike' });
    }
  }

  if (world >= 3) {
    for (let i = 0; i < 2; i++) {
      movingPlatforms.push({
        x: 600 + i * 800, y: groundY - 200, width: 100, height: 20,
        type: theme.platformType, axis: 'x', range: 200, speed: 80, startOffset: i * 0.5,
      });
    }
  }

  if (world >= 4) {
    for (let i = 0; i < 2; i++) {
      movingPlatforms.push({
        x: 1000 + i * 1000, y: groundY - 150, width: 80, height: 20,
        type: theme.platformType, axis: 'y', range: 100, speed: 60, startOffset: i,
      });
    }
  }

  const numEnemies = 3 + level + world;
  for (let i = 0; i < numEnemies; i++) {
    const ex = 500 + (i + 1) * (levelWidth - 600) / (numEnemies + 1);
    const enemyType = pickEnemy(world, level);
    enemies.push({ type: enemyType, x: ex, y: groundY - 40, patrolRange: 80 + Math.random() * 120 });
  }

  for (let i = 0; i < 8 + level * 2; i++) {
    coins.push({ x: 200 + Math.random() * (levelWidth - 400), y: groundY - 40 - Math.random() * 200 });
  }

  starShards.push({ x: levelWidth * 0.3, y: groundY - 200 });
  starShards.push({ x: levelWidth * 0.6, y: groundY - 250 });
  starShards.push({ x: levelWidth * 0.85, y: groundY - 150 });

  secretCrystals.push({ x: levelWidth * 0.15, y: groundY - 300 });
  secretCrystals.push({ x: levelWidth * 0.5, y: groundY - 350 });
  secretCrystals.push({ x: levelWidth * 0.8, y: groundY - 280 });

  checkpoints.push({ x: levelWidth * 0.3, y: groundY - 60 });
  checkpoints.push({ x: levelWidth * 0.6, y: groundY - 60 });

  if (world === 1 && level === 1) {
    powerups.push({ type: 'starPower', x: 300, y: groundY - 100 });
  }

  return {
    name: `${theme.name} ${world}-${level}`,
    world, level, width: levelWidth, height: levelHeight,
    spawn: { x: 100, y: groundY - 80 },
    theme: theme.name, timeLimit,
    platforms, tiles: [], enemies, coins, starShards, secretCrystals,
    powerups, checkpoints, hazards, movingPlatforms,
    finish: { x: levelWidth - 80, y: groundY - 80 },
    bgTheme: theme.name,
    dayNight: world >= 4 ? 'night' : world === 3 ? 'sunset' : 'day',
    weather: world === 4 ? 'fog' : 'none',
  };
}

function pickEnemy(world: number, level: number): string {
  const pool: string[] = ['slime'];
  if (world >= 1) pool.push('slime');
  if (world >= 2) pool.push('bat', 'spikeBug');
  if (world >= 3) pool.push('bat');
  if (world >= 4) pool.push('shadowKnight');
  if (world >= 5) pool.push('fireSpirit');
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickPowerup(): string {
  const types = ['starPower', 'fireOrb', 'shieldCrystal', 'speedCrystal', 'giantCrystal'];
  return types[Math.floor(Math.random() * types.length)];
}

export const TOTAL_LEVELS = 20;
export const WORLDS = 5;
export const LEVELS_PER_WORLD = 4;

export function getLevelId(world: number, level: number): string {
  return `${world}-${level}`;
}

export function getBossType(world: number): 'rockGolem' | 'skyDragon' | 'voidKing' {
  if (world === 1) return 'rockGolem';
  if (world === 3) return 'skyDragon';
  return 'voidKing';
}
