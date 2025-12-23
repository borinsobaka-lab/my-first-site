// App Settings
export interface AppSettings {
  apiKey: string;
  language: string; // 'auto' | 'en' | 'ru' | 'de' | 'es' | 'fr' | 'ja' | 'zh' | ...
  hotkey: string; // 'Ctrl+Shift+Space'
  hotkeyMode: 'push-to-talk' | 'toggle';
  insertMode: 'type' | 'clipboard';
  selectedMicrophone: string | null;
  autoStart: boolean;
  postProcessing: boolean;
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

  // Renderer → Main
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_ERROR: 'transcription:error',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESPONSE: 'settings:response',
  TEXT_INSERT: 'text:insert',

  // Window controls
  WINDOW_SHOW_SETTINGS: 'window:show-settings',
  WINDOW_HIDE: 'window:hide',

  // Tray
  TRAY_UPDATE_STATE: 'tray:update-state',
} as const;

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  language: 'auto',
  hotkey: 'Ctrl+Shift+Space',
  hotkeyMode: 'toggle',
  insertMode: 'type',
  selectedMicrophone: null,
  autoStart: false,
  postProcessing: false,
};

// Supported languages for Whisper API
export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Russian' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pl', name: 'Polish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'cs', name: 'Czech' },
  { code: 'el', name: 'Greek' },
] as const;
