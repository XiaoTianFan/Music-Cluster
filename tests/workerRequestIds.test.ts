import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearActiveWorkerRequestId,
  createWorkerRequestId,
  isCurrentWorkerReply,
  isRequestScopedWorkerReply,
  shouldIgnoreRequestScopedReply,
} from '../src/lib/workerRequestIds';

test('createWorkerRequestId produces scoped, ordered IDs', () => {
  const first = createWorkerRequestId('ann-train', 12345);
  const second = createWorkerRequestId('ann-train', 12345);

  assert.match(first, /^ann-train-12345-\d+$/);
  assert.match(second, /^ann-train-12345-\d+$/);
  assert.notEqual(first, second);
});

test('isCurrentWorkerReply accepts only the active request id', () => {
  assert.equal(isCurrentWorkerReply({ requestId: 'current' }, 'current'), true);
  assert.equal(isCurrentWorkerReply({ requestId: 'stale' }, 'current'), false);
  assert.equal(isCurrentWorkerReply({}, 'current'), false);
  assert.equal(isCurrentWorkerReply({ requestId: '' }, 'current'), false);
  assert.equal(isCurrentWorkerReply({ requestId: 'current' }, null), false);
});

test('shouldIgnoreRequestScopedReply ignores stale scoped replies but not legacy unscoped messages', () => {
  assert.equal(shouldIgnoreRequestScopedReply({ requestId: 'stale' }, 'current'), true);
  assert.equal(shouldIgnoreRequestScopedReply({ requestId: 'current' }, 'current'), false);
  assert.equal(shouldIgnoreRequestScopedReply({}, 'current'), false);
  assert.equal(shouldIgnoreRequestScopedReply({ requestId: '' }, 'current'), false);
});

test('isRequestScopedWorkerReply requires a non-empty string request id', () => {
  assert.equal(isRequestScopedWorkerReply({ requestId: 'abc' }), true);
  assert.equal(isRequestScopedWorkerReply({ requestId: '' }), false);
  assert.equal(isRequestScopedWorkerReply({ requestId: null }), false);
  assert.equal(isRequestScopedWorkerReply({}), false);
});

test('clearActiveWorkerRequestId only clears completed or legacy active requests', () => {
  assert.equal(clearActiveWorkerRequestId('current', 'current'), null);
  assert.equal(clearActiveWorkerRequestId('current', undefined), null);
  assert.equal(clearActiveWorkerRequestId('current', null), null);
  assert.equal(clearActiveWorkerRequestId('current', 'stale'), 'current');
});
