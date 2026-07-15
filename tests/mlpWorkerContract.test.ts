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

  assert.ok(sink.messages.length >= 2);
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

test('MlpWorkerController avoids resending unchanged weights during inference', async () => {
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
  assert.ok(inferSink.messages.some(message => message.type === 'activationSnapshot'));
  assert.equal(inferSink.messages.some(message => message.type === 'modelStateSnapshot'), false);
  assert.ok(inferSink.messages.every(message => (message as any).requestId === 'infer-123'));

  controller.dispose();
});

test('MlpWorkerController bounds heavy visualization snapshots in automatic training', async () => {
  const controller = new MlpWorkerController();
  const sink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    payload: { ...trainingPayload, trainIterations: 25 },
  }, sink.postMessage);

  assert.equal(sink.messages.filter(message => message.type === 'epochMetrics').length, 25);
  assert.ok(sink.messages.filter(message => message.type === 'trainingSnapshot').length <= 10);
  assert.equal(sink.messages.filter(message => message.type === 'activationSnapshot').length, 0);
  assert.equal(sink.messages.filter(message => message.type === 'modelStateSnapshot').length, 0);
  assert.ok(sink.messages.some(message => message.type === 'trainingComplete'));

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

test('MlpWorkerController advances exactly one epoch and can continue beyond the original target', async () => {
  const controller = new MlpWorkerController();
  const startSink = collectMessages();
  const firstEpochSink = collectMessages();
  const secondEpochSink = collectMessages();
  const continueSink = collectMessages();
  const thirdEpochSink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    payload: { ...trainingPayload, trainIterations: 2, executionMode: 'epoch' },
  }, startSink.postMessage);
  const ready = startSink.messages.find(message => message.type === 'trainingSessionReady');
  assert.ok(ready);
  assert.equal(ready.payload.status.completedEpochs, 0);
  assert.equal(ready.payload.status.targetEpochs, 2);

  await controller.handleMessage({ type: 'advanceTraining' }, firstEpochSink.postMessage);
  const firstPause = firstEpochSink.messages.find(message => message.type === 'trainingPaused');
  assert.ok(firstPause);
  assert.equal(firstPause.payload.status.completedEpochs, 1);
  assert.deepEqual(
    firstEpochSink.messages.filter(message => message.type === 'epochMetrics').map(message => message.payload.epoch),
    [1]
  );

  await controller.handleMessage({ type: 'advanceTraining' }, secondEpochSink.postMessage);
  const secondComplete = secondEpochSink.messages.find(message => message.type === 'trainingComplete');
  assert.ok(secondComplete);
  assert.equal(secondComplete.payload.status.completedEpochs, 2);

  await controller.handleMessage({
    type: 'continueTraining',
    payload: { additionalEpochs: 1, executionMode: 'epoch' },
  }, continueSink.postMessage);
  const continued = continueSink.messages.find(message => message.type === 'trainingSessionReady');
  assert.ok(continued);
  assert.equal(continued.payload.status.completedEpochs, 2);
  assert.equal(continued.payload.status.targetEpochs, 3);

  await controller.handleMessage({ type: 'advanceTraining' }, thirdEpochSink.postMessage);
  const thirdComplete = thirdEpochSink.messages.find(message => message.type === 'trainingComplete');
  assert.ok(thirdComplete);
  assert.equal(thirdComplete.payload.status.completedEpochs, 3);

  controller.dispose();
});

test('MlpWorkerController switches managed execution modes and infers from a paused session', async () => {
  const controller = new MlpWorkerController();
  const startSink = collectMessages();

  await controller.handleMessage({
    type: 'train',
    payload: {
      ...trainingPayload,
      trainIterations: 2,
      executionMode: 'automatic',
      managedExecution: true,
    },
  }, startSink.postMessage);

  const ready = startSink.messages.find(message => message.type === 'trainingSessionReady');
  assert.ok(ready);
  assert.equal(ready.payload.status.completedEpochs, 0);
  assert.equal(startSink.messages.some(message => message.type === 'trainingComplete'), false);

  const automaticEpochSink = collectMessages();
  await controller.handleMessage({ type: 'advanceTraining' }, automaticEpochSink.postMessage);
  const automaticPause = automaticEpochSink.messages.find(message => message.type === 'trainingPaused');
  assert.ok(automaticPause);
  assert.equal(automaticPause.payload.status.completedEpochs, 1);

  const stepModeSink = collectMessages();
  await controller.handleMessage({
    type: 'setTrainingMode',
    payload: { executionMode: 'step' },
  }, stepModeSink.postMessage);
  const stepMode = stepModeSink.messages.find(message => message.type === 'trainingModeChanged');
  assert.ok(stepMode);
  assert.equal(stepMode.payload.status.mode, 'step');

  const inferSink = collectMessages();
  await controller.handleMessage({
    type: 'infer',
    payload: {
      vectors: [[0, 0], [1, 1]],
      songIds: ['song-a', 'song-b'],
    },
  }, inferSink.postMessage);
  assert.ok(inferSink.messages.some(message => message.type === 'inferenceComplete'));

  const epochModeSink = collectMessages();
  await controller.handleMessage({
    type: 'setTrainingMode',
    payload: { executionMode: 'epoch' },
  }, epochModeSink.postMessage);
  const epochMode = epochModeSink.messages.find(message => message.type === 'trainingModeChanged');
  assert.ok(epochMode);
  assert.equal(epochMode.payload.status.mode, 'epoch');

  const completionSink = collectMessages();
  await controller.handleMessage({ type: 'advanceTraining' }, completionSink.postMessage);
  const complete = completionSink.messages.find(message => message.type === 'trainingComplete');
  assert.ok(complete);
  assert.equal(complete.payload.status.completedEpochs, 2);

  const targetModeSink = collectMessages();
  await controller.handleMessage({
    type: 'setTrainingMode',
    payload: { executionMode: 'step' },
  }, targetModeSink.postMessage);
  const targetMode = targetModeSink.messages.find(message => message.type === 'trainingModeChanged');
  assert.ok(targetMode);
  assert.equal(targetMode.payload.status.mode, 'step');
  assert.match(targetMode.payload.status.nextAction, /Add epochs/);

  const continueSink = collectMessages();
  await controller.handleMessage({
    type: 'continueTraining',
    payload: { additionalEpochs: 1, executionMode: 'step', managedExecution: true },
  }, continueSink.postMessage);
  const continued = continueSink.messages.find(message => message.type === 'trainingSessionReady');
  assert.ok(continued);
  assert.equal(continued.payload.status.completedEpochs, 2);
  assert.equal(continued.payload.status.targetEpochs, 3);
  assert.equal(continued.payload.status.mode, 'step');

  controller.dispose();
});

test('MlpWorkerController exposes every internal phase, full activations, and updated weights', async () => {
  const controller = new MlpWorkerController();
  const startSink = collectMessages();
  const phaseMessages: MlpWorkerSendMessage[] = [];
  const stepPayload: TrainPayload = {
    ...trainingPayload,
    config: {
      ...trainingPayload.config,
      layers: 1,
      nodes: [70],
    },
    executionMode: 'step',
  };

  await controller.handleMessage({ type: 'train', payload: stepPayload }, startSink.postMessage);
  const ready = startSink.messages.find(message => message.type === 'trainingSessionReady');
  assert.ok(ready);
  const hiddenActivation = ready.payload.activationSnapshot.layers.find(layer => layer.name === 'hidden_1');
  assert.equal(hiddenActivation?.values?.length, 70);
  assert.equal(ready.payload.modelStateSnapshot.layers[0].weights.length, 2);
  assert.equal(ready.payload.modelStateSnapshot.layers[0].weights[0].length, 70);

  for (let step = 0; step < 7; step++) {
    const sink = collectMessages();
    await controller.handleMessage({ type: 'advanceTraining' }, sink.postMessage);
    phaseMessages.push(...sink.messages);
  }

  const phases = phaseMessages
    .filter(message => message.type === 'trainingPhase')
    .map(message => message.payload.phase);
  assert.deepEqual(phases, ['input', 'forward', 'forward', 'loss', 'backward', 'backward', 'update']);
  const update = phaseMessages.find(message => message.type === 'trainingPhase' && message.payload.phase === 'update') as
    | Extract<MlpWorkerSendMessage, { type: 'trainingPhase' }>
    | undefined;
  assert.ok(update);
  assert.equal(Number.isFinite(update.payload.meanAbsoluteWeightDelta), true);
  assert.ok((update.payload.meanAbsoluteWeightDelta ?? 0) > 0);
  const complete = phaseMessages.find(message => message.type === 'trainingComplete');
  assert.ok(complete);
  assert.equal(complete.payload.status.completedEpochs, 1);

  controller.dispose();
});
