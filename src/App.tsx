import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '@/game/gameEngine';
import type { GameState, HudData, LevelCompleteData, VictoryData, SaveData, GameSettings } from '@/game/types';
import { SaveSystem } from '@/game/saveSystem';
import { ACHIEVEMENTS } from '@/game/types';
import { WORLD_THEMES, TOTAL_LEVELS } from '@/game/level';
import { Play, Settings, Trophy, Award, ChevronRight, Volume2, Gamepad2, Home, RotateCcw, ArrowRight, Maximize, Minimize } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
function isLandscape() {
  if (typeof window === 'undefined') return true;
  return window.innerWidth > window.innerHeight;
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export default function App() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const engineRef      = useRef<GameEngine | null>(null);

  const [gameState,         setGameState]         = useState<GameState>('LOADING');
  const [hud,               setHud]               = useState<HudData>({ score: 0, coins: 0, lives: 3, health: 3, world: '1-1', time: 300, crystals: 0, starPower: false, fireOrb: false, shield: false });
  const [saveData,          setSaveData]          = useState<SaveData>(() => SaveSystem.loadSave());
  const [gameOverData,      setGameOverData]      = useState<{ score: number; coins: number; level: string } | null>(null);
  const [levelCompleteData, setLevelCompleteData] = useState<LevelCompleteData | null>(null);
  const [victoryData,       setVictoryData]       = useState<VictoryData | null>(null);
  const [achievementToast,  setAchievementToast]  = useState<string | null>(null);
  const [playerName,        setPlayerName]        = useState(saveData.playerName || '');
  const [showNameInput,     setShowNameInput]     = useState(false);
  const [settings,          setSettings]          = useState<GameSettings>(() => SaveSystem.loadSettings());
  const [isMobile,          setIsMobile]          = useState(isTouchDevice);
  const [landscape,         setLandscape]         = useState(isLandscape);
  const [isFullscreen,      setIsFullscreen]      = useState(false);

  // Orientation / resize tracking
  useEffect(() => {
    const update = () => {
      setIsMobile(isTouchDevice());
      setLandscape(isLandscape());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  // Game engine init
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new GameEngine(canvasRef.current, {
      onStateChange:  (s)    => setGameState(s),
      onHudUpdate:    (h)    => setHud(h),
      onGameOver:     (d)    => setGameOverData(d),
      onLevelComplete:(d)    => setLevelCompleteData(d),
      onVictory:      (d)    => setVictoryData(d),
      onAchievement:  (name) => {
        setAchievementToast(name);
        setTimeout(() => setAchievementToast(null), 3500);
      },
    }, saveData);
    engineRef.current = engine;
    engine.init();
    const onResize = () => engine.resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!saveData.playerName || saveData.playerName === 'Player') {
      setShowNameInput(true);
    } else {
      engine.startNewGame();
    }
  }, [saveData.playerName]);

  const handleNameSubmit = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !playerName.trim()) return;
    engine.setPlayerName(playerName.trim());
    setSaveData(SaveSystem.loadSave());
    setShowNameInput(false);
    engine.startNewGame();
  }, [playerName]);

  const handleContinue    = useCallback(() => engineRef.current?.continueGame(), []);
  const handleLevelSelect = useCallback((world: number, level: number) => engineRef.current?.startLevel(world, level), []);
  const handleResume      = useCallback(() => engineRef.current?.resume(), []);
  const handleRestart     = useCallback(() => engineRef.current?.restartLevel(), []);
  const handleMainMenu    = useCallback(() => engineRef.current?.goToMainMenu(), []);
  const handleNextLevel   = useCallback(() => { setLevelCompleteData(null); engineRef.current?.nextLevel(); }, []);
  const handleWorldMap    = useCallback(() => { setLevelCompleteData(null); setGameOverData(null); setSaveData(SaveSystem.loadSave()); engineRef.current?.goToWorldMap(); }, []);
  const handleTryAgain    = useCallback(() => { setGameOverData(null); setSaveData(SaveSystem.loadSave()); engineRef.current?.restartLevel(); }, []);

  const handleSettingChange = useCallback((newSettings: GameSettings) => {
    setSettings(newSettings);
    engineRef.current?.setSettings(newSettings);
  }, []);

  const handleResetSave = useCallback(() => {
    if (window.confirm('Delete all progress? This cannot be undone.')) {
      const fresh = SaveSystem.resetSave();
      setSaveData(fresh);
      setPlayerName('');
    }
  }, []);

  const handleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        try { (screen.orientation as any)?.lock?.('landscape'); } catch { /* not supported */ }
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
  }, []);

  const touchState = useRef({ left: false, right: false, jump: false, attack: false, pause: false, up: false, down: false, interact: false });
  const handleTouchBtn = useCallback((key: string, pressed: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    (touchState.current as any)[key] = pressed;
    engine.setTouchInput({ ...touchState.current });
  }, []);

  const isPlaying = gameState === 'PLAYING' || gameState === 'BOSS_FIGHT' || gameState === 'PAUSED';
  const showPortraitWarning = isMobile && !landscape;

  return (
    <div className="pixel-quest-game" ref={containerRef}>
      <div className="pq-canvas-container">
        <canvas ref={canvasRef} />
      </div>

      {showPortraitWarning && <PortraitWarning />}

      {!showPortraitWarning && (
        <>
          {isPlaying && <Hud hud={hud} isBoss={gameState === 'BOSS_FIGHT'} />}

          {isPlaying && isMobile && (
            <MobileControls
              onTouch={handleTouchBtn}
              onPause={() => engineRef.current?.pause()}
              onFullscreen={handleFullscreen}
              isFullscreen={isFullscreen}
            />
          )}

          {isPlaying && !isMobile && (
            <button className="pq-pause-desktop" id="btn-pause-desktop" onClick={() => engineRef.current?.pause()} title="Pause (P / Esc)">❚❚</button>
          )}

          {gameState === 'PAUSED' && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onSettings={() => setGameState('SETTINGS')}
              onMainMenu={handleMainMenu}
            />
          )}

          {gameState === 'MAIN_MENU' && (
            <MainMenu
              onPlay={handleStart}
              onContinue={handleContinue}
              onLevelSelect={() => setGameState('LEVEL_SELECT')}
              onSettings={() => setGameState('SETTINGS')}
              onControls={() => setGameState('CONTROLS')}
              onCredits={() => setGameState('CREDITS')}
              onAchievements={() => setGameState('ACHIEVEMENTS')}
              onLeaderboard={() => setGameState('LEADERBOARD')}
              hasSave={saveData.unlockedLevels > 1 || saveData.totalScore > 0}
              onFullscreen={handleFullscreen}
              isFullscreen={isFullscreen}
              isMobile={isMobile}
            />
          )}

          {showNameInput && (
            <Overlay>
              <div className="pq-name-box">
                <div style={{ fontSize: 40 }}>🦸</div>
                <h2 className="pq-subtitle">ENTER YOUR HERO NAME</h2>
                <input
                  className="pq-input"
                  type="text"
                  value={playerName}
                  maxLength={12}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                  placeholder="Hero name..."
                  autoFocus
                />
                <div style={{ marginTop: 16 }}>
                  <button className="pq-btn primary" id="btn-start-game" onClick={handleNameSubmit}>BEGIN QUEST ▶</button>
                </div>
              </div>
            </Overlay>
          )}

          {gameState === 'STORY_INTRO' && <StoryIntro onContinue={() => engineRef.current?.goToWorldMap()} />}

          {gameState === 'WORLD_MAP' && (
            <WorldMap saveData={saveData} onLevelSelect={handleLevelSelect} onMainMenu={handleMainMenu} />
          )}

          {gameState === 'LEVEL_SELECT' && (
            <LevelSelect saveData={saveData} onSelect={handleLevelSelect} onBack={() => setGameState('MAIN_MENU')} />
          )}

          {gameState === 'SETTINGS' && (
            <SettingsScreen
              settings={settings}
              onChange={handleSettingChange}
              onBack={() => setGameState(engineRef.current?.state === 'PAUSED' ? 'PAUSED' : 'MAIN_MENU')}
              onResetSave={handleResetSave}
            />
          )}

          {gameState === 'CONTROLS'     && <ControlsScreen     onBack={() => setGameState('MAIN_MENU')} />}
          {gameState === 'CREDITS'      && <CreditsScreen      onBack={() => setGameState('MAIN_MENU')} />}
          {gameState === 'ACHIEVEMENTS' && <AchievementsScreen saveData={saveData} onBack={() => setGameState('MAIN_MENU')} />}
          {gameState === 'LEADERBOARD'  && <LeaderboardScreen  saveData={saveData} onBack={() => setGameState('MAIN_MENU')} />}

          {gameState === 'GAME_OVER' && gameOverData && (
            <GameOverScreen data={gameOverData} onTryAgain={handleTryAgain} onWorldMap={handleWorldMap} onMainMenu={handleMainMenu} />
          )}

          {gameState === 'LEVEL_COMPLETE' && levelCompleteData && (
            <LevelCompleteScreen data={levelCompleteData} onNext={handleNextLevel} onReplay={handleRestart} onWorldMap={handleWorldMap} />
          )}

          {gameState === 'VICTORY' && victoryData && (
            <VictoryScreen data={victoryData} onPlayAgain={() => { engineRef.current?.startNewGame(); }} onWorldMap={handleWorldMap} onCredits={() => setGameState('CREDITS')} />
          )}

          {achievementToast && (
            <div className="pq-achievement-toast pq-fade-in" id="achievement-toast">
              <span style={{ fontSize: 22 }}>🏆</span>
              <div>
                <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 2 }}>ACHIEVEMENT UNLOCKED</div>
                <div style={{ fontWeight: 'bold' }}>{achievementToast}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Portrait Warning ────────────────────────────────────────────────────────
function PortraitWarning() {
  return (
    <div className="pq-portrait-warning">
      <div className="pq-portrait-inner">
        <div className="pq-phone-anim">
          <div className="pq-phone">
            <div className="pq-phone-screen">🎮</div>
          </div>
        </div>
        <h2 className="pq-portrait-title">ROTATE YOUR DEVICE</h2>
        <p className="pq-portrait-sub">This game is best played in<br /><strong>LANDSCAPE</strong> mode</p>
        <div className="pq-rotate-arrow">↻</div>
      </div>
    </div>
  );
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="pq-overlay pq-fade-in">{children}</div>;
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function Hud({ hud, isBoss }: { hud: HudData; isBoss: boolean }) {
  const timeClass = hud.time <= 10 ? 'critical' : hud.time <= 30 ? 'warning' : '';
  const mins = Math.floor(hud.time / 60);
  const secs = Math.floor(hud.time % 60);
  const healthPct = (hud.health / 3) * 100;
  const healthColor = hud.health <= 1 ? '#ff3333' : hud.health <= 2 ? '#ffaa00' : '#44ff88';

  return (
    <div className="pq-hud" id="hud">
      <div className="pq-hud-bar">
        <div className="pq-hud-group">
          <div className="pq-hud-item score">
            <span className="pq-hud-label">SCORE</span>
            <span className="pq-hud-val">{hud.score}</span>
          </div>
          <div className="pq-hud-item coins">
            <span className="pq-hud-icon">🪙</span>
            <span className="pq-hud-val">{hud.coins}</span>
          </div>
          {hud.crystals > 0 && (
            <div className="pq-hud-item crystals">
              <span className="pq-hud-icon">💎</span>
              <span className="pq-hud-val">{hud.crystals}/3</span>
            </div>
          )}
        </div>
        <div className="pq-hud-center">
          <div className="pq-hud-world">{isBoss ? '⚔ BOSS ⚔' : `WORLD ${hud.world}`}</div>
        </div>
        <div className="pq-hud-group right">
          <div className={`pq-hud-item time ${timeClass}`}>
            <span className="pq-hud-icon">⏱</span>
            <span className="pq-hud-val">{mins}:{secs.toString().padStart(2, '0')}</span>
          </div>
          <div className="pq-hud-item lives">
            <span className="pq-hud-icon">⭐</span>
            <span className="pq-hud-val">×{hud.lives}</span>
          </div>
        </div>
      </div>
      <div className="pq-health-row">
        <div className="pq-health-hearts">
          {[1,2,3].map(i => (
            <span key={i} className={`pq-heart ${i <= hud.health ? 'full' : 'empty'}`}>{i <= hud.health ? '♥' : '♡'}</span>
          ))}
        </div>
        <div className="pq-health-bar-bg">
          <div className="pq-health-bar-fill" style={{ width: `${healthPct}%`, background: healthColor }} />
        </div>
      </div>
      {(hud.starPower || hud.fireOrb || hud.shield) && (
        <div className="pq-powerups">
          {hud.starPower && <span className="pq-powerup star">⭐ STAR</span>}
          {hud.fireOrb   && <span className="pq-powerup fire">🔥 FIRE</span>}
          {hud.shield    && <span className="pq-powerup shield">🛡 SHIELD</span>}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Controls (Landscape) ─────────────────────────────────────────────
function MobileControls({
  onTouch, onPause, onFullscreen, isFullscreen,
}: {
  onTouch: (key: string, val: boolean) => void;
  onPause: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const makeHandlers = (key: string) => ({
    onPointerDown:   (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onTouch(key, true); },
    onPointerUp:     (e: React.PointerEvent) => { e.preventDefault(); onTouch(key, false); },
    onPointerLeave:  () => onTouch(key, false),
    onPointerCancel: () => onTouch(key, false),
  });

  return (
    <div className="pq-mobile-controls" id="mobile-controls">
      <div className="pq-sys-btns">
        <button className="pq-sys-btn" id="btn-fs" onClick={onFullscreen} title="Fullscreen">
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button className="pq-sys-btn" id="btn-pause-mobile" onClick={onPause} title="Pause">❚❚</button>
      </div>
      <div className="pq-dpad">
        <button className="pq-dpad-btn left"  id="btn-left"  {...makeHandlers('left')}>◀</button>
        <button className="pq-dpad-btn right" id="btn-right" {...makeHandlers('right')}>▶</button>
        <button className="pq-dpad-btn down"  id="btn-down"  {...makeHandlers('down')}>▼</button>
      </div>
      <div className="pq-action-btns">
        <button className="pq-action-btn attack" id="btn-attack" {...makeHandlers('attack')}>
          <span className="pq-btn-label">ATK</span>
        </button>
        <button className="pq-action-btn jump" id="btn-jump" {...makeHandlers('jump')}>
          <span className="pq-btn-label">JUMP</span>
        </button>
      </div>
    </div>
  );
}

function MainMenu({ onPlay, onContinue, onLevelSelect, onSettings, onControls, onCredits, onAchievements, onLeaderboard, hasSave, onFullscreen, isFullscreen, isMobile }: {
  onPlay: () => void; onContinue: () => void; onLevelSelect: () => void; onSettings: () => void;
  onControls: () => void; onCredits: () => void; onAchievements: () => void; onLeaderboard: () => void;
  hasSave: boolean; onFullscreen: () => void; isFullscreen: boolean; isMobile: boolean;
}) {
  return (
    <div className="pq-overlay pq-fade-in" style={{ background: 'transparent' }}>
      <div className="pq-menu-container">
        <div className="pq-menu-title-area">
          <div className="pq-menu-logo">🌟</div>
          <h1 className="pq-title pq-title-glow" id="title-main">PIXEL QUEST</h1>
          <p className="pq-menu-tagline">KINGDOM OF THE STARS</p>
          <div className="pq-menu-version">v2.0 HD</div>
        </div>
        <div className="pq-menu-buttons">
          <button className="pq-btn primary large" id="btn-play" onClick={onPlay}>
            <Play size={20} style={{ display: 'inline', marginRight: 8 }} />PLAY
          </button>
          {hasSave && (
            <button className="pq-btn large" id="btn-continue" onClick={onContinue}>
              <ChevronRight size={20} style={{ display: 'inline', marginRight: 8 }} />CONTINUE
            </button>
          )}
          <div className="pq-btn-row">
            <button className="pq-btn small" id="btn-level-select" onClick={onLevelSelect}>LEVELS</button>
            <button className="pq-btn small" id="btn-achievements" onClick={onAchievements}>
              <Award size={16} style={{ display: 'inline', marginRight: 6 }} />AWARDS
            </button>
            <button className="pq-btn small" id="btn-leaderboard" onClick={onLeaderboard}>
              <Trophy size={16} style={{ display: 'inline', marginRight: 6 }} />SCORES
            </button>
          </div>
          <div className="pq-btn-row">
            <button className="pq-btn small" id="btn-settings" onClick={onSettings}>
              <Settings size={16} style={{ display: 'inline', marginRight: 6 }} />SETTINGS
            </button>
            <button className="pq-btn small" id="btn-controls" onClick={onControls}>
              <Gamepad2 size={16} style={{ display: 'inline', marginRight: 6 }} />CONTROLS
            </button>
            <button className="pq-btn small" id="btn-credits" onClick={onCredits}>CREDITS</button>
          </div>
          {isMobile && (
            <button className="pq-btn small" id="btn-fullscreen-menu" onClick={onFullscreen}>
              {isFullscreen ? <Minimize size={16} style={{ display: 'inline', marginRight: 6 }} /> : <Maximize size={16} style={{ display: 'inline', marginRight: 6 }} />}
              {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function StoryIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2>THE STORY</h2>
        <p className="pq-story-text">
          Long ago, the Star Crystals protected the Pixel Kingdom, filling its sky with light and wonder.
        </p>
        <p className="pq-story-text">
          But the Void King came from the shadows and stole the crystals, plunging the kingdom into darkness.
        </p>
        <p className="pq-story-text">
          Without the crystals, the kingdom's sky is slowly disappearing. The people have lost hope.
        </p>
        <p className="pq-story-text" style={{ color: '#ffd700' }}>
          But one small hero named Ravi dares to journey across five worlds to recover the Star Crystals and save the kingdom.
        </p>
        <button className="pq-btn primary" onClick={onContinue} style={{ marginTop: 16 }}>BEGIN THE QUEST</button>
      </div>
    </Overlay>
  );
}

function WorldMap({ saveData, onLevelSelect, onMainMenu }: {
  saveData: SaveData; onLevelSelect: (w: number, l: number) => void; onMainMenu: () => void;
}) {
  const unlocked = saveData.unlockedLevels;
  return (
    <Overlay>
      <div className="pq-panel" style={{ maxWidth: 600 }}>
        <h2>WORLD MAP</h2>
        {WORLD_THEMES.map((theme, wi) => {
          const world = wi + 1;
          const worldUnlocked = unlocked >= world * 4 + 1 || unlocked >= (world - 1) * 4 + 1;
          if (!worldUnlocked && world > 1) return null;
          return (
            <div key={world}>
              <div className="pq-world-label" style={{ color: theme.accent }}>
                WORLD {world} — {theme.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map((level) => {
                  const levelNum = (world - 1) * 4 + level;
                  const isUnlocked = unlocked >= levelNum;
                  const isCompleted = unlocked > levelNum;
                  const stars = saveData.levelStars[`${world}-${level}`] || 0;
                  const isBoss = level === 4;
                  return (
                    <button
                      key={level}
                      className={`pq-level-btn ${isUnlocked ? isCompleted ? 'completed' : 'unlocked' : 'locked'} ${isBoss ? 'boss' : ''}`}
                      disabled={!isUnlocked}
                      onClick={() => onLevelSelect(world, level)}
                      style={{ minWidth: 70 }}
                    >
                      {world}-{level}
                      {isBoss && <div style={{ fontSize: 10 }}>BOSS</div>}
                      {stars > 0 && <div style={{ fontSize: 10, color: '#ffd700' }}>{'★'.repeat(stars)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 16 }}>
          <button className="pq-btn small" onClick={onMainMenu}><Home size={16} style={{ display: 'inline', marginRight: 6 }} />MAIN MENU</button>
        </div>
      </div>
    </Overlay>
  );
}

function LevelSelect({ saveData, onSelect, onBack }: {
  saveData: SaveData; onSelect: (w: number, l: number) => void; onBack: () => void;
}) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2>LEVEL SELECT</h2>
        {WORLD_THEMES.map((theme, wi) => {
          const world = wi + 1;
          return (
            <div key={world}>
              <div className="pq-world-label" style={{ color: theme.accent }}>WORLD {world}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {[1, 2, 3, 4].map((level) => {
                  const levelNum = (world - 1) * 4 + level;
                  const isUnlocked = saveData.unlockedLevels >= levelNum;
                  const isCompleted = saveData.unlockedLevels > levelNum;
                  const isBoss = level === 4;
                  return (
                    <button
                      key={level}
                      className={`pq-level-btn ${isUnlocked ? isCompleted ? 'completed' : 'unlocked' : 'locked'} ${isBoss ? 'boss' : ''}`}
                      disabled={!isUnlocked}
                      onClick={() => onSelect(world, level)}
                    >
                      {world}-{level}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 16 }}>
          <button className="pq-btn small" onClick={onBack}>BACK</button>
        </div>
      </div>
    </Overlay>
  );
}

function PauseMenu({ onResume, onRestart, onSettings, onMainMenu }: {
  onResume: () => void; onRestart: () => void; onSettings: () => void; onMainMenu: () => void;
}) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2>PAUSED</h2>
        <button className="pq-btn primary" onClick={onResume}>RESUME</button>
        <button className="pq-btn" onClick={onRestart}><RotateCcw size={16} style={{ display: 'inline', marginRight: 8 }} />RESTART LEVEL</button>
        <button className="pq-btn" onClick={onSettings}>SETTINGS</button>
        <button className="pq-btn" onClick={onMainMenu}><Home size={16} style={{ display: 'inline', marginRight: 8 }} />MAIN MENU</button>
      </div>
    </Overlay>
  );
}

function GameOverScreen({ data, onTryAgain, onWorldMap, onMainMenu }: {
  data: { score: number; coins: number; level: string }; onTryAgain: () => void; onWorldMap: () => void; onMainMenu: () => void;
}) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2 style={{ color: '#ff4444' }}>GAME OVER</h2>
        <div className="pq-results">
          <div>SCORE: <span className="val">{data.score}</span></div>
          <div>COINS: <span className="val">{data.coins}</span></div>
          <div>LEVEL: <span className="val">{data.level}</span></div>
        </div>
        <button className="pq-btn primary" onClick={onTryAgain}>TRY AGAIN</button>
        <button className="pq-btn" onClick={onWorldMap}>WORLD MAP</button>
        <button className="pq-btn" onClick={onMainMenu}>MAIN MENU</button>
      </div>
    </Overlay>
  );
}

function LevelCompleteScreen({ data, onNext, onReplay, onWorldMap }: {
  data: LevelCompleteData; onNext: () => void; onReplay: () => void; onWorldMap: () => void;
}) {
  return (
    <Overlay>
      <div className="pq-panel pq-fade-in">
        <h2 style={{ color: '#ffd700' }}>LEVEL COMPLETE!</h2>
        <div className="pq-star-row">
          {[1, 2, 3].map(i => (
            <span key={i} className={i <= data.stars ? '' : 'dim'}>★</span>
          ))}
        </div>
        <div className="pq-results">
          <div>TIME BONUS: <span className="val">{data.timeBonus}</span></div>
          <div>COINS: <span className="val">{data.coins}</span></div>
          <div>ENEMIES: <span className="val">{data.enemies}</span></div>
          <div>CRYSTALS: <span className="val">{data.crystals}</span></div>
          <div style={{ marginTop: 8, fontSize: 18 }}>TOTAL: <span className="val">{data.totalScore}</span></div>
        </div>
        <button className="pq-btn primary" onClick={onNext}><ArrowRight size={16} style={{ display: 'inline', marginRight: 8 }} />NEXT LEVEL</button>
        <button className="pq-btn" onClick={onReplay}>REPLAY</button>
        <button className="pq-btn" onClick={onWorldMap}>WORLD MAP</button>
      </div>
    </Overlay>
  );
}

function VictoryScreen({ data, onPlayAgain, onWorldMap, onCredits }: {
  data: VictoryData; onPlayAgain: () => void; onWorldMap: () => void; onCredits: () => void;
}) {
  return (
    <Overlay>
      <div className="pq-panel pq-fade-in" style={{ maxWidth: 500 }}>
        <h2 className="pq-title-glow" style={{ color: '#ffd700' }}>KINGDOM SAVED!</h2>
        <p className="pq-story-text" style={{ color: '#88ccff' }}>
          Ravi has recovered the Star Crystals. The sky fills with light once more, and the Pixel Kingdom is saved!
        </p>
        <p className="pq-story-text" style={{ color: '#ffd700' }}>CONGRATULATIONS!</p>
        <div className="pq-results">
          <div>FINAL SCORE: <span className="val">{data.finalScore}</span></div>
          <div>TOTAL COINS: <span className="val">{data.totalCoins}</span></div>
          <div>TOTAL CRYSTALS: <span className="val">{data.totalCrystals}</span></div>
          <div>LEVELS COMPLETED: <span className="val">{data.levelsCompleted}</span></div>
          <div>TIME PLAYED: <span className="val">{data.timePlayed}</span></div>
        </div>
        <button className="pq-btn primary" onClick={onPlayAgain}>PLAY AGAIN</button>
        <button className="pq-btn" onClick={onWorldMap}>WORLD MAP</button>
        <button className="pq-btn" onClick={onCredits}>CREDITS</button>
      </div>
    </Overlay>
  );
}

function SettingsScreen({ settings, onChange, onBack, onResetSave }: {
  settings: GameSettings; onChange: (s: GameSettings) => void; onBack: () => void; onResetSave: () => void;
}) {
  const update = (key: keyof GameSettings, val: any) => onChange({ ...settings, [key]: val });
  return (
    <Overlay>
      <div className="pq-panel">
        <h2>SETTINGS</h2>
        <div style={{ maxWidth: 400, margin: '0 auto' }}>
          <div className="pq-slider-row">
            <span><Volume2 size={16} style={{ display: 'inline', marginRight: 6 }} />Master</span>
            <input type="range" className="pq-slider" min={0} max={1} step={0.05} value={settings.masterVolume} onChange={e => update('masterVolume', parseFloat(e.target.value))} />
          </div>
          <div className="pq-slider-row">
            <span>Music</span>
            <input type="range" className="pq-slider" min={0} max={1} step={0.05} value={settings.musicVolume} onChange={e => update('musicVolume', parseFloat(e.target.value))} />
          </div>
          <div className="pq-slider-row">
            <span>SFX</span>
            <input type="range" className="pq-slider" min={0} max={1} step={0.05} value={settings.sfxVolume} onChange={e => update('sfxVolume', parseFloat(e.target.value))} />
          </div>
          <div className="pq-slider-row">
            <span>Screen Shake</span>
            <input type="checkbox" checked={settings.screenShake} onChange={e => update('screenShake', e.target.checked)} />
          </div>
          <div className="pq-slider-row">
            <span>Particles</span>
            <input type="checkbox" checked={settings.particles} onChange={e => update('particles', e.target.checked)} />
          </div>
          <div className="pq-slider-row">
            <span>Difficulty</span>
            <select value={settings.difficulty} onChange={e => update('difficulty', e.target.value)} style={{ background: '#1a1a2a', color: '#fff', border: '2px solid #4a8aff', borderRadius: 4, padding: '4px 8px' }}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <button className="pq-btn small" onClick={onBack}>BACK</button>
          <button className="pq-btn small" style={{ background: 'linear-gradient(180deg, #6a2a2a, #4a1a1a)', borderColor: '#ff4444' }} onClick={onResetSave}>RESET SAVE</button>
        </div>
      </div>
    </Overlay>
  );
}

function ControlsScreen({ onBack }: { onBack: () => void }) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2>CONTROLS</h2>
        <h3>Desktop</h3>
        <div className="pq-controls-list">
          <span className="key">A / D or ← →</span><span>Move Left / Right</span>
          <span className="key">W / ↑ / SPACE</span><span>Jump</span>
          <span className="key">S / ↓</span><span>Crouch</span>
          <span className="key">E / J / X</span><span>Attack</span>
          <span className="key">P / ESC</span><span>Pause</span>
          <span className="key">F11</span><span>Fullscreen</span>
          <span className="key">F3</span><span>Debug Mode</span>
        </div>
        <h3>Mobile</h3>
        <p className="pq-text center">Touch buttons appear on screen during gameplay. Left/Right to move, JUMP to jump, ATK to attack.</p>
        <button className="pq-btn small" onClick={onBack} style={{ marginTop: 12 }}>BACK</button>
      </div>
    </Overlay>
  );
}

function CreditsScreen({ onBack }: { onBack: () => void }) {
  return (
    <Overlay>
      <div className="pq-panel">
        <h2 className="pq-title-glow">PIXEL QUEST</h2>
        <p className="pq-subtitle">KINGDOM OF THE STARS</p>
        <div className="pq-credits">
          <p>Created by:</p>
          <p className="name">P. G. Raviram</p>
          <p style={{ marginTop: 16 }}>Technology:</p>
          <p>HTML5 Canvas<br />CSS3<br />JavaScript ES6+<br />React + TypeScript<br />Web Audio API</p>
          <p style={{ marginTop: 16 }}>All game assets, characters, and content are original.</p>
          <p style={{ marginTop: 8, color: '#666' }}>No copyrighted materials used.</p>
        </div>
        <button className="pq-btn small" onClick={onBack} style={{ marginTop: 16 }}>BACK</button>
      </div>
    </Overlay>
  );
}

function AchievementsScreen({ saveData, onBack }: { saveData: SaveData; onBack: () => void }) {
  return (
    <Overlay>
      <div className="pq-panel" style={{ maxWidth: 450 }}>
        <h2>ACHIEVEMENTS</h2>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = saveData.achievements.includes(ach.id);
            return (
              <div key={ach.id} className={`pq-achievement ${unlocked ? 'unlocked' : 'locked'}`}>
                <span className="icon">{unlocked ? '★' : '☆'}</span>
                <div>
                  <div className="label" style={{ fontWeight: 'bold', color: unlocked ? '#ffd700' : '#888' }}>{ach.name}</div>
                  <div style={{ fontSize: 12 }}>{ach.description}</div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="pq-btn small" onClick={onBack} style={{ marginTop: 12 }}>BACK</button>
      </div>
    </Overlay>
  );
}

function LeaderboardScreen({ saveData, onBack }: { saveData: SaveData; onBack: () => void }) {
  return (
    <Overlay>
      <div className="pq-panel" style={{ maxWidth: 400 }}>
        <h2>LEADERBOARD</h2>
        {saveData.leaderboard.length === 0 ? (
          <p className="pq-text center">No scores yet. Play a game to get on the board!</p>
        ) : (
          <div>
            {saveData.leaderboard.map((entry, i) => (
              <div key={i} className={`pq-leaderboard-row ${entry.name === saveData.playerName ? 'you' : ''}`}>
                <span>{i + 1}. {entry.name}</span>
                <span>{entry.score} ({entry.level})</span>
              </div>
            ))}
          </div>
        )}
        <button className="pq-btn small" onClick={onBack} style={{ marginTop: 12 }}>BACK</button>
      </div>
    </Overlay>
  );
}
