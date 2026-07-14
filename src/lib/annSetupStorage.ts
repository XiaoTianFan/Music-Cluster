import {
  ANN_SETUP_STORAGE_KEY,
  hydrateAnnSetupSnapshot,
  parseAnnSetupSnapshot,
  serializeAnnSetupSnapshot,
  type HydratedAnnSetup,
  type SerializeAnnSetupInput,
  type AnnSetupSnapshot,
} from './annSetupPersistence';

export interface AnnSetupStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type AnnSetupStorageLoadStatus = 'empty' | 'invalid' | 'restored' | 'error';

export interface AnnSetupStorageLoadResult {
  status: AnnSetupStorageLoadStatus;
  setup: HydratedAnnSetup | null;
  reason: string | null;
}

export interface AnnSetupStorageSaveInput extends SerializeAnnSetupInput {
  storage: AnnSetupStorageLike;
}

export type AnnSetupStorageSaveResult =
  | { saved: true; snapshot: AnnSetupSnapshot; reason: null }
  | { saved: false; snapshot: null; reason: string };

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function loadAnnSetupFromStorage({
  storage,
  availableSongIds,
}: {
  storage: AnnSetupStorageLike;
  availableSongIds?: ReadonlySet<string>;
}): AnnSetupStorageLoadResult {
  try {
    const rawSnapshot = storage.getItem(ANN_SETUP_STORAGE_KEY);
    if (rawSnapshot === null) {
      return { status: 'empty', setup: null, reason: null };
    }

    const snapshot = parseAnnSetupSnapshot(rawSnapshot);
    if (!snapshot) {
      return { status: 'invalid', setup: null, reason: null };
    }

    return {
      status: 'restored',
      setup: hydrateAnnSetupSnapshot(snapshot, availableSongIds),
      reason: null,
    };
  } catch (error) {
    return {
      status: 'error',
      setup: null,
      reason: getErrorReason(error),
    };
  }
}

export function saveAnnSetupToStorage(input: AnnSetupStorageSaveInput): AnnSetupStorageSaveResult {
  const { storage, ...setupInput } = input;

  try {
    const snapshot = serializeAnnSetupSnapshot(setupInput);
    storage.setItem(ANN_SETUP_STORAGE_KEY, JSON.stringify(snapshot));
    return { saved: true, snapshot, reason: null };
  } catch (error) {
    return {
      saved: false,
      snapshot: null,
      reason: getErrorReason(error),
    };
  }
}
