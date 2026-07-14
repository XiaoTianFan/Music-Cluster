import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnValidationExportFilename,
  createAnnValidationExportPayload,
} from '../src/lib/annValidationExport';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';
import type { AnnValidationExecutionSummary, AnnValidationFoldRunResult } from '../src/lib/annValidationExecution';

const trainingSummary: AnnTrainingSummary = {
  inputKind: 'processed',
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
  epochs: 50,
  splitRatio: 0.8,
  validationRatio: 0.2,
  batchSize: 32,
  seed: 1234,
  finalLoss: 0.12,
  finalAccuracy: 0.875,
};

const validationSummary: AnnValidationExecutionSummary = {
  foldCount: 2,
  totalPredictions: 3,
  correctPredictions: 1,
  accuracy: 1 / 3,
  missingPredictionCount: 1,
  confidenceCount: 2,
  averageConfidence: 0.775,
  lowConfidenceThreshold: 0.7,
  lowConfidenceCount: 1,
};

const foldResults: AnnValidationFoldRunResult[] = [
  {
    foldNumber: 1,
    expectedLabels: { 'song-a': 'Rock', 'song-b': 'Rock' },
    results: {
      'song-a': { predictedLabel: 'Rock', confidence: 0.91 },
      'song-b': { predictedLabel: 'Jazz', confidence: 0.64 },
    },
    trainMetrics: { loss: 0.11, accuracy: 0.75 },
  },
  {
    foldNumber: 2,
    expectedLabels: { 'song-c': 'Jazz' },
    results: {},
  },
];

const comparisonRun: AnnModelComparisonRun = {
  id: 'ann-train-2',
  runNumber: 2,
  trainedAt: '2026-06-17T10:05:00.000Z',
  inputKind: 'processed',
  inputDimension: 2,
  selectedFeatureIds: ['energy', 'rms'],
  trainingAccuracy: 0.875,
  trainingLoss: 0.12,
  datasetAccuracy: 1,
  datasetCorrectPredictions: 4,
  datasetTotalSongs: 4,
  majorityBaselineAccuracy: 0.5,
  majorityBaselineDelta: 0.5,
  validationAccuracy: 1 / 3,
  validationCorrectPredictions: 1,
  validationTotalPredictions: 3,
  validationFoldCount: 2,
  validationLowConfidenceCount: 1,
  reviewStatus: 'keep',
  note: 'Validation export should include comparison notes.',
  warningCodes: [],
};

test('createAnnValidationExportPayload preserves validation summary, fold rows, and comparison context', () => {
  const payload = createAnnValidationExportPayload({
    exportedAt: '2026-06-17T11:00:00.000Z',
    trainingSummary,
    validationSummary,
    foldResults,
    comparisonRun,
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-06-17T11:00:00.000Z');
  assert.deepEqual(payload.training.inputKind, 'processed');
  assert.deepEqual(payload.training.selectedFeatureIds, ['energy', 'rms']);
  assert.deepEqual(payload.validation.summary, validationSummary);
  assert.equal(payload.validation.folds.length, 2);
  assert.deepEqual(payload.validation.folds[0], {
    foldNumber: 1,
    trainMetrics: { loss: 0.11, accuracy: 0.75 },
    predictions: [
      {
        songId: 'song-a',
        expectedLabel: 'Rock',
        predictedLabel: 'Rock',
        confidence: 0.91,
        correct: true,
      },
      {
        songId: 'song-b',
        expectedLabel: 'Rock',
        predictedLabel: 'Jazz',
        confidence: 0.64,
        correct: false,
      },
    ],
  });
  assert.deepEqual(payload.validation.folds[1].predictions, [
    {
      songId: 'song-c',
      expectedLabel: 'Jazz',
      predictedLabel: null,
      confidence: null,
      correct: null,
    },
  ]);
  assert.deepEqual(payload.comparisonRun, {
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-06-17T10:05:00.000Z',
    datasetAccuracy: 1,
    validationAccuracy: 1 / 3,
    validationCorrectPredictions: 1,
    validationTotalPredictions: 3,
    validationFoldCount: 2,
    validationLowConfidenceCount: 1,
  });
});

test('createAnnValidationExportFilename creates a filesystem-safe run filename', () => {
  assert.equal(
    createAnnValidationExportFilename({
      exportedAt: '2026-06-17T11:00:01.234Z',
      runNumber: 2,
    }),
    'musiccluster-ann-validation-run-2-2026-06-17T11-00-01-234Z.json'
  );
});
