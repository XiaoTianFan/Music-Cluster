import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnnProcessStatus, type AnnProcessStatusInput } from '../src/lib/annProcessStatus';

const readyInput: AnnProcessStatusInput = {
  allWorkersReady: true,
  isExtracting: false,
  isProcessingData: false,
  isReducing: false,
  isTraining: false,
  isInferring: false,
};

test('getAnnProcessStatus reports worker initialization before process states', () => {
  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    allWorkersReady: false,
    isTraining: true,
  }), {
    text: 'Initializing Workers...',
    tone: 'loading',
  });
});

test('getAnnProcessStatus reports active ANN pipeline stages in UI priority order', () => {
  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isExtracting: true,
    isTraining: true,
  }), {
    text: 'Extracting Features...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isProcessingData: true,
    isInferring: true,
  }), {
    text: 'Processing Data...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isReducing: true,
  }), {
    text: 'Reducing Dimensions...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isTraining: true,
  }), {
    text: 'Training Network...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isInferring: true,
  }), {
    text: 'Inferring Labels...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isValidating: true,
  }), {
    text: 'Running Validation...',
    tone: 'active',
  });

  assert.deepEqual(getAnnProcessStatus({
    ...readyInput,
    isAnalyzingPermutationImportance: true,
  }), {
    text: 'Analyzing Feature Impact...',
    tone: 'active',
  });
});

test('getAnnProcessStatus reports ready when workers are ready and no ANN process is active', () => {
  assert.deepEqual(getAnnProcessStatus(readyInput), {
    text: 'Ready',
    tone: 'ready',
  });
});
