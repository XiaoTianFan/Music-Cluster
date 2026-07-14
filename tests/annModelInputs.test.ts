import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnTrainingDataset,
  selectAnnDatasetInferenceInput,
  selectAnnTrainingInput,
} from '../src/lib/annModelInputs';
import type { FeatureMatrix, TrainingPipelineSnapshot } from '../src/lib/annPipeline';

const rawMatrix: FeatureMatrix = {
  vectors: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  songIds: ['song-a', 'song-b'],
  isOHEColumn: [false, false, false],
  columnLabels: ['energy', 'rms', 'bpm'],
};

const processedData = {
  vectors: [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ],
  songIds: ['song-a', 'song-b'],
};

const baseSnapshot: Pick<TrainingPipelineSnapshot, 'inputKind' | 'inputDimension'> = {
  inputKind: 'processed',
  inputDimension: 3,
};

test('selectAnnTrainingInput prefers reduced, then processed, then raw data', () => {
  const reducedSelection = selectAnnTrainingInput({
    useDimensionalityReduction: true,
    reducedDataPoints: {
      'song-a': [0.1, 0.2],
      'song-b': [0.3, 0.4],
    },
    processedData,
    unprocessedData: rawMatrix,
  });

  assert.ok(reducedSelection.selection);
  assert.equal(reducedSelection.reason, null);
  assert.equal(reducedSelection.selection.inputKind, 'reduced');
  assert.equal(reducedSelection.selection.inputDimension, 2);
  assert.deepEqual(reducedSelection.selection.songIds, ['song-a', 'song-b']);
  assert.deepEqual(reducedSelection.selection.vectors, [[0.1, 0.2], [0.3, 0.4]]);
  assert.equal(reducedSelection.selection.logMessage, 'Using reduced data for training.');

  const processedSelection = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {
      'song-a': [0.1, 0.2],
    },
    processedData,
    unprocessedData: rawMatrix,
  });

  assert.ok(processedSelection.selection);
  assert.equal(processedSelection.selection.inputKind, 'processed');
  assert.equal(processedSelection.selection.inputDimension, 3);
  assert.equal(processedSelection.selection.logMessage, 'Using processed data for training.');

  const rawSelection = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {},
    processedData: null,
    unprocessedData: rawMatrix,
  });

  assert.ok(rawSelection.selection);
  assert.equal(rawSelection.selection.inputKind, 'raw');
  assert.equal(rawSelection.selection.inputDimension, 3);
  assert.equal(rawSelection.selection.logMessage, 'Using raw/unprocessed data for training.');
});

test('selectAnnTrainingInput rejects missing or malformed selected data instead of silently falling back', () => {
  const missingSelection = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {},
    processedData: null,
    unprocessedData: null,
  });

  assert.equal(missingSelection.selection, null);
  assert.equal(
    missingSelection.reason,
    'Cannot train: No suitable data available (unprocessed, processed, or reduced).'
  );

  const malformedProcessedSelection = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {},
    processedData: {
      vectors: [[1, 2], [3]],
      songIds: ['song-a', 'song-b'],
    },
    unprocessedData: rawMatrix,
  });

  assert.equal(malformedProcessedSelection.selection, null);
  assert.equal(
    malformedProcessedSelection.reason,
    'Cannot train: Processed data has inconsistent vector dimensions. Rebuild features first.'
  );
});

test('selectAnnDatasetInferenceInput requires the current data kind to match the trained snapshot', () => {
  const processedSelection = selectAnnDatasetInferenceInput({
    snapshot: baseSnapshot,
    reducedDataPoints: {
      'song-a': [0.1, 0.2],
      'song-b': [0.3, 0.4],
    },
    processedData,
    unprocessedData: rawMatrix,
  });

  assert.ok(processedSelection.selection);
  assert.equal(processedSelection.reason, null);
  assert.equal(processedSelection.selection.inputKind, 'processed');
  assert.deepEqual(processedSelection.selection.songIds, ['song-a', 'song-b']);
  assert.equal(processedSelection.selection.logMessage, 'Using processed data for inference.');

  const missingMatchingInput = selectAnnDatasetInferenceInput({
    snapshot: {
      inputKind: 'reduced',
      inputDimension: 2,
    },
    reducedDataPoints: {},
    processedData,
    unprocessedData: rawMatrix,
  });

  assert.equal(missingMatchingInput.selection, null);
  assert.equal(
    missingMatchingInput.reason,
    'Cannot infer: Current data no longer matches the trained model input. Retrain first.'
  );
});

test('selectAnnDatasetInferenceInput catches stale vector dimensions before calling the MLP worker', () => {
  const staleProcessedSelection = selectAnnDatasetInferenceInput({
    snapshot: baseSnapshot,
    reducedDataPoints: {},
    processedData: {
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      songIds: ['song-a', 'song-b'],
    },
    unprocessedData: rawMatrix,
  });

  assert.equal(staleProcessedSelection.selection, null);
  assert.equal(
    staleProcessedSelection.reason,
    'Cannot infer: Current processed data has 2 columns, but the trained model expects 3. Retrain first.'
  );
});

test('createAnnTrainingDataset filters labeled rows and uses the first labeled song for activation sampling', () => {
  const source = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {},
    processedData: {
      vectors: [
        [99, 99, 99],
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
        [4, 4, 4],
      ],
      songIds: ['unlabeled-first', 'rock-a', 'jazz-a', 'rock-b', 'jazz-b'],
    },
    unprocessedData: rawMatrix,
  });

  assert.ok(source.selection);

  const dataset = createAnnTrainingDataset({
    source: source.selection,
    namedLists: {
      Rock: new Set(['rock-a', 'rock-b']),
      Jazz: new Set(['jazz-a', 'jazz-b']),
    },
  });

  assert.ok(dataset.dataset);
  assert.equal(dataset.reason, null);
  assert.deepEqual(dataset.dataset.trainingSongIds, ['rock-a', 'rock-b', 'jazz-a', 'jazz-b']);
  assert.deepEqual(dataset.dataset.trainingVectors, [
    [1, 1, 1],
    [3, 3, 3],
    [2, 2, 2],
    [4, 4, 4],
  ]);
  assert.deepEqual(dataset.dataset.trainingLabels, ['Rock', 'Rock', 'Jazz', 'Jazz']);
  assert.deepEqual(Array.from(dataset.dataset.labelMap), [['Rock', 0], ['Jazz', 1]]);
  assert.deepEqual(dataset.dataset.labelMapObject, { Rock: 0, Jazz: 1 });
  assert.deepEqual(dataset.dataset.labelCounts, { Rock: 2, Jazz: 2 });
  assert.equal(dataset.dataset.activationSampleSongId, 'rock-a');
});

test('createAnnTrainingDataset reports labels that do not have enough usable rows', () => {
  const source = selectAnnTrainingInput({
    useDimensionalityReduction: false,
    reducedDataPoints: {},
    processedData,
    unprocessedData: rawMatrix,
  });

  assert.ok(source.selection);

  const dataset = createAnnTrainingDataset({
    source: source.selection,
    namedLists: {
      Rock: new Set(['song-a', 'song-b']),
      Missing: new Set(['not-in-current-data']),
    },
  });

  assert.equal(dataset.dataset, null);
  assert.equal(
    dataset.reason,
    'Cannot train: Each label needs at least 2 songs for a train/validation split. Add more songs to: Missing.'
  );
});
