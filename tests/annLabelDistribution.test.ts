import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnLabelDistribution,
  type AnnNamedLists,
} from '../src/lib/annLabelDistribution';

const namedLists: AnnNamedLists = {
  Rock: new Set(['song-a', 'song-b', 'song-c']),
  Jazz: new Set(['song-d']),
  Empty: new Set(),
  Classical: new Set(['song-e', 'song-f']),
};

test('getAnnLabelDistribution summarizes active labels and assigned samples', () => {
  const summary = getAnnLabelDistribution(namedLists);

  assert.equal(summary.totalLabelCount, 4);
  assert.equal(summary.nonEmptyLabelCount, 3);
  assert.equal(summary.assignedSongCount, 6);
  assert.equal(summary.readyLabelCount, 2);
  assert.deepEqual(summary.labelsBelowMinimum, ['Jazz']);
});

test('getAnnLabelDistribution preserves label order and annotates each label status', () => {
  const summary = getAnnLabelDistribution(namedLists);

  assert.deepEqual(summary.rows, [
    {
      label: 'Rock',
      count: 3,
      status: 'ready',
      message: 'Ready',
    },
    {
      label: 'Jazz',
      count: 1,
      status: 'too-small',
      message: 'Needs 1 more',
    },
    {
      label: 'Empty',
      count: 0,
      status: 'empty',
      message: 'Empty',
    },
    {
      label: 'Classical',
      count: 2,
      status: 'ready',
      message: 'Ready',
    },
  ]);
});

test('getAnnLabelDistribution supports custom minimum samples per label', () => {
  const summary = getAnnLabelDistribution(namedLists, 3);

  assert.equal(summary.readyLabelCount, 1);
  assert.deepEqual(summary.labelsBelowMinimum, ['Jazz', 'Classical']);
  assert.equal(summary.rows[3].message, 'Needs 1 more');
});

test('getAnnLabelDistribution handles no labels', () => {
  assert.deepEqual(getAnnLabelDistribution({}), {
    totalLabelCount: 0,
    nonEmptyLabelCount: 0,
    assignedSongCount: 0,
    readyLabelCount: 0,
    minimumSamplesPerLabel: 2,
    labelsBelowMinimum: [],
    rows: [],
  });
});
