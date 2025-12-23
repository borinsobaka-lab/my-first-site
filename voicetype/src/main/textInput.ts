import { clipboard } from 'electron';

type InsertMode = 'type' | 'clipboard';

let nutjsAvailable = false;
let keyboard: any = null;
let Key: any = null;

// Try to load nut-js fork
async function loadNutJs(): Promise<boolean> {
  try {
    const nutjs = await import('@nut-tree-fork/nut-js');
    keyboard = nutjs.keyboard;
    Key = nutjs.Key;

    // Configure nut-js for faster typing
    if (keyboard && keyboard.config) {
      keyboard.config.autoDelayMs = 0;
    }

    nutjsAvailable = true;
    console.log('nut-js loaded successfully');
    return true;
  } catch (error) {
    console.warn('nut-js not available, using clipboard fallback:', error);
    nutjsAvailable = false;
    return false;
  }
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
    await copyToClipboard(text);
  } else {
    // Type mode: copy to clipboard and simulate Ctrl+V paste
    await copyAndPaste(text);
  }
}

/**
 * Simply copy text to clipboard (for clipboard mode)
 */
async function copyToClipboard(text: string): Promise<void> {
  clipboard.writeText(text);
  console.log('Text copied to clipboard:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
}

/**
 * Copy text to clipboard and simulate paste
 * This is more reliable than direct typing on most systems
 */
async function copyAndPaste(text: string): Promise<void> {
  // Copy text to clipboard
  clipboard.writeText(text);
  console.log('Text copied to clipboard for pasting');

  // Give time for the window to regain focus
  await new Promise(resolve => setTimeout(resolve, 200));

  // Try to simulate Ctrl+V if nut-js is available
  if (nutjsAvailable && keyboard && Key) {
    try {
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;

      // Press and release the paste shortcut
      await keyboard.pressKey(modifierKey, Key.V);
      await new Promise(resolve => setTimeout(resolve, 50));
      await keyboard.releaseKey(modifierKey, Key.V);

      console.log('Text pasted via nut-js (Ctrl+V)');
    } catch (error) {
      console.error('Error pasting with nut-js:', error);
      console.log('Text is in clipboard. Please paste manually (Ctrl+V)');
    }
  } else {
    console.log('nut-js not available. Text copied to clipboard - paste manually with Ctrl+V');
  }
}

/**
 * Check if text input simulation is available
 */
export function isTypingAvailable(): boolean {
  return nutjsAvailable;
}
