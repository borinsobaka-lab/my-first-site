/**
 * Text Input Module
 * Handles inserting transcribed text into the active window
 */

import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  restoreFocusToWindow,
  sendCtrlV,
  hasCapturedWindow,
  clearCapturedWindow,
  getCapturedWindowInfo
} from './windowFocus';

const execAsync = promisify(exec);

type InsertMode = 'type' | 'clipboard';

/**
 * Insert text into the currently active text field
 */
export async function insertText(text: string, mode: InsertMode): Promise<void> {
  console.log('=== insertText called ===');
  console.log('Text length:', text.length);
  console.log('Mode:', mode);
  console.log('Text preview:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  if (mode === 'clipboard') {
    // Clipboard mode: just copy text, user pastes manually
    clipboard.writeText(text);
    console.log('Text copied to clipboard (clipboard mode)');
    return;
  }

  // Type mode: copy to clipboard and simulate paste
  await autoPaste(text);
}

/**
 * Main auto-paste function
 * Copies text to clipboard, restores focus, and sends Ctrl+V
 */
async function autoPaste(text: string): Promise<void> {
  console.log('=== autoPaste started ===');
  console.log('Captured window:', getCapturedWindowInfo());

  // Step 1: Copy text to clipboard FIRST
  clipboard.writeText(text);
  console.log('Step 1: Text copied to clipboard');

  // Step 2: Small delay to ensure clipboard is ready
  await delay(50);

  // Step 3: Restore focus to the original window
  console.log('Step 2: Restoring focus to original window...');
  if (hasCapturedWindow()) {
    const focusRestored = await restoreFocusToWindow();
    console.log('Focus restore result:', focusRestored);
  } else {
    console.log('No captured window - will paste to current foreground window');
  }

  // Step 4: Wait for Windows to process focus change
  await delay(150);

  // Step 5: Try to paste using multiple methods
  console.log('Step 3: Attempting to paste...');
  let pasted = false;

  // Method 1: koffi keybd_event (fastest, no subprocess)
  if (!pasted) {
    console.log('Trying method 1: koffi keybd_event');
    pasted = await sendCtrlV();
    if (pasted) console.log('SUCCESS: Pasted via koffi');
  }

  // Method 2: PowerShell SendKeys (most compatible)
  if (!pasted) {
    console.log('Trying method 2: PowerShell SendKeys');
    pasted = await pasteWithPowerShell();
    if (pasted) console.log('SUCCESS: Pasted via PowerShell');
  }

  // Method 3: VBScript inline via mshta
  if (!pasted) {
    console.log('Trying method 3: mshta VBScript');
    pasted = await pasteWithMshta();
    if (pasted) console.log('SUCCESS: Pasted via mshta');
  }

  // Method 4: VBScript file via cscript
  if (!pasted) {
    console.log('Trying method 4: cscript VBScript');
    pasted = await pasteWithCscript();
    if (pasted) console.log('SUCCESS: Pasted via cscript');
  }

  // Clear captured window
  clearCapturedWindow();

  if (pasted) {
    console.log('=== autoPaste completed successfully ===');
  } else {
    console.log('=== autoPaste FAILED - text is in clipboard, paste manually with Ctrl+V ===');
  }
}

/**
 * Paste using PowerShell with multiple approaches
 */
async function pasteWithPowerShell(): Promise<boolean> {
  try {
    // Use System.Windows.Forms.SendKeys
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Start-Sleep -Milliseconds 100
      [System.Windows.Forms.SendKeys]::SendWait('^v')
    `.replace(/\n/g, '; ');

    await execAsync(
      `powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${script}"`,
      { windowsHide: true, timeout: 5000 }
    );
    return true;
  } catch (error) {
    console.error('PowerShell paste failed:', error);

    // Try alternative PowerShell approach with WScript.Shell
    try {
      const altScript = `$wsh = New-Object -ComObject WScript.Shell; Start-Sleep -Milliseconds 100; $wsh.SendKeys('^v')`;
      await execAsync(
        `powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${altScript}"`,
        { windowsHide: true, timeout: 5000 }
      );
      return true;
    } catch (altError) {
      console.error('Alternative PowerShell paste also failed:', altError);
      return false;
    }
  }
}

/**
 * Paste using mshta with inline VBScript
 */
async function pasteWithMshta(): Promise<boolean> {
  try {
    const command = `mshta vbscript:Execute("CreateObject(""WScript.Shell"").SendKeys ""^v"":close")`;
    await execAsync(command, { windowsHide: true, timeout: 3000 });
    return true;
  } catch (error) {
    console.error('mshta paste failed:', error);
    return false;
  }
}

/**
 * Paste using cscript with VBS file
 */
async function pasteWithCscript(): Promise<boolean> {
  const tempFile = path.join(os.tmpdir(), `voicetype_paste_${Date.now()}.vbs`);

  try {
    const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
WScript.Sleep 100
WshShell.SendKeys "^v"
`.trim();

    fs.writeFileSync(tempFile, vbsContent, 'utf8');
    await execAsync(`cscript //nologo //B "${tempFile}"`, { windowsHide: true, timeout: 3000 });
    return true;
  } catch (error) {
    console.error('cscript paste failed:', error);
    return false;
  } finally {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if typing is available on this platform
 */
export function isTypingAvailable(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}
