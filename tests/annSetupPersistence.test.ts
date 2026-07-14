import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAnnSetupSnapshot,
  hydrateAnnSetupSnapshot,
  serializeAnnSetupSnapshot,
  type AnnSetupSnapshot,
} from '../src/lib/annSetupPersistence';

const networkConfig = {
  hiddenLayers: 2,
  nodesPerLayer: [16, 8],
  activation: 'relu' as const,
  optimizer: 'adam' as const,
  learningRate: 0.001,
  epochs: 50,
  splitRatio: 0.8,
  batchSize: 16,
  randomSeed: 1234,
  targetLoss: 0.05,
};

test('serializeAnnSetupSnapshot creates a versioned snapshot and filters non-persistable song ids', () => {
  const snapshot = serializeAnnSetupSnapshot({
    namedLists: {
      Rock: new Set(['song-b', 'uploaded-blob-song', 'song-a']),
      Jazz: new Set<string>(),
    },
    selectedFeatures: new Set(['mfcc', 'energy', 'unknown-feature']),
    processingMethod: 'normalize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 3,
    networkConfig,
    persistableSongIds: new Set(['song-a', 'song-b']),
  });

  assert.deepEqual(snapshot, {
    version: 1,
    namedLists: {
      Rock: ['song-a', 'song-b'],
      Jazz: [],
    },
    selectedFeatureIds: ['mfcc', 'energy'],
    processingMethod: 'normalize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 3,
    networkConfig,
  });
});

test('parseAnnSetupSnapshot accepts valid JSON and hydrateAnnSetupSnapshot restores sets', () => {
  const rawSnapshot: AnnSetupSnapshot = {
    version: 1,
    namedLists: {
      Rock: ['song-a', 'song-a', 'missing-song'],
      Jazz: [],
    },
    selectedFeatureIds: ['mfcc', 'energy'],
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'umap',
    targetDimensions: 2,
    networkConfig,
  };

  const parsed = parseAnnSetupSnapshot(JSON.stringify(rawSnapshot));
  assert.ok(parsed);
  assert.deepEqual(parsed.namedLists.Rock, ['song-a', 'missing-song']);

  const hydrated = hydrateAnnSetupSnapshot(parsed, new Set(['song-a']));
  assert.deepEqual(hydrated.namedLists.Rock, new Set(['song-a']));
  assert.deepEqual(hydrated.namedLists.Jazz, new Set<string>());
  assert.deepEqual(hydrated.selectedFeatures, new Set(['mfcc', 'energy']));
  assert.equal(hydrated.processingMethod, 'standardize');
  assert.equal(hydrated.reductionMethod, 'umap');
  assert.equal(hydrated.targetDimensions, 2);
});

test('parseAnnSetupSnapshot rejects invalid JSON, versions, feature ids, and network config', () => {
  const validSnapshot: AnnSetupSnapshot = {
    version: 1,
    namedLists: { Rock: ['song-a'] },
    selectedFeatureIds: ['mfcc'],
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'umap',
    targetDimensions: 2,
    networkConfig,
  };

  assert.equal(parseAnnSetupSnapshot('{bad json'), null);
  assert.equal(parseAnnSetupSnapshot({ ...validSnapshot, version: 2 }), null);
  assert.equal(parseAnnSetupSnapshot({ ...validSnapshot, selectedFeatureIds: ['not-a-feature'] }), null);
  assert.equal(parseAnnSetupSnapshot({ ...validSnapshot, targetDimensions: 4 }), null);
  assert.equal(parseAnnSetupSnapshot({
    ...validSnapshot,
    networkConfig: {
      ...networkConfig,
      nodesPerLayer: [16],
    },
  }), null);
});

test('parseAnnSetupSnapshot accepts optional seed and target loss only when finite', () => {
  const validSnapshot: AnnSetupSnapshot = {
    version: 1,
    namedLists: { Rock: ['song-a'] },
    selectedFeatureIds: ['mfcc'],
    processingMethod: 'none',
    useDimensionalityReduction: true,
    reductionMethod: 'tsne',
    targetDimensions: 2,
    networkConfig: {
      hiddenLayers: 0,
      nodesPerLayer: [],
      activation: 'tanh',
      optimizer: 'sgd',
      learningRate: 0.01,
      epochs: 5,
      splitRatio: 0.75,
      batchSize: 2,
    },
  };

  assert.ok(parseAnnSetupSnapshot(validSnapshot));
  assert.equal(parseAnnSetupSnapshot({
    ...validSnapshot,
    networkConfig: {
      ...validSnapshot.networkConfig,
      randomSeed: Number.NaN,
    },
  }), null);
  assert.equal(parseAnnSetupSnapshot({
    ...validSnapshot,
    networkConfig: {
      ...validSnapshot.networkConfig,
      targetLoss: Number.POSITIVE_INFINITY,
    },
  }), null);
});
