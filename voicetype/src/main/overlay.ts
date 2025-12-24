/**
 * Floating Overlay Window for Recording Status
 * Shows recording/processing/error status on top of all windows
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { RecordingState, IPC_CHANNELS } from '../../shared/types';
import settingsManager from './settings';

let overlayWindow: BrowserWindow | null = null;
let currentState: RecordingState = 'idle';
let hideTimeout: NodeJS.Timeout | null = null;

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
  });

  // Setup IPC handlers for overlay
  setupOverlayIPC();
}

/**
 * Setup IPC handlers for overlay window
 */
function setupOverlayIPC(): void {
  ipcMain.handle('overlay:get-state', () => {
    const hotkey = settingsManager.get('hotkey');
    return { state: currentState, hotkey };
  });
}

/**
 * Update overlay state
 */
export function updateOverlayState(state: RecordingState): void {
  currentState = state;

  // Clear any pending hide timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (!overlayWindow) return;

  // Show overlay for recording, processing, error states
  if (state === 'recording' || state === 'processing' || state === 'error') {
    const hotkey = settingsManager.get('hotkey');
    overlayWindow.webContents.send('overlay:state-changed', { state, hotkey });
    overlayWindow.showInactive();
  } else if (state === 'idle') {
    // Hide overlay when idle (after successful insert or cancel)
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
