import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnnModelComparisonRun,
  getAnnModelComparisonBenchmark,
  getAnnModelComparisonGuidance,
  getAnnModelComparisonView,
  getBestAnnModelComparisonRun,
  removeAnnModelComparisonRun,
  updateAnnModelComparisonRunReview,
  updateAnnModelComparisonRunValidation,
  updateAnnModelComparisonRunEvaluation,
} from '../src/lib/annModelComparison';
import type { AnnEvaluationSummary } from '../src/lib/annEvaluation';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';
import type { AnnValidationExecutionSummary } from '../src/lib/annValidationExecution';

function createTrainingSummary(overrides: Partial<AnnTrainingSummary> = {}): AnnTrainingSummary {
  return {
    inputKind: 'processed',
    selectedFeatureIds: ['energy', 'rms'],
    inputDimension: 2,
    labeledSongCount: 8,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 4 },
      { label: 'Jazz', count: 4 },
    ],
    warnings: [],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 50,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 32,
    seed: 42,
    finalLoss: 0.125,
    finalAccuracy: 0.875,
    ...overrides,
  };
}

function createEvaluationSummary(overrides: Partial<AnnEvaluationSummary> = {}): AnnEvaluationSummary {
  return {
    actualLabels: ['Rock', 'Jazz'],
    predictedLabels: ['Rock', 'Jazz'],
    confusionMatrix: [
      [3, 1],
      [0, 4],
    ],
    rows: [
      {
        label: 'Rock',
        support: 4,
        predictedCount: 3,
        truePositive: 3,
        falsePositive: 0,
        falseNegative: 1,
        precision: 1,
        recall: 0.75,
        f1: 6 / 7,
      },
      {
        label: 'Jazz',
        support: 4,
        predictedCount: 5,
        truePositive: 4,
        falsePositive: 1,
        falseNegative: 0,
        precision: 0.8,
        recall: 1,
        f1: 8 / 9,
      },
    ],
    totalSongs: 8,
    predictedSongCount: 8,
    correctPredictions: 7,
    accuracy: 0.875,
    majorityBaselineLabel: 'Rock',
    majorityBaselineAccuracy: 0.5,
    missingPredictionCount: 0,
    unknownPredictionCount: 0,
    confidenceCount: 8,
    averageConfidence: 0.82,
    minConfidence: 0.61,
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 1,
    ...overrides,
  };
}

function createValidationSummary(overrides: Partial<AnnValidationExecutionSummary> = {}): AnnValidationExecutionSummary {
  return {
    foldCount: 4,
    totalPredictions: 8,
    correctPredictions: 6,
    accuracy: 0.75,
    missingPredictionCount: 1,
    confidenceCount: 7,
    averageConfidence: 0.78,
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 2,
    ...overrides,
  };
}

test('createAnnModelComparisonRun captures the training summary fields needed for comparing runs', () => {
  const run = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 2,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({
      inputKind: 'reduced',
      inputDimension: 3,
      selectedFeatureIds: ['mfcc', 'energy'],
      finalAccuracy: 0.8125,
      finalLoss: 0.24,
      warnings: [
        {
          code: 'under-sampled-labels',
          message: 'Some labels have fewer than 5 songs.',
        },
      ],
    }),
  });

  assert.deepEqual(run, {
    id: 'ann-train-1',
    runNumber: 2,
    trainedAt: '2026-06-17T10:00:00.000Z',
    inputKind: 'reduced',
    inputDimension: 3,
    selectedFeatureIds: ['mfcc', 'energy'],
    trainingAccuracy: 0.8125,
    trainingLoss: 0.24,
    datasetAccuracy: null,
    datasetCorrectPredictions: null,
    datasetTotalSongs: null,
    majorityBaselineAccuracy: null,
    majorityBaselineDelta: null,
    validationAccuracy: null,
    validationCorrectPredictions: null,
    validationTotalPredictions: null,
    validationFoldCount: null,
    validationLowConfidenceCount: null,
    reviewStatus: 'unreviewed',
    note: '',
    warningCodes: ['under-sampled-labels'],
  });
});

test('updateAnnModelComparisonRunReview stores a bounded note and review marker without mutating previous rows', () => {
  const firstRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.75 }),
  });
  const secondRun = createAnnModelComparisonRun({
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-06-17T10:05:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.875 }),
  });
  const longNote = `  ${'needs another balanced dataset pass '.repeat(20)}  `;

  const updated = updateAnnModelComparisonRunReview({
    runs: [firstRun, secondRun],
    runId: 'ann-train-2',
    reviewStatus: 'promising',
    note: longNote,
  });

  assert.equal(updated[0], firstRun);
  assert.equal(updated[1].reviewStatus, 'promising');
  assert.equal(updated[1].note.length, 240);
  assert.match(updated[1].note, /^needs another balanced dataset pass/);
  assert.notEqual(updated[1], secondRun);
  assert.equal(secondRun.reviewStatus, 'unreviewed');
  assert.equal(secondRun.note, '');
});

test('removeAnnModelComparisonRun deletes only the selected history row without mutating the source', () => {
  const firstRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-07-15T09:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw' }),
  });
  const secondRun = createAnnModelComparisonRun({
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-07-15T09:05:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'processed' }),
  });
  const runs = [firstRun, secondRun];

  const remainingRuns = removeAnnModelComparisonRun({ runs, runId: firstRun.id });

  assert.deepEqual(remainingRuns.map(run => run.id), [secondRun.id]);
  assert.deepEqual(runs.map(run => run.id), [firstRun.id, secondRun.id]);
  assert.notStrictEqual(remainingRuns, runs);
});

test('updateAnnModelComparisonRunEvaluation attaches dataset metrics without mutating previous rows', () => {
  const firstRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.75 }),
  });
  const secondRun = createAnnModelComparisonRun({
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-06-17T10:05:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.875 }),
  });
  const runs = [firstRun, secondRun];

  const updated = updateAnnModelComparisonRunEvaluation({
    runs,
    runId: 'ann-train-2',
    evaluationSummary: createEvaluationSummary(),
  });

  assert.notEqual(updated, runs);
  assert.equal(updated[0], firstRun);
  assert.deepEqual(updated[1], {
    ...secondRun,
    datasetAccuracy: 0.875,
    datasetCorrectPredictions: 7,
    datasetTotalSongs: 8,
    majorityBaselineAccuracy: 0.5,
    majorityBaselineDelta: 0.375,
  });
});

test('updateAnnModelComparisonRunValidation attaches validation metrics without mutating previous rows', () => {
  const firstRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.75 }),
  });
  const secondRun = createAnnModelComparisonRun({
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-06-17T10:05:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.875 }),
  });
  const runs = [firstRun, secondRun];

  const updated = updateAnnModelComparisonRunValidation({
    runs,
    runId: 'ann-train-2',
    validationSummary: createValidationSummary(),
  });

  assert.notEqual(updated, runs);
  assert.equal(updated[0], firstRun);
  assert.deepEqual(updated[1], {
    ...secondRun,
    validationAccuracy: 0.75,
    validationCorrectPredictions: 6,
    validationTotalPredictions: 8,
    validationFoldCount: 4,
    validationLowConfidenceCount: 2,
  });
});

test('getBestAnnModelComparisonRun prefers evaluated dataset accuracy, then validation accuracy, over training accuracy', () => {
  const rawRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.99 }),
  });
  const processedRun = updateAnnModelComparisonRunEvaluation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-2',
      runNumber: 2,
      trainedAt: '2026-06-17T10:05:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.8 }),
    })],
    runId: 'ann-train-2',
    evaluationSummary: createEvaluationSummary({ accuracy: 0.875 }),
  })[0];
  const validationRun = updateAnnModelComparisonRunValidation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-3',
      runNumber: 3,
      trainedAt: '2026-06-17T10:10:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'reduced', finalAccuracy: 0.79 }),
    })],
    runId: 'ann-train-3',
    validationSummary: createValidationSummary({ accuracy: 0.9 }),
  })[0];

  assert.equal(getBestAnnModelComparisonRun([rawRun, validationRun]), validationRun);
  assert.equal(getBestAnnModelComparisonRun([rawRun, validationRun, processedRun]), processedRun);
});

test('getAnnModelComparisonView filters by review marker and ranks by best available quality signal', () => {
  const rawRun = updateAnnModelComparisonRunReview({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-1',
      runNumber: 1,
      trainedAt: '2026-06-17T10:00:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.98 }),
    })],
    runId: 'ann-train-1',
    reviewStatus: 'discard',
    note: 'Overfit baseline.',
  })[0];
  const processedRun = updateAnnModelComparisonRunReview({
    runs: updateAnnModelComparisonRunEvaluation({
      runs: [createAnnModelComparisonRun({
        id: 'ann-train-2',
        runNumber: 2,
        trainedAt: '2026-06-17T10:05:00.000Z',
        trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.7 }),
      })],
      runId: 'ann-train-2',
      evaluationSummary: createEvaluationSummary({ accuracy: 0.82 }),
    }),
    runId: 'ann-train-2',
    reviewStatus: 'keep',
    note: 'Solid dataset result.',
  })[0];
  const reducedRun = updateAnnModelComparisonRunReview({
    runs: updateAnnModelComparisonRunValidation({
      runs: [createAnnModelComparisonRun({
        id: 'ann-train-3',
        runNumber: 3,
        trainedAt: '2026-06-17T10:10:00.000Z',
        trainingSummary: createTrainingSummary({ inputKind: 'reduced', finalAccuracy: 0.74 }),
      })],
      runId: 'ann-train-3',
      validationSummary: createValidationSummary({ accuracy: 0.9 }),
    }),
    runId: 'ann-train-3',
    reviewStatus: 'keep',
    note: 'Strong validation, still needs dataset inference.',
  })[0];

  const view = getAnnModelComparisonView({
    runs: [rawRun, processedRun, reducedRun],
    reviewFilter: 'keep',
    sortMode: 'best-quality',
  });

  assert.equal(view.totalCount, 3);
  assert.equal(view.visibleCount, 2);
  assert.equal(view.hiddenCount, 1);
  assert.deepEqual(view.rankedRuns.map(item => ({
    rank: item.rank,
    runId: item.run.id,
    scoreLabel: item.scoreLabel,
  })), [
    { rank: 1, runId: 'ann-train-2', scoreLabel: 'Dataset 82.0%' },
    { rank: 2, runId: 'ann-train-3', scoreLabel: 'Validation 90.0%' },
  ]);
});

test('getAnnModelComparisonView can sort visible runs by newest run number', () => {
  const firstRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.72 }),
  });
  const secondRun = createAnnModelComparisonRun({
    id: 'ann-train-2',
    runNumber: 2,
    trainedAt: '2026-06-17T10:05:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.68 }),
  });

  const view = getAnnModelComparisonView({
    runs: [firstRun, secondRun],
    reviewFilter: 'all',
    sortMode: 'newest',
  });

  assert.deepEqual(view.rankedRuns.map(item => ({
    rank: item.rank,
    runId: item.run.id,
  })), [
    { rank: 1, runId: 'ann-train-2' },
    { rank: 2, runId: 'ann-train-1' },
  ]);
});

test('getAnnModelComparisonBenchmark compares each input pipeline against the live model', () => {
  const rawRun = updateAnnModelComparisonRunEvaluation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-1',
      runNumber: 1,
      trainedAt: '2026-06-17T10:00:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.7 }),
    })],
    runId: 'ann-train-1',
    evaluationSummary: createEvaluationSummary({ accuracy: 0.76 }),
  })[0];
  const liveProcessedRun = updateAnnModelComparisonRunEvaluation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-2',
      runNumber: 2,
      trainedAt: '2026-06-17T10:05:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.82 }),
    })],
    runId: 'ann-train-2',
    evaluationSummary: createEvaluationSummary({ accuracy: 0.82 }),
  })[0];
  const reducedRun = updateAnnModelComparisonRunValidation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-3',
      runNumber: 3,
      trainedAt: '2026-06-17T10:10:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'reduced', finalAccuracy: 0.9 }),
    })],
    runId: 'ann-train-3',
    validationSummary: createValidationSummary({ accuracy: 0.9 }),
  })[0];

  const benchmark = getAnnModelComparisonBenchmark({
    runs: [rawRun, liveProcessedRun, reducedRun],
    activeRunId: 'ann-train-2',
  });

  assert.equal(benchmark.activeRun?.id, 'ann-train-2');
  assert.equal(benchmark.summary, 'Live model Run 2 uses processed input with dataset 82.0%.');
  assert.deepEqual(benchmark.rows.map(row => ({
    inputKind: row.inputKind,
    bestRunId: row.bestRun?.id ?? null,
    scoreLabel: row.scoreLabel,
    isLiveModel: row.isLiveModel,
    deltaLabel: row.deltaLabel,
  })), [
    {
      inputKind: 'raw',
      bestRunId: 'ann-train-1',
      scoreLabel: 'Dataset 76.0%',
      isLiveModel: false,
      deltaLabel: '-6.0 pts vs live',
    },
    {
      inputKind: 'processed',
      bestRunId: 'ann-train-2',
      scoreLabel: 'Dataset 82.0%',
      isLiveModel: true,
      deltaLabel: 'Live model',
    },
    {
      inputKind: 'reduced',
      bestRunId: 'ann-train-3',
      scoreLabel: 'Validation 90.0%',
      isLiveModel: false,
      deltaLabel: '+8.0 pts vs live',
    },
  ]);
});

test('getAnnModelComparisonGuidance recommends the next missing input pipeline first', () => {
  const processedRun = updateAnnModelComparisonRunValidation({
    runs: updateAnnModelComparisonRunEvaluation({
      runs: [createAnnModelComparisonRun({
        id: 'ann-train-1',
        runNumber: 1,
        trainedAt: '2026-06-17T10:00:00.000Z',
        trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.8 }),
      })],
      runId: 'ann-train-1',
      evaluationSummary: createEvaluationSummary({ accuracy: 0.875 }),
    }),
    runId: 'ann-train-1',
    validationSummary: createValidationSummary({ accuracy: 0.75 }),
  })[0];

  const guidance = getAnnModelComparisonGuidance([processedRun]);

  assert.equal(guidance.nextInputKind, 'raw');
  assert.equal(guidance.nextAction, 'train');
  assert.match(guidance.recommendation, /Train a raw input run next/);
  assert.deepEqual(guidance.coverage.map(item => ({
    inputKind: item.inputKind,
    status: item.status,
    runCount: item.runCount,
  })), [
    { inputKind: 'raw', status: 'missing', runCount: 0 },
    { inputKind: 'processed', status: 'evaluated', runCount: 1 },
    { inputKind: 'reduced', status: 'missing', runCount: 0 },
  ]);
});

test('getAnnModelComparisonGuidance recommends validation for trained-but-unvalidated coverage', () => {
  const rawRun = createAnnModelComparisonRun({
    id: 'ann-train-1',
    runNumber: 1,
    trainedAt: '2026-06-17T10:00:00.000Z',
    trainingSummary: createTrainingSummary({ inputKind: 'raw', finalAccuracy: 0.72 }),
  });
  const processedRun = updateAnnModelComparisonRunValidation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-2',
      runNumber: 2,
      trainedAt: '2026-06-17T10:05:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'processed', finalAccuracy: 0.8 }),
    })],
    runId: 'ann-train-2',
    validationSummary: createValidationSummary({ accuracy: 0.75 }),
  })[0];
  const reducedRun = updateAnnModelComparisonRunEvaluation({
    runs: [createAnnModelComparisonRun({
      id: 'ann-train-3',
      runNumber: 3,
      trainedAt: '2026-06-17T10:10:00.000Z',
      trainingSummary: createTrainingSummary({ inputKind: 'reduced', finalAccuracy: 0.78 }),
    })],
    runId: 'ann-train-3',
    evaluationSummary: createEvaluationSummary({ accuracy: 0.82 }),
  })[0];

  const guidance = getAnnModelComparisonGuidance([rawRun, processedRun, reducedRun]);

  assert.equal(guidance.nextInputKind, 'raw');
  assert.equal(guidance.nextAction, 'validate');
  assert.match(guidance.recommendation, /Run validation for the raw input run/);
  assert.equal(guidance.coverage.find(item => item.inputKind === 'raw')?.status, 'trained');
  assert.equal(guidance.coverage.find(item => item.inputKind === 'processed')?.status, 'validated');
  assert.equal(guidance.coverage.find(item => item.inputKind === 'reduced')?.status, 'evaluated');
});
