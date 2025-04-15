import React, { useState, DragEvent, useCallback, useMemo } from 'react';
import { PlayIcon, PauseIcon, TrashIcon, InformationCircleIcon, ArrowUpTrayIcon } from '@heroicons/react/24/solid';
import Marquee from "react-fast-marquee";
import BasePanel from './ui/BasePanel'; // <-- Import BasePanel
import Button from './ui/Button'; // <-- Import Button

// Re-import types from page.tsx or define locally/globally
interface Song {
  id: string;
  name: string;
  url: string;
  source: 'default' | 'user';
}
type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';
// TYPE IMPORT: Import KmeansAssignments if defined globally, or define here
interface KmeansAssignments {
    [songId: string]: number; // Map songId to cluster index
}

// Define props based on analysis of page.tsx
interface SongListPanelProps {
  songs: Song[];
  featureStatus: Record<string, FeatureStatus>;
  activeSongIds: Set<string>; // Set of IDs for songs included in processing
  kmeansAssignments: KmeansAssignments; // <-- ADDED PROP
  isProcessing: boolean;
  onToggleSongActive: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onUploadClick: () => void; // Function to trigger file input in parent
  onAddSongs: (newSongs: Song[]) => void; // New prop for handling dropped/added songs
  onSelectAll: () => void; // Added prop
  onClearAll: () => void;  // Added prop
  onShowDetails: (songId: string) => void; // Prop to trigger showing details
  // --- NEW: Audio Player Props ---
  onPlayRequest: (songId: string) => void;
  currentlyPlayingSongId: string | null;
  isPlaying: boolean;
  // ----------------------------
  className?: string; // Allow passing className for layout adjustments
}

// --- ADDED: Color definitions (should match VisualizationPanel) ---
const plotlyColors = [
  '#1f77b4',  // Muted blue
  '#ff7f0e',  // Safety orange
  '#2ca02c',  // Cooked asparagus green
  '#d62728',  // Brick red
  '#9467bd',  // Muted purple
  '#8c564b',  // Chestnut brown
  '#e377c2',  // Raspberry yogurt pink
  '#7f7f7f',  // Middle gray
  '#bcbd22',  // Curry yellow-green
  '#17becf',  // Blue-teal
  '#aec7e8',  // Light blue
  '#ffbb78',  // Light orange
  '#98df8a',  // Light green
  '#ff9896',  // Light red
  '#c5b0d5',  // Light purple
  '#c49c94',  // Light brown
  '#f7b6d2',  // Light pink
  '#c7c7c7',  // Light gray
  '#dbdb8d',  // Light yellow-green
  '#9edae5',  // Light blue-teal
  '#393b79',  // Dark blue
  '#843c39',  // Dark red
  '#5254a3',  // Dark purple
  '#8c6d31',  // Dark brown
  '#637939',  // Dark green
  '#8ca252',  // Olive green
  '#b5cf6b',  // Lime green
  '#cedb9c',  // Pale green
  '#8c6d31',  // Dark gold
  '#bd9e39'   // Gold
];

// --- ADDED: Helper function to convert hex to RGBA ---
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
// --------------------------------------------------------

const SongListPanel: React.FC<SongListPanelProps> = ({ 
  songs, 
  featureStatus, 
  activeSongIds,
  kmeansAssignments, // <-- Destructure added prop
  isProcessing,
  onToggleSongActive,
  onRemoveSong, 
  onUploadClick,
  onAddSongs, // Destructure new prop
  onSelectAll, // Destructure added prop
  onClearAll,  // Destructure added prop
  onShowDetails, // Destructure added prop
  // --- NEW: Destructure Audio Props ---
  onPlayRequest,
  currentlyPlayingSongId,
  isPlaying,
  // ----------------------------------
  className 
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Sort songs: user songs first, then default songs (alphabetically within groups)
  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      // NEW Primary sort: selected first
      const aIsActive = activeSongIds.has(a.id);
      const bIsActive = activeSongIds.has(b.id);
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      // NEW: Secondary sort (within active songs): by cluster index
      if (aIsActive && bIsActive) {
          const clusterA = kmeansAssignments[a.id];
          const clusterB = kmeansAssignments[b.id];

          // Put assigned songs before unassigned
          if (clusterA !== undefined && clusterB === undefined) return -1;
          if (clusterA === undefined && clusterB !== undefined) return 1;
          
          // Sort by cluster index if both assigned
          if (clusterA !== undefined && clusterB !== undefined) {
              if (clusterA < clusterB) return -1;
              if (clusterA > clusterB) return 1;
              // If clusters are the same, fall through to tertiary sort
          }
          // If neither is assigned within active group, fall through
      }
      
      // Tertiary sort: user source first (applies to non-active OR active with same cluster/no cluster)
      if (a.source === 'user' && b.source !== 'user') return -1;
      if (a.source !== 'user' && b.source === 'user') return 1;
      
      // Quaternary sort: alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [songs, activeSongIds, kmeansAssignments]);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
    event.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  }, [isDraggingOver]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Check if the leave event is going outside the component boundary
    // event.relatedTarget helps determine if we left the component or just moved over a child
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false); // Reset visual state

    if (isProcessing) return; // Don't allow drop while processing

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) {
      return;
    }

    const newSongs: Song[] = [];
    // Note: We don't have access to the full song list here to check for duplicates easily.
    // Duplicate checking logic should primarily reside in the parent (`page.tsx`) via `onAddSongs`.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('audio/')) {
        const objectURL = URL.createObjectURL(file);
        // Basic info for the new song object
        newSongs.push({
          id: objectURL, // Use object URL as a unique ID (parent should verify)
          name: file.name,
          url: objectURL,
          source: 'user',
        });
      } else {
        // Optionally provide feedback about skipped non-audio files (can be done in parent too)
        console.warn(`Skipped non-audio file: ${file.name}`);
      }
    }

    if (newSongs.length > 0) {
      onAddSongs(newSongs); // Pass the generated song objects to the parent
    }
  }, [isProcessing, onAddSongs]);

  // Prepare props for BasePanel
  const panelClassName = `
    flex flex-col h-[85vh] 
    transition-colors duration-200 
    ${isDraggingOver ? 'bg-blue-900/30 border-blue-300' : ''} 
    ${className || ''}
  `.replace('p-4', '').replace('relative', '').trim();
  
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
    '--aug-border-all': '1px', 
    '--aug-border-y': '2px' 
  } as React.CSSProperties;

  const panelDataAugmentedUi = "tl-clip tr-clip br-clip bl-clip border";

  return (
    <BasePanel
      className={panelClassName}
      data-augmented-ui={panelDataAugmentedUi}
      style={panelStyle}
      // Attach drag/drop handlers to BasePanel
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="text-lg font-semibold mb-2 text-[var(--accent-secondary)] flex-shrink-0">Song Pool ({activeSongIds.size}/{songs.length} selected)</h2>
      
      {/* Drop Target Hint */} 
       {isDraggingOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-cyan-300 font-bold pointer-events-none z-10">
          Drop Audio Files Here
        </div>
      )}

      {/* Song List Area - Removed flex-grow */}
      <div className="h-[70vh] min-h-0 overflow-y-scroll mb-2 hide-scrollbar relative z-0"> {/* Ensure list is below hint */}
         <ul className="h-[70vh] list-none p-0 min-h-0">
            {/* Map over the SORTED 'songs' array */}
            {sortedSongs.map((song) => { 
                // --- ADDED: Background color logic ---
                let backgroundColor = 'transparent';
                const clusterIndex = kmeansAssignments[song.id];
                if (clusterIndex !== undefined) {
                    const baseColor = plotlyColors[clusterIndex % plotlyColors.length];
                    backgroundColor = hexToRgba(baseColor, 0.2); // 30% opacity
                }
                // Determine if this song is the one currently playing
                const isCurrentlyPlaying = currentlyPlayingSongId === song.id && isPlaying;
                const status = featureStatus[song.id] ?? 'idle';
                // -------------------------------------
                return (
                    <li 
                        key={song.id} 
                        className="group flex justify-between items-center max-h-[5vh] text-xs p-2 pr-2 hover:bg-gray-800/50 border-b border-gray-700/50 relative" 
                        style={{ backgroundColor }} 
                        onMouseEnter={() => setHoveredItemId(song.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                    >
                        {/* Content Container (In Flow - Checkbox and Text only) */}
                        <div className="flex items-center min-w-0 w-full"> 
                            <input 
                                type="checkbox" 
                                checked={activeSongIds.has(song.id)}
                                onChange={() => onToggleSongActive(song.id)}
                                disabled={isProcessing} 
                                className="mr-2 flex-shrink-0 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                                title={activeSongIds.has(song.id) ? "Exclude from processing" : "Include in processing"}
                            />
                            {/* Text now takes all available space in the flow */}
                            <div title={song.name} className="truncate flex-grow min-w-0"> 
                                {/* Conditionally Render Marquee or Static Text */}
                                {hoveredItemId === song.id ? (
                                    <Marquee 
                                       play={true} // Always play when rendered/hovered
                                       gradient={false} 
                                       speed={30} 
                                       pauseOnHover={true} // Still useful if cursor moves onto the marquee itself
                                       className="overflow-visible" 
                                    >
                                       {song.name} 
                                       {/* Add spacing for continuous loop appearance */}
                                       <>&nbsp;&nbsp;&nbsp;</> 
                                    </Marquee>
                                ) : (
                                    <span className="block truncate">{/* Use span for static text */} 
                                        {song.name}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* --- Button Container (Absolute Position, Hover Visible, Higher Z-Index) --- */} 
                        <span 
                            className="absolute top-1/2 right-2 -translate-y-1/2 z-10 
                                       flex items-center gap-1 
                                       opacity-0 group-hover:opacity-100 transition-opacity duration-150 
                                       bg-gray-800/80 rounded px-1 py-0.5" // Background on the container
                        > 
                            {/* Details Button */}
                            {status === 'complete' && (
                                <button 
                                    onClick={() => onShowDetails(song.id)}
                                    title="Show Features"
                                    className="text-blue-400 hover:text-blue-300 disabled:opacity-50 p-0.5" 
                                    disabled={isProcessing}
                                >
                                    <InformationCircleIcon className="h-4 w-4" />
                                </button>
                            )}
                            {/* Play Button */} 
                            <button 
                                onClick={() => onPlayRequest(song.id)}
                                title={isCurrentlyPlaying ? "Pause" : "Play"}
                                className={`p-0.5 
                                          ${isCurrentlyPlaying ? 'text-green-400 hover:text-green-300' : 'text-cyan-400 hover:text-cyan-300'}
                                          ${isProcessing ? 'cursor-not-allowed opacity-50' : ''} `}
                                disabled={isProcessing}
                            >
                                {isCurrentlyPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                            </button>
                            {/* Remove Button */}
                            <button 
                                onClick={() => onRemoveSong(song.id)}
                                title="Remove Song"
                                className="text-red-500 hover:text-red-400 disabled:opacity-50 p-0.5"
                                disabled={isProcessing}
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </span> 
                    </li>
                );
            })}
         </ul>
      </div>

      {/* --- Controls Footer Wrapper (Pushes controls to bottom) --- */}
      <div className="mt-auto flex-shrink-0 pt-2"> 
          {/* Selection Controls Area */}
          <div className="flex justify-between items-center mb-2 flex-shrink-0"> {/* Removed mt-2 */}
            {/* Select/Clear Buttons */}
            <div className="flex gap-1">
                <Button // <-- Use Button component
                    onClick={onSelectAll}
                    disabled={isProcessing}
                    variant="secondary" // <-- Specify variant
                    className="px-4 py-1 text-xs" // Keep specific padding/text size if needed, remove old styling
                    title="Select all songs"
                >
                    All
                </Button>
                <Button // <-- Use Button component
                    onClick={onClearAll}
                    disabled={isProcessing || activeSongIds.size === 0}
                    variant="secondary" // <-- Specify variant
                    className="px-4 py-1 text-xs" // Keep specific padding/text size if needed, remove old styling
                    title="Deselect all songs"
                >
                    Clear
                </Button>
            </div>
            <div className="flex-grow"></div> 
          </div>
    
          {/* Upload Button */}
          <Button // <-- Use Button component
            onClick={onUploadClick}
            enableTilt={true}
            className="w-full flex-shrink-0" // Removed mt-auto, kept w-full and flex-shrink-0
            variant="primary" // <-- Specify variant
            disabled={isProcessing} 
          >
            Upload Audio Files
          </Button>
      </div>
      {/* --------------------------------------------------------- */}

    </BasePanel>
  );
};

export default SongListPanel; 