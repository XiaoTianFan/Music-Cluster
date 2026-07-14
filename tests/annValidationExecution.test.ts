import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnValidationExecutionPlan,
  getAnnValidationExecutionSummary,
  runAnnValidationExecutionPlan,
} from '../src/lib/annValidationExecution';
import type { AnnTrainingDataset } from '../src/lib/annModelInputs';
import type { AnnValidationPlan } from '../src/lib/annValidationPlan';

const trainingDataset: AnnTrainingDataset = {
  trainingSongIds: ['rock-a', 'rock-b', 'jazz-a', 'jazz-b'],
  trainingVectors: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  trainingLabels: ['Rock', 'Rock', 'Jazz', 'Jazz'],
  labelMap: new Map([['Rock', 0], ['Jazz', 1]]),
  labelMapObject: { Rock: 0, Jazz: 1 },
  labelCounts: { Rock: 2, Jazz: 2 },
  activationSampleSongId: 'rock-a',
};

const leaveOneOutPlan: AnnValidationPlan = {
  strategy: 'leave-one-out',
  foldCount: 4,
  totalSongCount: 4,
  labelCount: 2,
  folds: [
    {
      foldNumber: 1,
      trainingSongIds: ['rock-b', 'jazz-a', 'jazz-b'],
      validationSongIds: ['rock-a'],
      validationLabelCounts: [{ label: 'Rock', count: 1 }],
    },
    {
      foldNumber: 2,
      trainingSongIds: ['rock-a', 'jazz-a', 'jazz-b'],
      validationSongIds: ['rock-b'],
      validationLabelCounts: [{ label: 'Rock', count: 1 }],
    },
    {
      foldNumber: 3,
      trainingSongIds: ['rock-a', 'rock-b', 'jazz-b'],
      validationSongIds: ['jazz-a'],
      validationLabelCounts: [{ label: 'Jazz', count: 1 }],
    },
    {
      foldNumber: 4,
      trainingSongIds: ['rock-a', 'rock-b', 'jazz-a'],
      validationSongIds: ['jazz-b'],
      validationLabelCounts: [{ label: 'Jazz', count: 1 }],
    },
  ],
};

test('createAnnValidationExecutionPlan builds explicit MLP train and infer payloads for each fold', () => {
  const result = createAnnValidationExecutionPlan({
    validationPlan: leaveOneOutPlan,
    trainingDataset,
    networkConfig: {
      config: {
        layers: 0,
        nodes: [],
        activation: 'relu',
        optimizer: 'sgd',
        learningRate: 0.1,
      },
      trainIterations: 3,
      batchSize: 2,
      splitRatio: 0.8,
      seed: 10,
    },
  });

  assert.ok(result.executionPlan);
  assert.equal(result.reason, null);
  assert.equal(result.executionPlan.foldCount, 4);
  assert.equal(result.executionPlan.totalValidationSongCount, 4);
  assert.deepEqual(result.executionPlan.folds[0].trainPayload.vectors, [[0, 1], [1, 0], [1, 1]]);
  assert.deepEqual(result.executionPlan.folds[0].trainPayload.labels, ['Rock', 'Jazz', 'Jazz']);
  assert.deepEqual(result.executionPlan.folds[0].trainPayload.validationVectors, [[0, 0]]);
  assert.deepEqual(result.executionPlan.folds[0].trainPayload.validationLabels, ['Rock']);
  assert.deepEqual(result.executionPlan.folds[0].inferPayload.vectors, [[0, 0]]);
  assert.deepEqual(result.executionPlan.folds[0].inferPayload.songIds, ['rock-a']);
  assert.deepEqual(result.executionPlan.folds[0].expectedLabels, { 'rock-a': 'Rock' });
  assert.equal(result.executionPlan.folds[0].trainPayload.seed, 10);
  assert.equal(result.executionPlan.folds[1].trainPayload.seed, 11);
});

test('createAnnValidationExecutionPlan rejects folds that reference missing current vectors', () => {
  const result = createAnnValidationExecutionPlan({
    validationPlan: {
      ...leaveOneOutPlan,
      folds: [
        {
          ...leaveOneOutPlan.folds[0],
          validationSongIds: ['missing-song'],
        },
      ],
    },
    trainingDataset,
    networkConfig: {
      config: {
        layers: 0,
        nodes: [],
        activation: 'relu',
        optimizer: 'sgd',
        learningRate: 0.1,
      },
      trainIterations: 3,
      batchSize: 2,
      splitRatio: 0.8,
    },
  });

  assert.equal(result.executionPlan, null);
  assert.match(result.reason, /missing-song/);
});

test('getAnnValidationExecutionSummary aggregates fold predictions and confidence', () => {
  const summary = getAnnValidationExecutionSummary({
    folds: [
      {
        foldNumber: 1,
        expectedLabels: { 'rock-a': 'Rock', 'jazz-a': 'Jazz' },
        results: {
          'rock-a': { predictedLabel: 'Rock', confidence: 0.92 },
          'jazz-a': { predictedLabel: 'Rock', confidence: 0.55 },
        },
      },
      {
        foldNumber: 2,
        expectedLabels: { 'rock-b': 'Rock' },
        results: {
          'rock-b': { predictedLabel: 'Rock', confidence: 0.88 },
        },
      },
    ],
  });

  assert.equal(summary.foldCount, 2);
  assert.equal(summary.totalPredictions, 3);
  assert.equal(summary.correctPredictions, 2);
  assert.equal(summary.accuracy, 2 / 3);
  assert.equal(summary.lowConfidenceCount, 1);
  assert.equal(summary.averageConfidence, (0.92 + 0.55 + 0.88) / 3);
});

test('runAnnValidationExecutionPlan trains and infers each fold sequentially', async () => {
  const planResult = createAnnValidationExecutionPlan({
    validationPlan: leaveOneOutPlan,
    trainingDataset,
    networkConfig: {
      config: {
        layers: 0,
        nodes: [],
        activation: 'relu',
        optimizer: 'sgd',
        learningRate: 0.1,
      },
      trainIterations: 3,
      batchSize: 2,
      splitRatio: 0.8,
      seed: 10,
    },
  });
  assert.ok(planResult.executionPlan);

  const order: string[] = [];
  const started: number[] = [];
  const completed: number[] = [];
  const result = await runAnnValidationExecutionPlan({
    executionPlan: planResult.executionPlan,
    trainFold: async fold => {
      order.push(`train-${fold.foldNumber}`);
      return { finalMetrics: { loss: 0.1 * fold.foldNumber, accuracy: 0.9 } };
    },
    inferFold: async fold => {
      order.push(`infer-${fold.foldNumber}`);
      return Object.fromEntries(
        Object.entries(fold.expectedLabels).map(([songId, label]) => [
          songId,
          { predictedLabel: label, confidence: 0.91 },
        ])
      );
    },
    onFoldStart: fold => started.push(fold.foldNumber),
    onFoldComplete: foldResult => completed.push(foldResult.foldNumber),
  });

  assert.deepEqual(order, [
    'train-1',
    'infer-1',
    'train-2',
    'infer-2',
    'train-3',
    'infer-3',
    'train-4',
    'infer-4',
  ]);
  assert.deepEqual(started, [1, 2, 3, 4]);
  assert.deepEqual(completed, [1, 2, 3, 4]);
  assert.equal(result.foldResults.length, 4);
  assert.deepEqual(result.foldResults[0].trainMetrics, { loss: 0.1, accuracy: 0.9 });
  assert.equal(result.summary.correctPredictions, 4);
  assert.equal(result.summary.totalPredictions, 4);
  assert.equal(result.summary.accuracy, 1);
});

test('runAnnValidationExecutionPlan reports the failing fold number', async () => {
  const planResult = createAnnValidationExecutionPlan({
    validationPlan: leaveOneOutPlan,
    trainingDataset,
    networkConfig: {
      config: {
        layers: 0,
        nodes: [],
        activation: 'relu',
        optimizer: 'sgd',
        learningRate: 0.1,
      },
      trainIterations: 3,
      batchSize: 2,
      splitRatio: 0.8,
    },
  });
  assert.ok(planResult.executionPlan);

  await assert.rejects(
    runAnnValidationExecutionPlan({
      executionPlan: planResult.executionPlan,
      trainFold: async fold => {
        if (fold.foldNumber === 2) throw new Error('training exploded');
        return {};
      },
      inferFold: async fold => Object.fromEntries(
        Object.entries(fold.expectedLabels).map(([songId, label]) => [
          songId,
          { predictedLabel: label, confidence: 0.91 },
        ])
      ),
    }),
    /Validation fold 2 failed: training exploded/
  );
});
