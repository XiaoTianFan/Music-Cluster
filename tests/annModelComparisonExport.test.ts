import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnModelComparisonExportFilename,
  createAnnModelComparisonExportPayload,
  parseAnnModelComparisonImportPayload,
} from '../src/lib/annModelComparisonExport';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';

const runs: AnnModelComparisonRun[] = [
  {
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
    reviewStatus: 'review-later',
    note: 'Needs validation before trusting this raw baseline.',
    warningCodes: ['small-training-set'],
  },
  {
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
    note: 'Portable note should survive import.',
    warningCodes: [],
  },
];

test('createAnnModelComparisonExportPayload preserves runs and derived guidance context', () => {
  const payload = createAnnModelComparisonExportPayload({
    exportedAt: '2026-06-17T11:00:00.000Z',
    runs,
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-06-17T11:00:00.000Z');
  assert.equal(payload.runCount, 2);
  assert.deepEqual(payload.runs, runs);
  assert.equal(payload.runs[1].reviewStatus, 'keep');
  assert.equal(payload.runs[1].note, 'Portable note should survive import.');
  assert.notEqual(payload.runs[0].selectedFeatureIds, runs[0].selectedFeatureIds);
  assert.equal(payload.guidance.nextInputKind, 'reduced');
  assert.equal(payload.guidance.nextAction, 'train');
  assert.deepEqual(payload.guidance.coverage.map(item => ({
    inputKind: item.inputKind,
    status: item.status,
    runCount: item.runCount,
    bestRunId: item.bestRunId,
  })), [
    { inputKind: 'raw', status: 'trained', runCount: 1, bestRunId: 'ann-train-1' },
    { inputKind: 'processed', status: 'evaluated', runCount: 1, bestRunId: 'ann-train-2' },
    { inputKind: 'reduced', status: 'missing', runCount: 0, bestRunId: null },
  ]);
});

test('parseAnnModelComparisonImportPayload imports export payloads and storage snapshots', () => {
  const payload = createAnnModelComparisonExportPayload({
    exportedAt: '2026-06-17T11:00:00.000Z',
    runs,
  });

  const exported = parseAnnModelComparisonImportPayload(JSON.stringify(payload));
  assert.equal(exported.ok, true);
  assert.deepEqual(exported.ok ? exported.runs : null, runs);

  const storageSnapshot = parseAnnModelComparisonImportPayload(JSON.stringify({
    version: 1,
    runs,
  }));
  assert.equal(storageSnapshot.ok, true);
  assert.deepEqual(storageSnapshot.ok ? storageSnapshot.runs : null, runs);
});

test('parseAnnModelComparisonImportPayload rejects malformed imports with a reason', () => {
  assert.deepEqual(parseAnnModelComparisonImportPayload('{bad json'), {
    ok: false,
    reason: 'Comparison import is not valid JSON.',
  });

  assert.deepEqual(parseAnnModelComparisonImportPayload(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-06-17T11:00:00.000Z',
    runs: [{ ...runs[0], inputKind: 'umap' }],
  })), {
    ok: false,
    reason: 'Comparison import does not match the expected schema.',
  });
});

test('createAnnModelComparisonExportFilename creates a filesystem-safe filename', () => {
  assert.equal(
    createAnnModelComparisonExportFilename({ exportedAt: '2026-06-17T11:00:01.234Z' }),
    'musiccluster-ann-comparison-history-2026-06-17T11-00-01-234Z.json'
  );
});
