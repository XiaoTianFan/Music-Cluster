import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUploadedDatasetManifest,
  createUploadedTrainingSongExternalId,
  describeUploadedTrainingSongExternalId,
  ingestUploadedTrainingSongs,
  isAudioTrainingFile,
  matchUploadedDatasetManifestFiles,
  reattachUploadedDatasetManifestFiles,
  removeUploadedTrainingSong,
  type TrainingSongUploadFile,
} from '../src/lib/annUploadedSongs';
import type { Song } from '../src/lib/annPipeline';

const existingSongs: Song[] = [
  {
    id: '/audio/default.mp3',
    name: 'Default Track.mp3',
    url: '/audio/default.mp3',
    source: 'default',
  },
];

function file(
  name: string,
  type = '',
  overrides: Partial<TrainingSongUploadFile> = {}
): TrainingSongUploadFile {
  return { name, type, ...overrides };
}

test('isAudioTrainingFile accepts audio MIME types and common audio extensions', () => {
  assert.equal(isAudioTrainingFile(file('mixdown.wav', 'audio/wav')), true);
  assert.equal(isAudioTrainingFile(file('master.FLAC')), true);
  assert.equal(isAudioTrainingFile(file('voice memo.m4a')), true);
  assert.equal(isAudioTrainingFile(file('cover.png', 'image/png')), false);
  assert.equal(isAudioTrainingFile(file('notes.txt')), false);
});

test('ingestUploadedTrainingSongs creates deterministic user songs for accepted files', () => {
  const createdFor: string[] = [];
  const result = ingestUploadedTrainingSongs({
    existingSongs,
    files: [
      file('Lead Guitar.wav', 'audio/wav'),
      file('Room Take.mp3', '', { size: 4096, lastModified: 1780000000000 }),
    ],
    createObjectUrl: upload => {
      createdFor.push(upload.name);
      return `blob:${upload.name}`;
    },
  });

  assert.deepEqual(createdFor, ['Lead Guitar.wav', 'Room Take.mp3']);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.songs, [
    {
      id: 'user-upload-lead-guitar',
      name: 'Lead Guitar.wav',
      url: 'blob:Lead Guitar.wav',
      source: 'user',
      externalId: 'browser-file:lead-guitar-wav:unknown-size:unknown-modified',
    },
    {
      id: 'user-upload-room-take',
      name: 'Room Take.mp3',
      url: 'blob:Room Take.mp3',
      source: 'user',
      externalId: 'browser-file:room-take-mp3:4096:1780000000000',
    },
  ]);
});

test('createUploadedTrainingSongExternalId creates a stable metadata signature without object URLs', () => {
  assert.equal(
    createUploadedTrainingSongExternalId(file('  Lead Guitar.WAV  ', 'audio/wav', { size: 2048, lastModified: 1780000000000 })),
    'browser-file:lead-guitar-wav:2048:1780000000000'
  );
  assert.equal(
    createUploadedTrainingSongExternalId(file('Take #1.mp3')),
    'browser-file:take-1-mp3:unknown-size:unknown-modified'
  );
});

test('describeUploadedTrainingSongExternalId formats portable file metadata', () => {
  assert.deepEqual(
    describeUploadedTrainingSongExternalId('browser-file:lead-guitar-wav:2048:1780000000000'),
    {
      sizeBytes: 2048,
      modifiedMs: 1780000000000,
      sizeLabel: '2 KB',
      modifiedLabel: '2026-05-28 20:26 UTC',
    }
  );

  assert.deepEqual(
    describeUploadedTrainingSongExternalId('browser-file:take-1-mp3:unknown-size:unknown-modified'),
    {
      sizeBytes: null,
      modifiedMs: null,
      sizeLabel: 'Unknown size',
      modifiedLabel: 'Unknown modified',
    }
  );

  assert.deepEqual(
    describeUploadedTrainingSongExternalId('legacy-id'),
    {
      sizeBytes: null,
      modifiedMs: null,
      sizeLabel: 'Unknown size',
      modifiedLabel: 'Unknown modified',
    }
  );
});

test('ingestUploadedTrainingSongs skips duplicate and non-audio files without creating object URLs', () => {
  const createdFor: string[] = [];
  const result = ingestUploadedTrainingSongs({
    existingSongs,
    files: [
      file('Default Track.mp3', 'audio/mpeg'),
      file('notes.txt', 'text/plain'),
      file('Fresh Take.wav', 'audio/wav'),
      file('fresh take.wav', 'audio/wav'),
    ],
    createObjectUrl: upload => {
      createdFor.push(upload.name);
      return `blob:${upload.name}`;
    },
  });

  assert.deepEqual(createdFor, ['Fresh Take.wav']);
  assert.deepEqual(result.songs.map(song => song.name), ['Fresh Take.wav']);
  assert.deepEqual(result.skipped, [
    { name: 'Default Track.mp3', reason: 'duplicate-name' },
    { name: 'notes.txt', reason: 'not-audio' },
    { name: 'fresh take.wav', reason: 'duplicate-name' },
  ]);
});

test('ingestUploadedTrainingSongs keeps generated IDs unique when slugs collide', () => {
  const result = ingestUploadedTrainingSongs({
    existingSongs: [
      ...existingSongs,
      {
        id: 'user-upload-live-take',
        name: 'Someone Else.mp3',
        url: 'blob:existing',
        source: 'user',
      },
    ],
    files: [
      file('Live Take.wav', 'audio/wav'),
      file('Live-Take.mp3', 'audio/mpeg'),
    ],
    createObjectUrl: upload => `blob:${upload.name}`,
  });

  assert.deepEqual(result.songs.map(song => song.id), [
    'user-upload-live-take-2',
    'user-upload-live-take-3',
  ]);
});

test('removeUploadedTrainingSong removes uploaded songs and returns the object URL for cleanup', () => {
  const songs: Song[] = [
    ...existingSongs,
    {
      id: 'user-upload-live-take',
      name: 'Live Take.wav',
      url: 'blob:live-take',
      source: 'user',
    },
  ];
  const namedLists = {
    Rock: new Set(['user-upload-live-take', '/audio/default.mp3']),
    Jazz: new Set(['user-upload-live-take']),
    Empty: new Set<string>(),
  };

  const result = removeUploadedTrainingSong({
    songs,
    namedLists,
    songId: 'user-upload-live-take',
  });

  assert.equal(result.removedSong?.url, 'blob:live-take');
  assert.deepEqual(result.songs, existingSongs);
  assert.deepEqual(result.namedLists.Rock, new Set(['/audio/default.mp3']));
  assert.deepEqual(result.namedLists.Jazz, new Set<string>());
  assert.deepEqual(result.namedLists.Empty, new Set<string>());
});

test('removeUploadedTrainingSong leaves default songs and input state untouched', () => {
  const namedLists = {
    Rock: new Set(['/audio/default.mp3']),
  };

  const result = removeUploadedTrainingSong({
    songs: existingSongs,
    namedLists,
    songId: '/audio/default.mp3',
  });

  assert.equal(result.removedSong, null);
  assert.deepEqual(result.songs, existingSongs);
  assert.deepEqual(result.namedLists.Rock, new Set(['/audio/default.mp3']));
  assert.notEqual(result.namedLists.Rock, namedLists.Rock);
  assert.deepEqual(namedLists.Rock, new Set(['/audio/default.mp3']));
});

test('createUploadedDatasetManifest captures uploaded song identities and label assignments without blob URLs', () => {
  const songs: Song[] = [
    ...existingSongs,
    {
      id: 'user-upload-lead-guitar',
      name: 'Lead Guitar.wav',
      url: 'blob:lead-guitar',
      source: 'user',
      externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
    },
    {
      id: 'user-upload-room-take',
      name: 'Room Take.mp3',
      url: 'blob:room-take',
      source: 'user',
      externalId: 'browser-file:room-take-mp3:4096:1780000001000',
    },
  ];

  const manifest = createUploadedDatasetManifest({
    songs,
    namedLists: {
      Rock: new Set(['user-upload-lead-guitar', '/audio/default.mp3']),
      Jazz: new Set(['user-upload-room-take']),
      Empty: new Set<string>(),
    },
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.userSongCount, 2);
  assert.equal(manifest.assignedUserSongCount, 2);
  assert.deepEqual(manifest.songs, [
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
      assignedLabels: ['Jazz'],
    },
  ]);
  assert.equal(JSON.stringify(manifest).includes('blob:'), false);
});

test('matchUploadedDatasetManifestFiles matches selected files by external id and reports missing songs', () => {
  const manifest = createUploadedDatasetManifest({
    songs: [
      {
        id: 'user-upload-lead-guitar',
        name: 'Lead Guitar.wav',
        url: 'blob:lead-guitar',
        source: 'user',
        externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
      },
      {
        id: 'user-upload-room-take',
        name: 'Room Take.mp3',
        url: 'blob:room-take',
        source: 'user',
        externalId: 'browser-file:room-take-mp3:4096:1780000001000',
      },
    ],
    namedLists: {
      Rock: new Set(['user-upload-lead-guitar', 'user-upload-room-take']),
    },
  });

  const result = matchUploadedDatasetManifestFiles({
    manifest,
    files: [
      file('Lead Guitar.wav', 'audio/wav', { size: 2048, lastModified: 1780000000000 }),
      file('Other.wav', 'audio/wav', { size: 99, lastModified: 1780000002000 }),
    ],
  });

  assert.deepEqual(result.matched.map(item => ({
    songId: item.song.songId,
    fileName: item.file.name,
  })), [
    { songId: 'user-upload-lead-guitar', fileName: 'Lead Guitar.wav' },
  ]);
  assert.deepEqual(result.missing.map(song => song.songId), ['user-upload-room-take']);
  assert.deepEqual(result.unmatchedFiles.map(item => item.file.name), ['Other.wav']);
});

test('reattachUploadedDatasetManifestFiles restores matched uploaded songs and label assignments', () => {
  const manifest = createUploadedDatasetManifest({
    songs: [
      {
        id: 'user-upload-lead-guitar',
        name: 'Lead Guitar.wav',
        url: 'blob:lead-guitar',
        source: 'user',
        externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
      },
      {
        id: 'user-upload-room-take',
        name: 'Room Take.mp3',
        url: 'blob:room-take',
        source: 'user',
        externalId: 'browser-file:room-take-mp3:4096:1780000001000',
      },
    ],
    namedLists: {
      Rock: new Set(['user-upload-lead-guitar']),
      Jazz: new Set(['user-upload-room-take']),
    },
  });
  const createdFor: string[] = [];

  const result = reattachUploadedDatasetManifestFiles({
    existingSongs,
    namedLists: {
      Rock: new Set(['/audio/default.mp3']),
    },
    manifest,
    files: [
      file('Lead Guitar.wav', 'audio/wav', { size: 2048, lastModified: 1780000000000 }),
      file('Other.wav', 'audio/wav', { size: 99, lastModified: 1780000002000 }),
    ],
    createObjectUrl: upload => {
      createdFor.push(upload.name);
      return `blob:new:${upload.name}`;
    },
  });

  assert.deepEqual(createdFor, ['Lead Guitar.wav']);
  assert.deepEqual(result.attachedSongs, [
    {
      id: 'user-upload-lead-guitar',
      name: 'Lead Guitar.wav',
      url: 'blob:new:Lead Guitar.wav',
      source: 'user',
      externalId: 'browser-file:lead-guitar-wav:2048:1780000000000',
    },
  ]);
  assert.deepEqual(result.songs, [...existingSongs, ...result.attachedSongs]);
  assert.deepEqual(result.namedLists.Rock, new Set(['/audio/default.mp3', 'user-upload-lead-guitar']));
  assert.deepEqual(result.namedLists.Jazz, new Set<string>());
  assert.deepEqual(result.missing.map(song => song.songId), ['user-upload-room-take']);
  assert.deepEqual(result.unmatchedFiles.map(item => item.file.name), ['Other.wav']);
  assert.deepEqual(result.skipped, []);
  assert.equal(JSON.stringify(result.attachedSongs).includes('blob:lead-guitar'), false);
});
