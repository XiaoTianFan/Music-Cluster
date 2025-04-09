'use client'; // Add this directive to make it a Client Component

import React, { useState, ChangeEvent, useRef, useEffect, useCallback, useMemo } from 'react';

// Import the new panel components
import SongListPanel from '../components/SongListPanel';
import ControlsPanel from '../components/ControlsPanel';
import VisualizationPanel from '../components/VisualizationPanel';

// Define a type for our song objects
interface Song {
  id: string; // Using URL or a generated ID for uniqueness
  name: string;
  url: string;
  source: 'default' | 'user';
}

// Define a type for the extracted features (expand this later)
interface Features {
  mfccMeans?: number[];      
  mfccStdDevs?: number[];    
  energy?: number;          
  entropy?: number;         
  key?: string;             
  keyScale?: string;        
  keyStrength?: number;     
  // Dynamic Complexity related fields:
  dynamicComplexity?: number;
  loudness?: number; // Note: This 'loudness' is from DynamicComplexity
  // RMS field:
  rms?: number;
  // Tuning Frequency fields:
  tuningFrequency?: number; // Estimated tuning frequency in Hz
  tuningCents?: number;     // Deviation from 440 Hz in cents
}

// Type for feature status tracking
type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';

// List of default songs based on the directory listing
const defaultSongs: Song[] = [
  { id: '/audio/The Beatles_Abbey Road_Come Together.mp3', name: 'The Beatles - Come Together.mp3', url: '/audio/The Beatles_Abbey Road_Come Together.mp3', source: 'default' },
  // Add more default songs here if needed
  // Example: { id: '/audio/Kraftwerk_The Man-Machine_The Robots.mp3', name: 'Kraftwerk - The Robots.mp3', url: '/audio/Kraftwerk_The Man-Machine_The Robots.mp3', source: 'default' },
];

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
  // --- DruidJS State ---
  const [reducedDataPoints, setReducedDataPoints] = useState<Record<string, number[]>>({}); // { songId: [dim1, dim2, ...] }
  const [isReducing, setIsReducing] = useState<boolean>(false);
  // Type for reduction method
  type ReductionMethod = 'pca' | 'tsne' | 'umap';
  // ---------------------

  const workerRef = useRef<Worker | null>(null);
  const druidWorkerRef = useRef<Worker | null>(null); // Ref for Druid worker
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Ref for the hidden file input

  // Initialize Workers and AudioContext
  useEffect(() => {
    // Initialize AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Initialize Essentia Worker
    if (!workerRef.current) {
        console.log('Creating Essentia Bundled Worker...');
        workerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/essentia-worker.bundled.js'); 

        workerRef.current.onmessage = (event) => {
            const { type, payload, songId, features, error } = event.data;
            console.log('[Essentia Worker] Message received:', event.data);

            switch (type) {
                case 'essentiaReady':
                    setEssentiaWorkerReady(payload);
                    if (!payload) {
                        console.error('Essentia worker failed to initialize:', error);
                    }
                    break;
                case 'featureExtractionComplete':
                    setSongFeatures(prev => ({ ...prev, [songId]: features }));
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'complete' }));
                    break;
                case 'featureExtractionError':
                    console.error(`[Essentia Worker] Error processing song ${songId}:`, error);
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'error' }));
                    break;
                default:
                    console.warn('[Essentia Worker] Unknown message type:', type);
            }
        };

        workerRef.current.onerror = (error) => {
            console.error('Error in Essentia Worker:', error);
            setEssentiaWorkerReady(false); 
            setIsProcessing(false);
        };
        
        workerRef.current.postMessage({ type: 'init' });
    }

    // Initialize Druid Worker
    if (!druidWorkerRef.current) {
        console.log('Creating Druid Bundled Worker...');
        druidWorkerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/druid-worker.bundled.js');

        druidWorkerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            console.log('[Druid Worker] Message received:', event.data);

            switch (type) {
                case 'reductionComplete':
                    const { reducedData, songIds: returnedSongIds } = payload;
                    // Update state by mapping song IDs to reduced data points
                    const newPoints = returnedSongIds.reduce((acc: Record<string, number[]>, id: string, index: number) => {
                        if (reducedData[index]) { // Ensure data exists for the index
                            acc[id] = reducedData[index];
                        }
                        return acc;
                    }, {});
                    setReducedDataPoints(prev => ({ ...prev, ...newPoints }));
                    setIsReducing(false);
                    console.log('[Druid Worker] Dimensionality reduction complete.');
                    break;
                case 'reductionError':
                    console.error('[Druid Worker] Reduction error:', payload.error);
                    setIsReducing(false);
                    // TODO: Maybe show a notification to the user
                    break;
                default:
                    console.warn('[Druid Worker] Unknown message type:', type);
            }
        };

        druidWorkerRef.current.onerror = (error) => {
            console.error('Error in Druid Worker:', error);
            setIsReducing(false);
             // TODO: Maybe show a notification to the user
        };
    }

    // Cleanup function
    return () => {
      if (workerRef.current) {
        console.log('Terminating Essentia Worker...');
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (druidWorkerRef.current) {
          console.log('Terminating Druid Worker...');
          druidWorkerRef.current.terminate();
          druidWorkerRef.current = null;
      }
      // Close AudioContext if no longer needed elsewhere
      // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      //   audioContextRef.current.close();
      // }
    };
  }, []);

  // Check if all songs are processed
  useEffect(() => {
    if (!isProcessing) return;

    const allProcessed = songs.every(song => 
        featureStatus[song.id] === 'complete' || featureStatus[song.id] === 'error'
    );

    if (allProcessed) {
        setIsProcessing(false);
        console.log('All songs processed.');
        console.log('Features:', songFeatures);
    }
  }, [featureStatus, songs, isProcessing, songFeatures]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newSongs: Song[] = [];
    const currentSongIds = new Set(songs.map(s => s.id)); // Use ID for checking duplicates
    const newActiveIds = new Set<string>();

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
               source: 'user' as 'user',
            };
            newSongs.push(newSong);
            newActiveIds.add(newSong.id); // Make newly added songs active by default
            currentSongIds.add(objectURL); // Add to current set to prevent duplicates within the same upload batch
        }
        // Note: We might want to revoke object URLs later when they're no longer needed
        // URL.revokeObjectURL(objectURL);
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
    }

    // Reset file input to allow selecting the same file again if removed
    event.target.value = '';
  };

  const handleRemoveSong = (songIdToRemove: string) => {
    const songToRemove = songs.find(song => song.id === songIdToRemove);
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
    
    // Revoke object URL if it's a user-uploaded file being removed
    if (songToRemove && songToRemove.source === 'user') {
        URL.revokeObjectURL(songToRemove.url);
    }
    setSongs(prevSongs => prevSongs.filter(song => song.id !== songIdToRemove));
  };

  // Handler to toggle a song's active state
  const handleToggleSongActive = (songId: string) => {
      setActiveSongIds(prevActive => {
          const newActive = new Set(prevActive);
          if (newActive.has(songId)) {
              newActive.delete(songId);
          } else {
              newActive.add(songId);
          }
          return newActive;
      });
  };

  // Handler to trigger the hidden file input
  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  // Function to fetch and decode audio
  const getDecodedAudio = useCallback(async (song: Song): Promise<AudioBuffer | null> => {
      if (!audioContextRef.current) {
          console.error('AudioContext not initialized');
          return null;
      }
      try {
          const response = await fetch(song.url);
          if (!response.ok) {
              throw new Error(`Failed to fetch audio: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          return audioBuffer;
      } catch (error) {
          console.error(`Error decoding audio for ${song.name}:`, error);
          setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
          return null;
      }
  }, []); // Depends only on audioContextRef which is stable

  // Function to trigger feature extraction for *active* songs
  const handleExtractFeatures = useCallback(async (selectedFeatures: Set<string>) => {
    if (!essentiaWorkerReady || isProcessing || !workerRef.current) {
        console.warn('Worker not ready or already processing.');
        return;
    }
    if (selectedFeatures.size === 0) {
        console.warn('No features selected for extraction.');
        // Optionally show a message to the user
        return;
    }

    console.log(`Starting extraction for features [${[...selectedFeatures].join(', ')}] on ${activeSongIds.size} active songs...`);
    setIsProcessing(true);

    // Filter songs that are marked as active
    const songsToProcess = songs.filter(song => activeSongIds.has(song.id)); 

    if (songsToProcess.length === 0) {
        console.log('No active songs to process.');
        setIsProcessing(false);
        return;
    }

    // Reset status only for the active songs we are about to process
    const statusUpdates = songsToProcess.reduce((acc, song) => {
        acc[song.id] = 'processing';
        return acc;
    }, {} as Record<string, FeatureStatus>);
    setFeatureStatus(prev => ({ ...prev, ...statusUpdates }));

    // Clear features only for the songs being re-processed.
    const featureUpdates = songsToProcess.reduce((acc, song) => {
        acc[song.id] = null; // Clear previous features for these songs
        return acc;
    }, {} as Record<string, Features | null>);
     setSongFeatures(prev => ({ ...prev, ...featureUpdates }));


    for (const song of songsToProcess) { // Use the filtered list
        console.log(`Processing ${song.name}...`);
        const audioBuffer = await getDecodedAudio(song);

        if (audioBuffer && workerRef.current) {
            // Revert to only sending mono data
            const audioData = audioBuffer.getChannelData(0); // Use first channel (mono)
            const audioVector = Array.from(audioData); 

             workerRef.current.postMessage({
                type: 'extractFeatures',
                payload: {
                    songId: song.id,
                    audioVector: audioVector, // Send mono vector
                    sampleRate: audioBuffer.sampleRate,
                    featuresToExtract: [...selectedFeatures] 
                }
            });
        } else {
             console.warn(`Skipping ${song.name} due to decoding error or missing worker.`);
             // Status already set to 'error' in getDecodedAudio if decoding failed
             if (!audioBuffer) {
                setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
             }
        }
    }
  }, [songs, getDecodedAudio, essentiaWorkerReady, isProcessing, activeSongIds]);

  // Function to trigger dimensionality reduction
  const handleReduceDimensions = useCallback((method: ReductionMethod, dimensions: number, params?: any) => {
    if (!druidWorkerRef.current || isReducing) {
        console.warn('Druid worker not ready or already reducing.');
        return;
    }

    console.log(`Starting dimensionality reduction with method: ${method}, dimensions: ${dimensions}`);
    setIsReducing(true);
    // Clear previous results? Or merge? For now, let's clear for the active set.
    setReducedDataPoints(prev => {
        const clearedState = { ...prev };
        activeSongIds.forEach(id => delete clearedState[id]);
        return clearedState;
    });

    // 1. Get features for active songs
    const activeFeatures: { id: string; features: Features }[] = [];
    activeSongIds.forEach(id => {
        const features = songFeatures[id];
        // Only include songs that have successfully computed features
        if (features && featureStatus[id] === 'complete') {
            activeFeatures.push({ id, features });
        }
    });

    if (activeFeatures.length === 0) {
        console.warn('No active songs with successfully extracted features found.');
        setIsReducing(false);
        return;
    }
    
     // Basic check: Need more samples than dimensions
    if (activeFeatures.length <= dimensions) {
        console.warn(`Insufficient data points (${activeFeatures.length}) for ${dimensions} dimensions.`);
        setIsReducing(false);
        // TODO: Show notification to user
        return;
    }

    // 2. Construct the featureVectors array and songIds array
    //    IMPORTANT: Decide WHICH features to use and HOW to combine them.
    //    For now, let's concatenate mfccMeans and mfccStdDevs if available.
    const featureVectors: number[][] = [];
    const vectorSongIds: string[] = [];

    // --- Define Canonical Feature Order ---
    const canonicalFeatureOrder: (keyof Features)[] = [
        'energy', 'entropy', 'loudness', 'rms', 'dynamicComplexity', 'keyStrength', 
        'tuningFrequency', 'tuningCents',
        'mfccMeans', 'mfccStdDevs', // Array features
        'key', 'keyScale' // String features last for one-hot encoding part
    ];

    // --- Determine Common Features Present in ALL Active Songs ---
    let commonFeatures = new Set<keyof Features>(canonicalFeatureOrder);
    if (activeFeatures.length > 0) {
        // Initialize with features of the first song
        const firstFeatures = activeFeatures[0].features;
        commonFeatures = new Set(canonicalFeatureOrder.filter(key => 
            firstFeatures[key] !== undefined && firstFeatures[key] !== null
        ));

        // Intersect with features of subsequent songs
        for (let i = 1; i < activeFeatures.length; i++) {
            const currentFeatures = activeFeatures[i].features;
            commonFeatures.forEach(key => {
                if (currentFeatures[key] === undefined || currentFeatures[key] === null) {
                    commonFeatures.delete(key);
                }
            });
        }
    }

    if (commonFeatures.size === 0) {
        console.warn('No features are commonly present across all active songs.');
        setIsReducing(false);
        // TODO: Notify user
        return;
    }
    console.log('Common features selected for analysis:', Array.from(commonFeatures));

    // --- One-Hot Encoding Prep (only for common string features) ---
    const uniqueKeys = new Set<string>();
    const uniqueScales = new Set<string>();
    let keyToIndex: Map<string, number> | null = null;
    let scaleToIndex: Map<string, number> | null = null;
    let numKeyDimensions = 0;
    let numScaleDimensions = 0;

    if (commonFeatures.has('key')) {
        activeFeatures.forEach(({ features }) => {
            // We already know key is non-null from commonFeatures check
            uniqueKeys.add(features.key!);
        });
        const keyList = Array.from(uniqueKeys).sort();
        keyToIndex = new Map(keyList.map((k, i) => [k, i]));
        numKeyDimensions = keyList.length;
        console.log(`One-hot encoding prepared for 'key' with ${numKeyDimensions} dimensions.`);
    }

    if (commonFeatures.has('keyScale')) {
        activeFeatures.forEach(({ features }) => {
            uniqueScales.add(features.keyScale!);
        });
        const scaleList = Array.from(uniqueScales).sort();
        scaleToIndex = new Map(scaleList.map((s, i) => [s, i]));
        numScaleDimensions = scaleList.length;
        console.log(`One-hot encoding prepared for 'keyScale' with ${numScaleDimensions} dimensions.`);
    }
    // -----------------------------

    activeFeatures.forEach(({ id, features }) => {
        const vec: number[] = [];

        // Iterate through the canonical order, but only include common features
        for (const key of canonicalFeatureOrder) {
            if (!commonFeatures.has(key)) {
                continue; // Skip features not present in all active songs
            }

            const value = features[key]; // We know value is not null/undefined here

            // Handle based on type (and if it's a string feature)
            if (key === 'key' && keyToIndex) {
                const keyOneHot = Array(numKeyDimensions).fill(0);
                const index = keyToIndex.get(value as string);
                if (index !== undefined) { // Should always be found if logic is correct
                    keyOneHot[index] = 1;
                    vec.push(...keyOneHot);
                } else {
                     console.error(`Logic error: Key '${value}' for song ${id} not found in keyToIndex map.`);
                     // Handle this potential inconsistency? Skip song? For now, log error.
                }
            } else if (key === 'keyScale' && scaleToIndex) {
                const scaleOneHot = Array(numScaleDimensions).fill(0);
                const index = scaleToIndex.get(value as string);
                if (index !== undefined) {
                     scaleOneHot[index] = 1;
                    vec.push(...scaleOneHot);
                } else {
                    console.error(`Logic error: Scale '${value}' for song ${id} not found in scaleToIndex map.`);
                }
            } else if (Array.isArray(value)) {
                // Assume numeric array based on Features type & commonFeatures check
                vec.push(...(value as number[]));
            } else if (typeof value === 'number') {
                vec.push(value);
            }
            // Else: non-string, non-array, non-number - should not happen based on Features type
        }
        
        // Add the fully constructed vector if it's not empty (it shouldn't be if commonFeatures > 0)
        if (vec.length > 0) { 
            featureVectors.push(vec);
            vectorSongIds.push(id);
        } else {
            // This case should theoretically not be reached if commonFeatures.size > 0
            console.warn(`Song ${id} resulted in an empty vector despite having common features.`);
        }
    });

    // Check if all vectors have the same dimension after construction
    if (featureVectors.length > 0) {
        const firstLen = featureVectors[0].length;
        if (!featureVectors.every(v => v.length === firstLen)) {
             console.error('Feature vectors have inconsistent lengths. Cannot proceed.');
             setIsReducing(false);
             // TODO: Show error notification
             return;
        }
        if (firstLen === 0) {
            console.warn('Constructed feature vectors are empty.');
             setIsReducing(false);
             return;
        }
        const finalDimension = featureVectors[0].length; // Get dimension after all features added
        console.log(`Prepared ${featureVectors.length} vectors for reduction, each with ${finalDimension} dimensions (including one-hot).`);
    } else {
         console.warn('No valid feature vectors constructed for reduction.');
         setIsReducing(false);
         return;
    }

    // 3. Post message to worker
    druidWorkerRef.current.postMessage({
        type: 'reduceDimensions',
        payload: {
            featureVectors: featureVectors,
            songIds: vectorSongIds,
            method: method,
            dimensions: dimensions,
            ...(params && { ...params }) // Include optional params like perplexity, neighbors
        }
    });

}, [activeSongIds, songFeatures, featureStatus, isReducing]);

  // Calculate derived state: Check if any active song has completed features
  const hasFeaturesForActiveSongs = useMemo(() => {
      return Array.from(activeSongIds).some(id => 
          featureStatus[id] === 'complete' && songFeatures[id] != null
      );
  }, [activeSongIds, featureStatus, songFeatures]);

  return (
    <main className="flex flex-col min-h-screen p-4 bg-gray-900 text-gray-100 font-[family-name:var(--font-geist-mono)]">
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
        className="w-full h-16 mb-4 p-2 flex justify-between items-center border border-cyan-500"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        style={{ '--aug-border-color': 'cyan', '--aug-border-bg': 'transparent' } as React.CSSProperties}
      >
        <h1 className="px-4 text-xl font-bold text-cyan-400">SongCluster Dashboard</h1>
        <div className="text-sm text-cyan-300">
          {isProcessing ? 'Processing Audio... ' : 'Ready'}
          ({songs.filter(s => featureStatus[s.id] === 'complete').length} / {songs.length} songs complete)
          {!essentiaWorkerReady && <span className="text-red-500 ml-2">Worker Error!</span>}
        </div>
      </div>

      {/* New Grid Layout - Updated */}
      <div className="flex-grow grid grid-cols-2 grid-rows-[auto_1fr] gap-4"> {/* Changed grid-cols-3 to grid-cols-2 */}
        {/* Song List Panel */}
        <SongListPanel 
          className="col-span-1 row-span-1"  // Changed col-span-2 to col-span-1
          songs={songs}
          featureStatus={featureStatus}
          activeSongIds={activeSongIds}
          isProcessing={isProcessing}
          onToggleSongActive={handleToggleSongActive}
          onRemoveSong={handleRemoveSong}
          onUploadClick={handleUploadClick}
        />

        {/* Controls Panel */}
        <ControlsPanel 
          className="col-span-1 row-span-1" // Changed row-span-2 to row-span-1
          isProcessing={isProcessing}
          isReducing={isReducing} // Pass down reducing state
          essentiaWorkerReady={essentiaWorkerReady}
          activeSongCount={activeSongIds.size}
          hasFeaturesForActiveSongs={hasFeaturesForActiveSongs} // Pass down derived state
          onExtractFeatures={handleExtractFeatures}
          onReduceDimensions={handleReduceDimensions} // Pass down handler
        />

        {/* Visualization Panel */}
        <VisualizationPanel className="col-span-2 row-span-1"/> {/* Changed row-span-1 (implicitly) and added col-span-2 */}
      </div>

      {/* Footer Placeholder (Optional) */}
      <footer
        className="w-full h-10 mt-4 p-2 text-center text-xs text-gray-500 border-t border-gray-700"
         data-augmented-ui="tl-clip tr-clip border"
         style={{ '--aug-border-color': '#444', '--aug-border-bg': 'transparent' } as React.CSSProperties}
      >
        Status messages or other info can go here.
      </footer>
    </main>
  );
}
