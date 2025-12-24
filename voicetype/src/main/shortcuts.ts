import { globalShortcut, BrowserWindow, ipcMain } from 'electron';
import { sendRecordingStart, sendRecordingStop } from './ipc';
import settingsManager from './settings';
import { IPC_CHANNELS } from '../../shared/types';
import { captureCurrentWindow, clearCapturedWindow } from './windowFocus';

let isRecording = false;
let currentHotkey: string | null = null;
let mainWindowRef: BrowserWindow | null = null;

/**
 * Parse hotkey string to Electron accelerator format
 * e.g., 'Ctrl+Shift+Space' -> 'CommandOrControl+Shift+Space'
 */
function parseHotkey(hotkey: string): string {
  return hotkey
    .replace(/Ctrl/gi, 'CommandOrControl')
    .replace(/Meta/gi, 'CommandOrControl');
}

/**
 * Register global hotkey for voice recording
 */
export function registerHotkey(window: BrowserWindow): boolean {
  mainWindowRef = window;
  const hotkey = settingsManager.get('hotkey');

  // Unregister existing hotkey if any
  if (currentHotkey) {
    try {
      globalShortcut.unregister(parseHotkey(currentHotkey));
    } catch {
      // Ignore errors when unregistering
    }
  }

  const accelerator = parseHotkey(hotkey);

  try {
    const registered = globalShortcut.register(accelerator, () => {
      handleHotkeyPress();
    });

    if (registered) {
      currentHotkey = hotkey;
      console.log(`Hotkey registered: ${accelerator}`);
      return true;
    } else {
      console.error(`Failed to register hotkey: ${accelerator}`);
      return false;
    }
  } catch (error) {
    console.error('Error registering hotkey:', error);
    return false;
  }
}

/**
 * Handle hotkey press - toggle recording
 */
function handleHotkeyPress(): void {
  if (!mainWindowRef) return;

  // Toggle recording state
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Start recording
 */
async function startRecording(): Promise<void> {
  if (!mainWindowRef || isRecording) return;

  // IMPORTANT: Capture the foreground window BEFORE we do anything else
  // This is the window where the user wants to paste the text
  const insertMode = settingsManager.get('insertMode');
  if (insertMode === 'type') {
    const captured = await captureCurrentWindow();
    console.log('Foreground window captured:', captured);
  }

  isRecording = true;
  sendRecordingStart(mainWindowRef);
  console.log('Recording started via hotkey');
}

/**
 * Stop recording
 */
function stopRecording(): void {
  if (!mainWindowRef || !isRecording) return;

  isRecording = false;
  sendRecordingStop(mainWindowRef);
  console.log('Recording stopped via hotkey');
}

/**
 * Setup IPC listeners for recording state sync from renderer
 */
export function setupRecordingStateSync(): void {
  // Sync recording state from renderer
  ipcMain.on('recording:state-sync', (_event, recording: boolean) => {
    isRecording = recording;
    console.log('Recording state synced from renderer:', recording);
  });
}

/**
 * Get current recording state
 */
export function getRecordingState(): boolean {
  return isRecording;
}

/**
 * Reset recording state (called when recording ends in renderer)
 */
export function resetRecordingState(): void {
  isRecording = false;
}

/**
 * Update hotkey (called when settings change)
 */
export function updateHotkey(): boolean {
  if (mainWindowRef) {
    return registerHotkey(mainWindowRef);
  }
  return false;
}

/**
 * Unregister all global shortcuts
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  currentHotkey = null;
  isRecording = false;
  console.log('All shortcuts unregistered');
}
