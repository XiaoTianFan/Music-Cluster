import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sendWorkerRequest,
  type WorkerMessageEvent,
  type WorkerMessageListener,
  type WorkerRequestTarget,
} from '../src/lib/workerRequestClient';

interface ReplyMessage {
  type: string;
  requestId?: string | null;
  payload?: {
    value?: number;
    error?: string;
  };
}

interface RequestMessage {
  type: string;
  requestId: string;
}

class FakeWorker implements WorkerRequestTarget<ReplyMessage, RequestMessage> {
  listeners = new Set<WorkerMessageListener<ReplyMessage>>();
  postedMessages: RequestMessage[] = [];
  onPostMessage?: (message: RequestMessage) => void;

  addEventListener(type: 'message', listener: WorkerMessageListener<ReplyMessage>): void {
    assert.equal(type, 'message');
    this.listeners.add(listener);
  }

  removeEventListener(type: 'message', listener: WorkerMessageListener<ReplyMessage>): void {
    assert.equal(type, 'message');
    this.listeners.delete(listener);
  }

  postMessage(message: RequestMessage): void {
    this.postedMessages.push(message);
    this.onPostMessage?.(message);
  }

  emit(data: ReplyMessage): void {
    const event: WorkerMessageEvent<ReplyMessage> = { data };
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}

test('sendWorkerRequest registers the listener before posting and resolves matching success replies', async () => {
  const worker = new FakeWorker();
  worker.onPostMessage = (message) => {
    worker.emit({
      type: 'done',
      requestId: message.requestId,
      payload: { value: 42 },
    });
  };

  const result = await sendWorkerRequest({
    worker,
    requestId: 'request-1',
    message: { type: 'work', requestId: 'request-1' },
    successTypes: ['done'],
    getResult: message => message.payload?.value ?? 0,
  });

  assert.equal(result, 42);
  assert.deepEqual(worker.postedMessages, [{ type: 'work', requestId: 'request-1' }]);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest ignores stale and unscoped replies until the current reply arrives', async () => {
  const worker = new FakeWorker();
  const pending = sendWorkerRequest({
    worker,
    requestId: 'current',
    message: { type: 'work', requestId: 'current' },
    successTypes: ['done'],
    getResult: message => message.payload?.value ?? 0,
  });

  worker.emit({ type: 'done', requestId: 'stale', payload: { value: 1 } });
  worker.emit({ type: 'done', payload: { value: 2 } });
  assert.equal(worker.listeners.size, 1);

  worker.emit({ type: 'done', requestId: 'current', payload: { value: 3 } });
  assert.equal(await pending, 3);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest rejects matching worker errors and reports payload error text', async () => {
  const worker = new FakeWorker();
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-2',
    message: { type: 'work', requestId: 'request-2' },
    successTypes: ['done'],
    errorTypes: ['failed'],
    getResult: () => 0,
  });

  worker.emit({ type: 'failed', requestId: 'request-2', payload: { error: 'Nope.' } });

  await assert.rejects(pending, /Nope\./);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest rejects when the success result parser throws', async () => {
  const worker = new FakeWorker();
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-parser-error',
    message: { type: 'work', requestId: 'request-parser-error' },
    successTypes: ['done'],
    getResult: () => {
      throw new Error('Malformed reply');
    },
  });

  worker.emit({ type: 'done', requestId: 'request-parser-error' });

  await assert.rejects(pending, /Malformed reply/);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest forwards matching progress replies without settling', async () => {
  const worker = new FakeWorker();
  const progressValues: number[] = [];
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-progress',
    message: { type: 'work', requestId: 'request-progress' },
    successTypes: ['done'],
    progressTypes: ['progress'],
    onProgress: message => progressValues.push(message.payload?.value ?? 0),
    getResult: message => message.payload?.value ?? 0,
  });

  worker.emit({ type: 'progress', requestId: 'stale-progress', payload: { value: 1 } });
  worker.emit({ type: 'progress', payload: { value: 2 } });
  worker.emit({ type: 'progress', requestId: 'request-progress', payload: { value: 3 } });

  assert.deepEqual(progressValues, [3]);
  assert.equal(worker.listeners.size, 1);

  worker.emit({ type: 'done', requestId: 'request-progress', payload: { value: 4 } });
  assert.equal(await pending, 4);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest rejects and cleans up when a progress handler throws', async () => {
  const worker = new FakeWorker();
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-progress-error',
    message: { type: 'work', requestId: 'request-progress-error' },
    successTypes: ['done'],
    progressTypes: ['progress'],
    onProgress: () => {
      throw new Error('Progress handler failed');
    },
    getResult: () => 'ok',
  });

  worker.emit({ type: 'progress', requestId: 'request-progress-error', payload: { value: 1 } });

  await assert.rejects(pending, /Progress handler failed/);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest rejects matching replies when the request is no longer active', async () => {
  const worker = new FakeWorker();
  const settledRequestIds: string[] = [];
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-superseded',
    message: { type: 'work', requestId: 'request-superseded' },
    successTypes: ['done'],
    getResult: () => 'ok',
    isRequestActive: requestId => requestId === 'request-superseded' && false,
    onSettled: requestId => settledRequestIds.push(requestId),
  });

  worker.emit({ type: 'done', requestId: 'request-superseded', payload: { value: 9 } });

  await assert.rejects(pending, /no longer active/);
  assert.deepEqual(settledRequestIds, ['request-superseded']);
  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest clears active state through onSettled', async () => {
  const worker = new FakeWorker();
  const settledRequestIds: string[] = [];
  const pending = sendWorkerRequest({
    worker,
    requestId: 'request-3',
    message: { type: 'work', requestId: 'request-3' },
    successTypes: ['done'],
    getResult: () => 'ok',
    onSettled: requestId => settledRequestIds.push(requestId),
  });

  worker.emit({ type: 'done', requestId: 'request-3' });

  assert.equal(await pending, 'ok');
  assert.deepEqual(settledRequestIds, ['request-3']);
});

test('sendWorkerRequest times out and removes its listener', async () => {
  const worker = new FakeWorker();

  await assert.rejects(sendWorkerRequest({
    worker,
    requestId: 'request-4',
    message: { type: 'work', requestId: 'request-4' },
    successTypes: ['done'],
    getResult: () => 'ok',
    timeoutMs: 1,
  }), /timed out/);

  assert.equal(worker.listeners.size, 0);
});

test('sendWorkerRequest removes its listener when postMessage throws', async () => {
  const worker = new FakeWorker();
  worker.onPostMessage = () => {
    throw new Error('post failed');
  };

  await assert.rejects(sendWorkerRequest({
    worker,
    requestId: 'request-5',
    message: { type: 'work', requestId: 'request-5' },
    successTypes: ['done'],
    getResult: () => 'ok',
  }), /post failed/);

  assert.equal(worker.listeners.size, 0);
});
