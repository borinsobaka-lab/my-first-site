import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

  // Wait for the target window to have focus (window should already be hidden by ipc.ts)
  await delay(200);

  // Try platform-specific paste methods
  const platform = process.platform;
  let pasted = false;

  if (platform === 'win32') {
    // On Windows, try PowerShell method first (most reliable)
    pasted = await pasteWithPowerShell();
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
  }
}

/**
 * Paste using PowerShell (Windows)
 * Uses .NET SendKeys which is very reliable
 */
async function pasteWithPowerShell(): Promise<boolean> {
  try {
    console.log('Attempting paste with PowerShell...');

    // Use PowerShell to send Ctrl+V via Windows Forms SendKeys
    // ^v means Ctrl+V in SendKeys notation
    const script = `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 100; [System.Windows.Forms.SendKeys]::SendWait('^v')`;

    await execAsync(`powershell -NoProfile -NonInteractive -Command "${script}"`, {
      windowsHide: true,
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
