import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnTrainingSummary,
} from '../src/lib/annTrainingSummary';

test('getAnnTrainingSummary captures training inputs, label counts, config, seed, and final metrics', () => {
  const summary = getAnnTrainingSummary({
    inputKind: 'processed',
    selectedFeatureIds: ['mfcc', 'energy'],
    inputDimension: 12,
    trainingLabels: [
      'Rock', 'Jazz', 'Rock', 'Jazz', 'Rock', 'Jazz',
      'Rock', 'Jazz', 'Rock', 'Jazz', 'Rock', 'Jazz',
    ],
    networkConfig: {
      hiddenLayers: 2,
      nodesPerLayer: [16, 8],
      activation: 'relu',
      optimizer: 'adam',
      learningRate: 0.001,
      epochs: 40,
      splitRatio: 0.75,
      batchSize: 8,
    },
    seed: 1234,
    finalMetrics: {
      loss: 0.25,
      accuracy: 0.8,
    },
  });

  assert.deepEqual(summary, {
    inputKind: 'processed',
    selectedFeatureIds: ['mfcc', 'energy'],
    inputDimension: 12,
    labeledSongCount: 12,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 6 },
      { label: 'Jazz', count: 6 },
    ],
    warnings: [],
    hiddenLayers: 2,
    nodesPerLayer: [16, 8],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 40,
    splitRatio: 0.75,
    validationRatio: 0.25,
    batchSize: 8,
    seed: 1234,
    finalLoss: 0.25,
    finalAccuracy: 0.8,
  });
});

test('getAnnTrainingSummary preserves label order and omits absent final metrics', () => {
  const summary = getAnnTrainingSummary({
    inputKind: 'raw',
    selectedFeatureIds: ['key'],
    inputDimension: 4,
    trainingLabels: ['Ambient', 'Ambient', 'Noise'],
    networkConfig: {
      hiddenLayers: 0,
      nodesPerLayer: [],
      activation: 'tanh',
      optimizer: 'sgd',
      learningRate: 0.01,
      epochs: 5,
      splitRatio: 0.5,
      batchSize: 2,
    },
    seed: 99,
  });

  assert.deepEqual(summary.labelCounts, [
    { label: 'Ambient', count: 2 },
    { label: 'Noise', count: 1 },
  ]);
  assert.deepEqual(summary.warnings, [
    {
      code: 'small-training-set',
      message: 'Only 3 labeled songs are available. Treat accuracy as exploratory until there are at least 12 labeled songs.',
    },
    {
      code: 'under-sampled-labels',
      message: 'Some labels have fewer than 5 songs: Ambient (2), Noise (1). Per-label metrics may be unstable.',
    },
  ]);
  assert.equal(summary.finalLoss, undefined);
  assert.equal(summary.finalAccuracy, undefined);
  assert.equal(summary.validationRatio, 0.5);
});

test('getAnnTrainingSummary warns when a larger dataset still has under-sampled labels', () => {
  const summary = getAnnTrainingSummary({
    inputKind: 'reduced',
    selectedFeatureIds: ['mfcc'],
    inputDimension: 2,
    trainingLabels: [
      'Rock', 'Rock', 'Rock', 'Rock', 'Rock',
      'Jazz', 'Jazz', 'Jazz', 'Jazz', 'Jazz',
      'Noise', 'Noise',
    ],
    networkConfig: {
      hiddenLayers: 1,
      nodesPerLayer: [16],
      activation: 'relu',
      optimizer: 'adam',
      learningRate: 0.001,
      epochs: 10,
      splitRatio: 0.8,
      batchSize: 4,
    },
    seed: 7,
  });

  assert.deepEqual(summary.warnings, [
    {
      code: 'under-sampled-labels',
      message: 'Some labels have fewer than 5 songs: Noise (2). Per-label metrics may be unstable.',
    },
  ]);
});
