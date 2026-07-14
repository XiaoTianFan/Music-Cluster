import {
  expandFeatureIds,
  type FeatureDataKey,
  type FeatureStatus,
  type Features,
  type Song,
} from './annPipeline';

export interface AnnDefaultFeatureCache {
  availableDataKeys: Set<FeatureDataKey>;
  songData: Record<string, Features>;
}

export interface AnnDefaultFeatureCachePlan {
  requiredDataKeys: FeatureDataKey[];
  cachedFeaturesBySongId: Record<string, Features>;
  statusBySongId: Record<string, FeatureStatus>;
  songIdsToExtract: string[];
  cacheApplicable: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFeatureDataKey(value: unknown): value is FeatureDataKey {
  return typeof value === 'string';
}

export function parseAnnDefaultFeatureCache(rawData: unknown): AnnDefaultFeatureCache | null {
  if (!isObject(rawData) || !Array.isArray(rawData.availableDataKeys) || !isObject(rawData.songData)) {
    return null;
  }

  const availableDataKeys = rawData.availableDataKeys.filter(isFeatureDataKey);
  const songData: Record<string, Features> = {};
  for (const [songId, features] of Object.entries(rawData.songData)) {
    if (isObject(features)) {
      songData[songId] = features as Features;
    }
  }

  return {
    availableDataKeys: new Set(availableDataKeys),
    songData,
  };
}

function hasRequiredFeatureValue(features: Features, key: FeatureDataKey): boolean {
  return Object.prototype.hasOwnProperty.call(features, key) && features[key] !== undefined;
}

function pickRequiredFeatures(features: Features, requiredDataKeys: FeatureDataKey[]): Features | null {
  const picked: Features = {};
  for (const key of requiredDataKeys) {
    if (!hasRequiredFeatureValue(features, key)) {
      return null;
    }
    picked[key] = features[key];
  }
  return picked;
}

export function getAnnDefaultFeatureCachePlan({
  songs,
  selectedFeatureIds,
  cache,
}: {
  songs: Song[];
  selectedFeatureIds: Iterable<string>;
  cache: AnnDefaultFeatureCache | null;
}): AnnDefaultFeatureCachePlan {
  const requiredDataKeys = expandFeatureIds(selectedFeatureIds);
  const cacheApplicable = Boolean(
    cache
    && requiredDataKeys.length > 0
    && requiredDataKeys.every(key => cache.availableDataKeys.has(key))
  );
  const cachedFeaturesBySongId: Record<string, Features> = {};
  const statusBySongId: Record<string, FeatureStatus> = {};
  const songIdsToExtract: string[] = [];

  for (const song of songs) {
    const cachedFeatures = cacheApplicable && song.source === 'default' && cache
      ? cache.songData[song.id]
      : null;
    const pickedFeatures = cachedFeatures ? pickRequiredFeatures(cachedFeatures, requiredDataKeys) : null;

    if (pickedFeatures) {
      cachedFeaturesBySongId[song.id] = pickedFeatures;
      statusBySongId[song.id] = 'complete';
    } else {
      statusBySongId[song.id] = 'processing';
      songIdsToExtract.push(song.id);
    }
  }

  return {
    requiredDataKeys,
    cachedFeaturesBySongId,
    statusBySongId,
    songIdsToExtract,
    cacheApplicable,
  };
}
