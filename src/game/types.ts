export interface Vec2 { x: number; y: number; }

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Entity extends AABB {
  vx: number;
  vy: number;
  alive: boolean;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;
}

export type GameState =
  | 'LOADING'
  | 'MAIN_MENU'
  | 'PLAYER_NAME'
  | 'STORY_INTRO'
  | 'WORLD_MAP'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'LEVEL_COMPLETE'
  | 'BOSS_FIGHT'
  | 'VICTORY'
  | 'SETTINGS'
  | 'CONTROLS'
  | 'CREDITS'
  | 'ACHIEVEMENTS'
  | 'LEADERBOARD'
  | 'LEVEL_SELECT';

export interface LevelData {
  name: string;
  world: number;
  level: number;
  width: number;
  height: number;
  spawn: Vec2;
  theme: string;
  timeLimit: number;
  isBoss?: boolean;
  platforms: PlatformData[];
  tiles: TileData[];
  enemies: EnemySpawnData[];
  coins: Vec2[];
  starShards: Vec2[];
  secretCrystals: Vec2[];
  powerups: PowerupSpawnData[];
  checkpoints: Vec2[];
  hazards: HazardData[];
  movingPlatforms: MovingPlatformData[];
  finish: Vec2;
  bgTheme: string;
  dayNight?: 'day' | 'sunset' | 'night';
  weather?: 'none' | 'rain' | 'snow' | 'fog';
}

export interface PlatformData {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface TileData {
  col: number;
  row: number;
  type: string;
}

export interface EnemySpawnData {
  type: string;
  x: number;
  y: number;
  patrolRange?: number;
}

export interface PowerupSpawnData {
  type: string;
  x: number;
  y: number;
}

export interface HazardData {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface MovingPlatformData {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  axis: 'x' | 'y';
  range: number;
  speed: number;
  startOffset?: number;
}

export interface SaveData {
  playerName: string;
  currentWorld: number;
  currentLevel: number;
  unlockedLevels: number;
  totalCoins: number;
  totalScore: number;
  totalCrystals: number;
  collectedCrystals: Record<string, number[]>;
  levelStars: Record<string, number>;
  achievements: string[];
  settings: GameSettings;
  leaderboard: LeaderboardEntry[];
}

export interface HudData {
  score: number;
  coins: number;
  lives: number;
  health: number;
  world: string;
  time: number;
  crystals: number;
  starPower: boolean;
  fireOrb: boolean;
  shield: boolean;
}

export interface LevelCompleteData {
  score: number;
  coins: number;
  enemies: number;
  crystals: number;
  timeBonus: number;
  totalScore: number;
  stars: number;
  world: number;
  level: number;
}

export interface VictoryData {
  finalScore: number;
  totalCoins: number;
  totalCrystals: number;
  levelsCompleted: number;
  timePlayed: string;
}

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high' | 'ultra';

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  particles: boolean;
  difficulty: DifficultyKey;
  controlLayout: 'default' | 'lefty';
  graphicsQuality?: GraphicsQuality;
}

export type DifficultyKey = 'easy' | 'normal' | 'hard';

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  level: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Complete your first level', icon: 'boot' },
  { id: 'coin_collector', name: 'Coin Collector', description: 'Collect 100 coins', icon: 'coin' },
  { id: 'enemy_hunter', name: 'Enemy Hunter', description: 'Defeat 50 enemies', icon: 'sword' },
  { id: 'explorer', name: 'Explorer', description: 'Find 10 secret areas', icon: 'compass' },
  { id: 'crystal_master', name: 'Crystal Master', description: 'Collect 20 crystals', icon: 'gem' },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Defeat your first boss', icon: 'crown' },
  { id: 'star_hero', name: 'Star Hero', description: 'Complete the entire game', icon: 'star' },
];
