// App Settings
export interface AppSettings {
  // API Keys
  whisperApiKey: string;  // API key for transcription (Whisper)
  gptApiKey: string;      // API key for AI generation (GPT)

  // Hotkeys
  hotkey: string;         // Hotkey for dictation mode (e.g., 'Ctrl+Shift+Space')
  aiHotkey: string;       // Hotkey for AI generation mode
  hotkeyMode: 'push-to-talk' | 'toggle';

  // AI Settings
  gptModel: 'gpt-4o-mini' | 'gpt-4o';

  // General Settings
  language: string;       // 'auto' | 'en' | 'ru' | 'de' | 'es' | 'fr' | 'ja' | 'zh' | ...
  insertMode: 'type' | 'clipboard';
  selectedMicrophone: string | null;
  autoStart: boolean;
  soundEnabled: boolean;
  totalRecordingSeconds: number;
}

// Recording mode - which hotkey was pressed
export type RecordingMode = 'dictation' | 'ai-generation';

// Recording states (extended for AI mode)
export type RecordingState =
  | 'idle'
  | 'recording'      // Dictation recording
  | 'processing'     // Dictation processing (Whisper)
  | 'ai-recording'   // AI generation recording
  | 'ai-processing'  // AI generation processing (Whisper + GPT)
  | 'error';

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
  RECORDING_START: 'recording:start',           // data: { mode: RecordingMode }
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
  // API Keys
  whisperApiKey: '',
  gptApiKey: '',

  // Hotkeys
  hotkey: 'Ctrl+Shift+Space',
  aiHotkey: 'Ctrl+Shift+G',
  hotkeyMode: 'toggle',

  // AI Settings
  gptModel: 'gpt-4o-mini',

  // General Settings
  language: 'auto',
  insertMode: 'type',
  selectedMicrophone: null,
  autoStart: false,
  soundEnabled: true,
  totalRecordingSeconds: 0,
};

// GPT Models for selection
export const GPT_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (быстрее и дешевле)' },
  { id: 'gpt-4o', name: 'GPT-4o (умнее, но дороже)' },
] as const;

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
