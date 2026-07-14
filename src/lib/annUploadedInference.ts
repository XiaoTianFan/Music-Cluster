import {
  prepareFeatureMatrixWithStructure,
  type FeatureMatrix,
  type Features,
  type LogLevel,
  type TrainingInputKind,
  type TrainingPipelineSnapshot,
} from './annPipeline';

export interface AnnUploadedInferenceSelection {
  inputKind: TrainingInputKind;
  vectors: number[][];
  songIds: string[];
}

export type AnnUploadedInferenceRawMatrixResult =
  | { matrix: FeatureMatrix; reason: null }
  | { matrix: null; reason: string };

export type AnnUploadedInferenceSelectionResult =
  | { selection: AnnUploadedInferenceSelection; reason: null }
  | { selection: null; reason: string };

export interface AnnUploadedInferenceRawMatrixInput {
  songId: string;
  features: Features;
  snapshot: Pick<TrainingPipelineSnapshot, 'rawStructure'>;
  logFn?: (message: string, level: LogLevel) => void;
}

export interface AnnUploadedInferenceInputSelectionInput {
  snapshot: Pick<TrainingPipelineSnapshot, 'inputKind' | 'inputDimension'>;
  rawMatrix: FeatureMatrix;
  processedVectors: number[][] | null;
  reducedVectors: number[][] | null;
}

function getVectorDimension(vectors: number[][], expectedRows: number): number | null {
  if (vectors.length !== expectedRows || vectors.length === 0) return null;

  const [firstVector] = vectors;
  if (!Array.isArray(firstVector) || firstVector.length === 0 || !firstVector.every(Number.isFinite)) {
    return null;
  }

  const dimension = firstVector.length;
  return vectors.every(vector => (
    Array.isArray(vector)
    && vector.length === dimension
    && vector.every(Number.isFinite)
  ))
    ? dimension
    : null;
}

function selectVectors(
  inputKind: TrainingInputKind,
  rawMatrix: FeatureMatrix,
  vectors: number[][] | null,
  expectedInputDimension: number
): AnnUploadedInferenceSelectionResult {
  if (!vectors) {
    return {
      selection: null,
      reason: `Uploaded inference needs ${inputKind} vectors for the trained ${inputKind} model.`,
    };
  }

  const dimension = getVectorDimension(vectors, rawMatrix.songIds.length);
  if (dimension === null) {
    return {
      selection: null,
      reason: `Uploaded ${inputKind} inference data has inconsistent vector dimensions.`,
    };
  }

  if (dimension !== expectedInputDimension) {
    return {
      selection: null,
      reason: `Uploaded ${inputKind} inference data has ${dimension} columns, but the trained model expects ${expectedInputDimension}.`,
    };
  }

  return {
    selection: {
      inputKind,
      songIds: [...rawMatrix.songIds],
      vectors: vectors.map(vector => [...vector]),
    },
    reason: null,
  };
}

export function prepareAnnUploadedInferenceRawMatrix(
  input: AnnUploadedInferenceRawMatrixInput
): AnnUploadedInferenceRawMatrixResult {
  const matrix = prepareFeatureMatrixWithStructure(
    [{ id: input.songId, features: input.features }],
    input.snapshot.rawStructure,
    input.logFn
  );

  return matrix
    ? { matrix, reason: null }
    : { matrix: null, reason: 'Uploaded audio did not produce the trained feature structure.' };
}

export function selectAnnUploadedInferenceInput(
  input: AnnUploadedInferenceInputSelectionInput
): AnnUploadedInferenceSelectionResult {
  switch (input.snapshot.inputKind) {
    case 'raw':
      return selectVectors('raw', input.rawMatrix, input.rawMatrix.vectors, input.snapshot.inputDimension);
    case 'processed':
      return selectVectors('processed', input.rawMatrix, input.processedVectors, input.snapshot.inputDimension);
    case 'reduced':
      return selectVectors('reduced', input.rawMatrix, input.reducedVectors, input.snapshot.inputDimension);
  }
}
