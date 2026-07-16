'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import {
    ChartBarIcon,
    CommandLineIcon,
    CpuChipIcon,
    PresentationChartLineIcon,
    TagIcon,
} from '@heroicons/react/24/outline';

// Import components using alias paths (assuming @/ maps to src/)
import LogPanel from '@/components/LogPanel';
import AboutDialog from '@/components/AboutDialog';
import ExportRawFeaturesDialog from '@/components/ExportRawFeaturesDialog';
import ANNControlsPanel, {
    MLPConfig as ControlsMLPConfig,
    DEFAULT_MLP_CONFIG,
    type UploadedDatasetReattachmentReviewSummary,
} from '@/components/ANNControlsPanel';
import LabelingPanel from '@/components/LabelingPanel';
import NetworkVisualizationPanel from '@/components/NetworkVisualizationPanel';
import ANNTrainingPerformancePanel, { type ANNTrainingHistory } from '@/components/ANNTrainingPerformancePanel';
import ANNDataVisualizationPanel from '@/components/ANNDataVisualizationPanel';
import AudioPlayer from '@/components/AudioPlayer'; // <-- NEW: Import AudioPlayer
import ModeSwitchLink from '@/components/ModeSwitchLink';
import AppFooter from '@/components/AppFooter';
import SongDetailsDialog from '@/components/SongDetailsDialog';
import { downloadRawFeatureMatrixExport, type ExportFormat } from '@/lib/exportRawFeatureMatrix';
import {
    getEssentiaFeatureExtractionError,
    getEssentiaFeatureExtractionResult,
} from '@/lib/essentiaWorkerMessages';
import {
    ingestUploadedTrainingSongs,
    reattachUploadedDatasetManifestFiles,
    removeUploadedTrainingSong,
    type UploadedDatasetManifest,
    type TrainingSongUploadSkipReason,
} from '@/lib/annUploadedSongs';
import {
    getAnnDefaultFeatureCachePlan,
    type AnnDefaultFeatureCache,
} from '@/lib/annDefaultFeatureCache';
import { loadAnnDefaultFeatureCache } from '@/lib/annDefaultFeatureCacheLoader';
import { getAnnEvaluationSummary } from '@/lib/annEvaluation';
import {
    getAnnCurrentFeatureRows,
    getAnnFeatureExtractionCompletion,
} from '@/lib/annFeatureExtractionStatus';
import {
    getAnnFeatureSignalDimensionLabels,
    getAnnFeatureSignalRowsForSongAssignments,
    getAnnFeatureSignalSummary,
    type AnnFeatureSignalSummary,
} from '@/lib/annFeatureSignal';
import {
    createAnnPermutationImportancePlan,
    getAnnPermutationImportanceSummary,
    type AnnPermutationImportanceSummary,
    type AnnPermutationInferenceResultsByDimension,
} from '@/lib/annPermutationImportance';
import {
    createAnnPermutationImportanceExportFilename,
    createAnnPermutationImportanceExportPayload,
    downloadAnnPermutationImportanceExport,
} from '@/lib/annPermutationImportanceExport';
import { getAnnDatasetInferReadiness, getAnnUploadedInferReadiness } from '@/lib/annInferenceReadiness';
import { getAnnLabelDistribution } from '@/lib/annLabelDistribution';
import {
    createAnnModelComparisonRun,
    removeAnnModelComparisonRun,
    updateAnnModelComparisonRunReview,
    updateAnnModelComparisonRunValidation,
    updateAnnModelComparisonRunEvaluation,
    type AnnModelComparisonReviewStatus,
    type AnnModelComparisonRun,
} from '@/lib/annModelComparison';
import {
    createAnnModelComparisonExportFilename,
    createAnnModelComparisonExportPayload,
    downloadAnnModelComparisonExport,
    parseAnnModelComparisonImportPayload,
} from '@/lib/annModelComparisonExport';
import {
    loadAnnModelComparisonFromStorage,
    saveAnnModelComparisonToStorage,
} from '@/lib/annModelComparisonStorage';
import { getAnnModelComparisonSetupSuggestion } from '@/lib/annModelComparisonSetup';
import {
    formatAnnMlpInferenceResults,
    getAnnMlpRouteMessageDisposition,
    getAnnWorkerErrorMessage,
    type AnnMlpRouteMessage,
} from '@/lib/annMlpRouteMessages';
import { getAnnRouteLabelState } from '@/lib/annRouteState';
import {
    createAnnTrainingDataset,
    selectAnnDatasetInferenceInput,
    selectAnnTrainingInput,
} from '@/lib/annModelInputs';
import { getAnnProcessStatus } from '@/lib/annProcessStatus';
import {
    loadAnnSetupFromStorage,
    saveAnnSetupToStorage,
} from '@/lib/annSetupStorage';
import {
    createAnnSetupExportFilename,
    createAnnSetupExportPayload,
    downloadAnnSetupExport,
    parseAnnSetupImportPayload,
} from '@/lib/annSetupExport';
import {
    createAnnTrainedModelExportFilename,
    createAnnTrainedModelExportPayload,
    downloadAnnTrainedModelExport,
    parseAnnTrainedModelImportPayload,
    type AnnTrainedModelInputData,
} from '@/lib/annTrainedModelExport';
import { getAnnTrainReadiness } from '@/lib/annTrainingReadiness';
import {
    getAnnTrainingSummary,
    type AnnTrainingSummary,
} from '@/lib/annTrainingSummary';
import { createAnnTrainingPipelineSnapshot } from '@/lib/annTrainingPipelineSnapshot';
import {
    loadPendingUploadedDatasetManifestFromStorage,
    savePendingUploadedDatasetManifestToStorage,
} from '@/lib/annUploadedDatasetReattachmentStorage';
import { getAnnValidationGuidance } from '@/lib/annValidationGuidance';
import {
    createAnnValidationExportFilename,
    createAnnValidationExportPayload,
    downloadAnnValidationExport,
} from '@/lib/annValidationExport';
import {
    createAnnValidationExecutionPlan,
    runAnnValidationExecutionPlan,
    type AnnValidationFoldRunResult,
    type AnnValidationExecutionSummary,
} from '@/lib/annValidationExecution';
import { createAnnValidationPlan } from '@/lib/annValidationPlan';
import {
    type ActivationSnapshot,
    type AnnModelStateSnapshot,
    type AnnTrainingExecutionMode,
    type AnnTrainingPhaseSnapshot,
    type AnnTrainingSessionStatus,
    type FeatureMatrix,
    type FeatureMatrixStructure,
    type InferenceResult as SharedInferenceResult,
    type ProcessingStats,
    type TrainingInputKind,
    type TrainingPipelineSnapshot,
    prepareFeatureMatrix,
} from '@/lib/annPipeline';
import {
    prepareAnnUploadedInferenceRawMatrix,
    selectAnnUploadedInferenceInput,
} from '@/lib/annUploadedInference';
import {
    sendWorkerRequest,
    type WorkerRequestTarget,
} from '@/lib/workerRequestClient';
import {
    clearActiveWorkerRequestId,
    createWorkerRequestId,
    isRequestScopedWorkerReply,
} from '@/lib/workerRequestIds';
import { annWorkerAssets } from '@/lib/annWorkerAssets';

// Reusable types (consider moving to a shared types file, e.g., src/types.ts)
export interface Song {
    id: string;
    name: string;
    url: string;
    source: 'default' | 'user';
    externalId?: string;
}

export interface Features {
    mfccMeans?: number[];
    mfccStdDevs?: number[];
    energy?: number;
    entropy?: number;
    key?: string;
    keyScale?: string;
    keyStrength?: number;
    dynamicComplexity?: number;
    loudness?: number;
    rms?: number;
    tuningFrequency?: number;
    bpm?: number;
    bpmSlow?: number;
    rhythmConfidence?: number;
    onsetRate?: number;
    danceability?: number;
    intensity?: number;
    spectralCentroidTimeMean?: number;
    spectralCentroidTimeStdDev?: number;
    spectralComplexityMean?: number;
    spectralComplexityStdDev?: number;
    spectralContrastMeans?: number[];
    spectralContrastStdDevs?: number[];
    inharmonicityMean?: number;
    inharmonicityStdDev?: number;
    dissonanceMean?: number;
    dissonanceStdDev?: number;
    melBandsMeans?: number[];
    melBandsStdDevs?: number[];
    pitchSalienceMean?: number;
    pitchSalienceStdDev?: number;
    spectralFluxMean?: number;
    spectralFluxStdDev?: number;
    [key: string]: any;
}

// Use the MLPConfig type imported from the Controls Panel component
type MLPConfig = ControlsMLPConfig; // Alias the imported type

// Define worker payload types locally (or import from shared types)
// NOTE: The structure sent to the worker might differ from the Controls Panel state
interface WorkerMLPConfig { // Define a separate type for the worker message
    layers: number;         // Number of hidden layers
    nodes: number[];        // Nodes per hidden layer
    activation: 'relu' | 'sigmoid' | 'tanh';
    optimizer: 'adam' | 'sgd' | 'rmsprop';
    learningRate: number;
}
interface TrainPayload {
    vectors: number[][];
    labels: string[];
    config: WorkerMLPConfig; // Config structure expected by worker
    labelMap: Record<string, number>;
    trainIterations: number; // Epochs
    batchSize: number;
    splitRatio: number;
    seed: number;
    activationSampleSongId?: string;
    executionMode?: AnnTrainingExecutionMode;
    managedExecution?: boolean;
}

interface TrainingRunContext {
    inputKind: TrainingInputKind;
    selectedFeatureIds: string[];
    inputDimension: number;
    trainingLabels: string[];
    trainingVectors: number[][];
    dataSource: { songIds: string[]; vectors: number[][] };
    pipelineSnapshot: TrainingPipelineSnapshot;
    networkConfig: MLPConfig;
    seed: number;
}

interface TrainingWorkerResult {
    finalMetrics?: { loss?: number; accuracy?: number };
    activationSnapshot?: ActivationSnapshot;
    modelStateSnapshot?: AnnModelStateSnapshot;
    phaseSnapshot?: AnnTrainingPhaseSnapshot;
    status?: AnnTrainingSessionStatus;
}

interface InferPayload {
    vectors: number[][];
    songIds: string[];
    labelMap: Record<string, number>;
}

type AnnWorkerReply = AnnMlpRouteMessage;

export type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';
type LogLevel = 'info' | 'warn' | 'error' | 'complete';
interface LogMessage {
    text: string;
    level: LogLevel;
    timestamp: string;
}
type ProcessingMethod = 'none' | 'standardize' | 'normalize';
type ReductionMethod = 'pca' | 'tsne' | 'umap';
// Define possible stages for visualization control
type ProcessingStage = 'features' | 'processed' | 'reduced' | 'kmeans' | null;
type AnnWorkspacePage = 'data' | 'model' | 'performance' | 'visualization' | 'logs';

// Data structure types
type UnprocessedDataType = { vectors: number[][], songIds: string[], isOHEColumn: boolean[], columnLabels: string[] };
type ProcessedDataType = { vectors: number[][], songIds: string[] };
// Placeholder for K-Means assignments (not used in ANN page)
const placeholderKmeansAssignments: Record<string, number> = {};
const ANN_WORKSPACE_TABS = [
    { id: 'data', label: 'Data Labeling', icon: TagIcon },
    { id: 'model', label: 'Model Inspection', icon: CpuChipIcon },
    { id: 'performance', label: 'Performance', icon: ChartBarIcon },
    { id: 'visualization', label: 'Data Visualization', icon: PresentationChartLineIcon },
    { id: 'logs', label: 'Program Logs', icon: CommandLineIcon },
] as const;

// --- Define needed types locally (mirroring those in VisualizationPanel) ---
interface InferenceResult {
  predictedLabel: string;
  confidence?: number;
}

// --- End local type definitions ---

// Define default features explicitly here
const DEFAULT_SELECTED_FEATURES = ['mfcc', 'energy'];
const INFERENCE_SONG_ID = '__ann_uploaded_inference__';
const ANN_PERMUTATION_IMPORTANCE_CANCELLED_MESSAGE = 'Feature impact analysis cancelled.';

function getTrainingModeLabel(mode: AnnTrainingExecutionMode): string {
    if (mode === 'step') return 'Internal Steps';
    if (mode === 'epoch') return 'By Epoch';
    return 'Automatic';
}

function formatTrainingPhaseLog(snapshot: AnnTrainingPhaseSnapshot): string {
    const details = [
        `[ANN Train][Internal Steps] Epoch ${snapshot.epoch}/${snapshot.targetEpochs}, batch ${snapshot.batchIndex}/${snapshot.batchCount} | ${snapshot.label}`,
    ];
    if (snapshot.predictedLabel) {
        details.push(`prediction ${snapshot.predictedLabel} (${((snapshot.predictionConfidence ?? 0) * 100).toFixed(1)}%)`);
    }
    if (snapshot.loss !== undefined) details.push(`sample loss ${snapshot.loss.toFixed(4)}`);
    if (snapshot.meanAbsoluteWeightDelta !== undefined) details.push(`mean |weight delta| ${snapshot.meanAbsoluteWeightDelta.toExponential(2)}`);
    return details.join(' | ');
}

function getTrainingUploadSkipMessage(name: string, reason: TrainingSongUploadSkipReason): string {
    switch (reason) {
        case 'duplicate-name':
            return `Skipped "${name}" because a song with that name already exists.`;
        case 'not-audio':
            return `Skipped "${name}" because it is not an audio file.`;
        case 'url-error':
            return `Skipped "${name}" because the browser could not prepare it for playback.`;
        default:
            return reason satisfies never;
    }
}

function createPendingUploadedDatasetManifest(songs: UploadedDatasetManifest['songs']): UploadedDatasetManifest | null {
    if (songs.length === 0) return null;

    return {
        version: 1,
        userSongCount: songs.length,
        assignedUserSongCount: songs.filter(song => song.assignedLabels.length > 0).length,
        songs,
    };
}

// Default songs (Consider moving to a shared constants file)
const defaultSongs: Song[] = [
    // Full list...
    { id: '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3', name: 'Tchaikovsky - Nutcracker March_Piano Solo (Excerpt)', url: '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3', source: 'default' },
    { id: '/audio/Excerpt_Yes - Roundabout.mp3', name: 'Yes - Roundabout (Excerpt)', url: '/audio/Excerpt_Yes - Roundabout.mp3', source: 'default' },
    { id: '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3', name: 'Grover Washington, Jr.-Bill Withers - Just the Two of Us (Excerpt)', url: '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3', source: 'default' },
    { id: '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3', name: 'Eric Clapton - Autumn Leaves (Excerpt)', url: '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3', source: 'default' },
    { id: '/audio/Excerpt_Frank Sinatra - Fly Me To The Moon.mp3', name: 'Frank Sinatra - Fly Me To The Moon (Excerpt)', url: '/audio/Excerpt_Frank Sinatra - Fly Me To The Moon.mp3', source: 'default' },
    { id: '/audio/Excerpt_Genesis - Firth of Fifth.mp3', name: 'Genesis - Firth of Fifth (Excerpt)', url: '/audio/Excerpt_Genesis - Firth of Fifth.mp3', source: 'default' },
    { id: '/audio/Excerpt_Mariya Takeuchi - Plastic Love.mp3', name: 'Mariya Takeuchi - Plastic Love (Excerpt)', url: '/audio/Excerpt_Mariya Takeuchi - Plastic Love.mp3', source: 'default' },
    { id: '/audio/Excerpt_Michael Jackson - Billie Jean.mp3', name: 'Michael Jackson - Billie Jean (Excerpt)', url: '/audio/Excerpt_Michael Jackson - Billie Jean.mp3', source: 'default' },
    { id: '/audio/Excerpt_Queen - Bohemian Rhapsody.mp3', name: 'Queen - Bohemian Rhapsody (Excerpt)', url: '/audio/Excerpt_Queen - Bohemian Rhapsody.mp3', source: 'default' },
    { id: '/audio/Excerpt_Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio.mp3', name: 'Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio (Excerpt)', url: '/audio/Excerpt_Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio.mp3', source: 'default' },
    { id: '/audio/Excerpt_The Beatles - Abbey Road_Come Together.mp3', name: 'The Beatles - Abbey Road_Come Together (Excerpt)', url: '/audio/Excerpt_The Beatles - Abbey Road_Come Together.mp3', source: 'default' },
    { id: '/audio/Excerpt_Yasuha - Flyday Chinatown.mp3', name: 'Yasuha - Flyday Chinatown (Excerpt)', url: '/audio/Excerpt_Yasuha - Flyday Chinatown.mp3', source: 'default' },
    { id: '/audio/Excerpt_B.B. King - The Thrill Is Gone.mp3', name: 'B.B. King - The Thrill Is Gone (Excerpt)', url: '/audio/Excerpt_B.B. King - The Thrill Is Gone.mp3', source: 'default' },
    { id: '/audio/Excerpt_Dvorak - Symphony No. 9 (From the New World)_Movement 4.mp3', name: 'Dvorak - Symphony No. 9 (From the New World)_Movement 4 (Excerpt)', url: '/audio/Excerpt_Dvorak - Symphony No. 9 (From the New World)_Movement 4.mp3', source: 'default' },
    { id: '/audio/Excerpt_King Crimson - The Court of the Crimson King.mp3', name: 'King Crimson - The Court of the Crimson King (Excerpt)', url: '/audio/Excerpt_King Crimson - The Court of the Crimson King.mp3', source: 'default' },
    { id: '/audio/Excerpt_Richard Wagner - Ride of the Valkyries.mp3', name: 'Richard Wagner - Ride of the Valkyries (Excerpt)', url: '/audio/Excerpt_Richard Wagner - Ride of the Valkyries.mp3', source: 'default' },
    { id: '/audio/Excerpt_Chopin - Nocturne op.9 No.2.mp3', name: 'Chopin - Nocturne op.9 No.2 (Excerpt)', url: '/audio/Excerpt_Chopin - Nocturne op.9 No.2.mp3', source: 'default' },
    { id: '/audio/Excerpt_Debussy - Clair De Lune.mp3', name: 'Debussy - Clair De Lune (Excerpt)', url: '/audio/Excerpt_Debussy - Clair De Lune.mp3', source: 'default' },
    { id: '/audio/Excerpt_Michael Jaskson - Beat It.mp3', name: 'Michael Jaskson - Beat It (Excerpt)', url: '/audio/Excerpt_Michael Jaskson - Beat It.mp3', source: 'default' },
    { id: '/audio/Excerpt_Miki Matsubara - Stay With Me.mp3', name: 'Miki Matsubara - Stay With Me (Excerpt)', url: '/audio/Excerpt_Miki Matsubara - Stay With Me.mp3', source: 'default' },
    { id: '/audio/Excerpt_Schubert - Piano Sonata_D845.mp3', name: 'Schubert - Piano Sonata_D845 (Excerpt)', url: '/audio/Excerpt_Schubert - Piano Sonata_D845.mp3', source: 'default' },
    { id: '/audio/Excerpt_Schubert-Liszt - Erlkoenig.mp3', name: 'Schubert-Liszt - Erlkoenig (Excerpt)', url: '/audio/Excerpt_Schubert-Liszt - Erlkoenig.mp3', source: 'default' },
    { id: '/audio/Excerpt_Stan Getz - The Girl From Ipanema.mp3', name: 'Stan Getz - The Girl From Ipanema (Excerpt)', url: '/audio/Excerpt_Stan Getz - The Girl From Ipanema.mp3', source: 'default' },
    { id: '/audio/Excerpt_Tatsuro Yamashita - Christmas Eve.mp3', name: 'Tatsuro Yamashita - Christmas Eve (Excerpt)', url: '/audio/Excerpt_Tatsuro Yamashita - Christmas Eve.mp3', source: 'default' },
    { id: '/audio/Excerpt_Oscar Peterson - Tea For Two.mp3', name: 'Oscar Peterson - Tea For Two (Excerpt)', url: '/audio/Excerpt_Oscar Peterson - Tea For Two.mp3', source: 'default' },
];
const DEFAULT_SONG_IDS = new Set(defaultSongs.map(song => song.id));

export default function ANNPage() {
    // --- State from Dashboard ---
    const [songs, setSongs] = useState<Song[]>(defaultSongs);
    const [songFeatures, setSongFeatures] = useState<Record<string, Features | null>>({});
    const [featureStatus, setFeatureStatus] = useState<Record<string, FeatureStatus>>({});
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [defaultFeatureCache, setDefaultFeatureCache] = useState<AnnDefaultFeatureCache | null>(null);
    const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
    const [isAboutDialogOpen, setIsAboutDialogOpen] = useState<boolean>(false);
    const [isExportRawModalOpen, setIsExportRawModalOpen] = useState<boolean>(false);
    // Worker Ready Flags
    const [essentiaWorkerReady, setEssentiaWorkerReady] = useState<boolean>(false);
    const [dataProcessingWorkerReady, setDataProcessingWorkerReady] = useState<boolean>(false);
    const [druidWorkerReady, setDruidWorkerReady] = useState<boolean>(false);
    const [mlpWorkerReady, setMlpWorkerReady] = useState<boolean>(false);

    // --- Data Pipeline State ---
    const [unprocessedData, setUnprocessedData] = useState<UnprocessedDataType | null>(null);
    const [processedData, setProcessedData] = useState<ProcessedDataType | null>(null);
    const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
    const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
    const [reducedDataPoints, setReducedDataPoints] = useState<Record<string, number[]>>({});
    const [isReducing, setIsReducing] = useState<boolean>(false);
    const [reductionDimensions, setReductionDimensions] = useState<number>(0);

    // --- ANN Specific State ---
    const [namedLists, setNamedLists] = useState<Record<string, Set<string>>>({});
    const [isTraining, setIsTraining] = useState<boolean>(false);
    const [isInferring, setIsInferring] = useState<boolean>(false);
    // State for tfjs-vis chart
    const [trainingHistory, setTrainingHistory] = useState<ANNTrainingHistory>({ loss: [], acc: [], valLoss: [], valAcc: [] });
    const [currentEpoch, setCurrentEpoch] = useState<number>(0);
    const [networkConfig, setNetworkConfig] = useState<MLPConfig | null>(DEFAULT_MLP_CONFIG);
    const [inferenceResults, setInferenceResults] = useState<Record<string, InferenceResult>>({});
    const [uploadedInferenceFile, setUploadedInferenceFile] = useState<File | null>(null);
    const [uploadedInferenceResult, setUploadedInferenceResult] = useState<SharedInferenceResult | null>(null);
    const [uploadedInferenceError, setUploadedInferenceError] = useState<string | null>(null);
    const [trainingPipelineSnapshot, setTrainingPipelineSnapshot] = useState<TrainingPipelineSnapshot | null>(null);
    const [trainedModelInputData, setTrainedModelInputData] = useState<AnnTrainedModelInputData | null>(null);
    const [trainingSummary, setTrainingSummary] = useState<AnnTrainingSummary | null>(null);
    const [featureSignalSummary, setFeatureSignalSummary] = useState<AnnFeatureSignalSummary | null>(null);
    const [isAnalyzingPermutationImportance, setIsAnalyzingPermutationImportance] = useState<boolean>(false);
    const [permutationImportanceSummary, setPermutationImportanceSummary] = useState<AnnPermutationImportanceSummary | null>(null);
    const [permutationImportanceError, setPermutationImportanceError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState<boolean>(false);
    const [validationRunProgress, setValidationRunProgress] = useState<{ currentFold: number; totalFolds: number; stage: 'train' | 'infer' } | null>(null);
    const [validationRunSummary, setValidationRunSummary] = useState<AnnValidationExecutionSummary | null>(null);
    const [validationRunFoldResults, setValidationRunFoldResults] = useState<AnnValidationFoldRunResult[] | null>(null);
    const [validationRunError, setValidationRunError] = useState<string | null>(null);
    const [modelComparisonRuns, setModelComparisonRuns] = useState<AnnModelComparisonRun[]>([]);
    const [isAnnModelComparisonHydrated, setIsAnnModelComparisonHydrated] = useState<boolean>(false);
    const [activationSnapshot, setActivationSnapshot] = useState<ActivationSnapshot | null>(null);
    const [modelStateSnapshot, setModelStateSnapshot] = useState<AnnModelStateSnapshot | null>(null);
    const [trainingPhaseSnapshot, setTrainingPhaseSnapshot] = useState<AnnTrainingPhaseSnapshot | null>(null);
    const [trainingSessionStatus, setTrainingSessionStatus] = useState<AnnTrainingSessionStatus | null>(null);
    const [trainingExecutionMode, setTrainingExecutionMode] = useState<AnnTrainingExecutionMode>('automatic');
    const [automaticAdvanceError, setAutomaticAdvanceError] = useState<boolean>(false);
    const [isAutomaticTrainingArmed, setIsAutomaticTrainingArmed] = useState<boolean>(false);
    const [isTrainingSessionActive, setIsTrainingSessionActive] = useState<boolean>(false);
    const [latestFeatureStructure, setLatestFeatureStructure] = useState<FeatureMatrixStructure | null>(null);
    const [inferenceMode, setInferenceMode] = useState<'dataset' | 'uploaded' | null>(null);
    const [useDimensionalityReduction, setUseDimensionalityReduction] = useState<boolean>(false);
    const [labelMap, setLabelMap] = useState<Map<string, number>>(new Map());
    const [inputDimension, setInputDimension] = useState<number>(0);
    const [outputDimension, setOutputDimension] = useState<number>(0);
    const [isModelTrained, setIsModelTrained] = useState<boolean>(false);
    const hasUsableModel = isModelTrained || isTrainingSessionActive;
    const [trainedModelContextSource, setTrainedModelContextSource] = useState<'trained' | 'imported' | null>(null);
    // --- Initialize selectedFeatures state with the local default --- 
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set(DEFAULT_SELECTED_FEATURES));
    const [isAnnSetupHydrated, setIsAnnSetupHydrated] = useState<boolean>(false);
    const [pendingUploadedDatasetManifest, setPendingUploadedDatasetManifest] = useState<UploadedDatasetManifest | null>(null);
    const [uploadedDatasetReattachmentReview, setUploadedDatasetReattachmentReview] = useState<UploadedDatasetReattachmentReviewSummary | null>(null);
    const [isUploadedDatasetReattachmentHydrated, setIsUploadedDatasetReattachmentHydrated] = useState<boolean>(false);
    // --- NEW: State for control panel configuration ---
    const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>('standardize');
    const [reductionMethod, setReductionMethod] = useState<ReductionMethod>('umap');
    const [targetDimensions, setTargetDimensions] = useState<number>(2);
    const [latestCompletedStage, setLatestCompletedStage] = useState<ProcessingStage>(null);
    const [visualizationTargetStage, setVisualizationTargetStage] = useState<ProcessingStage>(null);
    const [workspacePage, setWorkspacePage] = useState<AnnWorkspacePage>('data');

    // --- NEW: Audio Player State ---
    const [currentlyPlayingSongId, setCurrentlyPlayingSongId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [detailsSongId, setDetailsSongId] = useState<string | null>(null);
    // -----------------------------

    // --- Worker Refs ---
    const essentiaWorkerRef = useRef<Worker | null>(null);
    const dataProcessingWorkerRef = useRef<Worker | null>(null);
    const druidWorkerRef = useRef<Worker | null>(null);
    const mlpWorkerRef = useRef<Worker | null>(null);
    const inferenceModeRef = useRef<'dataset' | 'uploaded' | null>(null);
    const activeDataProcessingRequestIdRef = useRef<string | null>(null);
    const activeReductionRequestIdRef = useRef<string | null>(null);
    const activeMlpRequestIdRef = useRef<string | null>(null);
    const activeValidationRequestIdRef = useRef<string | null>(null);
    const permutationImportanceCancelRequestedRef = useRef<boolean>(false);
    const latestModelComparisonRunIdRef = useRef<string | null>(null);
    const annSetupLoadAttemptedRef = useRef<boolean>(false);
    const annModelComparisonLoadAttemptedRef = useRef<boolean>(false);
    const annUploadedDatasetReattachmentLoadAttemptedRef = useRef<boolean>(false);
    const trainingRunContextRef = useRef<TrainingRunContext | null>(null);
    const trainingExecutionModeRef = useRef<AnnTrainingExecutionMode>('automatic');

    // --- Other Refs ---
    const audioContextRef = useRef<AudioContext | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const annSetupImportInputRef = useRef<HTMLInputElement | null>(null);
    const annUploadedDatasetReattachInputRef = useRef<HTMLInputElement | null>(null);
    const comparisonImportInputRef = useRef<HTMLInputElement | null>(null);
    const trainedModelImportInputRef = useRef<HTMLInputElement | null>(null);
    const uploadedTrainingObjectUrlsRef = useRef<Set<string>>(new Set());
    // --- Log Helper ---
    const addLogMessage = useCallback((message: string, level: LogLevel = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry: LogMessage = { text: message, level, timestamp };
        console.log(`[${level.toUpperCase()}] ${message}`);
        setLogMessages(prevLogs => [...prevLogs.slice(-199), logEntry]);
    }, []);

    useEffect(() => {
        if (annSetupLoadAttemptedRef.current) return;
        annSetupLoadAttemptedRef.current = true;

        const result = loadAnnSetupFromStorage({
            storage: window.localStorage,
            availableSongIds: DEFAULT_SONG_IDS,
        });

        if (result.setup) {
            setNamedLists(result.setup.namedLists);
            setSelectedFeatures(result.setup.selectedFeatures);
            setProcessingMethod(result.setup.processingMethod);
            setUseDimensionalityReduction(result.setup.useDimensionalityReduction);
            setReductionMethod(result.setup.reductionMethod);
            setTargetDimensions(result.setup.targetDimensions);
            setNetworkConfig(result.setup.networkConfig);
            addLogMessage('[ANN Setup] Restored saved labels and pipeline settings.', 'complete');
        } else if (result.status === 'error') {
            addLogMessage(`[ANN Setup] Could not restore saved setup: ${result.reason}`, 'warn');
        }

        setIsAnnSetupHydrated(true);
    }, [addLogMessage]);

    useEffect(() => {
        if (annModelComparisonLoadAttemptedRef.current) return;
        annModelComparisonLoadAttemptedRef.current = true;

        const result = loadAnnModelComparisonFromStorage({
            storage: window.localStorage,
        });

        if (result.runs) {
            setModelComparisonRuns(result.runs);
            if (result.runs.length > 0) {
                addLogMessage(`[ANN Comparison] Restored ${result.runs.length} saved model comparison run${result.runs.length === 1 ? '' : 's'}.`, 'complete');
            }
        } else if (result.status === 'error') {
            addLogMessage(`[ANN Comparison] Could not restore saved model comparisons: ${result.reason}`, 'warn');
        } else if (result.status === 'invalid') {
            addLogMessage('[ANN Comparison] Ignored invalid saved model comparison history.', 'warn');
        }

        setIsAnnModelComparisonHydrated(true);
    }, [addLogMessage]);

    useEffect(() => {
        if (annUploadedDatasetReattachmentLoadAttemptedRef.current) return;
        annUploadedDatasetReattachmentLoadAttemptedRef.current = true;

        const result = loadPendingUploadedDatasetManifestFromStorage({
            storage: window.localStorage,
        });

        if (result.manifest) {
            setPendingUploadedDatasetManifest(result.manifest);
            addLogMessage(`[ANN Setup] Restored pending reattachment for ${result.manifest.userSongCount} uploaded song${result.manifest.userSongCount === 1 ? '' : 's'}.`, 'complete');
        } else if (result.status === 'error') {
            addLogMessage(`[ANN Setup] Could not restore pending uploaded-song reattachment: ${result.reason}`, 'warn');
        } else if (result.status === 'invalid') {
            addLogMessage('[ANN Setup] Ignored invalid pending uploaded-song reattachment state.', 'warn');
        }

        setIsUploadedDatasetReattachmentHydrated(true);
    }, [addLogMessage]);

    useEffect(() => {
        if (!isAnnModelComparisonHydrated) return;

        const result = saveAnnModelComparisonToStorage({
            storage: window.localStorage,
            runs: modelComparisonRuns,
        });
        if (!result.saved) {
            addLogMessage(`[ANN Comparison] Could not save model comparison history: ${result.reason}`, 'warn');
        }
    }, [isAnnModelComparisonHydrated, modelComparisonRuns, addLogMessage]);

    useEffect(() => {
        if (!isUploadedDatasetReattachmentHydrated) return;

        const result = savePendingUploadedDatasetManifestToStorage({
            storage: window.localStorage,
            manifest: pendingUploadedDatasetManifest,
        });
        if (!result.saved) {
            addLogMessage(`[ANN Setup] Could not save pending uploaded-song reattachment: ${result.reason}`, 'warn');
        }
    }, [addLogMessage, isUploadedDatasetReattachmentHydrated, pendingUploadedDatasetManifest]);

    useEffect(() => {
        if (!isAnnSetupHydrated || !networkConfig) return;

        const result = saveAnnSetupToStorage({
            storage: window.localStorage,
            namedLists,
            selectedFeatures,
            processingMethod,
            useDimensionalityReduction,
            reductionMethod,
            targetDimensions,
            networkConfig,
            persistableSongIds: DEFAULT_SONG_IDS,
        });
        if (!result.saved) {
            addLogMessage(`[ANN Setup] Could not save setup: ${result.reason}`, 'warn');
        }
    }, [isAnnSetupHydrated, namedLists, selectedFeatures, processingMethod, useDimensionalityReduction, reductionMethod, targetDimensions, networkConfig, addLogMessage]);

    useEffect(() => {
        let cancelled = false;

        const loadDefaultFeatureCache = async () => {
            addLogMessage('[ANN Cache] Loading default feature cache...', 'info');
            const result = await loadAnnDefaultFeatureCache({ fetcher: fetch });
            if (cancelled) return;

            if (result.cache) {
                setDefaultFeatureCache(result.cache);
                addLogMessage(`[ANN Cache] Loaded cached default features for ${result.songCount} songs.`, 'complete');
                return;
            }

            setDefaultFeatureCache(null);
            if (result.status === 'unavailable') {
                addLogMessage('[ANN Cache] Default feature cache unavailable; uncached feature extraction will use workers.', 'warn');
            } else if (result.status === 'invalid') {
                addLogMessage('[ANN Cache] Default feature cache has an invalid shape; uncached feature extraction will use workers.', 'warn');
            } else {
                addLogMessage(`[ANN Cache] Failed to load default feature cache: ${result.reason}`, 'warn');
            }
        };

        loadDefaultFeatureCache();

        return () => {
            cancelled = true;
        };
    }, [addLogMessage]);

    useEffect(() => {
        inferenceModeRef.current = inferenceMode;
    }, [inferenceMode]);

    const invalidateModel = useCallback((reason: string) => {
        setIsModelTrained(false);
        setInferenceResults({});
        setUploadedInferenceResult(null);
        setUploadedInferenceError(null);
        setTrainingPipelineSnapshot(null);
        setTrainedModelInputData(null);
        setTrainingSummary(null);
        setFeatureSignalSummary(null);
        setIsAnalyzingPermutationImportance(false);
        setPermutationImportanceSummary(null);
        setPermutationImportanceError(null);
        setValidationRunProgress(null);
        setValidationRunSummary(null);
        setValidationRunFoldResults(null);
        setValidationRunError(null);
        setActivationSnapshot(null);
        setModelStateSnapshot(null);
        setTrainingPhaseSnapshot(null);
        setTrainingSessionStatus(null);
        setIsAutomaticTrainingArmed(false);
        setIsTrainingSessionActive(false);
        trainingRunContextRef.current = null;
        setTrainedModelContextSource(null);
        if (mlpWorkerRef.current) {
            const requestId = createWorkerRequestId('ann-mlp-reset');
            activeMlpRequestIdRef.current = requestId;
            mlpWorkerRef.current.postMessage({ type: 'reset', requestId });
        }
        addLogMessage(`Model invalidated: ${reason}`, 'warn');
    }, [addLogMessage]);

    const isActiveMlpRequest = useCallback((requestId: string) => (
        activeMlpRequestIdRef.current === requestId
    ), []);

    const clearActiveMlpRequest = useCallback((settledRequestId?: string | null) => {
        activeMlpRequestIdRef.current = clearActiveWorkerRequestId(activeMlpRequestIdRef.current, settledRequestId);
    }, []);

    const isActiveValidationRequest = useCallback((requestId: string) => (
        activeValidationRequestIdRef.current === requestId
    ), []);

    const clearActiveValidationRequest = useCallback((settledRequestId?: string | null) => {
        activeValidationRequestIdRef.current = clearActiveWorkerRequestId(activeValidationRequestIdRef.current, settledRequestId);
    }, []);

    const handleMlpProgress = useCallback((message: AnnWorkerReply) => {
        const { type, payload } = message;
        switch (type) {
            case 'epochMetrics':
                if (payload && typeof payload.epoch === 'number' && payload.metrics && typeof payload.metrics.loss === 'number' && typeof payload.metrics.acc === 'number') {
                    setCurrentEpoch(payload.epoch);
                    setTrainingHistory(prev => ({
                        loss: [...prev.loss, { x: payload.epoch, y: payload.metrics.loss }],
                        acc: [...prev.acc, { x: payload.epoch, y: payload.metrics.acc }],
                        valLoss: [...prev.valLoss, { x: payload.epoch, y: payload.metrics.valLoss ?? 0 }],
                        valAcc: [...prev.valAcc, { x: payload.epoch, y: payload.metrics.valAcc ?? 0 }],
                    }));
                    const mode = trainingExecutionModeRef.current;
                    const targetEpochs = trainingRunContextRef.current?.networkConfig.epochs ?? payload.epoch;
                    addLogMessage(
                        `[ANN Train][${getTrainingModeLabel(mode)}] Epoch ${payload.epoch}/${targetEpochs} | loss ${payload.metrics.loss.toFixed(4)} | accuracy ${(payload.metrics.acc * 100).toFixed(1)}% | validation loss ${(payload.metrics.valLoss ?? 0).toFixed(4)} | validation accuracy ${((payload.metrics.valAcc ?? 0) * 100).toFixed(1)}%`,
                        'info'
                    );
                } else {
                    console.warn('Received malformed epochMetrics:', payload);
                    addLogMessage('Received malformed epoch metrics from MLP worker.', 'warn');
                }
                break;
            case 'activationSnapshot':
                setActivationSnapshot(payload as ActivationSnapshot);
                break;
            case 'modelStateSnapshot':
                setModelStateSnapshot(payload as AnnModelStateSnapshot);
                break;
            case 'trainingSnapshot':
                if (payload?.activationSnapshot) setActivationSnapshot(payload.activationSnapshot as ActivationSnapshot);
                if (payload?.modelStateSnapshot) setModelStateSnapshot(payload.modelStateSnapshot as AnnModelStateSnapshot);
                break;
            case 'trainingPhase':
                setTrainingPhaseSnapshot(payload as AnnTrainingPhaseSnapshot);
                if (trainingExecutionModeRef.current === 'step' && payload) {
                    addLogMessage(formatTrainingPhaseLog(payload as AnnTrainingPhaseSnapshot), 'info');
                }
                break;
            default:
                break;
        }
    }, [addLogMessage]);

    // --- Define prepareMatrix first ---
    const prepareMatrix = useCallback((
        featuresOverride: Record<string, Features | null> = songFeatures,
        statusOverride: Record<string, FeatureStatus> = featureStatus
    ) => {
        const activeFeatures = songs
            .filter(song => featuresOverride[song.id] && statusOverride[song.id] === 'complete')
            .map(song => ({ id: song.id, features: featuresOverride[song.id] as Features }));
        const result = prepareFeatureMatrix(activeFeatures, selectedFeatures, addLogMessage);
        setProcessedData(null);
        setProcessingStats(null);
        setReducedDataPoints({});
        setReductionDimensions(0);
        setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
        setCurrentEpoch(0);
        invalidateModel('feature matrix changed');
        if (!result) {
            setUnprocessedData(null);
            setLatestFeatureStructure(null);
            setInputDimension(0);
            setLatestCompletedStage(null);
            setVisualizationTargetStage(null);
            return;
        }
        setUnprocessedData(result.matrix);
        setLatestFeatureStructure(result.structure);
        setInputDimension(result.matrix.vectors[0]?.length ?? 0);
        setLatestCompletedStage('features');
        setVisualizationTargetStage('features');
    }, [songs, songFeatures, featureStatus, addLogMessage, selectedFeatures, invalidateModel]);

    // --- Worker Initialization useEffect ---
    useEffect(() => {
        // Init AudioContext
        if (!audioContextRef.current) {
             try { audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); addLogMessage('AudioContext initialized.'); } catch (e) { addLogMessage('Error initializing AudioContext.', 'error'); console.error(e); }
        }
        // Init Essentia Worker
        if (!essentiaWorkerRef.current) {
            addLogMessage('Creating Essentia Worker...', 'info');
            essentiaWorkerRef.current = new Worker(/* turbopackIgnore: true */ annWorkerAssets.essentia);
            essentiaWorkerRef.current.onmessage = (event) => {
                const { type, payload, songId, features, error } = event.data;
                switch (type) {
                    case 'essentiaReady': setEssentiaWorkerReady(payload); addLogMessage(payload ? 'Essentia worker ready.' : `Essentia init failed: ${error}`, payload ? 'complete' : 'error'); break;
                    case 'featureExtractionComplete':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        setSongFeatures(prev => ({ ...prev, [songId]: features }));
                        setFeatureStatus(prev => ({ ...prev, [songId]: 'complete' }));
                        break;
                    case 'featureExtractionError':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        addLogMessage(`[Essentia] Error processing ${songId}: ${error}`, 'error');
                        setFeatureStatus(prev => ({ ...prev, [songId]: 'error' }));
                        break;
                    default: addLogMessage(`[Essentia] Unknown msg: ${type}`, 'warn');
                }
            };
            essentiaWorkerRef.current.onerror = (e) => { addLogMessage(`Essentia Worker Error: ${e.message}`, 'error'); setEssentiaWorkerReady(false); setIsExtracting(false); };
            essentiaWorkerRef.current.postMessage({ type: 'init' });
        }
        // Init Data Processing Worker
        if (!dataProcessingWorkerRef.current) {
            addLogMessage('Creating Data Processing Worker...', 'info');
            dataProcessingWorkerRef.current = new Worker(/* turbopackIgnore: true */ annWorkerAssets.dataProcessing);
            dataProcessingWorkerRef.current.onmessage = (event) => {
                const { type, payload } = event.data;
                switch (type) {
                    case 'processingComplete':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        setProcessedData({ vectors: payload.processedVectors, songIds: payload.songIds });
                        addLogMessage('Data processing complete.', 'complete');
                        setIsProcessingData(false);
                        setInputDimension(payload.processedVectors?.[0]?.length ?? 0);
                        break; // Legacy uncorrelated fallback
                    case 'processingError':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        addLogMessage(`Data Processing Error: ${payload.error}`, 'error');
                        setProcessedData(null);
                        setIsProcessingData(false);
                        setInputDimension(0);
                        break;
                    case 'transformComplete':
                    case 'transformError':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        addLogMessage(`[DataProc] Unexpected uncorrelated msg: ${type}`, 'warn');
                        break;
                    case 'dataProcessingWorkerReady': setDataProcessingWorkerReady(true); addLogMessage('Data Processing worker ready.', 'complete'); break;
                    default: addLogMessage(`[DataProc] Unknown msg: ${type}`, 'warn');
                }
             };
            dataProcessingWorkerRef.current.onerror = (e) => {
                activeDataProcessingRequestIdRef.current = null;
                addLogMessage(`DataProc Worker Error: ${e.message}`, 'error');
                setDataProcessingWorkerReady(false);
                setIsProcessingData(false);
                setInputDimension(0);
            };
            // Send init message to trigger ready response
            dataProcessingWorkerRef.current.postMessage({ type: 'init' });
        }
        // Init Druid Worker
        if (!druidWorkerRef.current) {
            addLogMessage('Creating Druid Worker...', 'info');
            druidWorkerRef.current = new Worker(/* turbopackIgnore: true */ annWorkerAssets.druid);
            druidWorkerRef.current.onmessage = (event) => {
                 const { type, payload } = event.data;
                switch(type) {
                    case 'druidWorkerReady':
                        setDruidWorkerReady(true);
                        addLogMessage('Druid worker ready.', 'complete');
                        break;
                    case 'reductionComplete': 
                        if (isRequestScopedWorkerReply(event.data)) break;
                        setIsReducing(false); 
                        const newPoints: Record<string, number[]> = {}; 
                        payload.songIds.forEach((id: string, i: number) => { newPoints[id] = payload.reducedData[i]; }); 
                        setReducedDataPoints(prev => ({ ...prev, ...newPoints })); 
                        const newDim = payload.reducedData?.[0]?.length ?? 0;
                        setReductionDimensions(newDim);
                        setInputDimension(newDim); // Update inputDimension if reduction is used
                        addLogMessage('Dimensionality reduction complete.', 'complete'); 
                        break;
                    case 'reductionError': 
                        if (isRequestScopedWorkerReply(event.data)) break;
                        setIsReducing(false); 
                        addLogMessage(`Druid Error: ${payload.error}`, 'error'); 
                        setReductionDimensions(0); 
                        // Potentially reset inputDimension if reduction failed?
                        break;
                    case 'transformNewDataComplete':
                        if (isRequestScopedWorkerReply(event.data)) break;
                        addLogMessage('[Druid] Unexpected uncorrelated transform completion.', 'warn');
                        break;
                    default: addLogMessage(`[Druid] Unknown msg: ${type}`, 'warn');
                }
            };
            druidWorkerRef.current.onerror = (e) => {
                activeReductionRequestIdRef.current = null;
                addLogMessage(`Druid Worker Error: ${e.message}`, 'error');
                setDruidWorkerReady(false);
                setIsReducing(false);
                setReductionDimensions(0);
            };
        }
        // Init MLP Worker
        if (!mlpWorkerRef.current) {
            addLogMessage('Creating MLP Worker...', 'info');
            try {
                 mlpWorkerRef.current = new Worker(/* turbopackIgnore: true */ annWorkerAssets.mlp);
                 mlpWorkerRef.current.onmessage = (event: MessageEvent<AnnWorkerReply>) => {
                    const { type, payload, requestId } = event.data;
                    const disposition = getAnnMlpRouteMessageDisposition(event.data, activeMlpRequestIdRef.current);
                    if (disposition === 'request-client') {
                        return;
                    }
                    if (disposition === 'stale') {
                        console.info(`[MLP] Ignoring stale ${type} for request ${requestId}.`);
                        return;
                    }
                    const clearScopedMlpRequest = () => {
                        activeMlpRequestIdRef.current = clearActiveWorkerRequestId(activeMlpRequestIdRef.current, requestId);
                    };
                    switch (type) {
                        case 'mlpWorkerReady': setMlpWorkerReady(true); addLogMessage('MLP worker ready.', 'complete'); break;
                        case 'mlpResetComplete':
                            clearScopedMlpRequest();
                            break;
                        case 'epochMetrics':
                            // Ensure payload format is correct
                            if (payload && typeof payload.epoch === 'number' && payload.metrics && typeof payload.metrics.loss === 'number' && typeof payload.metrics.acc === 'number') {
                                setCurrentEpoch(payload.epoch);
                                setTrainingHistory(prev => ({
                                    loss: [...prev.loss, { x: payload.epoch, y: payload.metrics.loss }],
                                    acc: [...prev.acc, { x: payload.epoch, y: payload.metrics.acc }],
                                    valLoss: [...prev.valLoss, { x: payload.epoch, y: payload.metrics.valLoss ?? 0 }],
                                    valAcc: [...prev.valAcc, { x: payload.epoch, y: payload.metrics.valAcc ?? 0 }],
                                }));
                            } else {
                                console.warn('Received malformed epochMetrics:', payload);
                                addLogMessage('Received malformed epoch metrics from MLP worker.', 'warn');
                            }
                            break;
                        case 'trainingComplete': 
                            clearScopedMlpRequest();
                            setIsTraining(false);
                            setIsModelTrained(true);
                            if (payload?.activationSnapshot) setActivationSnapshot(payload.activationSnapshot);
                            const finalAcc = payload?.finalMetrics?.accuracy;
                            addLogMessage(`Training complete.${finalAcc !== undefined ? ` Final Test Accuracy: ${(finalAcc * 100).toFixed(2)}%` : ''}`, 'complete');
                            break;
                        case 'activationSnapshot':
                            setActivationSnapshot(payload as ActivationSnapshot);
                            break;
                        case 'trainingSnapshot':
                            if (payload?.activationSnapshot) setActivationSnapshot(payload.activationSnapshot as ActivationSnapshot);
                            if (payload?.modelStateSnapshot) setModelStateSnapshot(payload.modelStateSnapshot as AnnModelStateSnapshot);
                            break;
                        case 'inferenceComplete':
                            clearScopedMlpRequest();
                            setIsInferring(false);
                            const formattedResults = formatAnnMlpInferenceResults(payload);
                            if (inferenceModeRef.current === 'uploaded') {
                                const uploadedResult = formattedResults[INFERENCE_SONG_ID];
                                setUploadedInferenceResult(uploadedResult ? { predictedLabel: uploadedResult.predictedLabel, confidence: uploadedResult.confidence ?? 0 } : null);
                                setUploadedInferenceError(uploadedResult ? null : 'Uploaded inference returned no result.');
                            } else {
                                setInferenceResults(formattedResults);
                            }
                            setInferenceMode(null);
                            addLogMessage(inferenceModeRef.current === 'uploaded' ? 'Uploaded inference complete.' : 'Dataset inference complete.', 'complete');
                            console.log("Inference results:", formattedResults);
                            break;
                        case 'mlpError':
                            clearScopedMlpRequest();
                            addLogMessage(`MLP Worker Error: ${payload.error}`, 'error');
                            setIsTraining(false); 
                            setIsInferring(false);
                            setInferenceMode(null);
                            setIsModelTrained(false); // Ensure model is marked not trained on error
                            break;
                        default: addLogMessage(`[MLP] Unknown msg: ${type}`, 'warn');
                    }
                 };
                 mlpWorkerRef.current.onerror = (e) => {
                     activeMlpRequestIdRef.current = null;
                     addLogMessage(`MLP Worker Error: ${e.message}`, 'error');
                     setMlpWorkerReady(false);
                     setIsTraining(false);
                     setIsInferring(false);
                     setIsModelTrained(false); // Ensure model is marked not trained on error
                 };
             } catch (e: any) {
                 addLogMessage(`Failed to create MLP Worker: ${e.message}`, 'error');
             }
        }

        // Cleanup workers on component unmount
        return () => {
            addLogMessage('Terminating workers...');
            essentiaWorkerRef.current?.terminate();
            dataProcessingWorkerRef.current?.terminate();
            druidWorkerRef.current?.terminate();
            mlpWorkerRef.current?.terminate();
            essentiaWorkerRef.current = null;
            dataProcessingWorkerRef.current = null;
            druidWorkerRef.current = null;
            mlpWorkerRef.current = null;
            uploadedTrainingObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            uploadedTrainingObjectUrlsRef.current.clear();
            setEssentiaWorkerReady(false);
            setDataProcessingWorkerReady(false);
            setDruidWorkerReady(false);
            setMlpWorkerReady(false);
        };
    }, [addLogMessage]); // Dependencies for worker initialization

    const featureExtractionSongs = useMemo(() => songs.map(({ id }) => ({ id })), [songs]);
    const currentFeatureRows = useMemo(() => getAnnCurrentFeatureRows({
        songs: featureExtractionSongs,
        featureStatus,
        songFeatures,
    }), [featureExtractionSongs, featureStatus, songFeatures]);
    const hasCurrentFeatureRows = currentFeatureRows.hasRows;
    const selectedFeaturesMatchTrainedSnapshot = useMemo(() => {
        if (!hasUsableModel || !trainingPipelineSnapshot) return false;
        const persistedFeatureIds = trainingPipelineSnapshot.selectedFeatureIds;
        return selectedFeatures.size === persistedFeatureIds.length
            && persistedFeatureIds.every(featureId => selectedFeatures.has(featureId));
    }, [hasUsableModel, selectedFeatures, trainingPipelineSnapshot]);

    // --- Data Preparation/Derivation Logic ---
    useEffect(() => {
        // Update labelMap and outputDimension when namedLists change
        const nextLabelState = getAnnRouteLabelState({ songs, namedLists });
        setLabelMap(nextLabelState.labelMap);
        setOutputDimension(nextLabelState.outputDimension);
        addLogMessage(`Label map updated. Output dimension: ${nextLabelState.outputDimension}`, 'info');
    }, [songs, namedLists, addLogMessage]); // Re-run when namedLists or the dataset changes

    // --- Monitor feature extraction completion --- 
    useEffect(() => {
        const extractionCompletion = getAnnFeatureExtractionCompletion({
            songs: featureExtractionSongs,
            featureStatus,
            isExtracting,
        });
        if (extractionCompletion.isComplete) {
            setIsExtracting(false);
            addLogMessage('Feature extraction process finished.', extractionCompletion.completedCount > 0 ? 'complete' : 'warn');
            if (extractionCompletion.hasSuccessfulFeatures) {
                prepareMatrix();
            }
        }
    }, [featureStatus, featureExtractionSongs, isExtracting, addLogMessage, prepareMatrix]);

    // --- Trigger prepareMatrix when selected features change (and features extracted) --- 
    useEffect(() => {
        if (selectedFeaturesMatchTrainedSnapshot) return;
        // Prepare matrix only if features have been extracted for at least one song
        // and features are actually selected
        if (hasCurrentFeatureRows && selectedFeatures.size > 0) {
            prepareMatrix();
        }
    }, [selectedFeatures, hasCurrentFeatureRows, prepareMatrix, selectedFeaturesMatchTrainedSnapshot]);

    // --- Effect to prepare matrix when selected features change or labels change (affects available points) ---
    useEffect(() => {
        if (selectedFeaturesMatchTrainedSnapshot) return;
        // Only prepare if features have been extracted for at least one song
        if (hasCurrentFeatureRows) {
           prepareMatrix();
        }
        // Reset subsequent pipeline stages
        setProcessedData(null);
        setReducedDataPoints({});
        setLatestCompletedStage(null); // Reset stage completion
        setIsModelTrained(false); // Model needs retraining if features change
        setInferenceResults({}); // Clear old inferences
    }, [selectedFeatures, prepareMatrix, hasCurrentFeatureRows, selectedFeaturesMatchTrainedSnapshot]);

    // --- Callback Functions for UI Controls ---
    const getDecodedAudio = useCallback(async (song: Song): Promise<AudioBuffer> => {
        if (!audioContextRef.current) throw new Error('AudioContext not initialized.');
        const response = await fetch(song.url);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
        return audioContextRef.current.decodeAudioData(await response.arrayBuffer());
    }, []);

    const extractFeaturesWithWorker = useCallback((songId: string, audioVector: number[], sampleRate: number, featuresToExtract: string[]) => new Promise<Features>((resolve, reject) => {
        const worker = essentiaWorkerRef.current;
        if (!worker) {
            reject(new Error('Essentia worker not ready.'));
            return;
        }
        const requestId = createWorkerRequestId('ann-extract-features');
        sendWorkerRequest<AnnWorkerReply & { songId?: string; features?: Features; error?: string }, unknown, Features>({
            worker: worker as unknown as WorkerRequestTarget<AnnWorkerReply & { songId?: string; features?: Features; error?: string }, unknown>,
            requestId,
            message: {
                type: 'extractFeatures',
                requestId,
                payload: { songId, audioVector, sampleRate, featuresToExtract },
            },
            successTypes: ['featureExtractionComplete'],
            errorTypes: ['featureExtractionError'],
            getResult: message => getEssentiaFeatureExtractionResult(message, songId),
            getErrorMessage: getEssentiaFeatureExtractionError,
            timeoutMs: 90000,
        }).then(resolve, reject);
    }), []);

    const handleExtractFeatures = useCallback(async (requestedFeatures?: Set<string>) => {
        if (isExtracting) {
            addLogMessage('Feature extraction already in progress.', 'warn');
            return;
        }
        const featuresToExtract = Array.from(requestedFeatures ?? selectedFeatures);
        if (featuresToExtract.length === 0) {
            addLogMessage('Select at least one MIR feature first.', 'warn');
            return;
        }

        const cachePlan = getAnnDefaultFeatureCachePlan({
            songs,
            selectedFeatureIds: featuresToExtract,
            cache: defaultFeatureCache,
        });
        const songsToExtract = songs.filter(song => cachePlan.songIdsToExtract.includes(song.id));
        if (songsToExtract.length > 0 && !essentiaWorkerRef.current) {
            addLogMessage('Essentia worker not ready for uncached feature extraction.', 'error');
            return;
        }

        setIsExtracting(true);
        const nextFeatures: Record<string, Features | null> = { ...cachePlan.cachedFeaturesBySongId };
        const nextStatuses: Record<string, FeatureStatus> = { ...cachePlan.statusBySongId };
        setSongFeatures(nextFeatures);
        setFeatureStatus(nextStatuses);
        setUnprocessedData(null);
        setProcessedData(null);
        setProcessingStats(null);
        setReducedDataPoints({});
        invalidateModel('new feature extraction started');
        addLogMessage(`Preparing ANN features: [${featuresToExtract.join(', ')}].`);

        const cachedCount = Object.keys(cachePlan.cachedFeaturesBySongId).length;
        if (cachedCount > 0) {
            addLogMessage(`[ANN Cache] Using cached default features for ${cachedCount} song${cachedCount === 1 ? '' : 's'}.`, 'complete');
        }

        if (songsToExtract.length === 0) {
            setIsExtracting(false);
            addLogMessage(`Feature preparation complete from cache. Success: ${cachedCount}, Errors: 0`, 'complete');
            if (cachedCount > 0) prepareMatrix(nextFeatures, nextStatuses);
            return;
        }

        addLogMessage(`Extracting uncached features for ${songsToExtract.length} song${songsToExtract.length === 1 ? '' : 's'} with the Essentia worker.`, 'info');
        let errorCount = 0;
        for (const song of songsToExtract) {
            try {
                const audioBuffer = await getDecodedAudio(song);
                const audioVector = Array.from(audioBuffer.getChannelData(0));
                const features = await extractFeaturesWithWorker(song.id, audioVector, audioBuffer.sampleRate, featuresToExtract);
                nextFeatures[song.id] = features;
                nextStatuses[song.id] = 'complete';
                setSongFeatures(prev => ({ ...prev, [song.id]: features }));
                setFeatureStatus(prev => ({ ...prev, [song.id]: 'complete' }));
            } catch (error) {
                errorCount++;
                nextFeatures[song.id] = null;
                nextStatuses[song.id] = 'error';
                setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
                addLogMessage(`Error extracting features for ${song.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
            }
        }

        setSongFeatures(nextFeatures);
        setFeatureStatus(nextStatuses);
        setIsExtracting(false);
        const successCount = Object.values(nextStatuses).filter(status => status === 'complete').length;
        addLogMessage(`Feature extraction complete. Success: ${successCount}, Errors: ${errorCount}`, errorCount > 0 ? 'warn' : 'complete');
        if (successCount > 0) prepareMatrix(nextFeatures, nextStatuses);
    }, [songs, isExtracting, addLogMessage, prepareMatrix, selectedFeatures, defaultFeatureCache, getDecodedAudio, extractFeaturesWithWorker, invalidateModel]);

    const handleProcessData = useCallback((method: ProcessingMethod = processingMethod, range?: [number, number]) => {
        if (isProcessingData) {
            addLogMessage('Data processing already in progress.', 'warn');
            return;
        }
        if (!dataProcessingWorkerRef.current) {
            addLogMessage('Data Processing worker not ready.', 'error');
            return;
        }
        if (!unprocessedData || unprocessedData.vectors.length === 0) {
            addLogMessage('Cannot process data: Unprocessed data matrix is empty or not prepared.', 'error');
            return;
        }

        addLogMessage(`Processing data matrix (${unprocessedData.songIds.length} songs, ${inputDimension} dims) using ${method}...`);
        setIsProcessingData(true);
        setProcessedData(null);
        setReducedDataPoints({});
        setProcessingStats(null);
        invalidateModel('data processing changed');

        const requestId = createWorkerRequestId('ann-process-data');
        activeDataProcessingRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, { processedVectors: number[][]; songIds: string[]; stats: Record<string, unknown> }>({
            worker: dataProcessingWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: {
                type: 'processData',
                requestId,
                payload: {
                    vectors: unprocessedData.vectors,
                    songIds: unprocessedData.songIds,
                    isOHEColumn: unprocessedData.isOHEColumn,
                    method,
                    range,
                },
            },
            successTypes: ['processingComplete'],
            errorTypes: ['processingError'],
            getResult: message => {
                const processedVectors = message.payload?.processedVectors;
                const songIds = message.payload?.songIds;
                const stats = message.payload?.stats ?? {};
                if (!Array.isArray(processedVectors) || !Array.isArray(songIds)) {
                    throw new Error('Data processing returned invalid vectors or song IDs.');
                }
                return { processedVectors, songIds, stats };
            },
            getErrorMessage: message => message.payload?.error ?? 'Data processing failed.',
            onSettled: settledRequestId => {
                activeDataProcessingRequestIdRef.current = clearActiveWorkerRequestId(activeDataProcessingRequestIdRef.current, settledRequestId);
            },
        }).then(({ processedVectors, songIds, stats }) => {
                setProcessedData({ vectors: processedVectors, songIds });
                setProcessingStats({ method, range, isOHEColumn: unprocessedData.isOHEColumn, ...stats });
                setInputDimension(processedVectors?.[0]?.length ?? 0);
                addLogMessage(`Data processing complete. New dimensions: ${processedVectors?.[0]?.length ?? 0}`, 'complete');
                setIsProcessingData(false);
                setLatestCompletedStage('processed');
                setVisualizationTargetStage('processed');

                // Trigger reduction if enabled
                if (useDimensionalityReduction) {
                    handleReduceDimensions(reductionMethod, targetDimensions, { vectors: processedVectors, songIds });
                }
        }).catch(error => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                addLogMessage(`Data processing failed: ${errorMessage}`, 'error');
                setIsProcessingData(false);
                setProcessedData(null);
                setProcessingStats(null);
        });

    }, [unprocessedData, inputDimension, processingMethod, isProcessingData, addLogMessage, useDimensionalityReduction, reductionMethod, targetDimensions, invalidateModel]);

    const handleReduceDimensions = useCallback((method: ReductionMethod = reductionMethod, dimensions: number = targetDimensions, dataOverride?: ProcessedDataType | UnprocessedDataType) => {
        if (isReducing) {
            addLogMessage('Dimensionality reduction already in progress.', 'warn');
            return;
        }
        if (!druidWorkerRef.current) {
            addLogMessage('Dimensionality Reduction worker not ready.', 'error');
            return;
        }

        // Determine which data to reduce
        const dataToReduce = dataOverride ?? processedData ?? unprocessedData;
        if (!dataToReduce || dataToReduce.vectors.length === 0) {
            addLogMessage('Cannot reduce dimensions: No suitable data matrix available.', 'error');
            return;
        }

        addLogMessage(`Starting dimensionality reduction using ${method} to ${dimensions} dimensions...`);
        setIsReducing(true);
        setReducedDataPoints({});
        invalidateModel('dimensionality reduction changed');

        const requestId = createWorkerRequestId('ann-reduce-data');
        activeReductionRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, { reducedData: number[][]; songIds: string[] }>({
            worker: druidWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: {
                type: 'reduceDimensions',
                requestId,
                payload: {
                    featureVectors: dataToReduce.vectors,
                    songIds: dataToReduce.songIds,
                    method,
                    dimensions,
                    perplexity: 30,
                    neighbors: 15,
                    minDist: 0.1,
                },
            },
            successTypes: ['reductionComplete'],
            errorTypes: ['reductionError'],
            getResult: message => {
                const reducedData = message.payload?.reducedData;
                const songIds = message.payload?.songIds;
                if (!Array.isArray(reducedData) || !Array.isArray(songIds)) {
                    throw new Error('Dimensionality reduction returned invalid vectors or song IDs.');
                }
                return { reducedData, songIds };
            },
            getErrorMessage: message => message.payload?.error ?? 'Dimensionality reduction failed.',
            onSettled: settledRequestId => {
                activeReductionRequestIdRef.current = clearActiveWorkerRequestId(activeReductionRequestIdRef.current, settledRequestId);
            },
        }).then(({ reducedData, songIds }) => {
                const newReducedData: Record<string, number[]> = {};
                songIds.forEach((id: string, index: number) => {
                    newReducedData[id] = reducedData[index];
                });
                setReducedDataPoints(newReducedData);
                setReductionDimensions(dimensions);
                setInputDimension(dimensions);
                addLogMessage(`Dimensionality reduction complete.`, 'complete');
                setIsReducing(false);
                setLatestCompletedStage('reduced');
                setVisualizationTargetStage('reduced');
        }).catch(error => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                addLogMessage(`Dimensionality reduction failed: ${errorMessage}`, 'error');
                setIsReducing(false);
                setReducedDataPoints({});
        });

    }, [processedData, unprocessedData, reductionMethod, targetDimensions, isReducing, addLogMessage, invalidateModel]);

    const finalizeTrainingRun = useCallback((payload: TrainingWorkerResult, runId: string, logPrefix = 'Training complete.') => {
        const context = trainingRunContextRef.current;
        if (!context) {
            throw new Error('Training completed without retained pipeline metadata.');
        }
        const completedEpochs = payload.status?.completedEpochs ?? context.networkConfig.epochs;
        const completedNetworkConfig: MLPConfig = {
            ...context.networkConfig,
            epochs: completedEpochs,
        };
        const nextTrainingSummary = getAnnTrainingSummary({
            inputKind: context.inputKind,
            selectedFeatureIds: context.selectedFeatureIds,
            inputDimension: context.inputDimension,
            trainingLabels: context.trainingLabels,
            networkConfig: completedNetworkConfig,
            seed: context.seed,
            finalMetrics: payload.finalMetrics,
        });
        const nextFeatureSignalSummary = getAnnFeatureSignalSummary({
            inputKind: context.inputKind,
            vectors: context.trainingVectors,
            labels: context.trainingLabels,
            dimensionLabels: getAnnFeatureSignalDimensionLabels({
                inputKind: context.inputKind,
                inputDimension: context.inputDimension,
                rawColumnLabels: context.pipelineSnapshot.rawMatrix.columnLabels,
                reductionMethod: context.pipelineSnapshot.reduction?.method ?? null,
            }),
        });

        trainingRunContextRef.current = { ...context, networkConfig: completedNetworkConfig };
        setNetworkConfig(previous => previous && previous.epochs !== completedEpochs
            ? { ...previous, epochs: completedEpochs }
            : previous);
        setIsTraining(false);
        setIsTrainingSessionActive(false);
        setIsAutomaticTrainingArmed(false);
        setIsModelTrained(true);
        setTrainedModelContextSource('trained');
        setTrainingPhaseSnapshot(null);
        setTrainingSessionStatus(payload.status ?? null);
        if (payload.activationSnapshot) setActivationSnapshot(payload.activationSnapshot);
        if (payload.modelStateSnapshot) setModelStateSnapshot(payload.modelStateSnapshot);
        setTrainingSummary(nextTrainingSummary);
        setFeatureSignalSummary(nextFeatureSignalSummary);
        setTrainedModelInputData({
            inputKind: context.inputKind,
            songIds: [...context.dataSource.songIds],
            vectors: context.dataSource.vectors.map(vector => [...vector]),
        });
        latestModelComparisonRunIdRef.current = runId;
        setModelComparisonRuns(previousRuns => [
            ...previousRuns,
            createAnnModelComparisonRun({
                id: runId,
                runNumber: Math.max(0, ...previousRuns.map(run => run.runNumber)) + 1,
                trainedAt: new Date().toISOString(),
                trainingSummary: nextTrainingSummary,
                checkpoint: {
                    kind: 'completed',
                    epoch: completedEpochs,
                    executionMode: trainingExecutionModeRef.current,
                    phase: 'epoch-complete',
                },
            }),
        ]);
        const finalAccuracy = payload.finalMetrics?.accuracy;
        addLogMessage(`${logPrefix}${finalAccuracy !== undefined ? ` Final Test Accuracy: ${(finalAccuracy * 100).toFixed(2)}%` : ''}`, 'complete');
    }, [addLogMessage]);

    const handleTrainingExecutionModeChange = useCallback((executionMode: AnnTrainingExecutionMode) => {
        if (executionMode === trainingExecutionModeRef.current) return;
        const previousExecutionMode = trainingExecutionModeRef.current;
        setAutomaticAdvanceError(false);
        setIsAutomaticTrainingArmed(false);
        trainingExecutionModeRef.current = executionMode;
        setTrainingExecutionMode(executionMode);
        if (!isTrainingSessionActive || !trainingRunContextRef.current || !mlpWorkerRef.current) {
            addLogMessage(`[ANN Train] Execution mode selected: ${getTrainingModeLabel(executionMode)}.`, 'info');
            return;
        }

        const requestId = createWorkerRequestId('ann-training-mode');
        sendWorkerRequest<AnnWorkerReply, unknown, TrainingWorkerResult>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'setTrainingMode', requestId, payload: { executionMode } },
            successTypes: ['trainingModeChanged'],
            errorTypes: ['mlpError'],
            getResult: message => message.payload ?? {},
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Could not change the training execution mode.'),
            timeoutMs: 30000,
        }).then(payload => {
            setTrainingSessionStatus(payload.status ?? null);
            addLogMessage(executionMode === 'automatic'
                ? '[ANN Train] Automatic mode selected. Click Train Automatic to resume this session.'
                : `[ANN Train] Training execution mode changed to ${getTrainingModeLabel(executionMode)}.`, 'complete');
        }).catch(error => {
            trainingExecutionModeRef.current = previousExecutionMode;
            setTrainingExecutionMode(previousExecutionMode);
            addLogMessage(`Could not change training mode: ${error instanceof Error ? error.message : String(error)}`, 'error');
        });
    }, [addLogMessage, isTrainingSessionActive]);

    const handleTrain = useCallback((executionMode: AnnTrainingExecutionMode = trainingExecutionMode) => {
        if (isTraining) {
            addLogMessage('Training already in progress.', 'warn');
            return;
        }
        if (!mlpWorkerRef.current) {
            addLogMessage('MLP worker not ready.', 'error');
            return;
        }
        if (!networkConfig) {
            addLogMessage('Network configuration is missing.', 'error');
            return;
        }

        // 1. Determine data source
        const trainingInput = selectAnnTrainingInput({
            useDimensionalityReduction,
            reducedDataPoints,
            processedData,
            unprocessedData,
        });
        if (!trainingInput.selection) {
            addLogMessage(trainingInput.reason, 'error');
            return;
        }
        const dataSource = trainingInput.selection;
        const dataDimension = trainingInput.selection.inputDimension;
        const inputKind = trainingInput.selection.inputKind;
        addLogMessage(trainingInput.selection.logMessage, 'info');

        // 2. Prepare Labels and Filter Data
        const trainingDataset = createAnnTrainingDataset({
            source: dataSource,
            namedLists,
        });
        if (!trainingDataset.dataset) {
            addLogMessage(trainingDataset.reason, 'error');
            return;
        }
        const {
            trainingVectors,
            trainingLabels,
            labelMap: localLabelMap,
            labelMapObject,
            activationSampleSongId,
        } = trainingDataset.dataset;

        const snapshotResult = createAnnTrainingPipelineSnapshot({
            inputKind,
            selectedFeatureIds: selectedFeatures,
            rawStructure: latestFeatureStructure,
            rawMatrix: unprocessedData,
            processingStats,
            reductionMethod,
            reductionDimensions,
            processedData,
            labelMap: labelMapObject,
            songIds: dataSource.songIds,
            inputDimension: dataDimension,
        });
        if (!snapshotResult.snapshot) {
            addLogMessage(snapshotResult.reason, 'error');
            return;
        }

        setLabelMap(localLabelMap); // Store the map for inference
        setOutputDimension(localLabelMap.size);
        setInputDimension(dataDimension); // Ensure input dimension matches training data

        addLogMessage(
            `[ANN Train][${getTrainingModeLabel(executionMode)}] Starting ${networkConfig.hiddenLayers}-hidden-layer network | ${trainingVectors.length} songs, ${localLabelMap.size} labels, ${dataDimension} inputs | ${networkConfig.nodesPerLayer.join(' -> ') || 'direct output'} | ${networkConfig.activation}, ${networkConfig.optimizer}, learning rate ${networkConfig.learningRate}, batch ${networkConfig.batchSize}, ${networkConfig.epochs} epochs, ${Math.round(networkConfig.splitRatio * 100)}% train, seed ${networkConfig.randomSeed ?? 'generated'}.`,
            'info'
        );

        // 3. Prepare Worker Payload
        const workerConfig: WorkerMLPConfig = {
            layers: networkConfig.hiddenLayers,
            nodes: networkConfig.nodesPerLayer,
            activation: networkConfig.activation,
            optimizer: networkConfig.optimizer,
            learningRate: networkConfig.learningRate,
        };

        setTrainingPipelineSnapshot(snapshotResult.snapshot);

        const trainingSeed = networkConfig.randomSeed ?? Date.now();
        const trainPayload: TrainPayload = {
            vectors: trainingVectors,
            labels: trainingLabels,
            config: workerConfig,
            labelMap: labelMapObject, // Convert map for worker
            trainIterations: networkConfig.epochs,
            batchSize: networkConfig.batchSize,
            splitRatio: networkConfig.splitRatio,
            seed: trainingSeed,
            activationSampleSongId,
            executionMode,
            managedExecution: true,
        };
        trainingRunContextRef.current = {
            inputKind,
            selectedFeatureIds: Array.from(selectedFeatures),
            inputDimension: dataDimension,
            trainingLabels: [...trainingLabels],
            trainingVectors: trainingVectors.map(vector => [...vector]),
            dataSource: {
                songIds: [...dataSource.songIds],
                vectors: dataSource.vectors.map(vector => [...vector]),
            },
            pipelineSnapshot: snapshotResult.snapshot,
            networkConfig: { ...networkConfig, nodesPerLayer: [...networkConfig.nodesPerLayer] },
            seed: trainingSeed,
        };

        // 4. Send to Worker & Set Flags
        setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] }); // Clear previous history
        setAutomaticAdvanceError(false);
        setIsAutomaticTrainingArmed(executionMode === 'automatic');
        setCurrentEpoch(0);
        setActivationSnapshot(null);
        setModelStateSnapshot(null);
        setTrainingPhaseSnapshot(null);
        setTrainingSessionStatus(null);
        setIsTrainingSessionActive(true);
        trainingExecutionModeRef.current = executionMode;
        setTrainingExecutionMode(executionMode);
        setIsTraining(true); 
        setIsModelTrained(false);
        setTrainedModelContextSource('trained');
        setInferenceResults({});
        setUploadedInferenceResult(null);
        setUploadedInferenceError(null);
        setTrainingSummary(null);
        setTrainedModelInputData(null);
        setFeatureSignalSummary(null);
        setIsAnalyzingPermutationImportance(false);
        setPermutationImportanceSummary(null);
        setPermutationImportanceError(null);
        setValidationRunProgress(null);
        setValidationRunSummary(null);
        setValidationRunFoldResults(null);
        setValidationRunError(null);
        const requestId = createWorkerRequestId('ann-train');
        activeMlpRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, TrainingWorkerResult>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'train', requestId, payload: trainPayload },
            successTypes: ['trainingSessionReady', 'trainingComplete'],
            errorTypes: ['mlpError'],
            progressTypes: ['epochMetrics', 'activationSnapshot', 'modelStateSnapshot', 'trainingSnapshot', 'trainingPhase'],
            onProgress: handleMlpProgress,
            getResult: message => {
                if (!message.payload) throw new Error('MLP training returned no payload.');
                return message.payload;
            },
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'MLP training failed.'),
            isRequestActive: isActiveMlpRequest,
            onSettled: clearActiveMlpRequest,
        }).then(payload => {
            if (payload.finalMetrics) {
                finalizeTrainingRun(payload, requestId);
                return;
            }
            setIsTraining(false);
            setIsTrainingSessionActive(true);
            setTrainingSessionStatus(payload.status ?? null);
            if (payload.activationSnapshot) setActivationSnapshot(payload.activationSnapshot);
            if (payload.modelStateSnapshot) setModelStateSnapshot(payload.modelStateSnapshot);
            addLogMessage(executionMode === 'step'
                ? 'Internal step training is ready. Advance the input propagation phase when ready.'
                : executionMode === 'epoch'
                    ? 'Epoch-by-epoch training is ready. Train the first epoch when ready.'
                    : 'Automatic training session is ready and will advance epoch by epoch.', 'complete');
        }).catch(error => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setIsTraining(false);
            setIsInferring(false);
            setInferenceMode(null);
            inferenceModeRef.current = null;
            setIsModelTrained(false);
            setIsTrainingSessionActive(false);
            setTrainingSessionStatus(null);
            setTrainingPhaseSnapshot(null);
            setTrainingSummary(null);
            setFeatureSignalSummary(null);
            setIsAnalyzingPermutationImportance(false);
            setPermutationImportanceSummary(null);
            setPermutationImportanceError(null);
            setTrainedModelContextSource(null);
            setIsAutomaticTrainingArmed(false);
            trainingRunContextRef.current = null;
            addLogMessage(`MLP training failed: ${errorMessage}`, 'error');
        });

    }, [addLogMessage, clearActiveMlpRequest, finalizeTrainingRun, handleMlpProgress, isActiveMlpRequest, isTraining, latestFeatureStructure, namedLists, networkConfig, processedData, processingStats, reducedDataPoints, reductionDimensions, reductionMethod, selectedFeatures, trainingExecutionMode, unprocessedData, useDimensionalityReduction]);

    const handleAdvanceTraining = useCallback(() => {
        if (isTraining || activeMlpRequestIdRef.current || !isTrainingSessionActive || !mlpWorkerRef.current) return;
        const mode = trainingExecutionModeRef.current;
        const status = trainingSessionStatus;
        addLogMessage(mode === 'automatic'
            ? `[ANN Train][Automatic] Running epochs ${(status?.completedEpochs ?? 0) + 1}-${status?.targetEpochs ?? trainingRunContextRef.current?.networkConfig.epochs ?? '?'}.`
            : mode === 'epoch'
                ? `[ANN Train][By Epoch] Training epoch ${(status?.completedEpochs ?? 0) + 1}/${status?.targetEpochs ?? trainingRunContextRef.current?.networkConfig.epochs ?? '?'}.`
                : `[ANN Train][Internal Steps] Advancing from ${trainingPhaseSnapshot?.label ?? 'session start'}.`, 'info');
        setIsTraining(true);
        const requestId = createWorkerRequestId('ann-advance-training');
        activeMlpRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, TrainingWorkerResult>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'advanceTraining', requestId },
            successTypes: ['trainingPaused', 'trainingComplete'],
            errorTypes: ['mlpError'],
            progressTypes: ['epochMetrics', 'activationSnapshot', 'modelStateSnapshot', 'trainingSnapshot', 'trainingPhase'],
            onProgress: handleMlpProgress,
            getResult: message => message.payload ?? {},
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Could not advance training.'),
            isRequestActive: isActiveMlpRequest,
            onSettled: clearActiveMlpRequest,
        }).then(payload => {
            if (payload.finalMetrics) {
                finalizeTrainingRun(payload, requestId);
                return;
            }
            setIsTraining(false);
            setIsTrainingSessionActive(true);
            setTrainingSessionStatus(payload.status ?? null);
            if (payload.phaseSnapshot) setTrainingPhaseSnapshot(payload.phaseSnapshot);
            if (payload.status) {
                addLogMessage(`[ANN Train][${getTrainingModeLabel(mode)}] Paused at ${payload.status.completedEpochs}/${payload.status.targetEpochs} epochs. ${payload.status.nextAction}`, 'complete');
            }
        }).catch(error => {
            setIsTraining(false);
            if (trainingExecutionModeRef.current === 'automatic') {
                setAutomaticAdvanceError(true);
                setIsAutomaticTrainingArmed(false);
            }
            addLogMessage(`Could not advance training: ${error instanceof Error ? error.message : String(error)}`, 'error');
        });
    }, [addLogMessage, clearActiveMlpRequest, finalizeTrainingRun, handleMlpProgress, isActiveMlpRequest, isTraining, isTrainingSessionActive, trainingPhaseSnapshot, trainingSessionStatus]);

    const handleStartAutomaticTraining = useCallback(() => {
        if (!isTrainingSessionActive || trainingExecutionModeRef.current !== 'automatic' || isTraining) return;
        setAutomaticAdvanceError(false);
        setIsAutomaticTrainingArmed(true);
        addLogMessage('[ANN Train][Automatic] Train Automatic requested; resuming the active session.', 'info');
    }, [addLogMessage, isTraining, isTrainingSessionActive]);

    useEffect(() => {
        if (
            trainingExecutionMode !== 'automatic'
            || !isAutomaticTrainingArmed
            || automaticAdvanceError
            || isTraining
            || isInferring
            || !isTrainingSessionActive
            || !trainingSessionStatus
            || trainingSessionStatus.completedEpochs >= trainingSessionStatus.targetEpochs
        ) return;
        const timeoutId = window.setTimeout(() => handleAdvanceTraining(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [
        automaticAdvanceError,
        handleAdvanceTraining,
        isAutomaticTrainingArmed,
        isInferring,
        isTraining,
        isTrainingSessionActive,
        trainingExecutionMode,
        trainingSessionStatus,
    ]);

    const handleContinueTraining = useCallback((additionalEpochs: number, executionMode: AnnTrainingExecutionMode) => {
        if (isTraining || activeMlpRequestIdRef.current || isTrainingSessionActive || !mlpWorkerRef.current || trainedModelContextSource !== 'trained' || !trainingRunContextRef.current) return;
        setIsTraining(true);
        setAutomaticAdvanceError(false);
        setIsAutomaticTrainingArmed(executionMode === 'automatic');
        setIsModelTrained(false);
        setIsTrainingSessionActive(true);
        trainingExecutionModeRef.current = executionMode;
        setTrainingExecutionMode(executionMode);
        const currentEpochs = trainingRunContextRef.current.networkConfig.epochs;
        trainingRunContextRef.current = {
            ...trainingRunContextRef.current,
            networkConfig: {
                ...trainingRunContextRef.current.networkConfig,
                epochs: currentEpochs + additionalEpochs,
            },
        };
        setTrainingPhaseSnapshot(null);
        setInferenceResults({});
        setUploadedInferenceResult(null);
        setPermutationImportanceSummary(null);
        setValidationRunSummary(null);
        setValidationRunFoldResults(null);
        addLogMessage(`[ANN Train][${getTrainingModeLabel(executionMode)}] Continuing from epoch ${currentEpochs} for ${additionalEpochs} more epoch${additionalEpochs === 1 ? '' : 's'}.`, 'info');
        const requestId = createWorkerRequestId('ann-continue-training');
        activeMlpRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, TrainingWorkerResult>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'continueTraining', requestId, payload: { additionalEpochs, executionMode, managedExecution: true } },
            successTypes: ['trainingSessionReady', 'trainingComplete'],
            errorTypes: ['mlpError'],
            progressTypes: ['epochMetrics', 'activationSnapshot', 'modelStateSnapshot', 'trainingSnapshot', 'trainingPhase'],
            onProgress: handleMlpProgress,
            getResult: message => message.payload ?? {},
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Could not continue training.'),
            isRequestActive: isActiveMlpRequest,
            onSettled: clearActiveMlpRequest,
        }).then(payload => {
            if (payload.finalMetrics) {
                finalizeTrainingRun(payload, requestId, 'Further training complete.');
                return;
            }
            setIsTraining(false);
            setIsTrainingSessionActive(true);
            setTrainingSessionStatus(payload.status ?? null);
            if (payload.activationSnapshot) setActivationSnapshot(payload.activationSnapshot);
            if (payload.modelStateSnapshot) setModelStateSnapshot(payload.modelStateSnapshot);
            addLogMessage(`Further training is ready for ${additionalEpochs} more epoch${additionalEpochs === 1 ? '' : 's'}.`, 'complete');
        }).catch(error => {
            setIsTraining(false);
            setIsTrainingSessionActive(false);
            setIsAutomaticTrainingArmed(false);
            setIsModelTrained(true);
            if (trainingRunContextRef.current) {
                trainingRunContextRef.current = {
                    ...trainingRunContextRef.current,
                    networkConfig: { ...trainingRunContextRef.current.networkConfig, epochs: currentEpochs },
                };
            }
            addLogMessage(`Could not continue training: ${error instanceof Error ? error.message : String(error)}`, 'error');
        });
    }, [addLogMessage, clearActiveMlpRequest, finalizeTrainingRun, handleMlpProgress, isActiveMlpRequest, isTraining, isTrainingSessionActive, trainedModelContextSource]);

    const handleInfer = useCallback(() => {
        if (isInferring) {
            addLogMessage('Inference already in progress.', 'warn');
            return;
        }
        if (!mlpWorkerRef.current) {
            addLogMessage('MLP worker not ready.', 'error');
            return;
        }
        if (!hasUsableModel) {
            addLogMessage('Cannot infer: Model is not trained yet.', 'error');
            return;
        }
        if (labelMap.size === 0) {
           addLogMessage('Cannot infer: Label map is missing (train first).', 'error');
           return;
       }

        if (!trainingPipelineSnapshot) {
           addLogMessage('Cannot infer: Training pipeline snapshot is missing. Retrain first.', 'error');
           return;
       }

        // 1. Determine data source for inference (must match training)
        const inferenceInput = selectAnnDatasetInferenceInput({
            snapshot: trainingPipelineSnapshot,
            reducedDataPoints,
            processedData,
            unprocessedData,
        });
        if (!inferenceInput.selection) {
            addLogMessage(inferenceInput.reason, 'error');
            return;
        }
        const dataSource = inferenceInput.selection;
        addLogMessage(inferenceInput.selection.logMessage, 'info');

        addLogMessage(`[ANN Infer][Dataset] Starting inference on ${dataSource.songIds.length} songs using ${trainingPipelineSnapshot.inputKind} inputs (${trainingPipelineSnapshot.inputDimension} dimensions).`, 'info');

        // 2. Prepare Worker Payload
        const inferPayload: InferPayload = {
            vectors: dataSource.vectors,
            songIds: dataSource.songIds,
            labelMap: Object.fromEntries(labelMap) // Pass the label map used during training
        };

        // 3. Send to Worker & Set Flags
        setInferenceMode('dataset');
        inferenceModeRef.current = 'dataset';
        setIsInferring(true);
        setInferenceResults({}); // Clear previous results
        setPermutationImportanceSummary(null);
        setPermutationImportanceError(null);
        const requestId = createWorkerRequestId('ann-dataset-infer');
        activeMlpRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, Record<string, InferenceResult>>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'infer', requestId, payload: inferPayload },
            successTypes: ['inferenceComplete'],
            errorTypes: ['mlpError'],
            progressTypes: ['activationSnapshot'],
            onProgress: handleMlpProgress,
            getResult: message => formatAnnMlpInferenceResults(message.payload),
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'MLP inference failed.'),
            isRequestActive: isActiveMlpRequest,
            onSettled: clearActiveMlpRequest,
        }).then(formattedResults => {
            setIsInferring(false);
            setInferenceResults(formattedResults);
            const nextEvaluationSummary = getAnnEvaluationSummary({ namedLists, inferenceResults: formattedResults });
            const context = trainingRunContextRef.current;
            const checkpointStatus = trainingSessionStatus;
            if (isTrainingSessionActive && context && checkpointStatus) {
                const checkpointSummary = getAnnTrainingSummary({
                    inputKind: context.inputKind,
                    selectedFeatureIds: context.selectedFeatureIds,
                    inputDimension: context.inputDimension,
                    trainingLabels: context.trainingLabels,
                    networkConfig: {
                        ...context.networkConfig,
                        epochs: checkpointStatus.completedEpochs,
                    },
                    seed: context.seed,
                });
                latestModelComparisonRunIdRef.current = requestId;
                setModelComparisonRuns(previousRuns => updateAnnModelComparisonRunEvaluation({
                    runs: [
                        ...previousRuns,
                        createAnnModelComparisonRun({
                            id: requestId,
                            runNumber: Math.max(0, ...previousRuns.map(run => run.runNumber)) + 1,
                            trainedAt: new Date().toISOString(),
                            trainingSummary: checkpointSummary,
                            checkpoint: {
                                kind: 'intermediate',
                                epoch: checkpointStatus.completedEpochs,
                                executionMode: trainingExecutionModeRef.current,
                                phase: trainingPhaseSnapshot?.phase ?? null,
                            },
                        }),
                    ],
                    runId: requestId,
                    evaluationSummary: nextEvaluationSummary,
                }));
                addLogMessage(`Recorded an inference checkpoint at epoch ${checkpointStatus.completedEpochs} (${trainingExecutionModeRef.current}).`, 'complete');
            } else {
                setModelComparisonRuns(previousRuns => updateAnnModelComparisonRunEvaluation({
                    runs: previousRuns,
                    runId: latestModelComparisonRunIdRef.current,
                    evaluationSummary: nextEvaluationSummary,
                }));
            }
            setInferenceMode(null);
            inferenceModeRef.current = null;
            const resultRows = Object.values(formattedResults);
            const predictionCounts = resultRows.reduce<Record<string, number>>((counts, result) => {
                counts[result.predictedLabel] = (counts[result.predictedLabel] ?? 0) + 1;
                return counts;
            }, {});
            const distribution = Object.entries(predictionCounts)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([label, count]) => `${label}: ${count}`)
                .join(', ');
            const confidenceRows = resultRows.filter(result => typeof result.confidence === 'number');
            const meanConfidence = confidenceRows.length > 0
                ? confidenceRows.reduce((sum, result) => sum + (result.confidence ?? 0), 0) / confidenceRows.length
                : null;
            addLogMessage(`[ANN Infer][Dataset] Complete | ${resultRows.length} predictions${meanConfidence === null ? '' : ` | mean confidence ${(meanConfidence * 100).toFixed(1)}%`}${distribution ? ` | ${distribution}` : ''}.`, 'complete');
            console.log("Inference results:", formattedResults);
        }).catch(error => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setIsInferring(false);
            setInferenceMode(null);
            inferenceModeRef.current = null;
            if (/Model not trained/i.test(errorMessage)) setIsModelTrained(false);
            addLogMessage(`Dataset inference failed: ${errorMessage}`, 'error');
        });

    }, [isInferring, hasUsableModel, labelMap, reducedDataPoints, processedData, unprocessedData, addLogMessage, trainingPipelineSnapshot, handleMlpProgress, isActiveMlpRequest, clearActiveMlpRequest, namedLists, isTrainingSessionActive, trainingPhaseSnapshot, trainingSessionStatus]);

    const transformDataForInference = useCallback((matrix: FeatureMatrix, stats: ProcessingStats) => new Promise<number[][]>((resolve, reject) => {
        const worker = dataProcessingWorkerRef.current;
        if (!worker) {
            reject(new Error('Data processing worker not ready.'));
            return;
        }
        const requestId = createWorkerRequestId('ann-transform-data');
        activeDataProcessingRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, number[][]>({
            worker: worker as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: {
                type: 'transformData',
                requestId,
                payload: {
                    vectors: matrix.vectors,
                    songIds: matrix.songIds,
                    isOHEColumn: stats.isOHEColumn,
                    method: stats.method,
                    range: stats.range,
                    means: stats.means,
                    stdDevs: stats.stdDevs,
                    mins: stats.mins,
                    maxs: stats.maxs,
                },
            },
            successTypes: ['transformComplete'],
            errorTypes: ['transformError'],
            getResult: message => {
                const vectors = message.payload?.transformedVectors;
                if (!Array.isArray(vectors)) throw new Error('Data transform returned invalid vectors.');
                return vectors;
            },
            getErrorMessage: message => message.payload?.error ?? 'Data transform failed.',
            onSettled: settledRequestId => {
                activeDataProcessingRequestIdRef.current = clearActiveWorkerRequestId(activeDataProcessingRequestIdRef.current, settledRequestId);
            },
        }).then(resolve, reject);
    }), []);

    const transformReductionForInference = useCallback((vectors: number[][], songIds: string[], snapshot: TrainingPipelineSnapshot) => new Promise<number[][]>((resolve, reject) => {
        const worker = druidWorkerRef.current;
        if (!worker || !snapshot.reduction) {
            reject(new Error('Reduction snapshot is missing.'));
            return;
        }
        if (snapshot.reduction.method !== 'pca') {
            reject(new Error(`${snapshot.reduction.method.toUpperCase()} cannot place uploaded songs in ANN v1. Train without reduction or use PCA.`));
            return;
        }
        const requestId = createWorkerRequestId('ann-transform-reduction');
        activeReductionRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, number[][]>({
            worker: worker as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: {
                type: 'transformNewData',
                requestId,
                payload: {
                    newVectors: vectors,
                    songIds,
                    method: snapshot.reduction.method,
                    dimensions: snapshot.reduction.dimensions,
                    trainingVectors: snapshot.reduction.trainingVectors,
                    perplexity: snapshot.reduction.perplexity,
                    neighbors: snapshot.reduction.neighbors,
                    minDist: snapshot.reduction.minDist,
                },
            },
            successTypes: ['transformNewDataComplete'],
            errorTypes: ['reductionError'],
            getResult: message => {
                const reducedData = message.payload?.reducedData;
                if (!Array.isArray(reducedData)) throw new Error('Reduction transform returned invalid vectors.');
                return reducedData;
            },
            getErrorMessage: message => message.payload?.error ?? 'Reduction transform failed.',
            onSettled: settledRequestId => {
                activeReductionRequestIdRef.current = clearActiveWorkerRequestId(activeReductionRequestIdRef.current, settledRequestId);
            },
        }).then(resolve, reject);
    }), []);

    const handleInferUploadedAudio = useCallback(async () => {
        const mlpWorker = mlpWorkerRef.current;
        if (!uploadedInferenceFile || !trainingPipelineSnapshot || !audioContextRef.current || !essentiaWorkerRef.current || !mlpWorker) {
            setUploadedInferenceError('Upload an audio file and train a model first.');
            return;
        }
        setUploadedInferenceError(null);
        setUploadedInferenceResult(null);
        setInferenceMode('uploaded');
        inferenceModeRef.current = 'uploaded';
        setIsInferring(true);
        addLogMessage(`[ANN Infer][Uploaded] Starting "${uploadedInferenceFile.name}" (${(uploadedInferenceFile.size / 1024 / 1024).toFixed(2)} MB) using ${trainingPipelineSnapshot.inputKind} inputs.`, 'info');
        try {
            const audioBuffer = await audioContextRef.current.decodeAudioData(await uploadedInferenceFile.arrayBuffer());
            const features = await extractFeaturesWithWorker(
                INFERENCE_SONG_ID,
                Array.from(audioBuffer.getChannelData(0)),
                audioBuffer.sampleRate,
                trainingPipelineSnapshot.selectedFeatureIds
            );
            const rawMatrixResult = prepareAnnUploadedInferenceRawMatrix({
                songId: INFERENCE_SONG_ID,
                features,
                snapshot: trainingPipelineSnapshot,
                logFn: addLogMessage,
            });
            if (!rawMatrixResult.matrix) throw new Error(rawMatrixResult.reason);
            const rawMatrix = rawMatrixResult.matrix;
            let processedVectors: number[][] | null = null;
            let reducedVectors: number[][] | null = null;
            const needsProcessedUploadedVector = trainingPipelineSnapshot.inputKind === 'processed'
                || (trainingPipelineSnapshot.inputKind === 'reduced' && trainingPipelineSnapshot.reduction?.sourceKind !== 'raw');
            if (needsProcessedUploadedVector) {
                if (!trainingPipelineSnapshot.processingStats) throw new Error('Training processing stats are missing.');
                processedVectors = await transformDataForInference(rawMatrix, trainingPipelineSnapshot.processingStats);
            }
            if (trainingPipelineSnapshot.inputKind === 'reduced') {
                reducedVectors = await transformReductionForInference(processedVectors ?? rawMatrix.vectors, rawMatrix.songIds, trainingPipelineSnapshot);
            }
            const uploadedInput = selectAnnUploadedInferenceInput({
                snapshot: trainingPipelineSnapshot,
                rawMatrix,
                processedVectors,
                reducedVectors,
            });
            if (!uploadedInput.selection) throw new Error(uploadedInput.reason);
            const requestId = createWorkerRequestId('ann-uploaded-infer');
            activeMlpRequestIdRef.current = requestId;
            const formattedResults = await sendWorkerRequest<AnnWorkerReply, unknown, Record<string, InferenceResult>>({
                worker: mlpWorker as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
                requestId,
                message: {
                    type: 'infer',
                    requestId,
                    payload: {
                        vectors: uploadedInput.selection.vectors,
                        songIds: uploadedInput.selection.songIds,
                        labelMap: trainingPipelineSnapshot.labelMap,
                    },
                },
                successTypes: ['inferenceComplete'],
                errorTypes: ['mlpError'],
                progressTypes: ['activationSnapshot'],
                onProgress: handleMlpProgress,
                getResult: message => formatAnnMlpInferenceResults(message.payload),
                getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Uploaded inference failed.'),
                isRequestActive: isActiveMlpRequest,
                onSettled: clearActiveMlpRequest,
            });
            const uploadedResult = formattedResults[INFERENCE_SONG_ID];
            setUploadedInferenceResult(uploadedResult ? { predictedLabel: uploadedResult.predictedLabel, confidence: uploadedResult.confidence ?? 0 } : null);
            setUploadedInferenceError(uploadedResult ? null : 'Uploaded inference returned no result.');
            setIsInferring(false);
            setInferenceMode(null);
            inferenceModeRef.current = null;
            addLogMessage(uploadedResult
                ? `[ANN Infer][Uploaded] Complete | predicted ${uploadedResult.predictedLabel} with ${((uploadedResult.confidence ?? 0) * 100).toFixed(1)}% confidence.`
                : '[ANN Infer][Uploaded] Complete, but no prediction was returned.', uploadedResult ? 'complete' : 'warn');
            console.log("Inference results:", formattedResults);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setIsInferring(false);
            setInferenceMode(null);
            inferenceModeRef.current = null;
            setUploadedInferenceError(errorMessage);
            addLogMessage(`Uploaded inference failed: ${errorMessage}`, 'error');
        }
    }, [addLogMessage, clearActiveMlpRequest, extractFeaturesWithWorker, handleMlpProgress, isActiveMlpRequest, trainingPipelineSnapshot, transformDataForInference, transformReductionForInference, uploadedInferenceFile]);

    const handleInferenceFileChange = useCallback((file: File | null) => {
        setUploadedInferenceFile(file);
        setUploadedInferenceResult(null);
        setUploadedInferenceError(null);
        addLogMessage(file
            ? `[ANN Infer][Uploaded] Selected "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB).`
            : '[ANN Infer][Uploaded] Cleared the selected audio file.', 'info');
    }, [addLogMessage]);

    // --- Labeling Panel Callbacks ---
    const handleCreateList = useCallback((listName: string) => {
        const trimmedName = listName.trim();
        if (!trimmedName) {
            addLogMessage('List name cannot be empty.', 'warn');
            return;
        }
        if (namedLists.hasOwnProperty(trimmedName)) {
            addLogMessage(`List "${trimmedName}" already exists.`, 'warn');
            return;
        }
        setNamedLists(prev => ({ ...prev, [trimmedName]: new Set<string>() }));
        addLogMessage(`Created label list: "${trimmedName}"`, 'info');
    }, [namedLists, addLogMessage]);

    const handleRenameList = useCallback((oldName: string, newName: string) => {
        const trimmedNewName = newName.trim();
        if (!trimmedNewName) {
            addLogMessage('New list name cannot be empty.', 'warn');
            return;
        }
        if (oldName === trimmedNewName) return;
        if (namedLists.hasOwnProperty(trimmedNewName)) {
            addLogMessage(`List "${trimmedNewName}" already exists. Cannot rename.`, 'warn');
            return;
        }
        setNamedLists(prev => {
            const updated = { ...prev };
            if (updated[oldName]) { // Check if old name exists
                updated[trimmedNewName] = updated[oldName];
                delete updated[oldName];
                 addLogMessage(`Renamed list "${oldName}" to "${trimmedNewName}"`, 'info');
                 if (isModelTrained) invalidateModel('label names changed');
            } else {
                 addLogMessage(`List "${oldName}" not found. Cannot rename.`, 'warn');
            }
            return updated;
        });
    }, [namedLists, addLogMessage, invalidateModel, isModelTrained]);

    const handleRemoveSongFromList = useCallback((songId: string, listName: string) => {
        setNamedLists(prev => {
            const updated = { ...prev };
            if (updated[listName]) {
                const currentSet = new Set(updated[listName]);
                if (currentSet.delete(songId)) {
                    updated[listName] = currentSet;
                    addLogMessage(`Removed song ID ${songId} from list ${listName}`, 'info');
                    if (isModelTrained) invalidateModel('label assignment changed');
                    return updated;
                }
            }
            return prev; // Return original state if no change
        });
    }, [addLogMessage, invalidateModel, isModelTrained]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const targetList = event.over?.data.current?.listName as string | null | undefined;
        if (targetList === undefined) return;
        const songId = String(event.active.id);
        setNamedLists(prev => {
            const updated = Object.fromEntries(
                Object.entries(prev).map(([label, ids]) => [label, new Set(ids)])
            ) as Record<string, Set<string>>;
            Object.values(updated).forEach(ids => ids.delete(songId));
            if (targetList !== null && updated[targetList]) {
                updated[targetList].add(songId);
            }
            return updated;
        });
        invalidateModel('label assignment changed');
    }, [invalidateModel]);

    const handleSelectedFeaturesChange = useCallback((features: Set<string>) => {
        setSelectedFeatures(features);
        if (isModelTrained) invalidateModel('selected features changed');
    }, [invalidateModel, isModelTrained]);

    const handleNetworkConfigChange = useCallback((config: MLPConfig | null) => {
        setNetworkConfig(config);
        if (isModelTrained) invalidateModel('network configuration changed');
    }, [invalidateModel, isModelTrained]);

    const handleProcessingMethodChange = useCallback((method: ProcessingMethod) => {
        if (method === processingMethod) return;

        const hadDerivedOutput = Boolean(processedData) || Object.keys(reducedDataPoints).length > 0 || isModelTrained;
        setProcessingMethod(method);
        setProcessedData(null);
        setProcessingStats(null);
        setReducedDataPoints({});
        setReductionDimensions(0);
        setInputDimension(unprocessedData?.vectors[0]?.length ?? 0);
        setLatestCompletedStage(unprocessedData ? 'features' : null);
        setVisualizationTargetStage(unprocessedData ? 'features' : null);

        if (isModelTrained) invalidateModel('data processing method changed');
        if (hadDerivedOutput) {
            addLogMessage(`[ANN Processing] Selected ${method}. Process data again before training.`, 'info');
        }
    }, [addLogMessage, invalidateModel, isModelTrained, processedData, processingMethod, reducedDataPoints, unprocessedData]);

    const clearStaleReductionOutput = useCallback(() => {
        const fallbackStage: ProcessingStage = processedData ? 'processed' : unprocessedData ? 'features' : null;
        setReducedDataPoints({});
        setReductionDimensions(0);
        setInputDimension(processedData?.vectors[0]?.length ?? unprocessedData?.vectors[0]?.length ?? 0);
        setLatestCompletedStage(previous => previous === 'reduced' ? fallbackStage : previous);
        setVisualizationTargetStage(previous => previous === 'reduced' ? fallbackStage : previous);
    }, [processedData, unprocessedData]);

    const handleReductionChoiceChange = useCallback((choice: 'none' | ReductionMethod) => {
        const nextUsesReduction = choice !== 'none';
        const methodChanged = nextUsesReduction && choice !== reductionMethod;
        if (nextUsesReduction === useDimensionalityReduction && !methodChanged) return;

        setUseDimensionalityReduction(nextUsesReduction);
        if (nextUsesReduction) setReductionMethod(choice);
        clearStaleReductionOutput();
        if (isModelTrained) invalidateModel('dimensionality reduction selection changed');
    }, [clearStaleReductionOutput, invalidateModel, isModelTrained, reductionMethod, useDimensionalityReduction]);

    const handleTargetDimensionsChange = useCallback((dimensions: number) => {
        if (dimensions === targetDimensions) return;
        setTargetDimensions(dimensions);
        clearStaleReductionOutput();
        if (isModelTrained) invalidateModel('dimensionality reduction target changed');
    }, [clearStaleReductionOutput, invalidateModel, isModelTrained, targetDimensions]);

    // --- File Handling ---
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';

        if (files.length === 0) {
            return;
        }

        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isAnalyzingPermutationImportance) {
            addLogMessage('Cannot upload training songs while ANN work is running.', 'warn');
            return;
        }

        const result = ingestUploadedTrainingSongs<File>({
            existingSongs: songs,
            files,
            createObjectUrl: file => URL.createObjectURL(file),
        });

        if (result.songs.length > 0) {
            result.songs.forEach(song => uploadedTrainingObjectUrlsRef.current.add(song.url));
            setSongs(prev => [...prev, ...result.songs]);
            setSongFeatures({});
            setFeatureStatus({});
            setUnprocessedData(null);
            setProcessedData(null);
            setProcessingStats(null);
            setReducedDataPoints({});
            setReductionDimensions(0);
            setLatestFeatureStructure(null);
            setLatestCompletedStage(null);
            setVisualizationTargetStage(null);
            setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
            setCurrentEpoch(0);
            invalidateModel('training songs changed');
            addLogMessage(`Added ${result.songs.length} uploaded training song${result.songs.length === 1 ? '' : 's'}. Extract features again before training.`, 'complete');
        }

        result.skipped.forEach(skip => {
            addLogMessage(getTrainingUploadSkipMessage(skip.name, skip.reason), 'warn');
        });
    };
    const handleRemoveSongFromSession = useCallback((songId: string) => {
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isAnalyzingPermutationImportance) {
            addLogMessage('Cannot remove songs while ANN work is running.', 'warn');
            return;
        }

        const songToRemove = songs.find(song => song.id === songId);
        if (!songToRemove) {
            addLogMessage('Song could not be found in the current ANN session.', 'warn');
            return;
        }

        let nextSongs = songs.filter(song => song.id !== songId);
        let nextNamedLists = Object.fromEntries(
            Object.entries(namedLists).map(([label, ids]) => {
                const nextIds = new Set(ids);
                nextIds.delete(songId);
                return [label, nextIds];
            })
        ) as Record<string, Set<string>>;

        if (songToRemove.source === 'user') {
            const result = removeUploadedTrainingSong({ songs, namedLists, songId });
            nextSongs = result.songs;
            nextNamedLists = result.namedLists;
            if (songToRemove.url.startsWith('blob:')) {
                URL.revokeObjectURL(songToRemove.url);
            }
            uploadedTrainingObjectUrlsRef.current.delete(songToRemove.url);
        }

        setSongs(nextSongs);
        setNamedLists(nextNamedLists);
        setSongFeatures({});
        setFeatureStatus({});
        setUnprocessedData(null);
        setProcessedData(null);
        setProcessingStats(null);
        setReducedDataPoints({});
        setReductionDimensions(0);
        setLatestFeatureStructure(null);
        setLatestCompletedStage(null);
        setVisualizationTargetStage(null);
        setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
        setCurrentEpoch(0);
        if (currentlyPlayingSongId === songId) {
            setCurrentlyPlayingSongId(null);
            setIsPlaying(false);
        }
        if (detailsSongId === songId) {
            setDetailsSongId(null);
        }
        invalidateModel('training song removed');
        addLogMessage(`Removed song from this ANN session: ${songToRemove.name}. Extract features again before training.`, 'complete');
    }, [
        addLogMessage,
        currentlyPlayingSongId,
        detailsSongId,
        invalidateModel,
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isProcessingData,
        isReducing,
        isTraining,
        namedLists,
        songs,
    ]);
    const handleUploadClick = () => { fileInputRef.current?.click(); };
    const handleToggleAboutDialog = () => { setIsAboutDialogOpen(prev => !prev); };

    // --- Memoized Values ---
    const allWorkersReady = useMemo(() => essentiaWorkerReady && dataProcessingWorkerReady && druidWorkerReady && mlpWorkerReady, [essentiaWorkerReady, dataProcessingWorkerReady, druidWorkerReady, mlpWorkerReady]);
    const annRouteLabelState = useMemo(() => getAnnRouteLabelState({ songs, namedLists }), [songs, namedLists]);
    const networkLabelNames = useMemo(() => Array.from(labelMap.keys()), [labelMap]);
    const nonEmptyLabelCount = annRouteLabelState.nonEmptyLabelCount;
    const assignedSongCount = annRouteLabelState.assignedSongCount;
    const labelsHaveEnoughExamples = annRouteLabelState.labelsHaveEnoughExamples;
    const labelDistribution = useMemo(() => getAnnLabelDistribution(namedLists), [namedLists]);
    const trainReadiness = useMemo(() => getAnnTrainReadiness({
        essentiaWorkerReady,
        dataProcessingWorkerReady,
        druidWorkerReady,
        mlpWorkerReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isInferring,
        nonEmptyLabelCount,
        assignedSongCount,
        labelsHaveEnoughExamples,
        hasFeatureMatrix: unprocessedData !== null,
    }), [
        essentiaWorkerReady,
        dataProcessingWorkerReady,
        druidWorkerReady,
        mlpWorkerReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isInferring,
        nonEmptyLabelCount,
        assignedSongCount,
        labelsHaveEnoughExamples,
        unprocessedData,
    ]);
    const canTrain = trainReadiness.canTrain;
    const trainDisabledReason = trainReadiness.reason;
    const reducedDataCount = useMemo(() => Object.keys(reducedDataPoints).length, [reducedDataPoints]);
    const datasetInferReadiness = useMemo(() => getAnnDatasetInferReadiness({
        essentiaWorkerReady,
        dataProcessingWorkerReady,
        druidWorkerReady,
        mlpWorkerReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isInferring,
        isModelTrained: hasUsableModel,
        labelMapSize: labelMap.size,
        hasTrainingPipelineSnapshot: trainingPipelineSnapshot !== null,
        trainingInputKind: trainingPipelineSnapshot?.inputKind ?? null,
        hasRawData: unprocessedData !== null,
        hasProcessedData: processedData !== null,
        hasReducedData: reducedDataCount > 0,
    }), [
        essentiaWorkerReady,
        dataProcessingWorkerReady,
        druidWorkerReady,
        mlpWorkerReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isInferring,
        hasUsableModel,
        labelMap.size,
        trainingPipelineSnapshot,
        unprocessedData,
        processedData,
        reducedDataCount,
    ]);
    const canInfer = datasetInferReadiness.canInfer;
    const inferDisabledReason = datasetInferReadiness.reason;
    const evaluationSummary = useMemo(() => (
        Object.keys(inferenceResults).length > 0
            ? getAnnEvaluationSummary({ namedLists, inferenceResults })
            : null
    ), [namedLists, inferenceResults]);
    const permutationImportanceDisabledReason = useMemo(() => {
        if (isAnalyzingPermutationImportance) return 'Feature impact analysis is already running.';
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating) {
            return 'Wait for current ANN process to finish.';
        }
        if (!mlpWorkerReady) return 'MLP worker is not ready.';
        if (!isModelTrained || !trainingPipelineSnapshot) {
            return 'Train or import a model before feature impact analysis.';
        }
        if (labelMap.size === 0) return 'Model label map is missing. Retrain or reimport the model.';
        if (!evaluationSummary || Object.keys(inferenceResults).length === 0) {
            return 'Run dataset inference before feature impact analysis.';
        }

        const inferenceInput = selectAnnDatasetInferenceInput({
            snapshot: trainingPipelineSnapshot,
            reducedDataPoints,
            processedData,
            unprocessedData,
        });
        return inferenceInput.selection ? null : inferenceInput.reason;
    }, [
        evaluationSummary,
        inferenceResults,
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isModelTrained,
        isProcessingData,
        isReducing,
        isTraining,
        isValidating,
        labelMap.size,
        mlpWorkerReady,
        processedData,
        reducedDataPoints,
        trainingPipelineSnapshot,
        unprocessedData,
    ]);
    const canRunPermutationImportance = permutationImportanceDisabledReason === null;

    const handleRunPermutationImportance = useCallback(async () => {
        if (permutationImportanceDisabledReason) {
            addLogMessage(permutationImportanceDisabledReason, 'warn');
            return;
        }
        if (!mlpWorkerRef.current || !trainingPipelineSnapshot || !evaluationSummary) {
            addLogMessage('Feature impact analysis is not ready. Run dataset inference first.', 'warn');
            return;
        }

        const inferenceInput = selectAnnDatasetInferenceInput({
            snapshot: trainingPipelineSnapshot,
            reducedDataPoints,
            processedData,
            unprocessedData,
        });
        if (!inferenceInput.selection) {
            addLogMessage(inferenceInput.reason, 'error');
            return;
        }

        const plan = createAnnPermutationImportancePlan({
            inputKind: inferenceInput.selection.inputKind,
            songIds: inferenceInput.selection.songIds,
            vectors: inferenceInput.selection.vectors,
            dimensionLabels: getAnnFeatureSignalDimensionLabels({
                inputKind: inferenceInput.selection.inputKind,
                inputDimension: inferenceInput.selection.inputDimension,
                rawColumnLabels: trainingPipelineSnapshot.rawMatrix.columnLabels,
                reductionMethod: trainingPipelineSnapshot.reduction?.method ?? null,
            }),
        });
        if (!plan) {
            addLogMessage('Feature impact analysis needs at least two comparable finite input rows.', 'warn');
            return;
        }

        permutationImportanceCancelRequestedRef.current = false;
        setIsAnalyzingPermutationImportance(true);
        setPermutationImportanceSummary(null);
        setPermutationImportanceError(null);
        addLogMessage(`Starting feature impact analysis for ${plan.tasks.length} input dimensions...`, 'info');

        const permutedResultsByDimension: AnnPermutationInferenceResultsByDimension = {};
        const labelMapObject = Object.fromEntries(labelMap);

        try {
            for (const task of plan.tasks) {
                if (permutationImportanceCancelRequestedRef.current) {
                    throw new Error(ANN_PERMUTATION_IMPORTANCE_CANCELLED_MESSAGE);
                }

                const requestId = createWorkerRequestId(`ann-permutation-${task.dimensionIndex}`);
                activeMlpRequestIdRef.current = requestId;
                const results = await sendWorkerRequest<AnnWorkerReply, unknown, Record<string, InferenceResult>>({
                    worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
                    requestId,
                    message: {
                        type: 'infer',
                        requestId,
                        payload: {
                            vectors: task.vectors,
                            songIds: task.songIds,
                            labelMap: labelMapObject,
                        },
                    },
                    successTypes: ['inferenceComplete'],
                    errorTypes: ['mlpError'],
                    progressTypes: ['activationSnapshot'],
                    onProgress: handleMlpProgress,
                    getResult: message => formatAnnMlpInferenceResults(message.payload),
                    getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Feature impact inference failed.'),
                    isRequestActive: isActiveMlpRequest,
                    onSettled: clearActiveMlpRequest,
                });
                if (permutationImportanceCancelRequestedRef.current) {
                    throw new Error(ANN_PERMUTATION_IMPORTANCE_CANCELLED_MESSAGE);
                }
                permutedResultsByDimension[task.dimensionIndex] = results;
            }

            const summary = getAnnPermutationImportanceSummary({
                plan,
                namedLists,
                baselineEvaluation: evaluationSummary,
                permutedResultsByDimension,
            });
            if (!summary) {
                throw new Error('Feature impact analysis did not produce comparable results.');
            }

            setPermutationImportanceSummary(summary);
            addLogMessage(`Feature impact analysis complete. ${summary.summary}`, 'complete');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (
                permutationImportanceCancelRequestedRef.current
                || errorMessage === ANN_PERMUTATION_IMPORTANCE_CANCELLED_MESSAGE
                || errorMessage.includes('is no longer active')
            ) {
                setPermutationImportanceError(null);
                addLogMessage(ANN_PERMUTATION_IMPORTANCE_CANCELLED_MESSAGE, 'warn');
                return;
            }
            setPermutationImportanceError(errorMessage);
            addLogMessage(`Feature impact analysis failed: ${errorMessage}`, 'error');
        } finally {
            permutationImportanceCancelRequestedRef.current = false;
            setIsAnalyzingPermutationImportance(false);
        }
    }, [
        addLogMessage,
        clearActiveMlpRequest,
        evaluationSummary,
        handleMlpProgress,
        isActiveMlpRequest,
        labelMap,
        namedLists,
        permutationImportanceDisabledReason,
        processedData,
        reducedDataPoints,
        trainingPipelineSnapshot,
        unprocessedData,
    ]);

    const handleCancelPermutationImportance = useCallback(() => {
        if (!isAnalyzingPermutationImportance) {
            addLogMessage('No feature impact analysis is running.', 'warn');
            return;
        }

        permutationImportanceCancelRequestedRef.current = true;
        activeMlpRequestIdRef.current = null;
        addLogMessage('Cancelling feature impact analysis...', 'warn');
    }, [addLogMessage, isAnalyzingPermutationImportance]);
    const permutationImportanceExportDisabledReason = useMemo(() => {
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance) {
            return 'Wait for current ANN process to finish before exporting feature impact.';
        }
        if (!trainingSummary) return 'Train a model before exporting feature impact.';
        if (!permutationImportanceSummary) return 'Run feature impact analysis before exporting.';
        return null;
    }, [
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isProcessingData,
        isReducing,
        isTraining,
        isValidating,
        permutationImportanceSummary,
        trainingSummary,
    ]);
    const canExportPermutationImportance = permutationImportanceExportDisabledReason === null;

    const handleExportPermutationImportance = useCallback(() => {
        if (!trainingSummary || !permutationImportanceSummary) {
            addLogMessage('Run feature impact analysis before exporting.', 'warn');
            return;
        }

        const exportedAt = new Date().toISOString();
        const comparisonRun = modelComparisonRuns.find(run => run.id === latestModelComparisonRunIdRef.current) ?? null;
        const payload = createAnnPermutationImportanceExportPayload({
            exportedAt,
            trainingSummary,
            permutationImportanceSummary,
            comparisonRun,
        });
        const filename = createAnnPermutationImportanceExportFilename({
            exportedAt,
            runNumber: comparisonRun?.runNumber ?? null,
        });
        downloadAnnPermutationImportanceExport({ payload, filename });
        addLogMessage('Exported feature impact summary.', 'complete');
    }, [addLogMessage, modelComparisonRuns, permutationImportanceSummary, trainingSummary]);
    const validationPlan = useMemo(() => {
        if (!trainingSummary) return null;

        const guidance = getAnnValidationGuidance({ trainingSummary, evaluationSummary });
        if (!guidance) return null;

        const items = Object.entries(namedLists).flatMap(([label, songIds]) => (
            Array.from(songIds, songId => ({ songId, label }))
        ));

        return createAnnValidationPlan({
            items,
            strategy: guidance.strategy,
            foldCount: guidance.foldCount,
            validationRatio: trainingSummary.validationRatio,
        });
    }, [trainingSummary, evaluationSummary, namedLists]);
    const validationExecutionPlan = useMemo(() => {
        if (!validationPlan?.plan || !networkConfig) return null;

        const trainingInput = selectAnnTrainingInput({
            useDimensionalityReduction,
            reducedDataPoints,
            processedData,
            unprocessedData,
        });
        if (!trainingInput.selection) {
            return { executionPlan: null, reason: trainingInput.reason };
        }

        const trainingDataset = createAnnTrainingDataset({
            source: trainingInput.selection,
            namedLists,
        });
        if (!trainingDataset.dataset) {
            return { executionPlan: null, reason: trainingDataset.reason };
        }

        return createAnnValidationExecutionPlan({
            validationPlan: validationPlan.plan,
            trainingDataset: trainingDataset.dataset,
            networkConfig: {
                config: {
                    layers: networkConfig.hiddenLayers,
                    nodes: networkConfig.nodesPerLayer,
                    activation: networkConfig.activation,
                    optimizer: networkConfig.optimizer,
                    learningRate: networkConfig.learningRate,
                },
                trainIterations: networkConfig.epochs,
                batchSize: networkConfig.batchSize,
                splitRatio: networkConfig.splitRatio,
                seed: trainingSummary?.seed,
            },
        });
    }, [validationPlan, networkConfig, useDimensionalityReduction, reducedDataPoints, processedData, unprocessedData, namedLists, trainingSummary]);
    const validationRunDisabledReason = useMemo(() => {
        if (isValidating) return 'Validation is already running.';
        if (isTraining || isInferring || isAnalyzingPermutationImportance) return 'Wait for current ANN process to finish.';
        if (!mlpWorkerReady) return 'MLP worker is not ready.';
        if (!validationExecutionPlan?.executionPlan) {
            return validationExecutionPlan?.reason ?? 'Train a model and prepare a validation plan before running validation.';
        }
        return null;
    }, [isAnalyzingPermutationImportance, isValidating, isTraining, isInferring, mlpWorkerReady, validationExecutionPlan]);
    const canRunValidation = validationRunDisabledReason === null;
    const validationExportDisabledReason = useMemo(() => {
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance) {
            return 'Wait for the current ANN process to finish before exporting validation.';
        }
        if (!trainingSummary) return 'Train a model before exporting validation.';
        if (!validationRunSummary || !validationRunFoldResults || validationRunFoldResults.length === 0) {
            return 'Run validation before exporting a summary.';
        }
        return null;
    }, [isAnalyzingPermutationImportance, isExtracting, isProcessingData, isReducing, isTraining, isInferring, isValidating, trainingSummary, validationRunSummary, validationRunFoldResults]);
    const canExportValidationSummary = validationExportDisabledReason === null;

    const handleRunValidation = useCallback(async () => {
        if (isValidating) {
            addLogMessage('Validation is already running.', 'warn');
            return;
        }
        if (!validationExecutionPlan?.executionPlan) {
            addLogMessage(validationExecutionPlan?.reason ?? 'Validation execution plan is not ready.', 'error');
            return;
        }
        if (isTraining || isInferring || isAnalyzingPermutationImportance) {
            addLogMessage('Wait for current ANN process to finish before running validation.', 'warn');
            return;
        }
        if (typeof Worker === 'undefined') {
            addLogMessage('Validation requires browser Worker support.', 'error');
            return;
        }

        const executionPlan = validationExecutionPlan.executionPlan;
        const validationWorker = new Worker(/* turbopackIgnore: true */ annWorkerAssets.mlp);
        setIsValidating(true);
        setValidationRunProgress(null);
        setValidationRunSummary(null);
        setValidationRunFoldResults(null);
        setValidationRunError(null);
        addLogMessage(`Starting validation run with ${executionPlan.foldCount} folds...`, 'info');

        try {
            const runResult = await runAnnValidationExecutionPlan({
                executionPlan,
                onFoldStart: fold => {
                    setValidationRunProgress({
                        currentFold: fold.foldNumber,
                        totalFolds: executionPlan.foldCount,
                        stage: 'train',
                    });
                },
                trainFold: async fold => {
                    setValidationRunProgress({
                        currentFold: fold.foldNumber,
                        totalFolds: executionPlan.foldCount,
                        stage: 'train',
                    });
                    const requestId = createWorkerRequestId(`ann-validation-train-${fold.foldNumber}`);
                    activeValidationRequestIdRef.current = requestId;
                    return await sendWorkerRequest<AnnWorkerReply, unknown, { finalMetrics?: { loss?: number; accuracy?: number } }>({
                        worker: validationWorker as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
                        requestId,
                        message: { type: 'train', requestId, payload: fold.trainPayload },
                        successTypes: ['trainingComplete'],
                        errorTypes: ['mlpError'],
                        getResult: message => {
                            if (!message.payload) throw new Error('Validation training returned no payload.');
                            return { finalMetrics: message.payload.finalMetrics };
                        },
                        getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Validation training failed.'),
                        isRequestActive: isActiveValidationRequest,
                        onSettled: clearActiveValidationRequest,
                    });
                },
                inferFold: async fold => {
                    setValidationRunProgress({
                        currentFold: fold.foldNumber,
                        totalFolds: executionPlan.foldCount,
                        stage: 'infer',
                    });
                    const requestId = createWorkerRequestId(`ann-validation-infer-${fold.foldNumber}`);
                    activeValidationRequestIdRef.current = requestId;
                    return await sendWorkerRequest<AnnWorkerReply, unknown, Record<string, InferenceResult>>({
                        worker: validationWorker as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
                        requestId,
                        message: { type: 'infer', requestId, payload: fold.inferPayload },
                        successTypes: ['inferenceComplete'],
                        errorTypes: ['mlpError'],
                        getResult: message => formatAnnMlpInferenceResults(message.payload),
                        getErrorMessage: message => getAnnWorkerErrorMessage(message, 'Validation inference failed.'),
                        isRequestActive: isActiveValidationRequest,
                        onSettled: clearActiveValidationRequest,
                    });
                },
            });
            setValidationRunSummary(runResult.summary);
            setValidationRunFoldResults(runResult.foldResults);
            setModelComparisonRuns(previousRuns => updateAnnModelComparisonRunValidation({
                runs: previousRuns,
                runId: latestModelComparisonRunIdRef.current,
                validationSummary: runResult.summary,
            }));
            setValidationRunProgress(null);
            const accuracyText = runResult.summary.accuracy === null
                ? 'n/a'
                : `${(runResult.summary.accuracy * 100).toFixed(2)}%`;
            addLogMessage(`Validation run complete. Accuracy: ${accuracyText}`, 'complete');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setValidationRunError(errorMessage);
            setValidationRunProgress(null);
            addLogMessage(`Validation run failed: ${errorMessage}`, 'error');
        } finally {
            activeValidationRequestIdRef.current = null;
            validationWorker.terminate();
            setIsValidating(false);
        }
    }, [
        addLogMessage,
        clearActiveValidationRequest,
        isAnalyzingPermutationImportance,
        isActiveValidationRequest,
        isInferring,
        isTraining,
        isValidating,
        validationExecutionPlan,
    ]);

    const handleExportValidationSummary = useCallback(() => {
        if (!trainingSummary || !validationRunSummary || !validationRunFoldResults || validationRunFoldResults.length === 0) {
            addLogMessage('Run validation before exporting a summary.', 'warn');
            return;
        }

        const exportedAt = new Date().toISOString();
        const comparisonRun = modelComparisonRuns.find(run => run.id === latestModelComparisonRunIdRef.current) ?? null;
        const payload = createAnnValidationExportPayload({
            exportedAt,
            trainingSummary,
            validationSummary: validationRunSummary,
            foldResults: validationRunFoldResults,
            comparisonRun,
        });
        const filename = createAnnValidationExportFilename({
            exportedAt,
            runNumber: comparisonRun?.runNumber ?? null,
        });
        downloadAnnValidationExport({ payload, filename });
        addLogMessage('Exported validation summary.', 'complete');
    }, [addLogMessage, modelComparisonRuns, trainingSummary, validationRunFoldResults, validationRunSummary]);

    const handleExportTrainedModel = useCallback(() => {
        if (!mlpWorkerRef.current || !mlpWorkerReady) {
            addLogMessage('[ANN Model] MLP worker is not ready.', 'warn');
            return;
        }
        if (!isModelTrained || !trainingSummary || !trainingPipelineSnapshot || !trainedModelInputData) {
            addLogMessage('[ANN Model] Train a model before exporting a portable trained model file.', 'warn');
            return;
        }
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance) {
            addLogMessage('[ANN Model] Wait for current ANN work to finish before exporting a trained model.', 'warn');
            return;
        }

        const requestId = createWorkerRequestId('ann-export-trained-model');
        activeMlpRequestIdRef.current = requestId;
        sendWorkerRequest<AnnWorkerReply, unknown, any>({
            worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
            requestId,
            message: { type: 'exportModel', requestId },
            successTypes: ['modelExportComplete'],
            errorTypes: ['mlpError'],
            getResult: message => {
                if (!message.payload?.modelArtifacts || !Array.isArray(message.payload.outputLabels)) {
                    throw new Error('MLP model export returned an invalid payload.');
                }
                return message.payload;
            },
            getErrorMessage: message => getAnnWorkerErrorMessage(message, 'MLP model export failed.'),
            isRequestActive: isActiveMlpRequest,
            onSettled: clearActiveMlpRequest,
        }).then(workerPayload => {
            const exportedAt = new Date().toISOString();
            const comparisonRun = modelComparisonRuns.find(run => run.id === latestModelComparisonRunIdRef.current) ?? null;
            const payload = createAnnTrainedModelExportPayload({
                exportedAt,
                trainingSummary,
                pipelineSnapshot: trainingPipelineSnapshot,
                modelInput: trainedModelInputData,
                namedLists,
                modelArtifacts: workerPayload.modelArtifacts,
                outputLabels: workerPayload.outputLabels,
                comparisonRun,
            });
            const filename = createAnnTrainedModelExportFilename({
                exportedAt,
                runNumber: comparisonRun?.runNumber ?? null,
            });
            downloadAnnTrainedModelExport({ payload, filename });
            addLogMessage('[ANN Model] Exported trained model, weights, and pipeline snapshot.', 'complete');
        }).catch(error => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLogMessage(`[ANN Model] Could not export trained model: ${errorMessage}`, 'error');
        });
    }, [
        addLogMessage,
        clearActiveMlpRequest,
        isActiveMlpRequest,
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isModelTrained,
        isProcessingData,
        isReducing,
        isTraining,
        isValidating,
        mlpWorkerReady,
        modelComparisonRuns,
        namedLists,
        trainedModelInputData,
        trainingPipelineSnapshot,
        trainingSummary,
    ]);

    const handleOpenTrainedModelImport = useCallback(() => {
        trainedModelImportInputRef.current?.click();
    }, []);

    const handleImportTrainedModelFile = useCallback(async (file: File | null) => {
        if (!file) return;
        if (!mlpWorkerRef.current || !mlpWorkerReady) {
            addLogMessage('[ANN Model] MLP worker is not ready.', 'warn');
            return;
        }
        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance) {
            addLogMessage('[ANN Model] Cannot import a trained model while ANN work is running.', 'warn');
            return;
        }

        try {
            const raw = await file.text();
            const parsed = parseAnnTrainedModelImportPayload(raw);
            if (!parsed.ok) {
                addLogMessage(`[ANN Model] Could not import trained model: ${parsed.reason}`, 'warn');
                return;
            }

            const requestId = createWorkerRequestId('ann-import-trained-model');
            activeMlpRequestIdRef.current = requestId;
            const importResult = await sendWorkerRequest<AnnWorkerReply, unknown, { outputLabels: string[]; modelStateSnapshot?: AnnModelStateSnapshot }>({
                worker: mlpWorkerRef.current as unknown as WorkerRequestTarget<AnnWorkerReply, unknown>,
                requestId,
                message: {
                    type: 'importModel',
                    requestId,
                    payload: {
                        modelArtifacts: parsed.modelArtifacts,
                        outputLabels: parsed.outputLabels,
                    },
                },
                successTypes: ['modelImportComplete'],
                errorTypes: ['mlpError'],
                getResult: message => {
                    if (!Array.isArray(message.payload?.outputLabels)) {
                        throw new Error('MLP model import returned an invalid payload.');
                    }
                    return message.payload;
                },
                getErrorMessage: message => getAnnWorkerErrorMessage(message, 'MLP model import failed.'),
                isRequestActive: isActiveMlpRequest,
                onSettled: clearActiveMlpRequest,
            });

            const orderedLabelEntries = Object.entries(parsed.pipelineSnapshot.labelMap)
                .sort(([, left], [, right]) => left - right);
            const importedNamedLists = parsed.labelAssignments
                ? Object.fromEntries(
                    Object.entries(parsed.labelAssignments.namedLists).map(([label, songIds]) => [
                        label,
                        new Set(songIds),
                    ])
                )
                : null;
            const modelInputBySongId = Object.fromEntries(
                parsed.modelInput.songIds.map((songId, index) => [songId, parsed.modelInput.vectors[index]])
            );
            const importedStage: ProcessingStage = parsed.modelInput.inputKind === 'reduced'
                ? 'reduced'
                : parsed.modelInput.inputKind === 'processed'
                    ? 'processed'
                    : 'features';
            const importedFeatureSignalRows = parsed.labelAssignments
                ? getAnnFeatureSignalRowsForSongAssignments({
                    songIds: parsed.modelInput.songIds,
                    vectors: parsed.modelInput.vectors,
                    namedLists: parsed.labelAssignments.namedLists,
                })
                : null;
            const importedFeatureSignalSummary = importedFeatureSignalRows
                ? getAnnFeatureSignalSummary({
                    inputKind: parsed.modelInput.inputKind,
                    vectors: importedFeatureSignalRows.vectors,
                    labels: importedFeatureSignalRows.labels,
                    dimensionLabels: getAnnFeatureSignalDimensionLabels({
                        inputKind: parsed.modelInput.inputKind,
                        inputDimension: parsed.pipelineSnapshot.inputDimension,
                        rawColumnLabels: parsed.pipelineSnapshot.rawMatrix.columnLabels,
                        reductionMethod: parsed.pipelineSnapshot.reduction?.method ?? null,
                    }),
                })
                : null;

            setTrainingPipelineSnapshot(parsed.pipelineSnapshot);
            setTrainedModelInputData(parsed.modelInput);
            setTrainingSummary(parsed.trainingSummary);
            setFeatureSignalSummary(importedFeatureSignalSummary);
            if (importedNamedLists) {
                setNamedLists(importedNamedLists);
            }
            setSelectedFeatures(new Set(parsed.pipelineSnapshot.selectedFeatureIds));
            setNetworkConfig({
                hiddenLayers: parsed.trainingSummary.hiddenLayers,
                nodesPerLayer: [...parsed.trainingSummary.nodesPerLayer],
                activation: parsed.trainingSummary.activation as MLPConfig['activation'],
                optimizer: parsed.trainingSummary.optimizer as MLPConfig['optimizer'],
                learningRate: parsed.trainingSummary.learningRate,
                epochs: parsed.trainingSummary.epochs,
                splitRatio: parsed.trainingSummary.splitRatio,
                batchSize: parsed.trainingSummary.batchSize,
                randomSeed: parsed.trainingSummary.seed,
            });
            setLabelMap(new Map(orderedLabelEntries));
            setInputDimension(parsed.pipelineSnapshot.inputDimension);
            setOutputDimension(parsed.outputLabels.length);
            setUnprocessedData(parsed.pipelineSnapshot.rawMatrix);
            setLatestFeatureStructure(parsed.pipelineSnapshot.rawStructure);
            setProcessingStats(parsed.pipelineSnapshot.processingStats);
            setProcessedData(parsed.modelInput.inputKind === 'processed'
                ? {
                    songIds: [...parsed.modelInput.songIds],
                    vectors: parsed.modelInput.vectors.map(vector => [...vector]),
                }
                : null);
            setReducedDataPoints(parsed.modelInput.inputKind === 'reduced' ? modelInputBySongId : {});
            setReductionDimensions(parsed.pipelineSnapshot.reduction?.dimensions ?? 0);
            if (parsed.pipelineSnapshot.processingStats) {
                setProcessingMethod(parsed.pipelineSnapshot.processingStats.method);
            }
            if (parsed.pipelineSnapshot.reduction) {
                setUseDimensionalityReduction(true);
                setReductionMethod(parsed.pipelineSnapshot.reduction.method);
                setTargetDimensions(parsed.pipelineSnapshot.reduction.dimensions);
            } else {
                setUseDimensionalityReduction(false);
            }
            setLatestCompletedStage(importedStage);
            setVisualizationTargetStage(importedStage);
            setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
            setCurrentEpoch(0);
            setInferenceResults({});
            setUploadedInferenceResult(null);
            setUploadedInferenceError(null);
            setIsAnalyzingPermutationImportance(false);
            setPermutationImportanceSummary(null);
            setPermutationImportanceError(null);
            setValidationRunProgress(null);
            setValidationRunSummary(null);
            setValidationRunFoldResults(null);
            setValidationRunError(null);
            setActivationSnapshot(null);
            setModelStateSnapshot(importResult.modelStateSnapshot ?? null);
            setTrainingPhaseSnapshot(null);
            setTrainingSessionStatus(null);
            setIsTrainingSessionActive(false);
            trainingRunContextRef.current = null;
            setIsModelTrained(true);
            setTrainedModelContextSource('imported');
            const importedComparisonRun = parsed.comparisonRun;
            if (importedComparisonRun) {
                latestModelComparisonRunIdRef.current = importedComparisonRun.id;
                setModelComparisonRuns(previousRuns => [
                    ...previousRuns.filter(run => run.id !== importedComparisonRun.id),
                    importedComparisonRun,
                ]);
            } else {
                latestModelComparisonRunIdRef.current = null;
            }
            addLogMessage(`[ANN Model] Imported trained ${parsed.trainingSummary.inputKind} model with ${parsed.outputLabels.length} output labels.${parsed.labelAssignments ? ` Restored ${parsed.labelAssignments.assignedSongCount} label assignment${parsed.labelAssignments.assignedSongCount === 1 ? '' : 's'}.` : ''}${importedComparisonRun ? ` Restored comparison review context for run ${importedComparisonRun.runNumber}.` : ''}`, 'complete');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLogMessage(`[ANN Model] Could not import trained model: ${errorMessage}`, 'error');
        }
    }, [
        addLogMessage,
        clearActiveMlpRequest,
        isActiveMlpRequest,
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isProcessingData,
        isReducing,
        isTraining,
        isValidating,
        mlpWorkerReady,
    ]);

    const handleExportAnnSetup = useCallback(() => {
        if (!networkConfig) {
            addLogMessage('[ANN Setup] Configure the network before exporting setup.', 'warn');
            return;
        }

        const exportedAt = new Date().toISOString();
        const payload = createAnnSetupExportPayload({
            exportedAt,
            namedLists,
            selectedFeatures,
            processingMethod,
            useDimensionalityReduction,
            reductionMethod,
            targetDimensions,
            networkConfig,
            persistableSongIds: DEFAULT_SONG_IDS,
            songs,
        });
        const filename = createAnnSetupExportFilename({ exportedAt });
        downloadAnnSetupExport({ payload, filename });
        const uploadedIdentityMessage = payload.externalDataset.userSongCount > 0
            ? ` Included ${payload.externalDataset.userSongCount} uploaded song identit${payload.externalDataset.userSongCount === 1 ? 'y' : 'ies'} for reattachment.`
            : '';
        addLogMessage(`[ANN Setup] Exported ${payload.assignedSongCount} default-song assignment${payload.assignedSongCount === 1 ? '' : 's'} across ${payload.labelCount} label${payload.labelCount === 1 ? '' : 's'}.${uploadedIdentityMessage}`, 'complete');
    }, [
        addLogMessage,
        namedLists,
        networkConfig,
        processingMethod,
        reductionMethod,
        selectedFeatures,
        songs,
        targetDimensions,
        useDimensionalityReduction,
    ]);

    const handleOpenAnnSetupImport = useCallback(() => {
        annSetupImportInputRef.current?.click();
    }, []);

    const handleOpenUploadedDatasetReattach = useCallback(() => {
        if (!pendingUploadedDatasetManifest || pendingUploadedDatasetManifest.userSongCount === 0) {
            addLogMessage('[ANN Setup] Import setup with uploaded-song identities before reattaching files.', 'warn');
            return;
        }

        annUploadedDatasetReattachInputRef.current?.click();
    }, [addLogMessage, pendingUploadedDatasetManifest]);

    const handleImportAnnSetupFile = useCallback(async (file: File | null) => {
        if (!file) return;

        try {
            const raw = await file.text();
            const result = parseAnnSetupImportPayload(raw, DEFAULT_SONG_IDS);
            if (!result.ok) {
                addLogMessage(`[ANN Setup] Could not import setup: ${result.reason}`, 'warn');
                return;
            }

            setNamedLists(result.setup.namedLists);
            setSelectedFeatures(result.setup.selectedFeatures);
            setProcessingMethod(result.setup.processingMethod);
            setUseDimensionalityReduction(result.setup.useDimensionalityReduction);
            setReductionMethod(result.setup.reductionMethod);
            setTargetDimensions(result.setup.targetDimensions);
            setNetworkConfig(result.setup.networkConfig);
            setUnprocessedData(null);
            setProcessedData(null);
            setProcessingStats(null);
            setReducedDataPoints({});
            setReductionDimensions(0);
            setLatestFeatureStructure(null);
            setInputDimension(0);
            setLatestCompletedStage(null);
            setVisualizationTargetStage(null);
            setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
            setCurrentEpoch(0);
            invalidateModel('setup import changed labels or pipeline settings');
            const uploadedDatasetManifest = result.externalDataset && result.externalDataset.userSongCount > 0
                ? result.externalDataset
                : null;
            setPendingUploadedDatasetManifest(uploadedDatasetManifest);
            setUploadedDatasetReattachmentReview(null);

            const assignedSongCount = new Set(
                Object.values(result.setup.namedLists).flatMap(songIds => Array.from(songIds))
            ).size;
            const reattachMessage = uploadedDatasetManifest
                ? ` ${uploadedDatasetManifest.userSongCount} uploaded song${uploadedDatasetManifest.userSongCount === 1 ? '' : 's'} ${uploadedDatasetManifest.userSongCount === 1 ? 'needs' : 'need'} file reattachment.`
                : '';
            addLogMessage(`[ANN Setup] Imported ${assignedSongCount} default-song assignment${assignedSongCount === 1 ? '' : 's'} across ${Object.keys(result.setup.namedLists).length} label${Object.keys(result.setup.namedLists).length === 1 ? '' : 's'}.${reattachMessage} Re-extract features before training.`, 'complete');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLogMessage(`[ANN Setup] Could not import setup: ${errorMessage}`, 'warn');
        }
    }, [addLogMessage, invalidateModel]);

    const handleReattachUploadedDatasetFiles = useCallback((fileList: FileList | null) => {
        const files = Array.from(fileList ?? []);
        if (files.length === 0) return;

        if (!pendingUploadedDatasetManifest || pendingUploadedDatasetManifest.userSongCount === 0) {
            addLogMessage('[ANN Setup] No uploaded dataset manifest is waiting for reattachment.', 'warn');
            return;
        }

        if (isExtracting || isProcessingData || isReducing || isTraining || isInferring || isValidating || isAnalyzingPermutationImportance) {
            addLogMessage('[ANN Setup] Cannot reattach uploaded dataset files while ANN work is running.', 'warn');
            return;
        }

        const result = reattachUploadedDatasetManifestFiles<File>({
            existingSongs: songs,
            namedLists,
            manifest: pendingUploadedDatasetManifest,
            files,
            createObjectUrl: file => URL.createObjectURL(file),
        });
        setUploadedDatasetReattachmentReview({
            attachedNames: result.attachedSongs.map(song => song.name),
            missingNames: result.missing.map(song => song.name),
            unmatchedFileNames: result.unmatchedFiles.map(item => item.file.name),
            skippedNames: result.skipped.map(skip => skip.name),
            attachedFiles: result.attachedSongs.map(song => ({
                name: song.name,
                externalId: song.externalId,
            })),
            missingFiles: result.missing.map(song => ({
                name: song.name,
                externalId: song.externalId,
            })),
            unmatchedFiles: result.unmatchedFiles.map(item => ({
                name: item.file.name,
                externalId: item.externalId,
            })),
            skippedFiles: result.skipped.map(skip => ({
                name: skip.name,
            })),
        });

        result.skipped.forEach(skip => {
            addLogMessage(getTrainingUploadSkipMessage(skip.name, skip.reason), 'warn');
        });

        if (result.unmatchedFiles.length > 0) {
            addLogMessage(`[ANN Setup] Ignored ${result.unmatchedFiles.length} selected file${result.unmatchedFiles.length === 1 ? '' : 's'} that did not match imported uploaded-song metadata.`, 'warn');
        }

        if (result.attachedSongs.length > 0) {
            result.attachedSongs.forEach(song => uploadedTrainingObjectUrlsRef.current.add(song.url));
            setSongs(result.songs);
            setNamedLists(result.namedLists);
            setSongFeatures({});
            setFeatureStatus({});
            setUnprocessedData(null);
            setProcessedData(null);
            setProcessingStats(null);
            setReducedDataPoints({});
            setReductionDimensions(0);
            setLatestFeatureStructure(null);
            setLatestCompletedStage(null);
            setVisualizationTargetStage(null);
            setTrainingHistory({ loss: [], acc: [], valLoss: [], valAcc: [] });
            setCurrentEpoch(0);
            invalidateModel('uploaded dataset reattached');
            addLogMessage(`[ANN Setup] Reattached ${result.attachedSongs.length} uploaded training song${result.attachedSongs.length === 1 ? '' : 's'}. Extract features again before training.`, 'complete');
        }

        const remainingManifest = createPendingUploadedDatasetManifest(result.missing);
        setPendingUploadedDatasetManifest(remainingManifest);
        if (remainingManifest) {
            const previewNames = remainingManifest.songs.slice(0, 3).map(song => song.name).join(', ');
            const overflowCount = Math.max(0, remainingManifest.songs.length - 3);
            addLogMessage(`[ANN Setup] ${remainingManifest.userSongCount} uploaded song${remainingManifest.userSongCount === 1 ? '' : 's'} still need reattachment: ${previewNames}${overflowCount > 0 ? `, +${overflowCount} more` : ''}.`, 'warn');
        } else if (result.attachedSongs.length === 0 && result.unmatchedFiles.length === 0 && result.skipped.length === 0) {
            addLogMessage('[ANN Setup] No uploaded files were reattached.', 'warn');
        }
    }, [
        addLogMessage,
        invalidateModel,
        isAnalyzingPermutationImportance,
        isExtracting,
        isInferring,
        isProcessingData,
        isReducing,
        isTraining,
        isValidating,
        namedLists,
        pendingUploadedDatasetManifest,
        songs,
    ]);

    const handleContinueWithAttachedUploadedDataset = useCallback(() => {
        if (!uploadedDatasetReattachmentReview) {
            addLogMessage('[ANN Setup] Reattach at least one uploaded file before continuing with a partial uploaded dataset.', 'warn');
            return;
        }

        const attachedCount = uploadedDatasetReattachmentReview.attachedFiles?.length ?? uploadedDatasetReattachmentReview.attachedNames.length;
        const missingCount = uploadedDatasetReattachmentReview.missingFiles?.length ?? uploadedDatasetReattachmentReview.missingNames.length;
        const extraCount = uploadedDatasetReattachmentReview.unmatchedFiles?.length ?? uploadedDatasetReattachmentReview.unmatchedFileNames.length;
        const skippedCount = uploadedDatasetReattachmentReview.skippedFiles?.length ?? uploadedDatasetReattachmentReview.skippedNames.length;
        const attentionCount = missingCount + extraCount + skippedCount;

        if (attachedCount === 0) {
            addLogMessage('[ANN Setup] No uploaded files are attached yet. Reattach matching files before continuing.', 'warn');
            return;
        }

        setPendingUploadedDatasetManifest(null);
        setUploadedDatasetReattachmentReview({
            ...uploadedDatasetReattachmentReview,
            continuedWithAttached: true,
        });
        addLogMessage(`[ANN Setup] Continuing with ${attachedCount} reattached uploaded training song${attachedCount === 1 ? '' : 's'}. ${attentionCount} selected item${attentionCount === 1 ? '' : 's'} ${attentionCount === 1 ? 'was' : 'were'} left out. Re-extract features before training.`, attentionCount > 0 ? 'warn' : 'complete');
    }, [addLogMessage, uploadedDatasetReattachmentReview]);

    const handleExportModelComparisonHistory = useCallback(() => {
        if (modelComparisonRuns.length === 0) {
            addLogMessage('Train at least one model before exporting comparison history.', 'warn');
            return;
        }

        const exportedAt = new Date().toISOString();
        const payload = createAnnModelComparisonExportPayload({
            exportedAt,
            runs: modelComparisonRuns,
        });
        const filename = createAnnModelComparisonExportFilename({ exportedAt });
        downloadAnnModelComparisonExport({ payload, filename });
        addLogMessage(`Exported ${modelComparisonRuns.length} comparison run${modelComparisonRuns.length === 1 ? '' : 's'}.`, 'complete');
    }, [addLogMessage, modelComparisonRuns]);

    const handleOpenModelComparisonImport = useCallback(() => {
        comparisonImportInputRef.current?.click();
    }, []);

    const handleImportModelComparisonFile = useCallback(async (file: File | null) => {
        if (!file) return;

        try {
            const raw = await file.text();
            const result = parseAnnModelComparisonImportPayload(raw);
            if (!result.ok) {
                addLogMessage(`[ANN Comparison] Could not import comparison history: ${result.reason}`, 'warn');
                return;
            }

            setModelComparisonRuns(result.runs);
            latestModelComparisonRunIdRef.current = null;
            addLogMessage(`[ANN Comparison] Imported ${result.runs.length} comparison run${result.runs.length === 1 ? '' : 's'}. Train again before updating imported rows.`, 'complete');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLogMessage(`[ANN Comparison] Could not import comparison history: ${errorMessage}`, 'warn');
        }
    }, [addLogMessage]);

    const handleApplyModelComparisonSetup = useCallback(() => {
        const suggestion = getAnnModelComparisonSetupSuggestion(modelComparisonRuns);
        if (!suggestion.canApplySetup || !suggestion.settings || suggestion.targetInputKind === null) {
            addLogMessage('[ANN Comparison] All input pipelines have evaluated runs. Compare the existing results before changing setup.', 'info');
            return;
        }

        setProcessingMethod(suggestion.settings.processingMethod);
        setUseDimensionalityReduction(suggestion.settings.useDimensionalityReduction);
        setReductionMethod(suggestion.settings.reductionMethod);
        setTargetDimensions(suggestion.settings.targetDimensions);

        if (suggestion.clearsProcessedData) {
            setProcessedData(null);
            setProcessingStats(null);
        }
        if (suggestion.clearsReducedData) {
            setReducedDataPoints({});
            setReductionDimensions(0);
        }

        setLatestCompletedStage(unprocessedData ? 'features' : null);
        setVisualizationTargetStage(unprocessedData ? 'features' : null);
        invalidateModel(`comparison setup changed to ${suggestion.targetInputKind}`);
        addLogMessage(`[ANN Comparison] ${suggestion.summary} ${suggestion.nextStep}`, 'complete');
    }, [addLogMessage, invalidateModel, modelComparisonRuns, unprocessedData]);

    const handleUpdateModelComparisonReview = useCallback((
        runId: string,
        reviewStatus: AnnModelComparisonReviewStatus,
        note: string
    ) => {
        setModelComparisonRuns(previousRuns => updateAnnModelComparisonRunReview({
            runs: previousRuns,
            runId,
            reviewStatus,
            note,
        }));
        const run = modelComparisonRuns.find(candidate => candidate.id === runId);
        addLogMessage(`[ANN Comparison] Marked Run ${run?.runNumber ?? runId} as ${reviewStatus}${note.trim() ? ' and updated its review note' : ''}.`, 'complete');
    }, [addLogMessage, modelComparisonRuns]);

    const handleDeleteModelComparisonRun = useCallback((runId: string) => {
        const run = modelComparisonRuns.find(candidate => candidate.id === runId);
        if (!run) {
            addLogMessage('[ANN Comparison] The selected comparison run no longer exists.', 'warn');
            return;
        }

        setModelComparisonRuns(previousRuns => removeAnnModelComparisonRun({
            runs: previousRuns,
            runId,
        }));
        if (latestModelComparisonRunIdRef.current === runId) {
            latestModelComparisonRunIdRef.current = null;
        }
        addLogMessage(`[ANN Comparison] Deleted Run ${run.runNumber} from comparison history.`, 'complete');
    }, [addLogMessage, modelComparisonRuns]);

    const uploadedInferBase = {
        essentiaWorkerReady,
        dataProcessingWorkerReady,
        druidWorkerReady,
        mlpWorkerReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isInferring: isInferring || isAnalyzingPermutationImportance,
        isModelTrained: hasUsableModel,
        hasTrainingPipelineSnapshot: trainingPipelineSnapshot !== null,
        trainingInputKind: trainingPipelineSnapshot?.inputKind ?? null,
        hasAudioContext: audioContextRef.current !== null,
        hasProcessingStats: Boolean(trainingPipelineSnapshot?.processingStats),
        hasReductionSnapshot: Boolean(trainingPipelineSnapshot?.reduction),
        reductionMethod: trainingPipelineSnapshot?.reduction?.method ?? null,
        reductionSourceKind: trainingPipelineSnapshot?.reduction?.sourceKind ?? null,
    };
    const uploadedFileReadiness = getAnnUploadedInferReadiness({
        ...uploadedInferBase,
        hasInferenceFile: true,
    });
    const uploadedInferReadiness = getAnnUploadedInferReadiness({
        ...uploadedInferBase,
        hasInferenceFile: uploadedInferenceFile !== null,
    });
    const canChooseInferenceFile = uploadedFileReadiness.canInfer;
    const inferenceFileDisabledReason = uploadedFileReadiness.reason;
    const canInferUploadedAudio = uploadedInferReadiness.canInfer;
    const uploadedInferDisabledReason = uploadedInferReadiness.reason;

    // NEW: Memoized variable for any running process
    const isAnyProcessRunning = useMemo(() =>
        isExtracting || isProcessingData || isReducing || isTraining || isTrainingSessionActive || isInferring || isValidating || isAnalyzingPermutationImportance,
        [isAnalyzingPermutationImportance, isExtracting, isProcessingData, isReducing, isTraining, isTrainingSessionActive, isInferring, isValidating]
    );
    const annProcessStatus = useMemo(() => getAnnProcessStatus({
        allWorkersReady,
        isExtracting,
        isProcessingData,
        isReducing,
        isTraining,
        isTrainingSessionActive,
        isInferring,
        isValidating,
        isAnalyzingPermutationImportance,
    }), [allWorkersReady, isAnalyzingPermutationImportance, isExtracting, isProcessingData, isReducing, isTraining, isTrainingSessionActive, isInferring, isValidating]);

    const canContinueTraining = isModelTrained
        && trainedModelContextSource === 'trained'
        && trainingRunContextRef.current !== null
        && trainingSessionStatus !== null
        && trainingSessionStatus.completedEpochs >= trainingSessionStatus.targetEpochs;
    const continueTrainingDisabledReason = canContinueTraining
        ? null
        : trainedModelContextSource === 'imported'
            ? 'Imported models do not include the optimizer and training rows needed to continue.'
            : !isModelTrained
                ? 'Complete a local training target before adding epochs.'
                : 'The local training session is no longer available.';

    const trainedModelExportDisabledReason = useMemo(() => {
        if (!mlpWorkerReady) return 'MLP worker is not ready.';
        if (isAnyProcessRunning) return 'Wait for current ANN work to finish before exporting it.';
        if (!isModelTrained) return 'Train a model before exporting it.';
        if (!trainingSummary || !trainingPipelineSnapshot || !trainedModelInputData) {
            return 'Training metadata is missing. Retrain before exporting the model.';
        }
        return null;
    }, [isAnyProcessRunning, isModelTrained, mlpWorkerReady, trainedModelInputData, trainingPipelineSnapshot, trainingSummary]);
    const canExportTrainedModel = trainedModelExportDisabledReason === null;
    const trainedModelImportDisabledReason = !mlpWorkerReady
        ? 'MLP worker is not ready.'
        : isAnyProcessRunning
            ? 'Wait for current ANN work to finish before importing a trained model.'
            : null;

    // Get available feature keys for Visualization Panel
    const availableFeatureKeys = useMemo(() => {
        const firstSongWithFeatures = songs.find(song => songFeatures[song.id]);
        if (!firstSongWithFeatures) return null;
        const features = songFeatures[firstSongWithFeatures.id];
        return features ? Object.keys(features) : null;
    }, [songs, songFeatures]);

    const canExportRawFeatures = useMemo(() => {
        if (!unprocessedData) return false;
        const { vectors, columnLabels, isOHEColumn } = unprocessedData;
        if (vectors.length === 0 || !vectors[0]?.length) return false;
        const n = vectors[0].length;
        return columnLabels.length === n && isOHEColumn.length === n;
    }, [unprocessedData]);

    const exportColumnLabels = useMemo(() => unprocessedData?.columnLabels ?? [], [unprocessedData]);

    const handleExportRawFeatures = useCallback((selectedIndices: number[], format: ExportFormat) => {
        if (!unprocessedData) return;
        downloadRawFeatureMatrixExport({
            songs,
            songIds: unprocessedData.songIds,
            vectors: unprocessedData.vectors,
            columnLabels: unprocessedData.columnLabels,
            selectedIndices,
            format,
            filenameBase: 'musiccluster-ann-raw-features',
        });
        addLogMessage(`Exported raw features (${format.toUpperCase()}).`, 'complete');
    }, [unprocessedData, songs, addLogMessage]);

    // Determine the stage to show in the visualization panel
    const [visualizationDisplayStage, setVisualizationDisplayStage] = useState<ProcessingStage | null>(null);

    useEffect(() => {
        let stage: ProcessingStage | null = null;
        // Determine stage based on available data, ANN page doesn't use kmeans
        if (Object.keys(reducedDataPoints).length > 0) stage = 'reduced';
        else if (processedData) stage = 'processed';
        else if (hasCurrentFeatureRows) stage = 'features';
        setVisualizationDisplayStage(stage);
    }, [hasCurrentFeatureRows, processedData, reducedDataPoints]);

    // --- NEW: Audio Player Callbacks ---
    // Helper to get song name by ID for logging
    const getSongNameById = useCallback((id: string): string => {
        return songs.find(s => s.id === id)?.name || id; // Return ID if name not found
    }, [songs]);

    const handlePlayRequest = useCallback((songId: string) => {
        addLogMessage(`Play requested for song: ${getSongNameById(songId)}`, 'info');
        setCurrentlyPlayingSongId(songId);
        setIsPlaying(true);
    }, [addLogMessage, getSongNameById]);

    const handleTogglePlayPause = useCallback(() => {
        if (currentlyPlayingSongId) {
            setIsPlaying(prev => {
                const newState = !prev;
                addLogMessage(newState ? `Playing song: ${getSongNameById(currentlyPlayingSongId)}` : `Paused song: ${getSongNameById(currentlyPlayingSongId)}`, 'info');
                return newState;
            });
        } else {
            addLogMessage('Toggle play/pause requested but no song selected.', 'info');
        }
    }, [addLogMessage, currentlyPlayingSongId, getSongNameById]);

    const handleSongEnd = useCallback(() => {
        if (currentlyPlayingSongId) {
            addLogMessage(`Song finished: ${getSongNameById(currentlyPlayingSongId)}`, 'complete');
            setIsPlaying(false);
            // Optionally clear the song or move to next:
            // setCurrentlyPlayingSongId(null);
        }
    }, [addLogMessage, currentlyPlayingSongId, getSongNameById]);

    // --- NEW: Memoize currently playing song object ---
    const currentlyPlayingSong = useMemo(() => {
        return songs.find(s => s.id === currentlyPlayingSongId) ?? null;
    }, [currentlyPlayingSongId, songs]);
    const detailsSong = useMemo(() => {
        return songs.find(song => song.id === detailsSongId) ?? null;
    }, [detailsSongId, songs]);
    // -----------------------------------------------

    // --- Render ---
    return (
        <main
            className="flex min-h-screen flex-col p-4 bg-gray-950/30 bg-blur-md text-gray-100 font-[family-name:var(--font-geist-mono)] hide-scrollbar md:h-full md:min-h-0 md:overflow-hidden md:pb-0"
            data-ann-shell
        >
            {/* Header - Replaced with styled div from page.tsx */}
            <div
                className="mb-4 flex h-16 w-full flex-shrink-0 items-center justify-between p-2"
                data-augmented-ui="bl-clip-y tr-clip-y border inlay"
                style={{'--aug-border-bg': 'var(--foreground)',
                '--aug-border-opacity': '0.8',
                '--aug-border-x': '1px',
                '--aug-border-y': '3px',
                '--aug-inlay-bg': 'var(--background)',
                '--aug-inlay-opacity': '0.1',
                filter: `drop-shadow(0 0 2px var(--accent-primary))`,
                '--aug-tl': '10px',
                '--aug-tr': '10px',
                '--aug-br': '10px',
                '--aug-bl': '10px',
                } as React.CSSProperties}
            >
                <div className="flex flex-shrink-0 items-center gap-1">
                    <h1 className="pl-4 pr-2 text-xl font-bold text-[var(--accent-primary)]">Music Classification (ANN)</h1>
                    <ModeSwitchLink currentMode="ann" />
                </div>
                {/* --- NEW: Added Audio Player (mirrors app/page.tsx) --- */}
                <AudioPlayer
                    song={currentlyPlayingSong}
                    isPlaying={isPlaying}
                    onTogglePlayPause={handleTogglePlayPause}
                    onSongEnd={handleSongEnd}
                    className="flex-grow flex justify-center items-center min-w-0 max-w-[40vw] px-4"
                />
                {/* ------------------------------------------------------- */}
                <div className="flex items-center gap-4 flex-shrink-0"> {/* Wrapper for status and button */}
                    <div className="text-sm text-[var(--accent-primary)]/80">
                        <span className={annProcessStatus.tone === 'ready' ? 'text-green-400' : annProcessStatus.tone === 'loading' ? 'text-yellow-400 animate-pulse' : 'animate-pulse'}>
                            {annProcessStatus.text}
                        </span>
                    </div>
                     {/* About Text Link */}
                    <span
                        onClick={handleToggleAboutDialog}
                        className="text-[var(--accent-primary)] hover:text-cyan-400 cursor-pointer text-sm whitespace-nowrap mr-4"
                        role="button" // Accessibility
                        tabIndex={0}  // Accessibility
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                handleToggleAboutDialog();
                            }
                        }} // Accessibility
                    >
                        | About
                    </span>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" multiple style={{ display: 'none' }} />
                <input
                    id="annUploadedDatasetReattachFiles"
                    type="file"
                    ref={annUploadedDatasetReattachInputRef}
                    accept="audio/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        const files = event.target.files;
                        handleReattachUploadedDatasetFiles(files);
                        event.target.value = '';
                    }}
                />
                <input
                    type="file"
                    ref={annSetupImportInputRef}
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        void handleImportAnnSetupFile(file);
                    }}
                />
                <input
                    type="file"
                    ref={comparisonImportInputRef}
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        void handleImportModelComparisonFile(file);
                    }}
                />
                <input
                    id="annTrainedModelImport"
                    type="file"
                    ref={trainedModelImportInputRef}
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        void handleImportTrainedModelFile(file);
                    }}
                />
            </div>

            {!allWorkersReady && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="text-center p-8 bg-[var(--panel-bg)] rounded-lg shadow-xl border border-[var(--border-color)]">
                        <p className="text-xl font-semibold animate-pulse text-[var(--accent-color)]">Initializing Workers...</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">Please wait, loading necessary components.</p>
                 </div>
            </div>
            )}

            <div className="h-auto md:min-h-0 md:flex-1 md:overflow-hidden" data-ann-content>
                 <div className="grid min-h-full grid-cols-1 gap-2 px-2 pt-2 md:h-full md:min-h-0 md:grid-cols-[3fr_1fr]">
                     <div className="flex h-[980px] min-w-0 flex-col pr-0 md:h-full md:min-h-0 md:pr-2" data-ann-workspace>
                         <div className="relative min-h-0 flex-1 overflow-hidden" data-ann-workspace-pages>
                             <section
                                 id="ann-workspace-page-data"
                                 role="tabpanel"
                                 aria-labelledby="ann-workspace-tab-data"
                                 aria-hidden={workspacePage !== 'data'}
                                 className={`absolute inset-0 min-h-0 ${workspacePage === 'data' ? 'visible' : 'invisible pointer-events-none'}`}
                                 data-ann-workspace-page="data"
                             >
                                 <DndContext onDragEnd={handleDragEnd}>
                                     <LabelingPanel
                                         className="h-full min-h-0"
                                         songs={songs}
                                         namedLists={namedLists}
                                         onCreateList={handleCreateList}
                                         onRenameList={handleRenameList}
                                         onRemoveSongFromList={handleRemoveSongFromList}
                                         onRemoveSongFromSession={handleRemoveSongFromSession}
                                         onShowDetails={setDetailsSongId}
                                         onPlayRequest={handlePlayRequest}
                                         currentlyPlayingSongId={currentlyPlayingSongId}
                                         isPlaying={isPlaying}
                                         onUploadSongs={handleUploadClick}
                                         uploadDisabled={isAnyProcessRunning}
                                         interactionDisabled={isAnyProcessRunning}
                                     />
                                 </DndContext>
                             </section>
                             <section
                                 id="ann-workspace-page-model"
                                 role="tabpanel"
                                 aria-labelledby="ann-workspace-tab-model"
                                 aria-hidden={workspacePage !== 'model'}
                                 className={`absolute inset-0 min-h-0 ${workspacePage === 'model' ? 'visible' : 'invisible pointer-events-none'}`}
                                 data-ann-workspace-page="model"
                             >
                                 <NetworkVisualizationPanel
                                     className="h-full"
                                     isVisible={workspacePage === 'model'}
                                     networkConfig={networkConfig}
                                     inputDimension={inputDimension}
                                     outputDimension={outputDimension}
                                     labelNames={networkLabelNames}
                                     activationSnapshot={activationSnapshot}
                                     modelStateSnapshot={modelStateSnapshot}
                                     trainingPhaseSnapshot={trainingPhaseSnapshot}
                                     isTraining={isTraining || isTrainingSessionActive}
                                     isModelTrained={hasUsableModel}
                                 />
                             </section>
                             <section
                                 id="ann-workspace-page-performance"
                                 role="tabpanel"
                                 aria-labelledby="ann-workspace-tab-performance"
                                 aria-hidden={workspacePage !== 'performance'}
                                 className={`absolute inset-0 min-h-0 ${workspacePage === 'performance' ? 'visible' : 'invisible pointer-events-none'}`}
                                 data-ann-workspace-page="performance"
                             >
                                 <ANNTrainingPerformancePanel
                                     className="h-full"
                                     history={trainingHistory}
                                     isTraining={isTraining}
                                     currentEpoch={currentEpoch}
                                 />
                             </section>
                             <section
                                 id="ann-workspace-page-visualization"
                                 role="tabpanel"
                                 aria-labelledby="ann-workspace-tab-visualization"
                                 aria-hidden={workspacePage !== 'visualization'}
                                 className={`absolute inset-0 min-h-0 ${workspacePage === 'visualization' ? 'visible' : 'invisible pointer-events-none'}`}
                                 data-ann-workspace-page="visualization"
                             >
                                 <ANNDataVisualizationPanel
                                     className="h-full min-h-0"
                                     activeSongIds={new Set(songs.map(s => s.id))}
                                     songs={songs}
                                     songFeatures={songFeatures}
                                     unprocessedData={unprocessedData}
                                     processedData={processedData}
                                     reducedDataPoints={reducedDataPoints}
                                     reductionDimensions={reductionDimensions}
                                     trueLabels={annRouteLabelState.trueLabels}
                                     predictedLabels={inferenceResults}
                                     showPredictions={Object.keys(inferenceResults).length > 0}
                                     availableFeatureKeys={availableFeatureKeys}
                                     visualizationDisplayStage={visualizationTargetStage}
                                     onStageSelect={setVisualizationTargetStage}
                                     latestSuccessfulStage={latestCompletedStage}
                                     kmeansAssignments={placeholderKmeansAssignments}
                                     kmeansCentroids={[]}
                                     kmeansIteration={0}
                                 />
                             </section>
                             <section
                                 id="ann-workspace-page-logs"
                                 role="tabpanel"
                                 aria-labelledby="ann-workspace-tab-logs"
                                 aria-hidden={workspacePage !== 'logs'}
                                 className={`absolute inset-0 min-h-0 ${workspacePage === 'logs' ? 'visible' : 'invisible pointer-events-none'}`}
                                 data-ann-workspace-page="logs"
                             >
                                 <LogPanel className="h-full min-h-0" logs={logMessages} />
                             </section>
                         </div>
                         <div className="flex flex-shrink-0 justify-center pt-2" role="tablist" aria-label="ANN workspace pages" data-ann-workspace-tabs>
                             <div className="inline-grid max-w-full grid-cols-5 border border-[var(--foreground)]/25 bg-black/30 p-0.5">
                                 {ANN_WORKSPACE_TABS.map((tab, tabIndex) => {
                                     const Icon = tab.icon;
                                     return (
                                         <button
                                             key={tab.id}
                                             id={`ann-workspace-tab-${tab.id}`}
                                             type="button"
                                             role="tab"
                                             aria-controls={`ann-workspace-page-${tab.id}`}
                                             aria-selected={workspacePage === tab.id}
                                             tabIndex={workspacePage === tab.id ? 0 : -1}
                                             title={tab.label}
                                             className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-2 text-[10px] transition-colors sm:min-h-9 sm:min-w-0 sm:px-3 sm:text-xs ${workspacePage === tab.id ? 'bg-cyan-400/15 text-cyan-200' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
                                             onClick={() => setWorkspacePage(tab.id)}
                                             onKeyDown={(event) => {
                                                 if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
                                                 event.preventDefault();
                                                 const nextIndex = event.key === 'Home'
                                                     ? 0
                                                     : event.key === 'End'
                                                         ? ANN_WORKSPACE_TABS.length - 1
                                                         : (tabIndex + (event.key === 'ArrowRight' ? 1 : -1) + ANN_WORKSPACE_TABS.length) % ANN_WORKSPACE_TABS.length;
                                                 const nextTab = ANN_WORKSPACE_TABS[nextIndex];
                                                 setWorkspacePage(nextTab.id);
                                                 window.requestAnimationFrame(() => document.getElementById(`ann-workspace-tab-${nextTab.id}`)?.focus());
                                             }}
                                             data-ann-workspace-tab={tab.id}
                                         >
                                             <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                                             <span className="hidden sm:inline">{tab.label}</span>
                                         </button>
                                     );
                                 })}
                             </div>
                         </div>
                     </div>

                     <div className="col-span-1 flex min-h-0 flex-col overflow-hidden md:col-span-1">
                         <ANNControlsPanel
                             essentiaWorkerReady={essentiaWorkerReady}
                             dataProcessingWorkerReady={dataProcessingWorkerReady}
                             druidWorkerReady={druidWorkerReady}
                             mlpWorkerReady={mlpWorkerReady}
                             isExtracting={isExtracting}
                             isProcessingData={isProcessingData}
                              isReducing={isReducing}
                              isTraining={isTraining}
                              isTrainingSessionActive={isTrainingSessionActive}
                              isInferring={isInferring}
                             canProcess={processedData === null && hasCurrentFeatureRows}
                             canReduce={processedData !== null}
                             canTrain={canTrain}
                             trainDisabledReason={trainDisabledReason}
                             labelDistribution={labelDistribution}
                             canInfer={canInfer}
                             inferDisabledReason={inferDisabledReason}
                             trainingSummary={trainingSummary}
                              trainingExecutionMode={trainingExecutionMode}
                              trainingSessionStatus={trainingSessionStatus}
                              trainingPhaseSnapshot={trainingPhaseSnapshot}
                              isAutomaticTrainingArmed={isAutomaticTrainingArmed}
                             canContinueTraining={canContinueTraining}
                             continueTrainingDisabledReason={continueTrainingDisabledReason}
                             featureSignalSummary={featureSignalSummary}
                             evaluationSummary={evaluationSummary}
                             permutationImportanceSummary={permutationImportanceSummary}
                             permutationImportanceError={permutationImportanceError}
                             canRunPermutationImportance={canRunPermutationImportance}
                             permutationImportanceDisabledReason={permutationImportanceDisabledReason}
                             isAnalyzingPermutationImportance={isAnalyzingPermutationImportance}
                             canExportPermutationImportance={canExportPermutationImportance}
                             permutationImportanceExportDisabledReason={permutationImportanceExportDisabledReason}
                             validationPlan={validationPlan}
                             validationExecutionPlan={validationExecutionPlan}
                             canRunValidation={canRunValidation}
                             validationRunDisabledReason={validationRunDisabledReason}
                             isValidating={isValidating}
                             validationRunProgress={validationRunProgress}
                             validationRunSummary={validationRunSummary}
                             validationRunFoldResults={validationRunFoldResults}
                             validationRunError={validationRunError}
                             canExportValidationSummary={canExportValidationSummary}
                             validationExportDisabledReason={validationExportDisabledReason}
                             canExportTrainedModel={canExportTrainedModel}
                             trainedModelExportDisabledReason={trainedModelExportDisabledReason}
                             trainedModelImportDisabledReason={trainedModelImportDisabledReason}
                             trainedModelContextSource={hasUsableModel ? trainedModelContextSource : null}
                             activeModelComparisonRunId={hasUsableModel ? latestModelComparisonRunIdRef.current : null}
                             modelComparisonRuns={modelComparisonRuns}
                             annSetupImportDisabledReason={null}
                             pendingUploadedDatasetCount={pendingUploadedDatasetManifest?.userSongCount ?? 0}
                             pendingUploadedDatasetSongs={pendingUploadedDatasetManifest?.songs.map(song => ({
                                 name: song.name,
                                 assignedLabels: song.assignedLabels,
                                 externalId: song.externalId,
                             })) ?? []}
                             uploadedDatasetReattachmentReview={uploadedDatasetReattachmentReview}
                             uploadedDatasetReattachDisabledReason={pendingUploadedDatasetManifest ? null : 'Import setup with uploaded-song identities before reattaching files.'}
                             modelComparisonImportDisabledReason={null}
                             onExtractFeatures={handleExtractFeatures}
                             onProcessData={handleProcessData}
                             onReduceDimensions={handleReduceDimensions}
                             networkConfig={networkConfig}
                             setNetworkConfig={handleNetworkConfigChange}
                             useDimensionalityReduction={useDimensionalityReduction}
                             onReductionChoiceChange={handleReductionChoiceChange}
                             processingMethod={processingMethod}
                             onProcessingMethodChange={handleProcessingMethodChange}
                             reductionMethod={reductionMethod}
                             targetDimensions={targetDimensions}
                             onTargetDimensionsChange={handleTargetDimensionsChange}
                             onTrain={handleTrain}
                              onTrainingExecutionModeChange={handleTrainingExecutionModeChange}
                              onAdvanceTraining={handleAdvanceTraining}
                              onStartAutomaticTraining={handleStartAutomaticTraining}
                             onContinueTraining={handleContinueTraining}
                             onInfer={handleInfer}
                             onRunPermutationImportance={handleRunPermutationImportance}
                             onCancelPermutationImportance={handleCancelPermutationImportance}
                             onExportPermutationImportance={handleExportPermutationImportance}
                             onRunValidation={handleRunValidation}
                             onExportValidationSummary={handleExportValidationSummary}
                             onExportTrainedModel={handleExportTrainedModel}
                             onImportTrainedModel={handleOpenTrainedModelImport}
                             onExportAnnSetup={handleExportAnnSetup}
                             onImportAnnSetup={handleOpenAnnSetupImport}
                             onContinueWithAttachedUploadedDataset={handleContinueWithAttachedUploadedDataset}
                             onReattachUploadedDataset={handleOpenUploadedDatasetReattach}
                             onExportModelComparisonHistory={handleExportModelComparisonHistory}
                             onImportModelComparisonHistory={handleOpenModelComparisonImport}
                             onApplyModelComparisonSetup={handleApplyModelComparisonSetup}
                             onUpdateModelComparisonReview={handleUpdateModelComparisonReview}
                             onDeleteModelComparisonRun={handleDeleteModelComparisonRun}
                             inferenceFile={uploadedInferenceFile}
                             inferenceError={uploadedInferenceError}
                             uploadedInferenceResult={uploadedInferenceResult}
                              onInferenceFileChange={handleInferenceFileChange}
                             onInferUploadedAudio={handleInferUploadedAudio}
                             canChooseInferenceFile={canChooseInferenceFile}
                             inferenceFileDisabledReason={inferenceFileDisabledReason}
                             canInferUploadedAudio={canInferUploadedAudio}
                             uploadedInferDisabledReason={uploadedInferDisabledReason}
                             selectedFeatures={selectedFeatures}
                             onSelectedFeaturesChange={handleSelectedFeaturesChange}
                             canExportRawFeatures={canExportRawFeatures}
                             onOpenExportRawFeatures={() => setIsExportRawModalOpen(true)}
                         />
                     </div>
                 </div>
            </div>

            <AppFooter onAbout={handleToggleAboutDialog} />

            <ExportRawFeaturesDialog
                isOpen={isExportRawModalOpen}
                columnLabels={exportColumnLabels}
                onClose={() => setIsExportRawModalOpen(false)}
                onConfirm={handleExportRawFeatures}
            />
            {detailsSong && (
                <SongDetailsDialog
                    song={detailsSong}
                    features={songFeatures[detailsSong.id] ?? null}
                    onClose={() => setDetailsSongId(null)}
                />
            )}
            <AboutDialog isOpen={isAboutDialogOpen} onClose={handleToggleAboutDialog} />
         </main>
    );
}
