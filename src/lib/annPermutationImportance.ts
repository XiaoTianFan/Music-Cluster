import {
  getAnnEvaluationSummary,
  type AnnEvaluationInferenceResult,
  type AnnEvaluationSummary,
  type AnnNamedLists,
} from './annEvaluation';
import type { TrainingInputKind } from './annPipeline';

export interface AnnPermutationImportanceTask {
  dimensionIndex: number;
  dimensionLabel: string;
  songIds: string[];
  vectors: number[][];
}

export interface AnnPermutationImportancePlan {
  inputKind: TrainingInputKind;
  songIds: string[];
  baselineVectors: number[][];
  dimensionCount: number;
  tasks: AnnPermutationImportanceTask[];
}

export interface AnnPermutationImportanceRow {
  dimensionIndex: number;
  dimensionLabel: string;
  baselineAccuracy: number;
  permutedAccuracy: number;
  accuracyDrop: number;
  accuracyDropLabel: string;
  impactLabel: string;
  correctPredictions: number;
  totalSongs: number;
  lowConfidenceCount: number;
  baselineAverageConfidence: number | null;
  permutedAverageConfidence: number | null;
  confidenceDrop: number | null;
  confidenceDropLabel: string;
  lowConfidenceDelta: number;
}

export interface AnnPermutationImportanceSummary {
  inputKind: TrainingInputKind;
  baselineAccuracy: number;
  rowCount: number;
  dimensionCount: number;
  rows: AnnPermutationImportanceRow[];
  summary: string;
}

export type AnnPermutationInferenceResultsByDimension = Record<
  number,
  Record<string, AnnEvaluationInferenceResult>
>;

function getVectorDimension(vectors: readonly (readonly number[])[]): number | null {
  if (vectors.length < 2) return null;
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

function getDimensionLabels(dimension: number, labels?: readonly string[] | null): string[] {
  if (labels?.length === dimension) {
    return labels.map((label, index) => label.trim() || `Input ${index + 1}`);
  }
  return Array.from({ length: dimension }, (_, index) => `Input ${index + 1}`);
}

function permuteDimension(vectors: readonly (readonly number[])[], dimensionIndex: number): number[][] {
  return vectors.map((vector, rowIndex) => {
    const nextVector = [...vector];
    const sourceRowIndex = (rowIndex + 1) % vectors.length;
    nextVector[dimensionIndex] = vectors[sourceRowIndex][dimensionIndex];
    return nextVector;
  });
}

function formatPointDelta(value: number): string {
  const points = Math.abs(value * 100).toFixed(1);
  if (value > 0) return `${points} pts drop`;
  if (value < 0) return `${points} pts gain`;
  return 'No accuracy drop';
}

function formatPointMagnitude(value: number): string {
  return `${Math.abs(value * 100).toFixed(1)} pts`;
}

function formatConfidenceDelta(value: number | null): string {
  if (value === null) return 'Confidence unavailable';
  const points = Math.abs(value * 100).toFixed(1);
  if (value > 0) return `${points} pts confidence drop`;
  if (value < 0) return `${points} pts confidence gain`;
  return 'No confidence change';
}

function getImpactLabel(drop: number): string {
  if (drop >= 0.15) return 'High impact';
  if (drop >= 0.05) return 'Moderate impact';
  if (drop > 0) return 'Low impact';
  return 'No measured drop';
}

function getConfidenceDrop(
  baseline: AnnEvaluationSummary,
  permuted: AnnEvaluationSummary
): number | null {
  return baseline.averageConfidence === null || permuted.averageConfidence === null
    ? null
    : baseline.averageConfidence - permuted.averageConfidence;
}

export function createAnnPermutationImportancePlan({
  inputKind,
  songIds,
  vectors,
  dimensionLabels,
}: {
  inputKind: TrainingInputKind;
  songIds: readonly string[];
  vectors: readonly (readonly number[])[];
  dimensionLabels?: readonly string[] | null;
}): AnnPermutationImportancePlan | null {
  if (songIds.length !== vectors.length || songIds.length < 2) return null;
  if (!songIds.every(songId => typeof songId === 'string' && songId.trim() !== '')) return null;

  const dimension = getVectorDimension(vectors);
  if (dimension === null) return null;

  const labels = getDimensionLabels(dimension, dimensionLabels);
  return {
    inputKind,
    songIds: [...songIds],
    baselineVectors: vectors.map(vector => [...vector]),
    dimensionCount: dimension,
    tasks: labels.map((dimensionLabel, dimensionIndex) => ({
      dimensionIndex,
      dimensionLabel,
      songIds: [...songIds],
      vectors: permuteDimension(vectors, dimensionIndex),
    })),
  };
}

export function getAnnPermutationImportanceSummary({
  plan,
  namedLists,
  baselineEvaluation,
  permutedResultsByDimension,
}: {
  plan: AnnPermutationImportancePlan;
  namedLists: AnnNamedLists;
  baselineEvaluation: AnnEvaluationSummary;
  permutedResultsByDimension: AnnPermutationInferenceResultsByDimension;
}): AnnPermutationImportanceSummary | null {
  const rows: AnnPermutationImportanceRow[] = [];

  for (const task of plan.tasks) {
    const inferenceResults = permutedResultsByDimension[task.dimensionIndex];
    if (!inferenceResults) continue;

    const evaluation = getAnnEvaluationSummary({ namedLists, inferenceResults });
    if (!evaluation) continue;

    const accuracyDrop = baselineEvaluation.accuracy - evaluation.accuracy;
    const confidenceDrop = getConfidenceDrop(baselineEvaluation, evaluation);
    rows.push({
      dimensionIndex: task.dimensionIndex,
      dimensionLabel: task.dimensionLabel,
      baselineAccuracy: baselineEvaluation.accuracy,
      permutedAccuracy: evaluation.accuracy,
      accuracyDrop,
      accuracyDropLabel: formatPointDelta(accuracyDrop),
      impactLabel: getImpactLabel(accuracyDrop),
      correctPredictions: evaluation.correctPredictions,
      totalSongs: evaluation.totalSongs,
      lowConfidenceCount: evaluation.lowConfidenceCount,
      baselineAverageConfidence: baselineEvaluation.averageConfidence,
      permutedAverageConfidence: evaluation.averageConfidence,
      confidenceDrop,
      confidenceDropLabel: formatConfidenceDelta(confidenceDrop),
      lowConfidenceDelta: evaluation.lowConfidenceCount - baselineEvaluation.lowConfidenceCount,
    });
  }

  if (rows.length === 0) return null;

  rows.sort((left, right) => (
    right.accuracyDrop - left.accuracyDrop
    || (right.confidenceDrop ?? Number.NEGATIVE_INFINITY) - (left.confidenceDrop ?? Number.NEGATIVE_INFINITY)
    || left.dimensionIndex - right.dimensionIndex
  ));
  const topRow = rows[0];
  const summary = topRow.accuracyDrop > 0
    ? `Top impact: ${topRow.dimensionLabel} drops dataset accuracy by ${formatPointMagnitude(topRow.accuracyDrop)} when permuted.`
    : topRow.confidenceDrop !== null && topRow.confidenceDrop > 0
      ? `No accuracy drop; ${topRow.dimensionLabel} lowered average confidence by ${formatPointMagnitude(topRow.confidenceDrop)} when permuted.`
    : 'No tested input dimension reduced dataset accuracy when permuted.';

  return {
    inputKind: plan.inputKind,
    baselineAccuracy: baselineEvaluation.accuracy,
    rowCount: rows.length,
    dimensionCount: plan.dimensionCount,
    rows,
    summary,
  };
}
