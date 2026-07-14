import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnFeatureSignalDimensionLabels,
  getAnnFeatureSignalLabelsForSongIds,
  getAnnFeatureSignalRowsForSongAssignments,
  getAnnFeatureSignalSummary,
} from '../src/lib/annFeatureSignal';

test('getAnnFeatureSignalSummary ranks input dimensions by label separation', () => {
  const summary = getAnnFeatureSignalSummary({
    inputKind: 'raw',
    vectors: [
      [1, 10, 0],
      [1, 12, 1],
      [5, 11, 0],
      [5, 13, 1],
    ],
    labels: ['Rock', 'Rock', 'Jazz', 'Jazz'],
    dimensionLabels: ['energy', 'rms', 'key:C'],
  });

  assert.ok(summary);
  assert.equal(summary.inputKind, 'raw');
  assert.equal(summary.labeledRowCount, 4);
  assert.equal(summary.labelCount, 2);
  assert.equal(summary.dimensionCount, 3);
  assert.equal(summary.rows[0].dimensionLabel, 'energy');
  assert.equal(summary.rows[0].scoreLabel, 'Strong signal');
  assert.equal(summary.rows[0].strongestLabel, 'Jazz');
  assert.equal(summary.rows[0].weakestLabel, 'Rock');
  assert.equal(summary.rows[0].meanRange, 4);
  assert.equal(summary.rows[0].score, 1);
  assert.equal(summary.rows[1].dimensionLabel, 'rms');
  assert.equal(Number(summary.rows[1].score.toFixed(3)), 0.2);
  assert.equal(summary.rows[2].dimensionLabel, 'key:C');
  assert.equal(summary.rows[2].scoreLabel, 'No separation');
  assert.equal(summary.summary, 'Top signal: energy separates labels strongest (strong signal, 100.0%).');
});

test('getAnnFeatureSignalSummary rejects incomplete training inputs', () => {
  assert.equal(getAnnFeatureSignalSummary({
    inputKind: 'processed',
    vectors: [[1, 2], [3]],
    labels: ['A', 'B'],
    dimensionLabels: ['x', 'y'],
  }), null);

  assert.equal(getAnnFeatureSignalSummary({
    inputKind: 'raw',
    vectors: [[1], [2]],
    labels: ['Only', 'Only'],
    dimensionLabels: ['energy'],
  }), null);
});

test('getAnnFeatureSignalDimensionLabels names raw, processed, and reduced dimensions', () => {
  assert.deepEqual(getAnnFeatureSignalDimensionLabels({
    inputKind: 'raw',
    inputDimension: 2,
    rawColumnLabels: ['energy', 'rms'],
  }), ['energy', 'rms']);

  assert.deepEqual(getAnnFeatureSignalDimensionLabels({
    inputKind: 'processed',
    inputDimension: 2,
    rawColumnLabels: ['energy', 'rms'],
  }), ['energy', 'rms']);

  assert.deepEqual(getAnnFeatureSignalDimensionLabels({
    inputKind: 'reduced',
    inputDimension: 2,
    rawColumnLabels: ['energy', 'rms'],
    reductionMethod: 'pca',
  }), ['PCA 1', 'PCA 2']);

  assert.deepEqual(getAnnFeatureSignalDimensionLabels({
    inputKind: 'raw',
    inputDimension: 2,
    rawColumnLabels: ['energy'],
  }), ['Input 1', 'Input 2']);
});

test('getAnnFeatureSignalLabelsForSongIds rebuilds label order from assignments', () => {
  assert.deepEqual(getAnnFeatureSignalLabelsForSongIds({
    songIds: ['song-b', 'song-a', 'song-c'],
    namedLists: {
      Rock: ['song-a', 'song-b'],
      Jazz: ['song-c'],
    },
  }), ['Rock', 'Rock', 'Jazz']);

  assert.equal(getAnnFeatureSignalLabelsForSongIds({
    songIds: ['song-a', 'missing'],
    namedLists: {
      Rock: ['song-a'],
    },
  }), null);
});

test('getAnnFeatureSignalRowsForSongAssignments keeps only assigned model-input rows', () => {
  const rows = getAnnFeatureSignalRowsForSongAssignments({
    songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
    vectors: [[1], [2], [3], [4]],
    namedLists: {
      Left: ['song-d', 'song-b'],
      Right: ['song-a'],
    },
  });

  assert.deepEqual(rows, {
    songIds: ['song-a', 'song-b', 'song-d'],
    vectors: [[1], [2], [4]],
    labels: ['Right', 'Left', 'Left'],
  });

  assert.equal(getAnnFeatureSignalRowsForSongAssignments({
    songIds: ['song-a'],
    vectors: [[1]],
    namedLists: {
      Missing: ['song-z'],
    },
  }), null);
});
