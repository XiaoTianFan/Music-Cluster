import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnModelComparisonSetupSuggestion,
} from '../src/lib/annModelComparisonSetup';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';

function createRun(overrides: Partial<AnnModelComparisonRun>): AnnModelComparisonRun {
  return {
    id: overrides.id ?? 'ann-train-1',
    runNumber: overrides.runNumber ?? 1,
    trainedAt: overrides.trainedAt ?? '2026-06-17T10:00:00.000Z',
    inputKind: overrides.inputKind ?? 'raw',
    inputDimension: overrides.inputDimension ?? 2,
    selectedFeatureIds: overrides.selectedFeatureIds ?? ['energy'],
    trainingAccuracy: overrides.trainingAccuracy ?? 0.75,
    trainingLoss: overrides.trainingLoss ?? 0.24,
    datasetAccuracy: overrides.datasetAccuracy ?? null,
    datasetCorrectPredictions: overrides.datasetCorrectPredictions ?? null,
    datasetTotalSongs: overrides.datasetTotalSongs ?? null,
    majorityBaselineAccuracy: overrides.majorityBaselineAccuracy ?? null,
    majorityBaselineDelta: overrides.majorityBaselineDelta ?? null,
    validationAccuracy: overrides.validationAccuracy ?? null,
    validationCorrectPredictions: overrides.validationCorrectPredictions ?? null,
    validationTotalPredictions: overrides.validationTotalPredictions ?? null,
    validationFoldCount: overrides.validationFoldCount ?? null,
    validationLowConfidenceCount: overrides.validationLowConfidenceCount ?? null,
    reviewStatus: overrides.reviewStatus ?? 'unreviewed',
    note: overrides.note ?? '',
    warningCodes: overrides.warningCodes ?? [],
  };
}

test('getAnnModelComparisonSetupSuggestion starts a new comparison with raw training setup', () => {
  const suggestion = getAnnModelComparisonSetupSuggestion([]);

  assert.equal(suggestion.targetInputKind, 'raw');
  assert.equal(suggestion.canApplySetup, true);
  assert.equal(suggestion.actionLabel, 'Apply Raw Setup');
  assert.deepEqual(suggestion.settings, {
    processingMethod: 'none',
    useDimensionalityReduction: false,
    reductionMethod: 'pca',
    targetDimensions: 2,
  });
  assert.equal(suggestion.clearsProcessedData, true);
  assert.equal(suggestion.clearsReducedData, true);
  assert.match(suggestion.nextStep, /Train Automatic/);
});

test('getAnnModelComparisonSetupSuggestion recommends PCA reduced setup for missing reduced coverage', () => {
  const suggestion = getAnnModelComparisonSetupSuggestion([
    createRun({ id: 'ann-train-1', inputKind: 'raw' }),
    createRun({
      id: 'ann-train-2',
      runNumber: 2,
      inputKind: 'processed',
      datasetAccuracy: 0.8,
      validationAccuracy: 0.75,
    }),
  ]);

  assert.equal(suggestion.targetInputKind, 'reduced');
  assert.equal(suggestion.actionLabel, 'Apply PCA Setup');
  assert.deepEqual(suggestion.settings, {
    processingMethod: 'standardize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 2,
  });
  assert.equal(suggestion.clearsProcessedData, true);
  assert.equal(suggestion.clearsReducedData, true);
  assert.match(suggestion.nextStep, /Process Data/);
  assert.match(suggestion.nextStep, /Reduce Dimensions/);
});

test('getAnnModelComparisonSetupSuggestion does not apply setup once all pipelines are evaluated', () => {
  const suggestion = getAnnModelComparisonSetupSuggestion([
    createRun({ id: 'ann-train-1', inputKind: 'raw', datasetAccuracy: 0.7 }),
    createRun({ id: 'ann-train-2', runNumber: 2, inputKind: 'processed', datasetAccuracy: 0.8 }),
    createRun({ id: 'ann-train-3', runNumber: 3, inputKind: 'reduced', datasetAccuracy: 0.82 }),
  ]);

  assert.equal(suggestion.targetInputKind, null);
  assert.equal(suggestion.canApplySetup, false);
  assert.equal(suggestion.actionLabel, 'Compare Evaluated Runs');
  assert.equal(suggestion.settings, null);
  assert.equal(suggestion.clearsProcessedData, false);
  assert.equal(suggestion.clearsReducedData, false);
  assert.match(suggestion.nextStep, /Compare dataset accuracy/);
});
