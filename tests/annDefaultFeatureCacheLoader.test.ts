import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANN_DEFAULT_FEATURE_CACHE_URL,
  loadAnnDefaultFeatureCache,
  type AnnDefaultFeatureCacheFetch,
} from '../src/lib/annDefaultFeatureCacheLoader';

function fetchJson({
  ok = true,
  body,
}: {
  ok?: boolean;
  body: unknown;
}): AnnDefaultFeatureCacheFetch {
  return async () => ({
    ok,
    async json() {
      return body;
    },
  });
}

test('loadAnnDefaultFeatureCache loads and parses the generated cache shape', async () => {
  const seenUrls: string[] = [];
  const result = await loadAnnDefaultFeatureCache({
    fetcher: async url => {
      seenUrls.push(url);
      return fetchJson({
        body: {
          availableDataKeys: ['energy'],
          songData: {
            '/audio/a.mp3': { energy: 1 },
            '/audio/b.mp3': { energy: 2 },
          },
        },
      })(url);
    },
  });

  assert.deepEqual(seenUrls, [ANN_DEFAULT_FEATURE_CACHE_URL]);
  assert.equal(result.status, 'loaded');
  assert.equal(result.reason, null);
  assert.equal(result.songCount, 2);
  assert.ok(result.cache);
  assert.equal(result.cache.songData['/audio/a.mp3'].energy, 1);
});

test('loadAnnDefaultFeatureCache reports unavailable HTTP responses', async () => {
  const result = await loadAnnDefaultFeatureCache({
    fetcher: fetchJson({ ok: false, body: {} }),
  });

  assert.deepEqual(result, {
    status: 'unavailable',
    cache: null,
    songCount: 0,
    reason: null,
  });
});

test('loadAnnDefaultFeatureCache reports invalid cache shapes', async () => {
  const result = await loadAnnDefaultFeatureCache({
    fetcher: fetchJson({ body: { availableDataKeys: 'energy', songData: {} } }),
  });

  assert.deepEqual(result, {
    status: 'invalid',
    cache: null,
    songCount: 0,
    reason: null,
  });
});

test('loadAnnDefaultFeatureCache reports fetch and JSON errors', async () => {
  const fetchFailure = await loadAnnDefaultFeatureCache({
    fetcher: async () => {
      throw new Error('network down');
    },
  });

  assert.deepEqual(fetchFailure, {
    status: 'error',
    cache: null,
    songCount: 0,
    reason: 'network down',
  });

  const jsonFailure = await loadAnnDefaultFeatureCache({
    fetcher: async () => ({
      ok: true,
      async json() {
        throw new Error('bad json');
      },
    }),
  });

  assert.deepEqual(jsonFailure, {
    status: 'error',
    cache: null,
    songCount: 0,
    reason: 'bad json',
  });
});
