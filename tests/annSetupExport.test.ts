import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnSetupExportFilename,
  createAnnSetupExportPayload,
  parseAnnSetupImportPayload,
} from '../src/lib/annSetupExport';
import type { AnnSetupSnapshot } from '../src/lib/annSetupPersistence';

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

test('createAnnSetupExportPayload preserves portable labels and pipeline settings with summary counts', () => {
  const payload = createAnnSetupExportPayload({
    exportedAt: '2026-06-17T12:00:00.000Z',
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
    songs: [
      { id: 'song-a', name: 'Song A', url: '/audio/a.mp3', source: 'default' },
      {
        id: 'uploaded-blob-song',
        name: 'Lead Guitar.wav',
        url: 'blob:lead-guitar',
        source: 'user',
        externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
      },
    ],
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, '2026-06-17T12:00:00.000Z');
  assert.equal(payload.labelCount, 2);
  assert.equal(payload.assignedSongCount, 2);
  assert.equal(payload.selectedFeatureCount, 2);
  assert.equal(payload.portabilityNote, 'Only persistable song ids are included; uploaded audio files must be re-added in the target browser.');
  assert.deepEqual(payload.externalDataset, {
    version: 1,
    userSongCount: 1,
    assignedUserSongCount: 1,
    songs: [
      {
        songId: 'uploaded-blob-song',
        name: 'Lead Guitar.wav',
        externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
        assignedLabels: ['Rock'],
      },
    ],
  });
  assert.equal(JSON.stringify(payload).includes('blob:'), false);
  assert.deepEqual(payload.setup, {
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

test('parseAnnSetupImportPayload imports setup exports and storage snapshots', () => {
  const snapshot: AnnSetupSnapshot = {
    version: 1,
    namedLists: {
      Rock: ['song-a', 'missing-song'],
      Jazz: [],
    },
    selectedFeatureIds: ['mfcc', 'energy'],
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'umap',
    targetDimensions: 2,
    networkConfig,
  };

  const exported = parseAnnSetupImportPayload(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-06-17T12:00:00.000Z',
    setup: snapshot,
    externalDataset: {
      version: 1,
      userSongCount: 1,
      assignedUserSongCount: 1,
      songs: [
        {
          songId: 'user-upload-lead-guitar',
          name: 'Lead Guitar.wav',
          externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
          assignedLabels: ['Rock'],
        },
      ],
    },
  }), new Set(['song-a']));
  assert.equal(exported.ok, true);
  assert.deepEqual(exported.ok ? exported.setup.namedLists.Rock : null, new Set(['song-a']));
  assert.deepEqual(exported.ok ? exported.setup.selectedFeatures : null, new Set(['mfcc', 'energy']));
  assert.equal(exported.ok ? exported.setup.processingMethod : null, 'standardize');
  assert.deepEqual(exported.ok ? exported.externalDataset : null, {
    version: 1,
    userSongCount: 1,
    assignedUserSongCount: 1,
    songs: [
      {
        songId: 'user-upload-lead-guitar',
        name: 'Lead Guitar.wav',
        externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
        assignedLabels: ['Rock'],
      },
    ],
  });

  const storageSnapshot = parseAnnSetupImportPayload(JSON.stringify(snapshot), new Set(['song-a']));
  assert.equal(storageSnapshot.ok, true);
  assert.deepEqual(storageSnapshot.ok ? storageSnapshot.setup.namedLists.Rock : null, new Set(['song-a']));
  assert.equal(storageSnapshot.ok ? storageSnapshot.externalDataset : 'unexpected failure', null);
});

test('parseAnnSetupImportPayload rejects malformed imports with a reason', () => {
  assert.deepEqual(parseAnnSetupImportPayload('{bad json'), {
    ok: false,
    reason: 'Setup import is not valid JSON.',
  });

  assert.deepEqual(parseAnnSetupImportPayload(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-06-17T12:00:00.000Z',
    setup: {
      version: 1,
      namedLists: { Rock: ['song-a'] },
      selectedFeatureIds: ['unknown-feature'],
      processingMethod: 'standardize',
      useDimensionalityReduction: false,
      reductionMethod: 'umap',
      targetDimensions: 2,
      networkConfig,
    },
  })), {
    ok: false,
    reason: 'Setup import does not match the expected schema.',
  });

  assert.deepEqual(parseAnnSetupImportPayload(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-06-17T12:00:00.000Z',
    setup: {
      version: 1,
      namedLists: { Rock: ['song-a'] },
      selectedFeatureIds: ['energy'],
      processingMethod: 'standardize',
      useDimensionalityReduction: false,
      reductionMethod: 'umap',
      targetDimensions: 2,
      networkConfig,
    },
    externalDataset: {
      version: 1,
      userSongCount: 1,
      assignedUserSongCount: 1,
      songs: [
        {
          songId: '',
          name: 'Lead Guitar.wav',
          externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
          assignedLabels: ['Rock'],
        },
      ],
    },
  })), {
    ok: false,
    reason: 'Setup import external dataset does not match the expected schema.',
  });
});

test('createAnnSetupExportFilename creates a filesystem-safe filename', () => {
  assert.equal(
    createAnnSetupExportFilename({ exportedAt: '2026-06-17T12:00:01.234Z' }),
    'musiccluster-ann-setup-2026-06-17T12-00-01-234Z.json'
  );
});
