import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnTrainingPipelineSnapshot } from '../src/lib/annTrainingPipelineSnapshot';
import type {
  FeatureMatrix,
  FeatureMatrixStructure,
  ProcessingStats,
} from '../src/lib/annPipeline';

const rawStructure: FeatureMatrixStructure = {
  featureKeys: ['energy', 'rms'],
  keyValues: [],
  scaleValues: [],
  arrayLengths: {},
  columnLabels: ['energy', 'rms'],
  isOHEColumn: [false, false],
};

const rawMatrix: FeatureMatrix = {
  vectors: [
    [1, 0.5],
    [2, 0.8],
  ],
  songIds: ['song-a', 'song-b'],
  columnLabels: ['energy', 'rms'],
  isOHEColumn: [false, false],
};

const processingStats: ProcessingStats = {
  method: 'standardize',
  isOHEColumn: [false, false],
  means: [1.5, 0.65],
  stdDevs: [0.5, 0.15],
};

const baseInput = {
  inputKind: 'raw' as const,
  selectedFeatureIds: ['energy', 'rms'],
  rawStructure,
  rawMatrix,
  processingStats: null,
  reductionMethod: 'pca' as const,
  reductionDimensions: 2,
  processedData: null,
  labelMap: { Rock: 0, Jazz: 1 },
  songIds: ['song-a', 'song-b'],
  inputDimension: 2,
};

test('createAnnTrainingPipelineSnapshot builds raw snapshots with normalized feature ids and cloned inputs', () => {
  const result = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    selectedFeatureIds: ['energy', 'invalid-feature', 'rms', 'energy'],
  });

  assert.ok(result.snapshot);
  assert.equal(result.reason, null);
  assert.equal(result.snapshot.inputKind, 'raw');
  assert.deepEqual(result.snapshot.selectedFeatureIds, ['energy', 'rms']);
  assert.equal(result.snapshot.reduction, null);
  assert.deepEqual(result.snapshot.rawMatrix.vectors, rawMatrix.vectors);
  assert.deepEqual(result.snapshot.rawStructure.columnLabels, rawStructure.columnLabels);

  rawMatrix.vectors[0][0] = 999;
  assert.deepEqual(result.snapshot.rawMatrix.vectors, [[1, 0.5], [2, 0.8]]);
  rawMatrix.vectors[0][0] = 1;
});

test('createAnnTrainingPipelineSnapshot requires processing stats for processed snapshots', () => {
  const missingStats = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'processed',
    processingStats: null,
  });

  assert.equal(missingStats.snapshot, null);
  assert.equal(
    missingStats.reason,
    'Cannot train: Processed model snapshots require processing stats. Reprocess data first.'
  );

  const result = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'processed',
    processingStats,
  });

  assert.ok(result.snapshot);
  assert.equal(result.snapshot.inputKind, 'processed');
  assert.deepEqual(result.snapshot.processingStats, processingStats);

  processingStats.means![0] = 999;
  assert.deepEqual(result.snapshot.processingStats?.means, [1.5, 0.65]);
  processingStats.means![0] = 1.5;
});

test('createAnnTrainingPipelineSnapshot stores processed training vectors for reduced snapshots when available', () => {
  const result = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'reduced',
    processingStats,
    inputDimension: 2,
    reductionDimensions: 2,
    processedData: {
      vectors: [
        [-1, -1],
        [1, 1],
      ],
      songIds: ['song-a', 'song-b'],
    },
  });

  assert.ok(result.snapshot);
  assert.equal(result.reason, null);
  assert.deepEqual(result.snapshot.reduction, {
    method: 'pca',
    dimensions: 2,
    sourceKind: 'processed',
    trainingVectors: [[-1, -1], [1, 1]],
    perplexity: 30,
    neighbors: 15,
    minDist: 0.1,
  });
});

test('createAnnTrainingPipelineSnapshot falls back to raw training vectors for reduced snapshots', () => {
  const result = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'reduced',
    processingStats: null,
    reductionDimensions: 2,
    processedData: null,
  });

  assert.ok(result.snapshot);
  assert.deepEqual(result.snapshot.reduction?.trainingVectors, [[1, 0.5], [2, 0.8]]);
  assert.equal(result.snapshot.reduction?.sourceKind, 'raw');
});

test('createAnnTrainingPipelineSnapshot rejects invalid persisted features and malformed reduced settings', () => {
  const noFeatures = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    selectedFeatureIds: ['not-a-feature'],
  });

  assert.equal(noFeatures.snapshot, null);
  assert.equal(
    noFeatures.reason,
    'Cannot train: No selected feature IDs can be persisted for inference.'
  );

  const invalidDimensions = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'reduced',
    reductionDimensions: 0,
  });

  assert.equal(invalidDimensions.snapshot, null);
  assert.equal(
    invalidDimensions.reason,
    'Cannot train: Reduction snapshot dimensions must be a positive integer.'
  );

  const malformedTrainingVectors = createAnnTrainingPipelineSnapshot({
    ...baseInput,
    inputKind: 'reduced',
    processedData: {
      vectors: [[1, 2], [3]],
      songIds: ['song-a', 'song-b'],
    },
  });

  assert.equal(malformedTrainingVectors.snapshot, null);
  assert.equal(
    malformedTrainingVectors.reason,
    'Cannot train: Reduction training vectors are inconsistent. Reprocess or reduce data first.'
  );
});
