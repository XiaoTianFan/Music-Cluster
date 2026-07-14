import {
  parseAnnDefaultFeatureCache,
  type AnnDefaultFeatureCache,
} from './annDefaultFeatureCache';

export const ANN_DEFAULT_FEATURE_CACHE_URL = '/default_features.json';

export interface AnnDefaultFeatureCacheResponseLike {
  ok: boolean;
  json(): Promise<unknown>;
}

export type AnnDefaultFeatureCacheFetch = (url: string) => Promise<AnnDefaultFeatureCacheResponseLike>;

export type AnnDefaultFeatureCacheLoadStatus = 'loaded' | 'unavailable' | 'invalid' | 'error';

export type AnnDefaultFeatureCacheLoadResult =
  | { status: 'loaded'; cache: AnnDefaultFeatureCache; songCount: number; reason: null }
  | { status: Exclude<AnnDefaultFeatureCacheLoadStatus, 'loaded'>; cache: null; songCount: 0; reason: string | null };

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadAnnDefaultFeatureCache({
  fetcher,
  url = ANN_DEFAULT_FEATURE_CACHE_URL,
}: {
  fetcher: AnnDefaultFeatureCacheFetch;
  url?: string;
}): Promise<AnnDefaultFeatureCacheLoadResult> {
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      return { status: 'unavailable', cache: null, songCount: 0, reason: null };
    }

    const cache = parseAnnDefaultFeatureCache(await response.json());
    if (!cache) {
      return { status: 'invalid', cache: null, songCount: 0, reason: null };
    }

    return {
      status: 'loaded',
      cache,
      songCount: Object.keys(cache.songData).length,
      reason: null,
    };
  } catch (error) {
    return {
      status: 'error',
      cache: null,
      songCount: 0,
      reason: getErrorReason(error),
    };
  }
}
