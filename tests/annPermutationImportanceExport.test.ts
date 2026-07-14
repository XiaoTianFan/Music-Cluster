import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnPermutationImportanceExportFilename,
  createAnnPermutationImportanceExportPayload,
} from '../src/lib/annPermutationImportanceExport';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';
import type { AnnPermutationImportanceSummary } from '../src/lib/annPermutationImportance';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';

const trainingSummary: AnnTrainingSummary = {
  inputKind: 'raw',
  selectedFeatureIds: ['energy', 'rms'],
  inputDimension: 2,
  labeledSongCount: 4,
  classCount: 2,
  labelCounts: [
    { label: 'Rock', count: 2 },
    { label: 'Jazz', count: 2 },
  ],
  warnings: [],
  hiddenLayers: 1,
  nodesPerLayer: [16],
  activation: 'relu',
  optimizer: 'adam',
  learningRate: 0.001,
  epochs: 30,
  splitRatio: 0.8,
  validationRatio: 0.2,
  batchSize: 4,
  seed: 99,
  finalLoss: 0.2,
  finalAccuracy: 0.75,
};

const permutationImportanceSummary: AnnPermutationImportanceSummary = {
  inputKind: 'raw',
  baselineAccuracy: 1,
  rowCount: 2,
  dimensionCount: 2,
  summary: 'Top impact: energy drops dataset accuracy by 50.0 pts when permuted.',
  rows: [
    {
      dimensionIndex: 0,
      dimensionLabel: 'energy',
      baselineAccuracy: 1,
      permutedAccuracy: 0.5,
      accuracyDrop: 0.5,
      accuracyDropLabel: '50.0 pts drop',
      impactLabel: 'High impact',
      correctPredictions: 2,
      totalSongs: 4,
      lowConfidenceCount: 1,
      baselineAverageConfidence: 0.9,
      permutedAverageConfidence: 0.72,
      confidenceDrop: 0.18,
      confidenceDropLabel: '18.0 pts confidence drop',
      lowConfidenceDelta: 1,
    },
    {
      dimensionIndex: 1,
      dimensionLabel: 'rms',
      baselineAccuracy: 1,
      permutedAccuracy: 1,
      accuracyDrop: 0,
      accuracyDropLabel: 'No accuracy drop',
      impactLabel: 'No measured drop',
      correctPredictions: 4,
      totalSongs: 4,
      lowConfidenceCount: 0,
      baselineAverageConfidence: 0.9,
      permutedAverageConfidence: 0.91,
      confidenceDrop: -0.010000000000000009,
      confidenceDropLabel: '1.0 pts confidence gain',
      lowConfidenceDelta: 0,
    },
  ],
};

const comparisonRun: AnnModelComparisonRun = {
  id: 'ann-train-3',
  runNumber: 3,
  trainedAt: '2026-06-17T10:05:00.000Z',
  inputKind: 'raw',
  inputDimension: 2,
  selectedFeatureIds: ['energy', 'rms'],
  trainingAccuracy: 0.75,
  trainingLoss: 0.2,
  datasetAccuracy: 1,
  datasetCorrectPredictions: 4,
  datasetTotalSongs: 4,
  majorityBaselineAccuracy: 0.5,
  majorityBaselineDelta: 0.5,
  validationAccuracy: 0.75,
  validationCorrectPredictions: 3,
  validationTotalPredictions: 4,
  validationFoldCount: 4,
  validationLowConfidenceCount: 1,
  reviewStatus: 'promising',
  note: 'Feature impact should travel with the active comparison context.',
  warningCodes: [],
};

test('createAnnPermutationImportanceExportPayload preserves impact rows and comparison context', () => {
  const payload = createAnnPermutationImportanceExportPayload({
    exportedAt: '2026-06-17T11:10:00.000Z',
    trainingSummary,
    permutationImportanceSummary,
    comparisonRun,
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-06-17T11:10:00.000Z');
  assert.deepEqual(payload.training.selectedFeatureIds, ['energy', 'rms']);
  assert.equal(payload.training.inputKind, 'raw');
  assert.equal(payload.impact.summary, 'Top impact: energy drops dataset accuracy by 50.0 pts when permuted.');
  assert.equal(payload.impact.baselineAccuracy, 1);
  assert.equal(payload.impact.dimensionCount, 2);
  assert.equal(payload.impact.rows.length, 2);
  assert.deepEqual(payload.impact.rows[0], permutationImportanceSummary.rows[0]);
  assert.deepEqual(payload.comparisonRun, {
    id: 'ann-train-3',
    runNumber: 3,
    trainedAt: '2026-06-17T10:05:00.000Z',
    inputKind: 'raw',
    inputDimension: 2,
    datasetAccuracy: 1,
    datasetCorrectPredictions: 4,
    datasetTotalSongs: 4,
    validationAccuracy: 0.75,
    reviewStatus: 'promising',
    note: 'Feature impact should travel with the active comparison context.',
  });
});

test('createAnnPermutationImportanceExportFilename creates a filesystem-safe run filename', () => {
  assert.equal(
    createAnnPermutationImportanceExportFilename({
      exportedAt: '2026-06-17T11:10:11.234Z',
      runNumber: 3,
    }),
    'musiccluster-ann-feature-impact-run-3-2026-06-17T11-10-11-234Z.json'
  );

  assert.equal(
    createAnnPermutationImportanceExportFilename({
      exportedAt: '2026-06-17T11:10:11.234Z',
      runNumber: null,
    }),
    'musiccluster-ann-feature-impact-2026-06-17T11-10-11-234Z.json'
  );
});
