import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleDataProcessingWorkerMessage,
  type DataProcessingWorkerSendMessage,
} from '../src/lib/dataProcessingWorkerContract';

function collectMessages() {
  const messages: DataProcessingWorkerSendMessage[] = [];
  return {
    messages,
    postMessage(message: DataProcessingWorkerSendMessage) {
      messages.push(message);
    },
  };
}

const vectors = [
  [1, 10, 1],
  [3, 20, 0],
  [5, 30, 1],
];
const songIds = ['song-a', 'song-b', 'song-c'];
const isOHEColumn = [false, false, true];

test('handleDataProcessingWorkerMessage emits readiness on init', () => {
  const sink = collectMessages();

  handleDataProcessingWorkerMessage({ type: 'init' }, sink.postMessage);

  assert.deepEqual(sink.messages, [
    { type: 'dataProcessingWorkerReady', payload: true },
  ]);
});

test('handleDataProcessingWorkerMessage emits processed vectors and stats', () => {
  const sink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'processData',
    payload: {
      vectors,
      songIds,
      isOHEColumn,
      method: 'standardize',
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  const message = sink.messages[0];
  assert.equal(message.type, 'processingComplete');
  assert.deepEqual(message.payload.songIds, songIds);
  assert.deepEqual(message.payload.stats.means, [3, 20, 2 / 3]);
  assert.deepEqual(message.payload.processedVectors.map(row => row.map(value => Number(value.toFixed(6)))), [
    [-1.224745, -1.224745, 1],
    [0, 0, 0],
    [1.224745, 1.224745, 1],
  ]);
});

test('handleDataProcessingWorkerMessage echoes requestId on process success and error', () => {
  const successSink = collectMessages();
  const errorSink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'processData',
    requestId: 'process-123',
    payload: {
      vectors,
      songIds,
      isOHEColumn,
      method: 'standardize',
    },
  } as any, successSink.postMessage);
  handleDataProcessingWorkerMessage({
    type: 'processData',
    requestId: 'process-456',
    payload: {
      vectors,
      songIds,
      isOHEColumn: [false, true],
      method: 'standardize',
    },
  } as any, errorSink.postMessage);

  assert.equal(successSink.messages[0].type, 'processingComplete');
  assert.equal((successSink.messages[0] as any).requestId, 'process-123');
  assert.equal(errorSink.messages[0].type, 'processingError');
  assert.equal((errorSink.messages[0] as any).requestId, 'process-456');
});

test('handleDataProcessingWorkerMessage emits processingError for invalid process input', () => {
  const sink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'processData',
    payload: {
      vectors,
      songIds,
      isOHEColumn: [false, true],
      method: 'standardize',
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'processingError');
  assert.match(sink.messages[0].payload.error, /OHE column definition/);
});

test('handleDataProcessingWorkerMessage emits transformed vectors from stored stats', () => {
  const sink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'transformData',
    payload: {
      vectors: [[7, 40, 0]],
      songIds: ['uploaded'],
      isOHEColumn,
      method: 'standardize',
      means: [3, 20, 2 / 3],
      stdDevs: [1.632993161855452, 8.16496580927726, 0.4714045207910317],
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  const message = sink.messages[0];
  assert.equal(message.type, 'transformComplete');
  assert.deepEqual(message.payload.songIds, ['uploaded']);
  assert.deepEqual(message.payload.transformedVectors.map(row => row.map(value => Number(value.toFixed(6)))), [
    [2.44949, 2.44949, 0],
  ]);
});

test('handleDataProcessingWorkerMessage echoes requestId on transform success and error', () => {
  const successSink = collectMessages();
  const errorSink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'transformData',
    requestId: 'transform-123',
    payload: {
      vectors: [[7, 40, 0]],
      songIds: ['uploaded'],
      isOHEColumn,
      method: 'standardize',
      means: [3, 20, 2 / 3],
      stdDevs: [1.632993161855452, 8.16496580927726, 0.4714045207910317],
    },
  } as any, successSink.postMessage);
  handleDataProcessingWorkerMessage({
    type: 'transformData',
    requestId: 'transform-456',
    payload: {
      vectors: [[7, 40, 0]],
      songIds: ['uploaded'],
      isOHEColumn,
      method: 'standardize',
    },
  } as any, errorSink.postMessage);

  assert.equal(successSink.messages[0].type, 'transformComplete');
  assert.equal((successSink.messages[0] as any).requestId, 'transform-123');
  assert.equal(errorSink.messages[0].type, 'transformError');
  assert.equal((errorSink.messages[0] as any).requestId, 'transform-456');
});

test('handleDataProcessingWorkerMessage emits transformError when stored stats are missing', () => {
  const sink = collectMessages();

  handleDataProcessingWorkerMessage({
    type: 'transformData',
    payload: {
      vectors: [[7, 40, 0]],
      songIds: ['uploaded'],
      isOHEColumn,
      method: 'standardize',
    },
  }, sink.postMessage);

  assert.equal(sink.messages.length, 1);
  assert.equal(sink.messages[0].type, 'transformError');
  assert.match(sink.messages[0].payload.error, /Standardization means/);
});
