import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANN_MODEL_COMPARISON_STORAGE_KEY,
  loadAnnModelComparisonFromStorage,
  saveAnnModelComparisonToStorage,
  type AnnModelComparisonStorageLike,
} from '../src/lib/annModelComparisonStorage';
import {
  getAnnModelComparisonGuidance,
  type AnnModelComparisonRun,
} from '../src/lib/annModelComparison';

class MemoryStorage implements AnnModelComparisonStorageLike {
  private values = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const rawRun: AnnModelComparisonRun = {
  id: 'ann-train-1',
  runNumber: 1,
  trainedAt: '2026-06-17T10:00:00.000Z',
  inputKind: 'raw',
  inputDimension: 2,
  selectedFeatureIds: ['energy'],
  trainingAccuracy: 0.75,
  trainingLoss: 0.24,
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
  warningCodes: ['small-training-set'],
};

const processedRun: AnnModelComparisonRun = {
  id: 'ann-train-2',
  runNumber: 2,
  trainedAt: '2026-06-17T10:05:00.000Z',
  inputKind: 'processed',
  inputDimension: 2,
  selectedFeatureIds: ['energy', 'rms'],
  trainingAccuracy: 0.8,
  trainingLoss: 0.18,
  datasetAccuracy: 0.875,
  datasetCorrectPredictions: 7,
  datasetTotalSongs: 8,
  majorityBaselineAccuracy: 0.5,
  majorityBaselineDelta: 0.375,
  validationAccuracy: 0.75,
  validationCorrectPredictions: 6,
  validationTotalPredictions: 8,
  validationFoldCount: 4,
  validationLowConfidenceCount: 1,
  reviewStatus: 'keep',
  note: 'Best balanced validation run so far.',
  warningCodes: [],
};

test('loadAnnModelComparisonFromStorage restores persisted runs for comparison guidance', () => {
  const storage = new MemoryStorage({
    [ANN_MODEL_COMPARISON_STORAGE_KEY]: JSON.stringify({
      version: 1,
      runs: [rawRun, processedRun],
    }),
  });

  const result = loadAnnModelComparisonFromStorage({ storage });

  assert.equal(result.status, 'restored');
  assert.equal(result.reason, null);
  assert.deepEqual(result.runs, [rawRun, processedRun]);
  assert.notEqual(result.runs?.[1].selectedFeatureIds, processedRun.selectedFeatureIds);

  const guidance = getAnnModelComparisonGuidance(result.runs ?? []);
  assert.equal(guidance.nextInputKind, 'reduced');
  assert.equal(guidance.nextAction, 'train');
});

test('loadAnnModelComparisonFromStorage defaults legacy rows without review metadata', () => {
  const legacyRun: Record<string, unknown> = { ...rawRun };
  delete legacyRun.reviewStatus;
  delete legacyRun.note;
  const storage = new MemoryStorage({
    [ANN_MODEL_COMPARISON_STORAGE_KEY]: JSON.stringify({
      version: 1,
      runs: [legacyRun],
    }),
  });

  const result = loadAnnModelComparisonFromStorage({ storage });

  assert.equal(result.status, 'restored');
  assert.equal(result.runs?.[0].reviewStatus, 'unreviewed');
  assert.equal(result.runs?.[0].note, '');
});

test('loadAnnModelComparisonFromStorage distinguishes empty, invalid, and storage-error states', () => {
  assert.deepEqual(loadAnnModelComparisonFromStorage({
    storage: new MemoryStorage(),
  }), {
    status: 'empty',
    runs: null,
    reason: null,
  });

  assert.deepEqual(loadAnnModelComparisonFromStorage({
    storage: new MemoryStorage({ [ANN_MODEL_COMPARISON_STORAGE_KEY]: JSON.stringify({ version: 1, runs: [{ ...rawRun, inputKind: 'umap' }] }) }),
  }), {
    status: 'invalid',
    runs: null,
    reason: null,
  });

  assert.deepEqual(loadAnnModelComparisonFromStorage({
    storage: new MemoryStorage({ [ANN_MODEL_COMPARISON_STORAGE_KEY]: JSON.stringify({ version: 1, runs: [{ ...rawRun, reviewStatus: 'maybe' }] }) }),
  }), {
    status: 'invalid',
    runs: null,
    reason: null,
  });

  const storage: AnnModelComparisonStorageLike = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {},
  };

  assert.deepEqual(loadAnnModelComparisonFromStorage({ storage }), {
    status: 'error',
    runs: null,
    reason: 'blocked',
  });
});

test('saveAnnModelComparisonToStorage persists cloned comparison runs and reports write errors', () => {
  const storage = new MemoryStorage();
  const result = saveAnnModelComparisonToStorage({
    storage,
    runs: [rawRun, processedRun],
  });

  assert.equal(result.saved, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.snapshot?.runs, [rawRun, processedRun]);
  assert.notEqual(result.snapshot?.runs[0].warningCodes, rawRun.warningCodes);
  assert.deepEqual(JSON.parse(storage.getItem(ANN_MODEL_COMPARISON_STORAGE_KEY) ?? ''), result.snapshot);

  const failingStorage: AnnModelComparisonStorageLike = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };

  assert.deepEqual(saveAnnModelComparisonToStorage({
    storage: failingStorage,
    runs: [rawRun],
  }), {
    saved: false,
    snapshot: null,
    reason: 'quota exceeded',
  });
});
