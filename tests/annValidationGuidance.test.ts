import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnValidationGuidance,
} from '../src/lib/annValidationGuidance';
import type { AnnEvaluationSummary } from '../src/lib/annEvaluation';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';

function createTrainingSummary(overrides: Partial<AnnTrainingSummary> = {}): AnnTrainingSummary {
  return {
    inputKind: 'processed',
    selectedFeatureIds: ['energy', 'rms'],
    inputDimension: 2,
    labeledSongCount: 12,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 6 },
      { label: 'Jazz', count: 6 },
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
    seed: 42,
    finalLoss: 0.125,
    finalAccuracy: 0.875,
    ...overrides,
  };
}

function createEvaluationSummary(overrides: Partial<AnnEvaluationSummary> = {}): AnnEvaluationSummary {
  return {
    actualLabels: ['Rock', 'Jazz'],
    predictedLabels: ['Rock', 'Jazz'],
    confusionMatrix: [
      [3, 1],
      [0, 4],
    ],
    rows: [
      {
        label: 'Rock',
        support: 4,
        predictedCount: 3,
        truePositive: 3,
        falsePositive: 0,
        falseNegative: 1,
        precision: 1,
        recall: 0.75,
        f1: 6 / 7,
      },
      {
        label: 'Jazz',
        support: 4,
        predictedCount: 5,
        truePositive: 4,
        falsePositive: 1,
        falseNegative: 0,
        precision: 0.8,
        recall: 1,
        f1: 8 / 9,
      },
    ],
    totalSongs: 8,
    predictedSongCount: 8,
    correctPredictions: 7,
    accuracy: 0.875,
    majorityBaselineLabel: 'Rock',
    majorityBaselineAccuracy: 0.5,
    missingPredictionCount: 0,
    unknownPredictionCount: 0,
    confidenceCount: 8,
    averageConfidence: 0.82,
    minConfidence: 0.61,
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 1,
    ...overrides,
  };
}

test('getAnnValidationGuidance recommends leave-one-out review for tiny datasets', () => {
  const guidance = getAnnValidationGuidance({
    trainingSummary: createTrainingSummary({
      labeledSongCount: 4,
      labelCounts: [
        { label: 'Rock', count: 2 },
        { label: 'Jazz', count: 2 },
      ],
    }),
    evaluationSummary: createEvaluationSummary({
      totalSongs: 4,
      confidenceCount: 4,
      lowConfidenceCount: 0,
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.riskLevel, 'exploratory');
  assert.equal(guidance.strategy, 'leave-one-out');
  assert.equal(guidance.foldCount, null);
  assert.match(guidance.headline, /Exploratory validation/);
  assert.match(guidance.recommendation, /leave-one-out/);
  assert.match(guidance.recommendation, /4 labeled songs/);
  assert.match(guidance.confidenceMessage, /All 4 evaluated predictions/);
});

test('getAnnValidationGuidance recommends stratified k-fold review for modest datasets', () => {
  const guidance = getAnnValidationGuidance({
    trainingSummary: createTrainingSummary({
      labeledSongCount: 18,
      labelCounts: [
        { label: 'Rock', count: 4 },
        { label: 'Jazz', count: 6 },
        { label: 'Ambient', count: 8 },
      ],
    }),
    evaluationSummary: createEvaluationSummary({
      confidenceCount: 12,
      lowConfidenceCount: 3,
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.riskLevel, 'limited');
  assert.equal(guidance.strategy, 'k-fold');
  assert.equal(guidance.foldCount, 4);
  assert.match(guidance.recommendation, /4-fold stratified review/);
  assert.match(guidance.confidenceMessage, /3\/12 evaluated predictions/);
});

test('getAnnValidationGuidance treats balanced larger datasets as holdout-ready', () => {
  const guidance = getAnnValidationGuidance({
    trainingSummary: createTrainingSummary({
      labeledSongCount: 40,
      labelCounts: [
        { label: 'Rock', count: 20 },
        { label: 'Jazz', count: 20 },
      ],
    }),
    evaluationSummary: null,
  });

  assert.ok(guidance);
  assert.equal(guidance.riskLevel, 'stronger');
  assert.equal(guidance.strategy, 'holdout');
  assert.equal(guidance.foldCount, null);
  assert.match(guidance.recommendation, /holdout split/);
  assert.match(guidance.confidenceMessage, /Run dataset inference/);
});
