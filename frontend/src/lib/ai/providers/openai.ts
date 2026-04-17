/**
 * OpenAI-specific model discovery provider.
 *
 * Fetches from GET /v1/models, filters to chat-compatible model families,
 * and normalizes into DiscoveredModel shape.
 */

import type { DiscoveredModel, DiscoveryProvider } from '../modelDiscovery';

/**
 * Model family prefixes we consider chat-compatible for this planner.
 * Order doesn't matter here — curation handles ranking.
 */
const COMPATIBLE_PREFIXES = [
  'gpt-5',
  'gpt-4.1',
  'gpt-4o',
  'gpt-4o-mini',
  'o3',
  'o4-mini',
  'o1',
];

export const openAIDiscoveryProvider: DiscoveryProvider = {
  name: 'openai',

  async fetchModels(apiKey: string): Promise<DiscoveredModel[]> {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenAI models API ${res.status}`);
    const data = await res.json();
    const now = Date.now();

    const all: Array<{ id: string; owned_by?: string }> = data.data ?? [];

    return all
      .filter(m => COMPATIBLE_PREFIXES.some(p => m.id.startsWith(p)))
      .map(m => ({
        id: m.id,
        provider: 'openai',
        ownedBy: m.owned_by,
        discoveredAt: now,
      }));
  },
};
