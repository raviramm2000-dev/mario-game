import { GAME_CONFIG, TILE_TYPES, DIFFICULTY } from './config';
import type { GameState, SaveData, GameSettings, LevelData } from './types';
import { InputSystem } from './input';
import { AudioSystem } from './audio';
import { Physics } from './physics';
import { CollisionSystem, SolidObject } from './collision';
import { Camera } from './camera';
import { ParticleSystem } from './particles';
import { Player } from './player';
import { Enemy } from './enemy';
import { Boss, BossType } from './boss';
import { Projectile } from './projectile';
import { Collectible } from './collectibles';
import { PowerUp } from './powerups';
import { BackgroundRenderer, renderPlatform, renderHazard, renderCheckpoint, renderFinish } from './renderer';
import { generateLevel, WORLD_THEMES, getBossType, TOTAL_LEVELS } from './level';
import { SaveSystem } from './saveSystem';
import { clamp, formatTime, lerp } from './utils';

export interface GameCallbacks {
  onStateChange: (state: GameState) => void;
  onHudUpdate: (hud: HudData) => void;
  onGameOver: (data: { score: number; coins: number; level: string }) => void;
  onLevelComplete: (data: LevelCompleteData) => void;
  onVictory: (data: VictoryData) => void;
  onAchievement: (name: string) => void;
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

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState = 'LOADING';
  private callbacks: GameCallbacks;
  private input: InputSystem;
  private audio: AudioSystem;
  private physics: Physics;
  private collision: CollisionSystem;
  private camera: Camera;
  private particles: ParticleSystem;
  private bgRenderer: BackgroundRenderer | null = null;
  private player: Player | null = null;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private projectiles: Projectile[] = [];
  private collectibles: Collectible[] = [];
  private powerups: PowerUp[] = [];
  private solids: SolidObject[] = [];
  private movingPlatforms: SolidObject[] = [];
  private checkpoints: { x: number; y: number; activated: boolean }[] = [];
  private currentLevel: LevelData | null = null;
  private currentWorld = 1;
  private currentLevelNum = 1;
  private score = 0;
  private coins = 0;
  private crystalsCollected = 0;
  private enemiesDefeated = 0;
  private timeLeft = 300;
  private levelStartTime = 0;
  private saveData: SaveData;
  private settings: GameSettings;
  private debugMode = false;
  private lastTime = 0;
  private rafId: number | null = null;
  private running = false;
  private fps = 60;
  private fpsTimer = 0;
  private fpsCount = 0;
  private viewWidth = 1280;
  private viewHeight = 720;
  private scale = 1;
  private screenFlash = 0;
  private screenFlashColor = '#fff';
  private fadeAlpha = 0;
  private fadeDir = 0;
  private pendingAction: (() => void) | null = null;
  private hitstop = 0;
  private totalEnemiesDefeated = 0;
  private totalCoinsCollected = 0;
  private totalCrystalsCollected = 0;
  private levelsCompleted = 0;
  private gameStartTime = 0;
  private transitionTimer = 0;
  private isBossLevel = false;
  private bossDefeated = false;
  private levelCompleteTimer = 0;
  private victoryTimer = 0;
  private bossWarningTimer = 0;
  private bossDelayedHealth = 0;
  private levelTransitionTimer = 0;
  private lowFpsSeconds = 0;
  private autoQualityTier: 'low' | 'medium' | 'high' | 'ultra' = 'high';

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks, saveData: SaveData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    this.saveData = saveData;
    this.settings = saveData.settings;
    this.input = new InputSystem();
    this.audio = new AudioSystem();
    this.physics = new Physics();
    this.collision = new CollisionSystem();
    this.camera = new Camera(this.viewWidth, this.viewHeight);
    this.particles = new ParticleSystem();
    this.particles.setEnabled(this.settings.particles);
    this.resizeCanvas();

    this.input.setCallbacks(
      () => this.toggleFullscreen(),
      () => { this.debugMode = !this.debugMode; }
    );
  }

  init(): void {
    this.audio.init();
    this.audio.setVolumes(this.settings.masterVolume, this.settings.musicVolume, this.settings.sfxVolume);
    this.setState('MAIN_MENU');
    this.audio.playMusic('menu');
    this.lastTime = performance.now() / 1000;
    this.running = true;
    this.gameStartTime = performance.now() / 1000;
    this.loop();
  }

  resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const container = this.canvas.parentElement;
    const cw = container?.clientWidth || window.innerWidth;
    const ch = container?.clientHeight || window.innerHeight;

    // HD Canvas System: Base logical height = 720
    // Dynamic aspect ratio between 16:9 (1280x720) and 20:9 (1600x720) for modern mobile landscape screens
    const screenAspect = cw / ch;
    const aspect = Math.max(16 / 9, Math.min(20 / 9, screenAspect));
    const logicalHeight = 720;
    const logicalWidth = Math.round(logicalHeight * aspect);

    let cssW = cw;
    let cssH = ch;
    if (cssW / cssH > aspect) {
      cssW = cssH * aspect;
    } else {
      cssH = cssW / aspect;
    }

    this.canvas.width = Math.round(logicalWidth * dpr);
    this.canvas.height = Math.round(logicalHeight * dpr);
    this.canvas.style.width = `${Math.round(cssW)}px`;
    this.canvas.style.height = `${Math.round(cssH)}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.viewWidth = logicalWidth;
    this.viewHeight = logicalHeight;
    this.camera.setViewSize(logicalWidth, logicalHeight);
    if (this.bgRenderer) this.bgRenderer.setViewSize(logicalWidth, logicalHeight);
  }

  private setState(state: GameState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.audio.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);
    this.particles.setEnabled(settings.particles);
    SaveSystem.saveSettings(settings);
    this.saveData.settings = settings;
    SaveSystem.saveSave(this.saveData);
  }

  private updateHud(): void {
    if (!this.player) return;
    const hud: HudData = {
      score: this.score,
      coins: this.coins,
      lives: this.player.lives,
      health: this.player.health,
      world: `${this.currentWorld}-${this.currentLevelNum}`,
      time: this.timeLeft,
      crystals: this.crystalsCollected,
      starPower: this.player.starPowerTimer > 0,
      fireOrb: this.player.hasFireOrb,
      shield: this.player.shieldActive,
    };
    this.callbacks.onHudUpdate(hud);
  }

  startNewGame(): void {
    this.saveData = SaveSystem.resetSave();
    this.saveData.playerName = this.saveData.playerName || 'Player';
    this.currentWorld = 1;
    this.currentLevelNum = 1;
    this.score = 0;
    this.coins = 0;
    this.totalEnemiesDefeated = 0;
    this.totalCoinsCollected = 0;
    this.totalCrystalsCollected = 0;
    this.levelsCompleted = 0;
    this.setState('STORY_INTRO');
  }

  continueGame(): void {
    this.currentWorld = this.saveData.currentWorld;
    this.currentLevelNum = this.saveData.currentLevel;
    this.score = this.saveData.totalScore;
    this.coins = this.saveData.totalCoins;
    this.setState('WORLD_MAP');
  }

  startLevel(world: number, level: number): void {
    this.currentWorld = world;
    this.currentLevelNum = level;
    this.loadLevel(generateLevel(world, level));
  }

  private loadLevel(levelData: LevelData): void {
    this.currentLevel = levelData;
    this.isBossLevel = levelData.isBoss || false;
    this.bossDefeated = false;
    this.crystalsCollected = 0;
    this.enemiesDefeated = 0;
    this.timeLeft = levelData.timeLimit * (DIFFICULTY[this.settings.difficulty].timeMult);
    this.levelStartTime = performance.now() / 1000;

    this.camera.setLevelBounds(levelData.width, levelData.height);
    this.camera.reset(levelData.spawn.x - this.viewWidth / 2, levelData.spawn.y - this.viewHeight / 2);

    const theme = WORLD_THEMES[levelData.world - 1];
    this.bgRenderer = new BackgroundRenderer(theme, this.viewWidth, this.viewHeight, levelData.width, levelData.height);
    this.bgRenderer.setDayNight(levelData.dayNight || 'day');
    this.bgRenderer.setWeather(levelData.weather || 'none');

    this.solids = [];
    this.movingPlatforms = [];
    this.checkpoints = [];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.collectibles = [];
    this.powerups = [];

    for (const p of levelData.platforms) {
      const tileType = TILE_TYPES[p.type] || TILE_TYPES.stone;
      this.solids.push({
        x: p.x, y: p.y, width: p.width, height: p.height,
        type: p.type, oneWay: tileType.oneWay, breakable: tileType.breakable,
        slippery: tileType.slippery, damaging: tileType.damaging,
      });
    }

    for (const h of levelData.hazards) {
      this.solids.push({
        x: h.x, y: h.y, width: h.width, height: h.height,
        type: h.type, damaging: true, oneWay: false, breakable: false, slippery: false,
      });
    }

    for (const mp of levelData.movingPlatforms) {
      const solid: SolidObject = {
        x: mp.x, y: mp.y, width: mp.width, height: mp.height,
        type: mp.type, oneWay: false, breakable: false, slippery: false, damaging: false,
        vx: 0, vy: 0, prevX: mp.x, prevY: mp.y,
      };
      this.movingPlatforms.push(solid);
      this.solids.push(solid);
    }

    const health = DIFFICULTY[this.settings.difficulty].playerHealth;
    const speedMult = DIFFICULTY[this.settings.difficulty].enemySpeedMult;

    this.player = new Player(
      levelData.spawn.x, levelData.spawn.y,
      this.physics, this.collision,
      {
        onJump: () => { this.audio.playSound('jump'); this.particles.dust(this.player!.x + this.player!.width / 2, this.player!.y + this.player!.height, this.player!.facing); },
        onLand: () => { this.audio.playSound('land'); this.particles.landing(this.player!.x + this.player!.width / 2, this.player!.y + this.player!.height); },
        onAttack: () => { this.audio.playSound('attack'); if (this.player!.hasFireOrb) this.shootPlayerProjectile(); },
        onHurt: () => { this.audio.playSound('playerHurt'); this.screenFlash = 0.3; this.screenFlashColor = '#ff0000'; if (this.settings.screenShake) this.camera.shake(8); },
        onDeath: () => { this.audio.playSound('death'); this.particles.explosion(this.player!.x + this.player!.width / 2, this.player!.y + this.player!.height / 2, '#ff4444', 20); if (this.settings.screenShake) this.camera.shake(15); },
        onStompEnemy: (enemy) => { enemy.takeDamage(1, true); this.player!.vy = -400; this.audio.playSound('enemyDefeat'); },
      }
    );
    this.player.health = health;
    this.player.canDoubleJump = this.currentWorld >= 2;

    for (const e of levelData.enemies) {
      if (e.type === 'rockGolem' || e.type === 'skyDragon' || e.type === 'voidKing') {
        this.boss = new Boss(e.type as BossType, e.x, e.y, this.collision, this.particles, {
          onShoot: (x, y, vx, vy, owner, dmg) => this.addProjectile(x, y, vx, vy, owner as 'player' | 'enemy' | 'boss', dmg),
          onDefeat: (boss) => this.onBossDefeated(boss),
          onHurtPlayer: (dmg) => { if (this.player) this.player.takeDamage(dmg); },
          onSummon: (type, x, y) => this.summonEnemy(type, x, y),
          onShake: (amt) => { if (this.settings.screenShake) this.camera.shake(amt); },
        });
        this.bossDelayedHealth = this.boss.health;
      } else {
        this.enemies.push(new Enemy(e.type as any, e.x, e.y, this.collision, this.particles, {
          onDefeat: (enemy) => this.onEnemyDefeated(enemy),
          onPlayerContact: (enemy) => {
            if (!this.player) return;
            const playerBottom = this.player.y + this.player.height;
            const enemyTop = enemy.y;
            if (playerBottom < enemyTop + 10 && this.player.vy > 0 && enemy.canBeStomped) {
              this.player.vy = -400;
              enemy.takeDamage(1, true);
              this.audio.playSound('enemyDefeat');
            } else {
              this.player.takeDamage(enemy.type === 'spikeBug' ? 1 : 1);
            }
          },
          onShoot: (x, y, vx, vy, owner) => this.addProjectile(x, y, vx, vy, owner as 'player' | 'enemy' | 'boss'),
        }, e.patrolRange || 100, speedMult));
      }
    }

    let crystalId = 0;
    for (const c of levelData.coins) {
      this.collectibles.push(new Collectible('coin', c.x, c.y, this.particles, {
        onCoin: () => { this.coins++; this.score += GAME_CONFIG.coinValue; this.totalCoinsCollected++; this.audio.playSound('coin'); this.updateHud(); },
        onStarShard: () => {},
        onSecretCrystal: () => {},
        onGoldenStar: () => {},
      }));
    }
    for (const s of levelData.starShards) {
      this.collectibles.push(new Collectible('starShard', s.x, s.y, this.particles, {
        onCoin: () => {},
        onStarShard: () => { this.score += GAME_CONFIG.starShardValue; this.audio.playSound('star'); this.updateHud(); },
        onSecretCrystal: () => {},
        onGoldenStar: () => {},
      }));
    }
    for (const c of levelData.secretCrystals) {
      const id = crystalId++;
      this.collectibles.push(new Collectible('secretCrystal', c.x, c.y, this.particles, {
        onCoin: () => {},
        onStarShard: () => {},
        onSecretCrystal: (cid) => { this.crystalsCollected++; this.score += GAME_CONFIG.secretCrystalValue; this.totalCrystalsCollected++; this.audio.playSound('crystal'); this.updateHud(); },
        onGoldenStar: () => {},
      }, id));
    }

    for (const p of levelData.powerups) {
      this.powerups.push(new PowerUp(p.type as any, p.x, p.y, this.particles, {
        onCollect: (type) => { this.audio.playSound('powerup'); this.updateHud(); },
      }, this.player));
    }

    for (const cp of levelData.checkpoints) {
      this.checkpoints.push({ x: cp.x, y: cp.y, activated: false });
    }

    this.fadeAlpha = 1;
    this.fadeDir = -1;
    this.levelTransitionTimer = 2.8;
    if (levelData.isBoss) {
      this.bossWarningTimer = 2.5;
      if (this.settings.screenShake) this.camera.shake(12);
    } else {
      this.bossWarningTimer = 0;
    }
    this.setState('PLAYING');
    this.updateHud();

    this.audio.playMusic(levelData.isBoss ? 'boss' : theme.music);
  }

  private addProjectile(x: number, y: number, vx: number, vy: number, owner: 'player' | 'enemy' | 'boss', damage = 1): void {
    const color = owner === 'player' ? '#44ff88' : owner === 'boss' ? '#ff44ff' : '#ff6600';
    this.projectiles.push(new Projectile({
      x, y, vx, vy, damage, owner, lifetime: GAME_CONFIG.projectileLifetime, color, size: 6,
    }));
    this.audio.playSound('projectile');
  }

  private shootPlayerProjectile(): void {
    if (!this.player) return;
    const x = this.player.x + (this.player.facing > 0 ? this.player.width : 0);
    const y = this.player.y + this.player.height / 2;
    this.addProjectile(x, y, this.player.facing * GAME_CONFIG.projectileSpeed, 0, 'player');
  }

  private summonEnemy(type: string, x: number, y: number): void {
    const speedMult = DIFFICULTY[this.settings.difficulty].enemySpeedMult;
    this.enemies.push(new Enemy(type as any, x, y, this.collision, this.particles, {
      onDefeat: (enemy) => this.onEnemyDefeated(enemy),
      onPlayerContact: (enemy) => { if (this.player) this.player.takeDamage(1); },
      onShoot: (sx, sy, svx, svy, owner) => this.addProjectile(sx, sy, svx, svy, owner as 'player' | 'enemy' | 'boss'),
    }, 100, speedMult));
  }

  private onEnemyDefeated(enemy: Enemy): void {
    this.score += enemy.scoreValue;
    this.enemiesDefeated++;
    this.totalEnemiesDefeated++;
    this.audio.playSound('enemyDefeat');
    this.updateHud();
    this.checkAchievements();
  }

  private onBossDefeated(boss: Boss): void {
    this.bossDefeated = true;
    this.score += GAME_CONFIG.bossDefeatScore;
    this.audio.playSound('bossDefeat');
    this.screenFlash = 0.5;
    this.screenFlashColor = '#ffd700';
    this.updateHud();
    this.checkAchievement('boss_slayer');
    this.levelCompleteTimer = 2;
  }

  private checkAchievements(): void {
    if (this.totalCoinsCollected >= 100) this.checkAchievement('coin_collector');
    if (this.totalEnemiesDefeated >= 50) this.checkAchievement('enemy_hunter');
    if (this.totalCrystalsCollected >= 20) this.checkAchievement('crystal_master');
  }

  private checkAchievement(id: string): void {
    if (SaveSystem.unlockAchievement(this.saveData, id)) {
      const ach = SaveSystem.getAchievements().find(a => a.id === id);
      if (ach) this.callbacks.onAchievement(ach.name);
    }
  }

  pause(): void {
    if (this.state === 'PLAYING' || this.state === 'BOSS_FIGHT') {
      this.setState('PAUSED');
      this.audio.stopMusic();
    }
  }

  resume(): void {
    if (this.state === 'PAUSED') {
      this.setState(this.isBossLevel ? 'BOSS_FIGHT' : 'PLAYING');
      if (this.currentLevel) {
        const theme = WORLD_THEMES[this.currentLevel.world - 1];
        this.audio.playMusic(this.isBossLevel ? 'boss' : theme.music);
      }
    }
  }

  restartLevel(): void {
    if (this.currentLevel) this.loadLevel(this.currentLevel);
  }

  goToMainMenu(): void {
    this.audio.playMusic('menu');
    this.setState('MAIN_MENU');
  }

  goToWorldMap(): void {
    this.audio.playMusic('menu');
    this.setState('WORLD_MAP');
  }

  nextLevel(): void {
    let nextW = this.currentWorld;
    let nextL = this.currentLevelNum + 1;
    if (nextL > 4) {
      nextW++;
      nextL = 1;
    }
    if (nextW > 5) {
      this.triggerVictory();
      return;
    }
    this.saveData.currentWorld = nextW;
    this.saveData.currentLevel = nextL;
    this.saveData.unlockedLevels = Math.max(this.saveData.unlockedLevels, (nextW - 1) * 4 + nextL);
    SaveSystem.saveSave(this.saveData);
    this.startLevel(nextW, nextL);
  }

  private triggerVictory(): void {
    this.checkAchievement('star_hero');
    const timePlayed = formatTime(performance.now() / 1000 - this.gameStartTime);
    this.audio.playMusic('victory');
    this.setState('VICTORY');
    this.callbacks.onVictory({
      finalScore: this.score,
      totalCoins: this.totalCoinsCollected,
      totalCrystals: this.totalCrystalsCollected,
      levelsCompleted: this.levelsCompleted,
      timePlayed,
    });
  }

  setPlayerName(name: string): void {
    this.saveData.playerName = name;
    SaveSystem.saveSave(this.saveData);
  }

  getSaveData(): SaveData {
    return this.saveData;
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now() / 1000;
    let dt = now - this.lastTime;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    this.fpsCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.fpsCount;
      this.fpsCount = 0;
      this.fpsTimer = 0;

      // Auto graphics quality adjustment
      if (this.settings.graphicsQuality === 'auto' || !this.settings.graphicsQuality) {
        if (this.fps < 45) {
          this.lowFpsSeconds += 1;
          if (this.lowFpsSeconds >= 3) {
            if (this.autoQualityTier === 'ultra') this.autoQualityTier = 'high';
            else if (this.autoQualityTier === 'high') this.autoQualityTier = 'medium';
            else if (this.autoQualityTier === 'medium') this.autoQualityTier = 'low';
            this.applyGraphicsTier(this.autoQualityTier);
            this.lowFpsSeconds = 0;
          }
        } else {
          this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - 1);
        }
      }
    }

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const input = this.input.getState();

    if (input.pausePressed) {
      if (this.state === 'PLAYING' || this.state === 'BOSS_FIGHT') this.pause();
      else if (this.state === 'PAUSED') this.resume();
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.state !== 'PLAYING' && this.state !== 'BOSS_FIGHT') {
      if (this.bgRenderer) this.bgRenderer.update(dt);
      if (this.fadeDir !== 0) {
        this.fadeAlpha += this.fadeDir * dt * 2;
        if (this.fadeDir < 0 && this.fadeAlpha <= 0) { this.fadeAlpha = 0; this.fadeDir = 0; }
        if (this.fadeDir > 0 && this.fadeAlpha >= 1) { this.fadeAlpha = 1; this.fadeDir = 0; if (this.pendingAction) { this.pendingAction(); this.pendingAction = null; } }
      }
      if (this.screenFlash > 0) this.screenFlash -= dt;
      return;
    }

    if (this.fadeDir !== 0) {
      this.fadeAlpha += this.fadeDir * dt * 2;
      if (this.fadeDir < 0 && this.fadeAlpha <= 0) { this.fadeAlpha = 0; this.fadeDir = 0; }
      if (this.fadeDir > 0 && this.fadeAlpha >= 1) { this.fadeAlpha = 1; this.fadeDir = 0; if (this.pendingAction) { this.pendingAction(); this.pendingAction = null; } }
    }

    if (this.bossWarningTimer > 0) this.bossWarningTimer -= dt;
    if (this.levelTransitionTimer > 0) this.levelTransitionTimer -= dt;
    if (this.boss) {
      this.bossDelayedHealth = lerp(this.bossDelayedHealth, this.boss.health, dt * 3.5);
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.player && this.player.alive) {
        this.player.die();
      }
    }

    if (this.bgRenderer) this.bgRenderer.update(dt);

    this.updateMovingPlatforms(dt);

    if (this.player) {
      this.player.update(dt, input, this.solids);
      this.camera.follow(this.player.x, this.player.y, this.player.width, this.player.height, this.player.facing, this.player.vx);
    }
    this.camera.update(dt);

    for (const enemy of this.enemies) {
      enemy.update(dt, this.solids, this.player?.x || 0, this.player?.y || 0);
      if (this.player && this.player.alive) {
        enemy.checkPlayerCollision(this.player);
      }
    }
    this.enemies = this.enemies.filter(e => e.alive || e.deathTimer < 1);

    if (this.boss) {
      this.boss.update(dt, this.solids, this.player?.x || 0, this.player?.y || 0);
      if (this.player && this.player.alive) {
        this.boss.checkPlayerCollision(this.player);
      }
      const weakPoint = this.boss.getWeakPoint();
      if (weakPoint && this.player) {
        if (weakPoint.x < this.player.x + this.player.width && weakPoint.x + weakPoint.width > this.player.x &&
            weakPoint.y < this.player.y + this.player.height && weakPoint.y + weakPoint.height > this.player.y) {
          if (this.player.vy > 0 && this.player.y + this.player.height < weakPoint.y + 20) {
            this.boss.takeDamage(1, true);
            this.player.vy = -400;
            this.audio.playSound('enemyDefeat');
          }
        }
      }
    }

    for (const proj of this.projectiles) {
      proj.update(dt, this.currentLevel?.width || 5000, this.currentLevel?.height || 720);
      if (!proj.alive) continue;
      if (proj.owner === 'enemy' || proj.owner === 'boss') {
        if (this.player && this.player.alive && !this.player.isInvincible) {
          if (proj.x < this.player.x + this.player.width && proj.x + proj.width > this.player.x &&
              proj.y < this.player.y + this.player.height && proj.y + proj.height > this.player.y) {
            this.player.takeDamage(proj.damage);
            proj.alive = false;
          }
        }
      } else if (proj.owner === 'player') {
        for (const enemy of this.enemies) {
          if (enemy.alive && proj.x < enemy.x + enemy.width && proj.x + proj.width > enemy.x &&
              proj.y < enemy.y + enemy.height && proj.y + proj.height > enemy.y) {
            enemy.takeDamage(proj.damage);
            proj.alive = false;
            break;
          }
        }
        if (this.boss && this.boss.alive && !proj.alive === false) {
          if (proj.x < this.boss.x + this.boss.width && proj.x + proj.width > this.boss.x &&
              proj.y < this.boss.y + this.boss.height && proj.y + proj.height > this.boss.y) {
            this.boss.takeDamage(proj.damage);
            proj.alive = false;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    for (const c of this.collectibles) {
      c.update(dt);
      if (this.player) c.checkCollision(this.player);
    }
    this.collectibles = this.collectibles.filter(c => !c.collected);

    for (const p of this.powerups) {
      p.update(dt);
      if (this.player) p.checkCollision(this.player);
    }
    this.powerups = this.powerups.filter(p => !p.collected);

    for (const cp of this.checkpoints) {
      if (!cp.activated && this.player) {
        const dx = this.player.x + this.player.width / 2 - cp.x;
        const dy = this.player.y + this.player.height / 2 - cp.y;
        if (Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.checkpointRadius) {
          cp.activated = true;
          this.player.setCheckpoint(cp.x, cp.y);
          this.audio.playSound('checkpoint');
          this.particles.burst(cp.x, cp.y, '#44ff44', 15);
        }
      }
    }

    if (this.player && this.player.alive && this.currentLevel) {
      const f = this.currentLevel.finish;
      if (this.player.x + this.player.width > f.x && this.player.x < f.x + 40 &&
          this.player.y + this.player.height > f.y && this.player.y < f.y + 80) {
        this.completeLevel();
      }
    }

    if (this.player && !this.player.alive && this.player.animTimer > 1.5) {
      if (this.player.lives <= 0) {
        this.gameOver();
      } else {
        this.player.respawnAtCheckpoint();
        this.timeLeft = Math.max(this.timeLeft, 60);
      }
    }

    this.particles.update(dt);

    if (this.screenFlash > 0) this.screenFlash -= dt;

    if (this.bossDefeated && this.levelCompleteTimer > 0) {
      this.levelCompleteTimer -= dt;
      if (this.levelCompleteTimer <= 0) this.completeLevel();
    }

    this.updateHud();

    if (this.state === 'PLAYING' && this.isBossLevel && this.boss) {
      this.setState('BOSS_FIGHT');
    }
  }

  private updateMovingPlatforms(dt: number): void {
    if (!this.currentLevel) return;
    for (let i = 0; i < this.movingPlatforms.length; i++) {
      const mp = this.movingPlatforms[i];
      const data = this.currentLevel.movingPlatforms[i];
      if (!data) continue;
      const phase = (performance.now() / 1000 - this.levelStartTime) * data.speed + (data.startOffset || 0) * Math.PI * 2;
      const offset = Math.sin(phase) * data.range;
      mp.prevX = mp.x;
      mp.prevY = mp.y;
      if (data.axis === 'x') {
        mp.x = data.x + offset;
        mp.vx = (mp.x - mp.prevX) / dt;
      } else {
        mp.y = data.y + offset;
        mp.vy = (mp.y - mp.prevY) / dt;
      }
    }
  }

  private completeLevel(): void {
    if (this.state === 'LEVEL_COMPLETE') return;
    this.levelsCompleted++;
    this.checkAchievement('first_steps');

    const timeBonus = Math.floor(this.timeLeft * 10);
    const totalScore = this.score + timeBonus + GAME_CONFIG.levelCompleteScore;
    this.score = totalScore;

    const stars = this.calcStars();

    const levelKey = `${this.currentWorld}-${this.currentLevelNum}`;
    this.saveData.levelStars[levelKey] = Math.max(this.saveData.levelStars[levelKey] || 0, stars);
    this.saveData.totalScore = Math.max(this.saveData.totalScore, this.score);
    this.saveData.totalCoins = this.totalCoinsCollected;
    this.saveData.totalCrystals = this.totalCrystalsCollected;
    const nextLevelNum = this.currentWorld * 4 + this.currentLevelNum + 1;
    if (this.currentLevelNum < 4) {
      this.saveData.unlockedLevels = Math.max(this.saveData.unlockedLevels, this.currentWorld * 4 + this.currentLevelNum + 1);
    } else if (this.currentWorld < 5) {
      this.saveData.unlockedLevels = Math.max(this.saveData.unlockedLevels, (this.currentWorld + 1) * 4 + 1);
    }
    this.saveData.currentWorld = this.currentLevelNum < 4 ? this.currentWorld : Math.min(5, this.currentWorld + 1);
    this.saveData.currentLevel = this.currentLevelNum < 4 ? this.currentLevelNum + 1 : 1;
    SaveSystem.saveSave(this.saveData);

    this.audio.playSound('levelComplete');
    this.audio.stopMusic();

    const data: LevelCompleteData = {
      score: this.score,
      coins: this.coins,
      enemies: this.enemiesDefeated,
      crystals: this.crystalsCollected,
      timeBonus,
      totalScore,
      stars,
      world: this.currentWorld,
      level: this.currentLevelNum,
    };

    this.setState('LEVEL_COMPLETE');
    this.callbacks.onLevelComplete(data);
  }

  private calcStars(): number {
    let stars = 1;
    if (this.crystalsCollected >= 2) stars = 2;
    if (this.crystalsCollected >= 3 && this.timeLeft > 60) stars = 3;
    return clamp(stars, 1, 3);
  }

  private gameOver(): void {
    this.audio.stopMusic();
    this.audio.playSound('gameOver');
    this.setState('GAME_OVER');
    this.callbacks.onGameOver({
      score: this.score,
      coins: this.coins,
      level: `${this.currentWorld}-${this.currentLevelNum}`,
    });
    const entry = {
      name: this.saveData.playerName,
      score: this.score,
      date: new Date().toLocaleDateString(),
      level: `${this.currentWorld}-${this.currentLevelNum}`,
    };
    SaveSystem.addLeaderboardEntry(this.saveData, entry);
    SaveSystem.saveSave(this.saveData);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    if (this.state === 'LOADING' || this.state === 'MAIN_MENU' || this.state === 'PLAYER_NAME' ||
        this.state === 'STORY_INTRO' || this.state === 'SETTINGS' || this.state === 'CONTROLS' ||
        this.state === 'CREDITS' || this.state === 'ACHIEVEMENTS' || this.state === 'LEADERBOARD' ||
        this.state === 'LEVEL_SELECT' || this.state === 'WORLD_MAP' || this.state === 'VICTORY') {
      this.renderMenuBackground();
      if (this.fadeAlpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
      return;
    }

    if (!this.currentLevel || !this.bgRenderer || !this.player) {
      this.renderMenuBackground();
      return;
    }

    const camX = this.camera.viewX;
    const camY = this.camera.viewY;

    this.bgRenderer.render(ctx, camX, camY);

    for (const cp of this.checkpoints) {
      renderCheckpoint(ctx, cp.x, cp.y, cp.activated, camX, camY, performance.now() / 1000);
    }

    renderFinish(ctx, this.currentLevel.finish.x, this.currentLevel.finish.y, camX, camY, performance.now() / 1000);

    for (const s of this.solids) {
      if (s.damaging) {
        renderHazard(ctx, s.x, s.y, s.width, s.height, s.type || 'spike', camX, camY);
      } else if (s.type && !s.oneWay) {
        const tileType = TILE_TYPES[s.type] || TILE_TYPES.stone;
        renderPlatform(ctx, s.x, s.y, s.width, s.height, s.type, camX, camY, tileType.colors);
      } else if (s.type && s.oneWay) {
        const tileType = TILE_TYPES[s.type] || TILE_TYPES.cloud;
        renderPlatform(ctx, s.x, s.y, s.width, s.height, s.type, camX, camY, tileType.colors);
      }
    }

    for (const c of this.collectibles) c.render(ctx, camX, camY);
    for (const p of this.powerups) p.render(ctx, camX, camY);

    for (const e of this.enemies) e.render(ctx, camX, camY);
    if (this.boss) this.boss.render(ctx, camX, camY);

    this.player.render(ctx, camX, camY);

    for (const proj of this.projectiles) proj.render(ctx, camX, camY);

    this.particles.render(ctx, camX, camY);

    if (this.boss && this.boss.alive && (this.isBossLevel || this.state === 'BOSS_FIGHT')) {
      this.renderBossHealthBar(ctx);
    }

    if (this.bossWarningTimer > 0) {
      this.renderBossWarning(ctx);
    }

    if (this.levelTransitionTimer > 0) {
      this.renderLevelTransition(ctx);
    }

    if (this.screenFlash > 0) {
      ctx.globalAlpha = this.screenFlash;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      ctx.globalAlpha = 1;
    }

    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    if (this.debugMode) {
      this.renderDebug(ctx);
    }
  }

  private applyGraphicsTier(tier: 'low' | 'medium' | 'high' | 'ultra'): void {
    if (tier === 'low') {
      this.particles.setMaxParticles(40);
    } else if (tier === 'medium') {
      this.particles.setMaxParticles(90);
    } else if (tier === 'high') {
      this.particles.setMaxParticles(180);
    } else {
      this.particles.setMaxParticles(300);
    }
  }

  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    if (!this.boss || !this.boss.alive) return;
    const barW = Math.min(480, this.viewWidth * 0.55);
    const barH = 18;
    const x = (this.viewWidth - barW) / 2;
    const y = 30;

    ctx.save();
    // Glassmorphic dark panel
    ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
    ctx.strokeStyle = 'rgba(255, 100, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - 14, y - 22, barW + 28, barH + 30, 8) : ctx.fillRect(x - 14, y - 22, barW + 28, barH + 30);
    ctx.fill();
    ctx.stroke();

    // Boss Name
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`☠  ${this.boss.name.toUpperCase()}  ☠`, this.viewWidth / 2, y - 4);

    // Empty bar background
    ctx.fillStyle = 'rgba(30, 15, 30, 0.9)';
    ctx.fillRect(x, y, barW, barH);

    // Delayed chip-away damage bar (orange/red)
    const delayedPct = clamp(this.bossDelayedHealth / this.boss.maxHealth, 0, 1);
    ctx.fillStyle = '#ff6b4a';
    ctx.fillRect(x, y, barW * delayedPct, barH);

    // Main health bar with gradient
    const hpPct = clamp(this.boss.health / this.boss.maxHealth, 0, 1);
    const hpGrad = ctx.createLinearGradient(x, y, x + barW, y);
    hpGrad.addColorStop(0, '#c026d3');
    hpGrad.addColorStop(0.5, '#e11d48');
    hpGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(x, y, barW * hpPct, barH);

    // Segment divider notches
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let i = 1; i < 10; i++) {
      ctx.fillRect(x + (barW * i) / 10, y, 1.5, barH);
    }

    // Top highlight gleam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x, y, barW * hpPct, 3);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barW, barH);

    ctx.restore();
  }

  private renderBossWarning(ctx: CanvasRenderingContext2D): void {
    if (this.bossWarningTimer <= 0) return;
    const strobe = Math.floor(performance.now() * 0.008) % 2 === 0;

    ctx.save();
    ctx.fillStyle = strobe ? 'rgba(220, 38, 38, 0.85)' : 'rgba(153, 27, 27, 0.85)';
    ctx.fillRect(0, this.viewHeight * 0.38, this.viewWidth, 110);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, this.viewHeight * 0.38, this.viewWidth, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ WARNING! ⚠', this.viewWidth / 2, this.viewHeight * 0.38 + 38);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.fillText('A POWERFUL FOE APPROACHES...', this.viewWidth / 2, this.viewHeight * 0.38 + 78);

    ctx.restore();
  }

  private renderLevelTransition(ctx: CanvasRenderingContext2D): void {
    if (this.levelTransitionTimer <= 0 || !this.currentLevel) return;
    const progress = this.levelTransitionTimer / 2.8;
    let alpha = 1;
    if (progress > 0.8) alpha = (1 - progress) / 0.2;
    else if (progress < 0.2) alpha = progress / 0.2;
    alpha = clamp(alpha, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    const theme = WORLD_THEMES[this.currentLevel.world - 1];
    const bannerW = Math.min(560, this.viewWidth * 0.7);
    const bannerH = 100;
    const bx = (this.viewWidth - bannerW) / 2;
    const by = this.viewHeight * 0.24;

    ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
    ctx.strokeStyle = theme?.accent || '#4a8aff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bannerW, bannerH, 14) : ctx.fillRect(bx, by, bannerW, bannerH);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = theme?.accent || '#4a8aff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText(`WORLD ${this.currentWorld} — ${(theme?.name || '').toUpperCase()}`, this.viewWidth / 2, by + 26);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText((this.currentLevel.name || '').toUpperCase(), this.viewWidth / 2, by + 56);

    ctx.fillStyle = '#88ccff';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`LEVEL ${this.currentWorld}-${this.currentLevelNum}`, this.viewWidth / 2, by + 82);

    ctx.restore();
  }

  private renderMenuBackground(): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    grad.addColorStop(0, '#0a0a2a');
    grad.addColorStop(0.5, '#1a1a3a');
    grad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    const t = performance.now() / 1000;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 137 + t * 20) % this.viewWidth);
      const y = (i * 73) % (this.viewHeight * 0.6);
      const size = 1 + (i % 3);
      const twinkle = 0.3 + Math.sin(t * 2 + i) * 0.3;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i % 5 === 0 ? '#ffd700' : '#fff';
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < 4; i++) {
      const cx = ((t * 15 + i * 300) % (this.viewWidth + 200)) - 100;
      const cy = 60 + i * 40;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 15, cy - 5, 15, 0, Math.PI * 2);
      ctx.arc(cx + 30, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath();
    ctx.moveTo(0, this.viewHeight);
    for (let x = 0; x <= this.viewWidth; x += 40) {
      ctx.lineTo(x, this.viewHeight - 80 - Math.sin(x * 0.01 + t * 0.5) * 20);
    }
    ctx.lineTo(this.viewWidth, this.viewHeight);
    ctx.fill();
  }

  private renderDebug(ctx: CanvasRenderingContext2D): void {
    if (!this.player) return;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(4, this.viewHeight - 120, 200, 116);
    ctx.fillStyle = '#0f0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const lines = [
      `FPS: ${this.fps}`,
      `P: ${Math.round(this.player.x)},${Math.round(this.player.y)}`,
      `V: ${Math.round(this.player.vx)},${Math.round(this.player.vy)}`,
      `Lvl: ${this.currentWorld}-${this.currentLevelNum}`,
      `Enemies: ${this.enemies.length}`,
      `Particles: ${this.particles.count}`,
      `Cam: ${Math.round(this.camera.x)},${Math.round(this.camera.y)}`,
      `State: ${this.state}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 8, this.viewHeight - 104 + i * 13));

    if (this.debugMode) {
      ctx.strokeStyle = '#f00';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.player.x - this.camera.viewX, this.player.y - this.camera.viewY, this.player.width, this.player.height);
      for (const s of this.solids) {
        ctx.strokeStyle = '#0f0';
        ctx.strokeRect(s.x - this.camera.viewX, s.y - this.camera.viewY, s.width, s.height);
      }
      for (const e of this.enemies) {
        ctx.strokeStyle = '#ff0';
        ctx.strokeRect(e.x - this.camera.viewX, e.y - this.camera.viewY, e.width, e.height);
      }
    }
  }

  setTouchInput(state: any): void {
    this.input.setTouch(state);
  }

  dispose(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.input.dispose();
    this.audio.dispose();
  }
}
