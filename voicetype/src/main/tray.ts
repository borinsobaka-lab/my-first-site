import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';
import { RecordingState } from '../../shared/types';

let tray: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;
let currentState: RecordingState = 'idle';

// Icon colors as data URLs for different states
const ICON_SIZE = 16;

function createIconDataUrl(color: string): string {
  // Create a simple colored circle icon as data URL
  const svg = `
    <svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${ICON_SIZE / 2}" cy="${ICON_SIZE / 2}" r="${ICON_SIZE / 2 - 1}" fill="${color}" stroke="#333" stroke-width="1"/>
      <circle cx="${ICON_SIZE / 2}" cy="${ICON_SIZE / 2}" r="${ICON_SIZE / 4}" fill="#fff"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const icons = {
  idle: createIconDataUrl('#22c55e'),      // Green
  recording: createIconDataUrl('#ef4444'),  // Red
  processing: createIconDataUrl('#f59e0b'), // Orange/Yellow
  error: createIconDataUrl('#6b7280'),      // Gray
};

/**
 * Create and initialize the system tray
 */
export function createTray(window: BrowserWindow): Tray {
  mainWindowRef = window;

  // Create tray icon
  const icon = nativeImage.createFromDataURL(icons.idle);
  tray = new Tray(icon.resize({ width: ICON_SIZE, height: ICON_SIZE }));

  // Set tooltip
  tray.setToolTip('VoiceType - Speech to Text');

  // Create context menu
  updateContextMenu();

  // Handle click on tray icon
  tray.on('click', () => {
    if (mainWindowRef) {
      if (mainWindowRef.isVisible()) {
        mainWindowRef.hide();
      } else {
        mainWindowRef.show();
        mainWindowRef.focus();
      }
    }
  });

  return tray;
}

/**
 * Update the tray context menu
 */
function updateContextMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'VoiceType',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Settings',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.show();
          mainWindowRef.focus();
        }
      },
    },
    {
      label: getStatusLabel(),
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.show();
          mainWindowRef.focus();
          mainWindowRef.webContents.send('show-about');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Get status label based on current state
 */
function getStatusLabel(): string {
  switch (currentState) {
    case 'idle':
      return 'Status: Ready';
    case 'recording':
      return 'Status: Recording...';
    case 'processing':
      return 'Status: Processing...';
    case 'error':
      return 'Status: Error';
    default:
      return 'Status: Unknown';
  }
}

/**
 * Update tray icon based on recording state
 */
export function updateTrayState(state: RecordingState): void {
  if (!tray) return;

  currentState = state;

  // Update icon
  const iconData = icons[state] || icons.idle;
  const icon = nativeImage.createFromDataURL(iconData);
  tray.setImage(icon.resize({ width: ICON_SIZE, height: ICON_SIZE }));

  // Update tooltip
  const tooltips: Record<RecordingState, string> = {
    idle: 'VoiceType - Ready',
    recording: 'VoiceType - Recording...',
    processing: 'VoiceType - Processing...',
    error: 'VoiceType - Error',
  };
  tray.setToolTip(tooltips[state] || 'VoiceType');

  // Update context menu
  updateContextMenu();
}

/**
 * Destroy the tray
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
