import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAnnMlpInferenceResults,
  getAnnMlpRouteMessageDisposition,
  getAnnWorkerErrorMessage,
} from '../src/lib/annMlpRouteMessages';

test('getAnnMlpRouteMessageDisposition leaves scoped request-client replies to sendWorkerRequest', () => {
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'trainingComplete', requestId: 'train-1' }, 'train-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'trainingPaused', requestId: 'train-step-1' }, 'train-step-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'modelStateSnapshot', requestId: 'train-step-1' }, 'train-step-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'trainingSnapshot', requestId: 'train-step-1' }, 'train-step-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'epochMetrics', requestId: 'train-1' }, 'train-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'trainingModeChanged', requestId: 'mode-1' }, 'train-1'),
    'request-client'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'mlpError', requestId: 'infer-1' }, 'infer-1'),
    'request-client'
  );
});

test('getAnnMlpRouteMessageDisposition ignores stale scoped legacy replies but handles active reset replies', () => {
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'mlpResetComplete', requestId: 'stale-reset' }, 'current-reset'),
    'stale'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'mlpResetComplete', requestId: 'current-reset' }, 'current-reset'),
    'legacy'
  );
  assert.equal(
    getAnnMlpRouteMessageDisposition({ type: 'mlpWorkerReady' }, 'current-reset'),
    'legacy'
  );
});

test('formatAnnMlpInferenceResults preserves confidence payloads and legacy string labels', () => {
  assert.deepEqual(formatAnnMlpInferenceResults({
    results: {
      'song-a': 'Rock',
      'song-b': { predictedLabel: 'Jazz', confidence: 0.82 },
      'song-c': { confidence: 0.4 },
    },
  }), {
    'song-a': { predictedLabel: 'Rock', confidence: 0 },
    'song-b': { predictedLabel: 'Jazz', confidence: 0.82 },
  });

  assert.deepEqual(formatAnnMlpInferenceResults(null), {});
});

test('getAnnWorkerErrorMessage returns payload errors with fallback text', () => {
  assert.equal(
    getAnnWorkerErrorMessage({ type: 'mlpError', payload: { error: 'No trained model.' } }, 'Fallback'),
    'No trained model.'
  );
  assert.equal(
    getAnnWorkerErrorMessage({ type: 'mlpError', payload: {} }, 'Fallback'),
    'Fallback'
  );
});
