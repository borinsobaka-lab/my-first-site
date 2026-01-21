/**
 * GPT API Service for AI text generation
 */

const GPT_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `Ты помощник. Пользователь диктует инструкцию голосом. Выполни её и верни только готовый текст для вставки, без пояснений, преамбул и комментариев.`;

export interface GPTOptions {
  model?: 'gpt-4o-mini' | 'gpt-4o';
  temperature?: number;
}

export interface GPTResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate text using OpenAI GPT API
 * @param instruction - The transcribed instruction from user
 * @param apiKey - OpenAI API key for GPT
 * @param options - Model and temperature settings
 * @returns Generated text
 */
export async function generateText(
  instruction: string,
  apiKey: string,
  options?: GPTOptions
): Promise<string> {
  if (!apiKey) {
    throw new Error('Укажите API ключ для генерации в настройках');
  }

  if (!instruction || instruction.trim().length === 0) {
    throw new Error('Инструкция пуста');
  }

  const model = options?.model || 'gpt-4o-mini';
  const temperature = options?.temperature ?? 0.7;

  console.log(`Generating text with ${model}, instruction: "${instruction.substring(0, 50)}..."`);
  const startTime = Date.now();

  const response = await fetch(GPT_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: instruction,
        },
      ],
      temperature,
    }),
  });

  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`GPT API responded in ${processingTime}s`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.error?.message ||
      `GPT API error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  const data: GPTResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('GPT API вернул пустой ответ');
  }

  const generatedText = data.choices[0].message.content;
  console.log(`Generated ${generatedText.length} characters, tokens used: ${data.usage.total_tokens}`);

  return generatedText;
}

/**
 * Validate GPT API key format (basic check)
 */
export function validateGptApiKey(apiKey: string): boolean {
  // OpenAI API keys start with 'sk-' and are typically 51 characters
  return apiKey.startsWith('sk-') && apiKey.length > 20;
}

/**
 * Test GPT API key by making a minimal request
 */
export async function testGptApiKey(apiKey: string): Promise<boolean> {
  try {
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
