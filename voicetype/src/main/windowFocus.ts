/**
 * Window Focus Manager for Windows
 * Tracks and restores focus to the window that was active before VoiceType operation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store the handle of the last foreground window (as a BigInt for 64-bit handles)
let lastForegroundWindow: bigint | null = null;

// koffi bindings
let koffiLoaded = false;
let koffiLoadAttempted = false;
let GetForegroundWindow: (() => bigint) | null = null;
let SetForegroundWindow: ((hwnd: bigint) => number) | null = null;
let ShowWindow: ((hwnd: bigint, cmd: number) => number) | null = null;
let keybd_event: ((vk: number, scan: number, flags: number, extra: number) => void) | null = null;
let GetWindowThreadProcessId: ((hwnd: bigint, pid: number[]) => number) | null = null;
let GetCurrentThreadId: (() => number) | null = null;
let AttachThreadInput: ((idAttach: number, idAttachTo: number, attach: number) => number) | null = null;
let BringWindowToTop: ((hwnd: bigint) => number) | null = null;
let SetFocus: ((hwnd: bigint) => bigint) | null = null;

const SW_RESTORE = 9;
const SW_SHOW = 5;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
const KEYEVENTF_KEYUP = 0x0002;

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
    const koffi = await import('koffi');

    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');

    // Bind functions with proper types
    GetForegroundWindow = user32.func('long long GetForegroundWindow()');
    SetForegroundWindow = user32.func('int SetForegroundWindow(long long hwnd)');
    ShowWindow = user32.func('int ShowWindow(long long hwnd, int nCmdShow)');
    BringWindowToTop = user32.func('int BringWindowToTop(long long hwnd)');
    SetFocus = user32.func('long long SetFocus(long long hwnd)');
    GetWindowThreadProcessId = user32.func('int GetWindowThreadProcessId(long long hwnd, int* lpdwProcessId)');
    GetCurrentThreadId = kernel32.func('int GetCurrentThreadId()');
    AttachThreadInput = user32.func('int AttachThreadInput(int idAttach, int idAttachTo, int fAttach)');

    // keybd_event for sending keystrokes
    keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, int dwFlags, int dwExtraInfo)');

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
 * Capture the current foreground window handle
 * Call this BEFORE recording starts
 */
export async function captureCurrentWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  try {
    await loadKoffi();

    if (koffiLoaded && GetForegroundWindow) {
      const hwnd = GetForegroundWindow();
      lastForegroundWindow = hwnd;
      console.log('Captured foreground window (koffi):', hwnd.toString());
      return hwnd !== 0n;
    }

    // Fallback: use PowerShell to get foreground window
    console.log('koffi not available, using PowerShell to get foreground window...');
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "[System.IntPtr]::new((Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")]public static extern IntPtr GetForegroundWindow();' -Name W -PassThru)::GetForegroundWindow()).ToInt64()"`,
      { windowsHide: true, timeout: 3000 }
    );

    const hwnd = BigInt(stdout.trim());
    lastForegroundWindow = hwnd;
    console.log('Captured foreground window (PowerShell):', hwnd.toString());
    return hwnd !== 0n;
  } catch (error) {
    console.error('Failed to capture foreground window:', error);
    return false;
  }
}

/**
 * Restore focus to the previously captured window
 */
export async function restoreFocusToWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (!lastForegroundWindow || lastForegroundWindow === 0n) {
    console.log('No captured window to restore');
    return false;
  }

  console.log('Restoring focus to window:', lastForegroundWindow.toString());

  try {
    await loadKoffi();

    if (koffiLoaded && SetForegroundWindow && ShowWindow && GetWindowThreadProcessId && GetCurrentThreadId && AttachThreadInput) {
      // Get thread IDs
      const currentThreadId = GetCurrentThreadId();
      const pidBuffer = [0];
      const targetThreadId = GetWindowThreadProcessId(lastForegroundWindow, pidBuffer);

      console.log(`Current thread: ${currentThreadId}, Target thread: ${targetThreadId}`);

      // Attach to target thread
      if (targetThreadId !== currentThreadId && targetThreadId !== 0) {
        AttachThreadInput(currentThreadId, targetThreadId, 1);
      }

      // Restore and show window
      ShowWindow(lastForegroundWindow, SW_RESTORE);
      ShowWindow(lastForegroundWindow, SW_SHOW);

      // Bring to top and set foreground
      if (BringWindowToTop) BringWindowToTop(lastForegroundWindow);
      const result = SetForegroundWindow(lastForegroundWindow);

      // Try SetFocus
      if (SetFocus) {
        try { SetFocus(lastForegroundWindow); } catch {}
      }

      // Detach from target thread
      if (targetThreadId !== currentThreadId && targetThreadId !== 0) {
        AttachThreadInput(currentThreadId, targetThreadId, 0);
      }

      console.log('SetForegroundWindow result:', result);
      return result !== 0;
    }

    // Fallback: use PowerShell to set foreground window
    console.log('koffi not available, using PowerShell to restore focus...');
    await execAsync(
      `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\\\"user32.dll\\\")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport(\\\"user32.dll\\\")]public static extern bool ShowWindow(IntPtr h,int c);}'; [W]::ShowWindow([IntPtr]::new(${lastForegroundWindow.toString()}),9); [W]::SetForegroundWindow([IntPtr]::new(${lastForegroundWindow.toString()}))"`,
      { windowsHide: true, timeout: 3000 }
    );
    console.log('Focus restored via PowerShell');
    return true;
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
  return lastForegroundWindow !== null && lastForegroundWindow !== 0n;
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
  return lastForegroundWindow ? lastForegroundWindow.toString() : 'none';
}
