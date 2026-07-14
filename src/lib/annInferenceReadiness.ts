import type { ReductionMethod, ReductionSourceKind, TrainingInputKind } from './annPipeline';

interface AnnInferenceBaseInput {
  essentiaWorkerReady: boolean;
  dataProcessingWorkerReady: boolean;
  druidWorkerReady: boolean;
  mlpWorkerReady: boolean;
  isExtracting: boolean;
  isProcessingData: boolean;
  isReducing: boolean;
  isTraining: boolean;
  isInferring: boolean;
  isModelTrained: boolean;
  hasTrainingPipelineSnapshot: boolean;
  trainingInputKind?: TrainingInputKind | null;
}

export interface AnnDatasetInferReadinessInput extends AnnInferenceBaseInput {
  labelMapSize: number;
  hasRawData: boolean;
  hasProcessedData: boolean;
  hasReducedData: boolean;
}

export interface AnnUploadedInferReadinessInput extends AnnInferenceBaseInput {
  hasInferenceFile: boolean;
  hasAudioContext: boolean;
  hasProcessingStats: boolean;
  hasReductionSnapshot: boolean;
  reductionMethod?: ReductionMethod | null;
  reductionSourceKind?: ReductionSourceKind | null;
}

export interface AnnInferReadiness {
  canInfer: boolean;
  reason: string | null;
}

function getWorkerReason(input: AnnInferenceBaseInput): string | null {
  const missingWorkers = [
    [input.essentiaWorkerReady, 'Essentia'],
    [input.dataProcessingWorkerReady, 'Data Processing'],
    [input.druidWorkerReady, 'Druid'],
    [input.mlpWorkerReady, 'MLP'],
  ]
    .filter(([ready]) => !ready)
    .map(([, name]) => name);

  return missingWorkers.length > 0
    ? `Waiting for workers: ${missingWorkers.join(', ')}.`
    : null;
}

function getBaseReason(input: AnnInferenceBaseInput): string | null {
  if (input.isInferring) return 'Inference is already running.';
  if (input.isTraining) return 'Training is still running.';
  if (input.isExtracting) return 'Feature extraction is still running.';
  if (input.isProcessingData) return 'Data processing is still running.';
  if (input.isReducing) return 'Dimensionality reduction is still running.';

  const workerReason = getWorkerReason(input);
  if (workerReason) return workerReason;

  if (!input.isModelTrained) return 'Train a model before inference.';
  if (!input.hasTrainingPipelineSnapshot || !input.trainingInputKind) {
    return 'Training pipeline snapshot is missing. Retrain first.';
  }

  return null;
}

function hasMatchingDatasetInput(input: AnnDatasetInferReadinessInput): boolean {
  switch (input.trainingInputKind) {
    case 'raw':
      return input.hasRawData;
    case 'processed':
      return input.hasProcessedData;
    case 'reduced':
      return input.hasReducedData;
    default:
      return false;
  }
}

export function getAnnDatasetInferReadiness(input: AnnDatasetInferReadinessInput): AnnInferReadiness {
  const baseReason = getBaseReason(input);
  if (baseReason) return { canInfer: false, reason: baseReason };

  if (input.labelMapSize <= 0) {
    return { canInfer: false, reason: 'Training label map is missing. Retrain first.' };
  }

  if (!hasMatchingDatasetInput(input)) {
    return {
      canInfer: false,
      reason: `Current data no longer matches the trained ${input.trainingInputKind} input. Retrain first.`,
    };
  }

  return { canInfer: true, reason: null };
}

export function getAnnUploadedInferReadiness(input: AnnUploadedInferReadinessInput): AnnInferReadiness {
  const baseReason = getBaseReason(input);
  if (baseReason) return { canInfer: false, reason: baseReason };

  if (!input.hasInferenceFile) {
    return { canInfer: false, reason: 'Choose an audio file for uploaded inference.' };
  }

  if (!input.hasAudioContext) {
    return { canInfer: false, reason: 'AudioContext is not initialized yet.' };
  }

  if (input.trainingInputKind === 'processed' && !input.hasProcessingStats) {
    return { canInfer: false, reason: 'Training processing stats are missing. Retrain first.' };
  }

  if (input.trainingInputKind === 'reduced') {
    if (!input.hasReductionSnapshot || !input.reductionMethod) {
      return { canInfer: false, reason: 'Reduction snapshot is missing. Retrain first.' };
    }
    if (input.reductionMethod !== 'pca') {
      return {
        canInfer: false,
        reason: `${input.reductionMethod.toUpperCase()} cannot place uploaded songs in ANN v1. Train without reduction or use PCA.`,
      };
    }
    if (input.reductionSourceKind !== 'raw' && !input.hasProcessingStats) {
      return { canInfer: false, reason: 'Training processing stats are missing. Retrain first.' };
    }
  }

  return { canInfer: true, reason: null };
}
