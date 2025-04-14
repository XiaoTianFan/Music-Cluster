'use client'; // Add this directive to make it a Client Component

import React, { useState, ChangeEvent, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic

// Import the new panel components
import SongListPanel from '../components/SongListPanel';
import ControlsPanel from '../components/ControlsPanel';
import LogPanel from '../components/LogPanel'; // Import the new LogPanel
import SongDetailsDialog from '../components/SongDetailsDialog'; // Import the new dialog component
import FeatureExplanationDialog from '../components/FeatureExplanationDialog'; // Import the explanation dialog
import AboutDialog from '../components/AboutDialog'; // Import the About dialog
import ExplanationDialog from '../components/ExplanationDialog'; // <-- Import the new generic dialog
import AudioPlayer from '../components/AudioPlayer'; // <-- NEW: Import AudioPlayer
// Remove the static import of VisualizationPanel
// import VisualizationPanel from '../components/VisualizationPanel';

// --- NEW: Cache Data Structure ---
interface CacheData {
  availableDataKeys: Set<keyof Features>; // Set of all actual data keys available in the cache
  songData: Record<string, Features>; // Maps songId to its cached features
}
// --- END NEW ---

// Dynamically import VisualizationPanel with SSR disabled
const VisualizationPanel = dynamic(
  () => import('@/components/VisualizationPanel'),
  { 
    ssr: false, 
    // Optional: Add a loading component while the panel loads on the client
    loading: () => (
        <div 
          className="col-span-2 row-span-1 flex items-center justify-center p-4 border border-pink-500 text-pink-400" 
          data-augmented-ui="tl-clip-x tr-round br-clip bl-round border" 
          style={{ '--aug-border-color': 'hotpink' } as React.CSSProperties} // Cast style object
        >
          <p>Loading Visualization...</p>
        </div>
      )
  } 
);

// Define interfaces for data structures
// Make sure these are EXPORTED if used by child components
export interface Song {
  id: string; // Using URL or a generated ID for uniqueness
  name: string;
  url: string;
  source: 'default' | 'user';
}

export interface Features {
  // Existing Features
  mfccMeans?: number[];
  mfccStdDevs?: number[];
  energy?: number;
  entropy?: number;
  key?: string;
  keyScale?: string;
  keyStrength?: number;
  dynamicComplexity?: number;
  loudness?: number; // Note: This 'loudness' is from DynamicComplexity
  rms?: number;
  tuningFrequency?: number;
  bpm?: number; // From RhythmExtractor2013
  rhythmConfidence?: number; // From RhythmExtractor2013

  // --- NEW Full Signal Features ---
  onsetRate?: number;
  danceability?: number;
  intensity?: number; // Categorical (-1, 0, 1)

  // --- NEW Frame-Based Aggregated Features ---
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

  // --- NEW Frame-Based Scalar Features ---
  spectralFluxMean?: number;
  spectralFluxStdDev?: number;

  // Optional Error fields (can be useful for debugging)
  mfccError?: string;
  energyError?: string;
  entropyError?: string;
  keyError?: string;
  dynamicComplexityError?: string;
  rmsError?: string;
  tuningFrequencyError?: string;
  rhythmError?: string;
  onsetRateError?: string;
  danceabilityError?: string;
  intensityError?: string;
  spectralCentroidTimeError?: string;
  spectralComplexityError?: string;
  spectralContrastError?: string;
  inharmonicityError?: string;
  dissonanceError?: string;
  melBandsError?: string;
  pitchSalienceError?: string;
  spectralFluxError?: string;
}

// Type for feature processing status
export type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';

// List of default songs based on the directory listing
const defaultSongs: Song[] = [
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

// Type for K-Means assignments
export interface KmeansAssignments {
    [songId: string]: number; // Map songId to cluster index
}

// Log level type
type LogLevel = 'info' | 'warn' | 'error' | 'complete';

// Log message structure
interface LogMessage {
  text: string;
  level: LogLevel;
  timestamp: string; // Keep timestamp separate for potential future use
}

// Structure for feature explanations (matches JSON)
interface FeatureExplanation {
  name: string;
  explanation: string;
}

// Helper function to compare two sets
const setsAreEqual = (setA: Set<unknown>, setB: Set<unknown>): boolean => {
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
};

// Type for data processing method (add this if not already defined globally)
type ProcessingMethod = 'none' | 'standardize' | 'normalize';

// Define possible stages for visualization
type ProcessingStage = 'features' | 'processed' | 'reduced' | 'kmeans' | null; // Add null option

// Define canonical feature order (used for matrix construction)
// Needs to be consistent between page.tsx and VisualizationPanel.tsx
// Exporting might be better long-term, but redefining for now.
const canonicalFeatureOrder: (keyof Features)[] = [
  // Existing Scalar Rhythmic/Dynamic/Loudness
  'energy', 'entropy', 'loudness', 'rms', 'dynamicComplexity', 'bpm', 'onsetRate',
  // Existing Scalar Tonal/Pitch
  'keyStrength', 'tuningFrequency', 'rhythmConfidence', 'pitchSalienceMean', 'pitchSalienceStdDev',
  // NEW Scalar Spectral/Timbral
  'spectralCentroidTimeMean', 'spectralCentroidTimeStdDev',
  'spectralComplexityMean', 'spectralComplexityStdDev',
  'spectralFluxMean', 'spectralFluxStdDev', // Added Spectral Flux
  // NEW Scalar Harmonic Property
  'inharmonicityMean', 'inharmonicityStdDev',
  'dissonanceMean', 'dissonanceStdDev',
  // NEW High-level / Categorical (Consider placement)
  'danceability', 'intensity', // Intensity is categorical

  // Existing Vector Features (MFCC)
  'mfccMeans', 'mfccStdDevs',
  // NEW Vector Features (Spectral Contrast, Mel Bands)
  'spectralContrastMeans', 'spectralContrastStdDevs',
  'melBandsMeans', 'melBandsStdDevs',

  // Existing Categorical for OHE (Keep last or group with other categoricals)
  'key', 'keyScale'
];

// --- NEW: Explicit Feature Mapping ---
// Maps user-facing feature IDs (from ControlsPanel) to actual data keys (keyof Features)
const featureIdToDataKeysMap: Map<string, (keyof Features)[]> = new Map([
  // NOTE: Ensure IDs ('mfcc', etc.) match EXACTLY those used in ControlsPanel feature selection
  // NOTE: Ensure all corresponding data keys (including Error fields) are listed
  ['mfcc', ['mfccMeans', 'mfccStdDevs']],
  ['energy', ['energy']],
  ['entropy', ['entropy']],
  ['dynamicComplexity', ['dynamicComplexity', 'loudness']],
  // Example: Grouping Key/Scale/Strength under a single user-selectable 'key' option
  ['key', ['key', 'keyScale', 'keyStrength']],
  // Map conceptual 'loudness' (user-facing) to its underlying feature + error
  ['loudness', ['loudness']], // Check if dynamicComplexityError is the right one
  ['rms', ['rms']],
  // Example: Grouping Rhythm features under 'bpm' user-selectable option
  ['rhythm', ['bpm']],
  // ['onsetRate', ['onsetRate']],
  ['danceability', ['danceability']],
  ['intensity', ['intensity']], // Note: Intensity is categorical
  ['spectralCentroidTime', ['spectralCentroidTimeMean', 'spectralCentroidTimeStdDev']],
  ['spectralComplexity', ['spectralComplexityMean', 'spectralComplexityStdDev']],
  ['spectralContrast', ['spectralContrastMeans', 'spectralContrastStdDevs']],
  ['inharmonicity', ['inharmonicityMean', 'inharmonicityStdDev']],
  ['dissonance', ['dissonanceMean', 'dissonanceStdDev']],
  ['melBands', ['melBandsMeans', 'melBandsStdDevs']],
  ['pitchSalience', ['pitchSalienceMean', 'pitchSalienceStdDev']],
  ['spectralFlux', ['spectralFluxMean', 'spectralFluxStdDev']],
  ['tuningFrequency', ['tuningFrequency']], // Added mapping
  // ADD MAPPINGS FOR *ALL* OTHER SELECTABLE FEATURES FROM ControlsPanel
]);
// --- END NEW ---

// --- Helper: Prepare Matrix (Extracted Logic) ---
const prepareMatrix = (
    activeFeatures: { id: string; features: Features }[], // Input: Features of active songs
    logFn: (msg: string, level: LogLevel) => void
): { vectors: number[][], songIds: string[], isOHEColumn: boolean[] } | null => {
    logFn('Preparing numerical matrix from features...', 'info');

    if (activeFeatures.length === 0) {
        logFn('No active songs with features available for matrix preparation.', 'warn');
        return null;
    }

    // Determine Common Features (same logic as before)
    let commonFeatures = new Set<keyof Features>();
    const firstFeatures = activeFeatures[0].features;
    commonFeatures = new Set(canonicalFeatureOrder.filter(key =>
        firstFeatures[key] !== undefined && firstFeatures[key] !== null
    ));
    for (let i = 1; i < activeFeatures.length; i++) {
        const currentFeatures = activeFeatures[i].features;
        commonFeatures.forEach(key => {
            if (currentFeatures[key] === undefined || currentFeatures[key] === null) {
                commonFeatures.delete(key);
            }
        });
    }

    if (commonFeatures.size === 0) {
        logFn('No features are commonly present across all selected active songs for matrix prep.', 'warn');
        return null;
    }
    logFn(`Common features for matrix: [${Array.from(commonFeatures).join(', ')}]`, 'complete');

    // One-Hot Encoding Prep (same logic as before)
    const uniqueKeys = new Set<string>();
    const uniqueScales = new Set<string>();
    let keyToIndex: Map<string, number> | null = null;
    let scaleToIndex: Map<string, number> | null = null;
    let numKeyDimensions = 0;
    let numScaleDimensions = 0;
    if (commonFeatures.has('key')) {
        activeFeatures.forEach(({ features }) => { uniqueKeys.add(features.key!); });
        const keyList = Array.from(uniqueKeys).sort();
        keyToIndex = new Map(keyList.map((k, i) => [k, i]));
        numKeyDimensions = keyList.length;
        logFn(`Preparing one-hot encoding for 'key' (${numKeyDimensions} dimensions).`, 'complete');
    }
    if (commonFeatures.has('keyScale')) {
        activeFeatures.forEach(({ features }) => { uniqueScales.add(features.keyScale!); });
        const scaleList = Array.from(uniqueScales).sort();
        scaleToIndex = new Map(scaleList.map((s, i) => [s, i]));
        numScaleDimensions = scaleList.length;
        logFn(`Preparing one-hot encoding for 'keyScale' (${numScaleDimensions} dimensions).`, 'complete');
    }

    // Construct vectors
    const featureVectors: number[][] = [];
    const vectorSongIds: string[] = [];
    // --- NEW: Track OHE status for each column ---
    let isOHEColumnDefinition: boolean[] = []; 
    let isOHEColumnDefinitionFinalized = false;
    // ---------------------------------------------
    let inconsistencyFound = false;
    
    activeFeatures.forEach(({ id, features }, rowIndex) => {
        const vec: number[] = [];
        // Define isOHEColumnDefinition based on the first row
        if (rowIndex === 0) {
             isOHEColumnDefinition = []; // Reset for the first row run
        }

        for (const key of canonicalFeatureOrder) {
            if (!commonFeatures.has(key)) continue;
            const value = features[key]!;

            if (key === 'key' && keyToIndex) {
                const keyOneHot = Array(numKeyDimensions).fill(0);
                const index = keyToIndex.get(value as string);
                if (index !== undefined) keyOneHot[index] = 1;
                else { /* error handling */ inconsistencyFound = true; }
                vec.push(...keyOneHot);
                // Mark these columns as OHE (only needed for first row)
                if (rowIndex === 0) {
                    isOHEColumnDefinition.push(...Array(numKeyDimensions).fill(true));
                }
            } else if (key === 'keyScale' && scaleToIndex) {
                const scaleOneHot = Array(numScaleDimensions).fill(0);
                const index = scaleToIndex.get(value as string);
                if (index !== undefined) scaleOneHot[index] = 1;
                else { /* error handling */ inconsistencyFound = true; }
                vec.push(...scaleOneHot);
                 // Mark these columns as OHE (only needed for first row)
                if (rowIndex === 0) {
                     isOHEColumnDefinition.push(...Array(numScaleDimensions).fill(true));
                 }
            } else if (Array.isArray(value)) {
                const numericalArray = value as number[];
                vec.push(...numericalArray);
                 // Mark these columns as NOT OHE (only needed for first row)
                 if (rowIndex === 0) {
                     isOHEColumnDefinition.push(...Array(numericalArray.length).fill(false));
                 }
            } else if (typeof value === 'number') {
                vec.push(value);
                 // Mark this column as NOT OHE (only needed for first row)
                 if (rowIndex === 0) {
                     isOHEColumnDefinition.push(false);
                 }
            }
        }
        
        // Finalize the definition after processing the first row
        if (rowIndex === 0) {
             isOHEColumnDefinitionFinalized = true;
        }

        if (vec.length > 0 && !inconsistencyFound) {
            // Simple sanity check: vector length should match definition length after first row
            if (isOHEColumnDefinitionFinalized && vec.length !== isOHEColumnDefinition.length) {
                 logFn(`Row ${rowIndex} for song ${id} has inconsistent vector length (${vec.length}) compared to definition (${isOHEColumnDefinition.length}). Aborting.`, 'error');
                 inconsistencyFound = true;
            }
            featureVectors.push(vec);
            vectorSongIds.push(id);
        } else if (!inconsistencyFound) {
             logFn(`Song ${id} resulted in an empty vector.`, 'warn');
        }
    });

    if (inconsistencyFound || !isOHEColumnDefinitionFinalized) {
        logFn('Matrix preparation failed due to inconsistencies or lack of data.', 'error');
        return null;
    }

    // Final checks (vector consistency, length)
    if (featureVectors.length > 0) {
        const firstLen = featureVectors[0].length;
        if (!featureVectors.every(v => v.length === firstLen)) {
             logFn('Constructed feature vectors have inconsistent lengths.', 'error');
             return null;
        }
        if (firstLen === 0) {
            logFn('Constructed feature vectors are empty (length 0).', 'warn');
            return null;
        }
        logFn(`Prepared ${featureVectors.length} vectors for processing, each with ${firstLen} dimensions.`, 'complete');
    } else {
         logFn('No valid feature vectors constructed for matrix prep.', 'warn');
         return null;
    }

    // MODIFIED Return Value:
    return { vectors: featureVectors, songIds: vectorSongIds, isOHEColumn: isOHEColumnDefinition };
};
// --- End Helper ---

export default function DashboardPage() {
  const [songs, setSongs] = useState<Song[]>(defaultSongs);
  const [songFeatures, setSongFeatures] = useState<Record<string, Features | null>>({}); // { songId: features }
  const [featureStatus, setFeatureStatus] = useState<Record<string, FeatureStatus>>({}); // { songId: status }
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [essentiaWorkerReady, setEssentiaWorkerReady] = useState<boolean>(false);
  // State to track which songs are selected for processing
  const [activeSongIds, setActiveSongIds] = useState<Set<string>>(() =>
    new Set(defaultSongs.map(song => song.id)) // Initially, all default songs are active
  );
  // --- Data Processing State (New) ---
  // MODIFIED: Add isOHEColumn to state type
  type UnprocessedDataType = { vectors: number[][], songIds: string[], isOHEColumn: boolean[] };
  const [unprocessedData, setUnprocessedData] = useState<UnprocessedDataType | null>(null);
  const [processedData, setProcessedData] = useState<{ vectors: number[][], songIds: string[] } | null>(null); // Processed data doesn't need OHE info directly
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  // --- DruidJS State ---
  const [reducedDataPoints, setReducedDataPoints] = useState<Record<string, number[]>>({}); // { songId: [dim1, dim2, ...] }
  const [isReducing, setIsReducing] = useState<boolean>(false);
  // Type for reduction method
  type ReductionMethod = 'pca' | 'tsne' | 'umap';
  // ---------------------
  const [reductionDimensions, setReductionDimensions] = useState<number>(0);

  // --- Log State ---
  const [logMessages, setLogMessages] = useState<LogMessage[]>([]); // Use LogMessage[]

  // --- Details Dialog State ---
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState<boolean>(false);
  const [detailsSongId, setDetailsSongId] = useState<string | null>(null);

  // --- State for Feature Explanations ---
  const [explanations, setExplanations] = useState<Record<string, FeatureExplanation> | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [explainedFeatureId, setExplainedFeatureId] = useState<string | null>(null);

  // --- NEW: State for Algorithm Explanations ---
  const [algorithmExplanations, setAlgorithmExplanations] = useState<Record<string, { name: string, explanation: string }> | null>(null);
  const [isAlgoExplanationOpen, setIsAlgoExplanationOpen] = useState<boolean>(false);
  const [explainedAlgorithmId, setExplainedAlgorithmId] = useState<string | null>(null);
  // -------------------------------------------

  // --- State for About Dialog ---
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState<boolean>(false);

  // --- State to track songs in the current processing batch ---
  const [processingSongIds, setProcessingSongIds] = useState<Set<string>>(new Set());

  const workerRef = useRef<Worker | null>(null);
  const druidWorkerRef = useRef<Worker | null>(null); // Ref for Druid worker
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Ref for the hidden file input
  const kmeansWorkerRef = useRef<Worker | null>(null);
  const dataProcessingWorkerRef = useRef<Worker | null>(null); // <-- Add ref for the new worker
  const extractionStartTimeRef = useRef<number | null>(null); // Ref for timing

  // --- K-Means State ---
  const [kmeansIteration, setKmeansIteration] = useState<number>(0);
  const [kmeansCentroids, setKmeansCentroids] = useState<number[][]>([]);
  const [kmeansAssignments, setKmeansAssignments] = useState<KmeansAssignments>({});
  const [isClustering, setIsClustering] = useState<boolean>(false); // Is K-Means process active (initialized but not reset)?
  const [isKmeansInitialized, setIsKmeansInitialized] = useState<boolean>(false); // Has the worker confirmed initialization?
  const [latestSuccessfulStage, setLatestSuccessfulStage] = useState<ProcessingStage>(null); // Track latest completed stage
  // NEW: State for tracking which stage the user wants to visualize (can be manually selected)
  const [visualizationDisplayStage, setVisualizationDisplayStage] = useState<ProcessingStage>(null);
  // --- NEW: State for available feature keys --- 
  const [availableFeatureKeys, setAvailableFeatureKeys] = useState<string[] | null>(null);

  // --- NEW: Audio Player State ---
  const [currentlyPlayingSongId, setCurrentlyPlayingSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // -----------------------------

  // --- NEW: Ref to store target IDs for completion check ---
  const initialTargetSongIdsRef = useRef<Set<string>>(new Set());

  // --- NEW: State for Stored Cache Data ---
  const [cacheData, setCacheData] = useState<CacheData | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  // --- END NEW ---

  // --- Log Helper Function ---
  const addLogMessage = useCallback((message: string, level: LogLevel = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry: LogMessage = { text: message, level, timestamp };

      // Log to the actual console WITH prefix for debugging
      const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
      const fullConsoleMessage = `${prefix} ${message}`;
      switch (level) {
          case 'info':
          case 'complete':
              console.log(fullConsoleMessage);
              break;
          case 'warn':
              console.warn(fullConsoleMessage);
              break;
          case 'error':
              console.error(fullConsoleMessage);
              break;
      }

      // Update state with the structured log entry
      setLogMessages(prevLogs => [...prevLogs, logEntry]);
  }, []);

  // Initialize Workers and AudioContext
  useEffect(() => {
    // Initialize AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      addLogMessage('AudioContext initialized.', 'info');
    }

    // Initialize Essentia Worker
    if (!workerRef.current) {
        addLogMessage('Creating Essentia Bundled Worker...', 'info');
        workerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/essentia-worker.bundled.js');

        workerRef.current.onmessage = (event) => {
            const { type, payload, songId, features, error } = event.data;
            addLogMessage(`[Essentia Worker] Received: ${type}`, 'info');

            switch (type) {
                case 'essentiaReady':
                    setEssentiaWorkerReady(payload);
                    if (!payload) {
                        addLogMessage(`Essentia worker failed to initialize: ${error}`, 'error');
                    } else {
                        addLogMessage('Essentia worker ready.', 'complete');
                    }
                    break;
                case 'featureExtractionComplete':
                    setSongFeatures(prev => ({ ...prev, [songId]: features }));
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'complete' }));
                    addLogMessage(`Features extracted for song ID: ${songId}`, 'complete');
                    break;
                case 'featureExtractionError':
                    addLogMessage(`[Essentia Worker] Error processing song ${songId}: ${error}`, 'error');
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'error' }));
                    break;
                default:
                    addLogMessage(`[Essentia Worker] Unknown message type: ${type}`, 'warn');
            }
        };

        workerRef.current.onerror = (error) => {
            addLogMessage(`Error in Essentia Worker: ${error?.message || 'Unknown error'}`, 'error');
            setEssentiaWorkerReady(false);
            setIsProcessing(false);
        };

        workerRef.current.postMessage({ type: 'init' });
    }

    // Initialize Druid Worker
    if (!druidWorkerRef.current) {
        addLogMessage('Creating Druid Bundled Worker...', 'info');
        druidWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/druid-worker.bundled.js');

        druidWorkerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            addLogMessage(`[Main] Received Druid worker message: ${type}`);
            switch(type) {
                case 'reductionComplete':
                     setIsReducing(false);
                     const newPoints: Record<string, number[]> = {};
                     payload.songIds.forEach((id: string, index: number) => {
                         newPoints[id] = payload.reducedData[index];
                     });
                     setReducedDataPoints(prev => ({ ...prev, ...newPoints }));
                     if (payload.reducedData && payload.reducedData.length > 0 && payload.reducedData[0]) {
                         setReductionDimensions(payload.reducedData[0].length);
                     } else {
                         setReductionDimensions(0); // Reset if no data
                     }
                     addLogMessage(`Dimensionality reduction complete. ${payload.songIds.length} points updated.`, 'complete');
                      // --- NEW: Reset K-Means as re-reduction invalidates it ---
                      handleResetKmeans();
                      // --- NEW: Update Latest Stage ---
                      setLatestSuccessfulStage('reduced');
                      addLogMessage('Reduction complete. Updating latest stage to: reduced', 'info');
                      // ----------------------------------
                      // -------------------------------------------------------
                      break;
                case 'reductionError':
                     setIsReducing(false);
                     addLogMessage(`Druid Worker Error: ${payload.error}`, 'error');
                     // TODO: Show error notification
                     setReductionDimensions(0); // Reset on error
                     break;
                default:
                    addLogMessage(`Unknown message type from Druid worker: ${type}`, 'warn');
            }
        };

        druidWorkerRef.current.onerror = (error) => {
            addLogMessage(`Error in Druid Worker: ${error?.message || 'Unknown error'}`, 'error');
            setIsReducing(false);
             // TODO: Maybe show a notification to the user
        };
    }

    // K-Means Worker Setup
    if (!kmeansWorkerRef.current) {
        addLogMessage('Initializing K-Means worker...', 'info');
        kmeansWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/kmeans-worker.bundled.js');

        kmeansWorkerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            addLogMessage(`[Main] Received K-Means worker message: ${type}`); // Log messages

            switch (type) {
                case 'kmeansComplete':
                    // This case is no longer used with manual steps
                    addLogMessage(`[Main] Received deprecated K-Means worker message: ${type}`, 'warn');
                    setIsClustering(false); // Still need to turn off flag if old worker somehow sends this
                    break;
                case 'initializationComplete':
                    const initPayload = payload as { iteration: number; initialCentroids: number[][]; initialAssignments: number[]; songIds: string[] };
                    setKmeansIteration(initPayload.iteration); // Should be 0
                    setKmeansCentroids(initPayload.initialCentroids);
                    const initAssignments: KmeansAssignments = {};
                    initPayload.songIds.forEach((id, index) => {
                        initAssignments[id] = initPayload.initialAssignments[index];
                    });
                    setKmeansAssignments(initAssignments);
                    setIsKmeansInitialized(true); // Mark as ready for next step
                    addLogMessage('K-Means worker initialized successfully. Ready for first step.', 'complete');
                    // --- NEW: Update Latest Stage ---
                    setLatestSuccessfulStage('kmeans');
                    addLogMessage('K-Means initialized. Updating latest stage to: kmeans', 'info');
                    // ----------------------------------
                    break;
                case 'stepComplete':
                    const stepPayload = payload as { iteration: number; centroids: number[][]; assignments: number[]; songIds: string[] };
                    setKmeansIteration(stepPayload.iteration);
                    setKmeansCentroids(stepPayload.centroids);
                    const stepAssignments: KmeansAssignments = {};
                    stepPayload.songIds.forEach((id, index) => {
                        stepAssignments[id] = stepPayload.assignments[index];
                    });
                    setKmeansAssignments(stepAssignments);
                    // Keep isKmeansInitialized as true
                    addLogMessage(`K-Means step ${stepPayload.iteration} complete.`, 'complete');
                    // --- NEW: Update Latest Stage ---
                    setLatestSuccessfulStage('kmeans');
                    addLogMessage(`K-Means step ${stepPayload.iteration} complete. Updating latest stage to: kmeans`, 'info');
                    // ----------------------------------
                    break;
                case 'resetComplete':
                    addLogMessage('K-Means worker state reset confirmed.', 'info');
                    // State reset should happen on the main thread side when reset is requested
                    break;
                case 'kmeansError':
                    setIsClustering(false);
                    setIsKmeansInitialized(false); // Reset initialized flag on error
                    addLogMessage(`K-Means Worker Error: ${payload.error}`, 'error');
                    setKmeansAssignments({});
                    setKmeansCentroids([]);
                    setKmeansIteration(0);
                    break;
                default:
                    addLogMessage(`Unknown message type from K-Means worker: ${type}`, 'warn');
            }
        };

        kmeansWorkerRef.current.onerror = (error) => {
            addLogMessage(`K-Means Worker onerror: ${error?.message || 'Unknown error'}`, 'error');
            setIsClustering(false);
            setKmeansAssignments({});
            setKmeansCentroids([]);
            setKmeansIteration(0);
        };
    }

    // Initialize Data Processing Worker
    if (!dataProcessingWorkerRef.current) {
        addLogMessage('Creating Data Processing Bundled Worker...', 'info');
        dataProcessingWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/data-processing-worker.bundled.js');

        dataProcessingWorkerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            addLogMessage(`[Main] Received Data Processing worker message: ${type}`);

            switch (type) {
                case 'processingComplete':
                    // --- Update state on processing complete --- 
                    setProcessedData({ vectors: payload.processedVectors, songIds: payload.songIds });
                    addLogMessage(`Data processing complete. Stored ${payload.processedVectors?.length} processed vectors.`, 'complete');
                    // --- NEW: Reset K-Means as reprocessing invalidates it ---
                    handleResetKmeans(); 
                    // ----------------------------------------------------------
                    // --- NEW: Update Latest Stage ---
                    setLatestSuccessfulStage('processed');
                    addLogMessage('Data processing complete. Updating latest stage to: processed', 'info');
                    // ----------------------------------
                    setIsProcessingData(false);
                    break;
                case 'processingError':
                    // --- Update state on processing error --- 
                    addLogMessage(`Data Processing Worker Error: ${payload.error}`, 'error');
                    setProcessedData(null); // Clear processed data on error
                    setIsProcessingData(false);
                     // Keep unprocessedData as it might still be useful or user might retry
                    // ----------------------------------------
                    break;
                case 'dataProcessingWorkerReady':
                     addLogMessage('Data Processing worker reported ready.', 'complete');
                     break;
                default:
                    addLogMessage(`Unknown message type from Data Processing worker: ${type}`, 'warn');
            }
        };

        dataProcessingWorkerRef.current.onerror = (error) => {
            addLogMessage(`Error in Data Processing Worker: ${error?.message || 'Unknown error'}`, 'error');
            // --- Update state on worker error --- 
            setProcessedData(null);
            setIsProcessingData(false);
            // -----------------------------------
        };
    }

    // Cleanup function
    return () => {
      if (workerRef.current) {
        addLogMessage('Terminating Essentia Worker...', 'info');
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (druidWorkerRef.current) {
          addLogMessage('Terminating Druid Worker...', 'info');
          druidWorkerRef.current.terminate();
          druidWorkerRef.current = null;
      }
      if (kmeansWorkerRef.current) {
          addLogMessage('Terminating K-Means worker...', 'info');
          kmeansWorkerRef.current.terminate();
          kmeansWorkerRef.current = null;
      }
      if (dataProcessingWorkerRef.current) {
          addLogMessage('Terminating Data Processing Worker...', 'info');
          dataProcessingWorkerRef.current.terminate();
          dataProcessingWorkerRef.current = null;
      }
      // Close AudioContext if no longer needed elsewhere
      // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      //   addLogMessage('Closing AudioContext...');
      //   audioContextRef.current.close();
      // }
    };
  }, [addLogMessage]); // Add addLogMessage to dependency array

  // --- Fetch Explanations on Mount ---
  useEffect(() => {
    addLogMessage('Fetching feature explanations...', 'info');
    fetch('/featureExplanations.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setExplanations(data);
        addLogMessage('Feature explanations loaded successfully.', 'complete');
      })
      .catch(error => {
        console.error('Error fetching feature explanations:', error);
        addLogMessage(`Failed to load feature explanations: ${error.message}`, 'error');
        setExplanations({}); // Set to empty object to indicate loading failed but allow UI to proceed
      });

    // --- NEW: Fetch Algorithm Explanations ---
    addLogMessage('Fetching algorithm explanations...', 'info');
    fetch('/algorithmExplanations.json')
      .then(response => {
          if (!response.ok) {
              // Handle 404 specifically as just 'not found', not necessarily a hard error
              if (response.status === 404) {
                  addLogMessage('Algorithm explanations file not found (404).', 'warn');
                  return {}; // Return empty object if not found
              }
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
      })
      .then(data => {
          setAlgorithmExplanations(data);
          if (Object.keys(data).length > 0) {
              addLogMessage('Algorithm explanations loaded successfully.', 'complete');
          } else {
              addLogMessage('Algorithm explanations file was empty or not found.', 'info');
          }
      })
      .catch(error => {
          console.error('Error fetching algorithm explanations:', error);
          addLogMessage(`Failed to load algorithm explanations: ${error.message}`, 'error');
          setAlgorithmExplanations({}); // Set to empty object on error
      });
    // ---------------------------------------

  }, [addLogMessage]); // Run once on mount

  // --- NEW: Load Cache on Mount ---
  useEffect(() => {
    const loadCache = async () => {
      setCacheStatus('loading');
      addLogMessage('[Cache Init] Loading feature cache /default_features.json...', 'info');
      try {
        const response = await fetch('/default_features.json'); // Ensure path is correct relative to public dir
        if (!response.ok) {
          if (response.status === 404) {
            addLogMessage('[Cache Init] Cache file not found (404). Proceeding without cache.', 'info');
            setCacheStatus('error'); // Treat as error state for clarity
            setCacheData(null);
          } else {
            throw new Error(`Cache fetch failed: ${response.statusText}`);
          }
          return; // Exit if fetch failed or 404
        }

        const rawData = await response.json();

        // Validation (Assuming new structure with 'availableDataKeys' and 'songData')
        if (!rawData || !rawData.songData || typeof rawData.songData !== 'object' || !rawData.availableDataKeys || !Array.isArray(rawData.availableDataKeys)) {
           addLogMessage('[Cache Init] Cache file format invalid. Expected { availableDataKeys: [], songData: {} }.', 'warn');
           setCacheStatus('error');
           setCacheData(null);
           return;
        }

        // Store parsed data
        const parsedCache: CacheData = {
            // Ensure keys are correctly typed
            availableDataKeys: new Set(rawData.availableDataKeys as (keyof Features)[]),
            songData: rawData.songData as Record<string, Features>
        };

        // Optional: Deeper validation (e.g., check if songData keys match Features interface) could be added here

        setCacheData(parsedCache);
        setCacheStatus('loaded');
        addLogMessage(`[Cache Init] Feature cache loaded successfully. ${parsedCache.availableDataKeys.size} data keys available.`, 'complete');

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLogMessage(`[Cache Init] Failed to load or parse cache: ${errorMessage}.`, 'error');
        setCacheStatus('error');
        setCacheData(null); // Ensure cache is null on error
      }
    };

    loadCache();
  }, [addLogMessage]); // Run once on mount (addLogMessage is stable via useCallback)
  // --- END NEW ---

  // MOVE: Move handleResetKmeans definition here
  const handleResetKmeans = useCallback((sendMessageToWorker = true) => {
      addLogMessage('Resetting K-Means state on main thread...', 'info');
      setIsClustering(false);
      setIsKmeansInitialized(false);
      setKmeansIteration(0);
      setKmeansCentroids([]);
      setKmeansAssignments({});

      // Optionally send reset message to worker
      if (sendMessageToWorker && kmeansWorkerRef.current) {
          addLogMessage('Sending reset command to K-Means worker...', 'info');
          kmeansWorkerRef.current.postMessage({ type: 'resetTraining' });
      }
      // When explicitly resetting K-Means, revert stage to highest valid previous stage
      // Need to re-calculate these inside the callback or pass them as arguments
      // For simplicity, we recalculate based on current state accessible here
      const currentHasReduced = Array.from(activeSongIds).some(id => reducedDataPoints[id] != null);
      const currentHasProcessed = processedData != null && processedData.vectors.length > 0;
      const currentHasFeatures = Array.from(activeSongIds).some(id => featureStatus[id] === 'complete' && songFeatures[id] != null);
      
      if (currentHasReduced) {
          setLatestSuccessfulStage('reduced');
      } else if (currentHasProcessed) {
          setLatestSuccessfulStage('processed');
      } else if (currentHasFeatures) {
          setLatestSuccessfulStage('features');
      } else {
          setLatestSuccessfulStage(null);
      }
  // UPDATE dependencies for recalculation
  }, [kmeansWorkerRef, addLogMessage, setIsClustering, setIsKmeansInitialized, 
      setKmeansIteration, setKmeansCentroids, setKmeansAssignments, 
      activeSongIds, reducedDataPoints, processedData, featureStatus, songFeatures, 
      setLatestSuccessfulStage]);

  // --- MODIFIED: Feature Extraction Completion Check useEffect ---
  useEffect(() => {
    // Check if we have target IDs and if the featureStatus state is available
    if (initialTargetSongIdsRef.current.size === 0 || !featureStatus) return;

    // Add log for when the check starts
    // addLogMessage(`[Completion Check] Running for ${initialTargetSongIdsRef.current.size} target songs...`, 'info');

    // Check if all target songs have reached a final state ('complete' or 'error')
    let allTargetsProcessed = true;
    for (const songId of initialTargetSongIdsRef.current) {
      const status = featureStatus[songId];
      if (status !== 'complete' && status !== 'error') {
        allTargetsProcessed = false;
        break;
      }
    }

    // If not all targets are processed, do nothing yet
    if (!allTargetsProcessed) {
      // addLogMessage('[Completion Check] Not all targets processed yet.', 'info');
      return;
    }

    // --- All target songs have completed or errored ---
    addLogMessage('[Completion Check] All target songs have completed or errored.', 'complete');

    // Calculate duration only if the worker was actually used (start time was set)
    const startTime = extractionStartTimeRef.current;
    let durationMessage = 'Feature acquisition complete.';
    if (startTime) {
      const endTime = performance.now();
      const durationMs = endTime - startTime;
      durationMessage = `Total worker feature extraction time for the batch: ${(durationMs / 1000).toFixed(2)} seconds.`;
      extractionStartTimeRef.current = null; // Reset timer only if it was used
    }
    addLogMessage(durationMessage, 'complete');

    // --- Logic moved from old effect block ---
    setIsProcessing(false); // Ensure processing flag is off
    setProcessingSongIds(new Set()); // Clear the worker processing batch IDs

    // Recalculate active features based on the FINAL state after cache/extraction
    const finalActiveFeatures: { id: string; features: Features }[] = [];
    initialTargetSongIdsRef.current.forEach(id => {
      // Check if the song is still active AND features are complete
      if (activeSongIds.has(id)) { 
        const features = songFeatures[id];
        const status = featureStatus[id];
        if (features && status === 'complete') {
          finalActiveFeatures.push({ id, features });
        }
      }
    });

    // Automatically generate raw data matrix if possible
    if (finalActiveFeatures.length > 0) {
        addLogMessage('Automatically preparing raw data matrix after feature acquisition...', 'info');
        const matrixResult = prepareMatrix(finalActiveFeatures, addLogMessage);
        if (matrixResult) {
            setUnprocessedData(matrixResult);
            addLogMessage('Raw data matrix successfully prepared.', 'complete');
            // Set the latest stage AFTER preparing the matrix
            setLatestSuccessfulStage('features'); 
            addLogMessage('Feature acquisition complete. Updating latest stage to: features', 'info');
        } else {
             addLogMessage('Failed to prepare raw data matrix automatically.', 'warn');
             // Set stage to null if matrix prep failed but features were theoretically done
             setLatestSuccessfulStage(null);
        }
    } else {
        // If no features completed successfully for active songs, reset stage
        setUnprocessedData(null); // Clear any old matrix
        setLatestSuccessfulStage(null);
        addLogMessage('No features completed successfully for active songs.', 'warn');
    }

    // --- Determine and set available feature keys ---
    let commonKeysSet = new Set<keyof Features>();
    let firstSongFeaturesChecked = false;
    finalActiveFeatures.forEach(({ features }) => { // Use finalActiveFeatures
      const currentKeys = Object.keys(features) as (keyof Features)[];
      if (!firstSongFeaturesChecked) {
        commonKeysSet = new Set(currentKeys);
        firstSongFeaturesChecked = true;
      } else {
        commonKeysSet.forEach(key => {
          if (!currentKeys.includes(key)) {
            commonKeysSet.delete(key);
          }
        });
      }
    });

    if (!firstSongFeaturesChecked) {
      setAvailableFeatureKeys(null);
      addLogMessage('No completed features found for active songs to determine available keys.', 'warn');
    } else {
      const finalKeysArray = Array.from(commonKeysSet);
      setAvailableFeatureKeys(finalKeysArray);
      addLogMessage(`Available feature keys updated: [${finalKeysArray.join(', ')}]`, 'info');
    }
    
    // --- TEMPORARY CODE START (Cache Generation Logging) ---
    // Keep this logic as is, potentially refining the condition later if needed.
    const onlyDefaultSongs = songs.every(s => s.source === 'default');
    if (onlyDefaultSongs && songs.length === defaultSongs.length) {
        console.log("=== COPY FEATURE DATA BELOW ===");
        console.log(JSON.stringify(songFeatures, null, 2)); 
        console.log("=== COPY FEATURE DATA ABOVE ===");
        addLogMessage('Default song features logged (may include cache data).', 'info');
    }
    // --- TEMPORARY CODE END ---

    // --- Clear the initial target set ---
    addLogMessage('[Completion Check] Clearing target song ID reference.', 'info');
    initialTargetSongIdsRef.current = new Set(); 

  // Dependencies: Listen for changes in featureStatus to re-evaluate completion.
  // Also include states read inside (activeSongIds, songFeatures) and setters used.
  // handleResetKmeans is NOT called here anymore, it's called *before* extraction starts.
  }, [
      featureStatus, activeSongIds, songFeatures, songs, // State read
      addLogMessage, setAvailableFeatureKeys, setIsProcessing, setProcessingSongIds, 
      setUnprocessedData, setLatestSuccessfulStage // Setters/Callbacks
      // Removed: isProcessing, processingSongIds, extractionStartTimeRef (refs don't trigger effects)
      // Removed: handleResetKmeans (called earlier now)
  ]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newSongs: Song[] = [];
    const currentSongIds = new Set(songs.map(s => s.id)); // Use ID for checking duplicates
    const newActiveIds = new Set<string>();
    let addedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/')) {
        const objectURL = URL.createObjectURL(file);
        // Simple check if ID (objectURL) already exists - less robust than name but ok for demo
        if (!currentSongIds.has(objectURL)) {
            const newSong = {
               id: objectURL, // Use object URL as a unique ID
               name: file.name,
               url: objectURL,
               source: 'user' as const, // Use as const assertion
            };
            newSongs.push(newSong);
            newActiveIds.add(newSong.id); // Make newly added songs active by default
            currentSongIds.add(objectURL); // Add to current set to prevent duplicates within the same upload batch
            addedCount++;
        } else {
            skippedCount++;
            URL.revokeObjectURL(objectURL); // Revoke URL if song is skipped
        }
        // Note: We might want to revoke object URLs later when they're no longer needed
        // URL.revokeObjectURL(objectURL);
      } else {
          skippedCount++;
          addLogMessage(`Skipped non-audio file: ${file.name}`, 'warn');
      }
    }

    if (newSongs.length > 0) {
      setSongs(prevSongs => [...prevSongs, ...newSongs]);
      setActiveSongIds(prevActive => new Set([...prevActive, ...newActiveIds])); // Add new song IDs to active set
      // Reset status for new songs
      const newStatus = newSongs.reduce((acc, song) => {
          acc[song.id] = 'idle';
          return acc;
      }, {} as Record<string, FeatureStatus>);
      setFeatureStatus(prev => ({...prev, ...newStatus}));
      addLogMessage(`Added ${addedCount} new song(s).`, 'complete');
    }
     if (skippedCount > 0) {
        addLogMessage(`Skipped ${skippedCount} file(s) (duplicates or non-audio).`, 'warn');
     }

    // Reset file input to allow selecting the same file again if removed
    event.target.value = '';
  };

  const handleRemoveSong = (songIdToRemove: string) => {
    const songToRemove = songs.find(song => song.id === songIdToRemove);
    const songName = songToRemove?.name || songIdToRemove; // Use name if available

    setSongs(prevSongs => prevSongs.filter(song => song.id !== songIdToRemove));
    // Also remove features and status
    setSongFeatures(prev => {
        const newState = { ...prev };
        delete newState[songIdToRemove];
        return newState;
    });
    setFeatureStatus(prev => {
        const newState = { ...prev };
        delete newState[songIdToRemove];
        return newState;
    });
    // Remove from active set as well
    setActiveSongIds(prevActive => {
      const newActive = new Set(prevActive);
      newActive.delete(songIdToRemove);
      return newActive;
    });
    // Remove from reduced data
    setReducedDataPoints(prev => {
        const newState = { ...prev };
        delete newState[songIdToRemove];
        return newState;
    });
     // Remove from K-Means assignments
    setKmeansAssignments(prev => {
        const newState = { ...prev };
        delete newState[songIdToRemove];
        return newState;
    });

    // Remove from new processing states as well
    setUnprocessedData(prev => {
        if (!prev) return null;
        const songIndex = prev.songIds.indexOf(songIdToRemove);
        if (songIndex === -1) return prev;
        const newVectors = prev.vectors.filter((_, index) => index !== songIndex);
        const newSongIds = prev.songIds.filter(id => id !== songIdToRemove);
        return newVectors.length > 0 ? { vectors: newVectors, songIds: newSongIds, isOHEColumn: prev.isOHEColumn } : null;
    });
    setProcessedData(prev => {
        if (!prev) return null;
        const songIndex = prev.songIds.indexOf(songIdToRemove);
        if (songIndex === -1) return prev;
        const newVectors = prev.vectors.filter((_, index) => index !== songIndex);
        const newSongIds = prev.songIds.filter(id => id !== songIdToRemove);
        return newVectors.length > 0 ? { vectors: newVectors, songIds: newSongIds } : null;
    });

    // Revoke object URL if it's a user-uploaded file being removed
    if (songToRemove && songToRemove.source === 'user') {
        URL.revokeObjectURL(songToRemove.url);
        addLogMessage(`Removed user song: ${songName} and revoked URL.`, 'complete');
    } else if (songToRemove) {
        addLogMessage(`Removed default song: ${songName}.`, 'complete');
    }

    // --- NEW: Reset available keys as the common set might change --- 
    setAvailableFeatureKeys(null);
    addLogMessage('Reset available feature keys due to song removal.', 'info');
    // Note: A more sophisticated approach would re-calculate common features here.
    // -----------------------------------------------------------------
  };

  // Handler to toggle a song's active state
  const handleToggleSongActive = (songId: string) => {
    setActiveSongIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
        addLogMessage(`Deselected song: ${getSongNameById(songId)} (ID: ${songId.substring(0, 8)}...)`, 'info');
      } else {
        newSet.add(songId);
        addLogMessage(`Selected song: ${getSongNameById(songId)} (ID: ${songId.substring(0, 8)}...)`, 'info');
      }
      return newSet;
    });
  };

  // Helper to get song name by ID for logging
  const getSongNameById = useCallback((id: string): string => {
      return songs.find(s => s.id === id)?.name || id; // Return ID if name not found
  }, [songs]);

  // --- Select/Clear All Handlers ---
  const handleSelectAll = useCallback(() => {
    setActiveSongIds(new Set(songs.map(song => song.id)));
    addLogMessage(`Selected all ${songs.length} songs.`, 'info');
  }, [songs, addLogMessage]);

  const handleClearAll = useCallback(() => {
    setActiveSongIds(new Set());
    addLogMessage('Cleared all song selections.', 'info');
  }, [addLogMessage]);
  // --------------------------------

  // Handler to trigger the hidden file input
  const handleUploadClick = () => {
      addLogMessage('Upload button clicked, triggering file input.', 'complete');
      fileInputRef.current?.click();
  };

  // Function to fetch and decode audio
  const getDecodedAudio = useCallback(async (song: Song): Promise<AudioBuffer | null> => {
      if (!audioContextRef.current) {
          addLogMessage('AudioContext not initialized', 'error');
          return null;
      }
      try {
          addLogMessage(`Fetching audio for ${song.name}...`, 'info');
          const response = await fetch(song.url);
          if (!response.ok) {
              throw new Error(`Failed to fetch audio: ${response.statusText} (URL: ${song.url})`);
          }
          const arrayBuffer = await response.arrayBuffer();
          addLogMessage(`Decoding audio for ${song.name}...`, 'info');
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          addLogMessage(`Successfully decoded audio for ${song.name}.`, 'complete');
          return audioBuffer;
      } catch (error: unknown) { // <-- Explicitly type error as unknown
          // Type check before accessing message
          const errorMessage = error instanceof Error ? error.message : String(error);
          addLogMessage(`Error decoding audio for ${song.name}: ${errorMessage}`, 'error');
          setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
          return null;
      }
  }, [addLogMessage]); // Add addLogMessage dependency

  // --- Add New Songs Handler (for Drop and potentially future additions) ---
  const handleAddSongs = useCallback((newSongsToAdd: Song[]) => {
    const currentSongIds = new Set(songs.map(s => s.id));
    const addedSongs: Song[] = [];
    const newActiveIds = new Set<string>();
    let skippedCount = 0;

    newSongsToAdd.forEach(newSong => {
      if (!currentSongIds.has(newSong.id)) {
        addedSongs.push(newSong);
        newActiveIds.add(newSong.id); // Make newly added songs active by default
        currentSongIds.add(newSong.id); // Add to current set to prevent duplicates within the same batch
      } else {
        skippedCount++;
        // Revoke URL if song is skipped immediately (important for dropped files)
        URL.revokeObjectURL(newSong.url); 
      }
    });

    if (addedSongs.length > 0) {
      setSongs(prevSongs => [...prevSongs, ...addedSongs]);
      setActiveSongIds(prevActive => new Set([...prevActive, ...newActiveIds]));
      // Reset status for new songs
      const newStatus = addedSongs.reduce((acc, song) => {
          acc[song.id] = 'idle';
          return acc;
      }, {} as Record<string, FeatureStatus>);
      setFeatureStatus(prev => ({...prev, ...newStatus}));
      addLogMessage(`Added ${addedSongs.length} new song(s) via drop.`, 'complete');
    }
    if (skippedCount > 0) {
       addLogMessage(`Skipped ${skippedCount} dropped file(s) (duplicates or non-audio).`, 'warn');
    }
  }, [songs, addLogMessage]); // Dependencies: songs for duplicate check, addLogMessage

  // --- NEW: Audio Player Callbacks ---
  const handlePlayRequest = useCallback((songId: string) => {
    addLogMessage(`Play requested for song: ${getSongNameById(songId)}`, 'info');
    setCurrentlyPlayingSongId(songId);
    setIsPlaying(true);
  }, [addLogMessage, getSongNameById]); // Add getSongNameById dependency

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
  }, [addLogMessage, currentlyPlayingSongId, getSongNameById]); // Add dependencies

  const handleSongEnd = useCallback(() => {
    if (currentlyPlayingSongId) {
       addLogMessage(`Song finished: ${getSongNameById(currentlyPlayingSongId)}`, 'complete');
       setIsPlaying(false);
       // Optionally clear the song or move to next:
       // setCurrentlyPlayingSongId(null);
    }
  }, [addLogMessage, currentlyPlayingSongId, getSongNameById]); // Add dependencies
  // --- End Audio Player Callbacks ---

  // --- REFACTORED: Function to trigger feature extraction for *active* songs ---
  const handleExtractFeatures = useCallback(async (selectedFeatures: Set<string>) => {
    // selectedFeatures contains the user-facing IDs like 'mfcc', 'energy'
    addLogMessage(`[Extract Start] Requesting features [${[...selectedFeatures].join(', ')}] for ${activeSongIds.size} active songs...`, 'info');
    const currentActiveIds = new Set(activeSongIds);
    initialTargetSongIdsRef.current = currentActiveIds;

    // --- Preliminary Checks ---
    if (!essentiaWorkerReady || !workerRef.current) {
        addLogMessage('Worker not ready. Extraction aborted.', 'warn');
        initialTargetSongIdsRef.current = new Set();
        return;
    }
    if (isProcessing) {
        addLogMessage('Another feature acquisition process is already running.', 'warn');
        return;
    }
    if (selectedFeatures.size === 0) {
        addLogMessage('[Extract Abort] No features selected.', 'warn');
        initialTargetSongIdsRef.current = new Set();
        return;
    }
    if (currentActiveIds.size === 0) {
        addLogMessage('[Extract Abort] No active songs selected.', 'warn');
        initialTargetSongIdsRef.current = new Set();
        return;
    }

    // --- Clear Downstream State ---
    addLogMessage('[Extract Prep] Clearing previous processed data and downstream results...', 'info');
    setAvailableFeatureKeys(null); // Reset keys before determining new set
    setUnprocessedData(null);
    setProcessedData(null);
    setReducedDataPoints({});
    handleResetKmeans(); // Reset K-Means state and worker
    setReductionDimensions(0);
    const initialStatusUpdates = Array.from(currentActiveIds).reduce((acc, songId) => {
        acc[songId] = 'idle';
        return acc;
    }, {} as Record<string, FeatureStatus>);
    const initialFeatureUpdates = Array.from(currentActiveIds).reduce((acc, songId) => {
        acc[songId] = null;
        return acc;
    }, {} as Record<string, Features | null>);
    setFeatureStatus(prev => ({ ...prev, ...initialStatusUpdates }));
    setSongFeatures(prev => ({ ...prev, ...initialFeatureUpdates }));
    // -------------------------------------------------------

    // --- Cache Check & Validation (Using Stored Cache) ---
    let isCacheApplicable = false;
    const requiredDataKeys = new Set<keyof Features>();

    // 1. Determine all required actual data keys based on user selection and mapping
    selectedFeatures.forEach(featureId => {
        const dataKeys = featureIdToDataKeysMap.get(featureId);
        if (dataKeys) {
            dataKeys.forEach(key => requiredDataKeys.add(key));
        } else {
            addLogMessage(`[Cache Prep] Warning: No mapping found for selected feature ID: ${featureId}`, 'warn');
        }
    });
    if (requiredDataKeys.size > 0) {
         addLogMessage(`[Cache Prep] Required data keys for this run: [${Array.from(requiredDataKeys).join(', ')}]`, 'info');
    } else {
         addLogMessage(`[Cache Prep] No required data keys determined from selection.`, 'warn');
    }


    // 2. Check if loaded cache has all required keys
    if (cacheStatus === 'loaded' && cacheData && requiredDataKeys.size > 0) {
        isCacheApplicable = true; // Assume true initially
        for (const requiredKey of requiredDataKeys) {
            if (!cacheData.availableDataKeys.has(requiredKey)) {
                isCacheApplicable = false;
                addLogMessage(`[Cache Check] Cache skipped: Required data key '${requiredKey}' not found in cache's available keys.`, 'info');
                // Optional: Log which key was missing
                break; // Stop checking once one key is missing
            }
        }
        if (isCacheApplicable) {
            addLogMessage('[Cache Check] Cache is applicable: All required data keys are available.', 'complete');
        }
    } else if (cacheStatus !== 'loaded' || !cacheData) {
        addLogMessage('[Cache Check] Cache not loaded or unavailable. Skipping cache check.', 'info');
        // isCacheApplicable remains false
    } else {
        // requiredDataKeys.size === 0 case
         addLogMessage('[Cache Check] No required data keys determined, cannot use cache.', 'info');
         // isCacheApplicable remains false
    }
    // --- End Cache Check ---

    // --- Categorize Songs and Apply Cache (If Applicable) ---
    const songIdsToExtract = new Set<string>();
    const cachedFeaturesToAdd: Record<string, Features> = {};
    const statusUpdatesFromCache: Record<string, FeatureStatus> = {};
    let cacheAppliedCount = 0;
    const songMap = new Map(songs.map(s => [s.id, s]));

    for (const songId of currentActiveIds) {
        const song = songMap.get(songId);
        if (!song) continue;

        let useCache = false;
        // Check conditions: Is cache applicable overall? Is this a default song? Does the song exist in cache data?
        if (isCacheApplicable && cacheData && song.source === 'default' && cacheData.songData[songId]) {
            useCache = true;
        }

        if (useCache) {
            // --- Apply Cache (using stored data and required keys) ---
            const songCacheData = cacheData!.songData[songId]; // We know cacheData exists here
            const featuresToApply: Partial<Features> = {};

            requiredDataKeys.forEach(dataKey => {
                // Directly copy the required key if it exists in this specific song's cache data
                // Using hasOwnProperty for safer checking
                if (Object.prototype.hasOwnProperty.call(songCacheData, dataKey)) {
                    const value = songCacheData[dataKey];
                    // Explicitly check if the value is not undefined before assigning
                    if (value !== undefined) {
                         // Use type assertion as the value is now confirmed not undefined
                        // featuresToApply[dataKey] = value as Features[typeof dataKey];
                        // Bypass strict type check for this assignment using 'any'
                        (featuresToApply as any)[dataKey] = value;
                    }
                } else {
                    // Optional: Warn if a required key is missing for a specific song
                    // addLogMessage(`[Cache Apply] Warning: Required key '${dataKey}' missing in cache for song ${songId}`, 'warn');
                }
            });

            // Apply only if some features were actually found for this song
            if (Object.keys(featuresToApply).length > 0) {
                cachedFeaturesToAdd[songId] = featuresToApply;
                statusUpdatesFromCache[songId] = 'complete';
                cacheAppliedCount++;
            } else {
                addLogMessage(`[Cache Apply] Warning: No features found in cache for song ${songId} despite cache being applicable. Sending to worker.`, 'warn');
                songIdsToExtract.add(songId); // Fallback to worker
            }
        } else {
            // Song is user-uploaded OR cache is not applicable OR song not in cache
            songIdsToExtract.add(songId);
        }
    }

    // Apply cached data immediately
    if (cacheAppliedCount > 0) {
        addLogMessage(`[Cache Apply] Applying cached features for ${cacheAppliedCount} song(s)...`, 'complete');
        setSongFeatures(prev => ({ ...prev, ...cachedFeaturesToAdd }));
        setFeatureStatus(prev => ({ ...prev, ...statusUpdatesFromCache }));
    }
    if (songIdsToExtract.size > 0) {
      addLogMessage(`[Cache Apply] ${songIdsToExtract.size} active song(s) identified for worker extraction.`, 'info');
    } else {
      addLogMessage('[Cache Apply] No songs require worker extraction (all cached or inactive).', 'info');
    }
    // --- End Categorization & Application ---

    // --- Conditional Worker Trigger ---
    if (songIdsToExtract.size > 0) {
        addLogMessage(`[Worker Start] Initializing worker process for ${songIdsToExtract.size} songs...`, 'info');
        extractionStartTimeRef.current = performance.now();
        setIsProcessing(true); // Set processing flag only if worker is needed

        const songsToProcess = songs.filter(song => songIdsToExtract.has(song.id));
        setProcessingSongIds(new Set(songsToProcess.map(s => s.id)));

        const workerStatusUpdates = songsToProcess.reduce((acc, song) => {
            acc[song.id] = 'processing';
            return acc;
        }, {} as Record<string, FeatureStatus>);
        setFeatureStatus(prev => ({ ...prev, ...workerStatusUpdates }));

        // --- Loop and send to worker (existing logic here is fine) ---
        for (const song of songsToProcess) {
          // ... (keep existing getDecodedAudio call and postMessage logic) ...
            addLogMessage(`[Worker Send] Requesting features for ${song.name}...`, 'info');
            const audioBuffer = await getDecodedAudio(song);

            if (audioBuffer && workerRef.current) {
                try {
                   const audioData = audioBuffer.getChannelData(0);
                   const audioVector = Array.from(audioData);
                   console.log(`[Page Debug ${song.name}] Decoded Sample Rate: ${audioBuffer.sampleRate}`);
                   workerRef.current.postMessage({
                      type: 'extractFeatures',
                      payload: {
                          songId: song.id,
                          audioVector: audioVector,
                          sampleRate: audioBuffer.sampleRate,
                          // Pass the original user-selected feature IDs ('mfcc', etc.)
                          // The worker needs to know what high-level features to compute
                          featuresToExtract: [...selectedFeatures]
                      }
                  });
                } catch (postMessageError: unknown) {
                   const errorMsg = postMessageError instanceof Error ? postMessageError.message : String(postMessageError);
                   addLogMessage(`Error preparing or sending data to worker for ${song.name}: ${errorMsg}`, 'error');
                   setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
                }
            } else if (workerRef.current) {
                addLogMessage(`Skipping worker request for ${song.name} (decode error). Status set to 'error' by getDecodedAudio.`, 'warn');
            }
        }
        // --- End Worker Loop ---
    } else {
        // --- Handle Case: All features loaded from cache ---
        addLogMessage('[Worker Skip] All required features loaded from cache or no active songs require extraction. No worker process needed.', 'complete');
        setIsProcessing(false);
        setProcessingSongIds(new Set());
        extractionStartTimeRef.current = null;

        // The useEffect completion check hook will now detect that all songs
        // in initialTargetSongIdsRef.current have status 'complete' (or 'error' if cache apply failed somehow)
        // and will trigger the finalization steps (like prepareMatrix).
        addLogMessage('[Worker Skip] Relying on useEffect completion check to finalize processing steps.', 'info');
    }
    // --- End Conditional Worker Trigger ---

  }, [
      // Dependencies: States read
      songs, activeSongIds, essentiaWorkerReady, isProcessing,
      cacheStatus, cacheData, // <-- NEW Cache states
      // Dependencies: Callbacks/Setters used
      addLogMessage, setAvailableFeatureKeys, setUnprocessedData, setProcessedData,
      setReducedDataPoints, handleResetKmeans, setReductionDimensions,
      setFeatureStatus, setSongFeatures, setIsProcessing, setProcessingSongIds,
      // Dependencies: Refs used
      workerRef,
      // Dependencies: Helper functions
      getDecodedAudio
      // featureIdToDataKeysMap is a constant, no dependency needed
      // initialTargetSongIdsRef, extractionStartTimeRef are refs
  ]);
  // --- End REFACTORED handleExtractFeatures ---

  // --- NEW Handler to Trigger Data Processing ---
  const handleStartDataProcessing = useCallback((method: ProcessingMethod, range?: [number, number]) => {
    // --- REMOVED: Incorrect reset of available keys --- 
    // If we re-process, the available features might change based on active songs 
    // It might be safer to nullify this here, although it should be recalculated 
    // during the prepareMatrix step conceptually. Let's keep it null for now. 
    // setAvailableFeatureKeys(null); // REMOVED: This was causing the issue!
    // Note: availableFeatureKeys is NOT reset here because the feature keys and their
    // order remain the same for both unprocessed and processed data.
    // VisualizationPanel uses availableFeatureKeys to interpret the structure of both matrices.
    
    // Checks for worker readiness and other active processes
    if (!dataProcessingWorkerRef.current || isProcessing || isReducing) {
        addLogMessage('Cannot start data processing: Worker not ready or MIR/Reduction process is active.', 'warn');
        return;
    }
    // Add a log if already processing, but allow queueing
    if (isProcessingData) {
        addLogMessage('Data processing already in progress. New request will queue or overwrite.', 'info');
    }

    addLogMessage(`Preparing data for processing method: ${method}...`, 'info');

    // Get features for active songs that are complete
    const activeFeatures: { id: string; features: Features }[] = [];
    let songsWithoutCompleteFeaturesCount = 0;
    activeSongIds.forEach(id => {
        const features = songFeatures[id];
        const status = featureStatus[id];
        if (features && status === 'complete') {
            activeFeatures.push({ id, features });
        } else if (status !== 'complete') {
            songsWithoutCompleteFeaturesCount++;
        }
    });

    // Log skipped songs
    if (songsWithoutCompleteFeaturesCount > 0) {
        addLogMessage(`Skipping ${songsWithoutCompleteFeaturesCount} active song(s) without complete features for processing step.`, 'warn');
    }

    // Check if any features are available
    if (activeFeatures.length === 0) {
        addLogMessage('No active songs with successfully extracted features found for processing.', 'warn');
        return;
    }

    // Prepare the numerical matrix using the helper function
    const matrixResult = prepareMatrix(activeFeatures, addLogMessage);

    if (matrixResult) {
        // Store unprocessed data & clear downstream
        setUnprocessedData(matrixResult);
        setProcessedData(null);
        setReducedDataPoints({});
        handleResetKmeans();
        setReductionDimensions(0);
        // REMOVED: Incorrect reset here as well
        // setAvailableFeatureKeys(null); // REMOVED: This was incorrect
        addLogMessage('Stored unprocessed matrix. Cleared downstream results. Sending to worker...', 'info');

        // Set processing flag and send to worker
        setIsProcessingData(true);
        dataProcessingWorkerRef.current.postMessage({
            type: 'processData',
            payload: {
                vectors: matrixResult.vectors,
                songIds: matrixResult.songIds,
                isOHEColumn: matrixResult.isOHEColumn, // <-- Send OHE info
                method: method,
                ...(range && { range: range })
            }
        });
    } else {
        // Matrix preparation failed
        addLogMessage('Matrix preparation failed. Cannot proceed with data processing.', 'error');
        setUnprocessedData(null);
        setIsProcessingData(false);
    }

}, [
    // Direct state dependencies read in the function:
    activeSongIds, songFeatures, featureStatus, 
    isProcessingData, isProcessing, isReducing,
    // Callbacks/Refs used:
    addLogMessage, dataProcessingWorkerRef,
    // State setters used:
    setUnprocessedData, setProcessedData, setReducedDataPoints, 
    setKmeansAssignments, setKmeansCentroids, setKmeansIteration, 
    setReductionDimensions, setIsProcessingData,
    setAvailableFeatureKeys // Add new setter dependency
]);

  // --- MODIFIED Handler: Trigger dimensionality reduction ---
  const handleReduceDimensions = useCallback((reductionMethod: ReductionMethod, dimensions: number, params?: Record<string, unknown>) => { // <-- Change any to Record<string, unknown>
     // --- Check Preconditions ---
     // MODIFIED: Removed isClustering check. Allow reduction even if K-Means is active.
     // Prevent only if worker not ready, other processes running, or processedData missing.
     if (!druidWorkerRef.current || isProcessing || isProcessingData) {
         addLogMessage('Cannot reduce dimensions: Worker not ready or MIR/Data Processing is active.', 'warn');
         return;
     }
     // Add log if already reducing
     if (isReducing) {
         addLogMessage('Dimensionality reduction already in progress. New request will queue or overwrite.', 'info');
     }
     // Check for processed data *after* checking other processes
     if (!processedData || processedData.vectors.length === 0) {
         addLogMessage('No processed data available. Please run the Data Processing step first.', 'warn');
         return;
     }

     const { vectors: vectorsToReduce, songIds: idsForReduction } = processedData;

     // Basic check: Need more samples than dimensions
     if (vectorsToReduce.length <= dimensions) {
         addLogMessage(`Insufficient data points (${vectorsToReduce.length}) for ${dimensions} dimensions. Need more points than dimensions.`, 'warn');
         return;
     }
     
     // Check if target dimensions exceed source dimensions
     if (vectorsToReduce.length > 0 && dimensions >= vectorsToReduce[0].length) {
         addLogMessage(`Target dimensions (${dimensions}) must be less than source dimensions (${vectorsToReduce[0].length}). Aborting reduction.`, 'warn');
         return;
     }
     // --- Preconditions Met ---

     addLogMessage(`Starting dimensionality reduction with method: ${reductionMethod}, dimensions: ${dimensions}`, 'info');
     setIsReducing(true);
     // Clear previous reduced points for active songs and subsequent clustering results
     setReducedDataPoints(prev => {
         const clearedState = { ...prev };
         idsForReduction.forEach(id => delete clearedState[id]); // Clear only the points we are about to reduce
         return clearedState;
     });
     setKmeansAssignments({});
     setKmeansCentroids([]);
     setKmeansIteration(0);
     // Keep reductionDimensions state as it is, it will be updated on completion

     // Post message to worker using the processedData
     addLogMessage(`Sending ${vectorsToReduce.length} processed vectors to Druid worker for reduction...`, 'info');
     druidWorkerRef.current.postMessage({
         type: 'reduceDimensions',
         payload: {
             featureVectors: vectorsToReduce,
             songIds: idsForReduction,
             method: reductionMethod,
             dimensions: dimensions,
             ...(params && { ...params }) // Include optional params
         }
     });

 }, [
     processedData, isProcessing, isProcessingData, isReducing, 
     addLogMessage, druidWorkerRef,
     setIsReducing, setReducedDataPoints, setKmeansAssignments, setKmeansCentroids, setKmeansIteration,
     setAvailableFeatureKeys // Add new setter dependency
 ]);

  // --- Clustering Handler (handleRunClustering) ---
  const handleRunClustering = useCallback((k: number) => {
      // Check readiness and other processes
      if (!kmeansWorkerRef.current || isProcessing || isProcessingData || isReducing) {
          addLogMessage('Cannot start clustering: Another process is active or worker not ready.', 'warn');
          return;
      }

      // Filter reducedDataPoints for active songs and check dimensions
      const activeReducedData: { id: string, vector: number[] }[] = [];
      let skippedCount = 0;
      let dimensionMismatchCount = 0;
      const targetDim = reductionDimensions; // Capture current target dimension from state

      activeSongIds.forEach(id => {
          const vector = reducedDataPoints[id];
          if (vector && vector.length > 0) {
              // Use targetDim for check if it's > 0, otherwise just check if vector exists
              if (targetDim > 0 && vector.length !== targetDim) {
                  dimensionMismatchCount++;
              } else if (targetDim === 0 || vector.length === targetDim) { // Add check if targetDim is 0 (not yet set)
                  activeReducedData.push({ id, vector });
              }
          } else {
              skippedCount++;
          }
      });

      if (skippedCount > 0) {
          addLogMessage(`Skipping ${skippedCount} active songs without reduced data for clustering.`, 'warn');
      }
      if (dimensionMismatchCount > 0) {
          addLogMessage(`Skipping ${dimensionMismatchCount} active songs with mismatched dimensions (expected ${targetDim > 0 ? targetDim : 'any'}) for clustering.`, 'warn');
      }

      // Check if valid data exists
      if (activeReducedData.length === 0) {
          addLogMessage('No valid reduced data points found for active songs to cluster.', 'warn');
          return;
      }

      // Check k value
      if (k <= 0) {
          addLogMessage(`Invalid k value: ${k}. Must be greater than 0.`, 'warn');
          return;
      }
      if (activeReducedData.length < k) {
          addLogMessage(`Cannot cluster: Not enough data points (${activeReducedData.length}) for k=${k}. Need at least k points.`, 'warn');
          return;
      }

      // Prepare data for worker
      const dataForWorker = activeReducedData.map(d => d.vector);
      const idsForWorker = activeReducedData.map(d => d.id);

      addLogMessage(`Starting K-Means clustering with k=${k} for ${dataForWorker.length} points...`, 'info');
      setIsClustering(true);
      setKmeansIteration(0);
      setKmeansCentroids([]);
      setKmeansAssignments({});

      // Post message to worker (with null check already done)
      // Send Initialize message
      addLogMessage(`[Main] Sending 'initializeTraining' to K-Means worker with k=${k}...`, 'info'); // <-- Added Log
      kmeansWorkerRef.current.postMessage({
          type: 'initializeTraining', // <-- Fix: Send correct message type
          payload: {
              reducedData: dataForWorker,
              songIds: idsForWorker,
              k: k,
          }
      });

  }, [
      isProcessing, isProcessingData, isReducing, activeSongIds, reducedDataPoints, 
      reductionDimensions, addLogMessage, kmeansWorkerRef,
      setIsClustering, setKmeansIteration, setKmeansCentroids, setKmeansAssignments,
      setAvailableFeatureKeys // Add new setter dependency
  ]);

  // --- NEW: Handler to Trigger Next K-Means Step --- 
  const handleNextKmeansStep = useCallback(() => {
      // Check if initialized and worker exists
      if (!isKmeansInitialized || !kmeansWorkerRef.current) {
          addLogMessage('Cannot run next step: K-Means not initialized or worker unavailable.', 'warn');
          return;
      }
      if (isProcessing || isProcessingData || isReducing) {
          addLogMessage('Cannot run K-Means step while another process is active.', 'warn');
          return;
      }

      addLogMessage(`Requesting K-Means step ${kmeansIteration + 1}...`, 'info');
      kmeansWorkerRef.current.postMessage({ type: 'runNextStep' });

  }, [
      isKmeansInitialized, kmeansIteration, 
      isProcessing, isProcessingData, isReducing, // Check other processes
      addLogMessage, kmeansWorkerRef
  ]);

  // --- Derived State (Moved Before Handlers Using Them) ---
  const hasFeaturesForActiveSongs = useMemo(() => {
    return Array.from(activeSongIds).some(id =>
        featureStatus[id] === 'complete' && songFeatures[id] != null
    );
  }, [activeSongIds, featureStatus, songFeatures]);

  const hasProcessedData = useMemo(() => {
      return processedData != null && processedData.vectors.length > 0;
  }, [processedData]);

  const hasReducedDataForActiveSongs = useMemo(() => {
      const targetDim = reductionDimensions;
      return Array.from(activeSongIds).some(id => {
          const point = reducedDataPoints[id];
          return point != null && point.length > 0 && (targetDim === 0 || point.length === targetDim);
      });
  }, [activeSongIds, reducedDataPoints, reductionDimensions]);

  // Filter logs for display in the panel
  const filteredLogMessages = useMemo(() => {
      return logMessages.filter(log => 
          log.level === 'warn' || log.level === 'error' || log.level === 'complete'
      );
  }, [logMessages]);

  // --- Details Dialog Handlers ---
  const handleShowDetails = useCallback((songId: string) => {
    addLogMessage(`Showing details for song ID: ${songId}`, 'info');
    setDetailsSongId(songId);
    setIsDetailsDialogOpen(true);
  }, [addLogMessage]); // Include addLogMessage if it's used inside

  const handleCloseDetailsDialog = useCallback(() => {
    setIsDetailsDialogOpen(false);
    setDetailsSongId(null); // Clear the ID when closing
  }, []);

  // Memoize derived state for the dialog to avoid unnecessary lookups
  const detailsSong = useMemo(() => {
    if (!detailsSongId) return null;
    return songs.find(s => s.id === detailsSongId) ?? null;
  }, [detailsSongId, songs]);

  const detailsFeatures = useMemo(() => {
    if (!detailsSongId) return null;
    return songFeatures[detailsSongId] ?? null;
  }, [detailsSongId, songFeatures]);

  // Calculate progress percentage for the current batch
  const progressPercent = useMemo(() => {
    if (!isProcessing || processingSongIds.size === 0) {
      return 0;
    }
    const finishedCount = Array.from(processingSongIds).filter(
      id => featureStatus[id] === 'complete' || featureStatus[id] === 'error'
    ).length;
    return (finishedCount / processingSongIds.size) * 100;
  }, [isProcessing, processingSongIds, featureStatus]);

  // --- Explanation Dialog Handlers ---
  const handleShowExplanation = useCallback((featureId: string) => {
    if (explanations && explanations[featureId]) {
      setExplainedFeatureId(featureId);
      setIsExplanationOpen(true);
      addLogMessage(`Showing explanation for feature: ${featureId}`, 'info');
    } else {
      addLogMessage(`Explanation not available or not loaded for feature: ${featureId}`, 'warn');
    }
  }, [explanations, addLogMessage]);

  const handleCloseExplanation = useCallback(() => {
    setIsExplanationOpen(false);
    setExplainedFeatureId(null); // Clear the ID when closing
  }, []);

  // --- NEW: Algorithm Explanation Dialog Handlers ---
  const handleShowAlgoExplanation = useCallback((algorithmId: string) => {
    if (algorithmExplanations && algorithmExplanations[algorithmId]) {
      addLogMessage(`Showing explanation for algorithm: ${algorithmId}`, 'info');
      setExplainedAlgorithmId(algorithmId);
      setIsAlgoExplanationOpen(true);
    } else {
      addLogMessage(`Explanation not available for algorithm: ${algorithmId}`, 'warn');
    }
  }, [algorithmExplanations, addLogMessage]); // Dependencies

  const handleCloseAlgoExplanation = useCallback(() => {
    setIsAlgoExplanationOpen(false);
    setExplainedAlgorithmId(null);
  }, []);
  // ------------------------------------------------

  // --- Handler for Toggling the About Dialog ---
  const handleToggleAboutDialog = () => {
    setIsAboutDialogOpen(prev => !prev);
  };

  // NEW: Handler for user selecting visualization stage
  const handleVisualizationStageSelect = useCallback((stage: ProcessingStage) => {
    addLogMessage(`User selected visualization stage: ${stage}`, 'info');
    setVisualizationDisplayStage(stage); // Only update the user's selected stage
  }, [addLogMessage]);

  // --- NEW: Memoize currently playing song object ---
  const currentlyPlayingSong = useMemo(() => {
      return songs.find(s => s.id === currentlyPlayingSongId) ?? null;
  }, [currentlyPlayingSongId, songs]);
  // -----------------------------------------------

  // Calculate finished count for the current batch
  const finishedCountInBatch = useMemo(() => {
    // Only calculate if currently processing and there's a batch
    if (!isProcessing || processingSongIds.size === 0) {
      return 0;
    }
    let count = 0;
    // Iterate only through the IDs in the current batch
    for (const songId of processingSongIds) {
      const status = featureStatus[songId];
      // Count songs that are finished (completed or errored)
      if (status === 'complete' || status === 'error') {
        count++;
      }
    }
    return count;
  }, [isProcessing, processingSongIds, featureStatus]); // Dependencies

  return (
    <main className="flex flex-col min-h-screen p-4 bg-gray-950/30 bg-blur-md text-gray-100 font-[family-name:var(--font-geist-mono)] hide-scrollbar">
       {/* Hidden File Input */}
       <input
          ref={fileInputRef}
          id="audio-upload" // Keep ID if needed elsewhere, but visually hidden
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

      {/* Header/Top Controls Placeholder */}
      <div
        className="w-full h-16 mb-4 p-2 flex justify-between items-center"
        data-augmented-ui="bl-clip-y tr-clip-y border inlay"
        style={{'--aug-border-bg': 'var(--foreground)',
          '--aug-border-opacity': '0.8',
          '--aug-border-x': '1px',
          '--aug-border-y': '3px',
          '--aug-inlay-bg': 'var(--background)',
          '--aug-inlay-opacity': '0.05',
          filter: `drop-shadow(0 0 2px var(--accent-primary))`, 
          '--aug-tl': '10px', 
          '--aug-tr': '10px', 
          '--aug-br': '10px', 
          '--aug-bl': '10px',
         } as React.CSSProperties}
      >
        <h1 className="px-4 text-xl font-bold text-[var(--accent-primary)] flex-shrink-0">MusicCluster Dashboard</h1>
        {/* --- NEW: Add Audio Player in the middle --- */}
        <AudioPlayer 
          song={currentlyPlayingSong} 
          isPlaying={isPlaying} 
          onTogglePlayPause={handleTogglePlayPause} 
          onSongEnd={handleSongEnd}
          className="flex-grow flex justify-center items-center min-w-0 max-w-[40vw] px-4" // Added min-w-0 and padding
        />
        {/* -------------------------------------------- */}
        <div className="flex items-center gap-4 flex-shrink-0"> {/* Wrapper for status and button, add flex-shrink-0 */}
          <div className="text-sm text-[var(--accent-primary)]/80">
            {/* Status Text */}
            <span>
                 {/* Display Cache Status */}
                 {cacheStatus === 'loading' && 'Cache Loading... '}
                 {cacheStatus === 'error' && 'Cache Error! '}
                 {/* Display Processing Statuses */}
                 {isProcessing ? 'Extracting... ' : ''}
                 {isProcessingData ? 'Processing Data... ' : ''}
                 {isReducing ? 'Reducing... ' : ''}
                 {isClustering ? `Clustering (Iter: ${kmeansIteration})... ` : ''}
                 {cacheStatus !== 'loading' && !isProcessing && !isProcessingData && !isReducing && !isClustering ? 'What\'s Next?' : ''}
            </span>
            {/* Overall Counts (remain useful) */}
            {/* Show processing progress count only during feature extraction */}
            {isProcessing && processingSongIds.size > 0 && (
              <span className="ml-2">
                ({finishedCountInBatch} / {processingSongIds.size} processed)
              </span>
            )}
            {!essentiaWorkerReady && <span className="text-red-500 ml-2">Worker Error!</span>}

            {/* Progress Bar - Conditionally rendered */}
            {isProcessing && processingSongIds.size > 0 && (
               <div className="w-full h-1.5 bg-gray-700 -full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-width duration-150 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            )}
          </div>
          {/* About Text Link */}
          <span
            onClick={handleToggleAboutDialog}
            className="text-[var(--accent-primary)] hover:text-cyan-400 cursor-pointer text-sm whitespace-nowrap mr-4"
            role="button" // Accessibility: Indicate it behaves like a button
            tabIndex={0}  // Accessibility: Make it focusable
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleToggleAboutDialog();
              }
            }} // Accessibility: Trigger on Enter/Space
          >
            | 
            About
          </span>
        </div>
      </div>

      {/* New Grid Layout - Based on Wireframe */}
      <div className='h-[85vh]'>
        <div className="flex-grow px-2 py-2 grid grid-cols-[auto_1fr_auto] grid-rows-[3fr_1fr] min-h-full max-h-full gap-2"> {/* Use auto columns for sides, fr for middle */} 
          {/* Song List Panel (Left Column, Full Height, Max Width) */}
          <SongListPanel
            className="col-span-1 row-span-2 max-w-xs max-h-full" // Added max-width
            songs={songs}
            featureStatus={featureStatus}
            activeSongIds={activeSongIds}
            // MODIFIED: Allow song interaction even if clustering is active (but not other processes)
            isProcessing={isProcessing || isReducing || isProcessingData}
            onToggleSongActive={handleToggleSongActive}
            onRemoveSong={handleRemoveSong}
            onUploadClick={handleUploadClick}
            onAddSongs={handleAddSongs} // Pass the new handler
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            onShowDetails={handleShowDetails}
            kmeansAssignments={kmeansAssignments} // <-- ADD THIS PROP
            // --- NEW: Pass Audio Props ---
            onPlayRequest={handlePlayRequest}
            currentlyPlayingSongId={currentlyPlayingSongId}
            isPlaying={isPlaying}
            // ---------------------------
          />

          {/* Visualization Panel (Middle Column, Top Row) */}
          <VisualizationPanel
            className="col-span-1 row-span-1 max-h-full min-h-0 px-4" // Updated spans
            activeSongIds={activeSongIds}
            songs={songs}
            // Pass raw features, unprocessed matrix, and processed matrix
            songFeatures={songFeatures}
            unprocessedData={unprocessedData}
            processedData={processedData}
            // Existing props for clustering results
            reducedDataPoints={reducedDataPoints}
            reductionDimensions={reductionDimensions}
            kmeansAssignments={kmeansAssignments}
            kmeansCentroids={kmeansCentroids}
            kmeansIteration={kmeansIteration}
            latestSuccessfulStage={latestSuccessfulStage}
            visualizationDisplayStage={visualizationDisplayStage} // NEW: Pass user's selected stage
            onStageSelect={handleVisualizationStageSelect} // NEW: Pass handler for stage selection
            availableFeatureKeys={availableFeatureKeys} // <-- Pass new prop
          />

          {/* Controls Panel (Right Column, Full Height, Max Width)*/}
          <ControlsPanel
            className="col-span-1 row-span-2 max-w-sm"
            isProcessing={isProcessing}
            isReducing={isReducing}
            isClustering={isClustering}
            essentiaWorkerReady={essentiaWorkerReady}
            activeSongCount={activeSongIds.size}
            hasFeaturesForActiveSongs={hasFeaturesForActiveSongs}
            hasReducedDataForActiveSongs={hasReducedDataForActiveSongs}
            onExtractFeatures={handleExtractFeatures}
            onReduceDimensions={handleReduceDimensions}
            onRunClustering={handleRunClustering}
            onShowExplanation={handleShowExplanation}
            isProcessingData={isProcessingData}
            hasProcessedData={hasProcessedData}
            onProcessData={handleStartDataProcessing}
            // K-Means Step Control Props
            isKmeansInitialized={isKmeansInitialized}
            onNextStep={handleNextKmeansStep}
            // Pass isClustering to potentially disable init button while clustering is active
            isClusteringActive={isClustering}
            // --- NEW: Pass algo explanation handler ---
            onShowAlgoExplanation={handleShowAlgoExplanation} 
            // -----------------------------------------
          />

          {/* Log Panel (Middle Column, Bottom Row) */}
          <LogPanel
            className="col-span-1 row-span-1 h-[20vh] ml-4 mr-4" // Updated spans
            logs={filteredLogMessages}
          />
        </div>
      </div>

      {/* Footer Placeholder - UPDATED */}
      <footer
        className="w-full h-10 mt-4 p-2 text-center text-xs text-gray-500 border-t border-gray-700 flex items-center justify-center gap-4"
         data-augmented-ui="tl-clip tr-clip border"
         style={{ '--aug-border-color': '#444', '--aug-border-bg': 'transparent' } as React.CSSProperties}
      >
        <span>Copyright (c) 2025 Xiaotian Fan, As33</span>
        <span>|</span>
        <a 
          href="https://github.com/XiaoTianFan/Music-Cluster" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-gray-400 transition-colors"
        >
          GitHub Repository
        </a>
        {/* --- NEW: About Link in Footer --- */}
        <span>|</span>
        <span
          onClick={handleToggleAboutDialog}
          className="hover:text-gray-400 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleToggleAboutDialog();
            }
          }}
        >
          About
        </span>
        {/* --------------------------------- */}
      </footer>

      {/* Song Details Dialog (Conditionally Rendered) */}
      {isDetailsDialogOpen && detailsSong && (
        <SongDetailsDialog 
          song={detailsSong} 
          features={detailsFeatures} 
          onClose={handleCloseDetailsDialog} 
        />
      )}

      {/* Feature Explanation Dialog (Conditionally Rendered) */}
      {explanations && (
         <FeatureExplanationDialog
          isOpen={isExplanationOpen}
          featureName={explainedFeatureId ? explanations[explainedFeatureId]?.name : ''}
          explanation={explainedFeatureId ? explanations[explainedFeatureId]?.explanation : ''}
          onClose={handleCloseExplanation}
        />
      )}

      {/* NEW: Algorithm Explanation Dialog (Conditionally Rendered) */}
      {algorithmExplanations && (
        <ExplanationDialog
          isOpen={isAlgoExplanationOpen}
          title={explainedAlgorithmId ? algorithmExplanations[explainedAlgorithmId]?.name : ''}
          explanation={explainedAlgorithmId ? algorithmExplanations[explainedAlgorithmId]?.explanation : ''}
          onClose={handleCloseAlgoExplanation}
        />
      )}

      {/* About Dialog (Conditionally Rendered) */}
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onClose={handleToggleAboutDialog}
      />
    </main>
  );
}
