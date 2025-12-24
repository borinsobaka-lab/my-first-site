/**
 * Window Focus Manager for Windows
 * Tracks and restores focus to the window that was active before VoiceType operation
 */

// Store the handle of the last foreground window
let lastForegroundWindow: number | null = null;

// Windows API bindings via koffi
let user32: any = null;
let kernel32: any = null;
let apiLoaded = false;
let apiLoading: Promise<boolean> | null = null;

// Windows API function bindings
let GetForegroundWindow: any = null;
let SetForegroundWindow: any = null;
let GetWindowThreadProcessId: any = null;
let GetCurrentThreadId: any = null;
let AttachThreadInput: any = null;
let BringWindowToTop: any = null;
let ShowWindow: any = null;
let SetFocus: any = null;
let AllowSetForegroundWindow: any = null;
let keybd_event: any = null;

// Windows API constants
const SW_SHOW = 5;
const SW_RESTORE = 9;
const ASFW_ANY = -1;

/**
 * Load Windows API bindings
 */
async function loadWindowsAPI(): Promise<boolean> {
  if (apiLoaded) return true;
  if (process.platform !== 'win32') return false;
  if (apiLoading) return apiLoading;

  apiLoading = (async () => {
    try {
      const koffi = await import('koffi');

      // Load user32.dll
      user32 = koffi.load('user32.dll');

      // Load kernel32.dll
      kernel32 = koffi.load('kernel32.dll');

      // Bind functions
      GetForegroundWindow = user32.func('void* GetForegroundWindow()');
      SetForegroundWindow = user32.func('int SetForegroundWindow(void* hWnd)');
      GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(void* hWnd, uint32* lpdwProcessId)');
      GetCurrentThreadId = kernel32.func('uint32 GetCurrentThreadId()');
      AttachThreadInput = user32.func('int AttachThreadInput(uint32 idAttach, uint32 idAttachTo, int fAttach)');
      BringWindowToTop = user32.func('int BringWindowToTop(void* hWnd)');
      ShowWindow = user32.func('int ShowWindow(void* hWnd, int nCmdShow)');
      SetFocus = user32.func('void* SetFocus(void* hWnd)');
      AllowSetForegroundWindow = user32.func('int AllowSetForegroundWindow(uint32 dwProcessId)');

      // keybd_event for sending keystrokes
      keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)');

      apiLoaded = true;
      console.log('Windows API loaded successfully for focus management');
      return true;
    } catch (error) {
      console.warn('Failed to load Windows API for focus management:', error);
      apiLoaded = false;
      return false;
    }
  })();

  return apiLoading;
}

/**
 * Store the current foreground window handle
 * Call this BEFORE recording starts
 */
export async function captureCurrentWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  await loadWindowsAPI();
  if (!apiLoaded || !GetForegroundWindow) return false;

  try {
    lastForegroundWindow = GetForegroundWindow();
    console.log('Captured foreground window handle:', lastForegroundWindow);
    return lastForegroundWindow !== null && lastForegroundWindow !== 0;
  } catch (error) {
    console.error('Failed to capture foreground window:', error);
    return false;
  }
}

/**
 * Restore focus to the previously captured window
 * Call this BEFORE pasting text
 */
export async function restoreFocusToWindow(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (!lastForegroundWindow || lastForegroundWindow === 0) {
    console.log('No foreground window captured to restore');
    return false;
  }

  await loadWindowsAPI();
  if (!apiLoaded) return false;

  try {
    console.log('Restoring focus to window handle:', lastForegroundWindow);

    // Allow any process to set foreground window
    try {
      AllowSetForegroundWindow(ASFW_ANY);
    } catch (e) {
      // May fail, continue anyway
    }

    // Get thread IDs for AttachThreadInput
    const currentThreadId = GetCurrentThreadId();
    const processIdBuffer = [0]; // Output parameter
    const targetThreadId = GetWindowThreadProcessId(lastForegroundWindow, processIdBuffer);

    console.log(`Current thread: ${currentThreadId}, Target thread: ${targetThreadId}`);

    // Attach to the target window's thread to allow focus change
    if (targetThreadId && targetThreadId !== currentThreadId) {
      AttachThreadInput(currentThreadId, targetThreadId, 1); // Attach
    }

    // Show and restore the window if minimized
    ShowWindow(lastForegroundWindow, SW_RESTORE);
    ShowWindow(lastForegroundWindow, SW_SHOW);

    // Bring window to top
    BringWindowToTop(lastForegroundWindow);

    // Set as foreground window
    const result = SetForegroundWindow(lastForegroundWindow);
    console.log('SetForegroundWindow result:', result);

    // Try to set focus
    try {
      SetFocus(lastForegroundWindow);
    } catch (e) {
      // May fail, continue anyway
    }

    // Detach from the target window's thread
    if (targetThreadId && targetThreadId !== currentThreadId) {
      AttachThreadInput(currentThreadId, targetThreadId, 0); // Detach
    }

    // Small delay to let Windows process the focus change
    await new Promise(resolve => setTimeout(resolve, 100));

    return result !== 0;
  } catch (error) {
    console.error('Failed to restore focus to window:', error);
    return false;
  }
}

/**
 * Send Ctrl+V keystroke using Windows API directly
 * This is more reliable than spawning a subprocess
 */
export async function sendCtrlV(): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  await loadWindowsAPI();
  if (!apiLoaded || !keybd_event) return false;

  try {
    console.log('Sending Ctrl+V via Windows API...');

    const VK_CONTROL = 0x11;
    const VK_V = 0x56;
    const KEYEVENTF_KEYUP = 0x0002;

    // Small delay to ensure window has focus
    await new Promise(resolve => setTimeout(resolve, 50));

    // Ctrl down
    keybd_event(VK_CONTROL, 0, 0, 0);
    // V down
    keybd_event(VK_V, 0, 0, 0);
    // V up
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
    // Ctrl up
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

    console.log('Ctrl+V sent via Windows API');
    return true;
  } catch (error) {
    console.error('Failed to send Ctrl+V via Windows API:', error);
    return false;
  }
}

/**
 * Clear the stored window handle
 */
export function clearCapturedWindow(): void {
  lastForegroundWindow = null;
}

/**
 * Check if we have a captured window
 */
export function hasCapturedWindow(): boolean {
  return lastForegroundWindow !== null && lastForegroundWindow !== 0;
}
