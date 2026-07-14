import type { AnnTrainingDataset } from './annModelInputs';
import type { AnnValidationPlan } from './annValidationPlan';
import type { InferPayload, TrainPayload } from './mlpWorkerContract';

export interface AnnValidationExecutionNetworkConfig {
  config: TrainPayload['config'];
  trainIterations: number;
  batchSize: number;
  splitRatio: number;
  seed?: number;
}

export interface AnnValidationFoldExecution {
  foldNumber: number;
  trainPayload: TrainPayload;
  inferPayload: InferPayload;
  expectedLabels: Record<string, string>;
}

export interface AnnValidationExecutionPlan {
  strategy: AnnValidationPlan['strategy'];
  foldCount: number;
  totalValidationSongCount: number;
  folds: AnnValidationFoldExecution[];
}

export type AnnValidationExecutionPlanResult =
  | { executionPlan: AnnValidationExecutionPlan; reason: null }
  | { executionPlan: null; reason: string };

export interface AnnValidationFoldPredictionResult {
  foldNumber: number;
  expectedLabels: Record<string, string>;
  results: Record<string, { predictedLabel: string; confidence?: number }>;
}

export interface AnnValidationFoldTrainingResult {
  finalMetrics?: {
    loss?: number;
    accuracy?: number;
  };
}

export interface AnnValidationFoldRunResult extends AnnValidationFoldPredictionResult {
  trainMetrics?: AnnValidationFoldTrainingResult['finalMetrics'];
}

export interface AnnValidationExecutionSummary {
  foldCount: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number | null;
  missingPredictionCount: number;
  confidenceCount: number;
  averageConfidence: number | null;
  lowConfidenceThreshold: number;
  lowConfidenceCount: number;
}

export interface AnnValidationExecutionRunResult {
  foldResults: AnnValidationFoldRunResult[];
  summary: AnnValidationExecutionSummary;
}

const defaultLowConfidenceThreshold = 0.7;

function getDatasetIndex(trainingDataset: AnnTrainingDataset): Map<string, { vector: number[]; label: string }> {
  const index = new Map<string, { vector: number[]; label: string }>();
  trainingDataset.trainingSongIds.forEach((songId, rowIndex) => {
    const vector = trainingDataset.trainingVectors[rowIndex];
    const label = trainingDataset.trainingLabels[rowIndex];
    if (vector && label) index.set(songId, { vector, label });
  });
  return index;
}

function getRows(
  songIds: readonly string[],
  datasetIndex: Map<string, { vector: number[]; label: string }>,
): { rows: Array<{ songId: string; vector: number[]; label: string }>; missingSongId: string | null } {
  const rows: Array<{ songId: string; vector: number[]; label: string }> = [];
  for (const songId of songIds) {
    const row = datasetIndex.get(songId);
    if (!row) return { rows, missingSongId: songId };
    rows.push({ songId, vector: [...row.vector], label: row.label });
  }
  return { rows, missingSongId: null };
}

function getFoldSeed(seed: number | undefined, foldIndex: number): number | undefined {
  return seed === undefined ? undefined : seed + foldIndex;
}

export function createAnnValidationExecutionPlan({
  validationPlan,
  trainingDataset,
  networkConfig,
}: {
  validationPlan: AnnValidationPlan;
  trainingDataset: AnnTrainingDataset;
  networkConfig: AnnValidationExecutionNetworkConfig;
}): AnnValidationExecutionPlanResult {
  const datasetIndex = getDatasetIndex(trainingDataset);
  const folds: AnnValidationFoldExecution[] = [];

  for (let foldIndex = 0; foldIndex < validationPlan.folds.length; foldIndex++) {
    const fold = validationPlan.folds[foldIndex];
    const trainingRows = getRows(fold.trainingSongIds, datasetIndex);
    if (trainingRows.missingSongId) {
      return { executionPlan: null, reason: `Validation fold ${fold.foldNumber} references missing training song: ${trainingRows.missingSongId}.` };
    }

    const validationRows = getRows(fold.validationSongIds, datasetIndex);
    if (validationRows.missingSongId) {
      return { executionPlan: null, reason: `Validation fold ${fold.foldNumber} references missing validation song: ${validationRows.missingSongId}.` };
    }

    if (trainingRows.rows.length === 0 || validationRows.rows.length === 0) {
      return { executionPlan: null, reason: `Validation fold ${fold.foldNumber} needs both training and validation rows.` };
    }

    const expectedLabels = Object.fromEntries(validationRows.rows.map(row => [row.songId, row.label]));
    folds.push({
      foldNumber: fold.foldNumber,
      trainPayload: {
        vectors: trainingRows.rows.map(row => row.vector),
        labels: trainingRows.rows.map(row => row.label),
        validationVectors: validationRows.rows.map(row => row.vector),
        validationLabels: validationRows.rows.map(row => row.label),
        config: networkConfig.config,
        labelMap: { ...trainingDataset.labelMapObject },
        trainIterations: networkConfig.trainIterations,
        batchSize: networkConfig.batchSize,
        splitRatio: networkConfig.splitRatio,
        seed: getFoldSeed(networkConfig.seed, foldIndex),
        activationSampleSongId: trainingRows.rows[0]?.songId,
      },
      inferPayload: {
        vectors: validationRows.rows.map(row => row.vector),
        songIds: validationRows.rows.map(row => row.songId),
        labelMap: { ...trainingDataset.labelMapObject },
      },
      expectedLabels,
    });
  }

  return {
    executionPlan: {
      strategy: validationPlan.strategy,
      foldCount: folds.length,
      totalValidationSongCount: folds.reduce((sum, fold) => sum + fold.inferPayload.songIds.length, 0),
      folds,
    },
    reason: null,
  };
}

export function getAnnValidationExecutionSummary({
  folds,
  lowConfidenceThreshold = defaultLowConfidenceThreshold,
}: {
  folds: readonly AnnValidationFoldPredictionResult[];
  lowConfidenceThreshold?: number;
}): AnnValidationExecutionSummary {
  let totalPredictions = 0;
  let correctPredictions = 0;
  let missingPredictionCount = 0;
  let confidenceCount = 0;
  let confidenceTotal = 0;
  let lowConfidenceCount = 0;

  for (const fold of folds) {
    for (const [songId, expectedLabel] of Object.entries(fold.expectedLabels)) {
      totalPredictions++;
      const result = fold.results[songId];
      if (!result) {
        missingPredictionCount++;
        continue;
      }

      if (result.predictedLabel === expectedLabel) correctPredictions++;
      if (typeof result.confidence === 'number' && Number.isFinite(result.confidence)) {
        confidenceCount++;
        confidenceTotal += result.confidence;
        if (result.confidence < lowConfidenceThreshold) lowConfidenceCount++;
      }
    }
  }

  return {
    foldCount: folds.length,
    totalPredictions,
    correctPredictions,
    accuracy: totalPredictions > 0 ? correctPredictions / totalPredictions : null,
    missingPredictionCount,
    confidenceCount,
    averageConfidence: confidenceCount > 0 ? confidenceTotal / confidenceCount : null,
    lowConfidenceThreshold,
    lowConfidenceCount,
  };
}

export async function runAnnValidationExecutionPlan({
  executionPlan,
  trainFold,
  inferFold,
  onFoldStart,
  onFoldComplete,
}: {
  executionPlan: AnnValidationExecutionPlan;
  trainFold: (fold: AnnValidationFoldExecution) => Promise<AnnValidationFoldTrainingResult | void>;
  inferFold: (fold: AnnValidationFoldExecution) => Promise<Record<string, { predictedLabel: string; confidence?: number }>>;
  onFoldStart?: (fold: AnnValidationFoldExecution) => void;
  onFoldComplete?: (foldResult: AnnValidationFoldRunResult) => void;
}): Promise<AnnValidationExecutionRunResult> {
  const foldResults: AnnValidationFoldRunResult[] = [];

  for (const fold of executionPlan.folds) {
    try {
      onFoldStart?.(fold);
      const trainResult = await trainFold(fold);
      const results = await inferFold(fold);
      const foldResult: AnnValidationFoldRunResult = {
        foldNumber: fold.foldNumber,
        expectedLabels: fold.expectedLabels,
        results,
        trainMetrics: trainResult?.finalMetrics,
      };
      foldResults.push(foldResult);
      onFoldComplete?.(foldResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Validation fold ${fold.foldNumber} failed: ${message}`);
    }
  }

  return {
    foldResults,
    summary: getAnnValidationExecutionSummary({ folds: foldResults }),
  };
}
