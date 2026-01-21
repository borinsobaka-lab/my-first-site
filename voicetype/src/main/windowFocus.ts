/**
 * Window Focus Manager for Windows
 * Tracks and restores focus to the window that was active before VoiceType operation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store the handle of the last foreground window
let lastForegroundWindow: string | null = null;

// koffi bindings
let koffiLoaded = false;
let koffiLoadAttempted = false;
let koffi: any = null;
let user32: any = null;
let kernel32: any = null;

// Function references
let GetForegroundWindow: any = null;
let SetForegroundWindow: any = null;
let ShowWindow: any = null;
let keybd_event: any = null;
let GetWindowThreadProcessId: any = null;
let GetCurrentThreadId: any = null;
let AttachThreadInput: any = null;
let BringWindowToTop: any = null;

const SW_RESTORE = 9;
const SW_SHOW = 5;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
const KEYEVENTF_KEYUP = 0x0002;

/**
 * Initialize koffi at app startup (call this early)
 */
export function initializeWindowFocus(): void {
  if (process.platform === 'win32') {
    loadKoffi().catch(err => {
      console.error('Failed to pre-load koffi:', err);
    });
  }
}

/**
 * Load koffi and Windows API bindings
 */
async function loadKoffi(): Promise<boolean> {
  if (koffiLoaded) return true;
  if (koffiLoadAttempted) return false;

  koffiLoadAttempted = true;

  if (process.platform !== 'win32') {
    console.log('koffi: Not on Windows, skipping');
    return false;
  }

  try {
    console.log('Loading koffi...');

    // Try require instead of dynamic import
    try {
      koffi = require('koffi');
    } catch (e) {
      // Try dynamic import as fallback
      const module = await import('koffi');
      koffi = module.default || module;
    }

    if (!koffi || typeof koffi.load !== 'function') {
      console.error('koffi module loaded but .load is not a function');
      console.log('koffi type:', typeof koffi);
      console.log('koffi keys:', koffi ? Object.keys(koffi) : 'null');
      return false;
    }

    user32 = koffi.load('user32.dll');
    kernel32 = koffi.load('kernel32.dll');

    // Bind functions - use IntPtr as pointer type for handles
    GetForegroundWindow = user32.func('intptr GetForegroundWindow()');
    SetForegroundWindow = user32.func('int SetForegroundWindow(intptr hwnd)');
    ShowWindow = user32.func('int ShowWindow(intptr hwnd, int nCmdShow)');
    BringWindowToTop = user32.func('int BringWindowToTop(intptr hwnd)');
    GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(intptr hwnd, uint32* lpdwProcessId)');
    GetCurrentThreadId = kernel32.func('uint32 GetCurrentThreadId()');
    AttachThreadInput = user32.func('int AttachThreadInput(uint32 idAttach, uint32 idAttachTo, int fAttach)');
    keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)');

    koffiLoaded = true;
    console.log('koffi loaded successfully!');
    return true;
  } catch (error) {
    console.error('Failed to load koffi:', error);
    koffiLoaded = false;
    return false;
  }
}

/**
 * Capture the current foreground window handle using PowerShell
 */
async function captureWithPowerShell(): Promise<string | null> {
  try {
    // Simpler PowerShell command that works on all Windows versions
    const psCommand = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
'@
Add-Type -TypeDefinition $code -Language CSharp
[Win32]::GetForegroundWindow().ToInt64()
`.trim().replace(/\n/g, ' ');

    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
      { windowsHide: true, timeout: 5000 }
    );

    const hwnd = stdout.trim();
    if (hwnd && hwnd !== '0') {
      console.log('Captured foreground window (PowerShell):', hwnd);
      return hwnd;
    }
    return null;
  } catch (error) {
    console.error('PowerShell GetForegroundWindow failed:', error);
    return null;
  }
}

/**
 * Capture the current foreground window handle
 * Call this BEFORE recording starts
 */
export async function captureCurrentWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  try {
    // Try koffi first
    await loadKoffi();

    if (koffiLoaded && GetForegroundWindow) {
      try {
        const hwnd = GetForegroundWindow();
        if (hwnd) {
          lastForegroundWindow = hwnd.toString();
          console.log('Captured foreground window (koffi):', lastForegroundWindow);
          return true;
        }
      } catch (e) {
        console.error('koffi GetForegroundWindow failed:', e);
      }
    }

    // Fallback to PowerShell
    console.log('Trying PowerShell to capture foreground window...');
    const hwnd = await captureWithPowerShell();
    if (hwnd) {
      lastForegroundWindow = hwnd;
      return true;
    }

    console.error('All methods to capture foreground window failed');
    return false;
  } catch (error) {
    console.error('Failed to capture foreground window:', error);
    return false;
  }
}

/**
 * Restore focus to the previously captured window using PowerShell
 */
async function restoreWithPowerShell(): Promise<boolean> {
  if (!lastForegroundWindow) return false;

  try {
    // Only call SetForegroundWindow - don't change window state (keeps fullscreen intact)
    const psCommand = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
Add-Type -TypeDefinition $code -Language CSharp
$hwnd = [IntPtr]::new(${lastForegroundWindow})
[Win32]::SetForegroundWindow($hwnd)
`.trim().replace(/\n/g, ' ');

    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
      { windowsHide: true, timeout: 5000 }
    );

    console.log('Focus restored via PowerShell');
    return true;
  } catch (error) {
    console.error('PowerShell SetForegroundWindow failed:', error);
    return false;
  }
}

/**
 * Restore focus to the previously captured window
 */
export async function restoreFocusToWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (!lastForegroundWindow) {
    console.log('No captured window to restore');
    return false;
  }

  console.log('Restoring focus to window:', lastForegroundWindow);

  try {
    await loadKoffi();

    if (koffiLoaded && SetForegroundWindow && GetWindowThreadProcessId && GetCurrentThreadId && AttachThreadInput) {
      try {
        const hwnd = BigInt(lastForegroundWindow);

        // Get thread IDs
        const currentThreadId = GetCurrentThreadId();
        const pidBuffer = [0];
        const targetThreadId = GetWindowThreadProcessId(hwnd, pidBuffer);

        console.log(`Current thread: ${currentThreadId}, Target thread: ${targetThreadId}`);

        // Attach to target thread to bypass foreground lock
        if (targetThreadId !== currentThreadId && targetThreadId !== 0) {
          AttachThreadInput(currentThreadId, targetThreadId, 1);
        }

        // Just set foreground - don't change window state (keeps fullscreen intact)
        const result = SetForegroundWindow(hwnd);

        // Detach from target thread
        if (targetThreadId !== currentThreadId && targetThreadId !== 0) {
          AttachThreadInput(currentThreadId, targetThreadId, 0);
        }

        console.log('SetForegroundWindow result:', result);
        return result !== 0;
      } catch (e) {
        console.error('koffi focus restore failed:', e);
      }
    }

    // Fallback to PowerShell
    console.log('Trying PowerShell to restore focus...');
    return await restoreWithPowerShell();
  } catch (error) {
    console.error('Failed to restore focus:', error);
    return false;
  }
}

/**
 * Send Ctrl+V keystroke using Windows API
 */
export async function sendCtrlV(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  try {
    await loadKoffi();

    if (koffiLoaded && keybd_event) {
      console.log('Sending Ctrl+V via koffi keybd_event...');

      // Press Ctrl
      keybd_event(VK_CONTROL, 0, 0, 0);
      // Press V
      keybd_event(VK_V, 0, 0, 0);
      // Release V
      keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
      // Release Ctrl
      keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

      console.log('Ctrl+V sent via koffi');
      return true;
    }

    console.log('koffi not available for keybd_event');
    return false;
  } catch (error) {
    console.error('Failed to send Ctrl+V via koffi:', error);
    return false;
  }
}

/**
 * Check if we have a captured window
 */
export function hasCapturedWindow(): boolean {
  return lastForegroundWindow !== null && lastForegroundWindow !== '0';
}

/**
 * Clear the captured window
 */
export function clearCapturedWindow(): void {
  lastForegroundWindow = null;
}

/**
 * Get captured window handle as string (for debugging)
 */
export function getCapturedWindowInfo(): string {
  return lastForegroundWindow || 'none';
}
