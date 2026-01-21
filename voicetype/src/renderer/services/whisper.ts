import { WhisperOptions, WhisperResponse } from '../../../shared/types';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe audio using OpenAI Whisper API
 * Supports audio files up to 25MB (about 25 minutes at typical quality)
 */
export async function transcribe(
  audioBlob: Blob,
  apiKey: string,
  options?: WhisperOptions
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Audio blob is empty');
  }

  // Log audio info for debugging
  const fileSizeKB = (audioBlob.size / 1024).toFixed(1);
  const fileSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`Transcribing audio: ${fileSizeKB} KB (${fileSizeMB} MB), type: "${audioBlob.type}"`);

  // Check minimum file size (too small = likely corrupt or empty recording)
  // Typical speech is ~100KB+ for 1 second at reasonable quality
  if (audioBlob.size < 1000) {
    throw new Error(`Аудио слишком короткое или повреждено (${fileSizeKB} KB). Попробуйте записать дольше.`);
  }

  // Check file size limit (Whisper API limit is 25MB)
  if (audioBlob.size > 25 * 1024 * 1024) {
    throw new Error('Аудиофайл слишком большой (макс. 25 МБ)');
  }

  // Validate MIME type
  const mimeType = audioBlob.type || 'audio/webm';
  if (!mimeType.startsWith('audio/')) {
    throw new Error(`Неверный формат аудио: ${mimeType}`);
  }

  // Prepare form data
  const formData = new FormData();

  // Convert blob to file with proper extension
  const extension = getExtensionFromMimeType(mimeType);
  const file = new File([audioBlob], `recording.${extension}`, {
    type: mimeType,
  });

  console.log(`Created file: recording.${extension}, size: ${file.size}, type: ${file.type}`);

  formData.append('file', file);
  formData.append('model', 'whisper-1');

  // Add language if specified (not 'auto')
  if (options?.language && options.language !== 'auto') {
    formData.append('language', options.language);
  }

  // Add optional prompt for context
  if (options?.prompt) {
    formData.append('prompt', options.prompt);
  }

  console.log('Sending request to Whisper API...');
  const startTime = Date.now();

  // Make API request (no timeout - long audio may take time to process)
  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Whisper API responded in ${processingTime}s`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.error?.message ||
      `Whisper API error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  const data: WhisperResponse = await response.json();
  console.log(`Transcribed ${data.text.length} characters`);
  return data.text;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
  };

  return mimeToExt[mimeType] || 'webm';
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(apiKey: string): boolean {
  // OpenAI API keys start with 'sk-' and are typically 51 characters
  return apiKey.startsWith('sk-') && apiKey.length > 20;
}

/**
 * Test API key by making a minimal request
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    // Create a minimal test audio (empty but valid webm header would fail, so we just check auth)
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
