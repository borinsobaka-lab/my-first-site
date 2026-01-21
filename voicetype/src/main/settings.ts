import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

// Schema for electron-store validation
const schema = {
  // API Keys
  whisperApiKey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.whisperApiKey,
  },
  gptApiKey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.gptApiKey,
  },

  // Hotkeys
  hotkey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.hotkey,
  },
  aiHotkey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.aiHotkey,
  },
  hotkeyMode: {
    type: 'string' as const,
    enum: ['push-to-talk', 'toggle'],
    default: DEFAULT_SETTINGS.hotkeyMode,
  },

  // AI Settings
  gptModel: {
    type: 'string' as const,
    enum: ['gpt-4o-mini', 'gpt-4o'],
    default: DEFAULT_SETTINGS.gptModel,
  },

  // General Settings
  language: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.language,
  },
  insertMode: {
    type: 'string' as const,
    enum: ['type', 'clipboard'],
    default: DEFAULT_SETTINGS.insertMode,
  },
  selectedMicrophone: {
    anyOf: [
      { type: 'string' as const },
      { type: 'null' as const }
    ],
    default: DEFAULT_SETTINGS.selectedMicrophone,
  },
  autoStart: {
    type: 'boolean' as const,
    default: DEFAULT_SETTINGS.autoStart,
  },
  soundEnabled: {
    type: 'boolean' as const,
    default: DEFAULT_SETTINGS.soundEnabled,
  },
  totalRecordingSeconds: {
    type: 'number' as const,
    default: DEFAULT_SETTINGS.totalRecordingSeconds,
  },
};

class SettingsManager {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      schema: schema as any,
      defaults: DEFAULT_SETTINGS,
      // Migration from old settings format
      migrations: {
        '>=1.0.0': (store) => {
          // Migrate apiKey to whisperApiKey if it exists
          const oldApiKey = store.get('apiKey' as any);
          if (oldApiKey && typeof oldApiKey === 'string') {
            store.set('whisperApiKey', oldApiKey);
            store.delete('apiKey' as any);
          }
        },
      },
    });

    // Run migration check on startup
    this.migrateOldSettings();
  }

  /**
   * Migrate old settings format to new format
   */
  private migrateOldSettings(): void {
    // Check if old apiKey exists and migrate it
    const rawStore = this.store.store as any;
    if (rawStore.apiKey && !rawStore.whisperApiKey) {
      this.store.set('whisperApiKey', rawStore.apiKey);
      this.store.delete('apiKey' as any);
      console.log('Migrated apiKey to whisperApiKey');
    }
  }

  getAll(): AppSettings {
    return {
      // API Keys
      whisperApiKey: this.store.get('whisperApiKey'),
      gptApiKey: this.store.get('gptApiKey'),

      // Hotkeys
      hotkey: this.store.get('hotkey'),
      aiHotkey: this.store.get('aiHotkey'),
      hotkeyMode: this.store.get('hotkeyMode'),

      // AI Settings
      gptModel: this.store.get('gptModel'),

      // General Settings
      language: this.store.get('language'),
      insertMode: this.store.get('insertMode'),
      selectedMicrophone: this.store.get('selectedMicrophone'),
      autoStart: this.store.get('autoStart'),
      soundEnabled: this.store.get('soundEnabled'),
      totalRecordingSeconds: this.store.get('totalRecordingSeconds'),
    };
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  setMultiple(settings: Partial<AppSettings>): void {
    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        this.store.set(key as keyof AppSettings, value);
      }
    });
  }

  reset(): void {
    this.store.clear();
  }
}

export const settingsManager = new SettingsManager();
export default settingsManager;
