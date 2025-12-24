// App Settings
export interface AppSettings {
  apiKey: string;
  language: string; // 'auto' | 'en' | 'ru' | 'de' | 'es' | 'fr' | 'ja' | 'zh' | ...
  hotkey: string; // 'Ctrl+Shift+Space'
  hotkeyMode: 'push-to-talk' | 'toggle';
  insertMode: 'type' | 'clipboard';
  selectedMicrophone: string | null;
  autoStart: boolean;
  soundEnabled: boolean;
  totalRecordingSeconds: number;
}

// Recording states
export type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

// Whisper API response
export interface WhisperResponse {
  text: string;
}

// Whisper API options
export interface WhisperOptions {
  language?: string;
  prompt?: string;
}

// IPC channel names
export const IPC_CHANNELS = {
  // Main → Renderer
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  STATE_CHANGED: 'state:changed',
  LOG_MESSAGE: 'log:message',

  // Renderer → Main
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_ERROR: 'transcription:error',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESPONSE: 'settings:response',
  TEXT_INSERT: 'text:insert',
  LOGS_GET: 'logs:get',
  LOGS_CLEAR: 'logs:clear',

  // Window controls
  WINDOW_SHOW_SETTINGS: 'window:show-settings',
  WINDOW_HIDE: 'window:hide',

  // Tray
  TRAY_UPDATE_STATE: 'tray:update-state',
} as const;

// Log entry type
export interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  language: 'auto',
  hotkey: 'Ctrl+Shift+Space',
  hotkeyMode: 'toggle',
  insertMode: 'type',
  selectedMicrophone: null,
  autoStart: false,
  soundEnabled: true,
  totalRecordingSeconds: 0,
};

// Supported languages for Whisper API (with Russian names)
export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Автоопределение' },
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'Английский' },
  { code: 'de', name: 'Немецкий' },
  { code: 'es', name: 'Испанский' },
  { code: 'fr', name: 'Французский' },
  { code: 'it', name: 'Итальянский' },
  { code: 'pt', name: 'Португальский' },
  { code: 'ja', name: 'Японский' },
  { code: 'zh', name: 'Китайский' },
  { code: 'ko', name: 'Корейский' },
  { code: 'ar', name: 'Арабский' },
  { code: 'hi', name: 'Хинди' },
  { code: 'pl', name: 'Польский' },
  { code: 'uk', name: 'Украинский' },
  { code: 'tr', name: 'Турецкий' },
  { code: 'nl', name: 'Нидерландский' },
  { code: 'sv', name: 'Шведский' },
  { code: 'cs', name: 'Чешский' },
  { code: 'el', name: 'Греческий' },
] as const;
