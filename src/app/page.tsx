'use client'; // Add this directive to make it a Client Component

import React, { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';

// Define a type for our song objects
interface Song {
  id: string; // Using URL or a generated ID for uniqueness
  name: string;
  url: string;
  source: 'default' | 'user';
}

// Define a type for the extracted features (expand this later)
interface Features {
  mfccMeans: number[];
  mfccStdDevs: number[];
  // Add other features here
}

// Type for feature status tracking
type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';

// List of default songs based on the directory listing
const defaultSongs: Song[] = [
  { id: '/audio/Queen_Bohemian Rhapsody.mp3', name: 'Queen - Bohemian Rhapsody.mp3', url: '/audio/Queen_Bohemian Rhapsody.mp3', source: 'default' },
  { id: '/audio/Genesis_Selling England by the Pond_Firth of Fifth.mp3', name: 'Genesis - Firth of Fifth.mp3', url: '/audio/Genesis_Selling England by the Pond_Firth of Fifth.mp3', source: 'default' },
  { id: '/audio/The Beatles_Abbey Road_Come Together.mp3', name: 'The Beatles - Come Together.mp3', url: '/audio/The Beatles_Abbey Road_Come Together.mp3', source: 'default' },
  { id: '/audio/King Crimson_In the Court of the Crimson King_The Court of the Crimson King.mp3', name: 'King Crimson - Court of the Crimson King.mp3', url: '/audio/King Crimson_In the Court of the Crimson King_The Court of the Crimson King.mp3', source: 'default' },
  { id: '/audio/Yes_Close to the Edge_Close to the Edge.mp3', name: 'Yes - Close to the Edge.mp3', url: '/audio/Yes_Close to the Edge_Close to the Edge.mp3', source: 'default' },
  { id: '/audio/Yes_Fragile_Roundabout.mp3', name: 'Yes - Roundabout.mp3', url: '/audio/Yes_Fragile_Roundabout.mp3', source: 'default' },
];

export default function DashboardPage() {
  const [songs, setSongs] = useState<Song[]>(defaultSongs);
  const [songFeatures, setSongFeatures] = useState<Record<string, Features | null>>({}); // { songId: features }
  const [featureStatus, setFeatureStatus] = useState<Record<string, FeatureStatus>>({}); // { songId: status }
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [essentiaWorkerReady, setEssentiaWorkerReady] = useState<boolean>(false);

  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
    const currentSongNames = new Set(songs.map(s => s.name)); // Faster lookup

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/')) {
        // Check if song already exists (by name)
        if (!currentSongNames.has(file.name)) {
            const objectURL = URL.createObjectURL(file);
            newSongs.push({
               id: objectURL, // Use object URL as a temporary unique ID
               name: file.name,
               url: objectURL,
               source: 'user',
            });
        }
        // Note: We might want to revoke object URLs later when they're no longer needed
        // URL.revokeObjectURL(objectURL);
      }
    }

    if (newSongs.length > 0) {
      setSongs(prevSongs => [...prevSongs, ...newSongs]);
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
    
    // Revoke object URL if it's a user-uploaded file being removed
    if (songToRemove && songToRemove.source === 'user') {
        URL.revokeObjectURL(songToRemove.url);
    }
    setSongs(prevSongs => prevSongs.filter(song => song.id !== songIdToRemove));
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

  // Function to trigger feature extraction for all songs
  const handleExtractFeatures = useCallback(async () => {
    if (!essentiaWorkerReady || isProcessing || !workerRef.current) {
        console.warn('Worker not ready or already processing.');
        return;
    }

    console.log('Starting feature extraction for all songs...');
    setIsProcessing(true);

    // Reset status for all songs before starting
    const initialStatus = songs.reduce((acc, song) => {
        acc[song.id] = 'processing';
        return acc;
    }, {} as Record<string, FeatureStatus>);
    setFeatureStatus(initialStatus);
    setSongFeatures({}); // Clear previous features

    for (const song of songs) {
        console.log(`Processing ${song.name}...`);
        const audioBuffer = await getDecodedAudio(song);

        if (audioBuffer && workerRef.current) {
            // Essentia typically works with mono audio at a specific sample rate
            // For simplicity here, we send the first channel if stereo
            // Resampling might be needed depending on the model/features
            const audioData = audioBuffer.getChannelData(0); // Use first channel (mono)
            // Send audio data (as Array or Float32Array) and necessary info to worker
            // Need to transfer ownership or copy the data for the worker
             const audioVector = Array.from(audioData); // Convert Float32Array to plain array for transfer

             workerRef.current.postMessage({
                type: 'extractFeatures',
                payload: {
                    songId: song.id,
                    audioVector: audioVector, // Send as plain array
                    sampleRate: audioBuffer.sampleRate
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
  }, [songs, getDecodedAudio, essentiaWorkerReady, isProcessing]);


  return (
    <main className="flex flex-col min-h-screen p-4 bg-gray-900 text-gray-100 font-[family-name:var(--font-geist-mono)]">
      {/* Header/Top Controls Placeholder */}
      <div
        className="w-full h-16 mb-4 p-2 flex justify-between items-center border border-cyan-500"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        style={{ '--aug-border-color': 'cyan', '--aug-border-bg': 'transparent' } as React.CSSProperties}
      >
        <h1 className="text-xl font-bold text-cyan-400">SongCluster Dashboard</h1>
        <div className="text-sm text-cyan-300">
          {isProcessing ? 'Processing Audio... ' : 'Ready'}
          ({songs.filter(s => featureStatus[s.id] === 'complete').length} / {songs.length} songs complete)
          {!essentiaWorkerReady && <span className="text-red-500 ml-2">Worker Error!</span>}
        </div>
      </div>

      <div className="flex flex-grow gap-4">
        {/* Main Visualization Area Placeholder */}
        <div
          className="flex-grow h-full p-4 border border-pink-500 flex items-center justify-center"
          data-augmented-ui="tl-clip-x tr-round br-clip bl-round border"
          style={{ '--aug-border-color': 'hotpink', '--aug-border-bg': 'transparent' } as React.CSSProperties}
        >
          <p className="text-pink-400">[Main Visualization Area]</p>
        </div>

        {/* Side Panel for Controls Placeholder */}
        <div
          className="w-72 h-full p-4 border border-green-500 flex flex-col"
          data-augmented-ui="tl-round tr-clip br-clip-x bl-clip border"
          style={{ '--aug-border-color': 'lime', '--aug-border-bg': 'transparent' } as React.CSSProperties}
        >
          <h2 className="text-lg font-semibold mb-4 text-green-400">Controls</h2>

          {/* Audio Input Section */}
          <div className="mb-4" data-augmented-ui="tl-clip br-clip border" style={{ '--aug-border-color': '#555' } as React.CSSProperties}>
            <label htmlFor="audio-upload" className="block text-sm font-medium text-green-300 p-2 cursor-pointer hover:bg-gray-700">
              Upload Audio Files
            </label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileChange}
              className="hidden" // Hide default input, style the label
            />
          </div>

           {/* Song List Section */}
          <div className="mb-4 flex-grow overflow-y-auto" data-augmented-ui="tl-clip br-clip border" style={{ '--aug-border-color': '#555' } as React.CSSProperties}>
            <h3 className="text-md font-semibold p-2 text-green-300 sticky top-0 bg-gray-900">Selected Songs ({songs.length}):</h3>
            <ul className="list-none p-2">
              {songs.map((song) => (
                <li key={song.id} className="flex justify-between items-center text-xs mb-1 p-1 hover:bg-gray-800">
                  <span title={song.name} className="truncate flex-grow mr-2">
                    {song.name}
                     {featureStatus[song.id] === 'processing' && <span className="text-yellow-400 ml-1"> (Proc...)</span>}
                     {featureStatus[song.id] === 'complete' && <span className="text-green-400 ml-1"> (Done)</span>}
                     {featureStatus[song.id] === 'error' && <span className="text-red-500 ml-1"> (Error)</span>}
                  </span>
                  {song.source === 'user' && (
                    <button
                      onClick={() => handleRemoveSong(song.id)}
                      className="text-red-500 hover:text-red-400 text-xs px-1 py-0.5 rounded bg-gray-700 hover:bg-gray-600 flex-shrink-0"
                      data-augmented-ui="br-clip"
                      disabled={isProcessing} // Disable remove while processing
                    >
                      X
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons Section */}
          <div className="mt-auto border-t border-gray-700 pt-4">
            <button
              onClick={handleExtractFeatures}
              disabled={!essentiaWorkerReady || isProcessing || songs.length === 0}
              className={`w-full p-2 text-center rounded font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${essentiaWorkerReady && !isProcessing && songs.length > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400'}`}
               data-augmented-ui="tl-clip br-clip border"
               style={{ '--aug-border-color': (essentiaWorkerReady && !isProcessing && songs.length > 0) ? 'lime' : '#555' } as React.CSSProperties}
            >
              {isProcessing ? 'Processing...' : 'Extract Features'}
            </button>
          </div>

          {/* Other Controls Placeholders */}
          {/* <p className="text-green-300 text-sm mt-4">[MIR Feature Selection]</p> */}
          {/* <p className="text-green-300 text-sm mt-auto">[Dimensionality Reduction Options]</p> */}
          {/* <p className="text-green-300 text-sm mt-auto">[Clustering Options]</p> */}

        </div>
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
