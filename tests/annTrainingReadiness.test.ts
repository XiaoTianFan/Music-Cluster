import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnTrainReadiness,
  type AnnTrainReadinessInput,
} from '../src/lib/annTrainingReadiness';

const readyInput: AnnTrainReadinessInput = {
  essentiaWorkerReady: true,
  dataProcessingWorkerReady: true,
  druidWorkerReady: true,
  mlpWorkerReady: true,
  isExtracting: false,
  isProcessingData: false,
  isReducing: false,
  isTraining: false,
  isInferring: false,
  nonEmptyLabelCount: 2,
  assignedSongCount: 4,
  labelsHaveEnoughExamples: true,
  hasFeatureMatrix: true,
};

test('getAnnTrainReadiness allows training when all prerequisites are met', () => {
  assert.deepEqual(getAnnTrainReadiness(readyInput), {
    canTrain: true,
    reason: null,
  });
});

test('getAnnTrainReadiness reports running work before static prerequisites', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    isProcessingData: true,
    nonEmptyLabelCount: 0,
  }), {
    canTrain: false,
    reason: 'Data processing is still running.',
  });
});

test('getAnnTrainReadiness names workers that are still initializing', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    dataProcessingWorkerReady: false,
    mlpWorkerReady: false,
  }), {
    canTrain: false,
    reason: 'Waiting for workers: Data Processing, MLP.',
  });
});

test('getAnnTrainReadiness requires at least two non-empty labels', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    nonEmptyLabelCount: 1,
  }), {
    canTrain: false,
    reason: 'Create at least 2 non-empty labels.',
  });
});

test('getAnnTrainReadiness requires four assigned songs for stratified validation', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    assignedSongCount: 3,
  }), {
    canTrain: false,
    reason: 'Assign at least 4 songs across labels.',
  });
});

test('getAnnTrainReadiness requires every non-empty label to have two songs', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    labelsHaveEnoughExamples: false,
  }), {
    canTrain: false,
    reason: 'Each non-empty label needs at least 2 songs.',
  });
});

test('getAnnTrainReadiness requires a prepared feature matrix', () => {
  assert.deepEqual(getAnnTrainReadiness({
    ...readyInput,
    hasFeatureMatrix: false,
  }), {
    canTrain: false,
    reason: 'Extract features to prepare the training matrix.',
  });
});
