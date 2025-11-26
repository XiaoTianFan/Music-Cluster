'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Song, Features } from '../app/page'; 
import BasePanel from './ui/BasePanel'; 
import Button from './ui/Button';
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/plugins/spectrogram';

interface SongDetailsDialogProps {
  song: Song;
  features: Features | null;
  onClose: () => void;
}

const SongDetailsDialog: React.FC<SongDetailsDialogProps> = ({ song, features, onClose }) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const spectrogramRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!waveformRef.current || !spectrogramRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#00bdd6', // Primary accent
      progressColor: '#008ba3', // Darker primary accent for progress
      cursorColor: '#c52e61', // Tertiary accent
      barWidth: 2,
      barGap: 1,
      height: 128,
    });

    // Initialize Spectrogram plugin
    ws.registerPlugin(
      Spectrogram.create({
        container: spectrogramRef.current,
        labels: true,
        height: 256, 
        fftSamples: 512,           // FFT size (power of 2)
        windowFunc: 'hann',        // Window function
        scale: 'mel',              // Frequency scale (linear, mel, bark, erb)
        colorMap: 'roseus',        // Color palette (roseus, gray, igray)
        frequencyMin: 0,           // Min frequency (Hz)
        frequencyMax: 4000,       // Max frequency (Hz)
        gainDB: 20,                // Brightness boost
        rangeDB: 90,               // Display range
        splitChannels: false,
        useWebWorker: false
      })
    );

    ws.load(song.url);

    ws.on('ready', () => {
      setIsReady(true);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [song.url]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  // Helper to format feature values
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'number') return value.toFixed(3); // Format numbers
    if (Array.isArray(value)) {
      // Format arrays - show first few elements
      const maxItems = 5;
      const displayItems = value.slice(0, maxItems).map(v => formatValue(v));
      return `[${displayItems.join(', ')}${value.length > maxItems ? ', ...' : ''} (${value.length} items)`;
    }
    return String(value);
  };

  // Define styles and props for BasePanel (copied from AboutDialog)
  // Increased max-width to accommodate visualizations
  const panelClassName = "text-gray-100 shadow-xl max-w-4xl w-full relative max-h-[90vh] flex flex-col"; 
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
  } as React.CSSProperties;
  const panelDataAugmentedUi = "tl-clip-x tr-round br-clip bl-round border";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      {/* Use BasePanel */}
      <BasePanel 
        className={panelClassName}
        data-augmented-ui={panelDataAugmentedUi}
        style={panelStyle}
      >
        {/* Content Wrapper - Apply padding here */}
        <div className="p-6 flex flex-col flex-grow min-h-0 gap-4"> 
          {/* Header */}
          <div className="flex justify-between items-center flex-shrink-0">
            <h2 className="text-xl font-semibold text-[var(--accent-primary)] truncate pr-10" title={song.name}>
              Details: {song.name}
            </h2>
            <button 
              onClick={onClose} 
              className="absolute top-3 right-3 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold p-1 leading-none" 
              aria-label="Close details dialog"
              title="Close"
            >
              &times;
            </button>
          </div>

          {/* Visualization Section */}
          <div className="flex-shrink-0 bg-black/20 p-4 rounded border border-gray-700">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Audio Analysis</h3>
                <button
                    onClick={handlePlayPause}
                    disabled={!isReady}
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded ${
                        isReady 
                            ? 'bg-[var(--accent-primary)] text-white hover:opacity-90' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
            </div>
            
            {/* Waveform Container */}
            <div ref={waveformRef} className="w-full mb-2" />
            
            {/* Spectrogram Container */}
            <div ref={spectrogramRef} className="w-full" />
          </div>

          {/* Feature List - Scrollable */}
          <div className="overflow-y-auto flex-grow pr-2 text-sm hide-scrollbar"> 
            <h3 className="text-lg font-semibold text-[var(--accent-primary)] mb-2 sticky top-0 bg-transparent pb-2 border-b border-gray-700 z-10">
                Extracted Features
            </h3>
            {!features ? (
              <p className="text-yellow-400/90">Feature data not available for this song or yet to be extracted.</p>
            ) : (
              <ul className="list-none p-0 space-y-2">
                {Object.entries(features).map(([key, value]) => (
                  <li key={key} className="flex justify-between border-b border-gray-700 pb-1">
                    <span className="font-medium text-[var(--accent-primary)] mr-2">{key}:</span> 
                    <span className="text-right text-gray-300 truncate max-w-[60%]" title={String(value)}>
                      {formatValue(value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer/Actions */}
          <div className="pt-3 border-t border-gray-700 flex-shrink-0">
              <Button 
                  onClick={onClose} 
                  enableTilt={true}
                  className="w-full flex-shrink-0"
                  variant="primary"
              >
                  Close
              </Button>
          </div>
        </div>
      </BasePanel>
    </div>
  );
};

export default SongDetailsDialog;
