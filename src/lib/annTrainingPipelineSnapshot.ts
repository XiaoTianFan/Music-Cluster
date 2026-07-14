import {
  availableMirFeatures,
  type FeatureId,
  type FeatureMatrix,
  type FeatureMatrixStructure,
  type ProcessingStats,
  type ReductionMethod,
  type TrainingInputKind,
  type TrainingPipelineSnapshot,
} from './annPipeline';

interface AnnTrainingPipelineVectorData {
  vectors: number[][];
  songIds: string[];
}

export interface AnnTrainingPipelineSnapshotInput {
  inputKind: TrainingInputKind;
  selectedFeatureIds: Iterable<string>;
  rawStructure: FeatureMatrixStructure | null;
  rawMatrix: FeatureMatrix | null;
  processingStats: ProcessingStats | null;
  reductionMethod: ReductionMethod;
  reductionDimensions: number;
  processedData: AnnTrainingPipelineVectorData | null;
  labelMap: Record<string, number>;
  songIds: string[];
  inputDimension: number;
}

export type AnnTrainingPipelineSnapshotResult =
  | { snapshot: TrainingPipelineSnapshot; reason: null }
  | { snapshot: null; reason: string };

const validFeatureIds = new Set<FeatureId>(availableMirFeatures.map(feature => feature.id));

function normalizeSelectedFeatureIds(featureIds: Iterable<string>): FeatureId[] {
  const selectedFeatureIds: FeatureId[] = [];
  const seenFeatureIds = new Set<FeatureId>();

  for (const featureId of featureIds) {
    if (!validFeatureIds.has(featureId as FeatureId)) continue;
    const normalizedFeatureId = featureId as FeatureId;
    if (seenFeatureIds.has(normalizedFeatureId)) continue;
    seenFeatureIds.add(normalizedFeatureId);
    selectedFeatureIds.push(normalizedFeatureId);
  }

  return selectedFeatureIds;
}

function cloneVectors(vectors: number[][]): number[][] {
  return vectors.map(vector => [...vector]);
}

function cloneFeatureMatrix(matrix: FeatureMatrix): FeatureMatrix {
  return {
    vectors: cloneVectors(matrix.vectors),
    songIds: [...matrix.songIds],
    isOHEColumn: [...matrix.isOHEColumn],
    columnLabels: [...matrix.columnLabels],
  };
}

function cloneFeatureMatrixStructure(structure: FeatureMatrixStructure): FeatureMatrixStructure {
  return {
    featureKeys: [...structure.featureKeys],
    keyValues: [...structure.keyValues],
    scaleValues: [...structure.scaleValues],
    arrayLengths: { ...structure.arrayLengths },
    columnLabels: [...structure.columnLabels],
    isOHEColumn: [...structure.isOHEColumn],
  };
}

function cloneProcessingStats(stats: ProcessingStats | null): ProcessingStats | null {
  if (!stats) return null;

  const clonedStats: ProcessingStats = {
    method: stats.method,
    isOHEColumn: [...stats.isOHEColumn],
  };
  if (stats.range) clonedStats.range = [...stats.range];
  if (stats.means) clonedStats.means = [...stats.means];
  if (stats.stdDevs) clonedStats.stdDevs = [...stats.stdDevs];
  if (stats.mins) clonedStats.mins = [...stats.mins];
  if (stats.maxs) clonedStats.maxs = [...stats.maxs];
  return clonedStats;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function getVectorDimension(data: AnnTrainingPipelineVectorData): number | null {
  if (data.songIds.length === 0 || data.vectors.length === 0 || data.songIds.length !== data.vectors.length) {
    return null;
  }

  const [firstVector] = data.vectors;
  if (!Array.isArray(firstVector) || firstVector.length === 0 || !firstVector.every(Number.isFinite)) {
    return null;
  }

  const dimension = firstVector.length;
  return data.vectors.every(vector => (
    Array.isArray(vector)
    && vector.length === dimension
    && vector.every(Number.isFinite)
  ))
    ? dimension
    : null;
}

function haveSameSongIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((songId, index) => songId === right[index]);
}

function isValidRawMatrix(matrix: FeatureMatrix, structure: FeatureMatrixStructure): boolean {
  const rawDimension = getVectorDimension(matrix);
  return rawDimension !== null
    && rawDimension === matrix.columnLabels.length
    && matrix.columnLabels.length === matrix.isOHEColumn.length
    && structure.columnLabels.length === structure.isOHEColumn.length
    && matrix.columnLabels.length === structure.columnLabels.length
    && matrix.isOHEColumn.length === structure.isOHEColumn.length;
}

function isValidLabelMap(labelMap: Record<string, number>): boolean {
  const entries = Object.entries(labelMap);
  return entries.length > 0
    && entries.every(([label, index]) => label.trim() !== '' && Number.isInteger(index) && index >= 0);
}

export function createAnnTrainingPipelineSnapshot(
  input: AnnTrainingPipelineSnapshotInput
): AnnTrainingPipelineSnapshotResult {
  const selectedFeatureIds = normalizeSelectedFeatureIds(input.selectedFeatureIds);
  if (selectedFeatureIds.length === 0) {
    return {
      snapshot: null,
      reason: 'Cannot train: No selected feature IDs can be persisted for inference.',
    };
  }

  if (!input.rawMatrix || !input.rawStructure) {
    return {
      snapshot: null,
      reason: 'Cannot train: Raw feature matrix structure is missing. Re-extract features first.',
    };
  }

  if (!isValidRawMatrix(input.rawMatrix, input.rawStructure)) {
    return {
      snapshot: null,
      reason: 'Cannot train: Raw feature matrix is inconsistent. Re-extract features first.',
    };
  }

  if (!isPositiveInteger(input.inputDimension)) {
    return {
      snapshot: null,
      reason: 'Cannot train: Model input dimension must be a positive integer.',
    };
  }

  if (input.songIds.length === 0 || !input.songIds.every(songId => input.rawMatrix?.songIds.includes(songId))) {
    return {
      snapshot: null,
      reason: 'Cannot train: Model input song IDs are missing from the raw feature matrix. Rebuild features first.',
    };
  }

  if (!isValidLabelMap(input.labelMap)) {
    return {
      snapshot: null,
      reason: 'Cannot train: Label map cannot be persisted for inference. Rebuild labels first.',
    };
  }

  const processingStats = cloneProcessingStats(input.processingStats);
  if (input.inputKind === 'processed' && !processingStats) {
    return {
      snapshot: null,
      reason: 'Cannot train: Processed model snapshots require processing stats. Reprocess data first.',
    };
  }

  let reduction: TrainingPipelineSnapshot['reduction'] = null;
  if (input.inputKind === 'reduced') {
    if (!isPositiveInteger(input.reductionDimensions)) {
      return {
        snapshot: null,
        reason: 'Cannot train: Reduction snapshot dimensions must be a positive integer.',
      };
    }

    const reductionSourceKind = input.processedData ? 'processed' : 'raw';
    const trainingVectorSource = input.processedData ?? input.rawMatrix;
    const trainingVectorDimension = getVectorDimension(trainingVectorSource);
    if (
      trainingVectorDimension === null
      || !haveSameSongIds(trainingVectorSource.songIds, input.rawMatrix.songIds)
    ) {
      return {
        snapshot: null,
        reason: 'Cannot train: Reduction training vectors are inconsistent. Reprocess or reduce data first.',
      };
    }

    reduction = {
      method: input.reductionMethod,
      dimensions: input.reductionDimensions,
      sourceKind: reductionSourceKind,
      trainingVectors: cloneVectors(trainingVectorSource.vectors),
      perplexity: 30,
      neighbors: 15,
      minDist: 0.1,
    };
  }

  return {
    snapshot: {
      inputKind: input.inputKind,
      selectedFeatureIds,
      rawStructure: cloneFeatureMatrixStructure(input.rawStructure),
      rawMatrix: cloneFeatureMatrix(input.rawMatrix),
      processingStats,
      reduction,
      labelMap: { ...input.labelMap },
      songIds: [...input.songIds],
      inputDimension: input.inputDimension,
    },
    reason: null,
  };
}
