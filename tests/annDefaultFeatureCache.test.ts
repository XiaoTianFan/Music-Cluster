import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnDefaultFeatureCachePlan,
  parseAnnDefaultFeatureCache,
} from '../src/lib/annDefaultFeatureCache';
import type { Song } from '../src/lib/annPipeline';

const defaultSong: Song = {
  id: '/audio/default-a.mp3',
  name: 'Default A',
  url: '/audio/default-a.mp3',
  source: 'default',
};

const uploadedSong: Song = {
  id: 'user-upload-live',
  name: 'Live.wav',
  url: 'blob:live',
  source: 'user',
};

test('parseAnnDefaultFeatureCache accepts the generated default feature cache shape', () => {
  const cache = parseAnnDefaultFeatureCache({
    availableDataKeys: ['energy', 'key', 'keyScale', 'keyStrength'],
    songData: {
      [defaultSong.id]: {
        energy: 10,
        key: 'C',
        keyScale: 'major',
        keyStrength: 0.9,
      },
    },
  });

  assert.ok(cache);
  assert.deepEqual([...cache.availableDataKeys].sort(), ['energy', 'key', 'keyScale', 'keyStrength']);
  assert.equal(cache.songData[defaultSong.id].energy, 10);
});

test('parseAnnDefaultFeatureCache rejects invalid cache shapes', () => {
  assert.equal(parseAnnDefaultFeatureCache(null), null);
  assert.equal(parseAnnDefaultFeatureCache({ availableDataKeys: 'energy', songData: {} }), null);
  assert.equal(parseAnnDefaultFeatureCache({ availableDataKeys: ['energy'], songData: [] }), null);
});

test('getAnnDefaultFeatureCachePlan hydrates default songs when all selected feature data is cached', () => {
  const cache = parseAnnDefaultFeatureCache({
    availableDataKeys: ['energy', 'key', 'keyScale', 'keyStrength'],
    songData: {
      [defaultSong.id]: {
        energy: 10,
        key: 'C',
        keyScale: 'major',
        keyStrength: 0.9,
        loudness: -12,
      },
    },
  });
  assert.ok(cache);

  const plan = getAnnDefaultFeatureCachePlan({
    songs: [defaultSong, uploadedSong],
    selectedFeatureIds: ['energy', 'key'],
    cache,
  });

  assert.deepEqual(plan.requiredDataKeys, ['energy', 'keyStrength', 'key', 'keyScale']);
  assert.deepEqual(plan.cachedFeaturesBySongId, {
    [defaultSong.id]: {
      energy: 10,
      key: 'C',
      keyScale: 'major',
      keyStrength: 0.9,
    },
  });
  assert.deepEqual(plan.statusBySongId, {
    [defaultSong.id]: 'complete',
    [uploadedSong.id]: 'processing',
  });
  assert.deepEqual(plan.songIdsToExtract, [uploadedSong.id]);
});

test('getAnnDefaultFeatureCachePlan can satisfy default-only datasets entirely from cache', () => {
  const cache = parseAnnDefaultFeatureCache({
    availableDataKeys: ['energy'],
    songData: {
      [defaultSong.id]: {
        energy: 10,
      },
    },
  });
  assert.ok(cache);

  const plan = getAnnDefaultFeatureCachePlan({
    songs: [defaultSong],
    selectedFeatureIds: ['energy'],
    cache,
  });

  assert.equal(plan.cacheApplicable, true);
  assert.deepEqual(plan.cachedFeaturesBySongId, {
    [defaultSong.id]: {
      energy: 10,
    },
  });
  assert.deepEqual(plan.statusBySongId, {
    [defaultSong.id]: 'complete',
  });
  assert.deepEqual(plan.songIdsToExtract, []);
});

test('getAnnDefaultFeatureCachePlan falls back to extraction when cache lacks required keys', () => {
  const cache = parseAnnDefaultFeatureCache({
    availableDataKeys: ['energy'],
    songData: {
      [defaultSong.id]: {
        energy: 10,
      },
    },
  });
  assert.ok(cache);

  const plan = getAnnDefaultFeatureCachePlan({
    songs: [defaultSong],
    selectedFeatureIds: ['energy', 'key'],
    cache,
  });

  assert.deepEqual(plan.cachedFeaturesBySongId, {});
  assert.deepEqual(plan.statusBySongId, {
    [defaultSong.id]: 'processing',
  });
  assert.deepEqual(plan.songIdsToExtract, [defaultSong.id]);
});

test('getAnnDefaultFeatureCachePlan marks every song for extraction when cache is unavailable', () => {
  const plan = getAnnDefaultFeatureCachePlan({
    songs: [defaultSong, uploadedSong],
    selectedFeatureIds: ['energy'],
    cache: null,
  });

  assert.deepEqual(plan.cachedFeaturesBySongId, {});
  assert.deepEqual(plan.statusBySongId, {
    [defaultSong.id]: 'processing',
    [uploadedSong.id]: 'processing',
  });
  assert.deepEqual(plan.songIdsToExtract, [defaultSong.id, uploadedSong.id]);
});
