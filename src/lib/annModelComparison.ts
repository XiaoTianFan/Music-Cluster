import type { AnnEvaluationSummary } from './annEvaluation';
import type { AnnTrainingSummary, AnnTrainingSummaryWarningCode } from './annTrainingSummary';
import type { TrainingInputKind } from './annPipeline';
import type { AnnValidationExecutionSummary } from './annValidationExecution';

const comparisonInputKinds: readonly TrainingInputKind[] = ['raw', 'processed', 'reduced'];

export const ANN_MODEL_COMPARISON_NOTE_MAX_LENGTH = 240;
export const annModelComparisonReviewStatuses = [
  'unreviewed',
  'review-later',
  'promising',
  'keep',
  'discard',
] as const;

export type AnnModelComparisonReviewStatus = typeof annModelComparisonReviewStatuses[number];
export type AnnModelComparisonReviewFilter = 'all' | AnnModelComparisonReviewStatus;
export type AnnModelComparisonSortMode = 'best-quality' | 'newest' | 'oldest';

export interface AnnModelComparisonRankedRun {
  rank: number;
  run: AnnModelComparisonRun;
  score: number | null;
  scorePriority: number;
  scoreLabel: string;
}

export interface AnnModelComparisonView {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  rankedRuns: AnnModelComparisonRankedRun[];
}

export interface AnnModelComparisonRun {
  id: string;
  runNumber: number;
  trainedAt: string;
  inputKind: TrainingInputKind;
  inputDimension: number;
  selectedFeatureIds: string[];
  trainingAccuracy: number | null;
  trainingLoss: number | null;
  datasetAccuracy: number | null;
  datasetCorrectPredictions: number | null;
  datasetTotalSongs: number | null;
  majorityBaselineAccuracy: number | null;
  majorityBaselineDelta: number | null;
  validationAccuracy: number | null;
  validationCorrectPredictions: number | null;
  validationTotalPredictions: number | null;
  validationFoldCount: number | null;
  validationLowConfidenceCount: number | null;
  reviewStatus: AnnModelComparisonReviewStatus;
  note: string;
  warningCodes: AnnTrainingSummaryWarningCode[];
}

export type AnnModelComparisonCoverageStatus = 'missing' | 'trained' | 'validated' | 'evaluated';
export type AnnModelComparisonNextAction = 'train' | 'validate' | 'infer' | 'compare';

export interface AnnModelComparisonCoverage {
  inputKind: TrainingInputKind;
  status: AnnModelComparisonCoverageStatus;
  runCount: number;
  bestRun: AnnModelComparisonRun | null;
}

export interface AnnModelComparisonGuidance {
  headline: string;
  recommendation: string;
  nextAction: AnnModelComparisonNextAction;
  nextInputKind: TrainingInputKind | null;
  coverage: AnnModelComparisonCoverage[];
}

export interface AnnModelComparisonBenchmarkRow {
  inputKind: TrainingInputKind;
  status: AnnModelComparisonCoverageStatus;
  runCount: number;
  bestRun: AnnModelComparisonRun | null;
  score: number | null;
  scoreLabel: string;
  isLiveModel: boolean;
  deltaFromLive: number | null;
  deltaLabel: string;
}

export interface AnnModelComparisonBenchmark {
  activeRun: AnnModelComparisonRun | null;
  summary: string;
  rows: AnnModelComparisonBenchmarkRow[];
}

export function createAnnModelComparisonRun({
  id,
  runNumber,
  trainedAt,
  trainingSummary,
}: {
  id: string;
  runNumber: number;
  trainedAt: string;
  trainingSummary: AnnTrainingSummary;
}): AnnModelComparisonRun {
  return {
    id,
    runNumber,
    trainedAt,
    inputKind: trainingSummary.inputKind,
    inputDimension: trainingSummary.inputDimension,
    selectedFeatureIds: [...trainingSummary.selectedFeatureIds],
    trainingAccuracy: trainingSummary.finalAccuracy ?? null,
    trainingLoss: trainingSummary.finalLoss ?? null,
    datasetAccuracy: null,
    datasetCorrectPredictions: null,
    datasetTotalSongs: null,
    majorityBaselineAccuracy: null,
    majorityBaselineDelta: null,
    validationAccuracy: null,
    validationCorrectPredictions: null,
    validationTotalPredictions: null,
    validationFoldCount: null,
    validationLowConfidenceCount: null,
    reviewStatus: 'unreviewed',
    note: '',
    warningCodes: trainingSummary.warnings.map(warning => warning.code),
  };
}

export function normalizeAnnModelComparisonNote(note: string): string {
  return note.trim().slice(0, ANN_MODEL_COMPARISON_NOTE_MAX_LENGTH);
}

export function updateAnnModelComparisonRunReview({
  runs,
  runId,
  reviewStatus,
  note,
}: {
  runs: readonly AnnModelComparisonRun[];
  runId: string | null;
  reviewStatus: AnnModelComparisonReviewStatus;
  note: string;
}): AnnModelComparisonRun[] {
  if (!runId) return [...runs];

  const normalizedNote = normalizeAnnModelComparisonNote(note);
  return runs.map(run => {
    if (run.id !== runId) return run;
    if (run.reviewStatus === reviewStatus && run.note === normalizedNote) return run;
    return {
      ...run,
      reviewStatus,
      note: normalizedNote,
    };
  });
}

export function removeAnnModelComparisonRun({
  runs,
  runId,
}: {
  runs: readonly AnnModelComparisonRun[];
  runId: string | null;
}): AnnModelComparisonRun[] {
  if (!runId) return [...runs];
  return runs.filter(run => run.id !== runId);
}

export function updateAnnModelComparisonRunEvaluation({
  runs,
  runId,
  evaluationSummary,
}: {
  runs: readonly AnnModelComparisonRun[];
  runId: string | null;
  evaluationSummary: AnnEvaluationSummary | null;
}): AnnModelComparisonRun[] {
  if (!runId || !evaluationSummary) return [...runs];

  return runs.map(run => {
    if (run.id !== runId) return run;
    return {
      ...run,
      datasetAccuracy: evaluationSummary.accuracy,
      datasetCorrectPredictions: evaluationSummary.correctPredictions,
      datasetTotalSongs: evaluationSummary.totalSongs,
      majorityBaselineAccuracy: evaluationSummary.majorityBaselineAccuracy,
      majorityBaselineDelta: evaluationSummary.accuracy - evaluationSummary.majorityBaselineAccuracy,
    };
  });
}

export function updateAnnModelComparisonRunValidation({
  runs,
  runId,
  validationSummary,
}: {
  runs: readonly AnnModelComparisonRun[];
  runId: string | null;
  validationSummary: AnnValidationExecutionSummary | null;
}): AnnModelComparisonRun[] {
  if (!runId || !validationSummary) return [...runs];

  return runs.map(run => {
    if (run.id !== runId) return run;
    return {
      ...run,
      validationAccuracy: validationSummary.accuracy,
      validationCorrectPredictions: validationSummary.correctPredictions,
      validationTotalPredictions: validationSummary.totalPredictions,
      validationFoldCount: validationSummary.foldCount,
      validationLowConfidenceCount: validationSummary.lowConfidenceCount,
    };
  });
}

export function getBestAnnModelComparisonRun(
  runs: readonly AnnModelComparisonRun[]
): AnnModelComparisonRun | null {
  let bestRun: AnnModelComparisonRun | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const run of runs) {
    const score = run.datasetAccuracy ?? run.validationAccuracy ?? run.trainingAccuracy;
    if (score === null) continue;
    const evaluatedBonus = run.datasetAccuracy !== null ? 2 : run.validationAccuracy !== null ? 1 : 0;
    const comparableScore = score + evaluatedBonus;
    if (comparableScore > bestScore) {
      bestRun = run;
      bestScore = comparableScore;
    }
  }

  return bestRun;
}

function getRunQualityScore(run: AnnModelComparisonRun): {
  score: number | null;
  scorePriority: number;
  scoreLabel: string;
} {
  if (run.datasetAccuracy !== null) {
    return {
      score: run.datasetAccuracy,
      scorePriority: 3,
      scoreLabel: `Dataset ${(run.datasetAccuracy * 100).toFixed(1)}%`,
    };
  }
  if (run.validationAccuracy !== null) {
    return {
      score: run.validationAccuracy,
      scorePriority: 2,
      scoreLabel: `Validation ${(run.validationAccuracy * 100).toFixed(1)}%`,
    };
  }
  if (run.trainingAccuracy !== null) {
    return {
      score: run.trainingAccuracy,
      scorePriority: 1,
      scoreLabel: `Training ${(run.trainingAccuracy * 100).toFixed(1)}%`,
    };
  }
  return {
    score: null,
    scorePriority: 0,
    scoreLabel: 'No score',
  };
}

function compareRankedRuns(
  a: AnnModelComparisonRankedRun,
  b: AnnModelComparisonRankedRun,
  sortMode: AnnModelComparisonSortMode
): number {
  if (sortMode === 'newest') return b.run.runNumber - a.run.runNumber;
  if (sortMode === 'oldest') return a.run.runNumber - b.run.runNumber;

  if (b.scorePriority !== a.scorePriority) return b.scorePriority - a.scorePriority;
  if (b.score !== a.score) return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
  return b.run.runNumber - a.run.runNumber;
}

export function getAnnModelComparisonView({
  runs,
  reviewFilter = 'all',
  sortMode = 'best-quality',
}: {
  runs: readonly AnnModelComparisonRun[];
  reviewFilter?: AnnModelComparisonReviewFilter;
  sortMode?: AnnModelComparisonSortMode;
}): AnnModelComparisonView {
  const visibleRuns = reviewFilter === 'all'
    ? [...runs]
    : runs.filter(run => run.reviewStatus === reviewFilter);

  const rankedRuns = visibleRuns
    .map(run => {
      const quality = getRunQualityScore(run);
      return {
        rank: 0,
        run,
        ...quality,
      };
    })
    .sort((a, b) => compareRankedRuns(a, b, sortMode))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    totalCount: runs.length,
    visibleCount: rankedRuns.length,
    hiddenCount: runs.length - rankedRuns.length,
    rankedRuns,
  };
}

function getCoverageStatus(run: AnnModelComparisonRun | null): AnnModelComparisonCoverageStatus {
  if (!run) return 'missing';
  if (run.datasetAccuracy !== null) return 'evaluated';
  if (run.validationAccuracy !== null) return 'validated';
  return 'trained';
}

function createCoverage(runs: readonly AnnModelComparisonRun[]): AnnModelComparisonCoverage[] {
  return comparisonInputKinds.map(inputKind => {
    const inputRuns = runs.filter(run => run.inputKind === inputKind);
    const bestRun = getBestAnnModelComparisonRun(inputRuns);
    return {
      inputKind,
      status: getCoverageStatus(bestRun),
      runCount: inputRuns.length,
      bestRun,
    };
  });
}

function formatBenchmarkDelta(value: number): string {
  if (Math.abs(value) < 0.0005) return 'Same as live';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pts vs live`;
}

export function getAnnModelComparisonBenchmark({
  runs,
  activeRunId,
}: {
  runs: readonly AnnModelComparisonRun[];
  activeRunId?: string | null;
}): AnnModelComparisonBenchmark {
  const activeRun = activeRunId
    ? runs.find(run => run.id === activeRunId) ?? null
    : null;
  const activeQuality = activeRun ? getRunQualityScore(activeRun) : null;
  const activeScore = activeQuality?.score ?? null;
  const summary = activeRun
    ? `Live model Run ${activeRun.runNumber} uses ${activeRun.inputKind} input with ${activeQuality?.scoreLabel.toLowerCase() ?? 'no score'}.`
    : 'No live model selected for side-by-side comparison.';

  return {
    activeRun,
    summary,
    rows: createCoverage(runs).map(item => {
      const quality = item.bestRun ? getRunQualityScore(item.bestRun) : null;
      const score = quality?.score ?? null;
      const isLiveModel = Boolean(activeRun && item.bestRun?.id === activeRun.id);
      const deltaFromLive = activeScore === null || score === null
        ? null
        : score - activeScore;
      const deltaLabel = !activeRun
        ? 'No live model'
        : isLiveModel
          ? 'Live model'
          : deltaFromLive === null
            ? 'No comparison score'
            : formatBenchmarkDelta(deltaFromLive);

      return {
        inputKind: item.inputKind,
        status: item.status,
        runCount: item.runCount,
        bestRun: item.bestRun,
        score,
        scoreLabel: quality?.scoreLabel ?? 'No run',
        isLiveModel,
        deltaFromLive,
        deltaLabel,
      };
    }),
  };
}

export function getAnnModelComparisonGuidance(
  runs: readonly AnnModelComparisonRun[]
): AnnModelComparisonGuidance {
  const coverage = createCoverage(runs);
  const missing = coverage.find(item => item.status === 'missing');
  if (missing) {
    return {
      headline: 'Compare input pipelines',
      nextAction: 'train',
      nextInputKind: missing.inputKind,
      recommendation: `Train a ${missing.inputKind} input run next so raw, processed, and reduced pipelines are represented.`,
      coverage,
    };
  }

  const trainedOnly = coverage.find(item => item.status === 'trained');
  if (trainedOnly) {
    return {
      headline: 'Compare input pipelines',
      nextAction: 'validate',
      nextInputKind: trainedOnly.inputKind,
      recommendation: `Run validation for the ${trainedOnly.inputKind} input run before comparing it against validated runs.`,
      coverage,
    };
  }

  const validatedOnly = coverage.find(item => item.status === 'validated');
  if (validatedOnly) {
    return {
      headline: 'Compare input pipelines',
      nextAction: 'infer',
      nextInputKind: validatedOnly.inputKind,
      recommendation: `Run dataset inference for the ${validatedOnly.inputKind} input run to add baseline and confusion-matrix context.`,
      coverage,
    };
  }

  return {
    headline: 'Compare input pipelines',
    nextAction: 'compare',
    nextInputKind: null,
    recommendation: 'All input pipelines have evaluated runs. Compare dataset accuracy, validation accuracy, confidence flags, and warnings before choosing a model.',
    coverage,
  };
}
