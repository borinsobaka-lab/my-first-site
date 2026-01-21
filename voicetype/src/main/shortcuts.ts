import { globalShortcut, BrowserWindow, ipcMain } from 'electron';
import { sendRecordingStart, sendRecordingStop } from './ipc';
import settingsManager from './settings';
import { RecordingMode } from '../../shared/types';
import { captureCurrentWindow } from './windowFocus';

let isRecording = false;
let currentMode: RecordingMode | null = null;
let currentHotkey: string | null = null;
let currentAiHotkey: string | null = null;
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
 * Register both global hotkeys for voice recording
 */
export function registerHotkeys(window: BrowserWindow): boolean {
  mainWindowRef = window;

  const dictationResult = registerDictationHotkey();
  const aiResult = registerAiHotkey();

  return dictationResult || aiResult; // At least one should work
}

/**
 * Register dictation hotkey
 */
function registerDictationHotkey(): boolean {
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
      handleHotkeyPress('dictation');
    });

    if (registered) {
      currentHotkey = hotkey;
      console.log(`Dictation hotkey registered: ${accelerator}`);
      return true;
    } else {
      console.error(`Failed to register dictation hotkey: ${accelerator}`);
      return false;
    }
  } catch (error) {
    console.error('Error registering dictation hotkey:', error);
    return false;
  }
}

/**
 * Register AI generation hotkey
 */
function registerAiHotkey(): boolean {
  const aiHotkey = settingsManager.get('aiHotkey');

  // Unregister existing AI hotkey if any
  if (currentAiHotkey) {
    try {
      globalShortcut.unregister(parseHotkey(currentAiHotkey));
    } catch {
      // Ignore errors when unregistering
    }
  }

  const accelerator = parseHotkey(aiHotkey);

  try {
    const registered = globalShortcut.register(accelerator, () => {
      handleHotkeyPress('ai-generation');
    });

    if (registered) {
      currentAiHotkey = aiHotkey;
      console.log(`AI generation hotkey registered: ${accelerator}`);
      return true;
    } else {
      console.error(`Failed to register AI hotkey: ${accelerator}`);
      return false;
    }
  } catch (error) {
    console.error('Error registering AI hotkey:', error);
    return false;
  }
}

/**
 * Handle hotkey press - toggle recording
 * @param mode - Which mode was triggered
 */
function handleHotkeyPress(mode: RecordingMode): void {
  if (!mainWindowRef) return;

  // If already recording in the same mode, stop
  if (isRecording && currentMode === mode) {
    stopRecording();
    return;
  }

  // If recording in different mode, stop first then start new
  if (isRecording && currentMode !== mode) {
    stopRecording();
    // Small delay before starting new mode
    setTimeout(() => {
      startRecording(mode);
    }, 100);
    return;
  }

  // Start recording in the requested mode
  startRecording(mode);
}

/**
 * Start recording in specified mode
 */
function startRecording(mode: RecordingMode): void {
  if (!mainWindowRef || isRecording) return;

  // IMPORTANT: Capture the foreground window synchronously BEFORE we do anything else
  // This is the window where the user wants to paste the text
  const insertMode = settingsManager.get('insertMode');
  if (insertMode === 'type') {
    // Don't await - capture happens synchronously in the native call
    captureCurrentWindow().then(captured => {
      console.log('Foreground window captured:', captured);
    }).catch(err => {
      console.error('Failed to capture window:', err);
    });
  }

  // Start recording immediately without waiting for window capture
  isRecording = true;
  currentMode = mode;
  sendRecordingStart(mainWindowRef, mode);
  console.log(`Recording started via hotkey (mode: ${mode})`);
}

/**
 * Stop recording
 */
function stopRecording(): void {
  if (!mainWindowRef || !isRecording) return;

  isRecording = false;
  sendRecordingStop(mainWindowRef);
  console.log(`Recording stopped via hotkey (mode: ${currentMode})`);
  // Don't reset currentMode here - renderer needs it
}

/**
 * Setup IPC listeners for recording state sync from renderer
 */
export function setupRecordingStateSync(): void {
  // Sync recording state from renderer
  ipcMain.on('recording:state-sync', (_event, recording: boolean) => {
    isRecording = recording;
    if (!recording) {
      currentMode = null;
    }
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
 * Get current recording mode
 */
export function getCurrentMode(): RecordingMode | null {
  return currentMode;
}

/**
 * Reset recording state (called when recording ends in renderer)
 */
export function resetRecordingState(): void {
  isRecording = false;
  currentMode = null;
}

/**
 * Update hotkeys (called when settings change)
 */
export function updateHotkeys(): boolean {
  if (mainWindowRef) {
    return registerHotkeys(mainWindowRef);
  }
  return false;
}

// Backwards compatibility
export const registerHotkey = registerHotkeys;
export const updateHotkey = updateHotkeys;

/**
 * Unregister all global shortcuts
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  currentHotkey = null;
  currentAiHotkey = null;
  isRecording = false;
  currentMode = null;
  console.log('All shortcuts unregistered');
}
