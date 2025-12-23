/**
 * Post-processing service for transcribed text
 * Handles automatic punctuation, formatting commands, and grammar correction
 */

// Voice command patterns
const VOICE_COMMANDS: Record<string, string> = {
  // Punctuation
  'точка': '.',
  'запятая': ',',
  'вопросительный знак': '?',
  'восклицательный знак': '!',
  'двоеточие': ':',
  'точка с запятой': ';',
  'тире': ' — ',
  'дефис': '-',
  'открыть скобку': '(',
  'закрыть скобку': ')',
  'кавычки': '"',
  'открыть кавычки': '«',
  'закрыть кавычки': '»',

  // English commands
  'period': '.',
  'comma': ',',
  'question mark': '?',
  'exclamation mark': '!',
  'exclamation point': '!',
  'colon': ':',
  'semicolon': ';',
  'dash': ' — ',
  'hyphen': '-',
  'open parenthesis': '(',
  'close parenthesis': ')',
  'quote': '"',
  'open quote': '"',
  'close quote': '"',

  // Formatting
  'новая строка': '\n',
  'новый абзац': '\n\n',
  'new line': '\n',
  'new paragraph': '\n\n',
  'tab': '\t',
  'таб': '\t',
};

/**
 * Process voice commands in transcribed text
 */
export function processVoiceCommands(text: string): string {
  let result = text;

  // Sort commands by length (longest first) to avoid partial matches
  const sortedCommands = Object.entries(VOICE_COMMANDS).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [command, replacement] of sortedCommands) {
    // Case-insensitive replacement
    const regex = new RegExp(escapeRegExp(command), 'gi');
    result = result.replace(regex, replacement);
  }

  // Clean up extra spaces
  result = result
    .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
    .replace(/\s+\n/g, '\n') // Remove trailing spaces before newlines
    .replace(/\n\s+/g, '\n') // Remove leading spaces after newlines
    .replace(/\s{2,}/g, ' '); // Replace multiple spaces with single space

  return result.trim();
}

/**
 * Capitalize first letter of sentences
 */
export function capitalizeSentences(text: string): string {
  // Split by sentence-ending punctuation
  return text.replace(
    /([.!?]\s+)([a-zа-яё])/g,
    (_, punctuation, letter) => punctuation + letter.toUpperCase()
  );
}

/**
 * Capitalize first letter of the text
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Full post-processing pipeline
 */
export function postProcessText(text: string, options?: PostProcessOptions): string {
  let result = text;

  // Process voice commands
  if (options?.processCommands !== false) {
    result = processVoiceCommands(result);
  }

  // Capitalize sentences
  if (options?.capitalizeSentences !== false) {
    result = capitalizeSentences(result);
    result = capitalizeFirst(result);
  }

  return result;
}

interface PostProcessOptions {
  processCommands?: boolean;
  capitalizeSentences?: boolean;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
