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
// Remove the static import of VisualizationPanel
// import VisualizationPanel from '../components/VisualizationPanel';

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

// Type for feature processing status
export type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';

// List of default songs based on the directory listing
const defaultSongs: Song[] = [
  { id: '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3', name: 'Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3', url: '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3', source: 'default' },
  { id: '/audio/Excerpt_Yes - Roundabout.mp3', name: 'Excerpt_Yes - Roundabout.mp3', url: '/audio/Excerpt_Yes - Roundabout.mp3', source: 'default' },
  { id: '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3', name: 'Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3', url: '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3', source: 'default' },
  { id: '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3', name: 'Excerpt_Eric Clapton - Autumn Leaves.mp3', url: '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3', source: 'default' },
  { id: '/audio/Excerpt_Frank Sinatra - Fly Me To The Moon.mp3', name: 'Excerpt_Frank Sinatra - Fly Me To The Moon.mp3', url: '/audio/Excerpt_Frank Sinatra - Fly Me To The Moon.mp3', source: 'default' },
  { id: '/audio/Excerpt_Genesis - Firth of Fifth.mp3', name: 'Excerpt_Genesis - Firth of Fifth.mp3', url: '/audio/Excerpt_Genesis - Firth of Fifth.mp3', source: 'default' },
  { id: '/audio/Excerpt_Mariya Takeuchi - Plastic Love.mp3', name: 'Excerpt_Mariya Takeuchi - Plastic Love.mp3', url: '/audio/Excerpt_Mariya Takeuchi - Plastic Love.mp3', source: 'default' },
  { id: '/audio/Excerpt_Michael Jackson - Billie Jean.mp3', name: 'Excerpt_Michael Jackson - Billie Jean.mp3', url: '/audio/Excerpt_Michael Jackson - Billie Jean.mp3', source: 'default' },
  { id: '/audio/Excerpt_Queen - Bohemian Rhapsody.mp3', name: 'Excerpt_Queen - Bohemian Rhapsody.mp3', url: '/audio/Excerpt_Queen - Bohemian Rhapsody.mp3', source: 'default' },
  { id: '/audio/Excerpt_Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio.mp3', name: 'Excerpt_Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio.mp3', url: '/audio/Excerpt_Rachmaninov - Symphony No. 2 Op. 27 III. Adagio Adagio.mp3', source: 'default' },
  { id: '/audio/Excerpt_The Beatles - Abbey Road_Come Together.mp3', name: 'Excerpt_The Beatles - Abbey Road_Come Together.mp3', url: '/audio/Excerpt_The Beatles - Abbey Road_Come Together.mp3', source: 'default' },
  { id: '/audio/Excerpt_Yasuha - Flyday Chinatown.mp3', name: 'Excerpt_Yasuha - Flyday Chinatown.mp3', url: '/audio/Excerpt_Yasuha - Flyday Chinatown.mp3', source: 'default' },
  { id: '/audio/Excerpt_B.B. King - The Thrill Is Gone.mp3', name: 'Excerpt_B.B. King - The Thrill Is Gone.mp3', url: '/audio/Excerpt_B.B. King - The Thrill Is Gone.mp3', source: 'default' },
  { id: '/audio/Excerpt_Dvorak - Symphony No. 9 (From the New World)_Movement 4.mp3', name: 'Excerpt_Dvorak - Symphony No. 9 (From the New World)_Movement 4.mp3', url: '/audio/Excerpt_Dvorak - Symphony No. 9 (From the New World)_Movement 4.mp3', source: 'default' },
  { id: '/audio/Excerpt_King Crimson - The Court of the Crimson King.mp3', name: 'Excerpt_King Crimson - The Court of the Crimson King.mp3', url: '/audio/Excerpt_King Crimson - The Court of the Crimson King.mp3', source: 'default' },
  { id: '/audio/Excerpt_Richard Wagner - Ride of the Valkyries.mp3', name: 'Excerpt_Richard Wagner - Ride of the Valkyries.mp3', url: '/audio/Excerpt_Richard Wagner - Ride of the Valkyries.mp3', source: 'default' },
  { id: '/audio/Excerpt_Chopin - Nocturne op.9 No.2.mp3', name: 'Excerpt_Chopin - Nocturne op.9 No.2.mp3', url: '/audio/Excerpt_Chopin - Nocturne op.9 No.2.mp3', source: 'default' },
  { id: '/audio/Excerpt_Debussy - Clair De Lune.mp3', name: 'Excerpt_Debussy - Clair De Lune.mp3', url: '/audio/Excerpt_Debussy - Clair De Lune.mp3', source: 'default' },
  { id: '/audio/Excerpt_Michael Jaskson - Beat It.mp3', name: 'Excerpt_Michael Jaskson - Beat It.mp3', url: '/audio/Excerpt_Michael Jaskson - Beat It.mp3', source: 'default' },
  { id: '/audio/Excerpt_Miki Matsubara - Stay With Me.mp3', name: 'Excerpt_Miki Matsubara - Stay With Me.mp3', url: '/audio/Excerpt_Miki Matsubara - Stay With Me.mp3', source: 'default' },
  { id: '/audio/Excerpt_Schubert - Piano Sonata_D845.mp3', name: 'Excerpt_Schubert - Piano Sonata_D845.mp3', url: '/audio/Excerpt_Schubert - Piano Sonata_D845.mp3', source: 'default' },
  { id: '/audio/Excerpt_Schubert-Liszt - Erlkoenig.mp3', name: 'Excerpt_Schubert-Liszt - Erlkoenig.mp3', url: '/audio/Excerpt_Schubert-Liszt - Erlkoenig.mp3', source: 'default' },
  { id: '/audio/Excerpt_Stan Getz - The Girl From Ipanema.mp3', name: 'Excerpt_Stan Getz - The Girl From Ipanema.mp3', url: '/audio/Excerpt_Stan Getz - The Girl From Ipanema.mp3', source: 'default' },
  { id: '/audio/Excerpt_Tatsuro Yamashita - Christmas Eve.mp3', name: 'Excerpt_Tatsuro Yamashita - Christmas Eve.mp3', url: '/audio/Excerpt_Tatsuro Yamashita - Christmas Eve.mp3', source: 'default' },
  { id: '/audio/Excerpt_Oscar Peterson - Tea For Two.mp3', name: 'Excerpt_Oscar Peterson - Tea For Two.mp3', url: '/audio/Excerpt_Oscar Peterson - Tea For Two.mp3', source: 'default' },
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
const setsAreEqual = (setA: Set<any>, setB: Set<any>): boolean => {
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
};

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

  // --- State for About Dialog ---
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState<boolean>(false);

  // --- State to track songs in the current processing batch ---
  const [processingSongIds, setProcessingSongIds] = useState<Set<string>>(new Set());

  const workerRef = useRef<Worker | null>(null);
  const druidWorkerRef = useRef<Worker | null>(null); // Ref for Druid worker
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Ref for the hidden file input
  const kmeansWorkerRef = useRef<Worker | null>(null);
  const extractionStartTimeRef = useRef<number | null>(null); // Ref for timing

  // --- K-Means State ---
  const [kmeansK, setKmeansK] = useState<number>(3); // Default K value
  const [kmeansIteration, setKmeansIteration] = useState<number>(0);
  const [kmeansCentroids, setKmeansCentroids] = useState<number[][]>([]);
  const [kmeansAssignments, setKmeansAssignments] = useState<KmeansAssignments>({});
  const [isClustering, setIsClustering] = useState<boolean>(false); // K-Means clustering

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
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
                case 'kmeansIterationUpdate':
                    setKmeansIteration(payload.iteration);
                    setKmeansCentroids(payload.centroids);
                    const newAssignments: KmeansAssignments = {};
                    payload.songIds.forEach((id: string, index: number) => {
                        newAssignments[id] = payload.assignments[index];
                    });
                    setKmeansAssignments(prev => ({ ...prev, ...newAssignments }));
                    addLogMessage(`K-Means iteration ${payload.iteration} update received.`, 'complete');
                    break;
                case 'kmeansComplete':
                    setIsClustering(false);
                    setKmeansCentroids(payload.finalCentroids);
                    const finalAssignments: KmeansAssignments = {};
                    payload.songIds.forEach((id: string, index: number) => {
                        finalAssignments[id] = payload.finalAssignments[index];
                    });
                    setKmeansAssignments(finalAssignments);
                    addLogMessage('K-Means clustering complete.', 'complete');
                    break;
                case 'kmeansError':
                    setIsClustering(false);
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
  }, [addLogMessage]); // Run once on mount

  // Check if all songs are processed
  useEffect(() => {
    if (!isProcessing) return; // Only run when processing

    // Check if there are any songs STILL marked as 'processing'
    // This correctly identifies when the *current batch* has finished,
    // regardless of whether all songs or only a subset were processed.
    // We specifically check the IDs that were part of the current batch.
    const stillProcessing = Array.from(processingSongIds).some(id => featureStatus[id] === 'processing');

    // If NO songs in the batch are 'processing' anymore, AND we *were* processing, then the batch is done.
    if (!stillProcessing && processingSongIds.size > 0) { // Ensure we were actually processing a batch
        const startTime = extractionStartTimeRef.current;
        let durationMessage = 'All requested song processing finished.';

        // Calculate duration only if a start time was recorded for this batch
        if (startTime) {
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            durationMessage = `Total feature extraction time for the batch: ${(durationMs / 1000).toFixed(2)} seconds.`;
            extractionStartTimeRef.current = null; // Reset timer
        }

        setIsProcessing(false); // Mark processing as complete
        setProcessingSongIds(new Set()); // Clear the processing batch IDs
        addLogMessage(durationMessage, 'complete');

        // --- TEMPORARY CODE START (Cache Generation Logging) ---
        // Log the final features object ONLY when processing finishes
        // This logic might run even if only a subset was processed.
        // Consider refining the condition if cache generation should only happen
        // when *all* default songs are processed *in the same batch*.
        const onlyDefaultSongs = songs.every(s => s.source === 'default');
        if (onlyDefaultSongs && songs.length === defaultSongs.length) {
             // NOTE: This log condition checks if the *current* song list *only* contains default songs,
             //       not necessarily that *all* were processed *in this specific batch*.
            console.log("=== COPY FEATURE DATA BELOW ===");
            console.log(JSON.stringify(songFeatures, null, 2)); // Log as pretty-printed JSON string
            console.log("=== COPY FEATURE DATA ABOVE ===");
            addLogMessage('Default song features logged to console for cache generation (may include previously cached data).', 'info');
        }
        // --- TEMPORARY CODE END ---
    }
    // Dependencies: isProcessing ensures we only check when active. featureStatus changes trigger the check.
    // songs and songFeatures are needed for the cache logging logic.
    // addLogMessage is used for logging.
    // processingSongIds is added to correctly identify batch completion.
  }, [featureStatus, isProcessing, songs, songFeatures, addLogMessage, processingSongIds]);

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
               source: 'user' as 'user',
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


    // Revoke object URL if it's a user-uploaded file being removed
    if (songToRemove && songToRemove.source === 'user') {
        URL.revokeObjectURL(songToRemove.url);
        addLogMessage(`Removed user song: ${songName} and revoked URL.`, 'complete');
    } else if (songToRemove) {
        addLogMessage(`Removed default song: ${songName}.`, 'complete');
    }
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
      } catch (error: any) {
          addLogMessage(`Error decoding audio for ${song.name}: ${error.message}`, 'error');
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

  // Function to trigger feature extraction for *active* songs
  const handleExtractFeatures = useCallback(async (selectedFeatures: Set<string>) => {
    // --- START: Cache Check Logic ---
    const onlyDefaultSongs = songs.every(s => s.source === 'default');
    const allSongsActive = activeSongIds.size === songs.length;
    const isDefaultScenario = songs.length === defaultSongs.length && onlyDefaultSongs && allSongsActive;

    if (isDefaultScenario) {
      addLogMessage('Checking for cached features (default song scenario)...', 'info');
      try {
        const response = await fetch('/default_features.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch cache file: ${response.statusText}`);
        }
        const cacheData = await response.json();

        if (!cacheData || !cacheData.cachedFeatureKeys || !cacheData.songData) {
           addLogMessage('Cache file format invalid. Proceeding with worker.', 'warn');
        } else {
          const cachedKeysSet = new Set(cacheData.cachedFeatureKeys);
          // NOTE: Here we need to map the selected feature IDs (like 'mfcc')
          //       to the actual keys used in the Features interface and cache (like 'mfccMeans', 'mfccStdDevs').
          //       This mapping logic depends on how features are selected and stored.
          //       FOR NOW: Assume a direct mapping or that selectedFeatures uses the final keys.
          //       *** This comparison might need refinement based on actual feature selection IDs ***
          const selectedKeysSet = selectedFeatures; // Assuming selectedFeatures contains the final keys for now

          if (setsAreEqual(selectedKeysSet, cachedKeysSet)) {
            addLogMessage('Selected features match cache. Loading pre-computed features...', 'complete');

            // Validate that all required song IDs are in the cache
            let allDefaultSongsInCache = true;
            for (const song of defaultSongs) {
              if (!(song.id in cacheData.songData)) {
                allDefaultSongsInCache = false;
                addLogMessage(`Cache missing data for default song: ${song.name}. Proceeding with worker.`, 'warn');
                break;
              }
            }

            if (allDefaultSongsInCache) {
              // Apply cached data
              setSongFeatures(cacheData.songData);
              const completeStatus = defaultSongs.reduce((acc, song) => {
                  acc[song.id] = 'complete';
                  return acc;
              }, {} as Record<string, FeatureStatus>);
              setFeatureStatus(completeStatus);

               // Clear any previous reduction/clustering results if reloading features
              setReducedDataPoints({});
              setKmeansAssignments({});
              setKmeansCentroids([]);
              setKmeansIteration(0);
              setReductionDimensions(0); // Reset dimensions indicator

              addLogMessage('Successfully loaded features from cache.', 'complete');
              setIsProcessing(false); // Ensure processing flag is off
              return; // Exit the function early
            }
          } else {
            addLogMessage('Cache skipped: Selected features do not match cached features.', 'info');
            // Log differences for debugging
            console.log('Selected Features:', selectedKeysSet);
            console.log('Cached Features:', cachedKeysSet);
          }
        }
      } catch (error: any) {
        addLogMessage(`Failed to load or process feature cache: ${error.message}. Proceeding with worker.`, 'warn');
      }
    }
    // --- END: Cache Check Logic ---

    // --- Original Worker Logic (Fallback) ---
    if (!essentiaWorkerReady || isProcessing || !workerRef.current) {
        addLogMessage('Worker not ready or already processing. Extraction aborted.', 'warn');
        return;
    }
    if (selectedFeatures.size === 0) {
        addLogMessage('No features selected for extraction.', 'warn');
        return;
    }

    addLogMessage(`Starting worker extraction for features [${[...selectedFeatures].join(', ')}] on ${activeSongIds.size} active songs...`, 'info');
    extractionStartTimeRef.current = performance.now(); // Record start time
    setIsProcessing(true);

    const songsToProcess = songs.filter(song => activeSongIds.has(song.id));
    
    // --- Store the IDs of the songs being processed in this batch ---
    setProcessingSongIds(new Set(songsToProcess.map(s => s.id))); 
    // ---

    if (songsToProcess.length === 0) {
        addLogMessage('No active songs selected to process.', 'info');
        setIsProcessing(false);
        return;
    }

    const statusUpdates = songsToProcess.reduce((acc, song) => {
        acc[song.id] = 'processing';
        return acc;
    }, {} as Record<string, FeatureStatus>);
    setFeatureStatus(prev => ({ ...prev, ...statusUpdates }));

    const featureUpdates = songsToProcess.reduce((acc, song) => {
        acc[song.id] = null;
        return acc;
    }, {} as Record<string, Features | null>);
     setSongFeatures(prev => ({ ...prev, ...featureUpdates }));
     setReducedDataPoints(prev => {
         const clearedState = { ...prev };
         songsToProcess.forEach(song => delete clearedState[song.id]);
         return clearedState;
     });
     setKmeansAssignments(prev => {
        const clearedState = { ...prev };
        songsToProcess.forEach(song => delete clearedState[song.id]);
        return clearedState;
     });
     setKmeansCentroids([]);
     setReductionDimensions(0); // Reset dimensions indicator


    for (const song of songsToProcess) {
        addLogMessage(`Requesting features for ${song.name}...`, 'info');
        const audioBuffer = await getDecodedAudio(song);

        if (audioBuffer && workerRef.current) {
            const audioData = audioBuffer.getChannelData(0);
            const audioVector = Array.from(audioData);

             workerRef.current.postMessage({
                type: 'extractFeatures',
                payload: {
                    songId: song.id,
                    audioVector: audioVector,
                    sampleRate: audioBuffer.sampleRate,
                    featuresToExtract: [...selectedFeatures]
                }
            });
        } else {
             addLogMessage(`Skipping ${song.name} due to decoding error or missing worker.`, 'warn');
             if (!audioBuffer && featureStatus[song.id] !== 'error') {
                setFeatureStatus(prev => ({ ...prev, [song.id]: 'error' }));
             }
        }
    }
  }, [songs, getDecodedAudio, essentiaWorkerReady, isProcessing, activeSongIds, addLogMessage, featureStatus, setSongFeatures, setFeatureStatus, setReducedDataPoints, setKmeansAssignments, setKmeansCentroids, setKmeansIteration, setReductionDimensions]); // Added state setters to dependency array

  // Function to trigger dimensionality reduction
  const handleReduceDimensions = useCallback((method: ReductionMethod, dimensions: number, params?: any) => {
    if (!druidWorkerRef.current || isReducing) {
        addLogMessage('Druid worker not ready or already reducing.', 'warn');
        return;
    }

    addLogMessage(`Starting dimensionality reduction with method: ${method}, dimensions: ${dimensions}`, 'info');
    setIsReducing(true);
    // Clear previous reduced points for active songs and related k-means
    setReducedDataPoints(prev => {
        const clearedState = { ...prev };
        activeSongIds.forEach(id => delete clearedState[id]);
        return clearedState;
    });
    setKmeansAssignments({});
    setKmeansCentroids([]);
    setKmeansIteration(0);

    // 1. Get features for active songs
    const activeFeatures: { id: string; features: Features }[] = [];
    let songsWithoutCompleteFeaturesCount = 0;
    activeSongIds.forEach(id => {
        const features = songFeatures[id];
        if (features && featureStatus[id] === 'complete') {
            activeFeatures.push({ id, features });
        } else {
            songsWithoutCompleteFeaturesCount++;
        }
    });

     if (songsWithoutCompleteFeaturesCount > 0) {
        addLogMessage(`Skipping ${songsWithoutCompleteFeaturesCount} active song(s) without complete features for reduction.`, 'warn');
     }

    if (activeFeatures.length === 0) {
        addLogMessage('No active songs with successfully extracted features found for reduction.', 'warn');
        setIsReducing(false);
        return;
    }

     // Basic check: Need more samples than dimensions
    if (activeFeatures.length <= dimensions) {
        addLogMessage(`Insufficient data points (${activeFeatures.length}) for ${dimensions} dimensions. Need more points than dimensions.`, 'warn');
        setIsReducing(false);
        // TODO: Show notification to user
        return;
    }

    // 2. Construct the featureVectors array and songIds array
    const featureVectors: number[][] = [];
    const vectorSongIds: string[] = [];

    // Define Canonical Feature Order
    const canonicalFeatureOrder: (keyof Features)[] = [
        'energy', 'entropy', 'loudness', 'rms', 'dynamicComplexity', 'keyStrength',
        'tuningFrequency', 'tuningCents',
        'mfccMeans', 'mfccStdDevs', // Array features last before strings
        // String features should be handled specifically for one-hot encoding
        'key', 'keyScale'
    ];

    // Determine Common Features Present in ALL Active Songs being processed
    let commonFeatures = new Set<keyof Features>();
    if (activeFeatures.length > 0) {
        const firstFeatures = activeFeatures[0].features;
        // Initialize with features available in the first song
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
        addLogMessage('No features are commonly present across all selected active songs.', 'warn');
        setIsReducing(false);
        return;
    }
    addLogMessage(`Common features identified for analysis: [${Array.from(commonFeatures).join(', ')}]`, 'complete');

    // One-Hot Encoding Prep (only for common string features)
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
        addLogMessage(`Preparing one-hot encoding for 'key' (${numKeyDimensions} dimensions).`, 'complete');
    }

    if (commonFeatures.has('keyScale')) {
        activeFeatures.forEach(({ features }) => { uniqueScales.add(features.keyScale!); });
        const scaleList = Array.from(uniqueScales).sort();
        scaleToIndex = new Map(scaleList.map((s, i) => [s, i]));
        numScaleDimensions = scaleList.length;
        addLogMessage(`Preparing one-hot encoding for 'keyScale' (${numScaleDimensions} dimensions).`, 'complete');
    }

    // Construct vectors using common features in canonical order
    let inconsistencyFound = false;
    activeFeatures.forEach(({ id, features }) => {
        const vec: number[] = [];
        for (const key of canonicalFeatureOrder) {
            if (!commonFeatures.has(key)) continue;

            const value = features[key]!; // Value guaranteed to exist

            if (key === 'key' && keyToIndex) {
                const keyOneHot = Array(numKeyDimensions).fill(0);
                const index = keyToIndex.get(value as string);
                if (index !== undefined) keyOneHot[index] = 1;
                else { addLogMessage(`Logic error: Key '${value}' for song ${id} not found in keyToIndex map.`, 'error'); inconsistencyFound = true; }
                vec.push(...keyOneHot);
            } else if (key === 'keyScale' && scaleToIndex) {
                const scaleOneHot = Array(numScaleDimensions).fill(0);
                const index = scaleToIndex.get(value as string);
                if (index !== undefined) scaleOneHot[index] = 1;
                else { addLogMessage(`Logic error: Scale '${value}' for song ${id} not found in scaleToIndex map.`, 'error'); inconsistencyFound = true; }
                vec.push(...scaleOneHot);
            } else if (Array.isArray(value)) {
                vec.push(...(value as number[]));
            } else if (typeof value === 'number') {
                vec.push(value);
            }
        }

        if (vec.length > 0 && !inconsistencyFound) {
            featureVectors.push(vec);
            vectorSongIds.push(id);
        } else if (!inconsistencyFound) {
             addLogMessage(`Song ${id} resulted in an empty vector despite having common features.`, 'warn');
        }
    });

    if (inconsistencyFound) {
        addLogMessage('Inconsistencies found during one-hot encoding. Aborting reduction.', 'error');
        setIsReducing(false);
        return;
    }

    // Check vector consistency and dimensions
    if (featureVectors.length > 0) {
        const firstLen = featureVectors[0].length;
        if (!featureVectors.every(v => v.length === firstLen)) {
             addLogMessage('Constructed feature vectors have inconsistent lengths. Cannot proceed with reduction.', 'error');
             setIsReducing(false);
             return;
        }
        if (firstLen === 0) {
            addLogMessage('Constructed feature vectors are empty (length 0). Cannot reduce.', 'warn');
             setIsReducing(false);
             return;
        }
        addLogMessage(`Prepared ${featureVectors.length} vectors for reduction, each with ${firstLen} dimensions (incl. one-hot).`, 'complete');

        // Check if target dimensions exceed source dimensions
        if (dimensions >= firstLen) {
            addLogMessage(`Target dimensions (${dimensions}) must be less than source dimensions (${firstLen}). Aborting reduction.`, 'warn');
            setIsReducing(false);
            return;
        }

    } else {
         addLogMessage('No valid feature vectors constructed for reduction.', 'warn');
         setIsReducing(false);
         return;
    }

    // 3. Post message to worker
    addLogMessage(`Sending ${featureVectors.length} vectors to Druid worker for reduction...`, 'info');
    druidWorkerRef.current.postMessage({
        type: 'reduceDimensions',
        payload: {
            featureVectors: featureVectors,
            songIds: vectorSongIds,
            method: method,
            dimensions: dimensions,
            ...(params && { ...params }) // Include optional params
        }
    });

}, [activeSongIds, songFeatures, featureStatus, isReducing, addLogMessage]); // Added addLogMessage


  // Calculate derived state: Check if any active song has completed features
  const hasFeaturesForActiveSongs = useMemo(() => {
      return Array.from(activeSongIds).some(id =>
          featureStatus[id] === 'complete' && songFeatures[id] != null
      );
  }, [activeSongIds, featureStatus, songFeatures]);


  // --- Clustering Handler ---
  const handleRunClustering = useCallback((k: number) => {
      if (!kmeansWorkerRef.current || isClustering || isProcessing || isReducing) {
          addLogMessage('Cannot start clustering: Worker not ready or another process is active.', 'warn');
          return;
      }

      const activeReducedData: { id: string, vector: number[] }[] = [];
      let skippedCount = 0;
      let dimensionMismatchCount = 0;
      const targetDim = reductionDimensions; // Capture current target dimension

      activeSongIds.forEach(id => {
          const vector = reducedDataPoints[id];
          if (vector && vector.length > 0) {
              // Use targetDim for check if it's > 0, otherwise just check if vector exists
              if (targetDim > 0 && vector.length !== targetDim) {
                  dimensionMismatchCount++;
              } else {
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
          addLogMessage(`Skipping ${dimensionMismatchCount} active songs with mismatched dimensions (expected ${targetDim}) for clustering.`, 'warn');
      }


      if (activeReducedData.length === 0) {
          addLogMessage('No valid reduced data points found for active songs to cluster.', 'warn');
          return;
      }

      if (k <= 0) {
          addLogMessage(`Invalid k value: ${k}. Must be greater than 0.`, 'warn');
          return;
      }

       if (activeReducedData.length < k) {
          addLogMessage(`Cannot cluster: Not enough data points (${activeReducedData.length}) for k=${k}. Need at least k points.`, 'warn');
          return;
      }


      const dataForWorker = activeReducedData.map(d => d.vector);
      const idsForWorker = activeReducedData.map(d => d.id);

      addLogMessage(`Starting K-Means clustering with k=${k} for ${dataForWorker.length} points...`, 'info');
      setIsClustering(true);
      setKmeansIteration(0);
      setKmeansCentroids([]);
      setKmeansAssignments({});
      setKmeansK(k); // Store the requested K

      kmeansWorkerRef.current.postMessage({
          type: 'startTraining',
          payload: {
              reducedData: dataForWorker,
              songIds: idsForWorker,
              k: k,
              // maxIter: 50 // Optionally override worker default
          }
      });

  }, [isClustering, isProcessing, isReducing, activeSongIds, reducedDataPoints, reductionDimensions, kmeansWorkerRef, addLogMessage]); // Added addLogMessage

  // --- Derived State ---
    const hasReducedDataForActiveSongs = useMemo(() => {
      const targetDim = reductionDimensions; // Capture current target dimension
      return Array.from(activeSongIds).some(id => {
          const point = reducedDataPoints[id];
          // Check if point exists and either dimensions match or no specific dimension is set yet
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

  // --- Handler for Toggling the About Dialog ---
  const handleToggleAboutDialog = () => {
    setIsAboutDialogOpen(prev => !prev);
  };

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
        <div className="flex items-center gap-4"> {/* Wrapper for status and button */}
          <div className="text-sm text-cyan-300">
            {/* Status Text */}
            <span>
              {isProcessing ? 'Processing Audio... ' : ''}
              {isReducing ? 'Reducing Dimensions... ' : ''}
              {isClustering ? `Clustering (Iter: ${kmeansIteration})... ` : ''}
              {!isProcessing && !isReducing && !isClustering ? 'Ready ' : ''}
            </span>
            {/* Overall Counts (remain useful) */}
            <span className="ml-2">
              ({songs.filter(s => featureStatus[s.id] === 'complete').length} / {songs.length} songs processed)
            </span>
            {!essentiaWorkerReady && <span className="text-red-500 ml-2">Worker Error!</span>}

            {/* Progress Bar - Conditionally rendered */}
            {isProcessing && processingSongIds.size > 0 && (
               <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-cyan-500 transition-width duration-150 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            )}
          </div>
          {/* About Text Link */}
          <span
            onClick={handleToggleAboutDialog}
            className="text-cyan-300 hover:text-cyan-400 cursor-pointer text-sm whitespace-nowrap mr-4"
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
      <div className="flex-grow grid grid-cols-[auto_1fr_auto] grid-rows-[3fr_1fr] min-h-full max-h-full gap-4"> {/* Use auto columns for sides, fr for middle */} 
        {/* Song List Panel (Left Column, Full Height, Max Width) */}
        <SongListPanel
          className="col-span-1 row-span-2 max-w-xs max-h-full" // Added max-width
          songs={songs}
          featureStatus={featureStatus}
          activeSongIds={activeSongIds}
          isProcessing={isProcessing || isReducing || isClustering}
          onToggleSongActive={handleToggleSongActive}
          onRemoveSong={handleRemoveSong}
          onUploadClick={handleUploadClick}
          onAddSongs={handleAddSongs} // Pass the new handler
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          onShowDetails={handleShowDetails}
        />

        {/* Visualization Panel (Middle Column, Top Row) */}
        <VisualizationPanel
          className="col-span-1 row-span-1 max-h-full min-h-full" // Updated spans
          activeSongIds={activeSongIds}
          songs={songs}
          reducedDataPoints={reducedDataPoints}
          reductionDimensions={reductionDimensions}
          kmeansAssignments={kmeansAssignments}
          kmeansCentroids={kmeansCentroids}
          kmeansIteration={kmeansIteration}
        />

         {/* Controls Panel (Right Column, Full Height, Max Width)*/}
        <ControlsPanel
          className="col-span-1 row-span-2 max-w-sm" // Added max-width
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
        />

        {/* Log Panel (Middle Column, Bottom Row) */}
        <LogPanel
           className="col-span-1 row-span-1 max-h-56" // Updated spans
           logs={filteredLogMessages}
        />
      </div>

      {/* Footer Placeholder (Optional) */}
      <footer
        className="w-full h-10 mt-4 p-2 text-center text-xs text-gray-500 border-t border-gray-700"
         data-augmented-ui="tl-clip tr-clip border"
         style={{ '--aug-border-color': '#444', '--aug-border-bg': 'transparent' } as React.CSSProperties}
      >
        Status messages or other info can go here.
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

      {/* About Dialog (Conditionally Rendered) */}
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onClose={handleToggleAboutDialog}
      />
    </main>
  );
}
