import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ANNControlsPanel, { DEFAULT_MLP_CONFIG } from '../src/components/ANNControlsPanel';
import type { AnnEvaluationSummary } from '../src/lib/annEvaluation';
import type { AnnFeatureSignalSummary } from '../src/lib/annFeatureSignal';
import { getAnnLabelDistribution } from '../src/lib/annLabelDistribution';
import type { AnnModelComparisonRun } from '../src/lib/annModelComparison';
import type { AnnPermutationImportanceSummary } from '../src/lib/annPermutationImportance';
import type { AnnTrainingSummary } from '../src/lib/annTrainingSummary';
import type { AnnValidationExecutionPlanResult, AnnValidationExecutionSummary, AnnValidationFoldRunResult } from '../src/lib/annValidationExecution';
import type { AnnValidationPlanResult } from '../src/lib/annValidationPlan';

type AnnControlsProps = React.ComponentProps<typeof ANNControlsPanel>;

const noop = () => {};

function renderPanel(overrides: Partial<AnnControlsProps> = {}): string {
  const props: AnnControlsProps = {
    essentiaWorkerReady: true,
    dataProcessingWorkerReady: true,
    druidWorkerReady: true,
    mlpWorkerReady: true,
    isExtracting: false,
    isProcessingData: false,
    isReducing: false,
    isTraining: false,
    isInferring: false,
    canProcess: false,
    canReduce: false,
    canTrain: false,
    trainDisabledReason: 'Each non-empty label needs at least 2 songs.',
    labelDistribution: getAnnLabelDistribution({
      Rock: new Set(['song-a', 'song-b']),
      Jazz: new Set(['song-c']),
    }),
    canInfer: false,
    inferDisabledReason: 'Train a model before inference.',
    trainingSummary: null,
    featureSignalSummary: null,
    evaluationSummary: null,
    permutationImportanceSummary: null,
    permutationImportanceError: null,
    canRunPermutationImportance: false,
    permutationImportanceDisabledReason: 'Run dataset inference before feature impact analysis.',
    isAnalyzingPermutationImportance: false,
    canExportPermutationImportance: false,
    permutationImportanceExportDisabledReason: 'Run feature impact analysis before exporting.',
    validationPlan: null,
    validationExecutionPlan: null,
    canRunValidation: false,
    validationRunDisabledReason: 'Train a model before running validation.',
    isValidating: false,
    validationRunProgress: null,
    validationRunSummary: null,
    validationRunFoldResults: null,
    validationRunError: null,
    canExportValidationSummary: false,
    validationExportDisabledReason: 'Run validation before exporting a summary.',
    canExportTrainedModel: false,
    trainedModelExportDisabledReason: 'Train a model before exporting it.',
    trainedModelImportDisabledReason: null,
    pendingUploadedDatasetCount: 0,
    pendingUploadedDatasetSongs: [],
    uploadedDatasetReattachmentReview: null,
    uploadedDatasetReattachDisabledReason: 'Import setup with uploaded-song identities before reattaching files.',
    useDimensionalityReduction: false,
    onReductionChoiceChange: noop,
    processingMethod: 'standardize',
    onProcessingMethodChange: noop,
    reductionMethod: 'umap',
    targetDimensions: 2,
    onTargetDimensionsChange: noop,
    networkConfig: DEFAULT_MLP_CONFIG,
    setNetworkConfig: noop,
    onExtractFeatures: noop,
    onProcessData: noop,
    onReduceDimensions: noop,
    onTrain: noop,
    onInfer: noop,
    onRunPermutationImportance: noop,
    onCancelPermutationImportance: noop,
    onExportPermutationImportance: noop,
    onRunValidation: noop,
    onExportValidationSummary: noop,
    onExportTrainedModel: noop,
    onImportTrainedModel: noop,
    onExportAnnSetup: noop,
    onImportAnnSetup: noop,
    onReattachUploadedDataset: noop,
    onContinueWithAttachedUploadedDataset: noop,
    onExportModelComparisonHistory: noop,
    onImportModelComparisonHistory: noop,
    onApplyModelComparisonSetup: noop,
    onUpdateModelComparisonReview: noop,
    onDeleteModelComparisonRun: noop,
    inferenceFile: null,
    inferenceError: null,
    uploadedInferenceResult: null,
    onInferenceFileChange: noop,
    onInferUploadedAudio: noop,
    canChooseInferenceFile: false,
    inferenceFileDisabledReason: 'Train a model before choosing uploaded audio.',
    canInferUploadedAudio: false,
    uploadedInferDisabledReason: 'Choose an audio file for uploaded inference.',
    modelComparisonRuns: [],
    selectedFeatures: new Set(),
    onSelectedFeaturesChange: noop,
    canExportRawFeatures: false,
    onOpenExportRawFeatures: noop,
    ...overrides,
  };

  return renderToStaticMarkup(React.createElement(ANNControlsPanel, props));
}

function getElementById(markup: string, id: string): string {
  const match = markup.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
  assert.ok(match, `Expected markup to include element with id="${id}"`);
  return match[0];
}

test('ANNControlsPanel renders label distribution and disabled reasons', () => {
  const html = renderPanel();

  assert.match(html, /Label samples/);
  assert.match(html, /3 songs \/ 2 active labels/);
  assert.match(html, /Rock/);
  assert.match(html, /Ready/);
  assert.match(html, /Jazz/);
  assert.match(html, /Needs 1 more/);
  assert.match(html, /Each non-empty label needs at least 2 songs\./);
  assert.match(html, /Train a model before inference\./);
  assert.match(html, /Train a model before choosing uploaded audio\./);
  assert.match(html, /Choose an audio file for uploaded inference\./);
  assert.match(html, /Export Labels &amp; Setup/);
  assert.match(html, /Import Labels &amp; Setup/);

  const trainButton = html.match(/<button[^>]*>Train Network<\/button>/)?.[0] ?? '';
  assert.match(trainButton, /disabled=""/);
  assert.match(trainButton, /title="Each non-empty label needs at least 2 songs\."/);
});

test('ANNControlsPanel can enable the uploaded-audio picker before uploaded inference is ready', () => {
  const html = renderPanel({
    canChooseInferenceFile: true,
    inferenceFileDisabledReason: null,
    uploadedInferDisabledReason: 'Choose an audio file for uploaded inference.',
  });

  const fileInput = getElementById(html, 'annInferenceFile');
  assert.doesNotMatch(fileInput, /disabled=""/);
  assert.match(html, /Choose an audio file for uploaded inference\./);
});

test('ANNControlsPanel renders trained-model portability actions', () => {
  const html = renderPanel({
    canExportTrainedModel: true,
    trainedModelExportDisabledReason: null,
    trainedModelImportDisabledReason: null,
  });

  assert.match(html, /Trained model portability/);
  assert.match(html, /Export Trained Model/);
  assert.match(html, /Import Trained Model/);

  const exportButton = html.match(/<button[^>]*>Export Trained Model<\/button>/)?.[0] ?? '';
  const importButton = html.match(/<button[^>]*>Import Trained Model<\/button>/)?.[0] ?? '';
  assert.doesNotMatch(exportButton, /disabled=""/);
  assert.doesNotMatch(importButton, /disabled=""/);
  const trainingIndex = html.indexOf('5. Training');
  const portabilityIndex = html.indexOf('Trained model portability');
  const inferenceIndex = html.indexOf('6. Inference');
  assert.ok(trainingIndex < portabilityIndex);
  assert.ok(portabilityIndex < inferenceIndex);
  assert.ok(html.indexOf('Setup portability') < inferenceIndex);
});

test('ANNControlsPanel renders imported trained-model comparison context', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'processed',
    selectedFeatureIds: ['energy', 'rms', 'mfcc'],
    inputDimension: 3,
    labeledSongCount: 6,
    classCount: 2,
    labelCounts: [
      { label: 'Warm', count: 3 },
      { label: 'Bright', count: 3 },
    ],
    warnings: [
      {
        code: 'small-training-set',
        message: 'Only 6 labeled songs are available.',
      },
      {
        code: 'under-sampled-labels',
        message: 'Some labels have fewer than 5 songs.',
      },
    ],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 50,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 32,
    seed: 2026,
    finalLoss: 0.21,
    finalAccuracy: 0.88,
  };
  const modelComparisonRuns: AnnModelComparisonRun[] = [
    {
      id: 'ann-imported-run',
      runNumber: 7,
      trainedAt: '2026-06-17T10:00:00.000Z',
      inputKind: 'processed',
      inputDimension: 3,
      selectedFeatureIds: ['energy', 'rms', 'mfcc'],
      trainingAccuracy: 0.88,
      trainingLoss: 0.21,
      datasetAccuracy: 0.8,
      datasetCorrectPredictions: 8,
      datasetTotalSongs: 10,
      majorityBaselineAccuracy: 0.5,
      majorityBaselineDelta: 0.3,
      validationAccuracy: 0.7,
      validationCorrectPredictions: 7,
      validationTotalPredictions: 10,
      validationFoldCount: 5,
      validationLowConfidenceCount: 2,
      reviewStatus: 'keep',
      note: 'Imported model worth comparing against the next PCA run.',
      warningCodes: ['small-training-set', 'under-sampled-labels'],
    },
  ];

  const html = renderPanel({
    trainingSummary,
    canExportTrainedModel: true,
    trainedModelExportDisabledReason: null,
    trainedModelContextSource: 'imported',
    activeModelComparisonRunId: 'ann-imported-run',
    modelComparisonRuns,
  });

  assert.match(html, /Imported model context/);
  assert.match(html, /Run 7/);
  assert.match(html, /Keep/);
  assert.match(html, /processed \/ 3 dims/);
  assert.match(html, /Training/);
  assert.match(html, /88\.0%/);
  assert.match(html, /Dataset/);
  assert.match(html, /80\.0%/);
  assert.match(html, /Validation/);
  assert.match(html, /70\.0%/);
  assert.match(html, /Small training set/);
  assert.match(html, /Under-sampled labels/);
  assert.match(html, /Imported model worth comparing against the next PCA run\./);
});

test('ANNControlsPanel renders pending uploaded-dataset reattachment', () => {
  const html = renderPanel({
    pendingUploadedDatasetCount: 2,
    pendingUploadedDatasetSongs: [
      { name: 'Lead Guitar.wav', assignedLabels: ['Rock'], externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' },
      { name: 'Room Take.mp3', assignedLabels: [] },
    ],
    uploadedDatasetReattachDisabledReason: null,
  });

  assert.match(html, /2 uploaded songs need file reattachment\./);
  assert.match(html, /Expected files \(2\)/);
  assert.match(html, /File/);
  assert.match(html, /Labels/);
  assert.match(html, /Size/);
  assert.match(html, /Modified/);
  assert.match(html, /Lead Guitar\.wav/);
  assert.match(html, /Rock/);
  assert.match(html, /2 KB/);
  assert.match(html, /2026-05-28 20:26 UTC/);
  assert.match(html, /Room Take\.mp3/);
  assert.match(html, /Unassigned/);
  assert.match(html, /Unknown size/);
  assert.match(html, /Unknown modified/);
  assert.match(html, /Reattach Uploaded Files/);

  const reattachButton = html.match(/<button[^>]*>Reattach Uploaded Files<\/button>/)?.[0] ?? '';
  assert.doesNotMatch(reattachButton, /disabled=""/);
  assert.match(reattachButton, /title="Select the uploaded audio files referenced by the imported setup\."/);
});

test('ANNControlsPanel summarizes overflowing uploaded-dataset expected files', () => {
  const html = renderPanel({
    pendingUploadedDatasetCount: 5,
    pendingUploadedDatasetSongs: [
      { name: 'Lead Guitar.wav', assignedLabels: ['Rock'], externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' },
      { name: 'Room Take.mp3', assignedLabels: [] },
      { name: 'Bass.wav', assignedLabels: ['Funk'] },
      { name: 'Drums.wav', assignedLabels: ['Rock', 'Live'] },
      { name: 'Hidden Fifth.wav', assignedLabels: ['Archive'] },
    ],
    uploadedDatasetReattachDisabledReason: null,
  });

  assert.match(html, /Expected files \(5\)/);
  assert.match(html, /Lead Guitar\.wav/);
  assert.match(html, /Room Take\.mp3/);
  assert.match(html, /Bass\.wav/);
  assert.match(html, /Drums\.wav/);
  assert.match(html, /Rock, Live/);
  assert.match(html, /1 more expected file not shown/);
  assert.doesNotMatch(html, /Hidden Fifth\.wav/);
});

test('ANNControlsPanel renders uploaded-dataset reattachment review results', () => {
  const html = renderPanel({
    uploadedDatasetReattachmentReview: {
      attachedNames: ['Lead Guitar.wav'],
      missingNames: ['Room Take.mp3'],
      unmatchedFileNames: ['Other.wav'],
      skippedNames: ['Bad Notes.txt'],
      attachedFiles: [{ name: 'Lead Guitar.wav', externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' }],
      missingFiles: [{ name: 'Room Take.mp3', externalId: 'browser-file:room-take-mp3:4096:1780000001000' }],
      unmatchedFiles: [{ name: 'Other.wav', externalId: 'browser-file:other-wav:1024:1780000002000' }],
      skippedFiles: [{ name: 'Bad Notes.txt' }],
    },
  });

  assert.match(html, /Reattachment review/);
  assert.match(html, /Needs attention/);
  assert.match(html, /1 uploaded file reattached, but 3 selected items still need review before training\./);
  assert.match(html, /id="annUploadedDatasetReattachmentFilter"/);
  assert.match(html, /aria-label="Filter uploaded-dataset reattachment review"/);
  assert.match(html, /id="annUploadedDatasetReattachmentSearch"/);
  assert.match(html, /placeholder="Search files"/);
  assert.match(html, /Needs attention/);
  assert.match(html, /Attached only/);
  assert.match(html, /Missing only/);
  assert.match(html, /Extra selected only/);
  assert.match(html, /Skipped only/);
  assert.match(html, /Reattach Remaining Files/);
  assert.match(html, /Continue With Attached Files/);
  assert.match(html, /Attached \(1\)/);
  assert.match(html, /Lead Guitar\.wav/);
  assert.match(html, /2 KB/);
  assert.match(html, /Still missing \(1\)/);
  assert.match(html, /Room Take\.mp3/);
  assert.match(html, /4 KB/);
  assert.match(html, /2026-05-28 20:26 UTC/);
  assert.match(html, /Extra selected \(1\)/);
  assert.match(html, /Other\.wav/);
  assert.match(html, /1 KB/);
  assert.match(html, /Skipped \(1\)/);
  assert.match(html, /Bad Notes\.txt/);
  assert.match(html, /Unknown size/);
});

test('ANNControlsPanel confirms clean uploaded-dataset reattachment review results', () => {
  const html = renderPanel({
    uploadedDatasetReattachmentReview: {
      attachedNames: ['Lead Guitar.wav', 'Room Take.mp3'],
      missingNames: [],
      unmatchedFileNames: [],
      skippedNames: [],
      attachedFiles: [
        { name: 'Lead Guitar.wav', externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' },
        { name: 'Room Take.mp3', externalId: 'browser-file:room-take-mp3:4096:1780000001000' },
      ],
    },
  });

  assert.match(html, /Ready to continue/);
  assert.match(html, /2 uploaded files reattached\. Re-extract features before training\./);
  assert.match(html, /Attached \(2\)/);
  assert.doesNotMatch(html, /Reattach Remaining Files/);
  assert.doesNotMatch(html, /Continue With Attached Files/);
  assert.doesNotMatch(html, /still need review before training/);
});

test('ANNControlsPanel records when partial uploaded-dataset reattachment is continued', () => {
  const html = renderPanel({
    uploadedDatasetReattachmentReview: {
      attachedNames: ['Lead Guitar.wav'],
      missingNames: ['Room Take.mp3'],
      unmatchedFileNames: ['Other.wav'],
      skippedNames: ['Bad Notes.txt'],
      continuedWithAttached: true,
    },
  });

  assert.match(html, /Continuing with attached files/);
  assert.match(html, /1 uploaded file reattached\. 3 selected items were left out of this ANN setup\./);
  assert.doesNotMatch(html, /Reattach Remaining Files/);
  assert.doesNotMatch(html, /Continue With Attached Files/);
});

test('ANNControlsPanel summarizes overflowing uploaded-dataset reattachment review sections', () => {
  const html = renderPanel({
    uploadedDatasetReattachmentReview: {
      attachedNames: ['Lead Guitar.wav', 'Bass.wav', 'Drums.wav', 'Keys.wav', 'Hidden Fifth.wav'],
      missingNames: ['Room Take.mp3'],
      unmatchedFileNames: ['Other.wav', 'Scratch.wav', 'Click.wav', 'Noise.wav', 'Extra Fifth.wav'],
      skippedNames: ['Bad Notes.txt'],
    },
  });

  assert.match(html, /Attached \(5\)/);
  assert.match(html, /Lead Guitar\.wav/);
  assert.match(html, /Keys\.wav/);
  assert.match(html, /1 more attached file not shown/);
  assert.match(html, /Show all 5 attached files/);
  assert.doesNotMatch(html, /Hidden Fifth\.wav/);
  assert.match(html, /Extra selected \(5\)/);
  assert.match(html, /Noise\.wav/);
  assert.match(html, /1 more extra selected file not shown/);
  assert.match(html, /Show all 5 extra selected files/);
  assert.doesNotMatch(html, /Extra Fifth\.wav/);
  assert.match(html, /Still missing \(1\)/);
  assert.match(html, /Room Take\.mp3/);
  assert.match(html, /Skipped \(1\)/);
  assert.match(html, /Bad Notes\.txt/);
});

test('ANNControlsPanel renders controlled processing and reduction settings', () => {
  const html = renderPanel({
    processingMethod: 'normalize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 3,
    canReduce: true,
  });

  const normalizeButton = html.match(/<button[^>]+data-ann-processing-method="normalize"[^>]*>/)?.[0] ?? '';
  const pcaButton = html.match(/<button[^>]+data-ann-reduction-method="pca"[^>]*>/)?.[0] ?? '';
  const threeDimensionalButton = html.match(/<button[^>]+data-ann-reduction-dimensions="3"[^>]*>/)?.[0] ?? '';
  assert.match(normalizeButton, /aria-pressed="true"/);
  assert.match(html, /aria-label="Data processing method"/);
  assert.match(pcaButton, /aria-pressed="true"/);
  assert.match(threeDimensionalButton, /aria-pressed="true"/);
  assert.match(html, /Algorithm:/);
  assert.match(html, /Target Dimensions:/);
  assert.match(html, />None</);
  assert.doesNotMatch(html, /Use before training/);
  assert.match(html, /5\. Training/);
  assert.match(html, /6\. Inference/);
  assert.doesNotMatch(html, /5\. Train &amp; Infer/);
});

test('ANNControlsPanel represents disabled dimensionality reduction with None', () => {
  const html = renderPanel({ useDimensionalityReduction: false });
  const noneButton = html.match(/<button[^>]+data-ann-reduction-method="none"[^>]*>/)?.[0] ?? '';
  const twoDimensionalButton = html.match(/<button[^>]+data-ann-reduction-dimensions="2"[^>]*>/)?.[0] ?? '';

  assert.match(noneButton, /aria-pressed="true"/);
  assert.match(twoDimensionalButton, /disabled=""/);
});

test('ANNControlsPanel renders training summary after a model is trained', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'processed',
    selectedFeatureIds: ['mfcc', 'energy'],
    inputDimension: 12,
    labeledSongCount: 5,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 3 },
      { label: 'Jazz', count: 2 },
    ],
    warnings: [
      {
        code: 'small-training-set',
        message: 'Only 5 labeled songs are available. Treat accuracy as exploratory until there are at least 12 labeled songs.',
      },
      {
        code: 'under-sampled-labels',
        message: 'Some labels have fewer than 5 songs: Rock (3), Jazz (2). Per-label metrics may be unstable.',
      },
    ],
    hiddenLayers: 2,
    nodesPerLayer: [16, 8],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 40,
    splitRatio: 0.75,
    validationRatio: 0.25,
    batchSize: 8,
    seed: 1234,
    finalLoss: 0.25,
    finalAccuracy: 0.8,
  };

  const html = renderPanel({
    trainingSummary,
    trainingExecutionMode: 'epoch',
    canContinueTraining: true,
  });

  assert.match(html, /Training summary/);
  assert.match(html, /80\.0%/);
  assert.match(html, /processed \/ 12 dims/);
  assert.match(html, /5 songs \/ 2 labels/);
  assert.match(html, /75% train \/ 25% val/);
  assert.match(html, /1234/);
  assert.match(html, /2 layers \/ relu/);
  assert.match(html, /mfcc, energy/);
  assert.match(html, /adam \/ 40 epochs/);
  assert.match(html, /batch 8/);
  assert.match(html, /loss 0\.250/);
  assert.match(html, /Only 5 labeled songs are available/);
  assert.match(html, /Some labels have fewer than 5 songs: Rock \(3\), Jazz \(2\)/);
  assert.match(html, /Rock/);
  assert.match(html, /Jazz/);
  assert.match(html, /Further training/);
  assert.match(html, /Current total: 40 epochs/);
  assert.match(html, /Additional epochs/);
  assert.match(html, />Continue</);
});

test('ANNControlsPanel renders internal training phases and an explicit advance action', () => {
  const html = renderPanel({
    isTrainingSessionActive: true,
    trainingExecutionMode: 'step',
    trainingSessionStatus: {
      mode: 'step',
      completedEpochs: 1,
      targetEpochs: 4,
      batchIndex: 1,
      batchCount: 3,
      nextAction: 'Advance the next internal training phase.',
    },
    trainingPhaseSnapshot: {
      phase: 'backward',
      label: 'Backpropagate through hidden_1',
      description: 'The loss signal travels backward through hidden_1.',
      epoch: 2,
      targetEpochs: 4,
      batchIndex: 2,
      batchCount: 3,
      activeLayerName: 'hidden_1',
      direction: 'backward',
      sampleLabel: 'Rock',
      predictedLabel: 'Jazz',
      predictionConfidence: 0.72,
      loss: 0.41,
    },
  });

  assert.match(html, /data-ann-training-session="active"/);
  assert.match(html, /Backpropagate through hidden_1/);
  assert.match(html, /The loss signal travels backward through hidden_1[.]/);
  assert.match(html, /1 [/] 4 epochs/);
  assert.match(html, /Jazz [(]72[.]0%[)]/);
  assert.match(html, /0.4100/);
  assert.match(html, /Next Training Phase/);
  assert.doesNotMatch(html, /data-ann-start-training="step"/);
});

test('ANNControlsPanel renders feature signal analysis for trained inputs', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'raw',
    selectedFeatureIds: ['energy', 'rms'],
    inputDimension: 2,
    labeledSongCount: 4,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 2 },
      { label: 'Jazz', count: 2 },
    ],
    warnings: [],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 30,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 4,
    seed: 99,
    finalLoss: 0.2,
    finalAccuracy: 0.75,
  };
  const featureSignalSummary: AnnFeatureSignalSummary = {
    inputKind: 'raw',
    labeledRowCount: 4,
    labelCount: 2,
    dimensionCount: 2,
    summary: 'Top signal: energy separates labels strongest (strong signal, 100.0%).',
    rows: [
      {
        dimensionIndex: 0,
        dimensionLabel: 'energy',
        score: 1,
        scoreLabel: 'Strong signal',
        meanRange: 4,
        strongestLabel: 'Jazz',
        weakestLabel: 'Rock',
        classMeans: [
          { label: 'Rock', count: 2, mean: 1 },
          { label: 'Jazz', count: 2, mean: 5 },
        ],
      },
      {
        dimensionIndex: 1,
        dimensionLabel: 'rms',
        score: 0.2,
        scoreLabel: 'Weak signal',
        meanRange: 1,
        strongestLabel: 'Jazz',
        weakestLabel: 'Rock',
        classMeans: [
          { label: 'Rock', count: 2, mean: 11 },
          { label: 'Jazz', count: 2, mean: 12 },
        ],
      },
    ],
  };

  const html = renderPanel({
    trainingSummary,
    featureSignalSummary,
  });

  assert.match(html, /Feature signal/);
  assert.match(html, /2 inputs \/ 4 labeled rows/);
  assert.match(html, /Top signal: energy separates labels strongest \(strong signal, 100\.0%\)\./);
  assert.match(html, /energy/);
  assert.match(html, /Strong signal/);
  assert.match(html, /100\.0%/);
  assert.match(html, /Jazz high/);
  assert.match(html, /4\.000 range/);
  assert.match(html, /rms/);
  assert.match(html, /Weak signal/);
  assert.match(html, /20\.0%/);
});

test('ANNControlsPanel renders dataset evaluation metrics after inference', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'processed',
    selectedFeatureIds: ['energy'],
    inputDimension: 1,
    labeledSongCount: 4,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 2 },
      { label: 'Jazz', count: 2 },
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
    seed: 1234,
    finalLoss: 0.123,
    finalAccuracy: 0.875,
  };
  const evaluationSummary: AnnEvaluationSummary = {
    actualLabels: ['Rock', 'Jazz'],
    predictedLabels: ['Rock', 'Jazz'],
    confusionMatrix: [
      [1, 1],
      [0, 2],
    ],
    rows: [
      {
        label: 'Rock',
        support: 2,
        predictedCount: 1,
        truePositive: 1,
        falsePositive: 0,
        falseNegative: 1,
        precision: 1,
        recall: 0.5,
        f1: 2 / 3,
      },
      {
        label: 'Jazz',
        support: 2,
        predictedCount: 3,
        truePositive: 2,
        falsePositive: 1,
        falseNegative: 0,
        precision: 2 / 3,
        recall: 1,
        f1: 0.8,
      },
    ],
    totalSongs: 4,
    predictedSongCount: 4,
    correctPredictions: 3,
    accuracy: 0.75,
    majorityBaselineLabel: 'Rock',
    majorityBaselineAccuracy: 0.5,
    missingPredictionCount: 1,
    unknownPredictionCount: 0,
    confidenceCount: 4,
    averageConfidence: 0.82,
    minConfidence: 0.61,
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 1,
  };
  const validationPlan: AnnValidationPlanResult = {
    reason: null,
    plan: {
      strategy: 'leave-one-out',
      foldCount: 4,
      totalSongCount: 4,
      labelCount: 2,
      folds: [
        {
          foldNumber: 1,
          trainingSongIds: ['song-b', 'song-c', 'song-d'],
          validationSongIds: ['song-a'],
          validationLabelCounts: [{ label: 'Rock', count: 1 }],
        },
        {
          foldNumber: 2,
          trainingSongIds: ['song-a', 'song-c', 'song-d'],
          validationSongIds: ['song-b'],
          validationLabelCounts: [{ label: 'Rock', count: 1 }],
        },
        {
          foldNumber: 3,
          trainingSongIds: ['song-a', 'song-b', 'song-d'],
          validationSongIds: ['song-c'],
          validationLabelCounts: [{ label: 'Jazz', count: 1 }],
        },
        {
          foldNumber: 4,
          trainingSongIds: ['song-a', 'song-b', 'song-c'],
          validationSongIds: ['song-d'],
          validationLabelCounts: [{ label: 'Jazz', count: 1 }],
        },
      ],
    },
  };
  const validationExecutionPlan: AnnValidationExecutionPlanResult = {
    reason: null,
    executionPlan: {
      strategy: 'leave-one-out',
      foldCount: 4,
      totalValidationSongCount: 4,
      folds: [
        {
          foldNumber: 1,
          expectedLabels: { 'song-a': 'Rock' },
          trainPayload: {
            vectors: [[1], [2], [3]],
            labels: ['Rock', 'Jazz', 'Jazz'],
            validationVectors: [[0]],
            validationLabels: ['Rock'],
            config: {
              layers: 1,
              nodes: [16],
              activation: 'relu',
              optimizer: 'adam',
              learningRate: 0.001,
            },
            labelMap: { Rock: 0, Jazz: 1 },
            trainIterations: 50,
            batchSize: 32,
            splitRatio: 0.8,
            seed: 1234,
          },
          inferPayload: {
            vectors: [[0]],
            songIds: ['song-a'],
            labelMap: { Rock: 0, Jazz: 1 },
          },
        },
      ],
    },
  };
  const validationRunSummary: AnnValidationExecutionSummary = {
    foldCount: 4,
    totalPredictions: 4,
    correctPredictions: 3,
    accuracy: 0.75,
    missingPredictionCount: 0,
    confidenceCount: 4,
    averageConfidence: 0.81,
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 1,
  };
  const validationRunFoldResults: AnnValidationFoldRunResult[] = [
    {
      foldNumber: 1,
      expectedLabels: { 'song-a': 'Rock' },
      results: { 'song-a': { predictedLabel: 'Rock', confidence: 0.91 } },
      trainMetrics: { loss: 0.11, accuracy: 1 },
    },
    {
      foldNumber: 2,
      expectedLabels: { 'song-b': 'Rock' },
      results: { 'song-b': { predictedLabel: 'Jazz', confidence: 0.64 } },
      trainMetrics: { loss: 0.22, accuracy: 0.75 },
    },
  ];

  const html = renderPanel({
    canInfer: true,
    inferDisabledReason: null,
    trainingSummary,
    evaluationSummary,
    validationPlan,
    validationExecutionPlan,
    canRunValidation: true,
    validationRunDisabledReason: null,
    validationRunSummary,
    validationRunFoldResults,
    canExportValidationSummary: true,
    validationExportDisabledReason: null,
  });

  assert.match(html, /Dataset evaluation/);
  assert.match(html, /75\.0%/);
  assert.match(html, /3\/4/);
  assert.match(html, /50\.0% Rock/);
  assert.match(html, /Avg confidence/);
  assert.match(html, /82\.0%/);
  assert.match(html, /Low confidence/);
  assert.match(html, /1 below 70\.0%/);
  assert.match(html, /Validation guidance/);
  assert.match(html, /Exploratory validation/);
  assert.match(html, /leave-one-out/);
  assert.match(html, /1\/4 evaluated predictions are below 70\.0%/);
  assert.match(html, /Validation plan/);
  assert.match(html, /4 folds ready/);
  assert.match(html, /4 songs \/ 2 labels/);
  assert.match(html, /First fold holds out 1 song/);
  assert.match(html, /Validation execution/);
  assert.match(html, /4 train\/infer payloads ready/);
  assert.match(html, /First payload trains 3 songs and validates 1/);
  assert.match(html, /Run Validation/);
  assert.match(html, /Validation results/);
  assert.match(html, /3\/4 correct/);
  assert.match(html, /Avg confidence/);
  assert.match(html, /81\.0%/);
  assert.match(html, /Low confidence/);
  assert.match(html, /1 below 70\.0%/);
  assert.match(html, /Fold review/);
  assert.match(html, /Export Validation Summary/);
  assert.match(html, /Fold 1/);
  assert.match(html, /song-a/);
  assert.match(html, /Rock -&gt; Rock/);
  assert.match(html, /91\.0%/);
  assert.match(html, /Fold 2/);
  assert.match(html, /song-b/);
  assert.match(html, /Rock -&gt; Jazz/);
  assert.match(html, /64\.0%/);
  assert.match(html, /1 missing, 0 unknown/);
  assert.match(html, /Rock/);
  assert.match(html, /P 100\.0%/);
  assert.match(html, /R 50\.0%/);
  assert.match(html, /F1 66\.7%/);
  assert.match(html, /Confusion matrix/);
  assert.match(html, /Actual \\ Predicted/);
  assert.match(html, /Jazz/);
  assert.match(html, /2/);
});

test('ANNControlsPanel renders permutation impact analysis results', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'raw',
    selectedFeatureIds: ['energy', 'rms'],
    inputDimension: 2,
    labeledSongCount: 4,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 2 },
      { label: 'Jazz', count: 2 },
    ],
    warnings: [],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 30,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 4,
    seed: 99,
    finalLoss: 0.2,
    finalAccuracy: 0.75,
  };
  const permutationImportanceSummary: AnnPermutationImportanceSummary = {
    inputKind: 'raw',
    baselineAccuracy: 1,
    rowCount: 2,
    dimensionCount: 2,
    summary: 'Top impact: energy drops dataset accuracy by 50.0 pts when permuted.',
    rows: [
      {
        dimensionIndex: 0,
        dimensionLabel: 'energy',
        baselineAccuracy: 1,
        permutedAccuracy: 0.5,
        accuracyDrop: 0.5,
        accuracyDropLabel: '50.0 pts drop',
        impactLabel: 'High impact',
        correctPredictions: 2,
        totalSongs: 4,
        lowConfidenceCount: 1,
        baselineAverageConfidence: 0.9,
        permutedAverageConfidence: 0.72,
        confidenceDrop: 0.18,
        confidenceDropLabel: '18.0 pts confidence drop',
        lowConfidenceDelta: 1,
      },
      {
        dimensionIndex: 1,
        dimensionLabel: 'rms',
        baselineAccuracy: 1,
        permutedAccuracy: 1,
        accuracyDrop: 0,
        accuracyDropLabel: 'No accuracy drop',
        impactLabel: 'No measured drop',
        correctPredictions: 4,
        totalSongs: 4,
        lowConfidenceCount: 0,
        baselineAverageConfidence: 0.9,
        permutedAverageConfidence: 0.91,
        confidenceDrop: -0.010000000000000009,
        confidenceDropLabel: '1.0 pts confidence gain',
        lowConfidenceDelta: 0,
      },
    ],
  };

  const html = renderPanel({
    trainingSummary,
    permutationImportanceSummary,
    canRunPermutationImportance: true,
    permutationImportanceDisabledReason: null,
    canExportPermutationImportance: true,
    permutationImportanceExportDisabledReason: null,
  });

  assert.match(html, /Feature impact/);
  assert.match(html, /Analyze Feature Impact/);
  assert.match(html, /Top impact: energy drops dataset accuracy by 50\.0 pts when permuted\./);
  assert.match(html, /Baseline 100\.0%/);
  assert.match(html, /energy/);
  assert.match(html, /High impact/);
  assert.match(html, /50\.0%/);
  assert.match(html, /50\.0 pts drop/);
  assert.match(html, /Confidence/);
  assert.match(html, /18\.0 pts confidence drop/);
  assert.match(html, /\+1 low-confidence/);
  assert.match(html, /2\/4/);
  assert.match(html, /rms/);
  assert.match(html, /No measured drop/);
  assert.match(html, /Export Feature Impact/);
});

test('ANNControlsPanel summarizes hidden feature impact rows for larger input sets', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'raw',
    selectedFeatureIds: ['energy'],
    inputDimension: 7,
    labeledSongCount: 10,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 5 },
      { label: 'Jazz', count: 5 },
    ],
    warnings: [],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 30,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 4,
    seed: 99,
    finalLoss: 0.2,
    finalAccuracy: 0.75,
  };
  const permutationImportanceSummary: AnnPermutationImportanceSummary = {
    inputKind: 'raw',
    baselineAccuracy: 1,
    rowCount: 7,
    dimensionCount: 7,
    summary: 'Top impact: feature-1 drops dataset accuracy by 20.0 pts when permuted.',
    rows: Array.from({ length: 7 }, (_, index) => ({
      dimensionIndex: index,
      dimensionLabel: `feature-${index + 1}`,
      baselineAccuracy: 1,
      permutedAccuracy: 0.8,
      accuracyDrop: 0.2,
      accuracyDropLabel: '20.0 pts drop',
      impactLabel: 'High impact',
      correctPredictions: 4,
      totalSongs: 5,
      lowConfidenceCount: 0,
      baselineAverageConfidence: 0.9,
      permutedAverageConfidence: 0.8,
      confidenceDrop: 0.1,
      confidenceDropLabel: '10.0 pts confidence drop',
      lowConfidenceDelta: 0,
    })),
  };

  const html = renderPanel({
    trainingSummary,
    permutationImportanceSummary,
    canRunPermutationImportance: true,
    permutationImportanceDisabledReason: null,
  });

  assert.match(html, /Showing top 5 of 7 inputs/);
  assert.match(html, /Show all 7 inputs/);
  assert.match(html, /feature-5/);
  assert.doesNotMatch(html, /feature-6/);
});

test('ANNControlsPanel renders grouped feature impact interpretation', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'raw',
    selectedFeatureIds: ['mfcc', 'energy'],
    inputDimension: 3,
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
    epochs: 30,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 4,
    seed: 99,
    finalLoss: 0.2,
    finalAccuracy: 0.75,
  };
  const permutationImportanceSummary: AnnPermutationImportanceSummary = {
    inputKind: 'raw',
    baselineAccuracy: 1,
    rowCount: 3,
    dimensionCount: 3,
    summary: 'Top impact: mfccMeans[0] drops dataset accuracy by 25.0 pts when permuted.',
    rows: [
      {
        dimensionIndex: 0,
        dimensionLabel: 'mfccMeans[0]',
        baselineAccuracy: 1,
        permutedAccuracy: 0.75,
        accuracyDrop: 0.25,
        accuracyDropLabel: '25.0 pts drop',
        impactLabel: 'High impact',
        correctPredictions: 6,
        totalSongs: 8,
        lowConfidenceCount: 1,
        baselineAverageConfidence: 0.9,
        permutedAverageConfidence: 0.76,
        confidenceDrop: 0.14,
        confidenceDropLabel: '14.0 pts confidence drop',
        lowConfidenceDelta: 1,
      },
      {
        dimensionIndex: 1,
        dimensionLabel: 'mfccStdDevs[0]',
        baselineAccuracy: 1,
        permutedAccuracy: 0.9,
        accuracyDrop: 0.1,
        accuracyDropLabel: '10.0 pts drop',
        impactLabel: 'Moderate impact',
        correctPredictions: 7,
        totalSongs: 8,
        lowConfidenceCount: 0,
        baselineAverageConfidence: 0.9,
        permutedAverageConfidence: 0.82,
        confidenceDrop: 0.08,
        confidenceDropLabel: '8.0 pts confidence drop',
        lowConfidenceDelta: 0,
      },
      {
        dimensionIndex: 2,
        dimensionLabel: 'energy',
        baselineAccuracy: 1,
        permutedAccuracy: 0.95,
        accuracyDrop: 0.05,
        accuracyDropLabel: '5.0 pts drop',
        impactLabel: 'Moderate impact',
        correctPredictions: 7,
        totalSongs: 8,
        lowConfidenceCount: 0,
        baselineAverageConfidence: 0.9,
        permutedAverageConfidence: 0.88,
        confidenceDrop: 0.02,
        confidenceDropLabel: '2.0 pts confidence drop',
        lowConfidenceDelta: 0,
      },
    ],
  };

  const html = renderPanel({
    trainingSummary,
    permutationImportanceSummary,
    canRunPermutationImportance: true,
    permutationImportanceDisabledReason: null,
  });

  assert.match(html, /Grouped interpretation/);
  assert.match(html, /MFCC/);
  assert.match(html, /2 related inputs/);
  assert.match(html, /Top input mfccMeans\[0\]/);
  assert.match(html, /25\.0 pts drop/);
  assert.match(html, /14\.0 pts confidence drop/);
  assert.match(html, /Energy/);
});

test('ANNControlsPanel renders feature impact cancellation while analysis is running', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'raw',
    selectedFeatureIds: ['energy'],
    inputDimension: 1,
    labeledSongCount: 4,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 2 },
      { label: 'Jazz', count: 2 },
    ],
    warnings: [],
    hiddenLayers: 1,
    nodesPerLayer: [16],
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 30,
    splitRatio: 0.8,
    validationRatio: 0.2,
    batchSize: 4,
    seed: 99,
    finalLoss: 0.2,
    finalAccuracy: 0.75,
  };

  const html = renderPanel({
    trainingSummary,
    isAnalyzingPermutationImportance: true,
    canRunPermutationImportance: false,
    permutationImportanceDisabledReason: 'Feature impact analysis is already running.',
    canExportPermutationImportance: false,
    permutationImportanceExportDisabledReason: 'Wait for current ANN process to finish before exporting feature impact.',
  });

  assert.match(html, /Analyzing\.\.\./);
  assert.match(html, /Cancel Feature Impact/);
  assert.doesNotMatch(html, /Export Feature Impact/);
});

test('ANNControlsPanel renders validation-run progress and errors', () => {
  const trainingSummary: AnnTrainingSummary = {
    inputKind: 'processed',
    selectedFeatureIds: ['energy'],
    inputDimension: 1,
    labeledSongCount: 4,
    classCount: 2,
    labelCounts: [
      { label: 'Rock', count: 2 },
      { label: 'Jazz', count: 2 },
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
    seed: 1234,
    finalLoss: 0.12,
    finalAccuracy: 0.875,
  };
  const validationExecutionPlan: AnnValidationExecutionPlanResult = {
    reason: null,
    executionPlan: {
      strategy: 'leave-one-out',
      foldCount: 4,
      totalValidationSongCount: 4,
      folds: [
        {
          foldNumber: 1,
          expectedLabels: { 'song-a': 'Rock' },
          trainPayload: {
            vectors: [[1], [2], [3]],
            labels: ['Rock', 'Jazz', 'Jazz'],
            validationVectors: [[0]],
            validationLabels: ['Rock'],
            config: {
              layers: 1,
              nodes: [16],
              activation: 'relu',
              optimizer: 'adam',
              learningRate: 0.001,
            },
            labelMap: { Rock: 0, Jazz: 1 },
            trainIterations: 50,
            batchSize: 32,
            splitRatio: 0.8,
          },
          inferPayload: {
            vectors: [[0]],
            songIds: ['song-a'],
            labelMap: { Rock: 0, Jazz: 1 },
          },
        },
      ],
    },
  };

  const runningHtml = renderPanel({
    trainingSummary,
    validationExecutionPlan,
    isValidating: true,
    canRunValidation: false,
    validationRunDisabledReason: 'Validation is already running.',
    validationRunProgress: { currentFold: 2, totalFolds: 4, stage: 'infer' },
  });

  assert.match(runningHtml, /Running validation/);
  assert.match(runningHtml, /Fold 2 of 4/);
  assert.match(runningHtml, /Inferring holdout labels/);

  const errorHtml = renderPanel({
    trainingSummary,
    validationExecutionPlan,
    canRunValidation: true,
    validationRunError: 'Validation fold 3 failed: MLP exploded.',
  });

  assert.match(errorHtml, /Validation run failed/);
  assert.match(errorHtml, /Validation fold 3 failed: MLP exploded\./);
});

test('ANNControlsPanel renders model comparison rows for training and evaluated runs', () => {
  const modelComparisonRuns: AnnModelComparisonRun[] = [
    {
      id: 'ann-train-1',
      runNumber: 1,
      trainedAt: '2026-06-17T10:00:00.000Z',
      inputKind: 'raw',
      inputDimension: 2,
      selectedFeatureIds: ['energy', 'rms'],
      trainingAccuracy: 0.75,
      trainingLoss: 0.25,
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
      reviewStatus: 'review-later',
      note: 'Raw baseline needs validation before comparing.',
      warningCodes: [],
    },
    {
      id: 'ann-train-2',
      runNumber: 2,
      trainedAt: '2026-06-17T10:05:00.000Z',
      inputKind: 'processed',
      inputDimension: 2,
      selectedFeatureIds: ['energy', 'rms'],
      trainingAccuracy: 0.875,
      trainingLoss: 0.123,
      datasetAccuracy: 1,
      datasetCorrectPredictions: 4,
      datasetTotalSongs: 4,
      majorityBaselineAccuracy: 0.5,
      majorityBaselineDelta: 0.5,
      validationAccuracy: 0.75,
      validationCorrectPredictions: 3,
      validationTotalPredictions: 4,
      validationFoldCount: 4,
      validationLowConfidenceCount: 1,
      reviewStatus: 'keep',
      note: 'Best balanced run so far.',
      warningCodes: ['small-training-set'],
    },
  ];

  const html = renderPanel({
    modelComparisonRuns,
    activeModelComparisonRunId: 'ann-train-2',
  });

  assert.match(html, /Model comparison/);
  assert.match(html, /Best dataset accuracy 100\.0%/);
  assert.match(html, /Comparison view/);
  assert.match(html, /Rank by quality/);
  assert.match(html, /All review markers/);
  assert.match(html, /Showing 2 of 2 runs/);
  assert.match(html, /Comparison guide/);
  assert.match(html, /Live model comparison/);
  assert.match(html, /Live model Run 2 uses processed input with dataset 100\.0%\./);
  assert.match(html, /raw/);
  assert.match(html, /Run 1/);
  assert.match(html, /-25\.0 pts vs live/);
  assert.match(html, /processed/);
  assert.match(html, /Live model/);
  assert.match(html, /reduced/);
  assert.match(html, /No run/);
  assert.match(html, /Apply PCA Setup/);
  assert.match(html, /Use standardize processing with PCA reduction/);
  assert.match(html, /Export Comparison History/);
  assert.match(html, /Import Comparison History/);
  assert.match(html, /Delete Run 1 from comparison history/);
  assert.match(html, /Delete Run 2 from comparison history/);
  assert.match(html, /Next: train reduced input/);
  assert.match(html, /raw trained/);
  assert.match(html, /processed evaluated/);
  assert.match(html, /reduced missing/);
  assert.match(html, /Run 1/);
  assert.match(html, /#2/);
  assert.match(html, /Training 75\.0%/);
  assert.match(html, /Review later/);
  assert.match(html, /raw \/ 2 dims/);
  assert.match(html, /Raw baseline needs validation before comparing\./);
  assert.match(html, /Test 75\.0%/);
  assert.match(html, /Dataset pending/);
  assert.match(html, /Run 2/);
  assert.match(html, /#1/);
  assert.match(html, /Dataset 100\.0%/);
  assert.match(html, /Keep/);
  assert.match(html, /processed \/ 2 dims/);
  assert.match(html, /Best balanced run so far\./);
  assert.match(html, /Dataset 100\.0%/);
  assert.match(html, /Validation 75\.0%/);
  assert.match(html, /3\/4 val/);
  assert.match(html, /4 folds/);
  assert.match(html, /1 low conf/);
  assert.match(html, /4\/4/);
  assert.match(html, /\+50\.0 pts/);
  assert.match(html, /warnings/);
});
