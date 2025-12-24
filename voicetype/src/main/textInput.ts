import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { restoreFocusToWindow, sendCtrlV, hasCapturedWindow, clearCapturedWindow } from './windowFocus';

const execAsync = promisify(exec);

// Windows API via koffi for direct keyboard simulation
let koffiLoaded = false;
let user32: any = null;
let SendInput: any = null;
let koffiLoading: Promise<boolean> | null = null;

// Windows API constants
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const VK_CONTROL = 0x11;
const VK_V = 0x56;

/**
 * Load koffi and setup Windows API bindings
 */
async function loadKoffi(): Promise<boolean> {
  if (koffiLoaded) return true;
  if (process.platform !== 'win32') return false;
  if (koffiLoading) return koffiLoading;

  koffiLoading = (async () => {
    try {
      const koffi = await import('koffi');

      // Define the INPUT structure for SendInput
      const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
        wVk: 'uint16',
        wScan: 'uint16',
        dwFlags: 'uint32',
        time: 'uint32',
        dwExtraInfo: 'uintptr',
      });

      const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
        dx: 'int32',
        dy: 'int32',
        mouseData: 'uint32',
        dwFlags: 'uint32',
        time: 'uint32',
        dwExtraInfo: 'uintptr',
      });

      const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
        uMsg: 'uint32',
        wParamL: 'uint16',
        wParamH: 'uint16',
      });

      // INPUT structure with union
      const INPUT = koffi.struct('INPUT', {
        type: 'uint32',
        ki: KEYBDINPUT, // We'll use keyboard input
      });

      // Load user32.dll
      user32 = koffi.load('user32.dll');

      // Bind SendInput function
      SendInput = user32.func('uint32 SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)');

      koffiLoaded = true;
      console.log('koffi loaded successfully for Windows API');
      return true;
    } catch (error) {
      console.warn('koffi not available:', error);
      koffiLoaded = false;
      return false;
    }
  })();

  return koffiLoading;
}

type InsertMode = 'type' | 'clipboard';

let nutjsAvailable = false;
let keyboard: any = null;
let Key: any = null;
let nutjsLoading: Promise<boolean> | null = null;

// Try to load nut-js fork
async function loadNutJs(): Promise<boolean> {
  if (nutjsAvailable) return true;
  if (nutjsLoading) return nutjsLoading;

  nutjsLoading = (async () => {
    try {
      const nutjs = await import('@nut-tree-fork/nut-js');
      keyboard = nutjs.keyboard;
      Key = nutjs.Key;

      // Configure nut-js for faster operation
      if (keyboard && keyboard.config) {
        keyboard.config.autoDelayMs = 0;
      }

      nutjsAvailable = true;
      console.log('nut-js loaded successfully');
      return true;
    } catch (error) {
      console.warn('nut-js not available:', error);
      nutjsAvailable = false;
      return false;
    }
  })();

  return nutjsLoading;
}

// Initialize nut-js on module load
loadNutJs();

/**
 * Insert text into the currently active text field
 * @param text - The text to insert
 * @param mode - 'type' to simulate keyboard typing, 'clipboard' to copy only
 */
export async function insertText(text: string, mode: InsertMode): Promise<void> {
  if (mode === 'clipboard') {
    // Clipboard mode: just copy text, user pastes manually
    clipboard.writeText(text);
    console.log('Text copied to clipboard');
    return;
  }

  // Type mode: copy to clipboard and simulate Ctrl+V paste
  await copyAndPaste(text);
}

/**
 * Copy text to clipboard and simulate paste
 */
async function copyAndPaste(text: string): Promise<void> {
  // Copy text to clipboard first
  clipboard.writeText(text);
  console.log('Text copied to clipboard for auto-paste');

  const platform = process.platform;
  let pasted = false;

  if (platform === 'win32') {
    // On Windows, use our window focus tracking for reliable paste

    // First, restore focus to the window that was active when recording started
    if (hasCapturedWindow()) {
      console.log('Restoring focus to captured window...');
      const focusRestored = await restoreFocusToWindow();
      console.log('Focus restored:', focusRestored);

      // Give Windows time to process the focus change
      await delay(150);

      // Use our keybd_event based Ctrl+V (most reliable)
      pasted = await sendCtrlV();

      // Clear the captured window after we're done
      clearCapturedWindow();
    }

    // If that didn't work, try other methods
    if (!pasted) {
      console.log('Primary paste method failed, trying alternatives...');

      // Method 2: Windows API SendInput
      await loadKoffi();
      if (koffiLoaded) {
        pasted = await pasteWithWindowsAPI();
      }
    }

    // Method 3: VBScript via mshta (fast, inline)
    if (!pasted) {
      pasted = await pasteWithMshta();
    }

    // Method 4: VBScript via cscript (temp file)
    if (!pasted) {
      pasted = await pasteWithVBScript();
    }

    // Method 5: PowerShell with WScript.Shell COM
    if (!pasted) {
      pasted = await pasteWithPowerShellWScript();
    }

    // Method 6: Original PowerShell method
    if (!pasted) {
      pasted = await pasteWithPowerShell();
    }
  }

  if (!pasted && platform === 'darwin') {
    // On macOS, try AppleScript
    pasted = await pasteWithAppleScript();
  }

  // Fallback to nut-js if native method failed
  if (!pasted) {
    await loadNutJs();
    if (nutjsAvailable) {
      pasted = await pasteWithNutJs();
    }
  }

  if (!pasted) {
    console.log('All paste methods failed. Text is in clipboard - paste manually with Ctrl+V');
  } else {
    console.log('Text pasted successfully');
  }
}

/**
 * Paste using Windows API directly via koffi (Windows)
 * This is the most reliable method as it doesn't spawn any subprocess
 */
async function pasteWithWindowsAPI(): Promise<boolean> {
  if (!koffiLoaded || !SendInput) {
    return false;
  }

  try {
    console.log('Attempting paste with Windows API (SendInput)...');

    // Create INPUT structures for Ctrl+V keystrokes
    // We need: Ctrl down, V down, V up, Ctrl up
    const inputs = [
      // Ctrl down
      { type: INPUT_KEYBOARD, ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } },
      // V down
      { type: INPUT_KEYBOARD, ki: { wVk: VK_V, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } },
      // V up
      { type: INPUT_KEYBOARD, ki: { wVk: VK_V, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } },
      // Ctrl up
      { type: INPUT_KEYBOARD, ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } },
    ];

    // Send all inputs at once
    const result = SendInput(4, inputs, 40); // 40 = sizeof(INPUT) on x64

    if (result === 4) {
      console.log('Paste with Windows API successful');
      return true;
    } else {
      console.error('SendInput returned:', result);
      return false;
    }
  } catch (error) {
    console.error('Windows API paste failed:', error);
    return false;
  }
}

/**
 * Paste using mshta.exe with inline VBScript (Windows)
 * This is the fastest method as it doesn't require starting a shell
 */
async function pasteWithMshta(): Promise<boolean> {
  try {
    console.log('Attempting paste with mshta (VBScript inline)...');

    // mshta can execute VBScript inline - this is very fast
    // The VBScript creates a WScript.Shell object and sends Ctrl+V
    const vbscript = 'CreateObject("WScript.Shell").SendKeys "^v"';
    const command = `mshta vbscript:Execute("${vbscript}:close")`;

    await execAsync(command, {
      windowsHide: true,
      timeout: 3000,
    });

    console.log('Paste with mshta successful');
    return true;
  } catch (error) {
    console.error('mshta paste failed:', error);
    return false;
  }
}

/**
 * Paste using VBScript via cscript (Windows)
 * Creates a temp VBS file and executes it
 */
async function pasteWithVBScript(): Promise<boolean> {
  const tempFile = path.join(os.tmpdir(), `voicetype_paste_${Date.now()}.vbs`);

  try {
    console.log('Attempting paste with VBScript file...');

    // Create VBScript that sends Ctrl+V
    const vbscript = `
Set WshShell = CreateObject("WScript.Shell")
WScript.Sleep 50
WshShell.SendKeys "^v"
`;

    // Write to temp file
    fs.writeFileSync(tempFile, vbscript, 'utf8');

    // Execute with cscript (console script host, no GUI)
    await execAsync(`cscript //nologo //B "${tempFile}"`, {
      windowsHide: true,
      timeout: 3000,
    });

    console.log('Paste with VBScript successful');
    return true;
  } catch (error) {
    console.error('VBScript paste failed:', error);
    return false;
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Paste using PowerShell with WScript.Shell COM object (Windows)
 * Alternative to System.Windows.Forms.SendKeys
 */
async function pasteWithPowerShellWScript(): Promise<boolean> {
  try {
    console.log('Attempting paste with PowerShell WScript.Shell...');

    // Use WScript.Shell COM object instead of Windows Forms
    const script = `$wsh = New-Object -ComObject WScript.Shell; Start-Sleep -Milliseconds 50; $wsh.SendKeys('^v')`;

    await execAsync(`powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script}"`, {
      windowsHide: true,
      timeout: 5000,
    });

    console.log('Paste with PowerShell WScript.Shell successful');
    return true;
  } catch (error) {
    console.error('PowerShell WScript.Shell paste failed:', error);
    return false;
  }
}

/**
 * Paste using PowerShell with System.Windows.Forms (Windows)
 * Uses .NET SendKeys which is very reliable
 */
async function pasteWithPowerShell(): Promise<boolean> {
  try {
    console.log('Attempting paste with PowerShell SendKeys...');

    // Use PowerShell to send Ctrl+V via Windows Forms SendKeys
    // ^v means Ctrl+V in SendKeys notation
    const script = `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('^v')`;

    await execAsync(`powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script}"`, {
      windowsHide: true,
      timeout: 5000,
    });

    console.log('Paste with PowerShell successful');
    return true;
  } catch (error) {
    console.error('PowerShell paste failed:', error);
    return false;
  }
}

/**
 * Paste using AppleScript (macOS)
 */
async function pasteWithAppleScript(): Promise<boolean> {
  try {
    console.log('Attempting paste with AppleScript...');

    await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);

    console.log('Paste with AppleScript successful');
    return true;
  } catch (error) {
    console.error('AppleScript paste failed:', error);
    return false;
  }
}

/**
 * Paste using nut-js (cross-platform fallback)
 */
async function pasteWithNutJs(): Promise<boolean> {
  if (!nutjsAvailable || !keyboard || !Key) {
    return false;
  }

  try {
    console.log('Attempting paste with nut-js...');

    const isMac = process.platform === 'darwin';
    const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;

    // Press modifier
    await keyboard.pressKey(modifierKey);
    await delay(50);

    // Press V
    await keyboard.pressKey(Key.V);
    await delay(50);

    // Release V
    await keyboard.releaseKey(Key.V);
    await delay(50);

    // Release modifier
    await keyboard.releaseKey(modifierKey);

    console.log('Paste with nut-js successful');
    return true;
  } catch (error) {
    console.error('nut-js paste failed:', error);
    return false;
  }
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if text input simulation is available
 */
export function isTypingAvailable(): boolean {
  return nutjsAvailable || process.platform === 'win32' || process.platform === 'darwin';
}
