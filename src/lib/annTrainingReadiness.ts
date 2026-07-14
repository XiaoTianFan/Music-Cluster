export interface AnnTrainReadinessInput {
  essentiaWorkerReady: boolean;
  dataProcessingWorkerReady: boolean;
  druidWorkerReady: boolean;
  mlpWorkerReady: boolean;
  isExtracting: boolean;
  isProcessingData: boolean;
  isReducing: boolean;
  isTraining: boolean;
  isInferring: boolean;
  nonEmptyLabelCount: number;
  assignedSongCount: number;
  labelsHaveEnoughExamples: boolean;
  hasFeatureMatrix: boolean;
}

export interface AnnTrainReadiness {
  canTrain: boolean;
  reason: string | null;
}

export function getAnnTrainReadiness(input: AnnTrainReadinessInput): AnnTrainReadiness {
  if (input.isExtracting) return { canTrain: false, reason: 'Feature extraction is still running.' };
  if (input.isProcessingData) return { canTrain: false, reason: 'Data processing is still running.' };
  if (input.isReducing) return { canTrain: false, reason: 'Dimensionality reduction is still running.' };
  if (input.isTraining) return { canTrain: false, reason: 'Training is already running.' };
  if (input.isInferring) return { canTrain: false, reason: 'Inference is still running.' };

  const missingWorkers = [
    [input.essentiaWorkerReady, 'Essentia'],
    [input.dataProcessingWorkerReady, 'Data Processing'],
    [input.druidWorkerReady, 'Druid'],
    [input.mlpWorkerReady, 'MLP'],
  ]
    .filter(([ready]) => !ready)
    .map(([, name]) => name);

  if (missingWorkers.length > 0) {
    return {
      canTrain: false,
      reason: `Waiting for workers: ${missingWorkers.join(', ')}.`,
    };
  }

  if (input.nonEmptyLabelCount < 2) {
    return { canTrain: false, reason: 'Create at least 2 non-empty labels.' };
  }

  if (input.assignedSongCount < 4) {
    return { canTrain: false, reason: 'Assign at least 4 songs across labels.' };
  }

  if (!input.labelsHaveEnoughExamples) {
    return { canTrain: false, reason: 'Each non-empty label needs at least 2 songs.' };
  }

  if (!input.hasFeatureMatrix) {
    return { canTrain: false, reason: 'Extract features to prepare the training matrix.' };
  }

  return { canTrain: true, reason: null };
}
