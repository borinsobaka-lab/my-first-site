import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { restoreFocusToWindow, sendCtrlV, hasCapturedWindow, clearCapturedWindow } from './windowFocus';

const execAsync = promisify(exec);

type InsertMode = 'type' | 'clipboard';

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
  console.log('Text copied to clipboard for auto-paste, length:', text.length);

  const platform = process.platform;
  let pasted = false;

  if (platform === 'win32') {
    // On Windows, first restore focus to the target window
    if (hasCapturedWindow()) {
      console.log('Restoring focus to captured window...');
      const focusRestored = await restoreFocusToWindow();
      console.log('Focus restored:', focusRestored);
      // Give Windows time to process the focus change
      await delay(200);
    }

    // Method 1: koffi keybd_event (Windows API direct)
    console.log('Trying koffi keybd_event...');
    pasted = await sendCtrlV();

    // Method 2: VBScript via mshta (fast, inline)
    if (!pasted) {
      console.log('Trying mshta VBScript...');
      pasted = await pasteWithMshta();
    }

    // Method 3: VBScript via cscript (temp file)
    if (!pasted) {
      console.log('Trying cscript VBScript...');
      pasted = await pasteWithVBScript();
    }

    // Method 4: PowerShell with WScript.Shell COM
    if (!pasted) {
      console.log('Trying PowerShell WScript.Shell...');
      pasted = await pasteWithPowerShellWScript();
    }

    // Method 5: PowerShell with System.Windows.Forms
    if (!pasted) {
      console.log('Trying PowerShell SendKeys...');
      pasted = await pasteWithPowerShell();
    }

    // Clear captured window after all attempts
    clearCapturedWindow();
  }

  if (!pasted && platform === 'darwin') {
    // On macOS, try AppleScript
    pasted = await pasteWithAppleScript();
  }

  if (!pasted) {
    console.log('All paste methods failed. Text is in clipboard - paste manually with Ctrl+V');
  } else {
    console.log('Text pasted successfully');
  }
}

/**
 * Paste using mshta.exe with inline VBScript (Windows)
 * This is fast as it doesn't require starting a full shell
 */
async function pasteWithMshta(): Promise<boolean> {
  try {
    console.log('Attempting paste with mshta (VBScript inline)...');

    // mshta can execute VBScript inline
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
 * Uses .NET SendKeys
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
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if text input simulation is available
 */
export function isTypingAvailable(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}
