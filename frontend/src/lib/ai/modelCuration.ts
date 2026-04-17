/**
 * Model curation layer — takes raw discovered models and produces
 * categorized, ranked, UI-ready options with recommended buckets.
 */

import type { DiscoveredModel } from './modelDiscovery';

export type ModelBucket = 'default' | 'fast' | 'light' | 'advanced';

export interface CuratedModel {
  id: string;
  provider: string;
  label: string;
  description: string;
  bucket: ModelBucket | null;   // null = compatible but not recommended
  available: boolean;           // discovered from the API
}

/** Human-facing bucket metadata. */
export const BUCKET_META: Record<ModelBucket, { label: string; description: string }> = {
  default:  { label: 'Default',  description: 'Best general-purpose model' },
  fast:     { label: 'Fast',     description: 'Optimized for speed' },
  light:    { label: 'Light',    description: 'Cheapest capable model' },
  advanced: { label: 'Advanced', description: 'Maximum reasoning power' },
};

/**
 * Ranking rules per bucket.
 * Each rule is a list of patterns tried in priority order.
 * The first discovered model matching wins the bucket.
 * Patterns are tested with startsWith on the model id.
 */
const BUCKET_RULES: Record<ModelBucket, string[]> = {
  default:  ['gpt-5', 'gpt-4.1', 'gpt-4o'],
  fast:     ['gpt-4o-mini', 'gpt-4.1-mini', 'o4-mini'],
  light:    ['gpt-4.1-nano', 'gpt-4o-mini'],
  advanced: ['o3-pro', 'o3', 'o1-pro', 'o1'],
};

/** Static fallback list when discovery fails entirely. */
export const FALLBACK_MODELS: CuratedModel[] = [
  { id: 'gpt-5.4',     provider: 'openai', label: 'GPT-5.4',     description: 'Latest general-purpose model',     bucket: 'default',  available: false },
  { id: 'gpt-4o-mini',  provider: 'openai', label: 'GPT-4o Mini', description: 'Optimized for speed',              bucket: 'fast',     available: false },
  { id: 'gpt-4.1-nano', provider: 'openai', label: 'GPT-4.1 Nano',description: 'Cheapest capable model',           bucket: 'light',    available: false },
  { id: 'o3',           provider: 'openai', label: 'o3',          description: 'Maximum reasoning power',           bucket: 'advanced', available: false },
];

/**
 * Build a human-friendly label from a model id.
 * "gpt-4o-mini" → "GPT-4o Mini"
 */
function labelFromId(id: string): string {
  return id
    .replace(/^gpt-/i, 'GPT-')
    .replace(/^o(\d)/, 'o$1')
    .replace(/-mini$/i, ' Mini')
    .replace(/-nano$/i, ' Nano')
    .replace(/-pro$/i, ' Pro');
}

/**
 * Sort discovered models so that higher-versioned models come first.
 * Reverse lexicographic on id works well for OpenAI naming conventions.
 */
function rankModels(models: DiscoveredModel[]): DiscoveredModel[] {
  return [...models].sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * For a given bucket, find the best available model from the discovered list.
 */
function resolveBucket(bucket: ModelBucket, ranked: DiscoveredModel[]): DiscoveredModel | null {
  const patterns = BUCKET_RULES[bucket];
  for (const pattern of patterns) {
    const match = ranked.find(m => m.id.startsWith(pattern));
    if (match) return match;
  }
  return null;
}

/**
 * Short description for a model based on which bucket it fills.
 */
function descriptionForBucket(bucket: ModelBucket): string {
  return BUCKET_META[bucket].description;
}

export interface CurationResult {
  recommended: CuratedModel[];   // one per bucket that was filled
  compatible: CuratedModel[];    // all compatible models (for advanced view)
}

/**
 * Main curation entry point.
 * Takes raw discovered models and produces recommended + full compatible lists.
 */
export function curateModels(discovered: DiscoveredModel[]): CurationResult {
  const ranked = rankModels(discovered);

  // Resolve each bucket
  const bucketAssignments = new Map<string, ModelBucket>();
  const recommended: CuratedModel[] = [];
  const buckets: ModelBucket[] = ['default', 'fast', 'light', 'advanced'];

  for (const bucket of buckets) {
    const winner = resolveBucket(bucket, ranked);
    if (winner && !bucketAssignments.has(winner.id)) {
      bucketAssignments.set(winner.id, bucket);
      recommended.push({
        id: winner.id,
        provider: winner.provider,
        label: labelFromId(winner.id),
        description: descriptionForBucket(bucket),
        bucket,
        available: true,
      });
    }
  }

  // Build full compatible list
  const compatible: CuratedModel[] = ranked.map(m => {
    const bucket = bucketAssignments.get(m.id) ?? null;
    return {
      id: m.id,
      provider: m.provider,
      label: labelFromId(m.id),
      description: bucket ? descriptionForBucket(bucket) : '',
      bucket,
      available: true,
    };
  });

  return { recommended, compatible };
}
