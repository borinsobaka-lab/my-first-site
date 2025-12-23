import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

// Schema for electron-store validation
const schema = {
  apiKey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.apiKey,
  },
  language: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.language,
  },
  hotkey: {
    type: 'string' as const,
    default: DEFAULT_SETTINGS.hotkey,
  },
  hotkeyMode: {
    type: 'string' as const,
    enum: ['push-to-talk', 'toggle'],
    default: DEFAULT_SETTINGS.hotkeyMode,
  },
  insertMode: {
    type: 'string' as const,
    enum: ['type', 'clipboard'],
    default: DEFAULT_SETTINGS.insertMode,
  },
  selectedMicrophone: {
    type: ['string', 'null'] as const,
    default: DEFAULT_SETTINGS.selectedMicrophone,
  },
  autoStart: {
    type: 'boolean' as const,
    default: DEFAULT_SETTINGS.autoStart,
  },
  postProcessing: {
    type: 'boolean' as const,
    default: DEFAULT_SETTINGS.postProcessing,
  },
};

class SettingsManager {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      schema,
      defaults: DEFAULT_SETTINGS,
    });
  }

  getAll(): AppSettings {
    return {
      apiKey: this.store.get('apiKey'),
      language: this.store.get('language'),
      hotkey: this.store.get('hotkey'),
      hotkeyMode: this.store.get('hotkeyMode'),
      insertMode: this.store.get('insertMode'),
      selectedMicrophone: this.store.get('selectedMicrophone'),
      autoStart: this.store.get('autoStart'),
      postProcessing: this.store.get('postProcessing'),
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
