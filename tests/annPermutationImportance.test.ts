import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnPermutationImportancePlan,
  getAnnPermutationImportanceSummary,
} from '../src/lib/annPermutationImportance';
import type { AnnEvaluationSummary } from '../src/lib/annEvaluation';

const baselineEvaluation: AnnEvaluationSummary = {
  actualLabels: ['Rock', 'Jazz'],
  predictedLabels: ['Rock', 'Jazz'],
  confusionMatrix: [
    [2, 0],
    [0, 2],
  ],
  rows: [
    {
      label: 'Rock',
      support: 2,
      predictedCount: 2,
      truePositive: 2,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    },
    {
      label: 'Jazz',
      support: 2,
      predictedCount: 2,
      truePositive: 2,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    },
  ],
  totalSongs: 4,
  predictedSongCount: 4,
  correctPredictions: 4,
  accuracy: 1,
  majorityBaselineLabel: 'Rock',
  majorityBaselineAccuracy: 0.5,
  missingPredictionCount: 0,
  unknownPredictionCount: 0,
  confidenceCount: 4,
  averageConfidence: 0.9,
  minConfidence: 0.8,
  lowConfidenceThreshold: 0.7,
  lowConfidenceCount: 0,
};

const namedLists = {
  Rock: new Set(['song-a', 'song-b']),
  Jazz: new Set(['song-c', 'song-d']),
};

test('createAnnPermutationImportancePlan perturbs each input dimension deterministically', () => {
  const plan = createAnnPermutationImportancePlan({
    inputKind: 'raw',
    songIds: ['song-a', 'song-b', 'song-c'],
    vectors: [
      [1, 10],
      [2, 20],
      [3, 30],
    ],
    dimensionLabels: ['energy', 'rms'],
  });

  assert.ok(plan);
  assert.equal(plan.inputKind, 'raw');
  assert.equal(plan.dimensionCount, 2);
  assert.equal(plan.tasks.length, 2);
  assert.deepEqual(plan.tasks[0], {
    dimensionIndex: 0,
    dimensionLabel: 'energy',
    songIds: ['song-a', 'song-b', 'song-c'],
    vectors: [
      [2, 10],
      [3, 20],
      [1, 30],
    ],
  });
  assert.deepEqual(plan.tasks[1].vectors, [
    [1, 20],
    [2, 30],
    [3, 10],
  ]);
});

test('createAnnPermutationImportancePlan rejects malformed inputs', () => {
  assert.equal(createAnnPermutationImportancePlan({
    inputKind: 'processed',
    songIds: ['song-a', 'song-b'],
    vectors: [[1, 2], [3]],
    dimensionLabels: ['x', 'y'],
  }), null);

  assert.equal(createAnnPermutationImportancePlan({
    inputKind: 'raw',
    songIds: ['song-a'],
    vectors: [[1]],
    dimensionLabels: ['energy'],
  }), null);
});

test('getAnnPermutationImportanceSummary ranks dimensions by dataset accuracy drop', () => {
  const plan = createAnnPermutationImportancePlan({
    inputKind: 'raw',
    songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
    vectors: [
      [1, 10],
      [2, 12],
      [5, 11],
      [6, 13],
    ],
    dimensionLabels: ['energy', 'rms'],
  });
  assert.ok(plan);

  const summary = getAnnPermutationImportanceSummary({
    plan,
    namedLists,
    baselineEvaluation,
    permutedResultsByDimension: {
      0: {
        'song-a': { predictedLabel: 'Jazz', confidence: 0.82 },
        'song-b': { predictedLabel: 'Rock', confidence: 0.9 },
        'song-c': { predictedLabel: 'Jazz', confidence: 0.91 },
        'song-d': { predictedLabel: 'Rock', confidence: 0.74 },
      },
      1: {
        'song-a': { predictedLabel: 'Rock', confidence: 0.93 },
        'song-b': { predictedLabel: 'Rock', confidence: 0.9 },
        'song-c': { predictedLabel: 'Jazz', confidence: 0.88 },
        'song-d': { predictedLabel: 'Jazz', confidence: 0.86 },
      },
    },
  });

  assert.ok(summary);
  assert.equal(summary.inputKind, 'raw');
  assert.equal(summary.baselineAccuracy, 1);
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.rows[0].dimensionLabel, 'energy');
  assert.equal(summary.rows[0].permutedAccuracy, 0.5);
  assert.equal(summary.rows[0].accuracyDrop, 0.5);
  assert.equal(summary.rows[0].accuracyDropLabel, '50.0 pts drop');
  assert.equal(summary.rows[0].impactLabel, 'High impact');
  assert.equal(summary.rows[0].baselineAverageConfidence, 0.9);
  assert.equal(summary.rows[0].permutedAverageConfidence, 0.8425);
  assert.ok(summary.rows[0].confidenceDrop !== null);
  assert.ok(Math.abs(summary.rows[0].confidenceDrop - 0.0575) < 1e-12);
  assert.equal(summary.rows[0].confidenceDropLabel, '5.8 pts confidence drop');
  assert.equal(summary.rows[0].lowConfidenceDelta, 0);
  assert.equal(summary.rows[1].dimensionLabel, 'rms');
  assert.equal(summary.rows[1].accuracyDrop, 0);
  assert.equal(summary.rows[1].impactLabel, 'No measured drop');
  assert.equal(summary.summary, 'Top impact: energy drops dataset accuracy by 50.0 pts when permuted.');
});

test('getAnnPermutationImportanceSummary highlights confidence drops when accuracy is unchanged', () => {
  const plan = createAnnPermutationImportancePlan({
    inputKind: 'raw',
    songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
    vectors: [
      [1, 10],
      [2, 12],
      [5, 11],
      [6, 13],
    ],
    dimensionLabels: ['energy', 'rms'],
  });
  assert.ok(plan);

  const summary = getAnnPermutationImportanceSummary({
    plan,
    namedLists,
    baselineEvaluation,
    permutedResultsByDimension: {
      0: {
        'song-a': { predictedLabel: 'Rock', confidence: 0.62 },
        'song-b': { predictedLabel: 'Rock', confidence: 0.61 },
        'song-c': { predictedLabel: 'Jazz', confidence: 0.6 },
        'song-d': { predictedLabel: 'Jazz', confidence: 0.59 },
      },
      1: {
        'song-a': { predictedLabel: 'Rock', confidence: 0.86 },
        'song-b': { predictedLabel: 'Rock', confidence: 0.88 },
        'song-c': { predictedLabel: 'Jazz', confidence: 0.85 },
        'song-d': { predictedLabel: 'Jazz', confidence: 0.87 },
      },
    },
  });

  assert.ok(summary);
  assert.equal(summary.rows[0].dimensionLabel, 'energy');
  assert.equal(summary.rows[0].accuracyDrop, 0);
  assert.equal(summary.rows[0].confidenceDrop, 0.29500000000000004);
  assert.equal(summary.rows[0].confidenceDropLabel, '29.5 pts confidence drop');
  assert.equal(summary.rows[0].lowConfidenceDelta, 4);
  assert.equal(
    summary.summary,
    'No accuracy drop; energy lowered average confidence by 29.5 pts when permuted.'
  );
});
