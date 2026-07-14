import type { Features, FeatureStatus, Song } from './annPipeline';

export interface AnnFeatureExtractionCompletionInput {
  songs: Array<Pick<Song, 'id'>>;
  featureStatus: Record<string, FeatureStatus>;
  isExtracting: boolean;
}

export interface AnnFeatureExtractionCompletion {
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  hasSuccessfulFeatures: boolean;
}

export interface AnnCurrentFeatureRowsInput {
  songs: Array<Pick<Song, 'id'>>;
  featureStatus: Record<string, FeatureStatus>;
  songFeatures: Record<string, Features | null | undefined>;
}

export interface AnnCurrentFeatureRows {
  songIds: string[];
  count: number;
  totalCount: number;
  hasRows: boolean;
}

const completedStatuses = new Set<FeatureStatus>(['complete', 'error']);

export function getAnnFeatureExtractionCompletion({
  songs,
  featureStatus,
  isExtracting,
}: AnnFeatureExtractionCompletionInput): AnnFeatureExtractionCompletion {
  let completedCount = 0;
  let hasSuccessfulFeatures = false;

  for (const song of songs) {
    const status = featureStatus[song.id];
    if (status === 'complete') {
      hasSuccessfulFeatures = true;
    }
    if (completedStatuses.has(status)) {
      completedCount++;
    }
  }

  const totalCount = songs.length;
  return {
    isComplete: isExtracting && totalCount > 0 && completedCount === totalCount,
    completedCount,
    totalCount,
    hasSuccessfulFeatures,
  };
}

export function getAnnCurrentFeatureRows({
  songs,
  featureStatus,
  songFeatures,
}: AnnCurrentFeatureRowsInput): AnnCurrentFeatureRows {
  const songIds: string[] = [];

  for (const song of songs) {
    if (featureStatus[song.id] === 'complete' && songFeatures[song.id]) {
      songIds.push(song.id);
    }
  }

  return {
    songIds,
    count: songIds.length,
    totalCount: songs.length,
    hasRows: songIds.length > 0,
  };
}
