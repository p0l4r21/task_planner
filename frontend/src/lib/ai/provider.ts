/**
 * AI Provider abstraction layer.
 *
 * Supports OpenAI-compatible APIs. Keeps provider/model details
 * separate from consuming UI so we can swap providers later.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name: string;
  complete(options: AICompletionOptions): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-5.4', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async complete(options: AICompletionOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_completion_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = `AI API error ${res.status}`;
      try {
        const err = JSON.parse(text);
        message = err?.error?.message || message;
      } catch { /* not JSON */ }
      if (res.status === 429) {
        message = `Rate limited: ${message}. Check your OpenAI billing tier and usage limits at platform.openai.com`;
      } else if (res.status === 404) {
        message = `Model "${this.model}" not found. Try a different model in Settings.`;
      }
      throw new Error(message);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/** Singleton-ish AI configuration. Reads from localStorage. */
let _provider: AIProvider | null = null;

export function getAIConfig(): { apiKey: string; model: string } {
  const apiKey = localStorage.getItem('ai_api_key') || '';
  const model = localStorage.getItem('ai_model') || 'gpt-5.4';
  return { apiKey, model };
}

export function setAIConfig(apiKey: string, model?: string): void {
  localStorage.setItem('ai_api_key', apiKey);
  if (model) localStorage.setItem('ai_model', model);
  _provider = null; // reset so next call picks up new config
}

export function getAIProvider(): AIProvider | null {
  if (_provider) return _provider;
  const { apiKey, model } = getAIConfig();
  if (!apiKey) return null;
  _provider = new OpenAIProvider(apiKey, model);
  return _provider;
}

export function isAIConfigured(): boolean {
  return Boolean(getAIConfig().apiKey);
}
