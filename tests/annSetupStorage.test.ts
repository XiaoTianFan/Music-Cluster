import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAnnSetupFromStorage,
  saveAnnSetupToStorage,
  type AnnSetupStorageLike,
} from '../src/lib/annSetupStorage';
import { ANN_SETUP_STORAGE_KEY, type AnnSetupSnapshot } from '../src/lib/annSetupPersistence';

const networkConfig = {
  hiddenLayers: 1,
  nodesPerLayer: [8],
  activation: 'relu' as const,
  optimizer: 'adam' as const,
  learningRate: 0.001,
  epochs: 25,
  splitRatio: 0.8,
  batchSize: 4,
};

class MemoryStorage implements AnnSetupStorageLike {
  private values = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test('loadAnnSetupFromStorage hydrates persisted setup and filters unavailable songs', () => {
  const snapshot: AnnSetupSnapshot = {
    version: 1,
    namedLists: {
      Rock: ['default-song', 'uploaded-blob-song'],
      Jazz: [],
    },
    selectedFeatureIds: ['mfcc', 'energy'],
    processingMethod: 'normalize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 3,
    networkConfig,
  };

  const result = loadAnnSetupFromStorage({
    storage: new MemoryStorage({ [ANN_SETUP_STORAGE_KEY]: JSON.stringify(snapshot) }),
    availableSongIds: new Set(['default-song']),
  });

  assert.equal(result.status, 'restored');
  assert.equal(result.reason, null);
  assert.ok(result.setup);
  assert.deepEqual(result.setup.namedLists.Rock, new Set(['default-song']));
  assert.deepEqual(result.setup.namedLists.Jazz, new Set<string>());
  assert.deepEqual(result.setup.selectedFeatures, new Set(['mfcc', 'energy']));
  assert.equal(result.setup.processingMethod, 'normalize');
  assert.equal(result.setup.reductionMethod, 'pca');
  assert.equal(result.setup.targetDimensions, 3);
});

test('loadAnnSetupFromStorage distinguishes empty, invalid, and storage-error states', () => {
  assert.deepEqual(loadAnnSetupFromStorage({
    storage: new MemoryStorage(),
    availableSongIds: new Set(),
  }), {
    status: 'empty',
    setup: null,
    reason: null,
  });

  assert.deepEqual(loadAnnSetupFromStorage({
    storage: new MemoryStorage({ [ANN_SETUP_STORAGE_KEY]: '{bad json' }),
    availableSongIds: new Set(),
  }), {
    status: 'invalid',
    setup: null,
    reason: null,
  });

  const storage: AnnSetupStorageLike = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {},
  };

  assert.deepEqual(loadAnnSetupFromStorage({
    storage,
    availableSongIds: new Set(),
  }), {
    status: 'error',
    setup: null,
    reason: 'blocked',
  });
});

test('saveAnnSetupToStorage persists a filtered snapshot and reports write errors', () => {
  const storage = new MemoryStorage();
  const result = saveAnnSetupToStorage({
    storage,
    namedLists: {
      Rock: new Set(['uploaded-blob-song', 'default-song']),
    },
    selectedFeatures: new Set(['mfcc', 'unknown-feature']),
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'umap',
    targetDimensions: 2,
    networkConfig,
    persistableSongIds: new Set(['default-song']),
  });

  assert.equal(result.saved, true);
  assert.equal(result.reason, null);
  assert.equal(result.snapshot?.namedLists.Rock.join(','), 'default-song');
  assert.deepEqual(result.snapshot?.selectedFeatureIds, ['mfcc']);
  assert.deepEqual(JSON.parse(storage.getItem(ANN_SETUP_STORAGE_KEY) ?? ''), result.snapshot);

  const failingStorage: AnnSetupStorageLike = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };

  assert.deepEqual(saveAnnSetupToStorage({
    storage: failingStorage,
    namedLists: {},
    selectedFeatures: new Set(['mfcc']),
    processingMethod: 'none',
    useDimensionalityReduction: false,
    reductionMethod: 'pca',
    targetDimensions: 2,
    networkConfig,
    persistableSongIds: new Set(),
  }), {
    saved: false,
    snapshot: null,
    reason: 'quota exceeded',
  });
});
