import {
  hydrateAnnSetupSnapshot,
  parseAnnSetupSnapshot,
  serializeAnnSetupSnapshot,
  type AnnSetupSnapshot,
  type HydratedAnnSetup,
  type SerializeAnnSetupInput,
} from './annSetupPersistence';
import {
  createUploadedDatasetManifest,
  parseUploadedDatasetManifest,
  type UploadedDatasetManifest,
} from './annUploadedSongs';
import type { Song } from './annPipeline';

export const ANN_SETUP_EXPORT_PORTABILITY_NOTE =
  'Only persistable song ids are included; uploaded audio files must be re-added in the target browser.';

export interface AnnSetupExportPayload {
  schemaVersion: 1;
  exportedAt: string;
  labelCount: number;
  assignedSongCount: number;
  selectedFeatureCount: number;
  portabilityNote: string;
  setup: AnnSetupSnapshot;
  externalDataset: UploadedDatasetManifest;
}

export type AnnSetupImportResult =
  | { ok: true; setup: HydratedAnnSetup; snapshot: AnnSetupSnapshot; externalDataset: UploadedDatasetManifest | null }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAssignedSongCount(namedLists: Record<string, string[]>): number {
  return new Set(Object.values(namedLists).flat()).size;
}

export function createAnnSetupExportPayload({
  exportedAt,
  ...setupInput
}: SerializeAnnSetupInput & {
  exportedAt: string;
  songs?: readonly Song[];
}): AnnSetupExportPayload {
  const setup = serializeAnnSetupSnapshot(setupInput);
  const externalDataset = createUploadedDatasetManifest({
    songs: setupInput.songs ?? [],
    namedLists: setupInput.namedLists,
  });

  return {
    schemaVersion: 1,
    exportedAt,
    labelCount: Object.keys(setup.namedLists).length,
    assignedSongCount: getAssignedSongCount(setup.namedLists),
    selectedFeatureCount: setup.selectedFeatureIds.length,
    portabilityNote: ANN_SETUP_EXPORT_PORTABILITY_NOTE,
    setup,
    externalDataset,
  };
}

export function parseAnnSetupImportPayload(
  raw: unknown,
  availableSongIds?: ReadonlySet<string>
): AnnSetupImportResult {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        reason: 'Setup import is not valid JSON.',
      };
    }
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      reason: 'Setup import does not match the expected schema.',
    };
  }

  const possibleSnapshot = parsed.schemaVersion === 1 ? parsed.setup : parsed;
  const snapshot = parseAnnSetupSnapshot(possibleSnapshot);
  if (!snapshot) {
    return {
      ok: false,
      reason: 'Setup import does not match the expected schema.',
    };
  }

  let externalDataset: UploadedDatasetManifest | null = null;
  if (parsed.schemaVersion === 1 && Object.prototype.hasOwnProperty.call(parsed, 'externalDataset')) {
    externalDataset = parseUploadedDatasetManifest(parsed.externalDataset);
    if (!externalDataset) {
      return {
        ok: false,
        reason: 'Setup import external dataset does not match the expected schema.',
      };
    }
  }

  return {
    ok: true,
    setup: hydrateAnnSetupSnapshot(snapshot, availableSongIds),
    snapshot,
    externalDataset,
  };
}

export function createAnnSetupExportFilename({
  exportedAt,
}: {
  exportedAt: string;
}): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  return `musiccluster-ann-setup-${safeTimestamp}.json`;
}

export function downloadAnnSetupExport({
  payload,
  filename,
}: {
  payload: AnnSetupExportPayload;
  filename: string;
}): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
