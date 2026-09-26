import type { SaveData, GameSettings, LeaderboardEntry } from './types';
import { ACHIEVEMENTS } from './types';

const SAVE_KEY = 'pixel_quest_save_v1';
const SETTINGS_KEY = 'pixel_quest_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.6,
  screenShake: true,
  particles: true,
  difficulty: 'normal',
  controlLayout: 'default',
};

const DEFAULT_SAVE: SaveData = {
  playerName: 'Player',
  currentWorld: 1,
  currentLevel: 1,
  unlockedLevels: 1,
  totalCoins: 0,
  totalScore: 0,
  totalCrystals: 0,
  collectedCrystals: {},
  levelStars: {},
  achievements: [],
  settings: DEFAULT_SETTINGS,
  leaderboard: [],
};

export class SaveSystem {
  static loadSave(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULT_SAVE };
      const data = JSON.parse(raw);
      return { ...DEFAULT_SAVE, ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  static saveSave(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  static loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Settings save failed', e);
    }
  }

  static resetSave(): SaveData {
    const settings = this.loadSettings();
    const fresh = { ...DEFAULT_SAVE, settings, leaderboard: this.loadSave().leaderboard };
    this.saveSave(fresh);
    return fresh;
  }

  static unlockAchievement(data: SaveData, id: string): boolean {
    if (data.achievements.includes(id)) return false;
    data.achievements.push(id);
    this.saveSave(data);
    return true;
  }

  static addLeaderboardEntry(data: SaveData, entry: LeaderboardEntry): void {
    data.leaderboard.push(entry);
    data.leaderboard.sort((a, b) => b.score - a.score);
    data.leaderboard = data.leaderboard.slice(0, 10);
    this.saveSave(data);
  }

  static getAchievements(): typeof ACHIEVEMENTS {
    return ACHIEVEMENTS;
  }
}
