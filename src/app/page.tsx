'use client'; // Add this directive to make it a Client Component

import React, { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';

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

  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Ref for the hidden file input

  // Initialize Worker and AudioContext
  useEffect(() => {
    // Initialize AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Initialize Worker
    if (!workerRef.current) {
        console.log('Creating Essentia Bundled Worker...');
        // Point to the bundled worker file in the public directory
        // No need for module type or turbopackIgnore anymore
        workerRef.current = new Worker(/* turbopackIgnore: true */ '/workers/essentia-worker.bundled.js'); 

        workerRef.current.onmessage = (event) => {
            const { type, payload, songId, features, error } = event.data;
            console.log('Message from worker:', event.data);

            switch (type) {
                case 'essentiaReady':
                    setEssentiaWorkerReady(payload);
                    if (!payload) {
                        console.error('Essentia worker failed to initialize:', error);
                        // Handle initialization error appropriately (e.g., show message to user)
                    }
                    break;
                case 'featureExtractionComplete':
                    setSongFeatures(prev => ({ ...prev, [songId]: features }));
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'complete' }));
                    break;
                case 'featureExtractionError':
                    console.error(`Error processing song ${songId}:`, error);
                    setFeatureStatus(prev => ({ ...prev, [songId]: 'error' }));
                    break;
                default:
                    console.warn('Unknown message type from worker:', type);
            }
        };

        workerRef.current.onerror = (error) => {
            console.error('Error in Essentia Worker:', error);
            setEssentiaWorkerReady(false); // Assume worker is unusable
             // Maybe set all processing songs to error status
            setIsProcessing(false);
        };
        
        // Send init message to worker
        workerRef.current.postMessage({ type: 'init' });

    }

    // Cleanup function
    return () => {
      if (workerRef.current) {
        console.log('Terminating Essentia Worker...');
        workerRef.current.terminate();
        workerRef.current = null;
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
          essentiaWorkerReady={essentiaWorkerReady}
          activeSongCount={activeSongIds.size}
          onExtractFeatures={handleExtractFeatures}
          // Pass down setters/handlers for controls later
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
