import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnValidationPlan,
} from '../src/lib/annValidationPlan';

const tinyItems = [
  { songId: 'rock-a', label: 'Rock' },
  { songId: 'rock-b', label: 'Rock' },
  { songId: 'jazz-a', label: 'Jazz' },
  { songId: 'jazz-b', label: 'Jazz' },
];

test('createAnnValidationPlan builds deterministic leave-one-out folds', () => {
  const result = createAnnValidationPlan({
    items: tinyItems,
    strategy: 'leave-one-out',
  });

  assert.ok(result.plan);
  assert.equal(result.reason, null);
  assert.equal(result.plan.strategy, 'leave-one-out');
  assert.equal(result.plan.foldCount, 4);
  assert.deepEqual(result.plan.folds.map(fold => fold.validationSongIds), [
    ['rock-a'],
    ['rock-b'],
    ['jazz-a'],
    ['jazz-b'],
  ]);
  assert.deepEqual(result.plan.folds[0].trainingSongIds, ['rock-b', 'jazz-a', 'jazz-b']);
  assert.deepEqual(result.plan.folds[0].validationLabelCounts, [{ label: 'Rock', count: 1 }]);
});

test('createAnnValidationPlan builds stratified k-fold validation with every label represented', () => {
  const result = createAnnValidationPlan({
    items: [
      { songId: 'rock-a', label: 'Rock' },
      { songId: 'rock-b', label: 'Rock' },
      { songId: 'rock-c', label: 'Rock' },
      { songId: 'rock-d', label: 'Rock' },
      { songId: 'jazz-a', label: 'Jazz' },
      { songId: 'jazz-b', label: 'Jazz' },
      { songId: 'jazz-c', label: 'Jazz' },
      { songId: 'jazz-d', label: 'Jazz' },
    ],
    strategy: 'k-fold',
    foldCount: 4,
  });

  assert.ok(result.plan);
  assert.equal(result.reason, null);
  assert.equal(result.plan.strategy, 'k-fold');
  assert.equal(result.plan.foldCount, 4);
  assert.equal(result.plan.totalSongCount, 8);
  assert.deepEqual(result.plan.folds.map(fold => fold.validationLabelCounts), [
    [{ label: 'Rock', count: 1 }, { label: 'Jazz', count: 1 }],
    [{ label: 'Rock', count: 1 }, { label: 'Jazz', count: 1 }],
    [{ label: 'Rock', count: 1 }, { label: 'Jazz', count: 1 }],
    [{ label: 'Rock', count: 1 }, { label: 'Jazz', count: 1 }],
  ]);
  assert.deepEqual(result.plan.folds[2].validationSongIds, ['rock-c', 'jazz-c']);
});

test('createAnnValidationPlan builds a single stratified holdout fold', () => {
  const result = createAnnValidationPlan({
    items: [
      { songId: 'rock-a', label: 'Rock' },
      { songId: 'rock-b', label: 'Rock' },
      { songId: 'rock-c', label: 'Rock' },
      { songId: 'rock-d', label: 'Rock' },
      { songId: 'rock-e', label: 'Rock' },
      { songId: 'jazz-a', label: 'Jazz' },
      { songId: 'jazz-b', label: 'Jazz' },
      { songId: 'jazz-c', label: 'Jazz' },
      { songId: 'jazz-d', label: 'Jazz' },
      { songId: 'jazz-e', label: 'Jazz' },
    ],
    strategy: 'holdout',
    validationRatio: 0.4,
  });

  assert.ok(result.plan);
  assert.equal(result.reason, null);
  assert.equal(result.plan.strategy, 'holdout');
  assert.equal(result.plan.foldCount, 1);
  assert.deepEqual(result.plan.folds[0].validationSongIds, ['rock-a', 'rock-b', 'jazz-a', 'jazz-b']);
  assert.deepEqual(result.plan.folds[0].trainingSongIds, ['rock-c', 'rock-d', 'rock-e', 'jazz-c', 'jazz-d', 'jazz-e']);
});

test('createAnnValidationPlan rejects labels that cannot keep a training sample after validation', () => {
  const result = createAnnValidationPlan({
    items: [
      { songId: 'rock-a', label: 'Rock' },
      { songId: 'rock-b', label: 'Rock' },
      { songId: 'jazz-a', label: 'Jazz' },
    ],
    strategy: 'leave-one-out',
  });

  assert.equal(result.plan, null);
  assert.match(result.reason, /Jazz has only 1 labeled song/);
});
