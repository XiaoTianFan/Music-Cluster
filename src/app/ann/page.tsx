'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as tfvis from '@tensorflow/tfjs-vis'; // Import tfjs-vis

// Import components using alias paths (assuming @/ maps to src/)
import LogPanel from '@/components/LogPanel';
import BasePanel from '@/components/ui/BasePanel';
import AboutDialog from '@/components/AboutDialog';
import ANNControlsPanel, { MLPConfig as ControlsMLPConfig, DEFAULT_MLP_CONFIG } from '@/components/ANNControlsPanel';
import LabelingPanel from '@/components/LabelingPanel';
import NetworkVisualizationPanel from '@/components/NetworkVisualizationPanel';
import ANNDataVisualizationPanel from '@/components/ANNDataVisualizationPanel';

// Reusable types (consider moving to a shared types file, e.g., src/types.ts)
export interface Song {
    id: string;
    name: string;
    url: string;
    source: 'default' | 'user';
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
}

interface InferPayload {
    vectors: number[][];
    songIds: string[];
    labelMap: Record<string, number>;
}

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

// Added type for tfvis chart data points
interface VisPoint { x: number; y: number; }

// Data structure types
type UnprocessedDataType = { vectors: number[][], songIds: string[], isOHEColumn: boolean[] };
type ProcessedDataType = { vectors: number[][], songIds: string[] };
// Placeholder for K-Means assignments (not used in ANN page)
const placeholderKmeansAssignments: Record<string, number> = {};

// --- Define needed types locally (mirroring those in VisualizationPanel) ---
interface InferenceResult {
  predictedLabel: string;
  confidence?: number;
}

interface TrueLabelMap {
  [songId: string]: string;
}

// --- End local type definitions ---

// Define default features explicitly here
const DEFAULT_SELECTED_FEATURES = ['mfccMeans', 'energy']; 

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

export default function ANNPage() {
    // --- State from Dashboard ---
    const [songs, setSongs] = useState<Song[]>(defaultSongs);
    const [songFeatures, setSongFeatures] = useState<Record<string, Features | null>>({});
    const [featureStatus, setFeatureStatus] = useState<Record<string, FeatureStatus>>({});
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
    const [isAboutDialogOpen, setIsAboutDialogOpen] = useState<boolean>(false);
    // Worker Ready Flags
    const [essentiaWorkerReady, setEssentiaWorkerReady] = useState<boolean>(false);
    const [dataProcessingWorkerReady, setDataProcessingWorkerReady] = useState<boolean>(false);
    const [druidWorkerReady, setDruidWorkerReady] = useState<boolean>(false);
    const [mlpWorkerReady, setMlpWorkerReady] = useState<boolean>(false);

    // --- Data Pipeline State ---
    const [unprocessedData, setUnprocessedData] = useState<UnprocessedDataType | null>(null);
    const [processedData, setProcessedData] = useState<ProcessedDataType | null>(null);
    const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
    const [reducedDataPoints, setReducedDataPoints] = useState<Record<string, number[]>>({});
    const [isReducing, setIsReducing] = useState<boolean>(false);
    const [reductionDimensions, setReductionDimensions] = useState<number>(0);

    // --- ANN Specific State ---
    const [namedLists, setNamedLists] = useState<Record<string, Set<string>>>({});
    const [isTraining, setIsTraining] = useState<boolean>(false);
    const [isInferring, setIsInferring] = useState<boolean>(false);
    // State for tfjs-vis chart
    const [trainingHistory, setTrainingHistory] = useState<{ loss: VisPoint[], acc: VisPoint[] }>({ loss: [], acc: [] });
    const [currentEpoch, setCurrentEpoch] = useState<number>(0);
    const [networkConfig, setNetworkConfig] = useState<MLPConfig | null>(DEFAULT_MLP_CONFIG);
    const [inferenceResults, setInferenceResults] = useState<Record<string, InferenceResult>>({});
    const [useDimensionalityReduction, setUseDimensionalityReduction] = useState<boolean>(false);
    const [labelMap, setLabelMap] = useState<Map<string, number>>(new Map());
    const [inputDimension, setInputDimension] = useState<number>(0);
    const [outputDimension, setOutputDimension] = useState<number>(0);
    const [isModelTrained, setIsModelTrained] = useState<boolean>(false);
    // --- Initialize selectedFeatures state with the local default --- 
    const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set(DEFAULT_SELECTED_FEATURES));
    // --- NEW: State for control panel configuration ---
    const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>('standardize');
    const [reductionMethod, setReductionMethod] = useState<ReductionMethod>('umap');
    const [targetDimensions, setTargetDimensions] = useState<number>(2);
    const [latestCompletedStage, setLatestCompletedStage] = useState<ProcessingStage>(null);
    const [visualizationTargetStage, setVisualizationTargetStage] = useState<ProcessingStage>(null);

    // --- Worker Refs ---
    const essentiaWorkerRef = useRef<Worker | null>(null);
    const dataProcessingWorkerRef = useRef<Worker | null>(null);
    const druidWorkerRef = useRef<Worker | null>(null);
    const mlpWorkerRef = useRef<Worker | null>(null);

    // --- Other Refs ---
    const audioContextRef = useRef<AudioContext | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // Ref for the tfjs-vis chart container (Not strictly needed as tfvis manages its own container)
    // const tfvisContainerRef = useRef<HTMLDivElement>(null);

    // --- Log Helper ---
    const addLogMessage = useCallback((message: string, level: LogLevel = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry: LogMessage = { text: message, level, timestamp };
        console.log(`[${level.toUpperCase()}] ${message}`);
        setLogMessages(prevLogs => [logEntry, ...prevLogs.slice(0, 199)]);
    }, []);

    // --- Define prepareMatrix first --- 
    const prepareMatrix = useCallback(() => {
        const featuresToUse = Array.from(selectedFeatures);
        if (!featuresToUse || featuresToUse.length === 0) {
            addLogMessage('Cannot prepare matrix: No features selected.', 'warn');
            setUnprocessedData(null);
            setInputDimension(0);
            return;
        }
        addLogMessage('Preparing data matrix...', 'info');
        const songIds: string[] = [];
        const vectors: number[][] = [];
        const initialIsOHE: boolean[] = [];

        setProcessedData(null);
        setReducedDataPoints({});
        setReductionDimensions(0);
        setTrainingHistory({ loss: [], acc: [] });
        setIsModelTrained(false);
        setInferenceResults({});
        setCurrentEpoch(0);
        setInputDimension(0);

        let firstVector = true;
        let vectorLength = 0;
        let inconsistentLength = false;

        songs.forEach(song => {
            const features = songFeatures[song.id];
            if (features && featureStatus[song.id] === 'complete') {
                const vector: number[] = [];

                featuresToUse.forEach((key) => {
                    const value = features[key];
                    if (key === 'key' || key === 'keyScale') {
                        const possibleKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                        const possibleScales = ['major', 'minor'];
                        let valuesToAdd: number[] = [];
                        let isOHE = true;
                        if (key === 'key') {
                            valuesToAdd = possibleKeys.map(k => (k === value ? 1 : 0));
                        } else { 
                            valuesToAdd = possibleScales.map(s => (s === value ? 1 : 0));
                        }
                        vector.push(...valuesToAdd);
                        if (firstVector) {
                             initialIsOHE.push(...Array(valuesToAdd.length).fill(isOHE));
                         }
                    } else if (Array.isArray(value)) {
                        vector.push(...value);
                        if (firstVector) {
                            initialIsOHE.push(...Array(value.length).fill(false));
                        }
                    } else if (typeof value === 'number') {
                        vector.push(value);
                         if (firstVector) {
                             initialIsOHE.push(false);
                         }
                    } else {
                        vector.push(NaN);
                        if (firstVector) {
                            initialIsOHE.push(false);
                        }
                        addLogMessage(`Missing/invalid feature '${key}' for song ${song.name}. Using NaN.`, 'warn');
                    }
                });

                if (firstVector) {
                    vectorLength = vector.length;
                    firstVector = false;
                }

                if (vector.length === vectorLength) {
                    songIds.push(song.id);
                    vectors.push(vector);
                } else {
                    addLogMessage(`Inconsistent vector length for song ${song.name} (expected ${vectorLength}, got ${vector.length}). Skipping.`, 'error');
                    inconsistentLength = true;
                }
            }
        });

        if (vectors.length > 0 && !inconsistentLength) {
            setUnprocessedData({ vectors, songIds, isOHEColumn: initialIsOHE });
            setInputDimension(vectorLength);
            addLogMessage(`Data matrix prepared: ${vectors.length} songs, ${vectorLength} features.`, 'complete');
        } else if (inconsistentLength) {
            setUnprocessedData(null);
             setInputDimension(0);
            addLogMessage('Data matrix preparation failed due to inconsistent vector lengths.', 'error');
        } else {
            setUnprocessedData(null);
            setInputDimension(0);
            addLogMessage('No valid feature data available to prepare matrix.', 'warn');
        }
        setLatestCompletedStage('features');
        setVisualizationTargetStage('features');
    }, [songs, songFeatures, featureStatus, addLogMessage, selectedFeatures]);

    // --- Worker Initialization useEffect ---
    useEffect(() => {
        // Init AudioContext
        if (!audioContextRef.current) {
             try { audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); addLogMessage('AudioContext initialized.'); } catch (e) { addLogMessage('Error initializing AudioContext.', 'error'); console.error(e); }
        }
        // Init Essentia Worker
        if (!essentiaWorkerRef.current) {
            addLogMessage('Creating Essentia Worker...', 'info');
            essentiaWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/essentia-worker.bundled.js');
            essentiaWorkerRef.current.onmessage = (event) => {
                const { type, payload, songId, features, error } = event.data;
                switch (type) {
                    case 'essentiaReady': setEssentiaWorkerReady(payload); addLogMessage(payload ? 'Essentia worker ready.' : `Essentia init failed: ${error}`, payload ? 'complete' : 'error'); break;
                    case 'featureExtractionComplete': setSongFeatures(prev => ({ ...prev, [songId]: features })); setFeatureStatus(prev => ({ ...prev, [songId]: 'complete' })); break;
                    case 'featureExtractionError': addLogMessage(`[Essentia] Error processing ${songId}: ${error}`, 'error'); setFeatureStatus(prev => ({ ...prev, [songId]: 'error' })); break;
                    default: addLogMessage(`[Essentia] Unknown msg: ${type}`, 'warn');
                }
            };
            essentiaWorkerRef.current.onerror = (e) => { addLogMessage(`Essentia Worker Error: ${e.message}`, 'error'); setEssentiaWorkerReady(false); setIsExtracting(false); };
            essentiaWorkerRef.current.postMessage({ type: 'init' });
        }
        // Init Data Processing Worker
        if (!dataProcessingWorkerRef.current) {
            addLogMessage('Creating Data Processing Worker...', 'info');
            dataProcessingWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/data-processing-worker.bundled.js');
            dataProcessingWorkerRef.current.onmessage = (event) => {
                const { type, payload } = event.data;
                switch (type) {
                    case 'processingComplete': setProcessedData({ vectors: payload.processedVectors, songIds: payload.songIds }); addLogMessage('Data processing complete.', 'complete'); setIsProcessingData(false); setInputDimension(payload.processedVectors?.[0]?.length ?? 0); break; // Set inputDimension here
                    case 'processingError': addLogMessage(`Data Processing Error: ${payload.error}`, 'error'); setProcessedData(null); setIsProcessingData(false); setInputDimension(0); break;
                    case 'dataProcessingWorkerReady': setDataProcessingWorkerReady(true); addLogMessage('Data Processing worker ready.', 'complete'); break;
                    default: addLogMessage(`[DataProc] Unknown msg: ${type}`, 'warn');
                }
             };
            dataProcessingWorkerRef.current.onerror = (e) => { addLogMessage(`DataProc Worker Error: ${e.message}`, 'error'); setDataProcessingWorkerReady(false); setIsProcessingData(false); setInputDimension(0); };
            // Send init message to trigger ready response
            dataProcessingWorkerRef.current.postMessage({ type: 'init' });
        }
        // Init Druid Worker
        if (!druidWorkerRef.current) {
            addLogMessage('Creating Druid Worker...', 'info');
            druidWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/druid-worker.bundled.js');
            druidWorkerRef.current.onmessage = (event) => {
                 const { type, payload } = event.data;
                switch(type) {
                    case 'druidWorkerReady':
                        setDruidWorkerReady(true);
                        addLogMessage('Druid worker ready.', 'complete');
                        break;
                    case 'reductionComplete': 
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
                        setIsReducing(false); 
                        addLogMessage(`Druid Error: ${payload.error}`, 'error'); 
                        setReductionDimensions(0); 
                        // Potentially reset inputDimension if reduction failed?
                        break;
                    default: addLogMessage(`[Druid] Unknown msg: ${type}`, 'warn');
                }
            };
            druidWorkerRef.current.onerror = (e) => { addLogMessage(`Druid Worker Error: ${e.message}`, 'error'); setDruidWorkerReady(false); setIsReducing(false); setReductionDimensions(0); };
        }
        // Init MLP Worker
        if (!mlpWorkerRef.current) {
            addLogMessage('Creating MLP Worker...', 'info');
            try {
                 mlpWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/mlp-worker.bundled.js');
                 mlpWorkerRef.current.onmessage = (event: MessageEvent) => {
                    const { type, payload } = event.data;
                    switch (type) {
                        case 'mlpWorkerReady': setMlpWorkerReady(true); addLogMessage('MLP worker ready.', 'complete'); break;
                        case 'epochMetrics':
                            // Ensure payload format is correct
                            if (payload && typeof payload.epoch === 'number' && payload.metrics && typeof payload.metrics.loss === 'number' && typeof payload.metrics.acc === 'number') {
                                setCurrentEpoch(payload.epoch);
                                setTrainingHistory(prev => ({
                                    loss: [...prev.loss, { x: payload.epoch, y: payload.metrics.loss }],
                                    acc: [...prev.acc, { x: payload.epoch, y: payload.metrics.acc }]
                                }));
                            } else {
                                console.warn('Received malformed epochMetrics:', payload);
                                addLogMessage('Received malformed epoch metrics from MLP worker.', 'warn');
                            }
                            break;
                        case 'trainingComplete': 
                            setIsTraining(false);
                            setIsModelTrained(true);
                            const finalAcc = payload?.finalMetrics?.accuracy;
                            addLogMessage(`Training complete.${finalAcc !== undefined ? ` Final Test Accuracy: ${(finalAcc * 100).toFixed(2)}%` : ''}`, 'complete');
                            break;
                        case 'inferenceComplete':
                            setIsInferring(false);
                            const formattedResults: Record<string, InferenceResult> = {};
                            if (payload && payload.results) {
                                for (const songId in payload.results) {
                                    if (typeof payload.results[songId] === 'string') {
                                        formattedResults[songId] = { predictedLabel: payload.results[songId] };
                                    }
                                }
                            }
                            setInferenceResults(formattedResults);
                            addLogMessage('Inference complete.', 'complete');
                            console.log("Inference results:", formattedResults);
                            break;
                        case 'mlpError':
                            addLogMessage(`MLP Worker Error: ${payload.error}`, 'error');
                            setIsTraining(false); 
                            setIsInferring(false);
                            setIsModelTrained(false); // Ensure model is marked not trained on error
                            break;
                        default: addLogMessage(`[MLP] Unknown msg: ${type}`, 'warn');
                    }
                 };
                 mlpWorkerRef.current.onerror = (e) => {
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
            setEssentiaWorkerReady(false);
            setDataProcessingWorkerReady(false);
            setDruidWorkerReady(false);
            setMlpWorkerReady(false);
            // Dispose tfjs-vis visor if needed (optional)
            // tfvis.visor().close();
        };
    }, [addLogMessage]); // Dependencies for worker initialization

    // --- useEffect for tfjs-vis Chart Rendering ---
    useEffect(() => {
        if (trainingHistory.loss.length > 0 || trainingHistory.acc.length > 0) {
            // Get the visor surface. Visor is created/managed by tfjs-vis
            const surface = tfvis.visor().surface({ name: 'Training History', tab: 'Training', styles: { height: '300px' } });
            const data = {
                values: [trainingHistory.loss, trainingHistory.acc],
                series: ['loss', 'accuracy'],
            };
            const opts = {
                xLabel: 'Epoch',
                yLabel: 'Value',
                seriesColors: ['#e5534b', '#4b8be5'], // Example colors (Redish, Bluish)
                zoomToFit: true,
            };
            tfvis.render.linechart(surface, data, opts);
            // tfvis.visor().open(); // Open visor automatically if desired
        }
    }, [trainingHistory]); // Re-render whenever history changes

    // --- Data Preparation/Derivation Logic ---
    useEffect(() => {
        // Update labelMap and outputDimension when namedLists change
        const newLabelMap = new Map<string, number>();
        Object.keys(namedLists).forEach((label, index) => {
            newLabelMap.set(label, index);
        });
        setLabelMap(newLabelMap);
        setOutputDimension(newLabelMap.size);
        addLogMessage(`Label map updated. Output dimension: ${newLabelMap.size}`, 'info');
    }, [namedLists, addLogMessage]); // Re-run when namedLists change

    // --- Monitor feature extraction completion --- 
    useEffect(() => {
        const completedStatuses: FeatureStatus[] = ['complete', 'error'];
        const numCompleted = Object.values(featureStatus).filter(status => completedStatuses.includes(status)).length;
        if (isExtracting && numCompleted === songs.length) {
            setIsExtracting(false);
            addLogMessage('Feature extraction process finished.', numCompleted > 0 ? 'complete' : 'warn');
            if (Object.values(featureStatus).some(s => s === 'complete')) {
                 // Use the selectedFeatures state here
                 prepareMatrix(); // Convert Set to Array
            }
        }
    // Add selectedFeatures and prepareMatrix to dependency array
    }, [featureStatus, songs.length, isExtracting, addLogMessage, prepareMatrix, selectedFeatures]); 

    // --- Trigger prepareMatrix when selected features change (and features extracted) --- 
    useEffect(() => {
        // Prepare matrix only if features have been extracted for at least one song
        // and features are actually selected
        const featuresExtracted = Object.values(featureStatus).some(s => s === 'complete');
        if (featuresExtracted && selectedFeatures.size > 0) {
            prepareMatrix(); // Convert Set to Array
        }
    }, [selectedFeatures, featureStatus, prepareMatrix]); // Update dependencies

    // --- Effect to prepare matrix when selected features change or labels change (affects available points) ---
    useEffect(() => {
        // Only prepare if features have been extracted for at least one song
        if (Object.keys(songFeatures).length > 0 && Object.values(songFeatures).some(f => f !== null)) {
           prepareMatrix();
        }
        // Reset subsequent pipeline stages
        setProcessedData(null);
        setReducedDataPoints({});
        setLatestCompletedStage(null); // Reset stage completion
        setIsModelTrained(false); // Model needs retraining if features change
        setInferenceResults({}); // Clear old inferences
    }, [selectedFeatures, prepareMatrix, songFeatures]); // Rerun when selected features change

    // --- Effect to update output dimension based on labels ---
    useEffect(() => {
        const uniqueLabels = new Set<string>();
        Object.values(namedLists).forEach(songIdSet => {
            // Get the list name (label) - assuming keys of namedLists are the labels
            const listName = Object.keys(namedLists).find(key => namedLists[key] === songIdSet);
            if (listName) {
                uniqueLabels.add(listName);
            }
        });
        setOutputDimension(uniqueLabels.size);
    }, [namedLists]);

    // --- Callback Functions for UI Controls ---
    const handleExtractFeatures = useCallback(async () => {
        if (isExtracting) {
            addLogMessage('Feature extraction already in progress.', 'warn');
            return;
        }
        if (!essentiaWorkerRef.current) {
            addLogMessage('Essentia worker not ready.', 'error');
            return;
        }
        setIsExtracting(true);
        setSongFeatures({}); // Clear previous features
        setFeatureStatus(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: 'idle' }), {}));
        addLogMessage('Starting feature extraction for all songs...');

        let errorCount = 0;
        const featurePromises = songs.map(song =>
            new Promise<void>((resolve) => {
                setFeatureStatus(prev => ({ ...prev, [song.id]: 'processing' }));
                essentiaWorkerRef.current!.postMessage({ id: song.id, url: song.url });

                const handleMessage = (event: MessageEvent) => {
                    if (event.data.id === song.id) {
                        if (event.data.features) {
                            setSongFeatures(prev => ({ ...prev, [song.id]: event.data.features }));
                            setFeatureStatus(prev => ({ ...prev, [song.id]: 'complete' }));
                            // addLogMessage(`Features extracted for ${song.name}`, 'info');
                        } else if (event.data.error) {
                            setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
                            addLogMessage(`Error extracting features for ${song.name}: ${event.data.error}`, 'error');
                            errorCount++;
                        }
                        essentiaWorkerRef.current!.removeEventListener('message', handleMessage);
                        resolve();
                    }
                };
                essentiaWorkerRef.current!.addEventListener('message', handleMessage);
                // Timeout safeguard (e.g., 60 seconds per song)
                setTimeout(() => {
                    if (featureStatus[song.id] === 'processing') {
                        addLogMessage(`Timeout extracting features for ${song.name}`, 'error');
                        setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
                        essentiaWorkerRef.current!.removeEventListener('message', handleMessage);
                        errorCount++;
                        resolve(); // Resolve promise even on timeout
                    }
                }, 60000);
            })
        );

        await Promise.all(featurePromises);

        setIsExtracting(false);
        const successCount = songs.length - errorCount;
        addLogMessage(`Feature extraction complete. Success: ${successCount}, Errors: ${errorCount}`, errorCount > 0 ? 'warn' : 'complete');
        if (successCount > 0) {
            prepareMatrix(); // Prepare matrix after extraction
        } else {
            setUnprocessedData(null); // Ensure no stale data if all extractions failed
            setInputDimension(0);
        }
    }, [songs, isExtracting, addLogMessage, prepareMatrix]);

    const handleProcessData = useCallback(() => {
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

        addLogMessage(`Processing data matrix (${unprocessedData.songIds.length} songs, ${inputDimension} dims) using ${processingMethod}...`);
        setIsProcessingData(true);
        setProcessedData(null);
        setReducedDataPoints({});

        dataProcessingWorkerRef.current.postMessage({
            type: 'process',
            data: unprocessedData,
            method: processingMethod
        });

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'processComplete') {
                const { processedData: resultData, newDimension } = event.data;
                setProcessedData(resultData);
                setInputDimension(newDimension); // Update dimension if OHE columns were handled differently
                addLogMessage(`Data processing complete. New dimensions: ${newDimension}`, 'complete');
                setIsProcessingData(false);
                setLatestCompletedStage('processed');
                setVisualizationTargetStage('processed');
                dataProcessingWorkerRef.current?.removeEventListener('message', handleMessage);

                // Trigger reduction if enabled
                if (useDimensionalityReduction) {
                    handleReduceDimensions();
                }
            } else if (event.data.type === 'processError') {
                addLogMessage(`Data processing failed: ${event.data.error}`, 'error');
                setIsProcessingData(false);
                setProcessedData(null);
                dataProcessingWorkerRef.current?.removeEventListener('message', handleMessage);
            }
        };
        dataProcessingWorkerRef.current.addEventListener('message', handleMessage);

    }, [unprocessedData, inputDimension, processingMethod, isProcessingData, addLogMessage, useDimensionalityReduction]);

    const handleReduceDimensions = useCallback(() => {
        if (isReducing) {
            addLogMessage('Dimensionality reduction already in progress.', 'warn');
            return;
        }
        if (!druidWorkerRef.current) {
            addLogMessage('Dimensionality Reduction worker not ready.', 'error');
            return;
        }

        // Determine which data to reduce
        const dataToReduce = processedData || unprocessedData;
        if (!dataToReduce || dataToReduce.vectors.length === 0) {
            addLogMessage('Cannot reduce dimensions: No suitable data matrix available.', 'error');
            return;
        }

        addLogMessage(`Starting dimensionality reduction using ${reductionMethod} to ${targetDimensions} dimensions...`);
        setIsReducing(true);
        setReducedDataPoints({});

        druidWorkerRef.current.postMessage({
            type: 'reduce',
            data: dataToReduce.vectors,
            method: reductionMethod,
            config: { n_neighbors: 15, n_components: targetDimensions, // Add other DRUID config as needed
                    perplexity: 30, // Example for t-SNE
                    min_dist: 0.1, // Example for UMAP
                   }
        });

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'reduceComplete') {
                const { reducedVectors } = event.data;
                const newReducedData: Record<string, number[]> = {};
                dataToReduce.songIds.forEach((id, index) => {
                    newReducedData[id] = reducedVectors[index];
                });
                setReducedDataPoints(newReducedData);
                setReductionDimensions(targetDimensions); // Set the actual dimensions used
                addLogMessage(`Dimensionality reduction complete.`, 'complete');
                setIsReducing(false);
                setLatestCompletedStage('reduced');
                setVisualizationTargetStage('reduced');
                druidWorkerRef.current?.removeEventListener('message', handleMessage);
            } else if (event.data.type === 'reduceError') {
                addLogMessage(`Dimensionality reduction failed: ${event.data.error}`, 'error');
                setIsReducing(false);
                setReducedDataPoints({});
                druidWorkerRef.current?.removeEventListener('message', handleMessage);
            }
        };
        druidWorkerRef.current.addEventListener('message', handleMessage);

    }, [processedData, unprocessedData, reductionMethod, targetDimensions, isReducing, addLogMessage]);

    const handleTrain = useCallback(() => { 
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
        let dataSource: ProcessedDataType | UnprocessedDataType | null = null;
        let dataDimension = 0;
        if (useDimensionalityReduction && Object.keys(reducedDataPoints).length > 0) {
            dataSource = { vectors: Object.values(reducedDataPoints), songIds: Object.keys(reducedDataPoints) };
            dataDimension = reductionDimensions;
            addLogMessage('Using reduced data for training.', 'info');
        } else if (processedData) {
            dataSource = processedData;
            dataDimension = inputDimension;
            addLogMessage('Using processed data for training.', 'info');
        } else if (unprocessedData) {
            dataSource = unprocessedData;
            dataDimension = inputDimension;
            addLogMessage('Using raw/unprocessed data for training.', 'info');
        } else {
            addLogMessage('Cannot train: No suitable data available (unprocessed, processed, or reduced).', 'error');
            return;
        }

        // 2. Prepare Labels and Filter Data
        const trainingVectors: number[][] = [];
        const trainingLabels: string[] = [];
        const localLabelMap = new Map<string, number>();
        let labelIndexCounter = 0;

        const songIdsInDataSource = new Set(dataSource.songIds);

        Object.entries(namedLists).forEach(([labelName, songIdSet]) => {
            if (!localLabelMap.has(labelName)) {
                localLabelMap.set(labelName, labelIndexCounter++);
            }
            songIdSet.forEach(songId => {
                // Only include songs that are in the current dataSource AND have a label
                if (songIdsInDataSource.has(songId)) {
                    const dataIndex = dataSource!.songIds.indexOf(songId);
                    if (dataIndex !== -1) {
                        trainingVectors.push(dataSource!.vectors[dataIndex]);
                        trainingLabels.push(labelName); // Store string label for worker OHE
                    }
                }
            });
        });

        if (trainingVectors.length === 0 || localLabelMap.size < 2) {
            addLogMessage(`Cannot train: Not enough labeled data for training (${trainingVectors.length} songs, ${localLabelMap.size} unique labels). Need at least 2 labels.`, 'error');
            return;
        }

        setLabelMap(localLabelMap); // Store the map for inference
        setOutputDimension(localLabelMap.size);
        setInputDimension(dataDimension); // Ensure input dimension matches training data

        addLogMessage(`Starting training with ${trainingVectors.length} labeled songs across ${localLabelMap.size} classes...`, 'info');

        // 3. Prepare Worker Payload
        const workerConfig: WorkerMLPConfig = {
            layers: networkConfig.hiddenLayers,
            nodes: networkConfig.nodesPerLayer,
            activation: networkConfig.activation,
            optimizer: networkConfig.optimizer,
            learningRate: networkConfig.learningRate,
        };

        const trainPayload: TrainPayload = {
            vectors: trainingVectors,
            labels: trainingLabels,
            config: workerConfig,
            labelMap: Object.fromEntries(localLabelMap), // Convert map for worker
            trainIterations: networkConfig.epochs,
            batchSize: 32, // Example batch size - make configurable?
            splitRatio: networkConfig.splitRatio,
            seed: networkConfig.randomSeed ?? Date.now(),
        };

        // 4. Send to Worker & Set Flags
        setTrainingHistory({ loss: [], acc: [] }); // Clear previous history
        setCurrentEpoch(0);
        setIsTraining(true); 
        setIsModelTrained(false);
        setInferenceResults({});
        mlpWorkerRef.current.postMessage({ type: 'train', payload: trainPayload });

        // Note: Worker message handling (epochMetrics, trainingComplete, trainingError) is in the main useEffect

    }, [isTraining, mlpWorkerRef.current, networkConfig, useDimensionalityReduction, reducedDataPoints, processedData, unprocessedData, namedLists, inputDimension, reductionDimensions, addLogMessage]);

    const handleInfer = useCallback(() => {
        if (isInferring) {
            addLogMessage('Inference already in progress.', 'warn');
            return;
        }
        if (!mlpWorkerRef.current) {
            addLogMessage('MLP worker not ready.', 'error');
            return;
        }
        if (!isModelTrained) {
            addLogMessage('Cannot infer: Model is not trained yet.', 'error');
            return;
        }
        if (labelMap.size === 0) {
           addLogMessage('Cannot infer: Label map is missing (train first).', 'error');
           return;
       }

        // 1. Determine data source for inference (use the same type of data as training)
        let dataSource: ProcessedDataType | UnprocessedDataType | null = null;
        if (useDimensionalityReduction && Object.keys(reducedDataPoints).length > 0) {
            dataSource = { vectors: Object.values(reducedDataPoints), songIds: Object.keys(reducedDataPoints) };
            addLogMessage('Using reduced data for inference.', 'info');
        } else if (processedData) {
            dataSource = processedData;
            addLogMessage('Using processed data for inference.', 'info');
        } else if (unprocessedData) {
            dataSource = unprocessedData;
            addLogMessage('Using raw/unprocessed data for inference.', 'info');
        } else {
            addLogMessage('Cannot infer: No suitable data available.', 'error');
            return;
        }

        addLogMessage(`Starting inference on ${dataSource.songIds.length} songs...`, 'info');

        // 2. Prepare Worker Payload
        const inferPayload: InferPayload = {
            vectors: dataSource.vectors,
            songIds: dataSource.songIds,
            labelMap: Object.fromEntries(labelMap) // Pass the label map used during training
        };

        // 3. Send to Worker & Set Flags
        setIsInferring(true);
        setInferenceResults({}); // Clear previous results
        mlpWorkerRef.current.postMessage({ type: 'infer', payload: inferPayload });

        // Note: Worker message handling (inferenceComplete, inferenceError) is in the main useEffect

    }, [isInferring, isModelTrained, labelMap, mlpWorkerRef.current, useDimensionalityReduction, reducedDataPoints, processedData, unprocessedData, addLogMessage]);

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
            } else {
                 addLogMessage(`List "${oldName}" not found. Cannot rename.`, 'warn');
            }
            return updated;
        });
    }, [namedLists, addLogMessage]);

    const handleDropSong = useCallback((songId: string, targetListName: string | null) => {
        setNamedLists(prev => {
            const updated: Record<string, Set<string>> = {};
            let sourceList: string | null = null;

            // Deep copy sets and find source list
            for (const listName in prev) {
                updated[listName] = new Set(prev[listName]);
                if (updated[listName].has(songId)) {
                    sourceList = listName;
                }
            }

            // Remove from source list
            if (sourceList) {
                updated[sourceList].delete(songId);
            }

            // Add to target list if specified and exists
            if (targetListName !== null) {
                if (updated.hasOwnProperty(targetListName)) {
                    updated[targetListName].add(songId);
                    addLogMessage(`Moved song ${songId} from ${sourceList ?? 'Unassigned'} to ${targetListName}`, 'info');
                } else {
                    addLogMessage(`Error: Target list "${targetListName}" not found. Song remains in ${sourceList ?? 'Unassigned'}.`, 'error');
                    // Re-add to source if target was invalid? Or leave unassigned? Let's leave unassigned.
                    if (sourceList) updated[sourceList].delete(songId); // Ensure removal if target invalid
                    // No need to return prev, updated reflects the (failed) move state
                }
            } else {
                // Dropped onto unassigned area
                if (sourceList) {
                     addLogMessage(`Moved song ${songId} from ${sourceList} back to Unassigned`, 'info');
                } // If sourceList is null, it was already unassigned.
            }

            return updated;
        });
    }, [addLogMessage]);

     const handleRemoveSongFromList = useCallback((songId: string, listName: string) => {
         setNamedLists(prev => {
             const updated = { ...prev };
             if (updated[listName]) {
                 const currentSet = new Set(updated[listName]);
                 if (currentSet.delete(songId)) {
                     updated[listName] = currentSet;
                     addLogMessage(`Removed song ID ${songId} from list ${listName}`, 'info');
                     return updated;
                 }
             }
             return prev; // Return original state if no change
         });
     }, [addLogMessage]);

    // --- File Handling ---
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { addLogMessage('TODO: Implement handleFileChange', 'info'); };
    const handleUploadClick = () => { fileInputRef.current?.click(); };
    const handleToggleAboutDialog = () => { setIsAboutDialogOpen(prev => !prev); };

    // --- Memoized Values ---
    const allWorkersReady = useMemo(() => essentiaWorkerReady && dataProcessingWorkerReady && druidWorkerReady && mlpWorkerReady, [essentiaWorkerReady, dataProcessingWorkerReady, druidWorkerReady, mlpWorkerReady]);
    const unassignedSongIds = useMemo(() => {
        const assignedIds = new Set(Object.values(namedLists).flatMap(set => Array.from(set)));
        return songs.filter(song => !assignedIds.has(song.id)).map(song => song.id);
    }, [songs, namedLists]);
    const canTrain = useMemo(() => allWorkersReady && labelMap.size >= 2 && !isTraining && (processedData !== null || Object.keys(reducedDataPoints).length > 0), [allWorkersReady, labelMap, isTraining, processedData, reducedDataPoints]);
    const canInfer = useMemo(() => allWorkersReady && isModelTrained && !isInferring && (processedData !== null || Object.keys(reducedDataPoints).length > 0), [allWorkersReady, isModelTrained, isInferring, processedData, reducedDataPoints]);

    // Get available feature keys for Visualization Panel
    const availableFeatureKeys = useMemo(() => {
        const firstSongWithFeatures = songs.find(song => songFeatures[song.id]);
        if (!firstSongWithFeatures) return null;
        const features = songFeatures[firstSongWithFeatures.id];
        return features ? Object.keys(features) : null;
    }, [songs, songFeatures]);

    // Determine the stage to show in the visualization panel
    const [visualizationDisplayStage, setVisualizationDisplayStage] = useState<ProcessingStage | null>(null);

    useEffect(() => {
        let stage: ProcessingStage | null = null;
        // Determine stage based on available data, ANN page doesn't use kmeans
        if (Object.keys(reducedDataPoints).length > 0) stage = 'reduced';
        else if (processedData) stage = 'processed';
        else if (Object.keys(songFeatures).some(id => featureStatus[id] === 'complete')) stage = 'features';
        setVisualizationDisplayStage(stage);
    }, [songFeatures, processedData, reducedDataPoints, featureStatus]);


    // --- Render ---
    return (
        <div className="container mx-auto p-4 flex flex-col min-h-screen font-sans relative bg-background text-foreground">
            {/* Header - Reuse or adapt from Dashboard */}
            <header className="flex justify-between items-center mb-4 border-b pb-2 border-[var(--border-color)]">
                <h1 className="text-2xl font-bold text-[var(--accent-color)]">Supervised Audio Classification (ANN)</h1>
                <div>
                    {/* <button onClick={handleUploadClick} className="btn mr-2">Upload Audio</button> */}
                    <button onClick={handleToggleAboutDialog} className="btn-secondary">About</button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" multiple style={{ display: 'none' }} />
            </header>

            {!allWorkersReady && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="text-center p-8 bg-[var(--panel-bg)] rounded-lg shadow-xl border border-[var(--border-color)]">
                        <p className="text-xl font-semibold animate-pulse text-[var(--accent-color)]">Initializing Workers...</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">Please wait, loading necessary components.</p>
                 </div>
            </div>
            )}

            <main className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
                {/* Left Column (Scrollable) */}
                <div className="md:col-span-2 flex flex-col gap-4 overflow-y-auto h-[calc(100vh-150px)] pr-2 scrollbar-thin scrollbar-thumb-[var(--accent-color)] scrollbar-track-[var(--panel-bg-alt)]">
                    <LabelingPanel
                        songs={songs}
                        namedLists={namedLists}
                        onCreateList={handleCreateList}
                        onRenameList={handleRenameList}
                        onRemoveSongFromList={handleRemoveSongFromList}
                    />
                    <LogPanel logs={logMessages} /> {/* Renamed prop */} 
                </div>

                {/* Right Column (Fixed) */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <ANNControlsPanel
                        // Pass props expected by ANNControlsPanel
                         essentiaWorkerReady={essentiaWorkerReady}
                         dataProcessingWorkerReady={dataProcessingWorkerReady}
                         druidWorkerReady={druidWorkerReady}
                         mlpWorkerReady={mlpWorkerReady}
                         isExtracting={isExtracting}
                         isProcessingData={isProcessingData}
                         isReducing={isReducing}
                         isTraining={isTraining}
                         isInferring={isInferring}
                        canProcess={processedData === null && Object.values(featureStatus).some(s => s === 'complete')} 
                        canReduce={processedData !== null}
                         canTrain={canTrain}
                         canInfer={canInfer}
                         onExtractFeatures={handleExtractFeatures}
                         onProcessData={handleProcessData}
                         onReduceDimensions={handleReduceDimensions}
                        networkConfig={networkConfig}
                        setNetworkConfig={setNetworkConfig}
                        useDimensionalityReduction={useDimensionalityReduction}
                        setUseDimensionalityReduction={setUseDimensionalityReduction}
                         onTrain={handleTrain}
                         onInfer={handleInfer}
                        // --- Pass selectedFeatures state and setter --- 
                        selectedFeatures={selectedFeatures}
                        onSelectedFeaturesChange={setSelectedFeatures}
                    />
                    {/* Network Visualization */}
                    <NetworkVisualizationPanel
                        networkConfig={networkConfig} 
                        inputDimension={inputDimension}
                        outputDimension={outputDimension}
                        labelNames={Array.from(labelMap.keys())}
                    />
                    {/* Data Visualization - Pass props expected by VisualizationPanel */}
                    <ANNDataVisualizationPanel
                        className="min-h-[400px] lg:min-h-[500px] mt-4" // Add margin top
                        activeSongIds={new Set(songs.map(s => s.id))} // Assuming all loaded songs are active initially
                        songs={songs}
                        songFeatures={songFeatures}
                        unprocessedData={unprocessedData}
                        processedData={processedData}
                        reducedDataPoints={reducedDataPoints}
                        reductionDimensions={reductionDimensions}
                        // --- Pass ANN specific props ---
                        trueLabels={Object.entries(namedLists).reduce((acc, [label, idSet]) => {
                            idSet.forEach(id => { acc[id] = label; });
                            return acc;
                        }, {} as TrueLabelMap)}
                        predictedLabels={inferenceResults}
                        showPredictions={isModelTrained}
                        // --- Other necessary props ---
                        availableFeatureKeys={availableFeatureKeys} // Pass derived keys
                        visualizationDisplayStage={visualizationTargetStage}
                        onStageSelect={setVisualizationTargetStage} // Allow user override
                        latestSuccessfulStage={latestCompletedStage}
                        // --- Pass placeholder K-Means props if the underlying component still expects them due to copying ---
                        kmeansAssignments={placeholderKmeansAssignments}
                        kmeansCentroids={[]}
                        kmeansIteration={0}
                     />
                </div>
            </main>

            <AboutDialog isOpen={isAboutDialogOpen} onClose={handleToggleAboutDialog} />
        </div>
    );
} 