import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStratifiedTrainValidationSplit,
  getLabelCounts,
  validateTrainingRows,
} from '../src/lib/mlpTraining';

const vectors = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 0],
  [2, 1],
];
const labels = ['rock', 'rock', 'jazz', 'jazz', 'classical', 'classical'];
const labelMap = { rock: 0, jazz: 1, classical: 2 };

test('getLabelCounts counts labels without mutating input labels', () => {
  assert.deepEqual(getLabelCounts(labels), {
    rock: 2,
    jazz: 2,
    classical: 2,
  });
  assert.deepEqual(labels, ['rock', 'rock', 'jazz', 'jazz', 'classical', 'classical']);
});

test('validateTrainingRows rejects unknown labels before tensors are allocated', () => {
  assert.throws(
    () => validateTrainingRows([[0], [1]], ['rock', 'unknown'], { rock: 0, jazz: 1 }),
    /Unknown label "unknown"/
  );
});

test('createStratifiedTrainValidationSplit keeps every class in train and validation sets', () => {
  const split = createStratifiedTrainValidationSplit(vectors, labels, labelMap, 0.8, 123);

  assert.equal(split.trainPairs.length, 3);
  assert.equal(split.validationPairs.length, 3);
  assert.deepEqual(getLabelCounts(split.trainPairs.map(pair => pair.label)), {
    rock: 1,
    jazz: 1,
    classical: 1,
  });
  assert.deepEqual(getLabelCounts(split.validationPairs.map(pair => pair.label)), {
    rock: 1,
    jazz: 1,
    classical: 1,
  });
  assert.deepEqual(vectors, [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
  ]);
});

test('createStratifiedTrainValidationSplit rejects labels with too few examples', () => {
  assert.throws(
    () => createStratifiedTrainValidationSplit([[0], [1], [2]], ['rock', 'rock', 'jazz'], { rock: 0, jazz: 1 }, 0.8, 123),
    /at least two samples per label/
  );
});
