import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processDataMatrix,
  transformDataMatrix,
} from '../src/lib/dataProcessing';

const vectors = [
  [1, 10, 1],
  [3, 20, 0],
  [5, 30, 1],
];
const isOHEColumn = [false, false, true];

test('processDataMatrix standardizes numeric columns while preserving OHE columns', () => {
  const result = processDataMatrix({ vectors, isOHEColumn, method: 'standardize' });

  assert.deepEqual(result.stats.means, [3, 20, 2 / 3]);
  assert.deepEqual(result.stats.stdDevs?.map(value => Number(value.toFixed(6))), [
    1.632993,
    8.164966,
    0.471405,
  ]);
  assert.deepEqual(result.processedVectors.map(row => row.map(value => Number(value.toFixed(6)))), [
    [-1.224745, -1.224745, 1],
    [0, 0, 0],
    [1.224745, 1.224745, 1],
  ]);
  assert.deepEqual(vectors, [
    [1, 10, 1],
    [3, 20, 0],
    [5, 30, 1],
  ]);
});

test('transformDataMatrix applies stored standardization stats to uploaded inference rows', () => {
  const processed = processDataMatrix({ vectors, isOHEColumn, method: 'standardize' });
  const transformed = transformDataMatrix({
    vectors: [[7, 40, 0]],
    isOHEColumn,
    method: 'standardize',
    means: processed.stats.means,
    stdDevs: processed.stats.stdDevs,
  });

  assert.deepEqual(transformed.map(row => row.map(value => Number(value.toFixed(6)))), [
    [2.44949, 2.44949, 0],
  ]);
});

test('processDataMatrix normalizes numeric columns into a target range while preserving OHE columns', () => {
  const result = processDataMatrix({ vectors, isOHEColumn, method: 'normalize', range: [-1, 1] });

  assert.deepEqual(result.stats.mins, [1, 10, 0]);
  assert.deepEqual(result.stats.maxs, [5, 30, 1]);
  assert.deepEqual(result.processedVectors, [
    [-1, -1, 1],
    [0, 0, 0],
    [1, 1, 1],
  ]);
});

test('transformDataMatrix applies stored normalization stats to uploaded inference rows', () => {
  const processed = processDataMatrix({ vectors, isOHEColumn, method: 'normalize', range: [-1, 1] });
  const transformed = transformDataMatrix({
    vectors: [[7, 40, 0]],
    isOHEColumn,
    method: 'normalize',
    range: [-1, 1],
    mins: processed.stats.mins,
    maxs: processed.stats.maxs,
  });

  assert.deepEqual(transformed, [[2, 2, 0]]);
});

test('processDataMatrix rejects OHE metadata with the wrong column count', () => {
  assert.throws(
    () => processDataMatrix({ vectors, isOHEColumn: [false, true], method: 'standardize' }),
    /OHE column definition/
  );
});
