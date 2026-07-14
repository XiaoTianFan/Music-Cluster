import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnnRouteLabelState } from '../src/lib/annRouteState';

const songs = [
  { id: 'song-a' },
  { id: 'song-b' },
  { id: 'song-c' },
  { id: 'song-d' },
];

test('getAnnRouteLabelState counts only active labels for model output dimensions', () => {
  const result = getAnnRouteLabelState({
    songs,
    namedLists: {
      Empty: new Set<string>(),
      Rock: new Set(['song-a', 'song-b']),
      Jazz: new Set(['song-c']),
      Ambient: new Set<string>(),
    },
  });

  assert.deepEqual(Array.from(result.labelMap.entries()), [
    ['Rock', 0],
    ['Jazz', 1],
  ]);
  assert.equal(result.outputDimension, 2);
  assert.equal(result.nonEmptyLabelCount, 2);
  assert.equal(result.assignedSongCount, 3);
  assert.equal(result.labelsHaveEnoughExamples, false);
});

test('getAnnRouteLabelState returns unassigned song ids and true labels for visualization', () => {
  const result = getAnnRouteLabelState({
    songs,
    namedLists: {
      Rock: new Set(['song-a', 'song-b']),
      Jazz: new Set(['song-c']),
    },
  });

  assert.deepEqual(result.unassignedSongIds, ['song-d']);
  assert.deepEqual(result.trueLabels, {
    'song-a': 'Rock',
    'song-b': 'Rock',
    'song-c': 'Jazz',
  });
});

test('getAnnRouteLabelState treats no active labels as not ready but dimension zero', () => {
  const result = getAnnRouteLabelState({
    songs,
    namedLists: {
      Empty: new Set<string>(),
    },
  });

  assert.deepEqual(Array.from(result.labelMap.entries()), []);
  assert.equal(result.outputDimension, 0);
  assert.equal(result.nonEmptyLabelCount, 0);
  assert.equal(result.assignedSongCount, 0);
  assert.equal(result.labelsHaveEnoughExamples, false);
  assert.deepEqual(result.unassignedSongIds, ['song-a', 'song-b', 'song-c', 'song-d']);
  assert.deepEqual(result.trueLabels, {});
});
