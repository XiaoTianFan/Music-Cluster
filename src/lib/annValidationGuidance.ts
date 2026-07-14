import type { AnnEvaluationSummary } from './annEvaluation';
import type { AnnTrainingSummary } from './annTrainingSummary';

export type AnnValidationRiskLevel = 'exploratory' | 'limited' | 'stronger';
export type AnnValidationStrategy = 'leave-one-out' | 'k-fold' | 'holdout';

export interface AnnValidationGuidance {
  riskLevel: AnnValidationRiskLevel;
  strategy: AnnValidationStrategy;
  foldCount: number | null;
  headline: string;
  recommendation: string;
  confidenceMessage: string;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getSmallestLabelCount(trainingSummary: AnnTrainingSummary): number {
  if (trainingSummary.labelCounts.length === 0) return 0;
  return Math.min(...trainingSummary.labelCounts.map(row => row.count));
}

function getConfidenceMessage(evaluationSummary: AnnEvaluationSummary | null): string {
  if (!evaluationSummary) {
    return 'Run dataset inference to compare this validation guidance against current predictions.';
  }

  if (evaluationSummary.confidenceCount === 0) {
    return 'Prediction confidence is not available for this run, so accuracy should be checked manually.';
  }

  const threshold = formatPercent(evaluationSummary.lowConfidenceThreshold);
  if (evaluationSummary.lowConfidenceCount > 0) {
    return `${evaluationSummary.lowConfidenceCount}/${evaluationSummary.confidenceCount} evaluated predictions are below ${threshold}; inspect those songs before trusting accuracy.`;
  }

  return `All ${evaluationSummary.confidenceCount} evaluated predictions are at or above ${threshold}.`;
}

export function getAnnValidationGuidance({
  trainingSummary,
  evaluationSummary,
}: {
  trainingSummary: AnnTrainingSummary | null;
  evaluationSummary: AnnEvaluationSummary | null;
}): AnnValidationGuidance | null {
  if (!trainingSummary) return null;

  const smallestLabelCount = getSmallestLabelCount(trainingSummary);
  const labeledSongCount = trainingSummary.labeledSongCount;

  if (labeledSongCount < 12 || smallestLabelCount < 3) {
    return {
      riskLevel: 'exploratory',
      strategy: 'leave-one-out',
      foldCount: null,
      headline: 'Exploratory validation',
      recommendation: `Only ${labeledSongCount} labeled songs are available. Treat split accuracy as directional; use leave-one-out review or collect at least 5 songs per label before comparing runs.`,
      confidenceMessage: getConfidenceMessage(evaluationSummary),
    };
  }

  if (labeledSongCount < 30 || smallestLabelCount < 5) {
    const foldCount = Math.max(2, Math.min(5, smallestLabelCount));
    return {
      riskLevel: 'limited',
      strategy: 'k-fold',
      foldCount,
      headline: 'Limited validation',
      recommendation: `Prefer a ${foldCount}-fold stratified review before trusting a single split; each label should appear in every validation fold.`,
      confidenceMessage: getConfidenceMessage(evaluationSummary),
    };
  }

  return {
    riskLevel: 'stronger',
    strategy: 'holdout',
    foldCount: null,
    headline: 'Stronger validation',
    recommendation: 'Current label counts can support a holdout split, but compare multiple runs before treating accuracy as stable.',
    confidenceMessage: getConfidenceMessage(evaluationSummary),
  };
}
