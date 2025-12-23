import { clipboard } from 'electron';

type InsertMode = 'type' | 'clipboard';

let nutjsAvailable = false;
let keyboard: any = null;
let Key: any = null;

// Try to load nut-js
async function loadNutJs(): Promise<boolean> {
  try {
    const nutjs = await import('@nut-tree/nut-js');
    keyboard = nutjs.keyboard;
    Key = nutjs.Key;
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
  } else if (nutjsAvailable && keyboard) {
    // Type mode with nut-js available
    await insertWithTyping(text);
  } else {
    // Fallback: copy and try to paste
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
 * Simulate keyboard typing using nut-js
 */
async function insertWithTyping(text: string): Promise<void> {
  try {
    // Delay to ensure focus is on target application
    await new Promise(resolve => setTimeout(resolve, 150));

    // Type the text
    await keyboard.type(text);
    console.log('Text typed via nut-js');
  } catch (error) {
    console.error('Error typing text with nut-js:', error);
    // Fallback to copy and paste
    await copyAndPaste(text);
  }
}

/**
 * Copy text to clipboard and simulate paste
 */
async function copyAndPaste(text: string): Promise<void> {
  // Copy text to clipboard
  clipboard.writeText(text);

  // Small delay to ensure clipboard is updated
  await new Promise(resolve => setTimeout(resolve, 100));

  // Try to simulate Ctrl+V if nut-js is available
  if (nutjsAvailable && keyboard && Key) {
    try {
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;

      await keyboard.pressKey(modifierKey, Key.V);
      await keyboard.releaseKey(modifierKey, Key.V);
      console.log('Text pasted via nut-js');
    } catch (error) {
      console.error('Error pasting with nut-js:', error);
      console.log('Text is in clipboard. Please paste manually (Ctrl+V)');
    }
  } else {
    console.log('Text copied to clipboard. Please paste manually (Ctrl+V)');
  }
}

/**
 * Check if text input simulation is available
 */
export function isTypingAvailable(): boolean {
  return nutjsAvailable;
}
