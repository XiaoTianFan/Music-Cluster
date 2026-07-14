import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandFeatureIds,
  prepareFeatureMatrix,
  prepareFeatureMatrixWithStructure,
  type Features,
} from '../src/lib/annPipeline';

const featureRows: Array<{ id: string; features: Features }> = [
  {
    id: 'song-a',
    features: {
      energy: 1,
      entropy: 0.1,
      key: 'C',
      keyScale: 'major',
      keyStrength: 0.9,
      mfccMeans: [1, 2],
      mfccStdDevs: [0.1, 0.2],
    },
  },
  {
    id: 'song-b',
    features: {
      energy: 2,
      entropy: 0.2,
      key: 'A',
      keyScale: 'minor',
      keyStrength: 0.8,
      mfccMeans: [3, 4],
      mfccStdDevs: [0.3, 0.4],
    },
  },
];

test('expandFeatureIds maps UI feature choices to canonical data columns', () => {
  assert.deepEqual(expandFeatureIds(['mfcc', 'key', 'energy']), [
    'energy',
    'keyStrength',
    'mfccMeans',
    'mfccStdDevs',
    'key',
    'keyScale',
  ]);
});

test('prepareFeatureMatrix produces stable numeric vectors, labels, and OHE flags', () => {
  const result = prepareFeatureMatrix(featureRows, ['energy', 'key', 'mfcc']);

  assert.ok(result);
  assert.deepEqual(result.matrix.songIds, ['song-a', 'song-b']);
  assert.deepEqual(result.matrix.columnLabels, [
    'energy',
    'keyStrength',
    'mfccMeans[0]',
    'mfccMeans[1]',
    'mfccStdDevs[0]',
    'mfccStdDevs[1]',
    'Key: A',
    'Key: C',
    'Scale: major',
    'Scale: minor',
  ]);
  assert.deepEqual(result.matrix.isOHEColumn, [
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(result.matrix.vectors, [
    [1, 0.9, 1, 2, 0.1, 0.2, 0, 1, 1, 0],
    [2, 0.8, 3, 4, 0.3, 0.4, 1, 0, 0, 1],
  ]);
});

test('prepareFeatureMatrixWithStructure rejects uploaded inference rows that do not match trained vector shape', () => {
  const result = prepareFeatureMatrix(featureRows, ['mfcc']);
  assert.ok(result);

  const malformedUploadedRow = {
    id: 'upload',
    features: {
      mfccMeans: [1, 2, 3],
      mfccStdDevs: [0.1, 0.2],
    },
  };

  assert.equal(
    prepareFeatureMatrixWithStructure([malformedUploadedRow], result.structure),
    null
  );
});
