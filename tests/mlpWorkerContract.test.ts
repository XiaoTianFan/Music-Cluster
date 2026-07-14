import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MlpWorkerController,
  type MlpWorkerSendMessage,
  type TrainPayload,
} from '../src/lib/mlpWorkerContract';

function collectMessages() {
  const messages: MlpWorkerSendMessage[] = [];
  return {
    messages,
    postMessage(message: MlpWorkerSendMessage) {
      messages.push(message);
    },
  };
}

const trainingPayload: TrainPayload = {
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

test('MlpWorkerController emits mlpError when infer runs before training', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0]],
      songIds: ['song-a'],
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'mlpError');
  assert.match(sink.messages[0].payload.error, /Model not trained/);
});

test('MlpWorkerController emits training metrics, activations, and completion for valid training', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, sink.postMessage);

  assert.ok(sink.messages.some(message => message.type === 'epochMetrics'));
  assert.ok(sink.messages.some(message => message.type === 'activationSnapshot'));
  const complete = sink.messages.find(message => message.type === 'trainingComplete');
  assert.ok(complete);
  assert.equal(Number.isFinite(complete.payload.finalMetrics.loss), true);
  assert.equal(Number.isFinite(complete.payload.finalMetrics.accuracy), true);
  assert.ok(complete.payload.activationSnapshot.layers.length >= 2);

  controller.dispose();
});

test('MlpWorkerController can train against explicit validation rows for leave-one-out folds', async () => {
  const controller = new MlpWorkerController();
  const trainSink = collectMessages();
  const inferSink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    payload: {
      ...trainingPayload,
      vectors: [
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      labels: ['left', 'right', 'right'],
      validationVectors: [[0, 0]],
      validationLabels: ['left'],
      seed: 13,
    },
  }, trainSink.postMessage);

  const complete = trainSink.messages.find(message => message.type === 'trainingComplete');
  assert.ok(complete);
  assert.equal(Number.isFinite(complete.payload.finalMetrics.loss), true);
  assert.equal(Number.isFinite(complete.payload.finalMetrics.accuracy), true);

  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0]],
      songIds: ['left-held-out'],
    },
  }, inferSink.postMessage);

  assert.ok(inferSink.messages.some(message => message.type === 'inferenceComplete'));
  controller.dispose();
});

test('MlpWorkerController echoes requestId across the training lifecycle', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    requestId: 'train-123',
    payload: trainingPayload,
  } as any, sink.postMessage);

  assert.ok(sink.messages.length >= 3);
  assert.ok(sink.messages.every(message => (message as any).requestId === 'train-123'));

  controller.dispose();
});

test('MlpWorkerController infers labels after training', async () => {
  const controller = new MlpWorkerController();
  const trainSink = collectMessages();
  const inferSink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, trainSink.postMessage);
  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0], [1, 1]],
      songIds: ['song-a', 'song-d'],
    },
  }, inferSink.postMessage);

  const inference = inferSink.messages.find(message => message.type === 'inferenceComplete');
  assert.ok(inference);
  assert.deepEqual(Object.keys(inference.payload.results), ['song-a', 'song-d']);
  Object.values(inference.payload.results).forEach(result => {
    assert.match(result.predictedLabel, /left|right/);
    assert.equal(Number.isFinite(result.confidence), true);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });
  assert.ok(inferSink.messages.some(message => message.type === 'activationSnapshot'));

  controller.dispose();
});

test('MlpWorkerController exports and imports a trained model for later inference', async () => {
  const controller = new MlpWorkerController();
  const trainSink = collectMessages();
  const exportSink = collectMessages();
  const importSink = collectMessages();
  const inferSink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, trainSink.postMessage);
  await controller.handleMessage({ type: 'exportModel', requestId: 'export-123' } as any, exportSink.postMessage);

  const exported = exportSink.messages.find(message => message.type === 'modelExportComplete');
  assert.ok(exported);
  assert.equal((exported as any).requestId, 'export-123');
  assert.deepEqual(exported.payload.outputLabels, ['left', 'right']);
  assert.ok(exported.payload.modelArtifacts.modelTopology);
  assert.ok(Array.isArray(exported.payload.modelArtifacts.weightSpecs));
  assert.ok(exported.payload.modelArtifacts.weightData instanceof ArrayBuffer);
  assert.ok(exported.payload.modelArtifacts.weightData.byteLength > 0);

  await controller.handleMessage({ type: 'reset' }, collectMessages().postMessage);
  await controller.handleMessage({ type: 'importModel', requestId: 'import-123', payload: exported.payload } as any, importSink.postMessage);
  assert.equal(importSink.messages[0].type, 'modelImportComplete');
  assert.equal((importSink.messages[0] as any).requestId, 'import-123');

  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0], [1, 1]],
      songIds: ['song-a', 'song-d'],
    },
  }, inferSink.postMessage);

  const inference = inferSink.messages.find(message => message.type === 'inferenceComplete');
  assert.ok(inference);
  assert.deepEqual(Object.keys(inference.payload.results), ['song-a', 'song-d']);
  Object.values(inference.payload.results).forEach(result => {
    assert.match(result.predictedLabel, /left|right/);
    assert.equal(Number.isFinite(result.confidence), true);
  });

  controller.dispose();
});

test('MlpWorkerController rejects model export and import without complete artifacts', async () => {
  const controller = new MlpWorkerController();
  const exportSink = collectMessages();
  const importSink = collectMessages();

  await controller.handleMessage({ type: 'exportModel' } as any, exportSink.postMessage);
  assert.equal(exportSink.messages[0].type, 'mlpError');
  assert.match(exportSink.messages[0].payload.error, /Model not trained/);

  await controller.handleMessage({
    type: 'importModel',
    payload: {
      modelArtifacts: {
        modelTopology: null,
        weightSpecs: [],
        weightData: new ArrayBuffer(0),
      },
      outputLabels: ['left', 'right'],
    },
  } as any, importSink.postMessage);
  assert.equal(importSink.messages[0].type, 'mlpError');
  assert.match(importSink.messages[0].payload.error, /model artifacts/i);

  controller.dispose();
});

test('MlpWorkerController echoes requestId across the inference lifecycle', async () => {
  const controller = new MlpWorkerController();
  const trainSink = collectMessages();
  const inferSink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, trainSink.postMessage);
  await controller.handleMessage({
    type: 'infer',
    requestId: 'infer-123',
    payload: {
      vectors: [[0, 0]],
      songIds: ['song-a'],
    },
  } as any, inferSink.postMessage);

  assert.equal(inferSink.messages.length, 2);
  assert.ok(inferSink.messages.every(message => (message as any).requestId === 'infer-123'));

  controller.dispose();
});

test('MlpWorkerController reset clears trained inference state', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, sink.postMessage);
  await controller.handleMessage({ type: 'reset' }, sink.postMessage);
  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0]],
      songIds: ['song-a'],
    },
  }, sink.postMessage);

  assert.ok(sink.messages.some(message => message.type === 'mlpResetComplete'));
  const lastMessage = sink.messages[sink.messages.length - 1];
  assert.equal(lastMessage.type, 'mlpError');
  assert.match(lastMessage.payload.error, /Model not trained/);

  controller.dispose();
});

test('MlpWorkerController echoes requestId on reset and errors', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({ type: 'reset', requestId: 'reset-123' } as any, sink.postMessage);
  await controller.handleMessage({
    type: 'infer',
    requestId: 'infer-error-123',
    payload: {
      vectors: [[0, 0]],
      songIds: ['song-a'],
    },
  } as any, sink.postMessage);

  assert.equal(sink.messages[0].type, 'mlpResetComplete');
  assert.equal((sink.messages[0] as any).requestId, 'reset-123');
  assert.equal(sink.messages[1].type, 'mlpError');
  assert.equal((sink.messages[1] as any).requestId, 'infer-error-123');
});

test('MlpWorkerController emits mlpError for invalid inference vector shapes', async () => {
  const controller = new MlpWorkerController();
  const trainSink = collectMessages();
  const inferSink = collectMessages();

  await controller.handleMessage({ type: 'train', payload: trainingPayload }, trainSink.postMessage);
  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0], [1]],
      songIds: ['song-a', 'song-b'],
    },
  }, inferSink.postMessage);

  assert.equal(inferSink.messages.length, 1);
  assert.equal(inferSink.messages[0].type, 'mlpError');
  assert.match(inferSink.messages[0].payload.error, /Inference vectors/);

  controller.dispose();
});

test('MlpWorkerController emits mlpError for invalid training rows', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    payload: {
      ...trainingPayload,
      labels: ['left', 'left', 'right', 'unknown'],
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'mlpError');
  assert.match(sink.messages[0].payload.error, /Unknown label/);

  controller.dispose();
});
