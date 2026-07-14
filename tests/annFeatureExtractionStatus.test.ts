import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnCurrentFeatureRows,
  getAnnFeatureExtractionCompletion,
} from '../src/lib/annFeatureExtractionStatus';

const songs = [
  { id: 'song-a' },
  { id: 'song-b' },
  { id: 'song-c' },
];

test('getAnnFeatureExtractionCompletion completes when every current song is done', () => {
  const result = getAnnFeatureExtractionCompletion({
    songs,
    isExtracting: true,
    featureStatus: {
      'song-a': 'complete',
      'song-b': 'error',
      'song-c': 'complete',
    },
  });

  assert.deepEqual(result, {
    isComplete: true,
    completedCount: 3,
    totalCount: 3,
    hasSuccessfulFeatures: true,
  });
});

test('getAnnFeatureExtractionCompletion ignores stale statuses for removed songs', () => {
  const result = getAnnFeatureExtractionCompletion({
    songs,
    isExtracting: true,
    featureStatus: {
      'song-a': 'complete',
      'song-b': 'processing',
      'song-c': 'complete',
      'old-song-a': 'complete',
      'old-song-b': 'error',
    },
  });

  assert.deepEqual(result, {
    isComplete: false,
    completedCount: 2,
    totalCount: 3,
    hasSuccessfulFeatures: true,
  });
});

test('getAnnFeatureExtractionCompletion does not count stale successes for matrix preparation', () => {
  const result = getAnnFeatureExtractionCompletion({
    songs: [{ id: 'song-a' }, { id: 'song-b' }],
    isExtracting: true,
    featureStatus: {
      'song-a': 'error',
      'song-b': 'error',
      'old-song-a': 'complete',
    },
  });

  assert.deepEqual(result, {
    isComplete: true,
    completedCount: 2,
    totalCount: 2,
    hasSuccessfulFeatures: false,
  });
});

test('getAnnFeatureExtractionCompletion does not complete empty or inactive extraction', () => {
  assert.deepEqual(getAnnFeatureExtractionCompletion({
    songs: [],
    isExtracting: true,
    featureStatus: {
      'old-song-a': 'complete',
    },
  }), {
    isComplete: false,
    completedCount: 0,
    totalCount: 0,
    hasSuccessfulFeatures: false,
  });

  assert.deepEqual(getAnnFeatureExtractionCompletion({
    songs,
    isExtracting: false,
    featureStatus: {
      'song-a': 'complete',
      'song-b': 'complete',
      'song-c': 'complete',
    },
  }), {
    isComplete: false,
    completedCount: 3,
    totalCount: 3,
    hasSuccessfulFeatures: true,
  });
});

test('getAnnCurrentFeatureRows returns only current songs with completed feature payloads', () => {
  const result = getAnnCurrentFeatureRows({
    songs: [{ id: 'song-a' }, { id: 'song-b' }, { id: 'song-c' }],
    featureStatus: {
      'song-a': 'complete',
      'song-b': 'error',
      'song-c': 'complete',
      'old-song-a': 'complete',
    },
    songFeatures: {
      'song-a': { energy: 1 },
      'song-b': { energy: 2 },
      'song-c': { energy: 3 },
      'old-song-a': { energy: 99 },
    },
  });

  assert.deepEqual(result, {
    songIds: ['song-a', 'song-c'],
    count: 2,
    totalCount: 3,
    hasRows: true,
  });
});

test('getAnnCurrentFeatureRows ignores stale completed feature rows', () => {
  const result = getAnnCurrentFeatureRows({
    songs: [{ id: 'song-a' }, { id: 'song-b' }],
    featureStatus: {
      'song-a': 'idle',
      'old-song-a': 'complete',
    },
    songFeatures: {
      'old-song-a': { energy: 99 },
    },
  });

  assert.deepEqual(result, {
    songIds: [],
    count: 0,
    totalCount: 2,
    hasRows: false,
  });
});

test('getAnnCurrentFeatureRows requires both complete status and feature data', () => {
  const result = getAnnCurrentFeatureRows({
    songs: [{ id: 'song-a' }, { id: 'song-b' }, { id: 'song-c' }],
    featureStatus: {
      'song-a': 'complete',
      'song-b': 'complete',
      'song-c': 'processing',
    },
    songFeatures: {
      'song-a': null,
      'song-b': { energy: 2 },
      'song-c': { energy: 3 },
    },
  });

  assert.deepEqual(result, {
    songIds: ['song-b'],
    count: 1,
    totalCount: 3,
    hasRows: true,
  });
});
