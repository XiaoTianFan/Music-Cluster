import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleDruidWorkerMessage,
  type DruidWorkerSendMessage,
} from '../src/lib/druidWorkerContract';

const quietLogger = {
  log() {},
  warn() {},
  error() {},
};

function collectMessages() {
  const messages: DruidWorkerSendMessage[] = [];
  return {
    messages,
    postMessage(message: DruidWorkerSendMessage) {
      messages.push(message);
    },
  };
}

const featureVectors = [
  [0, 0, 0],
  [1, 1, 0],
  [2, 0, 1],
  [3, 1, 1],
];
const songIds = ['song-a', 'song-b', 'song-c', 'song-d'];

test('handleDruidWorkerMessage emits PCA reduction as plain vectors and echoes requestId', async () => {
  const sink = collectMessages();

  await handleDruidWorkerMessage({
    type: 'reduceDimensions',
    requestId: 'reduce-123',
    payload: {
      featureVectors,
      songIds,
      method: 'pca',
      dimensions: 2,
    },
  }, sink.postMessage, quietLogger);

  assert.equal(sink.messages.length, 1);
  const message = sink.messages[0];
  assert.equal(message.type, 'reductionComplete');
  assert.equal((message as any).requestId, 'reduce-123');
  assert.deepEqual(message.payload.songIds, songIds);
  assert.equal(message.payload.reducedData.length, songIds.length);
  message.payload.reducedData.forEach(row => {
    assert.ok(Array.isArray(row));
    assert.equal(row.length, 2);
    row.forEach(value => assert.equal(Number.isFinite(value), true));
  });
});

test('handleDruidWorkerMessage emits reductionError for invalid reduce inputs', async () => {
  const sink = collectMessages();

  await handleDruidWorkerMessage({
    type: 'reduceDimensions',
    requestId: 'reduce-error-123',
    payload: {
      featureVectors: [[0, 0], [1, 1]],
      songIds: ['song-a'],
      method: 'pca',
      dimensions: 2,
    },
  }, sink.postMessage, quietLogger);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'reductionError');
  assert.equal((sink.messages[0] as any).requestId, 'reduce-error-123');
  assert.match(sink.messages[0].payload.error, /Mismatch/);
});

test('handleDruidWorkerMessage transforms new PCA rows as plain vectors', async () => {
  const sink = collectMessages();

  await handleDruidWorkerMessage({
    type: 'transformNewData',
    requestId: 'transform-123',
    payload: {
      newVectors: [[4, 0, 1]],
      songIds: ['uploaded-song'],
      method: 'pca',
      dimensions: 2,
      trainingVectors: featureVectors,
    },
  }, sink.postMessage, quietLogger);

  assert.equal(sink.messages.length, 1);
  const message = sink.messages[0];
  assert.equal(message.type, 'transformNewDataComplete');
  assert.equal((message as any).requestId, 'transform-123');
  assert.deepEqual(message.payload.songIds, ['uploaded-song']);
  assert.equal(message.payload.reducedData.length, 1);
  assert.equal(message.payload.reducedData[0].length, 2);
  message.payload.reducedData[0].forEach(value => assert.equal(Number.isFinite(value), true));
});

test('handleDruidWorkerMessage emits reductionError for invalid transform inputs', async () => {
  const sink = collectMessages();

  await handleDruidWorkerMessage({
    type: 'transformNewData',
    requestId: 'transform-error-123',
    payload: {
      newVectors: [[4, 0]],
      songIds: ['uploaded-song'],
      method: 'pca',
      dimensions: 2,
      trainingVectors: featureVectors,
    },
  }, sink.postMessage, quietLogger);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'reductionError');
  assert.equal((sink.messages[0] as any).requestId, 'transform-error-123');
  assert.match(sink.messages[0].payload.error, /Dimension mismatch/);
});
