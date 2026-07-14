import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerBundleHarness } from './helpers/workerBundleHarness';

const trainingPayload = {
  vectors: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  labels: ['left', 'left', 'right', 'right'],
  labelMap: { left: 0, right: 1 },
  config: {
    layers: 0,
    nodes: [],
    activation: 'relu',
    optimizer: 'sgd',
    learningRate: 0.1,
  },
  trainIterations: 1,
  batchSize: 2,
  splitRatio: 0.5,
  seed: 7,
  activationSampleSongId: 'song-a',
};

test('generated MLP worker bundle trains, exports, imports, infers, and resets with request IDs', async () => {
  const worker = createWorkerBundleHarness('mlp-worker.bundled.js');

  assert.equal(worker.messages[0]?.type, 'mlpWorkerReady');

  await worker.send({
    type: 'infer',
    requestId: 'bundle-infer-before-train',
    payload: {
      vectors: [[0, 0]],
      songIds: ['song-a'],
    },
  });

  const inferBeforeTrain = worker.messages.at(-1);
  assert.ok(inferBeforeTrain);
  assert.equal(inferBeforeTrain.type, 'mlpError');
  assert.equal(inferBeforeTrain.requestId, 'bundle-infer-before-train');
  assert.match(inferBeforeTrain.payload.error, /Model not trained/);

  const trainStartIndex = worker.messages.length;
  await worker.send({
    type: 'train',
    requestId: 'bundle-train-123',
    payload: trainingPayload,
  });
  const trainMessages = worker.messages.slice(trainStartIndex);

  assert.ok(trainMessages.length >= 3);
  assert.ok(trainMessages.every(message => message.requestId === 'bundle-train-123'));
  assert.ok(trainMessages.some(message => message.type === 'epochMetrics'));
  assert.ok(trainMessages.some(message => message.type === 'activationSnapshot'));
  const trainingComplete = trainMessages.find(message => message.type === 'trainingComplete');
  assert.ok(trainingComplete);
  assert.equal(Number.isFinite(trainingComplete.payload.finalMetrics.loss), true);
  assert.equal(Number.isFinite(trainingComplete.payload.finalMetrics.accuracy), true);
  assert.ok(trainingComplete.payload.activationSnapshot.layers.length >= 2);

  await worker.send({
    type: 'exportModel',
    requestId: 'bundle-export-model-123',
  });
  const exported = worker.messages.at(-1);
  assert.ok(exported);
  assert.equal(exported.type, 'modelExportComplete');
  assert.equal(exported.requestId, 'bundle-export-model-123');
  assert.deepEqual(Array.from(exported.payload.outputLabels), ['left', 'right']);
  assert.ok(exported.payload.modelArtifacts.modelTopology);
  assert.ok(Array.isArray(exported.payload.modelArtifacts.weightSpecs));
  assert.ok(exported.payload.modelArtifacts.weightData instanceof ArrayBuffer);
  assert.ok(exported.payload.modelArtifacts.weightData.byteLength > 0);

  await worker.send({
    type: 'reset',
    requestId: 'bundle-reset-before-import-123',
  });
  const resetBeforeImport = worker.messages.at(-1);
  assert.ok(resetBeforeImport);
  assert.equal(resetBeforeImport.type, 'mlpResetComplete');
  assert.equal(resetBeforeImport.requestId, 'bundle-reset-before-import-123');

  await worker.send({
    type: 'importModel',
    requestId: 'bundle-import-model-123',
    payload: exported.payload,
  });
  const imported = worker.messages.at(-1);
  assert.ok(imported);
  assert.equal(imported.type, 'modelImportComplete');
  assert.equal(imported.requestId, 'bundle-import-model-123');
  assert.deepEqual(Array.from(imported.payload.outputLabels), ['left', 'right']);

  const inferStartIndex = worker.messages.length;
  await worker.send({
    type: 'infer',
    requestId: 'bundle-infer-123',
    payload: {
      vectors: [[0, 0], [1, 1]],
      songIds: ['song-a', 'song-d'],
    },
  });
  const inferMessages = worker.messages.slice(inferStartIndex);

  assert.equal(inferMessages.length, 2);
  assert.ok(inferMessages.every(message => message.requestId === 'bundle-infer-123'));
  assert.equal(inferMessages[0].type, 'activationSnapshot');
  assert.equal(inferMessages[1].type, 'inferenceComplete');
  assert.deepEqual(Object.keys(inferMessages[1].payload.results), ['song-a', 'song-d']);
  Object.values(inferMessages[1].payload.results).forEach((result: any) => {
    assert.match(result.predictedLabel, /left|right/);
    assert.equal(Number.isFinite(result.confidence), true);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });

  await worker.send({
    type: 'reset',
    requestId: 'bundle-reset-123',
  });

  const reset = worker.messages.at(-1);
  assert.ok(reset);
  assert.equal(reset.type, 'mlpResetComplete');
  assert.equal(reset.requestId, 'bundle-reset-123');
});
