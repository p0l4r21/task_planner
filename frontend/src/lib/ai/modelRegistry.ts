/**
 * Model registry — single facade over discovery + curation.
 *
 * UI components call `getModelRegistry()` to get the curated result.
 * Handles caching, fallback, and validation in one place.
 */

import { discoverModels, clearModelCache } from './modelDiscovery';
import { curateModels, FALLBACK_MODELS, type CuratedModel, type CurationResult } from './modelCuration';
import { openAIDiscoveryProvider } from './providers/openai';
import { getAIConfig } from './provider';

let _lastResult: CurationResult | null = null;

/**
 * Load the model registry. Uses cached discovery; set forceRefresh to re-fetch.
 * Falls back to a static list if no API key or if discovery fails.
 */
export async function getModelRegistry(forceRefresh = false): Promise<CurationResult> {
  const { apiKey } = getAIConfig();
  if (!apiKey) {
    return { recommended: FALLBACK_MODELS, compatible: FALLBACK_MODELS };
  }

  try {
    const discovered = await discoverModels(openAIDiscoveryProvider, apiKey, forceRefresh);
    if (discovered.length === 0) {
      return { recommended: FALLBACK_MODELS, compatible: FALLBACK_MODELS };
    }
    _lastResult = curateModels(discovered);
    return _lastResult;
  } catch {
    // Discovery failed — return last good result or fallback
    if (_lastResult) return _lastResult;
    return { recommended: FALLBACK_MODELS, compatible: FALLBACK_MODELS };
  }
}

/**
 * Force a fresh discovery and return updated registry.
 */
export async function refreshModelRegistry(): Promise<CurationResult> {
  clearModelCache();
  return getModelRegistry(true);
}

/**
 * Validate whether a model id is in the compatible set.
 * Returns true if found, or if we have no registry data (be permissive).
 */
export function isModelValid(modelId: string): boolean {
  if (!_lastResult) return true; // no data yet — allow anything
  return _lastResult.compatible.some(m => m.id === modelId);
}

/**
 * Get a curated model by id for display purposes.
 */
export function getModelInfo(modelId: string): CuratedModel | null {
  if (!_lastResult) return null;
  return _lastResult.compatible.find(m => m.id === modelId) ?? null;
}
