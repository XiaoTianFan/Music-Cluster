import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY,
  loadPendingUploadedDatasetManifestFromStorage,
  savePendingUploadedDatasetManifestToStorage,
  type UploadedDatasetReattachmentStorageLike,
} from '../src/lib/annUploadedDatasetReattachmentStorage';
import type { UploadedDatasetManifest } from '../src/lib/annUploadedSongs';

const manifest: UploadedDatasetManifest = {
  version: 1,
  userSongCount: 2,
  assignedUserSongCount: 1,
  songs: [
    {
      songId: 'user-upload-lead-guitar',
      name: 'Lead Guitar.wav',
      externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
      assignedLabels: ['Rock'],
    },
    {
      songId: 'user-upload-room-take',
      name: 'Room Take.mp3',
      externalId: 'browser-file:room-take-mp3:4096:1780000001000',
      assignedLabels: [],
    },
  ],
};

class MemoryStorage implements UploadedDatasetReattachmentStorageLike {
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

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('loadPendingUploadedDatasetManifestFromStorage restores a valid pending manifest', () => {
  const result = loadPendingUploadedDatasetManifestFromStorage({
    storage: new MemoryStorage({
      [ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY]: JSON.stringify(manifest),
    }),
  });

  assert.deepEqual(result, {
    status: 'restored',
    manifest,
    reason: null,
  });
});

test('loadPendingUploadedDatasetManifestFromStorage distinguishes empty, invalid, and storage-error states', () => {
  assert.deepEqual(loadPendingUploadedDatasetManifestFromStorage({
    storage: new MemoryStorage(),
  }), {
    status: 'empty',
    manifest: null,
    reason: null,
  });

  assert.deepEqual(loadPendingUploadedDatasetManifestFromStorage({
    storage: new MemoryStorage({
      [ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY]: JSON.stringify({
        ...manifest,
        songs: [{ ...manifest.songs[0], externalId: 'blob:old-session' }],
      }),
    }),
  }), {
    status: 'invalid',
    manifest: null,
    reason: null,
  });

  const storage: UploadedDatasetReattachmentStorageLike = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {},
    removeItem() {},
  };

  assert.deepEqual(loadPendingUploadedDatasetManifestFromStorage({ storage }), {
    status: 'error',
    manifest: null,
    reason: 'blocked',
  });
});

test('savePendingUploadedDatasetManifestToStorage persists and clears pending manifests', () => {
  const storage = new MemoryStorage();
  const saved = savePendingUploadedDatasetManifestToStorage({
    storage,
    manifest,
  });

  assert.deepEqual(saved, {
    saved: true,
    reason: null,
  });
  assert.deepEqual(
    JSON.parse(storage.getItem(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY) ?? ''),
    manifest
  );

  const cleared = savePendingUploadedDatasetManifestToStorage({
    storage,
    manifest: null,
  });

  assert.deepEqual(cleared, {
    saved: true,
    reason: null,
  });
  assert.equal(storage.getItem(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY), null);

  const failingStorage: UploadedDatasetReattachmentStorageLike = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
    removeItem() {},
  };

  assert.deepEqual(savePendingUploadedDatasetManifestToStorage({
    storage: failingStorage,
    manifest,
  }), {
    saved: false,
    reason: 'quota exceeded',
  });
});
