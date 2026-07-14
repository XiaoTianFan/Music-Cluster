import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareAnnUploadedInferenceRawMatrix,
  selectAnnUploadedInferenceInput,
} from '../src/lib/annUploadedInference';
import {
  prepareFeatureMatrix,
  type FeatureMatrix,
  type TrainingPipelineSnapshot,
} from '../src/lib/annPipeline';

const trainingRows = [
  {
    id: 'song-a',
    features: {
      energy: 1,
      mfccMeans: [1, 2],
      mfccStdDevs: [0.1, 0.2],
    },
  },
  {
    id: 'song-b',
    features: {
      energy: 2,
      mfccMeans: [3, 4],
      mfccStdDevs: [0.3, 0.4],
    },
  },
];

const trainedMatrix = prepareFeatureMatrix(trainingRows, ['energy', 'mfcc']);
assert.ok(trainedMatrix);

const baseSnapshot: TrainingPipelineSnapshot = {
  inputKind: 'raw',
  selectedFeatureIds: ['energy', 'mfcc'],
  rawStructure: trainedMatrix.structure,
  rawMatrix: trainedMatrix.matrix,
  processingStats: null,
  reduction: null,
  labelMap: { Rock: 0, Jazz: 1 },
  songIds: ['song-a', 'song-b'],
  inputDimension: trainedMatrix.matrix.columnLabels.length,
};

const uploadedFeatures = {
  energy: 3,
  mfccMeans: [5, 6],
  mfccStdDevs: [0.5, 0.6],
};

test('prepareAnnUploadedInferenceRawMatrix rebuilds the uploaded row with the trained feature structure', () => {
  const result = prepareAnnUploadedInferenceRawMatrix({
    songId: 'uploaded-song',
    features: uploadedFeatures,
    snapshot: baseSnapshot,
  });

  assert.ok(result.matrix);
  assert.equal(result.reason, null);
  assert.deepEqual(result.matrix.songIds, ['uploaded-song']);
  assert.deepEqual(result.matrix.columnLabels, trainedMatrix.matrix.columnLabels);
  assert.deepEqual(result.matrix.isOHEColumn, trainedMatrix.matrix.isOHEColumn);
  assert.deepEqual(result.matrix.vectors, [[3, 5, 6, 0.5, 0.6]]);
});

test('prepareAnnUploadedInferenceRawMatrix rejects rows that do not match the trained feature structure', () => {
  const result = prepareAnnUploadedInferenceRawMatrix({
    songId: 'uploaded-song',
    features: {
      energy: 3,
      mfccMeans: [5, 6, 7],
      mfccStdDevs: [0.5, 0.6],
    },
    snapshot: baseSnapshot,
  });

  assert.equal(result.matrix, null);
  assert.equal(result.reason, 'Uploaded audio did not produce the trained feature structure.');
});

test('selectAnnUploadedInferenceInput uses the raw matrix for raw-trained models', () => {
  const rawMatrix: FeatureMatrix = {
    ...trainedMatrix.matrix,
    songIds: ['uploaded-song'],
    vectors: [[3, 5, 6, 0.5, 0.6]],
  };

  const result = selectAnnUploadedInferenceInput({
    snapshot: baseSnapshot,
    rawMatrix,
    processedVectors: null,
    reducedVectors: null,
  });

  assert.ok(result.selection);
  assert.equal(result.reason, null);
  assert.equal(result.selection.inputKind, 'raw');
  assert.deepEqual(result.selection.songIds, ['uploaded-song']);
  assert.deepEqual(result.selection.vectors, [[3, 5, 6, 0.5, 0.6]]);
});

test('selectAnnUploadedInferenceInput requires transformed vectors for processed-trained models', () => {
  const snapshot: TrainingPipelineSnapshot = {
    ...baseSnapshot,
    inputKind: 'processed',
    inputDimension: 5,
  };

  const rawMatrix: FeatureMatrix = {
    ...trainedMatrix.matrix,
    songIds: ['uploaded-song'],
    vectors: [[3, 5, 6, 0.5, 0.6]],
  };

  const missingProcessed = selectAnnUploadedInferenceInput({
    snapshot,
    rawMatrix,
    processedVectors: null,
    reducedVectors: null,
  });

  assert.equal(missingProcessed.selection, null);
  assert.equal(missingProcessed.reason, 'Uploaded inference needs processed vectors for the trained processed model.');

  const processed = selectAnnUploadedInferenceInput({
    snapshot,
    rawMatrix,
    processedVectors: [[0, 1, 2, 3, 4]],
    reducedVectors: null,
  });

  assert.ok(processed.selection);
  assert.equal(processed.selection.inputKind, 'processed');
  assert.deepEqual(processed.selection.songIds, ['uploaded-song']);
  assert.deepEqual(processed.selection.vectors, [[0, 1, 2, 3, 4]]);
});

test('selectAnnUploadedInferenceInput validates reduced vectors against the trained model dimension', () => {
  const snapshot: TrainingPipelineSnapshot = {
    ...baseSnapshot,
    inputKind: 'reduced',
    inputDimension: 2,
    reduction: {
      method: 'pca',
      dimensions: 2,
      sourceKind: 'processed',
      trainingVectors: trainedMatrix.matrix.vectors,
    },
  };

  const rawMatrix: FeatureMatrix = {
    ...trainedMatrix.matrix,
    songIds: ['uploaded-song'],
    vectors: [[3, 5, 6, 0.5, 0.6]],
  };

  const malformedReduced = selectAnnUploadedInferenceInput({
    snapshot,
    rawMatrix,
    processedVectors: [[0, 1, 2, 3, 4]],
    reducedVectors: [[0.4, 0.6, 0.8]],
  });

  assert.equal(malformedReduced.selection, null);
  assert.equal(
    malformedReduced.reason,
    'Uploaded reduced inference data has 3 columns, but the trained model expects 2.'
  );

  const reduced = selectAnnUploadedInferenceInput({
    snapshot,
    rawMatrix,
    processedVectors: [[0, 1, 2, 3, 4]],
    reducedVectors: [[0.4, 0.6]],
  });

  assert.ok(reduced.selection);
  assert.equal(reduced.selection.inputKind, 'reduced');
  assert.deepEqual(reduced.selection.songIds, ['uploaded-song']);
  assert.deepEqual(reduced.selection.vectors, [[0.4, 0.6]]);
});
