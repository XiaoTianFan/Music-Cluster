import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerBundleHarness } from './helpers/workerBundleHarness';

const featureVectors = [
  [0, 0, 0],
  [1, 1, 0],
  [2, 0, 1],
  [3, 1, 1],
];
const nonPcaFeatureVectors = [
  [0, 0, 0],
  [1, 1, 0],
  [2, 0, 1],
  [3, 1, 1],
  [4, 0, 2],
  [5, 1, 2],
];
const nonPcaSongIds = ['song-a', 'song-b', 'song-c', 'song-d', 'song-e', 'song-f'];

function assertFiniteReductionRows(rows: number[][], expectedRows: number, expectedDimensions: number) {
  assert.equal(rows.length, expectedRows);
  rows.forEach(row => {
    assert.equal(row.length, expectedDimensions);
    row.forEach(value => assert.equal(Number.isFinite(value), true));
  });
}

test('generated Druid worker bundle loads its split vendor chunk and reduces PCA data', async () => {
  const worker = createWorkerBundleHarness('druid-worker.bundled.js');

  assert.equal(worker.messages[0]?.type, 'druidWorkerReady');

  await worker.send({
    type: 'reduceDimensions',
    requestId: 'bundle-reduce-123',
    payload: {
      featureVectors,
      songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
      method: 'pca',
      dimensions: 2,
    },
  });

  const response = worker.messages.at(-1);
  assert.ok(response);
  assert.equal(response.type, 'reductionComplete');
  assert.equal(response.requestId, 'bundle-reduce-123');
  assert.deepEqual(Array.from(response.payload.songIds), ['song-a', 'song-b', 'song-c', 'song-d']);
  assertFiniteReductionRows(response.payload.reducedData, 4, 2);
});

test('generated Druid worker bundle reduces t-SNE and UMAP data with request IDs', async () => {
  const worker = createWorkerBundleHarness('druid-worker.bundled.js');

  assert.equal(worker.messages[0]?.type, 'druidWorkerReady');

  for (const payload of [
    {
      method: 'tsne',
      requestId: 'bundle-reduce-tsne',
      extra: { perplexity: 2 },
    },
    {
      method: 'umap',
      requestId: 'bundle-reduce-umap',
      extra: { neighbors: 2, minDist: 0.1 },
    },
  ] as const) {
    const startIndex = worker.messages.length;

    await worker.send({
      type: 'reduceDimensions',
      requestId: payload.requestId,
      payload: {
        featureVectors: nonPcaFeatureVectors,
        songIds: nonPcaSongIds,
        method: payload.method,
        dimensions: 2,
        ...payload.extra,
      },
    });

    const response = worker.messages.slice(startIndex).at(-1);
    assert.ok(response);
    assert.equal(response.type, 'reductionComplete');
    assert.equal(response.requestId, payload.requestId);
    assert.deepEqual(Array.from(response.payload.songIds), nonPcaSongIds);
    assertFiniteReductionRows(response.payload.reducedData, nonPcaFeatureVectors.length, 2);
  }
});
