import { clipboard } from 'electron';

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
  // Ensure nut-js is loaded before proceeding
  await loadNutJs();

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

  // Wait for the target window to have focus
  // The main window should already be hidden by ipc.ts at this point
  await new Promise(resolve => setTimeout(resolve, 200));

  // Try to simulate Ctrl+V if nut-js is available
  if (nutjsAvailable && keyboard && Key) {
    try {
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;

      console.log('Simulating Ctrl+V paste...');

      // Press modifier key
      await keyboard.pressKey(modifierKey);
      await new Promise(resolve => setTimeout(resolve, 30));

      // Press V
      await keyboard.pressKey(Key.V);
      await new Promise(resolve => setTimeout(resolve, 30));

      // Release V
      await keyboard.releaseKey(Key.V);
      await new Promise(resolve => setTimeout(resolve, 30));

      // Release modifier
      await keyboard.releaseKey(modifierKey);

      console.log('Paste command sent successfully');
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
