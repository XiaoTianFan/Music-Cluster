// src/components/ANNControlsPanel.tsx
import React, { useMemo, useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import BasePanel from './ui/BasePanel';
import Button from './ui/Button';
import {
    availableMirFeatures,
    type AnnTrainingExecutionMode,
    type AnnTrainingPhaseSnapshot,
    type AnnTrainingSessionStatus,
    type FeatureId,
    type ProcessingMethod,
    type ReductionMethod,
} from '../lib/annPipeline';
import type { AnnEvaluationSummary } from '../lib/annEvaluation';
import type { AnnFeatureSignalSummary } from '../lib/annFeatureSignal';
import type { AnnLabelDistributionSummary, AnnLabelDistributionStatus } from '../lib/annLabelDistribution';
import type { AnnPermutationImportanceSummary } from '../lib/annPermutationImportance';
import { getAnnPermutationImportanceView } from '../lib/annPermutationImportanceView';
import {
    ANN_MODEL_COMPARISON_NOTE_MAX_LENGTH,
    annModelComparisonReviewStatuses,
    getAnnModelComparisonBenchmark,
    getAnnModelComparisonGuidance,
    getAnnModelComparisonView,
    getBestAnnModelComparisonRun,
    type AnnModelComparisonReviewFilter,
    type AnnModelComparisonReviewStatus,
    type AnnModelComparisonSortMode,
    type AnnModelComparisonRun,
} from '../lib/annModelComparison';
import { getAnnModelComparisonSetupSuggestion } from '../lib/annModelComparisonSetup';
import type { AnnTrainingSummary, AnnTrainingSummaryWarningCode } from '../lib/annTrainingSummary';
import {
    getAnnUploadedDatasetReattachmentReviewConfirmation,
    getAnnUploadedDatasetReattachmentReviewVisibleSections,
    type AnnUploadedDatasetReattachmentReviewFilter,
    type AnnUploadedDatasetReattachmentReviewSectionKey,
} from '../lib/annUploadedDatasetReattachmentReview';
import { describeUploadedTrainingSongExternalId } from '../lib/annUploadedSongs';
import { getAnnValidationGuidance } from '../lib/annValidationGuidance';
import type { AnnValidationExecutionPlanResult, AnnValidationExecutionSummary, AnnValidationFoldRunResult } from '../lib/annValidationExecution';
import type { AnnValidationPlanResult } from '../lib/annValidationPlan';
// --- NEW: Import common form elements if available, or use native --- 
// import Input from '@/components/ui/Input'; 
// import Select from '@/components/ui/Select';
// import Checkbox from '@/components/ui/Checkbox';
// Using native elements for now
// ---------------------------------------------------------------------

// --- NEW: Default MLP Config ---
export interface MLPConfig { // Exporting for potential use in page.tsx
    hiddenLayers: number;
    nodesPerLayer: number[];
    activation: 'relu' | 'sigmoid' | 'tanh'; // Example options
    optimizer: 'adam' | 'sgd' | 'rmsprop';
    learningRate: number;
    epochs: number;
    targetLoss?: number;
    splitRatio: number;
    randomSeed?: number;
    batchSize: number;
}

export const DEFAULT_MLP_CONFIG: MLPConfig = {
    hiddenLayers: 1,
    nodesPerLayer: [16], // Default for 1 hidden layer
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 50,
    splitRatio: 0.8,
    batchSize: 32,
    // targetLoss: undefined,
    // randomSeed: undefined,
};
// ---------------------------

const reviewStatusLabels: Record<AnnModelComparisonReviewStatus, string> = {
    unreviewed: 'Unreviewed',
    'review-later': 'Review later',
    promising: 'Promising',
    keep: 'Keep',
    discard: 'Discard',
};

const uploadedDatasetReattachmentReviewFilterOptions: readonly {
    value: AnnUploadedDatasetReattachmentReviewFilter;
    label: string;
}[] = [
    { value: 'all', label: 'All' },
    { value: 'needs-attention', label: 'Needs attention' },
    { value: 'attached', label: 'Attached only' },
    { value: 'missing', label: 'Missing only' },
    { value: 'extra', label: 'Extra selected only' },
    { value: 'skipped', label: 'Skipped only' },
];

const trainingWarningCodeLabels: Record<AnnTrainingSummaryWarningCode, string> = {
    'small-training-set': 'Small training set',
    'under-sampled-labels': 'Under-sampled labels',
};

type TrainedModelContextSource = 'trained' | 'imported';

interface ANNControlsPanelProps {
    className?: string;
    // Worker Status
    essentiaWorkerReady: boolean;
    dataProcessingWorkerReady: boolean;
    druidWorkerReady: boolean;
    mlpWorkerReady: boolean;
    // Pipeline State Flags
    isExtracting: boolean;
    isProcessingData: boolean;
    isReducing: boolean;
    isTraining: boolean;
    isTrainingSessionActive?: boolean;
    isInferring: boolean;
    // Data Availability Flags
    canProcess: boolean;
    canReduce: boolean;
    canTrain: boolean;
    trainDisabledReason?: string | null;
    labelDistribution: AnnLabelDistributionSummary;
    canInfer: boolean;
    inferDisabledReason?: string | null;
    trainingSummary?: AnnTrainingSummary | null;
    trainingExecutionMode?: AnnTrainingExecutionMode;
    trainingSessionStatus?: AnnTrainingSessionStatus | null;
    trainingPhaseSnapshot?: AnnTrainingPhaseSnapshot | null;
    isAutomaticTrainingArmed?: boolean;
    canContinueTraining?: boolean;
    continueTrainingDisabledReason?: string | null;
    featureSignalSummary?: AnnFeatureSignalSummary | null;
    evaluationSummary?: AnnEvaluationSummary | null;
    permutationImportanceSummary?: AnnPermutationImportanceSummary | null;
    permutationImportanceError?: string | null;
    canRunPermutationImportance: boolean;
    permutationImportanceDisabledReason?: string | null;
    isAnalyzingPermutationImportance: boolean;
    canExportPermutationImportance: boolean;
    permutationImportanceExportDisabledReason?: string | null;
    validationPlan?: AnnValidationPlanResult | null;
    validationExecutionPlan?: AnnValidationExecutionPlanResult | null;
    canRunValidation: boolean;
    validationRunDisabledReason?: string | null;
    isValidating: boolean;
    validationRunProgress?: { currentFold: number; totalFolds: number; stage: 'train' | 'infer' } | null;
    validationRunSummary?: AnnValidationExecutionSummary | null;
    validationRunFoldResults?: readonly AnnValidationFoldRunResult[] | null;
    validationRunError?: string | null;
    canExportValidationSummary: boolean;
    validationExportDisabledReason?: string | null;
    canExportTrainedModel: boolean;
    trainedModelExportDisabledReason?: string | null;
    trainedModelImportDisabledReason?: string | null;
    trainedModelContextSource?: TrainedModelContextSource | null;
    activeModelComparisonRunId?: string | null;
    modelComparisonRuns: readonly AnnModelComparisonRun[];
    annSetupImportDisabledReason?: string | null;
    pendingUploadedDatasetCount?: number;
    pendingUploadedDatasetSongs?: readonly UploadedDatasetReattachmentSongReview[];
    uploadedDatasetReattachmentReview?: UploadedDatasetReattachmentReviewSummary | null;
    uploadedDatasetReattachDisabledReason?: string | null;
    modelComparisonImportDisabledReason?: string | null;
    // Config States & Setters
    useDimensionalityReduction: boolean;
    onReductionChoiceChange: (choice: 'none' | ReductionMethod) => void;
    processingMethod: ProcessingMethod;
    onProcessingMethodChange: (method: ProcessingMethod) => void;
    reductionMethod: ReductionMethod;
    targetDimensions: number;
    onTargetDimensionsChange: (dimensions: number) => void;
    networkConfig: MLPConfig | null; // Now expecting MLPConfig
    setNetworkConfig: (config: MLPConfig | null) => void;
    // Callbacks for Actions
    onExtractFeatures: (selectedFeatures: Set<string>) => void;
    onProcessData: (method: ProcessingMethod, range?: [number, number]) => void;
    onReduceDimensions: (method: ReductionMethod, dimensions: number) => void;
    onTrainingExecutionModeChange?: (mode: AnnTrainingExecutionMode) => void;
    onTrain: (mode?: AnnTrainingExecutionMode) => void;
    onAdvanceTraining?: () => void;
    onStartAutomaticTraining?: () => void;
    onContinueTraining?: (additionalEpochs: number, mode: AnnTrainingExecutionMode) => void;
    onInfer: () => void;
    onRunPermutationImportance: () => void;
    onCancelPermutationImportance: () => void;
    onExportPermutationImportance: () => void;
    onRunValidation: () => void;
    onExportValidationSummary: () => void;
    onExportTrainedModel: () => void;
    onImportTrainedModel: () => void;
    onExportAnnSetup: () => void;
    onImportAnnSetup: () => void;
    onReattachUploadedDataset: () => void;
    onContinueWithAttachedUploadedDataset: () => void;
    onExportModelComparisonHistory: () => void;
    onImportModelComparisonHistory: () => void;
    onApplyModelComparisonSetup: () => void;
    onUpdateModelComparisonReview: (runId: string, reviewStatus: AnnModelComparisonReviewStatus, note: string) => void;
    onDeleteModelComparisonRun: (runId: string) => void;
    inferenceFile: File | null;
    inferenceError: string | null;
    uploadedInferenceResult: { predictedLabel: string; confidence?: number } | null;
    onInferenceFileChange: (file: File | null) => void;
    onInferUploadedAudio: () => void;
    canChooseInferenceFile: boolean;
    inferenceFileDisabledReason?: string | null;
    canInferUploadedAudio: boolean;
    uploadedInferDisabledReason?: string | null;
    onShowExplanation?: (id: string) => void;
    // --- NEW: Selected Features State/Callback from Parent --- 
    selectedFeatures: Set<string>; 
    onSelectedFeaturesChange: (features: Set<string>) => void;
    canExportRawFeatures: boolean;
    onOpenExportRawFeatures: () => void;
}

export interface UploadedDatasetReattachmentSongReview {
    name: string;
    assignedLabels: readonly string[];
    externalId?: string;
}

export interface UploadedDatasetReattachmentFileReview {
    name: string;
    externalId?: string;
}

export interface UploadedDatasetReattachmentReviewSummary {
    attachedNames: readonly string[];
    missingNames: readonly string[];
    unmatchedFileNames: readonly string[];
    skippedNames: readonly string[];
    attachedFiles?: readonly UploadedDatasetReattachmentFileReview[];
    missingFiles?: readonly UploadedDatasetReattachmentFileReview[];
    unmatchedFiles?: readonly UploadedDatasetReattachmentFileReview[];
    skippedFiles?: readonly UploadedDatasetReattachmentFileReview[];
    continuedWithAttached?: boolean;
}

const REATTACHMENT_REVIEW_PREVIEW_LIMIT = 4;

function formatHiddenReattachmentCount(count: number, itemLabel: string): string {
    return `${count} more ${itemLabel}${count === 1 ? '' : 's'} not shown`;
}

// --- NEW: Helper Function for Nodes per Layer Input ---
const parseNodesPerLayer = (input: string, layerCount: number): number[] | null => {
    const parts = input.split(',').map(s => s.trim()).filter(s => s !== '');
    if (parts.length !== layerCount) return null; // Mismatch
    const numbers = parts.map(p => parseInt(p, 10));
    if (numbers.some(isNaN) || numbers.some(n => n <= 0)) return null; // Invalid number
    return numbers;
};
// -------------------------------------------------------

const ANNControlsPanel: React.FC<ANNControlsPanelProps> = ({
    className,
    essentiaWorkerReady,
    dataProcessingWorkerReady,
    druidWorkerReady,
    mlpWorkerReady,
    isExtracting,
    isProcessingData,
    isReducing,
    isTraining,
    isTrainingSessionActive = false,
    isInferring,
    canProcess,
    canReduce,
    canTrain,
    trainDisabledReason,
    labelDistribution,
    canInfer,
    inferDisabledReason,
    trainingSummary,
    trainingExecutionMode = 'automatic',
    trainingSessionStatus = null,
    trainingPhaseSnapshot = null,
    isAutomaticTrainingArmed = false,
    canContinueTraining = false,
    continueTrainingDisabledReason = null,
    featureSignalSummary,
    evaluationSummary,
    permutationImportanceSummary,
    permutationImportanceError,
    canRunPermutationImportance,
    permutationImportanceDisabledReason,
    isAnalyzingPermutationImportance,
    canExportPermutationImportance,
    permutationImportanceExportDisabledReason,
    validationPlan,
    validationExecutionPlan,
    canRunValidation,
    validationRunDisabledReason,
    isValidating,
    validationRunProgress,
    validationRunSummary,
    validationRunFoldResults,
    validationRunError,
    canExportValidationSummary,
    validationExportDisabledReason,
    canExportTrainedModel,
    trainedModelExportDisabledReason,
    trainedModelImportDisabledReason,
    trainedModelContextSource = null,
    activeModelComparisonRunId = null,
    modelComparisonRuns,
    annSetupImportDisabledReason,
    pendingUploadedDatasetCount = 0,
    pendingUploadedDatasetSongs = [],
    uploadedDatasetReattachmentReview = null,
    uploadedDatasetReattachDisabledReason,
    modelComparisonImportDisabledReason,
    useDimensionalityReduction,
    onReductionChoiceChange,
    processingMethod,
    onProcessingMethodChange,
    reductionMethod,
    targetDimensions,
    onTargetDimensionsChange,
    networkConfig,
    setNetworkConfig,
    onExtractFeatures,
    onProcessData,
    onReduceDimensions,
    onTrain,
    onTrainingExecutionModeChange = () => {},
    onAdvanceTraining = () => {},
    onStartAutomaticTraining = () => {},
    onContinueTraining = () => {},
    onInfer,
    onRunPermutationImportance,
    onCancelPermutationImportance,
    onExportPermutationImportance,
    onRunValidation,
    onExportValidationSummary,
    onExportTrainedModel,
    onImportTrainedModel,
    onExportAnnSetup,
    onImportAnnSetup,
    onReattachUploadedDataset,
    onContinueWithAttachedUploadedDataset,
    onExportModelComparisonHistory,
    onImportModelComparisonHistory,
    onApplyModelComparisonSetup,
    onUpdateModelComparisonReview,
    onDeleteModelComparisonRun,
    inferenceFile,
    inferenceError,
    uploadedInferenceResult,
    onInferenceFileChange,
    onInferUploadedAudio,
    canChooseInferenceFile,
    inferenceFileDisabledReason,
    canInferUploadedAudio,
    uploadedInferDisabledReason,
    onShowExplanation,
    // --- NEW: Destructure selectedFeatures props ---
    selectedFeatures,
    onSelectedFeaturesChange,
    canExportRawFeatures,
    onOpenExportRawFeatures
}) => {
    const [modelComparisonReviewFilter, setModelComparisonReviewFilter] = useState<AnnModelComparisonReviewFilter>('all');
    const [modelComparisonSortMode, setModelComparisonSortMode] = useState<AnnModelComparisonSortMode>('best-quality');
    const [pendingModelComparisonDeleteId, setPendingModelComparisonDeleteId] = useState<string | null>(null);
    const [uploadedDatasetReattachmentReviewFilter, setUploadedDatasetReattachmentReviewFilter] = useState<AnnUploadedDatasetReattachmentReviewFilter>('all');
    const [additionalTrainingEpochs, setAdditionalTrainingEpochs] = useState(10);
    const [uploadedDatasetReattachmentSearchQuery, setUploadedDatasetReattachmentSearchQuery] = useState('');
    const [expandedUploadedDatasetReattachmentSections, setExpandedUploadedDatasetReattachmentSections] = useState<Set<AnnUploadedDatasetReattachmentReviewSectionKey>>(() => new Set());
    const [isPermutationImportanceExpanded, setIsPermutationImportanceExpanded] = useState(false);

    // Local state for MLP config derived from props or defaults
    const localConfig = networkConfig ?? DEFAULT_MLP_CONFIG;

    // Handler to update parent state
    const updateNetworkConfig = (key: keyof MLPConfig, value: any) => {
        // Basic type checks / conversions
        let processedValue = value;
        if (key === 'hiddenLayers' || key === 'epochs' || key === 'randomSeed') {
            processedValue = parseInt(value, 10);
            if (isNaN(processedValue)) processedValue = key === 'randomSeed' ? undefined : (key === 'hiddenLayers' ? 0 : 1);
            if (key === 'hiddenLayers') processedValue = Math.max(0, processedValue);
            if (key === 'epochs') processedValue = Math.max(1, processedValue);
        }
        if (key === 'learningRate' || key === 'splitRatio' || key === 'targetLoss') {
            processedValue = parseFloat(value);
            if (isNaN(processedValue)) processedValue = key === 'targetLoss' ? undefined : (key === 'splitRatio' ? 0.1 : 0.001);
            if (key === 'splitRatio') processedValue = Math.max(0.01, Math.min(0.99, processedValue));
        }
        if (key === 'nodesPerLayer' && typeof value === 'string') {
             const parsedNodes = parseNodesPerLayer(value, localConfig.hiddenLayers);
             if (parsedNodes) {
                 processedValue = parsedNodes;
             } else {
                 // Keep existing or default if parse fails? Or show error?
                 // For now, keep existing to avoid breaking visualization immediately
                 processedValue = localConfig.nodesPerLayer;
                 console.warn('Invalid nodes per layer input, not updating.');
             }
        }

        const newConfig = { ...localConfig, [key]: processedValue };

        // Adjust nodesPerLayer array size if hiddenLayers changes
        if (key === 'hiddenLayers') {
            const layerCount = Math.max(0, processedValue);
            if (newConfig.nodesPerLayer.length !== layerCount) {
                newConfig.nodesPerLayer = Array(layerCount).fill(16); // Default to 16 nodes
            }
        }

        setNetworkConfig(newConfig);
    };

    // --- Event Handlers ---
    const handleExtractClick = () => { onExtractFeatures(selectedFeatures); };
    const handleProcessClick = () => { onProcessData(processingMethod); };
    const handleReduceClick = () => { onReduceDimensions(reductionMethod, targetDimensions); };
    const handleReattachmentSectionToggle = (key: AnnUploadedDatasetReattachmentReviewSectionKey) => {
        setExpandedUploadedDatasetReattachmentSections(previous => {
            const next = new Set(previous);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // MODIFIED: Handler for feature selection toggle buttons
    const handleFeatureToggle = (featureId: FeatureId) => {
        const newSet = new Set(selectedFeatures);
        if (newSet.has(featureId)) {
            newSet.delete(featureId);
        } else {
            newSet.add(featureId);
        }
        onSelectedFeaturesChange(newSet);
    };

    const isAnyProcessRunning = isExtracting || isProcessingData || isReducing || isTraining || isTrainingSessionActive || isInferring || isValidating || isAnalyzingPermutationImportance;
    const isTrainingModeSwitchBlocked = isExtracting || isProcessingData || isReducing || isInferring || isValidating || isAnalyzingPermutationImportance;
    const isInferenceActionBlocked = isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance;
    const areBaseWorkersReady = essentiaWorkerReady && dataProcessingWorkerReady && druidWorkerReady;
    const formatPercent = (value: number | null) => (
        value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
    );
    const formatOptionalPercent = (value: number | undefined) => (
        value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`
    );
    const formatOptionalLoss = (value: number | undefined) => (
        value === undefined ? 'n/a' : value.toFixed(3)
    );
    const formatPointDelta = (value: number | null) => (
        value === null ? 'n/a' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pts`
    );
    const formatLowConfidenceDelta = (value: number) => {
        if (value > 0) return `+${value} low-confidence`;
        if (value < 0) return `${value} low-confidence`;
        return 'No low-confidence change';
    };
    const formatSignalRange = (value: number) => value.toFixed(3);
    const formatExecutionMode = (mode: AnnTrainingExecutionMode | null | undefined) => (
        mode === 'step' ? 'Internal steps' : mode === 'epoch' ? 'By epoch' : mode === 'automatic' ? 'Automatic' : 'Mode unknown'
    );
    const validationProgressLabel = validationRunProgress?.stage === 'train'
        ? 'Training fold model'
        : validationRunProgress?.stage === 'infer'
            ? 'Inferring holdout labels'
            : null;
    const bestComparableRun = getBestAnnModelComparisonRun(modelComparisonRuns);
    const bestComparableRunLabel = bestComparableRun && bestComparableRun.datasetAccuracy !== null
        ? `Best dataset accuracy ${formatPercent(bestComparableRun.datasetAccuracy)}`
        : bestComparableRun && bestComparableRun.validationAccuracy !== null
            ? `Best validation accuracy ${formatPercent(bestComparableRun.validationAccuracy)}`
            : null;
    const modelComparisonGuidance = getAnnModelComparisonGuidance(modelComparisonRuns);
    const modelComparisonNextLabel = modelComparisonGuidance.nextInputKind === null
        ? 'All pipelines evaluated'
        : `Next: ${modelComparisonGuidance.nextAction} ${modelComparisonGuidance.nextInputKind} input`;
    const modelComparisonSetupSuggestion = getAnnModelComparisonSetupSuggestion(modelComparisonRuns);
    const modelComparisonView = useMemo(() => getAnnModelComparisonView({
        runs: modelComparisonRuns,
        reviewFilter: modelComparisonReviewFilter,
        sortMode: modelComparisonSortMode,
    }), [modelComparisonReviewFilter, modelComparisonRuns, modelComparisonSortMode]);
    const modelComparisonBenchmark = useMemo(() => getAnnModelComparisonBenchmark({
        runs: modelComparisonRuns,
        activeRunId: activeModelComparisonRunId,
    }), [activeModelComparisonRunId, modelComparisonRuns]);
    const activeModelComparisonRun = activeModelComparisonRunId
        ? modelComparisonRuns.find(run => run.id === activeModelComparisonRunId) ?? null
        : null;
    const trainedModelContextTitle = trainedModelContextSource === 'imported'
        ? 'Imported model context'
        : 'Session-trained model context';
    const trainedModelContextWarnings = activeModelComparisonRun
        ? activeModelComparisonRun.warningCodes.map(code => trainingWarningCodeLabels[code])
        : trainingSummary?.warnings.map(warning => trainingWarningCodeLabels[warning.code] ?? warning.message) ?? [];
    const featureSignalRows = featureSignalSummary?.rows.slice(0, 5) ?? [];
    const permutationImportanceView = permutationImportanceSummary
        ? getAnnPermutationImportanceView(permutationImportanceSummary, {
            isExpanded: isPermutationImportanceExpanded,
            limit: 5,
        })
        : null;
    const permutationImportanceRows = permutationImportanceView?.rows ?? [];
    const expectedUploadedDatasetSongsPreview = pendingUploadedDatasetSongs.slice(0, REATTACHMENT_REVIEW_PREVIEW_LIMIT);
    const expectedUploadedDatasetHiddenCount = Math.max(0, pendingUploadedDatasetSongs.length - expectedUploadedDatasetSongsPreview.length);
    const expandedReattachmentReviewSectionKeys = useMemo(
        () => Array.from(expandedUploadedDatasetReattachmentSections),
        [expandedUploadedDatasetReattachmentSections]
    );
    const reattachmentReviewSections = useMemo(() => (
        uploadedDatasetReattachmentReview
            ? getAnnUploadedDatasetReattachmentReviewVisibleSections(uploadedDatasetReattachmentReview, {
                statusFilter: uploadedDatasetReattachmentReviewFilter,
                searchQuery: uploadedDatasetReattachmentSearchQuery,
                expandedSectionKeys: expandedReattachmentReviewSectionKeys,
                previewLimit: REATTACHMENT_REVIEW_PREVIEW_LIMIT,
            })
            : []
    ), [
        expandedReattachmentReviewSectionKeys,
        uploadedDatasetReattachmentReview,
        uploadedDatasetReattachmentReviewFilter,
        uploadedDatasetReattachmentSearchQuery,
    ]);
    const reattachmentReviewConfirmation = useMemo(() => (
        uploadedDatasetReattachmentReview
            ? getAnnUploadedDatasetReattachmentReviewConfirmation(uploadedDatasetReattachmentReview)
            : null
    ), [uploadedDatasetReattachmentReview]);
    const validationGuidance = getAnnValidationGuidance({ trainingSummary: trainingSummary ?? null, evaluationSummary: evaluationSummary ?? null });
    const getLabelStatusClass = (status: AnnLabelDistributionStatus) => {
        switch (status) {
            case 'ready':
                return 'text-green-300';
            case 'too-small':
                return 'text-yellow-300';
            case 'empty':
                return 'text-[var(--text-secondary)]';
            default:
                return status satisfies never;
        }
    };

    // --- Component UI --- 
    return (
        <BasePanel
            className={`flex h-[85vh] flex-col overflow-y-scroll hide-scrollbar md:h-full md:min-h-0 ${className || ''}`}
            data-augmented-ui="tl-clip tr-2-clip-x br-clip-x bl-clip border inlay"
            style={{ '--aug-border-x': '1px' } as React.CSSProperties}
        >
            <h2 className="text-lg font-semibold mb-3 text-[var(--accent-secondary)] flex-shrink-0 p-1">Controls</h2>

            {/* Scrollable area for controls */}
            <div className="flex-grow overflow-y-auto pr-1 pl-1 pb-3 hide-scrollbar space-y-4 text-sm">
                {/* --- Section 1: Feature Extraction --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-md font-semibold ml-2 mb-2 text-[var(--accent-primary)]">1. Feature Extraction</h3>
                    {/* MODIFIED to use availableMirFeatures */}
                    <div className="flex flex-wrap gap-x-1 gap-y-2 flex-grow mb-2 pr-1"> {/* REMOVED max-height and scroll */}
                        {availableMirFeatures.map(feature => (
                             <div key={feature.id} className="relative group flex items-center justify-between text-xs">
                                 <button
                                     onClick={() => handleFeatureToggle(feature.id)}
                                     className={`text-xs pr-2 pl-2 py-1 cursor-pointer border border-gray-700 hover:border-[var(--accent-primary)]/50 data-[checked=true]:bg-[var(--accent-primary)]/20 data-[checked=true]:border-[var(--accent-primary)] text-[var(--text-primary)] disabled:opacity-[var(--disabled-opacity)] disabled:cursor-not-allowed`}
                                     data-checked={selectedFeatures.has(feature.id)}
                                     disabled={isAnyProcessRunning}
                                     title={feature.name} // Use feature name for title
                                 >
                                     {feature.name} {/* Use feature name for display */}
                                 </button>
                                 {/* Optional: Add explanation button if needed 
                                 <button 
                                    onClick={() => onShowExplanation?.(feature.id)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-blue-900/50 invisible group-hover:visible disabled:opacity-[var(--disabled-opacity)] disabled:cursor-not-allowed z-10"
                                    title={`Explain ${feature.name}`}
                                    disabled={isAnyProcessRunning}
                                >
                                ?
                                </button> */}
                            </div>
                        ))}
                    </div>
                     {/* ADDED Select All / Clear Buttons */} 
                     <div className="flex gap-2 mt-2 mb-1">
                         <Button
                             onClick={() => {
                                 // MODIFIED to use availableMirFeatures
                                 const allFeatureIds = new Set(availableMirFeatures.map(f => f.id));
                                 onSelectedFeaturesChange(allFeatureIds);
                             }}
                             disabled={isAnyProcessRunning}
                             variant="secondary"
                             className="px-4 py-0.5 text-xs"
                             title="Select all available features"
                         >
                             All
                         </Button>
                         <Button
                             onClick={() => onSelectedFeaturesChange(new Set())}
                             disabled={isAnyProcessRunning || selectedFeatures.size === 0}
                             variant="secondary"
                             className="px-4 py-0.5 text-xs"
                             title="Clear feature selection"
                         >
                             Clear
                         </Button>
                    </div>
                    <Button
                        onClick={handleExtractClick}
                        disabled={isAnyProcessRunning || !essentiaWorkerReady || selectedFeatures.size === 0}
                        className="w-full text-sm py-1 mt-2"
                        variant="primary" // Match ControlsPanel button style
                        enableTilt={true} // Match ControlsPanel button style
                    >
                        {isExtracting ? 'Processing...' : `Extract Features`}
                    </Button>
                    {canExportRawFeatures && (
                        <div className="mt-2 flex-shrink-0">
                            <Button
                                type="button"
                                onClick={onOpenExportRawFeatures}
                                className="w-full text-sm py-1"
                                variant="primary"
                                enableTilt={true}
                                disabled={isAnyProcessRunning}
                                title="Export selected dimensions from the raw feature matrix"
                            >
                                Export Raw Features
                            </Button>
                            <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
                                Or click the info icon in the Song Pool for each track to see their raw features
                            </p>
                        </div>
                    )}
                </div>

                {/* --- Section 2: Data Processing --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-md font-semibold ml-2 mb-2 text-[var(--accent-primary)]">2. Data Processing</h3>
                    <div className="mb-2">
                         <span className="text-xs block mb-1 text-[var(--text-secondary)]">Method:</span>
                         <div className="flex flex-wrap gap-2" role="group" aria-label="Data processing method">
                             {(['standardize', 'normalize', 'none'] as const).map(method => (
                                 <button
                                     key={method}
                                     type="button"
                                     onClick={() => onProcessingMethodChange(method)}
                                     disabled={isAnyProcessRunning}
                                     aria-pressed={processingMethod === method}
                                     data-ann-processing-method={method}
                                     className="cursor-pointer border border-gray-700 bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]/60 hover:bg-[var(--accent-primary)]/10 aria-pressed:border-[var(--accent-primary)] aria-pressed:bg-[var(--accent-primary)]/20 disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]"
                                 >
                                     {method === 'standardize' ? 'Standardize' : method === 'normalize' ? 'Normalize (0-1)' : 'None'}
                                 </button>
                             ))}
                         </div>
                    </div>
                    <Button
                        onClick={handleProcessClick}
                        disabled={isAnyProcessRunning || !dataProcessingWorkerReady || !canProcess}
                        className="w-full text-sm py-1"
                        variant="primary" // Match ControlsPanel button style
                        enableTilt={true} // Match ControlsPanel button style
                    >
                        {isProcessingData ? 'Processing...' : `Process Data`}
                    </Button>
                </div>

                {/* --- Section 3: Dimensionality Reduction --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <div className="mb-2 flex items-center gap-1">
                        <h3 className="ml-2 text-md font-semibold text-[var(--accent-primary)]">3. Dimensionality Reduction</h3>
                        <span
                            title="Choose None to train from the prepared feature matrix, or reduce it with PCA, UMAP, or t-SNE."
                            className="cursor-help text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                            onClick={() => onShowExplanation?.('ann-dim-reduction')}
                        >
                            (?)
                        </span>
                    </div>
                    <div>
                        <div className="mb-2 flex flex-wrap items-start gap-x-6 gap-y-2">
                            <div>
                                <span className="mb-1 block text-xs text-[var(--text-secondary)]">Algorithm:</span>
                                <div id="reductionMethod" className="flex flex-wrap gap-2" role="group" aria-label="Reduction algorithm">
                                    {(['none', 'pca', 'umap', 'tsne'] as const).map(method => {
                                        const isSelected = method === 'none' ? !useDimensionalityReduction : useDimensionalityReduction && reductionMethod === method;
                                        return (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => onReductionChoiceChange(method)}
                                                disabled={isAnyProcessRunning}
                                                aria-pressed={isSelected}
                                                data-ann-reduction-method={method}
                                                className="cursor-pointer border border-gray-700 bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]/60 hover:bg-[var(--accent-primary)]/10 aria-pressed:border-[var(--accent-primary)] aria-pressed:bg-[var(--accent-primary)]/20 disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]"
                                            >
                                                {method === 'none' ? 'None' : method === 'tsne' ? 't-SNE' : method.toUpperCase()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <span className="mb-1 block text-xs text-[var(--text-secondary)]">Target Dimensions:</span>
                                <div id="reductionDims" className="flex gap-2" role="group" aria-label="Target dimensions">
                                    {([2, 3] as const).map(dimensions => (
                                        <button
                                            key={dimensions}
                                            type="button"
                                            onClick={() => onTargetDimensionsChange(dimensions)}
                                            disabled={isAnyProcessRunning || !useDimensionalityReduction}
                                            aria-pressed={useDimensionalityReduction && targetDimensions === dimensions}
                                            data-ann-reduction-dimensions={dimensions}
                                            className="cursor-pointer border border-gray-700 bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]/60 hover:bg-[var(--accent-primary)]/10 aria-pressed:border-[var(--accent-primary)] aria-pressed:bg-[var(--accent-primary)]/20 disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]"
                                        >
                                            {dimensions}D
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={handleReduceClick}
                            disabled={isAnyProcessRunning || !useDimensionalityReduction || !druidWorkerReady || !canReduce}
                            className="w-full py-1 text-sm"
                            variant="primary"
                            enableTilt={true}
                        >
                            Reduce Dimensions
                        </Button>
                    </div>
                </div>

                {/* --- Section 4: MLP Configuration --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-md font-semibold ml-2 mb-2 text-[var(--accent-primary)]">4. MLP Configuration</h3>
                    <div className="space-y-1.5 text-xs">
                        {/* Row 1: Hidden Layers & Nodes */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="hiddenLayers" className="block text-xs mb-0.5">Hidden Layers:</label>
                                <input type="number" id="hiddenLayers" value={localConfig.hiddenLayers} onChange={e => updateNetworkConfig('hiddenLayers', e.target.value)} min="0" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="nodesPerLayer" className="block text-xs mb-0.5">Nodes (csv):</label>
                                <input type="text" id="nodesPerLayer" value={localConfig.nodesPerLayer.join(', ')} onChange={e => updateNetworkConfig('nodesPerLayer', e.target.value)} placeholder="e.g., 16, 8" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning || localConfig.hiddenLayers === 0}/>
                            </div>
                        </div>
                        {/* Row 2: Activation & Optimizer */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="activation" className="block text-xs mb-0.5">Activation:</label>
                                <select id="activation" value={localConfig.activation} onChange={e => updateNetworkConfig('activation', e.target.value)} className="w-full rounded border border-[var(--foreground)]/50 bg-transparent px-2 py-0.5 text-xs focus:outline-none" disabled={isAnyProcessRunning}>
                                    <option value="relu">ReLU</option>
                                    <option value="sigmoid">Sigmoid</option>
                                    <option value="tanh">Tanh</option>
                                </select>
                             </div>
                             <div>
                                <label htmlFor="optimizer" className="block text-xs mb-0.5">Optimizer:</label>
                                <select id="optimizer" value={localConfig.optimizer} onChange={e => updateNetworkConfig('optimizer', e.target.value)} className="w-full rounded border border-[var(--foreground)]/50 bg-transparent px-2 py-0.5 text-xs focus:outline-none" disabled={isAnyProcessRunning}>
                                     <option value="adam">Adam</option>
                                     <option value="sgd">SGD</option>
                                     <option value="rmsprop">RMSProp</option>
                                 </select>
                            </div>
                        </div>
                         {/* Row 3: Learning Rate & Epochs */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="learningRate" className="block text-xs mb-0.5">Learn Rate:</label>
                                <input type="number" id="learningRate" value={localConfig.learningRate} onChange={e => updateNetworkConfig('learningRate', e.target.value)} step="0.0001" min="0.00001" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                             <div>
                                <label htmlFor="epochs" className="block text-xs mb-0.5">Max Epochs:</label>
                                <input type="number" id="epochs" value={localConfig.epochs} onChange={e => updateNetworkConfig('epochs', e.target.value)} min="1" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Row 4: Split Ratio & Seed */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="splitRatio" className="block text-xs mb-0.5">Train Split (%):</label>
                                <input type="number" id="splitRatio" value={localConfig.splitRatio * 100} onChange={e => updateNetworkConfig('splitRatio', parseFloat(e.target.value) / 100)} min="1" max="99" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="randomSeed" className="block text-xs mb-0.5">Seed (opt.):</label>
                                <input type="number" id="randomSeed" value={localConfig.randomSeed ?? ''} onChange={e => updateNetworkConfig('randomSeed', e.target.value === '' ? undefined : e.target.value)} placeholder="Optional" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Optional: Target Loss */} 
                        {/* <div>
                             <label htmlFor="targetLoss" className="block text-xs mb-0.5">Target Loss (opt.):</label>
                             <input type="number" id="targetLoss" value={localConfig.targetLoss ?? ''} onChange={e => updateNetworkConfig('targetLoss', e.target.value === '' ? undefined : e.target.value)} step="0.001" placeholder="e.g., 0.05" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                         </div> */} 
                    </div>
                </div>

                {/* --- Section 5: Training --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-md font-semibold ml-2 mb-2 text-[var(--accent-primary)]">5. Training</h3>
                    <div className="space-y-2">
                        <div className="space-y-1.5" data-ann-training-mode-controls="true">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">Execution mode</span>
                            <div className="grid grid-cols-3 border border-[var(--foreground)]/25 p-0.5">
                                {([
                                    ['automatic', 'Automatic'],
                                    ['step', 'Internal Steps'],
                                    ['epoch', 'By Epoch'],
                                ] as const).map(([mode, label]) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={`min-h-8 px-1 text-[10px] transition-colors ${trainingExecutionMode === mode ? 'bg-cyan-400/15 text-cyan-200' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
                                        aria-pressed={trainingExecutionMode === mode}
                                        disabled={isTrainingModeSwitchBlocked}
                                        onClick={() => onTrainingExecutionModeChange(mode)}
                                        data-ann-training-mode={mode}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] leading-snug text-[var(--text-secondary)]">
                                {trainingExecutionMode === 'step'
                                    ? 'Pause at input, forward activation, loss, backpropagation, and optimizer update phases.'
                                    : trainingExecutionMode === 'epoch'
                                        ? 'Train one complete epoch per action and inspect metrics between epochs.'
                                        : 'Run every configured epoch without pausing.'}
                            </p>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
                                <span>Label samples</span>
                                <span>
                                    {labelDistribution.assignedSongCount} songs / {labelDistribution.nonEmptyLabelCount} active labels
                                </span>
                            </div>
                            {labelDistribution.rows.length > 0 && (
                                <div className="space-y-1">
                                    {labelDistribution.rows.map(row => (
                                        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                                            <span className="truncate text-[var(--text-primary)]" title={row.label}>{row.label}</span>
                                            <span className="text-[var(--text-secondary)]">{row.count}</span>
                                            <span className={getLabelStatusClass(row.status)}>{row.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!isTrainingSessionActive ? (
                            <Button
                                onClick={() => onTrain(trainingExecutionMode)}
                                disabled={isAnyProcessRunning || !mlpWorkerReady || !canTrain}
                                title={trainDisabledReason ?? undefined}
                                className="w-full py-1.5 text-sm font-semibold"
                                variant="primary"
                                enableTilt={true}
                                data-ann-start-training={trainingExecutionMode}
                            >
                                {isTraining ? 'Training...' : trainingExecutionMode === 'automatic' ? 'Train Automatic' : 'Start Training Session'}
                            </Button>
                        ) : (
                            <div className="space-y-2 border-t border-[var(--foreground)]/20 pt-2" data-ann-training-session="active">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-cyan-200">
                                        {trainingPhaseSnapshot?.label ?? (trainingExecutionMode === 'step' ? 'Internal training ready' : trainingExecutionMode === 'epoch' ? 'Epoch training ready' : 'Automatic training ready')}
                                    </span>
                                    <span className="tabular-nums text-[var(--text-secondary)]">
                                        {trainingSessionStatus?.completedEpochs ?? 0} / {trainingSessionStatus?.targetEpochs ?? localConfig.epochs} epochs
                                    </span>
                                </div>
                                {trainingPhaseSnapshot && (
                                    <div className="space-y-1 bg-black/20 px-2 py-1.5 text-[10px] text-[var(--text-secondary)]" data-ann-training-phase={trainingPhaseSnapshot.phase}>
                                        <p className="leading-snug text-[var(--text-primary)]">{trainingPhaseSnapshot.description}</p>
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                            <span>Epoch</span>
                                            <span className="text-right">{trainingPhaseSnapshot.epoch} / {trainingPhaseSnapshot.targetEpochs}</span>
                                            <span>Batch</span>
                                            <span className="text-right">{trainingPhaseSnapshot.batchIndex} / {trainingPhaseSnapshot.batchCount}</span>
                                            {trainingPhaseSnapshot.activeLayerName && <><span>Active layer</span><span className="truncate text-right">{trainingPhaseSnapshot.activeLayerName}</span></>}
                                            {trainingPhaseSnapshot.predictedLabel && <><span>Prediction</span><span className="truncate text-right">{trainingPhaseSnapshot.predictedLabel} ({((trainingPhaseSnapshot.predictionConfidence ?? 0) * 100).toFixed(1)}%)</span></>}
                                            {trainingPhaseSnapshot.loss !== undefined && <><span>Sample loss</span><span className="text-right">{trainingPhaseSnapshot.loss.toFixed(4)}</span></>}
                                            {trainingPhaseSnapshot.meanAbsoluteWeightDelta !== undefined && <><span>Mean |weight delta|</span><span className="text-right">{trainingPhaseSnapshot.meanAbsoluteWeightDelta.toExponential(2)}</span></>}
                                        </div>
                                    </div>
                                )}
                                <Button
                                    onClick={trainingExecutionMode === 'automatic' ? onStartAutomaticTraining : onAdvanceTraining}
                                    disabled={isTraining || (trainingExecutionMode === 'automatic' && isAutomaticTrainingArmed)}
                                    className="w-full py-1.5 text-sm font-semibold"
                                    variant="primary"
                                    data-ann-advance-training={trainingExecutionMode}
                                    data-ann-start-automatic={trainingExecutionMode === 'automatic' ? 'true' : undefined}
                                >
                                    {trainingExecutionMode === 'automatic'
                                        ? isTraining || isAutomaticTrainingArmed ? 'Training Automatically...' : 'Train Automatic'
                                        : isTraining
                                            ? 'Advancing...'
                                            : trainingExecutionMode === 'step'
                                                ? 'Next Training Phase'
                                                : 'Train Next Epoch'}
                                </Button>
                                <p className="text-[10px] leading-snug text-[var(--text-secondary)]">
                                    {trainingExecutionMode === 'automatic' && !isAutomaticTrainingArmed
                                        ? 'Automatic mode is selected. Start it explicitly when you are ready.'
                                        : trainingSessionStatus?.nextAction ?? 'Advance the paused training session.'}
                                </p>
                            </div>
                        )}
                        {trainDisabledReason && (
                            <p className="text-xs leading-snug text-yellow-300/90">
                                {trainDisabledReason}
                            </p>
                        )}
                        {trainingSummary && (
                            <div className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Training summary</span>
                                    <span className="text-green-300">
                                        {formatOptionalPercent(trainingSummary.finalAccuracy)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--text-secondary)]">
                                    <span>Input</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {trainingSummary.inputKind} / {trainingSummary.inputDimension} dims
                                    </span>
                                    <span>Data</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {trainingSummary.labeledSongCount} songs / {trainingSummary.classCount} labels
                                    </span>
                                    <span>Split</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {(trainingSummary.splitRatio * 100).toFixed(0)}% train / {(trainingSummary.validationRatio * 100).toFixed(0)}% val
                                    </span>
                                    <span>Seed</span>
                                    <span className="text-right text-[var(--text-primary)]">{trainingSummary.seed}</span>
                                    <span>MLP</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {trainingSummary.hiddenLayers} layer{trainingSummary.hiddenLayers === 1 ? '' : 's'} / {trainingSummary.activation}
                                    </span>
                                    <span>Features</span>
                                    <span className="truncate text-right text-[var(--text-primary)]" title={trainingSummary.selectedFeatureIds.join(', ')}>
                                        {trainingSummary.selectedFeatureIds.join(', ') || 'none'}
                                    </span>
                                    <span>Optimizer</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {trainingSummary.optimizer} / {trainingSummary.epochs} epochs
                                    </span>
                                    <span>Batch</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        batch {trainingSummary.batchSize}
                                    </span>
                                    <span>Loss</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        loss {formatOptionalLoss(trainingSummary.finalLoss)}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {trainingSummary.labelCounts.map(row => (
                                        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                            <span className="truncate text-[var(--text-primary)]" title={row.label}>{row.label}</span>
                                            <span className="text-[var(--text-secondary)]">{row.count}</span>
                                        </div>
                                    ))}
                                </div>
                                {trainingSummary.warnings.length > 0 && (
                                    <div className="space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                        {trainingSummary.warnings.map(warning => (
                                            <p key={warning.code} className="text-yellow-300/90">
                                                {warning.message}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {trainingSummary && !isTrainingSessionActive && (
                            <div className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs" data-ann-continue-training="true">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Further training</span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">Current total: {trainingSummary.epochs} epochs</span>
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                    <label className="min-w-0">
                                        <span className="mb-0.5 block text-[10px] text-[var(--text-secondary)]">Additional epochs</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            step="1"
                                            value={additionalTrainingEpochs}
                                            onChange={event => setAdditionalTrainingEpochs(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                                            className="h-8 w-full border border-[var(--foreground)]/40 bg-transparent px-2 text-xs focus:border-[var(--accent-primary)] focus:outline-none"
                                            disabled={isAnyProcessRunning}
                                            data-ann-additional-epochs="true"
                                        />
                                    </label>
                                    <Button
                                        onClick={() => onContinueTraining(additionalTrainingEpochs, trainingExecutionMode)}
                                        disabled={isAnyProcessRunning || !canContinueTraining}
                                        title={continueTrainingDisabledReason ?? undefined}
                                        className="self-end px-3 py-1.5 text-xs font-semibold"
                                        variant="secondary"
                                    >
                                        Continue
                                    </Button>
                                </div>
                                {continueTrainingDisabledReason && (
                                    <p className="text-[10px] leading-snug text-yellow-300/90">{continueTrainingDisabledReason}</p>
                                )}
                            </div>
                        )}
                        {featureSignalSummary && (
                            <div
                                className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs"
                                data-ann-feature-signal-panel="true"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Feature signal</span>
                                    <span className="text-[var(--text-secondary)]">
                                        {featureSignalSummary.dimensionCount} input{featureSignalSummary.dimensionCount === 1 ? '' : 's'} / {featureSignalSummary.labeledRowCount} labeled rows
                                    </span>
                                </div>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {featureSignalSummary.summary}
                                </p>
                                <div className="overflow-hidden rounded border border-[var(--foreground)]/15">
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] gap-2 border-b border-[var(--foreground)]/15 px-2 py-1 font-semibold text-[var(--text-primary)]">
                                        <span>Input</span>
                                        <span>Signal</span>
                                        <span>Score</span>
                                        <span>Spread</span>
                                    </div>
                                    <div className="divide-y divide-[var(--foreground)]/10 text-[var(--text-secondary)]">
                                        {featureSignalRows.map(row => (
                                            <div
                                                key={`${row.dimensionIndex}-${row.dimensionLabel}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] gap-2 px-2 py-1"
                                                data-ann-feature-signal-row={row.dimensionLabel}
                                            >
                                                <span className="truncate text-[var(--text-primary)]" title={row.dimensionLabel}>
                                                    {row.dimensionLabel}
                                                </span>
                                                <span className="truncate" title={`${row.strongestLabel} high; ${row.weakestLabel} low`}>
                                                    {row.scoreLabel}
                                                </span>
                                                <span className="truncate">
                                                    {formatPercent(row.score)}
                                                </span>
                                                <span className="truncate" title={`${row.strongestLabel} high; ${row.weakestLabel} low`}>
                                                    {row.strongestLabel} high / {formatSignalRange(row.meanRange)} range
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {featureSignalSummary.inputKind === 'reduced' && (
                                    <p className="leading-snug text-yellow-300/90">
                                        Reduced dimensions are composite signals; compare them with validation before pruning source features.
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="space-y-3 border-t border-[var(--foreground)]/25 pt-3 text-xs" data-ann-training-portability="true">
                            <div className="space-y-2">
                                <span className="font-semibold text-[var(--text-primary)]">Trained model portability</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        onClick={onExportTrainedModel}
                                        disabled={isAnyProcessRunning || !canExportTrainedModel}
                                        title={trainedModelExportDisabledReason ?? 'Export the live trained model, weights, and ANN pipeline snapshot.'}
                                        className="text-xs"
                                        variant="secondary"
                                    >
                                        Export Trained Model
                                    </Button>
                                    <Button
                                        onClick={onImportTrainedModel}
                                        disabled={isAnyProcessRunning || Boolean(trainedModelImportDisabledReason)}
                                        title={trainedModelImportDisabledReason ?? 'Import a trained ANN model JSON export.'}
                                        className="text-xs"
                                        variant="secondary"
                                    >
                                        Import Trained Model
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 border-t border-[var(--foreground)]/20 pt-3">
                                <span className="font-semibold text-[var(--text-primary)]">Setup portability</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        onClick={onExportAnnSetup}
                                        disabled={isAnyProcessRunning}
                                        title="Export current labels and ANN settings as JSON."
                                        className="text-xs"
                                        variant="secondary"
                                    >
                                        Export Labels &amp; Setup
                                    </Button>
                                    <Button
                                        onClick={onImportAnnSetup}
                                        disabled={isAnyProcessRunning || Boolean(annSetupImportDisabledReason)}
                                        title={annSetupImportDisabledReason ?? 'Import labels and ANN settings JSON.'}
                                        className="text-xs"
                                        variant="secondary"
                                    >
                                        Import Labels &amp; Setup
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Section 6: Inference --- */}
                <div
                    className="mb-4 p-3 flex flex-col"
                    data-augmented-ui="tl-clip br-clip border"
                    style={{ '--aug-border-bg': 'var(--foreground)',
                        '--aug-border-all': '1px',
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-md font-semibold ml-2 mb-2 text-[var(--accent-primary)]">6. Inference</h3>
                    <div className="space-y-2">
                         <Button
                            onClick={onInfer}
                            disabled={isInferenceActionBlocked || !mlpWorkerReady || !canInfer}
                            title={inferDisabledReason ?? undefined}
                            className="w-full py-1.5 text-sm font-semibold"
                            variant="primary"
                             enableTilt={true}
                        >
                            {isInferring ? 'Inferring...' : 'Infer Labels'}
                        </Button>
                        {inferDisabledReason && (
                            <p className="text-xs leading-snug text-yellow-300/90">
                                {inferDisabledReason}
                            </p>
                        )}
                        {evaluationSummary && (
                            <div className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Dataset evaluation</span>
                                    <span className="text-green-300">
                                        {formatPercent(evaluationSummary.accuracy)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--text-secondary)]">
                                    <span>Correct</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {evaluationSummary.correctPredictions}/{evaluationSummary.totalSongs}
                                    </span>
                                    <span>Baseline</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {formatPercent(evaluationSummary.majorityBaselineAccuracy)}
                                        {evaluationSummary.majorityBaselineLabel ? ` ${evaluationSummary.majorityBaselineLabel}` : ''}
                                    </span>
                                    <span>Avg confidence</span>
                                    <span className="text-right text-[var(--text-primary)]">
                                        {formatPercent(evaluationSummary.averageConfidence)}
                                    </span>
                                    <span>Low confidence</span>
                                    <span className={evaluationSummary.lowConfidenceCount > 0 ? 'text-right text-yellow-300' : 'text-right text-[var(--text-primary)]'}>
                                        {evaluationSummary.lowConfidenceCount} below {formatPercent(evaluationSummary.lowConfidenceThreshold)}
                                    </span>
                                    {(evaluationSummary.missingPredictionCount > 0 || evaluationSummary.unknownPredictionCount > 0) && (
                                        <>
                                            <span>Gaps</span>
                                            <span className="text-right text-yellow-300">
                                                {evaluationSummary.missingPredictionCount} missing, {evaluationSummary.unknownPredictionCount} unknown
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {evaluationSummary.rows.map(row => (
                                        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2">
                                            <span className="truncate text-[var(--text-primary)]" title={row.label}>{row.label}</span>
                                            <span title="Precision">P {formatPercent(row.precision)}</span>
                                            <span title="Recall">R {formatPercent(row.recall)}</span>
                                            <span title="F1 score">F1 {formatPercent(row.f1)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="overflow-x-auto">
                                    <div className="mb-1 text-[var(--text-secondary)]">Confusion matrix</div>
                                    <table className="min-w-full border-collapse text-[11px]">
                                        <thead>
                                            <tr className="text-[var(--text-secondary)]">
                                                <th className="whitespace-nowrap border border-[var(--foreground)]/20 px-1 py-0.5 text-left font-normal">
                                                    Actual \ Predicted
                                                </th>
                                                {evaluationSummary.predictedLabels.map(label => (
                                                    <th key={label} className="whitespace-nowrap border border-[var(--foreground)]/20 px-1 py-0.5 text-right font-normal">
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {evaluationSummary.actualLabels.map((actualLabel, rowIndex) => (
                                                <tr key={actualLabel}>
                                                    <th className="whitespace-nowrap border border-[var(--foreground)]/20 px-1 py-0.5 text-left font-normal text-[var(--text-primary)]">
                                                        {actualLabel}
                                                    </th>
                                                    {evaluationSummary.predictedLabels.map((predictedLabel, columnIndex) => (
                                                        <td key={`${actualLabel}-${predictedLabel}`} className="border border-[var(--foreground)]/20 px-1 py-0.5 text-right">
                                                            {evaluationSummary.confusionMatrix[rowIndex]?.[columnIndex] ?? 0}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {trainingSummary && (
                            <div
                                className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs"
                                data-ann-permutation-impact-panel="true"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Feature impact</span>
                                    {permutationImportanceSummary && (
                                        <span className="text-[var(--text-secondary)]">
                                            Baseline {formatPercent(permutationImportanceSummary.baselineAccuracy)}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    onClick={onRunPermutationImportance}
                                    disabled={isAnyProcessRunning || !canRunPermutationImportance}
                                    title={permutationImportanceDisabledReason ?? undefined}
                                    className="w-full text-xs"
                                    variant="secondary"
                                >
                                    {isAnalyzingPermutationImportance ? 'Analyzing...' : 'Analyze Feature Impact'}
                                </Button>
                                {isAnalyzingPermutationImportance && (
                                    <Button
                                        onClick={onCancelPermutationImportance}
                                        className="w-full text-xs"
                                        variant="secondary"
                                    >
                                        Cancel Feature Impact
                                    </Button>
                                )}
                                {permutationImportanceError && (
                                    <p className="leading-snug text-red-300">
                                        {permutationImportanceError}
                                    </p>
                                )}
                                {!permutationImportanceSummary && permutationImportanceDisabledReason && (
                                    <p className="leading-snug text-[var(--text-secondary)]">
                                        {permutationImportanceDisabledReason}
                                    </p>
                                )}
                                {permutationImportanceSummary && (
                                    <>
                                        <p className="leading-snug text-[var(--text-secondary)]">
                                            {permutationImportanceSummary.summary}
                                        </p>
                                        {permutationImportanceView && permutationImportanceView.groups.length > 0 && (
                                            <div className="space-y-1" data-ann-permutation-impact-groups="true">
                                                <div className="font-semibold text-[var(--text-primary)]">Grouped interpretation</div>
                                                <div className="space-y-1 text-[var(--text-secondary)]">
                                                    {permutationImportanceView.groups.map(group => (
                                                        <div
                                                            key={group.groupLabel}
                                                            className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-2"
                                                            data-ann-permutation-impact-group={group.groupLabel}
                                                        >
                                                            <span className="truncate text-[var(--text-primary)]" title={group.summaryLabel}>
                                                                {group.groupLabel}
                                                            </span>
                                                            <span className="truncate" title={group.inputCountLabel}>
                                                                {group.inputCountLabel}
                                                            </span>
                                                            <span className="truncate" title={`Top input ${group.topDimensionLabel}`}>
                                                                Top input {group.topDimensionLabel}
                                                            </span>
                                                            <span className="truncate" title={group.accuracyDropLabel}>
                                                                {group.accuracyDropLabel}
                                                            </span>
                                                            <span className="truncate" title={group.confidenceDropLabel}>
                                                                {group.confidenceDropLabel}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="overflow-hidden rounded border border-[var(--foreground)]/15">
                                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,0.9fr)] gap-2 border-b border-[var(--foreground)]/15 px-2 py-1 font-semibold text-[var(--text-primary)]">
                                                <span>Input</span>
                                                <span>Impact</span>
                                                <span>Permuted</span>
                                                <span>Drop</span>
                                                <span>Confidence</span>
                                            </div>
                                            <div className="divide-y divide-[var(--foreground)]/10 text-[var(--text-secondary)]">
                                                {permutationImportanceRows.map(row => (
                                                    <div
                                                        key={`${row.dimensionIndex}-${row.dimensionLabel}`}
                                                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,0.9fr)] gap-2 px-2 py-1"
                                                        data-ann-permutation-impact-row={row.dimensionLabel}
                                                    >
                                                        <span className="truncate text-[var(--text-primary)]" title={row.dimensionLabel}>
                                                            {row.dimensionLabel}
                                                        </span>
                                                        <span className="truncate" title={`${row.correctPredictions}/${row.totalSongs} correct`}>
                                                            {row.impactLabel}
                                                        </span>
                                                        <span className="truncate" title={`${row.correctPredictions}/${row.totalSongs}`}>
                                                            {formatPercent(row.permutedAccuracy)} {row.correctPredictions}/{row.totalSongs}
                                                        </span>
                                                        <span className="truncate" title={row.accuracyDropLabel}>
                                                            {row.accuracyDropLabel}
                                                        </span>
                                                        <span className="truncate" title={`${row.confidenceDropLabel}; ${formatLowConfidenceDelta(row.lowConfidenceDelta)}`}>
                                                            {row.confidenceDropLabel}{row.lowConfidenceDelta !== 0 ? `, ${formatLowConfidenceDelta(row.lowConfidenceDelta)}` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {permutationImportanceView && (
                                            <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
                                                <span>{permutationImportanceView.statusLabel}</span>
                                                {permutationImportanceView.toggleLabel && (
                                                    <Button
                                                        onClick={() => setIsPermutationImportanceExpanded(value => !value)}
                                                        className="px-2 py-1 text-xs"
                                                        variant="secondary"
                                                    >
                                                        {permutationImportanceView.toggleLabel}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <Button
                                            onClick={onExportPermutationImportance}
                                            disabled={isAnyProcessRunning || !canExportPermutationImportance}
                                            title={permutationImportanceExportDisabledReason ?? undefined}
                                            className="w-full text-xs"
                                            variant="secondary"
                                        >
                                            Export Feature Impact
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                        {validationGuidance && (
                            <div className="space-y-1 border-t border-[var(--foreground)]/25 pt-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Validation guidance</span>
                                    <span className={validationGuidance.riskLevel === 'stronger' ? 'text-green-300' : validationGuidance.riskLevel === 'limited' ? 'text-yellow-300' : 'text-orange-300'}>
                                        {validationGuidance.headline}
                                    </span>
                                </div>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {validationGuidance.recommendation}
                                </p>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {validationGuidance.confidenceMessage}
                                </p>
                                {validationPlan?.plan && (
                                    <div className="mt-2 space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-[var(--text-primary)]">Validation plan</span>
                                            <span className="text-green-300">
                                                {validationPlan.plan.foldCount} fold{validationPlan.plan.foldCount === 1 ? '' : 's'} ready
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--text-secondary)]">
                                            <span>Data</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {validationPlan.plan.totalSongCount} songs / {validationPlan.plan.labelCount} labels
                                            </span>
                                            <span>Strategy</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {validationPlan.plan.strategy}
                                            </span>
                                            <span>First holdout</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {validationPlan.plan.folds[0]?.validationSongIds.length ?? 0} song{(validationPlan.plan.folds[0]?.validationSongIds.length ?? 0) === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <p className="leading-snug text-[var(--text-secondary)]">
                                            First fold holds out {validationPlan.plan.folds[0]?.validationSongIds.length ?? 0} song{(validationPlan.plan.folds[0]?.validationSongIds.length ?? 0) === 1 ? '' : 's'}.
                                        </p>
                                    </div>
                                )}
                                {validationExecutionPlan?.executionPlan && (
                                    <div className="mt-2 space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-[var(--text-primary)]">Validation execution</span>
                                            <span className="text-green-300">
                                                {validationExecutionPlan.executionPlan.foldCount} train/infer payloads ready
                                            </span>
                                        </div>
                                        <p className="leading-snug text-[var(--text-secondary)]">
                                            First payload trains {validationExecutionPlan.executionPlan.folds[0]?.trainPayload.vectors.length ?? 0} songs and validates {validationExecutionPlan.executionPlan.folds[0]?.inferPayload.songIds.length ?? 0}.
                                        </p>
                                        <Button
                                            onClick={onRunValidation}
                                            disabled={isAnyProcessRunning || !canRunValidation}
                                            title={validationRunDisabledReason ?? undefined}
                                            className="mt-1 w-full text-xs"
                                            variant="secondary"
                                        >
                                            {isValidating ? 'Running validation...' : 'Run Validation'}
                                        </Button>
                                        {validationRunDisabledReason && !isValidating && (
                                            <p className="leading-snug text-yellow-300/90">
                                                {validationRunDisabledReason}
                                            </p>
                                        )}
                                        {validationRunProgress && (
                                            <p className="leading-snug text-[var(--text-secondary)]">
                                                Fold {validationRunProgress.currentFold} of {validationRunProgress.totalFolds}: {validationProgressLabel}
                                            </p>
                                        )}
                                        {validationRunSummary && (
                                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--foreground)]/20 pt-2 text-[var(--text-secondary)]">
                                                <span className="col-span-2 font-semibold text-[var(--text-primary)]">Validation results</span>
                                                <span>Accuracy</span>
                                                <span className="text-right text-[var(--text-primary)]">
                                                    {formatPercent(validationRunSummary.accuracy)}
                                                </span>
                                                <span>Correct</span>
                                                <span className="text-right text-[var(--text-primary)]">
                                                    {validationRunSummary.correctPredictions}/{validationRunSummary.totalPredictions} correct
                                                </span>
                                                <span>Avg confidence</span>
                                                <span className="text-right text-[var(--text-primary)]">
                                                    {formatPercent(validationRunSummary.averageConfidence)}
                                                </span>
                                                <span>Low confidence</span>
                                                <span className="text-right text-[var(--text-primary)]">
                                                    {validationRunSummary.lowConfidenceCount} below {formatPercent(validationRunSummary.lowConfidenceThreshold)}
                                                </span>
                                            </div>
                                        )}
                                        {validationRunFoldResults && validationRunFoldResults.length > 0 && (
                                            <div className="mt-2 space-y-1 border-t border-[var(--foreground)]/20 pt-2 text-[var(--text-secondary)]">
                                                <div className="font-semibold text-[var(--text-primary)]">Fold review</div>
                                                {validationRunFoldResults.map(fold => (
                                                    <div key={fold.foldNumber} className="space-y-1 rounded border border-[var(--foreground)]/15 p-1.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[var(--text-primary)]">Fold {fold.foldNumber}</span>
                                                            {fold.trainMetrics && (
                                                                <span>
                                                                    Train {formatOptionalPercent(fold.trainMetrics.accuracy)} / loss {formatOptionalLoss(fold.trainMetrics.loss)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {Object.entries(fold.expectedLabels).map(([songId, expectedLabel]) => {
                                                            const result = fold.results[songId];
                                                            return (
                                                                <div key={songId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                                                                    <span className="truncate" title={songId}>{songId}</span>
                                                                    <span className={result?.predictedLabel === expectedLabel ? 'text-green-300' : 'text-yellow-300'}>
                                                                        {expectedLabel} -&gt; {result?.predictedLabel ?? 'missing'}
                                                                    </span>
                                                                    <span>{formatOptionalPercent(result?.confidence)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                                <Button
                                                    onClick={onExportValidationSummary}
                                                    disabled={isAnyProcessRunning || !canExportValidationSummary}
                                                    title={validationExportDisabledReason ?? undefined}
                                                    className="mt-2 w-full text-xs"
                                                    variant="secondary"
                                                >
                                                    Export Validation Summary
                                                </Button>
                                            </div>
                                        )}
                                        {validationRunError && (
                                            <p className="mt-2 border-t border-[var(--foreground)]/20 pt-2 leading-snug text-red-300/90">
                                                Validation run failed: {validationRunError}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {validationExecutionPlan?.reason && (
                                    <p className="mt-2 border-t border-[var(--foreground)]/20 pt-2 leading-snug text-yellow-300/90">
                                        Validation execution unavailable: {validationExecutionPlan.reason}
                                    </p>
                                )}
                                {validationPlan?.reason && (
                                    <p className="mt-2 border-t border-[var(--foreground)]/20 pt-2 leading-snug text-yellow-300/90">
                                        Validation plan unavailable: {validationPlan.reason}
                                    </p>
                                )}
                            </div>
                        )}
                        {(Boolean(trainedModelContextSource && trainingSummary) || pendingUploadedDatasetCount > 0 || Boolean(uploadedDatasetReattachmentReview)) && (
                        <div className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs">
                            {trainedModelContextSource && trainingSummary && (
                                    <div
                                        className="space-y-2 rounded border border-[var(--foreground)]/20 p-2"
                                        data-ann-trained-model-context={trainedModelContextSource}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-[var(--text-primary)]">{trainedModelContextTitle}</span>
                                            <span className="text-[var(--text-secondary)]">
                                                {activeModelComparisonRun ? `Run ${activeModelComparisonRun.runNumber}` : 'No comparison row'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--text-secondary)]">
                                            <span>Review</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {activeModelComparisonRun ? reviewStatusLabels[activeModelComparisonRun.reviewStatus] : 'No review context'}
                                            </span>
                                            <span>Input</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {trainingSummary.inputKind} / {trainingSummary.inputDimension} dims
                                            </span>
                                            <span>Training</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {formatPercent(activeModelComparisonRun?.trainingAccuracy ?? trainingSummary.finalAccuracy ?? null)}
                                            </span>
                                            <span>Dataset</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {activeModelComparisonRun?.datasetAccuracy === undefined || activeModelComparisonRun?.datasetAccuracy === null
                                                    ? 'Pending'
                                                    : formatPercent(activeModelComparisonRun.datasetAccuracy)}
                                            </span>
                                            <span>Validation</span>
                                            <span className="text-right text-[var(--text-primary)]">
                                                {activeModelComparisonRun?.validationAccuracy === undefined || activeModelComparisonRun?.validationAccuracy === null
                                                    ? 'Pending'
                                                    : formatPercent(activeModelComparisonRun.validationAccuracy)}
                                            </span>
                                            <span>Features</span>
                                            <span className="truncate text-right text-[var(--text-primary)]" title={trainingSummary.selectedFeatureIds.join(', ')}>
                                                {trainingSummary.selectedFeatureIds.join(', ') || 'none'}
                                            </span>
                                        </div>
                                        {activeModelComparisonRun?.note && (
                                            <p className="leading-snug text-[var(--text-secondary)]">
                                                {activeModelComparisonRun.note}
                                            </p>
                                        )}
                                        {trainedModelContextWarnings.length > 0 && (
                                            <div className="flex flex-wrap gap-1 text-yellow-300/90">
                                                {trainedModelContextWarnings.map(warning => (
                                                    <span key={warning} className="rounded border border-yellow-300/30 px-1 py-0.5">
                                                        {warning}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                            )}
                            {pendingUploadedDatasetCount > 0 && (
                                <div className="border-t border-[var(--foreground)]/20 pt-2">
                                    <div className="mb-2 text-[var(--text-secondary)]">
                                        {pendingUploadedDatasetCount} uploaded song{pendingUploadedDatasetCount === 1 ? '' : 's'} need file reattachment.
                                    </div>
                                    {pendingUploadedDatasetSongs.length > 0 && (
                                        <div className="mb-2 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-semibold text-[var(--text-primary)]">Expected files ({pendingUploadedDatasetSongs.length})</div>
                                                <div className="text-[var(--text-secondary)]">
                                                    Showing {expectedUploadedDatasetSongsPreview.length} of {pendingUploadedDatasetSongs.length}
                                                </div>
                                            </div>
                                            <div className="overflow-hidden rounded border border-[var(--foreground)]/15">
                                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,0.55fr)_minmax(4rem,0.4fr)_minmax(7rem,0.65fr)] gap-2 border-b border-[var(--foreground)]/15 px-2 py-1 font-semibold text-[var(--text-primary)]">
                                                    <span>File</span>
                                                    <span>Labels</span>
                                                    <span>Size</span>
                                                    <span>Modified</span>
                                                </div>
                                                <ul className="divide-y divide-[var(--foreground)]/10 text-[var(--text-secondary)]">
                                                    {expectedUploadedDatasetSongsPreview.map(song => {
                                                        const metadata = describeUploadedTrainingSongExternalId(song.externalId ?? '');
                                                        return (
                                                            <li key={`${song.name}-${song.assignedLabels.join('|')}`} className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,0.55fr)_minmax(4rem,0.4fr)_minmax(7rem,0.65fr)] gap-2 px-2 py-1">
                                                                <span className="truncate" title={song.name}>{song.name}</span>
                                                                <span className="truncate text-[var(--accent-primary)]" title={song.assignedLabels.join(', ') || 'Unassigned'}>
                                                                {song.assignedLabels.length > 0 ? song.assignedLabels.join(', ') : 'Unassigned'}
                                                                </span>
                                                                <span className="truncate" title={metadata.sizeLabel}>{metadata.sizeLabel}</span>
                                                                <span className="truncate" title={metadata.modifiedLabel}>{metadata.modifiedLabel}</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                            {expectedUploadedDatasetHiddenCount > 0 && (
                                                <div className="text-[var(--text-secondary)]">
                                                    {formatHiddenReattachmentCount(expectedUploadedDatasetHiddenCount, 'expected file')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <Button
                                        onClick={onReattachUploadedDataset}
                                        disabled={isAnyProcessRunning || Boolean(uploadedDatasetReattachDisabledReason)}
                                        title={uploadedDatasetReattachDisabledReason ?? 'Select the uploaded audio files referenced by the imported setup.'}
                                        className="w-full text-xs"
                                        variant="secondary"
                                    >
                                        Reattach Uploaded Files
                                    </Button>
                                </div>
                            )}
                            {uploadedDatasetReattachmentReview && (
                                <div className="border-t border-[var(--foreground)]/20 pt-2">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <label
                                            htmlFor="annUploadedDatasetReattachmentFilter"
                                            className="font-semibold text-[var(--text-primary)]"
                                        >
                                            Reattachment review
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                id="annUploadedDatasetReattachmentSearch"
                                                aria-label="Search uploaded-dataset reattachment review"
                                                placeholder="Search files"
                                                value={uploadedDatasetReattachmentSearchQuery}
                                                onChange={event => {
                                                    setUploadedDatasetReattachmentSearchQuery(event.currentTarget.value);
                                                }}
                                                className="min-w-32 rounded border border-[var(--foreground)]/30 bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)]"
                                            />
                                            <select
                                                id="annUploadedDatasetReattachmentFilter"
                                                aria-label="Filter uploaded-dataset reattachment review"
                                                value={uploadedDatasetReattachmentReviewFilter}
                                                onChange={event => {
                                                    setUploadedDatasetReattachmentReviewFilter(event.currentTarget.value as AnnUploadedDatasetReattachmentReviewFilter);
                                                }}
                                                className="min-w-36 rounded border border-[var(--foreground)]/30 bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)]"
                                            >
                                                {uploadedDatasetReattachmentReviewFilterOptions.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {reattachmentReviewConfirmation && (
                                        <div className="mb-2 rounded border border-[var(--foreground)]/15 p-2 text-xs">
                                            <div className={`font-semibold ${reattachmentReviewConfirmation.toneClassName}`}>
                                                {reattachmentReviewConfirmation.label}
                                            </div>
                                            <p className="mt-1 leading-snug text-[var(--text-secondary)]">
                                                {reattachmentReviewConfirmation.message}
                                            </p>
                                            {reattachmentReviewConfirmation.status === 'needs-attention' && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Button
                                                        onClick={onReattachUploadedDataset}
                                                        disabled={isAnyProcessRunning || Boolean(uploadedDatasetReattachDisabledReason)}
                                                        title={uploadedDatasetReattachDisabledReason ?? 'Select the remaining uploaded audio files referenced by the imported setup.'}
                                                        className="text-xs"
                                                        variant="secondary"
                                                    >
                                                        Reattach Remaining Files
                                                    </Button>
                                                    {reattachmentReviewConfirmation.attachedCount > 0 && (
                                                        <Button
                                                            onClick={onContinueWithAttachedUploadedDataset}
                                                            disabled={isAnyProcessRunning}
                                                            title="Clear pending reattachment and continue with only the files already attached."
                                                            className="text-xs"
                                                            variant="secondary"
                                                        >
                                                            Continue With Attached Files
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid gap-2 text-[var(--text-secondary)]">
                                        {reattachmentReviewSections.length === 0 && (
                                            <p>No reattachment review rows match the current filters.</p>
                                        )}
                                        {reattachmentReviewSections.map(section => {
                                            const toggleLabel = section.isExpanded
                                                ? `Show first ${Math.min(REATTACHMENT_REVIEW_PREVIEW_LIMIT, section.totalCount)} ${section.itemLabel}${Math.min(REATTACHMENT_REVIEW_PREVIEW_LIMIT, section.totalCount) === 1 ? '' : 's'}`
                                                : `Show all ${section.totalCount} ${section.itemLabel}${section.totalCount === 1 ? '' : 's'}`;
                                            return (
                                                <div key={section.key} className="rounded border border-[var(--foreground)]/15 p-2">
                                                    <div className={`mb-1 font-semibold ${section.toneClassName}`}>
                                                        {section.label} ({section.totalCount})
                                                    </div>
                                                    <ul className="space-y-1">
                                                        {section.visibleItems.map(item => {
                                                            const metadata = describeUploadedTrainingSongExternalId(item.externalId ?? '');
                                                            return (
                                                                <li key={`${section.key}-${item.name}`} className="grid grid-cols-[minmax(0,1fr)_minmax(4rem,0.4fr)_minmax(7rem,0.65fr)] gap-2">
                                                                    <span className="truncate" title={item.name}>
                                                                        {item.name}
                                                                    </span>
                                                                    <span className="truncate" title={metadata.sizeLabel}>
                                                                        {metadata.sizeLabel}
                                                                    </span>
                                                                    <span className="truncate" title={metadata.modifiedLabel}>
                                                                        {metadata.modifiedLabel}
                                                                    </span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                    {section.hiddenCount > 0 && (
                                                        <div className="mt-1 text-[var(--text-secondary)]">
                                                            {formatHiddenReattachmentCount(section.hiddenCount, section.itemLabel)}
                                                        </div>
                                                    )}
                                                    {section.totalCount > REATTACHMENT_REVIEW_PREVIEW_LIMIT && (
                                                        <Button
                                                            onClick={() => handleReattachmentSectionToggle(section.key)}
                                                            className="mt-2 text-xs"
                                                            variant="secondary"
                                                        >
                                                            {toggleLabel}
                                                        </Button>
                                                    )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                        <div className="space-y-2 border-t border-[var(--foreground)]/25 pt-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--text-primary)]">Model comparison</span>
                                {bestComparableRunLabel && (
                                    <span className="text-green-300">
                                        {bestComparableRunLabel}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1 border-t border-[var(--foreground)]/20 pt-2 first:border-t-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Comparison guide</span>
                                    <span className="text-yellow-300">{modelComparisonNextLabel}</span>
                                </div>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {modelComparisonGuidance.recommendation}
                                </p>
                                <div className="grid grid-cols-3 gap-1 text-[var(--text-secondary)]">
                                    {modelComparisonGuidance.coverage.map(item => (
                                        <span key={item.inputKind} className="rounded border border-[var(--foreground)]/15 px-1 py-0.5 text-center">
                                            {item.inputKind} {item.status}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {modelComparisonRuns.length > 0 && (
                                <div className="space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-[var(--text-primary)]">Live model comparison</span>
                                    </div>
                                    <p className="leading-snug text-[var(--text-secondary)]">
                                        {modelComparisonBenchmark.summary}
                                    </p>
                                    <div className="overflow-hidden rounded border border-[var(--foreground)]/15">
                                        <div className="grid grid-cols-[minmax(0,0.55fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] gap-2 border-b border-[var(--foreground)]/15 px-2 py-1 font-semibold text-[var(--text-primary)]">
                                            <span>Input</span>
                                            <span>Best run</span>
                                            <span>Score</span>
                                            <span>Vs live</span>
                                        </div>
                                        <div className="divide-y divide-[var(--foreground)]/10 text-[var(--text-secondary)]">
                                            {modelComparisonBenchmark.rows.map(row => (
                                                <div
                                                    key={row.inputKind}
                                                    className="grid grid-cols-[minmax(0,0.55fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] gap-2 px-2 py-1"
                                                    data-ann-model-comparison-benchmark-row={row.inputKind}
                                                >
                                                    <span className="truncate" title={`${row.inputKind} ${row.status}`}>
                                                        {row.inputKind}
                                                    </span>
                                                    <span className="truncate text-[var(--text-primary)]">
                                                        {row.bestRun ? `Run ${row.bestRun.runNumber}` : 'No run'}
                                                    </span>
                                                    <span className="truncate" title={row.scoreLabel}>
                                                        {row.scoreLabel}
                                                    </span>
                                                    <span className={row.isLiveModel ? 'truncate text-green-300' : 'truncate'}>
                                                        {row.deltaLabel}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--text-primary)]">Guided setup</span>
                                    <Button
                                        onClick={onApplyModelComparisonSetup}
                                        disabled={isAnyProcessRunning || !modelComparisonSetupSuggestion.canApplySetup}
                                        title={modelComparisonSetupSuggestion.canApplySetup ? modelComparisonSetupSuggestion.summary : modelComparisonSetupSuggestion.nextStep}
                                        className="text-xs"
                                        variant="secondary"
                                    >
                                        {modelComparisonSetupSuggestion.actionLabel}
                                    </Button>
                                </div>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {modelComparisonSetupSuggestion.summary}
                                </p>
                                <p className="leading-snug text-[var(--text-secondary)]">
                                    {modelComparisonSetupSuggestion.nextStep}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    onClick={onExportModelComparisonHistory}
                                    disabled={isAnyProcessRunning || modelComparisonRuns.length === 0}
                                    title={modelComparisonRuns.length === 0 ? 'Train at least one run before exporting comparison history.' : undefined}
                                    className="text-xs"
                                    variant="secondary"
                                >
                                    Export Comparison History
                                </Button>
                                <Button
                                    onClick={onImportModelComparisonHistory}
                                    disabled={isAnyProcessRunning || Boolean(modelComparisonImportDisabledReason)}
                                    title={modelComparisonImportDisabledReason ?? 'Import saved comparison history JSON.'}
                                    className="text-xs"
                                    variant="secondary"
                                >
                                    Import Comparison History
                                </Button>
                            </div>
                            {modelComparisonRuns.length > 0 && (
                                <div className="space-y-2">
                                    <div className="space-y-1 border-t border-[var(--foreground)]/20 pt-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-[var(--text-primary)]">Comparison view</span>
                                            <span className="text-[var(--text-secondary)]">
                                                Showing {modelComparisonView.visibleCount} of {modelComparisonView.totalCount} runs
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                            <select
                                                aria-label="Sort model comparison runs"
                                                value={modelComparisonSortMode}
                                                onChange={(event) => setModelComparisonSortMode(event.target.value as AnnModelComparisonSortMode)}
                                                disabled={isAnyProcessRunning}
                                                className="rounded border border-[var(--foreground)]/30 bg-transparent px-1 py-1 text-[var(--text-primary)]"
                                            >
                                                <option value="best-quality">Rank by quality</option>
                                                <option value="newest">Newest first</option>
                                                <option value="oldest">Oldest first</option>
                                            </select>
                                            <select
                                                aria-label="Filter model comparison runs by review marker"
                                                value={modelComparisonReviewFilter}
                                                onChange={(event) => setModelComparisonReviewFilter(event.target.value as AnnModelComparisonReviewFilter)}
                                                disabled={isAnyProcessRunning}
                                                className="rounded border border-[var(--foreground)]/30 bg-transparent px-1 py-1 text-[var(--text-primary)]"
                                            >
                                                <option value="all">All review markers</option>
                                                {annModelComparisonReviewStatuses.map(status => (
                                                    <option key={status} value={status}>
                                                        {reviewStatusLabels[status]}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {modelComparisonView.hiddenCount > 0 && (
                                            <p className="leading-snug text-[var(--text-secondary)]">
                                                {modelComparisonView.hiddenCount} run{modelComparisonView.hiddenCount === 1 ? '' : 's'} hidden by review filter.
                                            </p>
                                        )}
                                    </div>
                                    {modelComparisonView.rankedRuns.map(({ run, rank, scoreLabel }) => (
                                        <div
                                            key={run.id}
                                            className="space-y-1 border-t border-[var(--foreground)]/20 pt-1 first:border-t-0 first:pt-0"
                                            data-ann-model-comparison-run={run.id}
                                        >
                                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                                                <span className="text-[var(--text-primary)]">#{rank} Run {run.runNumber}</span>
                                                <span className="truncate text-right text-[var(--text-secondary)]" title={run.selectedFeatureIds.join(', ')}>
                                                    {scoreLabel} / {run.inputKind} / {run.inputDimension} dims
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingModelComparisonDeleteId(run.id)}
                                                    disabled={isAnyProcessRunning}
                                                    title={`Delete Run ${run.runNumber} from comparison history`}
                                                    aria-label={`Delete Run ${run.runNumber} from comparison history`}
                                                    className="border-0 bg-transparent p-0.5 text-red-500 hover:bg-transparent hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                    data-ann-delete-model-comparison-run={run.id}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                            {run.modelEpoch !== undefined && run.modelEpoch !== null && (
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-cyan-200/90" data-ann-model-checkpoint={run.checkpointKind ?? 'completed'}>
                                                    <span>{run.checkpointKind === 'intermediate' ? 'Inference checkpoint' : 'Completed model'}</span>
                                                    <span>Epoch {run.modelEpoch}</span>
                                                    <span>{formatExecutionMode(run.executionMode)}</span>
                                                    {run.trainingPhase && <span>{run.trainingPhase.replace('-', ' ')}</span>}
                                                </div>
                                            )}
                                            {pendingModelComparisonDeleteId === run.id && (
                                                <div
                                                    role="alertdialog"
                                                    aria-label={`Confirm deletion of comparison Run ${run.runNumber}`}
                                                    className="flex flex-wrap items-center justify-between gap-2 border-t border-red-500/30 py-2"
                                                >
                                                    <p className="min-w-0 flex-1 leading-snug text-red-300">
                                                        Delete Run {run.runNumber}? This removes it from saved comparison history.
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() => setPendingModelComparisonDeleteId(null)}
                                                            className="text-xs"
                                                            variant="secondary"
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={() => {
                                                                onDeleteModelComparisonRun(run.id);
                                                                setPendingModelComparisonDeleteId(null);
                                                            }}
                                                            className="text-xs"
                                                            variant="tertiary"
                                                        >
                                                            Delete Run
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-1 text-[var(--text-secondary)]">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[var(--text-primary)]">{reviewStatusLabels[run.reviewStatus]}</span>
                                                    <span>{run.note.length}/{ANN_MODEL_COMPARISON_NOTE_MAX_LENGTH}</span>
                                                </div>
                                                {run.note && (
                                                    <p className="leading-snug text-[var(--text-secondary)]">
                                                        {run.note}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)] gap-1">
                                                    <select
                                                        aria-label={`Review status for run ${run.runNumber}`}
                                                        value={run.reviewStatus}
                                                        onChange={(event) => onUpdateModelComparisonReview(
                                                            run.id,
                                                            event.target.value as AnnModelComparisonReviewStatus,
                                                            run.note
                                                        )}
                                                        disabled={isAnyProcessRunning}
                                                        className="rounded border border-[var(--foreground)]/30 bg-transparent px-1 py-1 text-[var(--text-primary)]"
                                                    >
                                                        {annModelComparisonReviewStatuses.map(status => (
                                                            <option key={status} value={status}>
                                                                {reviewStatusLabels[status]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <textarea
                                                        aria-label={`Comparison note for run ${run.runNumber}`}
                                                        value={run.note}
                                                        maxLength={ANN_MODEL_COMPARISON_NOTE_MAX_LENGTH}
                                                        rows={2}
                                                        placeholder="Add comparison note"
                                                        onChange={(event) => onUpdateModelComparisonReview(
                                                            run.id,
                                                            run.reviewStatus,
                                                            event.target.value
                                                        )}
                                                        disabled={isAnyProcessRunning}
                                                        className="min-h-12 resize-y rounded border border-[var(--foreground)]/30 bg-transparent px-1 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[var(--text-secondary)]">
                                                <span>Test {formatPercent(run.trainingAccuracy)}</span>
                                                <span className="text-right">
                                                    {run.datasetAccuracy === null ? 'Dataset pending' : `Dataset ${formatPercent(run.datasetAccuracy)}`}
                                                </span>
                                                <span>
                                                    {run.validationAccuracy === null ? 'Validation pending' : `Validation ${formatPercent(run.validationAccuracy)}`}
                                                </span>
                                                <span className="text-right">
                                                    {run.validationCorrectPredictions === null || run.validationTotalPredictions === null
                                                        ? 'No validation'
                                                        : `${run.validationCorrectPredictions}/${run.validationTotalPredictions} val`}
                                                </span>
                                                <span>
                                                    {run.validationFoldCount === null
                                                        ? 'No folds'
                                                        : `${run.validationFoldCount} fold${run.validationFoldCount === 1 ? '' : 's'}`}
                                                </span>
                                                <span className="text-right">
                                                    {run.validationLowConfidenceCount === null
                                                        ? 'No confidence flags'
                                                        : `${run.validationLowConfidenceCount} low conf`}
                                                </span>
                                                <span>
                                                    {run.datasetCorrectPredictions === null || run.datasetTotalSongs === null
                                                        ? 'Not evaluated'
                                                        : `${run.datasetCorrectPredictions}/${run.datasetTotalSongs}`}
                                                </span>
                                                <span className="text-right">
                                                    {formatPointDelta(run.majorityBaselineDelta)}
                                                </span>
                                            </div>
                                            {run.warningCodes.length > 0 && (
                                                <div className="text-yellow-300/90">
                                                    {run.warningCodes.length} warnings
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="pt-2 border-t border-[var(--foreground)]/30">
                            <label htmlFor="annInferenceFile" className="block text-xs mb-1 text-[var(--text-secondary)]">
                                Uploaded Audio Inference
                            </label>
                            <input
                                id="annInferenceFile"
                                type="file"
                                accept="audio/*"
                                onChange={(event) => onInferenceFileChange(event.target.files?.[0] ?? null)}
                                disabled={isAnyProcessRunning || !canChooseInferenceFile}
                                title={inferenceFileDisabledReason ?? undefined}
                                className="block w-full text-xs text-[var(--text-secondary)] file:mr-2 file:border file:border-[var(--foreground)]/50 file:bg-transparent file:px-2 file:py-1 file:text-[var(--text-primary)] file:cursor-pointer"
                            />
                            {inferenceFileDisabledReason && (
                                <p className="mt-1 text-xs leading-snug text-yellow-300/90">
                                    {inferenceFileDisabledReason}
                                </p>
                            )}
                            {inferenceFile && (
                                <p className="mt-1 text-xs text-[var(--text-secondary)] truncate" title={inferenceFile.name}>
                                    File: {inferenceFile.name}
                                </p>
                            )}
                            {inferenceError && (
                                <p className="mt-1 text-xs text-red-300">{inferenceError}</p>
                            )}
                            {uploadedInferenceResult && (
                                <p className="mt-1 text-xs text-green-300">
                                    Uploaded prediction: {uploadedInferenceResult.predictedLabel}
                                    {uploadedInferenceResult.confidence !== undefined ? ` (${(uploadedInferenceResult.confidence * 100).toFixed(1)}%)` : ''}
                                </p>
                            )}
                            <Button
                                onClick={onInferUploadedAudio}
                                disabled={isInferenceActionBlocked || !canInferUploadedAudio}
                                title={uploadedInferDisabledReason ?? undefined}
                                className="mt-2 w-full py-1.5 text-sm font-semibold"
                                variant="secondary"
                                enableTilt={true}
                            >
                                Infer Uploaded Audio
                            </Button>
                            {uploadedInferDisabledReason && (
                                <p className="mt-1 text-xs leading-snug text-yellow-300/90">
                                    {uploadedInferDisabledReason}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </BasePanel>
    );
};

export default ANNControlsPanel;
