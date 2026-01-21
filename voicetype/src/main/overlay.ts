/**
 * Floating Overlay Window for Recording Status
 * Shows recording/processing/error status on top of all windows
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { RecordingState, RecordingMode, IPC_CHANNELS } from '../../shared/types';
import settingsManager from './settings';

let overlayWindow: BrowserWindow | null = null;
let overlayReady = false;
let currentState: RecordingState = 'idle';
let currentMode: RecordingMode = 'dictation';
let hideTimeout: NodeJS.Timeout | null = null;
let pendingState: { state: RecordingState; mode: RecordingMode; hotkey: string } | null = null;

const isDev = process.env.NODE_ENV === 'development' || !process.env.npm_package_version;

/**
 * Create the overlay window
 */
export function createOverlayWindow(): void {
  if (overlayWindow) return;

  const display = screen.getPrimaryDisplay();
  const { width: screenWidth } = display.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 320,
    height: 120,
    x: screenWidth - 340,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/overlay.js'),
    },
  });

  // Prevent the overlay from stealing focus
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Load overlay content
  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173/overlay.html');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    overlayReady = false;
  });

  // Track when overlay content is ready
  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('[Overlay] Content loaded, overlay is ready');
    overlayReady = true;

    // Send any pending state
    if (pendingState && overlayWindow) {
      console.log('[Overlay] Sending pending state:', pendingState);
      overlayWindow.webContents.send('overlay:state-changed', pendingState);
      overlayWindow.showInactive();
      pendingState = null;
    }
  });

  // Setup IPC handlers for overlay
  setupOverlayIPC();
}

/**
 * Setup IPC handlers for overlay window
 */
function setupOverlayIPC(): void {
  ipcMain.handle('overlay:get-state', () => {
    const hotkey = currentMode === 'ai-generation'
      ? settingsManager.get('aiHotkey')
      : settingsManager.get('hotkey');
    return { state: currentState, mode: currentMode, hotkey };
  });
}

/**
 * Update overlay state
 */
export function updateOverlayState(state: RecordingState, mode?: RecordingMode): void {
  console.log('[Overlay] updateOverlayState called:', { state, mode });

  currentState = state;
  if (mode) {
    currentMode = mode;
  }

  // Clear any pending hide timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (!overlayWindow) {
    console.log('[Overlay] Creating overlay window...');
    createOverlayWindow();
  }

  if (!overlayWindow) {
    console.log('[Overlay] Failed to create overlay window');
    return;
  }

  // Show overlay for recording, processing, error states
  const showStates: RecordingState[] = ['recording', 'processing', 'ai-recording', 'ai-processing', 'error'];
  if (showStates.includes(state)) {
    const hotkey = currentMode === 'ai-generation'
      ? settingsManager.get('aiHotkey')
      : settingsManager.get('hotkey');

    if (overlayReady) {
      console.log('[Overlay] Showing overlay for state:', state, 'hotkey:', hotkey);
      overlayWindow.webContents.send('overlay:state-changed', { state, mode: currentMode, hotkey });
      overlayWindow.showInactive();
    } else {
      console.log('[Overlay] Overlay not ready, queueing state:', state);
      pendingState = { state, mode: currentMode, hotkey };
      // Show the window anyway - it will update when ready
      overlayWindow.showInactive();
    }
  } else if (state === 'idle') {
    console.log('[Overlay] Hiding overlay');
    pendingState = null;
    overlayWindow.hide();
  }
}

/**
 * Show error on overlay with auto-hide after delay
 */
export function showOverlayError(message: string): void {
  currentState = 'error';

  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (!overlayWindow) return;

  overlayWindow.webContents.send('overlay:error', { message });
  overlayWindow.showInactive();

  // Auto-hide after 3 seconds
  hideTimeout = setTimeout(() => {
    if (overlayWindow) {
      overlayWindow.hide();
    }
    currentState = 'idle';
  }, 3000);
}

/**
 * Hide overlay
 */
export function hideOverlay(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (overlayWindow) {
    overlayWindow.hide();
  }
  currentState = 'idle';
}

/**
 * Destroy overlay window
 */
export function destroyOverlay(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
}
