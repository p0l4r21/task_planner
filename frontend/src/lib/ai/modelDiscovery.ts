/**
 * Model discovery layer — fetches raw model lists from providers,
 * normalizes them into a common shape, and caches results.
 */

export interface DiscoveredModel {
  id: string;
  provider: string;
  ownedBy?: string;
  discoveredAt: number; // epoch ms
}

export interface DiscoveryProvider {
  name: string;
  fetchModels(apiKey: string): Promise<DiscoveredModel[]>;
}

interface CacheEntry {
  models: DiscoveredModel[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = 'ai_discovered_models';

let _memCache: CacheEntry | null = null;

function readCache(): CacheEntry | null {
  if (_memCache && Date.now() - _memCache.fetchedAt < CACHE_TTL_MS) return _memCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
      _memCache = entry;
      return entry;
    }
  } catch { /* corrupted cache */ }
  return null;
}

function writeCache(models: DiscoveredModel[]): void {
  const entry: CacheEntry = { models, fetchedAt: Date.now() };
  _memCache = entry;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — memory cache still works */ }
}

export function clearModelCache(): void {
  _memCache = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/**
 * Discover models from a provider. Returns cached result if fresh.
 * Set `forceRefresh` to bypass caching.
 */
export async function discoverModels(
  provider: DiscoveryProvider,
  apiKey: string,
  forceRefresh = false,
): Promise<DiscoveredModel[]> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached.models;
  }

  const models = await provider.fetchModels(apiKey);
  writeCache(models);
  return models;
}
