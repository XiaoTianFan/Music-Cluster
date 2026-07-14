import type { AnnModelComparisonRun } from './annModelComparison';
import type { AnnPermutationImportanceSummary } from './annPermutationImportance';
import type { AnnTrainingSummary } from './annTrainingSummary';

export interface AnnPermutationImportanceExportPayload {
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
  impact: AnnPermutationImportanceSummary;
  comparisonRun: Pick<
    AnnModelComparisonRun,
    | 'id'
    | 'runNumber'
    | 'trainedAt'
    | 'inputKind'
    | 'inputDimension'
    | 'datasetAccuracy'
    | 'datasetCorrectPredictions'
    | 'datasetTotalSongs'
    | 'validationAccuracy'
    | 'reviewStatus'
    | 'note'
  > | null;
}

function createComparisonRunExport(
  run: AnnModelComparisonRun | null | undefined
): AnnPermutationImportanceExportPayload['comparisonRun'] {
  if (!run) return null;

  return {
    id: run.id,
    runNumber: run.runNumber,
    trainedAt: run.trainedAt,
    inputKind: run.inputKind,
    inputDimension: run.inputDimension,
    datasetAccuracy: run.datasetAccuracy,
    datasetCorrectPredictions: run.datasetCorrectPredictions,
    datasetTotalSongs: run.datasetTotalSongs,
    validationAccuracy: run.validationAccuracy,
    reviewStatus: run.reviewStatus,
    note: run.note,
  };
}

function cloneImpactSummary(summary: AnnPermutationImportanceSummary): AnnPermutationImportanceSummary {
  return {
    inputKind: summary.inputKind,
    baselineAccuracy: summary.baselineAccuracy,
    rowCount: summary.rowCount,
    dimensionCount: summary.dimensionCount,
    summary: summary.summary,
    rows: summary.rows.map(row => ({ ...row })),
  };
}

export function createAnnPermutationImportanceExportPayload({
  exportedAt,
  trainingSummary,
  permutationImportanceSummary,
  comparisonRun,
}: {
  exportedAt: string;
  trainingSummary: AnnTrainingSummary;
  permutationImportanceSummary: AnnPermutationImportanceSummary;
  comparisonRun?: AnnModelComparisonRun | null;
}): AnnPermutationImportanceExportPayload {
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
    impact: cloneImpactSummary(permutationImportanceSummary),
    comparisonRun: createComparisonRunExport(comparisonRun),
  };
}

export function createAnnPermutationImportanceExportFilename({
  exportedAt,
  runNumber,
}: {
  exportedAt: string;
  runNumber?: number | null;
}): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  const runPart = runNumber === undefined || runNumber === null ? '' : `-run-${runNumber}`;
  return `musiccluster-ann-feature-impact${runPart}-${safeTimestamp}.json`;
}

export function downloadAnnPermutationImportanceExport({
  payload,
  filename,
}: {
  payload: AnnPermutationImportanceExportPayload;
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
