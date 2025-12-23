import { globalShortcut, BrowserWindow } from 'electron';
import { sendRecordingStart, sendRecordingStop } from './ipc';
import settingsManager from './settings';

type HotkeyMode = 'push-to-talk' | 'toggle';

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
  const mode = settingsManager.get('hotkeyMode');

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
      handleHotkeyPress(mode);
    });

    if (registered) {
      currentHotkey = hotkey;
      console.log(`Hotkey registered: ${accelerator} (mode: ${mode})`);
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
 * Handle hotkey press based on mode
 */
function handleHotkeyPress(mode: HotkeyMode): void {
  if (!mainWindowRef) return;

  if (mode === 'toggle') {
    // Toggle mode: press once to start, press again to stop
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  } else {
    // Push-to-talk mode is handled by key down/up events
    // For simplicity with globalShortcut, we treat it as toggle
    // Note: True push-to-talk would require native key hooks
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
}

/**
 * Start recording
 */
function startRecording(): void {
  if (!mainWindowRef || isRecording) return;

  isRecording = true;
  sendRecordingStart(mainWindowRef);
  console.log('Recording started');
}

/**
 * Stop recording
 */
function stopRecording(): void {
  if (!mainWindowRef || !isRecording) return;

  isRecording = false;
  sendRecordingStop(mainWindowRef);
  console.log('Recording stopped');
}

/**
 * Get current recording state
 */
export function getRecordingState(): boolean {
  return isRecording;
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
