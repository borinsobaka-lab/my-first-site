import { WhisperOptions, WhisperResponse } from '../../../shared/types';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Transcribe audio using OpenAI Whisper API
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

  // Prepare form data
  const formData = new FormData();

  // Convert blob to file with proper extension
  const extension = getExtensionFromMimeType(audioBlob.type);
  const file = new File([audioBlob], `recording.${extension}`, {
    type: audioBlob.type,
  });

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

  // Make API request
  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.error?.message ||
      `Whisper API error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  const data: WhisperResponse = await response.json();
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
