import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnDatasetInferReadiness,
  getAnnUploadedInferReadiness,
  type AnnDatasetInferReadinessInput,
  type AnnUploadedInferReadinessInput,
} from '../src/lib/annInferenceReadiness';

const datasetReadyInput: AnnDatasetInferReadinessInput = {
  essentiaWorkerReady: true,
  dataProcessingWorkerReady: true,
  druidWorkerReady: true,
  mlpWorkerReady: true,
  isExtracting: false,
  isProcessingData: false,
  isReducing: false,
  isTraining: false,
  isInferring: false,
  isModelTrained: true,
  labelMapSize: 2,
  hasTrainingPipelineSnapshot: true,
  trainingInputKind: 'processed',
  hasRawData: true,
  hasProcessedData: true,
  hasReducedData: false,
};

const uploadedReadyInput: AnnUploadedInferReadinessInput = {
  essentiaWorkerReady: true,
  dataProcessingWorkerReady: true,
  druidWorkerReady: true,
  mlpWorkerReady: true,
  isExtracting: false,
  isProcessingData: false,
  isReducing: false,
  isTraining: false,
  isInferring: false,
  isModelTrained: true,
  hasTrainingPipelineSnapshot: true,
  trainingInputKind: 'processed',
  hasInferenceFile: true,
  hasAudioContext: true,
  hasProcessingStats: true,
  hasReductionSnapshot: false,
  reductionMethod: null,
};

test('getAnnDatasetInferReadiness allows inference when trained data is available', () => {
  assert.deepEqual(getAnnDatasetInferReadiness(datasetReadyInput), {
    canInfer: true,
    reason: null,
  });
});

test('getAnnDatasetInferReadiness reports running inference first', () => {
  assert.deepEqual(getAnnDatasetInferReadiness({
    ...datasetReadyInput,
    isInferring: true,
    isModelTrained: false,
  }), {
    canInfer: false,
    reason: 'Inference is already running.',
  });
});

test('getAnnDatasetInferReadiness requires the trained model and pipeline snapshot', () => {
  assert.deepEqual(getAnnDatasetInferReadiness({
    ...datasetReadyInput,
    isModelTrained: false,
  }), {
    canInfer: false,
    reason: 'Train a model before inference.',
  });

  assert.deepEqual(getAnnDatasetInferReadiness({
    ...datasetReadyInput,
    hasTrainingPipelineSnapshot: false,
  }), {
    canInfer: false,
    reason: 'Training pipeline snapshot is missing. Retrain first.',
  });
});

test('getAnnDatasetInferReadiness requires data matching the trained input kind', () => {
  assert.deepEqual(getAnnDatasetInferReadiness({
    ...datasetReadyInput,
    trainingInputKind: 'reduced',
    hasReducedData: false,
  }), {
    canInfer: false,
    reason: 'Current data no longer matches the trained reduced input. Retrain first.',
  });
});

test('getAnnUploadedInferReadiness requires an uploaded audio file', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    hasInferenceFile: false,
  }), {
    canInfer: false,
    reason: 'Choose an audio file for uploaded inference.',
  });
});

test('getAnnUploadedInferReadiness blocks non-PCA reduced uploaded inference', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    trainingInputKind: 'reduced',
    hasReductionSnapshot: true,
    reductionMethod: 'umap',
  }), {
    canInfer: false,
    reason: 'UMAP cannot place uploaded songs in ANN v1. Train without reduction or use PCA.',
  });
});

test('getAnnUploadedInferReadiness allows PCA-reduced uploaded inference', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    trainingInputKind: 'reduced',
    hasReductionSnapshot: true,
    reductionMethod: 'pca',
  }), {
    canInfer: true,
    reason: null,
  });
});

test('getAnnUploadedInferReadiness allows raw-source PCA uploaded inference without processing stats', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    trainingInputKind: 'reduced',
    hasProcessingStats: false,
    hasReductionSnapshot: true,
    reductionMethod: 'pca',
    reductionSourceKind: 'raw',
  }), {
    canInfer: true,
    reason: null,
  });
});

test('getAnnUploadedInferReadiness requires processing stats for processed-source PCA uploaded inference', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    trainingInputKind: 'reduced',
    hasProcessingStats: false,
    hasReductionSnapshot: true,
    reductionMethod: 'pca',
    reductionSourceKind: 'processed',
  }), {
    canInfer: false,
    reason: 'Training processing stats are missing. Retrain first.',
  });
});

test('getAnnUploadedInferReadiness requires processing stats for processed models', () => {
  assert.deepEqual(getAnnUploadedInferReadiness({
    ...uploadedReadyInput,
    hasProcessingStats: false,
  }), {
    canInfer: false,
    reason: 'Training processing stats are missing. Retrain first.',
  });
});
