import type { Song } from './annPipeline';

export interface TrainingSongUploadFile {
  name: string;
  type?: string;
  size?: number;
  lastModified?: number;
}

export type TrainingSongUploadSkipReason = 'not-audio' | 'duplicate-name' | 'url-error';

export interface TrainingSongUploadSkip {
  name: string;
  reason: TrainingSongUploadSkipReason;
}

export interface TrainingSongUploadResult {
  songs: Song[];
  skipped: TrainingSongUploadSkip[];
}

export interface TrainingSongUploadInput<TFile extends TrainingSongUploadFile = TrainingSongUploadFile> {
  existingSongs: Song[];
  files: Iterable<TFile>;
  createObjectUrl: (file: TFile) => string;
}

export interface UploadedDatasetManifestSong {
  songId: string;
  name: string;
  externalId: string;
  assignedLabels: string[];
}

export interface UploadedDatasetManifest {
  version: 1;
  userSongCount: number;
  assignedUserSongCount: number;
  songs: UploadedDatasetManifestSong[];
}

export interface UploadedDatasetManifestInput {
  songs: readonly Song[];
  namedLists: Record<string, Set<string>>;
}

export interface UploadedDatasetManifestMatch<TFile extends TrainingSongUploadFile = TrainingSongUploadFile> {
  song: UploadedDatasetManifestSong;
  file: TFile;
}

export interface UploadedDatasetManifestFileMatchResult<TFile extends TrainingSongUploadFile = TrainingSongUploadFile> {
  matched: UploadedDatasetManifestMatch<TFile>[];
  missing: UploadedDatasetManifestSong[];
  unmatchedFiles: Array<{ externalId: string; file: TFile }>;
}

export interface UploadedDatasetReattachmentInput<TFile extends TrainingSongUploadFile = TrainingSongUploadFile> {
  existingSongs: Song[];
  namedLists: Record<string, Set<string>>;
  manifest: UploadedDatasetManifest;
  files: Iterable<TFile>;
  createObjectUrl: (file: TFile) => string;
}

export interface UploadedDatasetReattachmentResult<TFile extends TrainingSongUploadFile = TrainingSongUploadFile> {
  songs: Song[];
  namedLists: Record<string, Set<string>>;
  attachedSongs: Song[];
  missing: UploadedDatasetManifestSong[];
  unmatchedFiles: Array<{ externalId: string; file: TFile }>;
  skipped: TrainingSongUploadSkip[];
}

export interface UploadedTrainingSongRemovalInput {
  songs: Song[];
  namedLists: Record<string, Set<string>>;
  songId: string;
}

export interface UploadedTrainingSongRemovalResult {
  songs: Song[];
  namedLists: Record<string, Set<string>>;
  removedSong: Song | null;
}

export interface UploadedTrainingSongExternalIdDescription {
  sizeBytes: number | null;
  modifiedMs: number | null;
  sizeLabel: string;
  modifiedLabel: string;
}

const knownAudioExtensions = new Set([
  'aac',
  'aif',
  'aiff',
  'alac',
  'flac',
  'm4a',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'wave',
  'webm',
  'wma',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function parseUploadedDatasetManifestSong(raw: unknown): UploadedDatasetManifestSong | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.songId)) return null;
  if (!isNonEmptyString(raw.name)) return null;
  if (!isNonEmptyString(raw.externalId) || raw.externalId.startsWith('blob:')) return null;
  if (!Array.isArray(raw.assignedLabels) || !raw.assignedLabels.every(isNonEmptyString)) return null;

  return {
    songId: raw.songId,
    name: raw.name,
    externalId: raw.externalId,
    assignedLabels: raw.assignedLabels,
  };
}

export function parseUploadedDatasetManifest(raw: unknown): UploadedDatasetManifest | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (!isNonNegativeInteger(raw.userSongCount)) return null;
  if (!isNonNegativeInteger(raw.assignedUserSongCount)) return null;
  if (!Array.isArray(raw.songs)) return null;

  const songs = raw.songs.map(parseUploadedDatasetManifestSong);
  if (songs.some(song => song === null)) return null;

  const parsedSongs = songs as UploadedDatasetManifestSong[];
  const assignedUserSongCount = parsedSongs.filter(song => song.assignedLabels.length > 0).length;
  if (raw.userSongCount !== parsedSongs.length) return null;
  if (raw.assignedUserSongCount !== assignedUserSongCount) return null;

  return {
    version: 1,
    userSongCount: raw.userSongCount,
    assignedUserSongCount: raw.assignedUserSongCount,
    songs: parsedSongs,
  };
}

export function isAudioTrainingFile(file: TrainingSongUploadFile): boolean {
  const mimeType = file.type?.toLowerCase() ?? '';
  if (mimeType.startsWith('audio/')) {
    return true;
  }

  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension ? knownAudioExtensions.has(extension) : false;
}

function normalizeSongName(name: string): string {
  return name.trim().toLowerCase();
}

function getBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

function slugifySongName(name: string): string {
  const slug = getBaseName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'audio';
}

function slugifyExternalName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'audio';
}

function normalizeFileMetric(value: number | undefined, fallback: string): string {
  return Number.isFinite(value) && Number(value) >= 0 ? String(Math.trunc(Number(value))) : fallback;
}

export function createUploadedTrainingSongExternalId(file: TrainingSongUploadFile): string {
  return [
    'browser-file',
    slugifyExternalName(file.name),
    normalizeFileMetric(file.size, 'unknown-size'),
    normalizeFileMetric(file.lastModified, 'unknown-modified'),
  ].join(':');
}

function parseExternalIdMetric(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function formatByteCount(bytes: number | null): string {
  if (bytes === null) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatModifiedTimestamp(ms: number | null): string {
  if (ms === null) return 'Unknown modified';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Unknown modified';
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function describeUploadedTrainingSongExternalId(externalId: string): UploadedTrainingSongExternalIdDescription {
  const parts = externalId.split(':');
  const isBrowserFileId = parts.length === 4 && parts[0] === 'browser-file';
  const sizeBytes = isBrowserFileId ? parseExternalIdMetric(parts[2]) : null;
  const modifiedMs = isBrowserFileId ? parseExternalIdMetric(parts[3]) : null;

  return {
    sizeBytes,
    modifiedMs,
    sizeLabel: formatByteCount(sizeBytes),
    modifiedLabel: formatModifiedTimestamp(modifiedMs),
  };
}

function createUniqueSongId(fileName: string, usedIds: Set<string>): string {
  const baseId = `user-upload-${slugifySongName(fileName)}`;
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function createReattachedSongId(preferredId: string, fileName: string, usedIds: Set<string>): string {
  if (preferredId && !usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  return createUniqueSongId(fileName, usedIds);
}

export function ingestUploadedTrainingSongs<TFile extends TrainingSongUploadFile>({
  existingSongs,
  files,
  createObjectUrl,
}: TrainingSongUploadInput<TFile>): TrainingSongUploadResult {
  const usedNames = new Set(existingSongs.map(song => normalizeSongName(song.name)));
  const usedIds = new Set(existingSongs.map(song => song.id));
  const songs: Song[] = [];
  const skipped: TrainingSongUploadSkip[] = [];

  for (const file of files) {
    const displayName = file.name.trim();
    const normalizedName = normalizeSongName(displayName);

    if (!isAudioTrainingFile(file)) {
      skipped.push({ name: file.name, reason: 'not-audio' });
      continue;
    }

    if (!normalizedName || usedNames.has(normalizedName)) {
      skipped.push({ name: file.name, reason: 'duplicate-name' });
      continue;
    }

    let url: string;
    try {
      url = createObjectUrl(file);
    } catch {
      skipped.push({ name: file.name, reason: 'url-error' });
      continue;
    }

    const song: Song = {
      id: createUniqueSongId(displayName, usedIds),
      name: displayName,
      url,
      source: 'user',
      externalId: createUploadedTrainingSongExternalId(file),
    };
    songs.push(song);
    usedNames.add(normalizedName);
  }

  return { songs, skipped };
}

function getAssignedLabels(songId: string, namedLists: Record<string, Set<string>>): string[] {
  return Object.entries(namedLists)
    .filter(([, songIds]) => songIds.has(songId))
    .map(([label]) => label);
}

export function createUploadedDatasetManifest({
  songs,
  namedLists,
}: UploadedDatasetManifestInput): UploadedDatasetManifest {
  const userSongs = songs.filter(song => song.source === 'user');
  const manifestSongs = userSongs.map(song => ({
    songId: song.id,
    name: song.name,
    externalId: song.externalId ?? createUploadedTrainingSongExternalId({ name: song.name }),
    assignedLabels: getAssignedLabels(song.id, namedLists),
  }));

  return {
    version: 1,
    userSongCount: manifestSongs.length,
    assignedUserSongCount: manifestSongs.filter(song => song.assignedLabels.length > 0).length,
    songs: manifestSongs,
  };
}

export function matchUploadedDatasetManifestFiles<TFile extends TrainingSongUploadFile>({
  manifest,
  files,
}: {
  manifest: UploadedDatasetManifest;
  files: Iterable<TFile>;
}): UploadedDatasetManifestFileMatchResult<TFile> {
  const remainingByExternalId = new Map<string, TFile[]>();
  for (const file of files) {
    const externalId = createUploadedTrainingSongExternalId(file);
    const existing = remainingByExternalId.get(externalId) ?? [];
    existing.push(file);
    remainingByExternalId.set(externalId, existing);
  }

  const matched: UploadedDatasetManifestMatch<TFile>[] = [];
  const missing: UploadedDatasetManifestSong[] = [];

  for (const song of manifest.songs) {
    const candidates = remainingByExternalId.get(song.externalId) ?? [];
    const file = candidates.shift();
    if (!file) {
      missing.push(song);
      continue;
    }

    matched.push({ song, file });
    if (candidates.length === 0) {
      remainingByExternalId.delete(song.externalId);
    } else {
      remainingByExternalId.set(song.externalId, candidates);
    }
  }

  const unmatchedFiles = Array.from(remainingByExternalId.entries()).flatMap(([externalId, unmatched]) => (
    unmatched.map(file => ({ externalId, file }))
  ));

  return {
    matched,
    missing,
    unmatchedFiles,
  };
}

function cloneNamedListsWithManifestLabels(
  namedLists: Record<string, Set<string>>,
  manifest: UploadedDatasetManifest
): Record<string, Set<string>> {
  const cloned = Object.fromEntries(
    Object.entries(namedLists).map(([label, ids]) => [label, new Set(ids)])
  ) as Record<string, Set<string>>;

  for (const song of manifest.songs) {
    for (const label of song.assignedLabels) {
      if (!cloned[label]) {
        cloned[label] = new Set<string>();
      }
    }
  }

  return cloned;
}

export function reattachUploadedDatasetManifestFiles<TFile extends TrainingSongUploadFile>({
  existingSongs,
  namedLists,
  manifest,
  files,
  createObjectUrl,
}: UploadedDatasetReattachmentInput<TFile>): UploadedDatasetReattachmentResult<TFile> {
  const fileMatches = matchUploadedDatasetManifestFiles({ manifest, files });
  const usedNames = new Set(existingSongs.map(song => normalizeSongName(song.name)));
  const usedIds = new Set(existingSongs.map(song => song.id));
  const attachedSongs: Song[] = [];
  const skipped: TrainingSongUploadSkip[] = [];
  const nextNamedLists = cloneNamedListsWithManifestLabels(namedLists, manifest);

  for (const { song: manifestSong, file } of fileMatches.matched) {
    const normalizedName = normalizeSongName(manifestSong.name);
    if (!isAudioTrainingFile(file)) {
      skipped.push({ name: file.name, reason: 'not-audio' });
      continue;
    }

    if (!normalizedName || usedNames.has(normalizedName)) {
      skipped.push({ name: manifestSong.name, reason: 'duplicate-name' });
      continue;
    }

    let url: string;
    try {
      url = createObjectUrl(file);
    } catch {
      skipped.push({ name: file.name, reason: 'url-error' });
      continue;
    }

    const song: Song = {
      id: createReattachedSongId(manifestSong.songId, manifestSong.name, usedIds),
      name: manifestSong.name,
      url,
      source: 'user',
      externalId: manifestSong.externalId,
    };
    attachedSongs.push(song);
    usedNames.add(normalizedName);

    for (const label of manifestSong.assignedLabels) {
      nextNamedLists[label] ??= new Set<string>();
      nextNamedLists[label].add(song.id);
    }
  }

  return {
    songs: [...existingSongs, ...attachedSongs],
    namedLists: nextNamedLists,
    attachedSongs,
    missing: fileMatches.missing,
    unmatchedFiles: fileMatches.unmatchedFiles,
    skipped,
  };
}

export function removeUploadedTrainingSong({
  songs,
  namedLists,
  songId,
}: UploadedTrainingSongRemovalInput): UploadedTrainingSongRemovalResult {
  const removedSong = songs.find(song => song.id === songId && song.source === 'user') ?? null;
  if (!removedSong) {
    return {
      songs: [...songs],
      namedLists: Object.fromEntries(
        Object.entries(namedLists).map(([label, ids]) => [label, new Set(ids)])
      ) as Record<string, Set<string>>,
      removedSong: null,
    };
  }

  const nextNamedLists = Object.fromEntries(
    Object.entries(namedLists).map(([label, ids]) => {
      const nextIds = new Set(ids);
      nextIds.delete(songId);
      return [label, nextIds];
    })
  ) as Record<string, Set<string>>;

  return {
    songs: songs.filter(song => song.id !== songId),
    namedLists: nextNamedLists,
    removedSong,
  };
}
