export type AnnNamedLists = Record<string, ReadonlySet<string>>;

export interface AnnEvaluationInferenceResult {
  predictedLabel: string;
  confidence?: number;
}

export interface AnnEvaluationRow {
  label: string;
  support: number;
  predictedCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface AnnEvaluationSummary {
  actualLabels: string[];
  predictedLabels: string[];
  confusionMatrix: number[][];
  rows: AnnEvaluationRow[];
  totalSongs: number;
  predictedSongCount: number;
  correctPredictions: number;
  accuracy: number;
  majorityBaselineLabel: string | null;
  majorityBaselineAccuracy: number;
  missingPredictionCount: number;
  unknownPredictionCount: number;
  confidenceCount: number;
  averageConfidence: number | null;
  minConfidence: number | null;
  lowConfidenceThreshold: number;
  lowConfidenceCount: number;
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;

function divideOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function getF1(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null || precision + recall === 0) return null;
  return (2 * precision * recall) / (precision + recall);
}

function buildActualLabelMap(namedLists: AnnNamedLists): {
  actualLabels: string[];
  actualLabelBySongId: Map<string, string>;
  supportByLabel: Map<string, number>;
} {
  const actualLabels: string[] = [];
  const actualLabelBySongId = new Map<string, string>();
  const supportByLabel = new Map<string, number>();

  for (const [label, songIds] of Object.entries(namedLists)) {
    if (songIds.size === 0) continue;
    actualLabels.push(label);
    let support = 0;
    for (const songId of songIds) {
      if (actualLabelBySongId.has(songId)) continue;
      actualLabelBySongId.set(songId, label);
      support++;
    }
    supportByLabel.set(label, support);
  }

  return { actualLabels, actualLabelBySongId, supportByLabel };
}

export function getAnnEvaluationSummary({
  namedLists,
  inferenceResults,
}: {
  namedLists: AnnNamedLists;
  inferenceResults: Record<string, AnnEvaluationInferenceResult>;
}): AnnEvaluationSummary | null {
  const { actualLabels, actualLabelBySongId, supportByLabel } = buildActualLabelMap(namedLists);
  const totalSongs = actualLabelBySongId.size;
  if (totalSongs === 0) return null;

  const predictedLabels = [...actualLabels];
  const predictedLabelToIndex = new Map(predictedLabels.map((label, index) => [label, index]));
  const actualLabelToIndex = new Map(actualLabels.map((label, index) => [label, index]));
  const confusionRows: number[][] = actualLabels.map(() => actualLabels.map(() => 0));

  let predictedSongCount = 0;
  let correctPredictions = 0;
  let missingPredictionCount = 0;
  let unknownPredictionCount = 0;
  let confidenceCount = 0;
  let confidenceTotal = 0;
  let minConfidence: number | null = null;
  let lowConfidenceCount = 0;
  const predictedCountByLabel = new Map<string, number>();

  for (const [songId, actualLabel] of actualLabelBySongId.entries()) {
    const result = inferenceResults[songId];
    if (!result?.predictedLabel) {
      missingPredictionCount++;
      continue;
    }

    const predictedLabel = result.predictedLabel;
    predictedSongCount++;
    if (typeof result.confidence === 'number' && Number.isFinite(result.confidence)) {
      confidenceCount++;
      confidenceTotal += result.confidence;
      minConfidence = minConfidence === null ? result.confidence : Math.min(minConfidence, result.confidence);
      if (result.confidence < LOW_CONFIDENCE_THRESHOLD) lowConfidenceCount++;
    }
    predictedCountByLabel.set(predictedLabel, (predictedCountByLabel.get(predictedLabel) ?? 0) + 1);
    if (!predictedLabelToIndex.has(predictedLabel)) {
      predictedLabelToIndex.set(predictedLabel, predictedLabels.length);
      predictedLabels.push(predictedLabel);
      for (const row of confusionRows) row.push(0);
    }
    if (!actualLabelToIndex.has(predictedLabel)) {
      unknownPredictionCount++;
    }
    if (actualLabel === predictedLabel) {
      correctPredictions++;
    }

    const actualIndex = actualLabelToIndex.get(actualLabel);
    const predictedIndex = predictedLabelToIndex.get(predictedLabel);
    if (actualIndex !== undefined && predictedIndex !== undefined) {
      confusionRows[actualIndex][predictedIndex]++;
    }
  }

  let majorityBaselineLabel: string | null = null;
  let majoritySupport = 0;
  for (const [label, support] of supportByLabel.entries()) {
    if (support > majoritySupport) {
      majoritySupport = support;
      majorityBaselineLabel = label;
    }
  }

  const rows = actualLabels.map((label, labelIndex) => {
    const support = supportByLabel.get(label) ?? 0;
    const truePositive = confusionRows[labelIndex][predictedLabelToIndex.get(label) ?? labelIndex] ?? 0;
    const predictedCount = predictedCountByLabel.get(label) ?? 0;
    const falsePositive = Math.max(0, predictedCount - truePositive);
    const falseNegative = Math.max(0, support - truePositive);
    const precision = divideOrNull(truePositive, predictedCount);
    const recall = divideOrNull(truePositive, support);

    return {
      label,
      support,
      predictedCount,
      truePositive,
      falsePositive,
      falseNegative,
      precision,
      recall,
      f1: getF1(precision, recall),
    };
  });

  return {
    actualLabels,
    predictedLabels,
    confusionMatrix: confusionRows,
    rows,
    totalSongs,
    predictedSongCount,
    correctPredictions,
    accuracy: correctPredictions / totalSongs,
    majorityBaselineLabel,
    majorityBaselineAccuracy: majoritySupport / totalSongs,
    missingPredictionCount,
    unknownPredictionCount,
    confidenceCount,
    averageConfidence: confidenceCount > 0 ? confidenceTotal / confidenceCount : null,
    minConfidence,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    lowConfidenceCount,
  };
}
