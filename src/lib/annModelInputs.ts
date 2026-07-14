import type {
  FeatureMatrix,
  TrainingInputKind,
  TrainingPipelineSnapshot,
} from './annPipeline';
import { getLabelCounts } from './mlpTraining';

export interface AnnVectorDataSource {
  vectors: number[][];
  songIds: string[];
}

export interface AnnModelInputSelection extends AnnVectorDataSource {
  inputKind: TrainingInputKind;
  inputDimension: number;
  logMessage: string;
}

export type AnnModelInputSelectionResult =
  | { selection: AnnModelInputSelection; reason: null }
  | { selection: null; reason: string };

export interface AnnTrainingDataset {
  trainingVectors: number[][];
  trainingLabels: string[];
  trainingSongIds: string[];
  labelMap: Map<string, number>;
  labelMapObject: Record<string, number>;
  labelCounts: Record<string, number>;
  activationSampleSongId?: string;
}

export type AnnTrainingDatasetResult =
  | { dataset: AnnTrainingDataset; reason: null }
  | { dataset: null; reason: string };

interface AnnAvailableModelInputs {
  reducedDataPoints: Record<string, number[]>;
  processedData: AnnVectorDataSource | null;
  unprocessedData: FeatureMatrix | null;
}

export interface AnnTrainingInputSelectionInput extends AnnAvailableModelInputs {
  useDimensionalityReduction: boolean;
}

export interface AnnDatasetInferenceInputSelectionInput extends AnnAvailableModelInputs {
  snapshot: Pick<TrainingPipelineSnapshot, 'inputKind' | 'inputDimension'>;
}

export interface AnnTrainingDatasetInput {
  source: AnnModelInputSelection;
  namedLists: Record<string, Set<string>>;
}

const trainingLogMessages: Record<TrainingInputKind, string> = {
  raw: 'Using raw/unprocessed data for training.',
  processed: 'Using processed data for training.',
  reduced: 'Using reduced data for training.',
};

const inferenceLogMessages: Record<TrainingInputKind, string> = {
  raw: 'Using raw/unprocessed data for inference.',
  processed: 'Using processed data for inference.',
  reduced: 'Using reduced data for inference.',
};

function getVectorDataFromRecord(reducedDataPoints: Record<string, number[]>): AnnVectorDataSource | null {
  const entries = Object.entries(reducedDataPoints);
  if (entries.length === 0) return null;

  return {
    songIds: entries.map(([songId]) => songId),
    vectors: entries.map(([, vector]) => vector),
  };
}

function getVectorDimension(source: AnnVectorDataSource): number | null {
  if (source.songIds.length === 0 || source.vectors.length === 0 || source.songIds.length !== source.vectors.length) {
    return null;
  }

  const [firstVector] = source.vectors;
  if (!Array.isArray(firstVector) || firstVector.length === 0 || !firstVector.every(Number.isFinite)) {
    return null;
  }

  const dimension = firstVector.length;
  const hasConsistentFiniteVectors = source.vectors.every(vector => (
    Array.isArray(vector)
    && vector.length === dimension
    && vector.every(Number.isFinite)
  ));

  return hasConsistentFiniteVectors ? dimension : null;
}

function getDataSource(
  inputKind: TrainingInputKind,
  input: AnnAvailableModelInputs
): AnnVectorDataSource | null {
  switch (inputKind) {
    case 'reduced':
      return getVectorDataFromRecord(input.reducedDataPoints);
    case 'processed':
      return input.processedData;
    case 'raw':
      return input.unprocessedData;
  }
}

function createSelection(
  inputKind: TrainingInputKind,
  source: AnnVectorDataSource,
  logMessage: string
): AnnModelInputSelectionResult {
  const inputDimension = getVectorDimension(source);
  if (inputDimension === null) {
    const displayKind = inputKind === 'raw' ? 'Raw/unprocessed' : `${inputKind[0].toUpperCase()}${inputKind.slice(1)}`;
    return {
      selection: null,
      reason: `Cannot train: ${displayKind} data has inconsistent vector dimensions. Rebuild features first.`,
    };
  }

  return {
    selection: {
      inputKind,
      inputDimension,
      songIds: [...source.songIds],
      vectors: source.vectors.map(vector => [...vector]),
      logMessage,
    },
    reason: null,
  };
}

export function selectAnnTrainingInput(input: AnnTrainingInputSelectionInput): AnnModelInputSelectionResult {
  const inputKind: TrainingInputKind | null = input.useDimensionalityReduction && getDataSource('reduced', input)
    ? 'reduced'
    : input.processedData
      ? 'processed'
      : input.unprocessedData
        ? 'raw'
        : null;

  if (!inputKind) {
    return {
      selection: null,
      reason: 'Cannot train: No suitable data available (unprocessed, processed, or reduced).',
    };
  }

  const source = getDataSource(inputKind, input);
  if (!source) {
    return {
      selection: null,
      reason: 'Cannot train: No suitable data available (unprocessed, processed, or reduced).',
    };
  }

  return createSelection(inputKind, source, trainingLogMessages[inputKind]);
}

export function selectAnnDatasetInferenceInput(
  input: AnnDatasetInferenceInputSelectionInput
): AnnModelInputSelectionResult {
  const source = getDataSource(input.snapshot.inputKind, input);
  if (!source) {
    return {
      selection: null,
      reason: 'Cannot infer: Current data no longer matches the trained model input. Retrain first.',
    };
  }

  const inputDimension = getVectorDimension(source);
  if (inputDimension === null) {
    return {
      selection: null,
      reason: 'Cannot infer: Current data has inconsistent vector dimensions. Retrain first.',
    };
  }

  if (inputDimension !== input.snapshot.inputDimension) {
    return {
      selection: null,
      reason: `Cannot infer: Current ${input.snapshot.inputKind} data has ${inputDimension} columns, but the trained model expects ${input.snapshot.inputDimension}. Retrain first.`,
    };
  }

  return {
    selection: {
      inputKind: input.snapshot.inputKind,
      inputDimension,
      songIds: [...source.songIds],
      vectors: source.vectors.map(vector => [...vector]),
      logMessage: inferenceLogMessages[input.snapshot.inputKind],
    },
    reason: null,
  };
}

export function createAnnTrainingDataset(input: AnnTrainingDatasetInput): AnnTrainingDatasetResult {
  const trainingVectors: number[][] = [];
  const trainingLabels: string[] = [];
  const trainingSongIds: string[] = [];
  const labelMap = new Map<string, number>();
  let nextLabelIndex = 0;

  const sourceIndexBySongId = new Map(input.source.songIds.map((songId, index) => [songId, index]));

  Object.entries(input.namedLists).forEach(([labelName, songIdSet]) => {
    if (songIdSet.size === 0) return;
    if (!labelMap.has(labelName)) {
      labelMap.set(labelName, nextLabelIndex++);
    }

    songIdSet.forEach(songId => {
      const dataIndex = sourceIndexBySongId.get(songId);
      if (dataIndex === undefined) return;

      trainingVectors.push([...input.source.vectors[dataIndex]]);
      trainingLabels.push(labelName);
      trainingSongIds.push(songId);
    });
  });

  if (trainingVectors.length < 2 || labelMap.size < 2) {
    return {
      dataset: null,
      reason: `Cannot train: Not enough labeled data for training (${trainingVectors.length} songs, ${labelMap.size} non-empty labels). Need at least 2 labels.`,
    };
  }

  const labelCounts = getLabelCounts(trainingLabels);
  const labelsWithTooFewSamples = Array.from(labelMap.keys())
    .filter(label => (labelCounts[label] ?? 0) < 2);
  if (labelsWithTooFewSamples.length > 0) {
    return {
      dataset: null,
      reason: `Cannot train: Each label needs at least 2 songs for a train/validation split. Add more songs to: ${labelsWithTooFewSamples.join(', ')}.`,
    };
  }

  return {
    dataset: {
      trainingVectors,
      trainingLabels,
      trainingSongIds,
      labelMap,
      labelMapObject: Object.fromEntries(labelMap),
      labelCounts,
      activationSampleSongId: trainingSongIds[0],
    },
    reason: null,
  };
}
