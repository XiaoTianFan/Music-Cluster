import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnEvaluationSummary,
} from '../src/lib/annEvaluation';

test('getAnnEvaluationSummary computes accuracy, baseline, confusion matrix, and per-label metrics', () => {
  const summary = getAnnEvaluationSummary({
    namedLists: {
      Rock: new Set(['song-a', 'song-b']),
      Jazz: new Set(['song-c', 'song-d']),
    },
    inferenceResults: {
      'song-a': { predictedLabel: 'Rock', confidence: 0.9 },
      'song-b': { predictedLabel: 'Jazz', confidence: 0.6 },
      'song-c': { predictedLabel: 'Jazz', confidence: 0.8 },
      'song-d': { predictedLabel: 'Rock', confidence: 0.7 },
    },
  });

  assert.ok(summary);
  assert.deepEqual(summary.actualLabels, ['Rock', 'Jazz']);
  assert.deepEqual(summary.predictedLabels, ['Rock', 'Jazz']);
  assert.deepEqual(summary.confusionMatrix, [
    [1, 1],
    [1, 1],
  ]);
  assert.equal(summary.totalSongs, 4);
  assert.equal(summary.correctPredictions, 2);
  assert.equal(summary.accuracy, 0.5);
  assert.equal(summary.majorityBaselineAccuracy, 0.5);
  assert.equal(summary.majorityBaselineLabel, 'Rock');
  assert.equal(summary.missingPredictionCount, 0);
  assert.equal(summary.unknownPredictionCount, 0);
  assert.equal(summary.confidenceCount, 4);
  assert.equal(summary.averageConfidence, 0.75);
  assert.equal(summary.minConfidence, 0.6);
  assert.equal(summary.lowConfidenceThreshold, 0.7);
  assert.equal(summary.lowConfidenceCount, 1);
  assert.deepEqual(summary.rows.map(row => ({
    label: row.label,
    support: row.support,
    predictedCount: row.predictedCount,
    truePositive: row.truePositive,
    falsePositive: row.falsePositive,
    falseNegative: row.falseNegative,
    precision: row.precision,
    recall: row.recall,
    f1: row.f1,
  })), [
    {
      label: 'Rock',
      support: 2,
      predictedCount: 2,
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    },
    {
      label: 'Jazz',
      support: 2,
      predictedCount: 2,
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    },
  ]);
});

test('getAnnEvaluationSummary counts missing and unknown predictions without inventing correctness', () => {
  const summary = getAnnEvaluationSummary({
    namedLists: {
      Rock: new Set(['song-a', 'song-b']),
      Jazz: new Set(['song-c']),
    },
    inferenceResults: {
      'song-a': { predictedLabel: 'Rock', confidence: 0.9 },
      'song-b': { predictedLabel: 'Metal', confidence: 0.6 },
    },
  });

  assert.ok(summary);
  assert.deepEqual(summary.actualLabels, ['Rock', 'Jazz']);
  assert.deepEqual(summary.predictedLabels, ['Rock', 'Jazz', 'Metal']);
  assert.deepEqual(summary.confusionMatrix, [
    [1, 0, 1],
    [0, 0, 0],
  ]);
  assert.equal(summary.totalSongs, 3);
  assert.equal(summary.correctPredictions, 1);
  assert.equal(summary.accuracy, 1 / 3);
  assert.equal(summary.majorityBaselineAccuracy, 2 / 3);
  assert.equal(summary.majorityBaselineLabel, 'Rock');
  assert.equal(summary.missingPredictionCount, 1);
  assert.equal(summary.unknownPredictionCount, 1);
  assert.equal(summary.confidenceCount, 2);
  assert.equal(summary.averageConfidence, 0.75);
  assert.equal(summary.minConfidence, 0.6);
  assert.equal(summary.lowConfidenceCount, 1);
  assert.equal(summary.rows[0].precision, 1);
  assert.equal(summary.rows[0].recall, 0.5);
  assert.equal(summary.rows[0].falseNegative, 1);
  assert.equal(summary.rows[1].precision, null);
  assert.equal(summary.rows[1].recall, 0);
  assert.equal(summary.rows[1].falseNegative, 1);
});

test('getAnnEvaluationSummary returns null when there are no labeled songs', () => {
  assert.equal(getAnnEvaluationSummary({
    namedLists: {
      Empty: new Set(),
    },
    inferenceResults: {
      'song-a': { predictedLabel: 'Rock', confidence: 0.9 },
    },
  }), null);
});

test('getAnnEvaluationSummary reports unavailable confidence metrics for legacy predictions', () => {
  const summary = getAnnEvaluationSummary({
    namedLists: {
      Rock: new Set(['song-a']),
      Jazz: new Set(['song-b']),
    },
    inferenceResults: {
      'song-a': { predictedLabel: 'Rock' },
      'song-b': { predictedLabel: 'Jazz' },
    },
  });

  assert.ok(summary);
  assert.equal(summary.confidenceCount, 0);
  assert.equal(summary.averageConfidence, null);
  assert.equal(summary.minConfidence, null);
  assert.equal(summary.lowConfidenceThreshold, 0.7);
  assert.equal(summary.lowConfidenceCount, 0);
});
