import type { AnnModelComparisonRun } from './annModelComparison';
import type { AnnTrainingSummary } from './annTrainingSummary';
import type { AnnValidationExecutionSummary, AnnValidationFoldRunResult } from './annValidationExecution';

export interface AnnValidationExportPrediction {
  songId: string;
  expectedLabel: string;
  predictedLabel: string | null;
  confidence: number | null;
  correct: boolean | null;
}

export interface AnnValidationExportFold {
  foldNumber: number;
  trainMetrics?: AnnValidationFoldRunResult['trainMetrics'];
  predictions: AnnValidationExportPrediction[];
}

export interface AnnValidationExportPayload {
  schemaVersion: 1;
  exportedAt: string;
  training: Pick<
    AnnTrainingSummary,
    | 'inputKind'
    | 'selectedFeatureIds'
    | 'inputDimension'
    | 'labeledSongCount'
    | 'classCount'
    | 'labelCounts'
    | 'warnings'
    | 'hiddenLayers'
    | 'nodesPerLayer'
    | 'activation'
    | 'optimizer'
    | 'learningRate'
    | 'epochs'
    | 'splitRatio'
    | 'validationRatio'
    | 'batchSize'
    | 'seed'
    | 'finalLoss'
    | 'finalAccuracy'
  >;
  validation: {
    summary: AnnValidationExecutionSummary;
    folds: AnnValidationExportFold[];
  };
  comparisonRun: Pick<
    AnnModelComparisonRun,
    | 'id'
    | 'runNumber'
    | 'trainedAt'
    | 'datasetAccuracy'
    | 'validationAccuracy'
    | 'validationCorrectPredictions'
    | 'validationTotalPredictions'
    | 'validationFoldCount'
    | 'validationLowConfidenceCount'
  > | null;
}

function createFoldExport(fold: AnnValidationFoldRunResult): AnnValidationExportFold {
  return {
    foldNumber: fold.foldNumber,
    trainMetrics: fold.trainMetrics,
    predictions: Object.entries(fold.expectedLabels).map(([songId, expectedLabel]) => {
      const result = fold.results[songId];
      return {
        songId,
        expectedLabel,
        predictedLabel: result?.predictedLabel ?? null,
        confidence: result?.confidence ?? null,
        correct: result ? result.predictedLabel === expectedLabel : null,
      };
    }),
  };
}

function createComparisonRunExport(
  run: AnnModelComparisonRun | null | undefined
): AnnValidationExportPayload['comparisonRun'] {
  if (!run) return null;
  return {
    id: run.id,
    runNumber: run.runNumber,
    trainedAt: run.trainedAt,
    datasetAccuracy: run.datasetAccuracy,
    validationAccuracy: run.validationAccuracy,
    validationCorrectPredictions: run.validationCorrectPredictions,
    validationTotalPredictions: run.validationTotalPredictions,
    validationFoldCount: run.validationFoldCount,
    validationLowConfidenceCount: run.validationLowConfidenceCount,
  };
}

export function createAnnValidationExportPayload({
  exportedAt,
  trainingSummary,
  validationSummary,
  foldResults,
  comparisonRun,
}: {
  exportedAt: string;
  trainingSummary: AnnTrainingSummary;
  validationSummary: AnnValidationExecutionSummary;
  foldResults: readonly AnnValidationFoldRunResult[];
  comparisonRun?: AnnModelComparisonRun | null;
}): AnnValidationExportPayload {
  return {
    schemaVersion: 1,
    exportedAt,
    training: {
      inputKind: trainingSummary.inputKind,
      selectedFeatureIds: [...trainingSummary.selectedFeatureIds],
      inputDimension: trainingSummary.inputDimension,
      labeledSongCount: trainingSummary.labeledSongCount,
      classCount: trainingSummary.classCount,
      labelCounts: trainingSummary.labelCounts.map(row => ({ ...row })),
      warnings: trainingSummary.warnings.map(warning => ({ ...warning })),
      hiddenLayers: trainingSummary.hiddenLayers,
      nodesPerLayer: [...trainingSummary.nodesPerLayer],
      activation: trainingSummary.activation,
      optimizer: trainingSummary.optimizer,
      learningRate: trainingSummary.learningRate,
      epochs: trainingSummary.epochs,
      splitRatio: trainingSummary.splitRatio,
      validationRatio: trainingSummary.validationRatio,
      batchSize: trainingSummary.batchSize,
      seed: trainingSummary.seed,
      finalLoss: trainingSummary.finalLoss,
      finalAccuracy: trainingSummary.finalAccuracy,
    },
    validation: {
      summary: { ...validationSummary },
      folds: foldResults.map(createFoldExport),
    },
    comparisonRun: createComparisonRunExport(comparisonRun),
  };
}

export function createAnnValidationExportFilename({
  exportedAt,
  runNumber,
}: {
  exportedAt: string;
  runNumber?: number | null;
}): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  const runPart = runNumber === undefined || runNumber === null ? '' : `-run-${runNumber}`;
  return `musiccluster-ann-validation${runPart}-${safeTimestamp}.json`;
}

export function downloadAnnValidationExport({
  payload,
  filename,
}: {
  payload: AnnValidationExportPayload;
  filename: string;
}): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
