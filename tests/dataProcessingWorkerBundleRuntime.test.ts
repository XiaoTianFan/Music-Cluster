import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerBundleHarness } from './helpers/workerBundleHarness';

const vectors = [
  [1, 10, 1],
  [3, 20, 0],
  [5, 30, 1],
];
const songIds = ['song-a', 'song-b', 'song-c'];
const isOHEColumn = [false, false, true];

function toPlainMatrix(value: unknown): number[][] {
  assert.ok(Array.isArray(value), 'Expected a matrix array.');
  return value.map(row => {
    assert.ok(Array.isArray(row), 'Expected each matrix row to be an array.');
    return Array.from(row as number[]);
  });
}

test('generated data-processing worker bundle initializes, processes, and transforms data', async () => {
  const worker = createWorkerBundleHarness('data-processing-worker.bundled.js');

  await worker.send({
    type: 'init',
    requestId: 'bundle-init-123',
  });

  const ready = worker.messages.at(-1);
  assert.ok(ready);
  assert.equal(ready.type, 'dataProcessingWorkerReady');
  assert.equal(ready.requestId, 'bundle-init-123');
  assert.equal(ready.payload, true);

  await worker.send({
    type: 'processData',
    requestId: 'bundle-process-123',
    payload: {
      vectors,
      songIds,
      isOHEColumn,
      method: 'standardize',
    },
  });

  const processed = worker.messages.at(-1);
  assert.ok(processed);
  assert.equal(processed.type, 'processingComplete');
  assert.equal(processed.requestId, 'bundle-process-123');
  assert.deepEqual(Array.from(processed.payload.songIds), songIds);
  assert.deepEqual(Array.from(processed.payload.stats.means), [3, 20, 2 / 3]);
  assert.deepEqual(toPlainMatrix(processed.payload.processedVectors).map(row => row.map(value => Number(value.toFixed(6)))), [
    [-1.224745, -1.224745, 1],
    [0, 0, 0],
    [1.224745, 1.224745, 1],
  ]);

  await worker.send({
    type: 'transformData',
    requestId: 'bundle-transform-123',
    payload: {
      vectors: [[7, 40, 0]],
      songIds: ['uploaded'],
      isOHEColumn,
      method: 'standardize',
      means: Array.from(processed.payload.stats.means),
      stdDevs: Array.from(processed.payload.stats.stdDevs),
    },
  });

  const transformed = worker.messages.at(-1);
  assert.ok(transformed);
  assert.equal(transformed.type, 'transformComplete');
  assert.equal(transformed.requestId, 'bundle-transform-123');
  assert.deepEqual(Array.from(transformed.payload.songIds), ['uploaded']);
  assert.deepEqual(toPlainMatrix(transformed.payload.transformedVectors).map(row => row.map(value => Number(value.toFixed(6)))), [
    [2.44949, 2.44949, 0],
  ]);
});
