import type { TrainingInputKind } from './annPipeline';

export interface AnnTrainingSummaryConfig {
  hiddenLayers: number;
  nodesPerLayer: number[];
  activation: string;
  optimizer: string;
  learningRate: number;
  epochs: number;
  splitRatio: number;
  batchSize: number;
}

export interface AnnTrainingSummaryFinalMetrics {
  loss?: number;
  accuracy?: number;
}

export interface AnnTrainingSummaryLabelCount {
  label: string;
  count: number;
}

export type AnnTrainingSummaryWarningCode =
  | 'small-training-set'
  | 'under-sampled-labels';

export interface AnnTrainingSummaryWarning {
  code: AnnTrainingSummaryWarningCode;
  message: string;
}

export interface AnnTrainingSummary {
  inputKind: TrainingInputKind;
  selectedFeatureIds: string[];
  inputDimension: number;
  labeledSongCount: number;
  classCount: number;
  labelCounts: AnnTrainingSummaryLabelCount[];
  warnings: AnnTrainingSummaryWarning[];
  hiddenLayers: number;
  nodesPerLayer: number[];
  activation: string;
  optimizer: string;
  learningRate: number;
  epochs: number;
  splitRatio: number;
  validationRatio: number;
  batchSize: number;
  seed: number;
  finalLoss?: number;
  finalAccuracy?: number;
}

function getOrderedLabelCounts(labels: string[]): AnnTrainingSummaryLabelCount[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

function getWarnings(labelCounts: AnnTrainingSummaryLabelCount[], labeledSongCount: number): AnnTrainingSummaryWarning[] {
  const warnings: AnnTrainingSummaryWarning[] = [];
  if (labeledSongCount < 12) {
    warnings.push({
      code: 'small-training-set',
      message: `Only ${labeledSongCount} labeled songs are available. Treat accuracy as exploratory until there are at least 12 labeled songs.`,
    });
  }

  const underSampledLabels = labelCounts.filter(row => row.count < 5);
  if (underSampledLabels.length > 0) {
    warnings.push({
      code: 'under-sampled-labels',
      message: `Some labels have fewer than 5 songs: ${underSampledLabels.map(row => `${row.label} (${row.count})`).join(', ')}. Per-label metrics may be unstable.`,
    });
  }

  return warnings;
}

export function getAnnTrainingSummary({
  inputKind,
  selectedFeatureIds,
  inputDimension,
  trainingLabels,
  networkConfig,
  seed,
  finalMetrics,
}: {
  inputKind: TrainingInputKind;
  selectedFeatureIds: Iterable<string>;
  inputDimension: number;
  trainingLabels: string[];
  networkConfig: AnnTrainingSummaryConfig;
  seed: number;
  finalMetrics?: AnnTrainingSummaryFinalMetrics;
}): AnnTrainingSummary {
  const labelCounts = getOrderedLabelCounts(trainingLabels);
  const labeledSongCount = trainingLabels.length;
  return {
    inputKind,
    selectedFeatureIds: Array.from(selectedFeatureIds),
    inputDimension,
    labeledSongCount,
    classCount: labelCounts.length,
    labelCounts,
    warnings: getWarnings(labelCounts, labeledSongCount),
    hiddenLayers: networkConfig.hiddenLayers,
    nodesPerLayer: [...networkConfig.nodesPerLayer],
    activation: networkConfig.activation,
    optimizer: networkConfig.optimizer,
    learningRate: networkConfig.learningRate,
    epochs: networkConfig.epochs,
    splitRatio: networkConfig.splitRatio,
    validationRatio: 1 - networkConfig.splitRatio,
    batchSize: networkConfig.batchSize,
    seed,
    finalLoss: finalMetrics?.loss,
    finalAccuracy: finalMetrics?.accuracy,
  };
}
