import { clipboard } from 'electron';

// Note: @nut-tree/nut-js requires native compilation and may need
// additional setup on different platforms. We'll use a dynamic import
// with fallback to clipboard mode.

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
 * @param mode - 'type' to simulate keyboard typing, 'clipboard' to paste
 */
export async function insertText(text: string, mode: InsertMode): Promise<void> {
  if (mode === 'type' && nutjsAvailable && keyboard) {
    await insertWithTyping(text);
  } else {
    await insertWithClipboard(text);
  }
}

/**
 * Simulate keyboard typing using nut-js
 */
async function insertWithTyping(text: string): Promise<void> {
  try {
    // Small delay to ensure focus is on target application
    await new Promise(resolve => setTimeout(resolve, 100));

    // Type the text character by character
    await keyboard.type(text);
  } catch (error) {
    console.error('Error typing text with nut-js:', error);
    // Fallback to clipboard method
    await insertWithClipboard(text);
  }
}

/**
 * Insert text using clipboard and paste simulation
 */
async function insertWithClipboard(text: string): Promise<void> {
  // Save current clipboard content
  const previousClipboard = clipboard.readText();

  try {
    // Write new text to clipboard
    clipboard.writeText(text);

    // Small delay to ensure clipboard is updated
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate Ctrl+V (or Cmd+V on macOS)
    if (nutjsAvailable && keyboard && Key) {
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;

      await keyboard.pressKey(modifierKey, Key.V);
      await keyboard.releaseKey(modifierKey, Key.V);
    } else {
      // If nut-js is not available, just leave text in clipboard
      console.log('Text copied to clipboard. Please paste manually (Ctrl+V / Cmd+V)');
    }
  } finally {
    // Restore previous clipboard content after a delay
    setTimeout(() => {
      if (previousClipboard) {
        clipboard.writeText(previousClipboard);
      }
    }, 500);
  }
}

/**
 * Check if text input simulation is available
 */
export function isTypingAvailable(): boolean {
  return nutjsAvailable;
}
