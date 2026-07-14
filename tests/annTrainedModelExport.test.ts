import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnTrainedModelExportFilename,
  createAnnTrainedModelExportPayload,
  parseAnnTrainedModelImportPayload,
  type AnnTrainedModelWorkerArtifacts,
} from '../src/lib/annTrainedModelExport';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';
import type { TrainingPipelineSnapshot } from '../src/lib/annPipeline';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';

const trainingSummary: AnnTrainingSummary = {
  inputKind: 'raw',
  selectedFeatureIds: ['energy'],
  inputDimension: 1,
  labeledSongCount: 4,
  classCount: 2,
  labelCounts: [
    { label: 'Left', count: 2 },
    { label: 'Right', count: 2 },
  ],
  warnings: [],
  hiddenLayers: 0,
  nodesPerLayer: [],
  activation: 'relu',
  optimizer: 'sgd',
  learningRate: 0.1,
  epochs: 2,
  splitRatio: 0.5,
  validationRatio: 0.5,
  batchSize: 2,
  seed: 7,
  finalLoss: 0.25,
  finalAccuracy: 0.75,
};

const pipelineSnapshot: TrainingPipelineSnapshot = {
  inputKind: 'raw',
  selectedFeatureIds: ['energy'],
  rawStructure: {
    featureKeys: ['energy'],
    keyValues: [],
    scaleValues: [],
    arrayLengths: {},
    columnLabels: ['energy'],
    isOHEColumn: [false],
  },
  rawMatrix: {
    vectors: [[0], [1], [2], [3]],
    songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
    columnLabels: ['energy'],
    isOHEColumn: [false],
  },
  processingStats: null,
  reduction: null,
  labelMap: { Left: 0, Right: 1 },
  songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
  inputDimension: 1,
};

const comparisonRun: AnnModelComparisonRun = {
  id: 'ann-train-1',
  runNumber: 1,
  trainedAt: '2026-06-17T10:00:00.000Z',
  inputKind: 'raw',
  inputDimension: 1,
  selectedFeatureIds: ['energy'],
  trainingAccuracy: 0.75,
  trainingLoss: 0.25,
  datasetAccuracy: 0.8,
  datasetCorrectPredictions: 4,
  datasetTotalSongs: 5,
  majorityBaselineAccuracy: 0.5,
  majorityBaselineDelta: 0.3,
  validationAccuracy: 0.7,
  validationCorrectPredictions: 7,
  validationTotalPredictions: 10,
  validationFoldCount: 4,
  validationLowConfidenceCount: 1,
  reviewStatus: 'keep',
  note: 'Portable model candidate.',
  warningCodes: ['small-training-set'],
};

const modelArtifacts: AnnTrainedModelWorkerArtifacts = {
  modelTopology: {
    class_name: 'Sequential',
    config: { name: 'sequential' },
  },
  weightSpecs: [
    { name: 'dense/kernel', shape: [1, 2], dtype: 'float32' },
  ],
  weightData: new Uint8Array([0, 1, 2, 255]).buffer,
  format: 'layers-model',
  generatedBy: 'TensorFlow.js',
  convertedBy: null,
};

const namedLists = {
  Left: new Set(['song-a', 'song-b']),
  Right: new Set(['song-c', 'song-d']),
};

test('createAnnTrainedModelExportPayload encodes model weights and pipeline context', () => {
  const payload = createAnnTrainedModelExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
    trainingSummary,
    pipelineSnapshot,
    modelInput: {
      inputKind: 'raw',
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      vectors: [[0], [1], [2], [3]],
    },
    modelArtifacts,
    outputLabels: ['Left', 'Right'],
    comparisonRun,
    namedLists,
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.kind, 'musiccluster-ann-trained-model');
  assert.equal(payload.model.weightDataBase64, 'AAEC/w==');
  assert.equal(payload.model.weightDataByteLength, 4);
  assert.deepEqual(payload.outputLabels, ['Left', 'Right']);
  assert.deepEqual(payload.training.inputKind, 'raw');
  assert.deepEqual(payload.pipeline.labelMap, { Left: 0, Right: 1 });
  assert.deepEqual(payload.modelInput.vectors, [[0], [1], [2], [3]]);
  assert.deepEqual(payload.labelAssignments, {
    assignedSongCount: 4,
    namedLists: {
      Left: ['song-a', 'song-b'],
      Right: ['song-c', 'song-d'],
    },
  });
  assert.deepEqual(payload.comparisonRun, comparisonRun);
  assert.match(payload.portabilityNote, /uploaded audio bytes/i);
});

test('parseAnnTrainedModelImportPayload decodes model artifacts and comparison context for worker import', () => {
  const payload = createAnnTrainedModelExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
    trainingSummary,
    pipelineSnapshot,
    modelInput: {
      inputKind: 'raw',
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      vectors: [[0], [1], [2], [3]],
    },
    modelArtifacts,
    outputLabels: ['Left', 'Right'],
    comparisonRun,
    namedLists,
  });

  const parsed = parseAnnTrainedModelImportPayload(JSON.stringify(payload));

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.trainingSummary, trainingSummary);
  assert.deepEqual(parsed.pipelineSnapshot, pipelineSnapshot);
  assert.deepEqual(parsed.modelInput.songIds, ['song-a', 'song-b', 'song-c', 'song-d']);
  assert.deepEqual(parsed.outputLabels, ['Left', 'Right']);
  assert.deepEqual(parsed.labelAssignments, {
    assignedSongCount: 4,
    namedLists: {
      Left: ['song-a', 'song-b'],
      Right: ['song-c', 'song-d'],
    },
  });
  assert.deepEqual(parsed.comparisonRun, comparisonRun);
  assert.deepEqual(Array.from(new Uint8Array(parsed.modelArtifacts.weightData)), [0, 1, 2, 255]);
});

test('parseAnnTrainedModelImportPayload rejects malformed portable model files', () => {
  assert.deepEqual(parseAnnTrainedModelImportPayload('not json'), {
    ok: false,
    reason: 'Trained model import is not valid JSON.',
  });

  const mismatchedLabels = createAnnTrainedModelExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
    trainingSummary,
    pipelineSnapshot,
    modelInput: {
      inputKind: 'raw',
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      vectors: [[0], [1], [2], [3]],
    },
    modelArtifacts,
    outputLabels: ['Left'],
    namedLists,
  });

  assert.deepEqual(parseAnnTrainedModelImportPayload(mismatchedLabels), {
    ok: false,
    reason: 'Trained model import output labels do not match the saved label map.',
  });

  const invalidAssignments = createAnnTrainedModelExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
    trainingSummary,
    pipelineSnapshot,
    modelInput: {
      inputKind: 'raw',
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      vectors: [[0], [1], [2], [3]],
    },
    modelArtifacts,
    outputLabels: ['Left', 'Right'],
    namedLists,
  });
  invalidAssignments.labelAssignments.namedLists.Left = ['song-a', 'missing-song'];

  assert.deepEqual(parseAnnTrainedModelImportPayload(invalidAssignments), {
    ok: false,
    reason: 'Trained model import label assignments do not match the saved model input rows.',
  });

  const invalidComparisonRun = createAnnTrainedModelExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
    trainingSummary,
    pipelineSnapshot,
    modelInput: {
      inputKind: 'raw',
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      vectors: [[0], [1], [2], [3]],
    },
    modelArtifacts,
    outputLabels: ['Left', 'Right'],
    comparisonRun,
    namedLists,
  });
  invalidComparisonRun.comparisonRun = {
    ...comparisonRun,
    inputKind: 'processed',
  };

  assert.deepEqual(parseAnnTrainedModelImportPayload(invalidComparisonRun), {
    ok: false,
    reason: 'Trained model import comparison context does not match the saved training metadata.',
  });
});

test('createAnnTrainedModelExportFilename creates a filesystem-safe filename', () => {
  assert.equal(
    createAnnTrainedModelExportFilename({
      exportedAt: '2026-06-17T12:00:01.234Z',
      runNumber: 4,
    }),
    'musiccluster-ann-trained-model-run-4-2026-06-17T12-00-01-234Z.json'
  );
});
