/// <reference types="vite/client" />

import { AppSettings, RecordingState } from '../../shared/types';

// Electron API exposed through preload script
interface ElectronAPI {
  // Settings
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

  // Text insertion
  insertText: (text: string) => Promise<{ success: boolean }>;

  // Transcription events
  sendTranscriptionResult: (text: string) => void;
  sendTranscriptionError: (error: string) => void;

  // Sync recording state to main process
  syncRecordingState: (isRecording: boolean) => void;

  // Tray updates
  updateTrayState: (state: RecordingState) => void;

  // Event listeners
  onRecordingStart: (callback: () => void) => () => void;
  onRecordingStop: (callback: () => void) => () => void;
  onStateChanged: (callback: (state: RecordingState) => void) => () => void;
  onShowAbout: (callback: () => void) => () => void;

  // Platform info
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
