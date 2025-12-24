/**
 * Logger Service
 * Captures logs and sends them to the renderer for display
 */

import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, LogEntry } from '../../shared/types';

// Store logs in memory (last 100 entries)
const logs: LogEntry[] = [];
const MAX_LOGS = 100;
let logId = 0;
let mainWindowRef: BrowserWindow | null = null;

/**
 * Set the main window reference for sending logs
 */
export function setLoggerWindow(window: BrowserWindow): void {
  mainWindowRef = window;
}

/**
 * Add a log entry
 */
function addLog(level: LogEntry['level'], message: string, details?: string): void {
  const entry: LogEntry = {
    id: ++logId,
    timestamp: new Date(),
    level,
    message,
    details,
  };

  logs.push(entry);

  // Keep only last MAX_LOGS entries
  while (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Send to renderer if window is available
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    try {
      mainWindowRef.webContents.send(IPC_CHANNELS.LOG_MESSAGE, entry);
    } catch {
      // Ignore send errors
    }
  }

  // Also log to console
  const prefix = `[${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message, details || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, details || '');
  } else {
    console.log(prefix, message, details || '');
  }
}

/**
 * Log info message
 */
export function logInfo(message: string, details?: string): void {
  addLog('info', message, details);
}

/**
 * Log warning message
 */
export function logWarn(message: string, details?: string): void {
  addLog('warn', message, details);
}

/**
 * Log error message
 */
export function logError(message: string, details?: string): void {
  addLog('error', message, details);
}

/**
 * Log success message
 */
export function logSuccess(message: string, details?: string): void {
  addLog('success', message, details);
}

/**
 * Get all logs
 */
export function getLogs(): LogEntry[] {
  return [...logs];
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
  logId = 0;
}
