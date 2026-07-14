import type { AnnTrainingSummaryWarningCode } from './annTrainingSummary';
import type { TrainingInputKind } from './annPipeline';
import {
  annModelComparisonReviewStatuses,
  normalizeAnnModelComparisonNote,
  type AnnModelComparisonReviewStatus,
  type AnnModelComparisonRun,
} from './annModelComparison';

export const ANN_MODEL_COMPARISON_STORAGE_KEY = 'musiccluster-ann-model-comparison-v1';

export interface AnnModelComparisonSnapshot {
  version: 1;
  runs: AnnModelComparisonRun[];
}

export interface AnnModelComparisonStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type AnnModelComparisonStorageLoadStatus = 'empty' | 'invalid' | 'restored' | 'error';

export interface AnnModelComparisonStorageLoadResult {
  status: AnnModelComparisonStorageLoadStatus;
  runs: AnnModelComparisonRun[] | null;
  reason: string | null;
}

export interface AnnModelComparisonStorageSaveInput {
  storage: AnnModelComparisonStorageLike;
  runs: readonly AnnModelComparisonRun[];
}

export type AnnModelComparisonStorageSaveResult =
  | { saved: true; snapshot: AnnModelComparisonSnapshot; reason: null }
  | { saved: false; snapshot: null; reason: string };

const inputKinds = new Set<TrainingInputKind>(['raw', 'processed', 'reduced']);
const reviewStatuses = new Set<AnnModelComparisonReviewStatus>(annModelComparisonReviewStatuses);
const warningCodes = new Set<AnnTrainingSummaryWarningCode>([
  'small-training-set',
  'under-sampled-labels',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function cloneRun(run: AnnModelComparisonRun): AnnModelComparisonRun {
  return {
    ...run,
    selectedFeatureIds: [...run.selectedFeatureIds],
    warningCodes: [...run.warningCodes],
  };
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return null;
  return Array.from(new Set(value));
}

function parseWarningCodes(value: unknown): AnnTrainingSummaryWarningCode[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: AnnTrainingSummaryWarningCode[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !warningCodes.has(item as AnnTrainingSummaryWarningCode)) return null;
    parsed.push(item as AnnTrainingSummaryWarningCode);
  }
  return Array.from(new Set(parsed));
}

function parseComparisonRun(value: unknown): AnnModelComparisonRun | null {
  if (!isRecord(value)) return null;

  const {
    id,
    runNumber,
    trainedAt,
    inputKind,
    inputDimension,
    selectedFeatureIds,
    trainingAccuracy,
    trainingLoss,
    datasetAccuracy,
    datasetCorrectPredictions,
    datasetTotalSongs,
    majorityBaselineAccuracy,
    majorityBaselineDelta,
    validationAccuracy,
    validationCorrectPredictions,
    validationTotalPredictions,
    validationFoldCount,
    validationLowConfidenceCount,
    reviewStatus,
    note,
    warningCodes: rawWarningCodes,
  } = value;

  if (typeof id !== 'string' || id.trim() === '') return null;
  if (!isPositiveInteger(runNumber)) return null;
  if (typeof trainedAt !== 'string' || trainedAt.trim() === '') return null;
  if (typeof inputKind !== 'string' || !inputKinds.has(inputKind as TrainingInputKind)) return null;
  if (!isPositiveInteger(inputDimension)) return null;

  const parsedSelectedFeatureIds = parseStringArray(selectedFeatureIds);
  if (!parsedSelectedFeatureIds) return null;
  const parsedWarningCodes = parseWarningCodes(rawWarningCodes);
  if (!parsedWarningCodes) return null;

  if (!isNullableFiniteNumber(trainingAccuracy)) return null;
  if (!isNullableFiniteNumber(trainingLoss)) return null;
  if (!isNullableFiniteNumber(datasetAccuracy)) return null;
  if (!isNullableNonNegativeInteger(datasetCorrectPredictions)) return null;
  if (!isNullableNonNegativeInteger(datasetTotalSongs)) return null;
  if (!isNullableFiniteNumber(majorityBaselineAccuracy)) return null;
  if (!isNullableFiniteNumber(majorityBaselineDelta)) return null;
  if (!isNullableFiniteNumber(validationAccuracy)) return null;
  if (!isNullableNonNegativeInteger(validationCorrectPredictions)) return null;
  if (!isNullableNonNegativeInteger(validationTotalPredictions)) return null;
  if (!isNullableNonNegativeInteger(validationFoldCount)) return null;
  if (!isNullableNonNegativeInteger(validationLowConfidenceCount)) return null;
  if (reviewStatus !== undefined && (typeof reviewStatus !== 'string' || !reviewStatuses.has(reviewStatus as AnnModelComparisonReviewStatus))) return null;
  if (note !== undefined && typeof note !== 'string') return null;

  return {
    id,
    runNumber,
    trainedAt,
    inputKind: inputKind as TrainingInputKind,
    inputDimension,
    selectedFeatureIds: parsedSelectedFeatureIds,
    trainingAccuracy,
    trainingLoss,
    datasetAccuracy,
    datasetCorrectPredictions,
    datasetTotalSongs,
    majorityBaselineAccuracy,
    majorityBaselineDelta,
    validationAccuracy,
    validationCorrectPredictions,
    validationTotalPredictions,
    validationFoldCount,
    validationLowConfidenceCount,
    reviewStatus: reviewStatus === undefined ? 'unreviewed' : reviewStatus as AnnModelComparisonReviewStatus,
    note: note === undefined ? '' : normalizeAnnModelComparisonNote(note),
    warningCodes: parsedWarningCodes,
  };
}

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function serializeAnnModelComparisonSnapshot(
  runs: readonly AnnModelComparisonRun[]
): AnnModelComparisonSnapshot {
  return {
    version: 1,
    runs: runs.map(cloneRun),
  };
}

export function parseAnnModelComparisonSnapshot(raw: unknown): AnnModelComparisonSnapshot | null {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== 1) return null;
  if (!Array.isArray(parsed.runs)) return null;

  const runs: AnnModelComparisonRun[] = [];
  for (const rawRun of parsed.runs) {
    const run = parseComparisonRun(rawRun);
    if (!run) return null;
    runs.push(run);
  }

  return {
    version: 1,
    runs,
  };
}

export function loadAnnModelComparisonFromStorage({
  storage,
}: {
  storage: AnnModelComparisonStorageLike;
}): AnnModelComparisonStorageLoadResult {
  try {
    const rawSnapshot = storage.getItem(ANN_MODEL_COMPARISON_STORAGE_KEY);
    if (rawSnapshot === null) {
      return { status: 'empty', runs: null, reason: null };
    }

    const snapshot = parseAnnModelComparisonSnapshot(rawSnapshot);
    if (!snapshot) {
      return { status: 'invalid', runs: null, reason: null };
    }

    return {
      status: 'restored',
      runs: snapshot.runs.map(cloneRun),
      reason: null,
    };
  } catch (error) {
    return {
      status: 'error',
      runs: null,
      reason: getErrorReason(error),
    };
  }
}

export function saveAnnModelComparisonToStorage({
  storage,
  runs,
}: AnnModelComparisonStorageSaveInput): AnnModelComparisonStorageSaveResult {
  try {
    const snapshot = serializeAnnModelComparisonSnapshot(runs);
    storage.setItem(ANN_MODEL_COMPARISON_STORAGE_KEY, JSON.stringify(snapshot));
    return { saved: true, snapshot, reason: null };
  } catch (error) {
    return {
      saved: false,
      snapshot: null,
      reason: getErrorReason(error),
    };
  }
}
