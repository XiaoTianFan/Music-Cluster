import {
  parseUploadedDatasetManifest,
  type UploadedDatasetManifest,
} from './annUploadedSongs';

export const ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY = 'musiccluster-ann-uploaded-dataset-reattach-v1';

export interface UploadedDatasetReattachmentStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type UploadedDatasetReattachmentStorageLoadStatus = 'empty' | 'invalid' | 'restored' | 'error';

export interface UploadedDatasetReattachmentStorageLoadResult {
  status: UploadedDatasetReattachmentStorageLoadStatus;
  manifest: UploadedDatasetManifest | null;
  reason: string | null;
}

export type UploadedDatasetReattachmentStorageSaveResult =
  | { saved: true; reason: null }
  | { saved: false; reason: string };

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function loadPendingUploadedDatasetManifestFromStorage({
  storage,
}: {
  storage: UploadedDatasetReattachmentStorageLike;
}): UploadedDatasetReattachmentStorageLoadResult {
  try {
    const rawManifest = storage.getItem(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY);
    if (rawManifest === null) {
      return { status: 'empty', manifest: null, reason: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawManifest);
    } catch {
      return { status: 'invalid', manifest: null, reason: null };
    }

    const manifest = parseUploadedDatasetManifest(parsed);
    if (!manifest || manifest.userSongCount === 0) {
      return { status: 'invalid', manifest: null, reason: null };
    }

    return {
      status: 'restored',
      manifest,
      reason: null,
    };
  } catch (error) {
    return {
      status: 'error',
      manifest: null,
      reason: getErrorReason(error),
    };
  }
}

export function savePendingUploadedDatasetManifestToStorage({
  storage,
  manifest,
}: {
  storage: UploadedDatasetReattachmentStorageLike;
  manifest: UploadedDatasetManifest | null;
}): UploadedDatasetReattachmentStorageSaveResult {
  try {
    if (!manifest || manifest.userSongCount === 0) {
      storage.removeItem(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY);
      return { saved: true, reason: null };
    }

    storage.setItem(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY, JSON.stringify(manifest));
    return { saved: true, reason: null };
  } catch (error) {
    return {
      saved: false,
      reason: getErrorReason(error),
    };
  }
}
