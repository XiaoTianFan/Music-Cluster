import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEssentiaFeatureExtractionError,
  getEssentiaFeatureExtractionResult,
  withEssentiaRequestId,
} from '../src/lib/essentiaWorkerMessages';

test('getEssentiaFeatureExtractionResult returns features for the expected song', () => {
  const features = { energy: 12, key: 'C' };

  assert.deepEqual(
    getEssentiaFeatureExtractionResult({
      type: 'featureExtractionComplete',
      songId: 'song-a',
      features,
    }, 'song-a'),
    features
  );
});

test('getEssentiaFeatureExtractionResult rejects replies for a different song', () => {
  assert.throws(
    () => getEssentiaFeatureExtractionResult({
      type: 'featureExtractionComplete',
      songId: 'song-b',
      features: { energy: 12 },
    }, 'song-a'),
    /songId mismatch/
  );
});

test('getEssentiaFeatureExtractionResult rejects missing feature payloads', () => {
  assert.throws(
    () => getEssentiaFeatureExtractionResult({
      type: 'featureExtractionComplete',
      songId: 'song-a',
    }, 'song-a'),
    /returned no features/
  );
});

test('getEssentiaFeatureExtractionError returns worker errors with a fallback', () => {
  assert.equal(getEssentiaFeatureExtractionError({
    type: 'featureExtractionError',
    songId: 'song-a',
    error: 'decode failed',
  }), 'decode failed');
  assert.equal(getEssentiaFeatureExtractionError({
    type: 'featureExtractionError',
    songId: 'song-a',
  }), 'Essentia feature extraction failed.');
});

test('withEssentiaRequestId echoes request IDs only when provided', () => {
  assert.deepEqual(
    withEssentiaRequestId({ type: 'featureExtractionComplete', songId: 'song-a' }, 'extract-123'),
    { type: 'featureExtractionComplete', songId: 'song-a', requestId: 'extract-123' }
  );
  assert.deepEqual(
    withEssentiaRequestId({ type: 'featureExtractionComplete', songId: 'song-a' }),
    { type: 'featureExtractionComplete', songId: 'song-a' }
  );
});
