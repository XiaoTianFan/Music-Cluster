import React, { useState, ChangeEvent, DragEvent } from 'react';

// Re-import types from page.tsx or define locally/globally
interface Song {
  id: string;
  name: string;
  url: string;
  source: 'default' | 'user';
}
type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';

// Define props based on analysis of page.tsx
interface SongListPanelProps {
  songs: Song[];
  featureStatus: Record<string, FeatureStatus>;
  activeSongIds: Set<string>; // Set of IDs for songs included in processing
  isProcessing: boolean;
  onToggleSongActive: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onUploadClick: () => void; // Function to trigger file input in parent
  onAddSongs: (newSongs: Song[]) => void; // New prop for handling dropped/added songs
  onSelectAll: () => void; // Added prop
  onClearAll: () => void;  // Added prop
  onShowDetails: (songId: string) => void; // Prop to trigger showing details
  className?: string; // Allow passing className for layout adjustments
}

const SONGS_PER_PAGE = 15;

const SongListPanel: React.FC<SongListPanelProps> = ({ 
  songs, 
  featureStatus, 
  activeSongIds,
  isProcessing,
  onToggleSongActive,
  onRemoveSong, 
  onUploadClick,
  onAddSongs, // Destructure new prop
  onSelectAll, // Destructure added prop
  onClearAll,  // Destructure added prop
  onShowDetails, // Destructure added prop
  className 
}) => {
  // State for drag-over visual feedback
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Sort songs: user songs first, then default songs (alphabetically within groups)
  const sortedSongs = React.useMemo(() => {
    return [...songs].sort((a, b) => {
      // Primary sort: user source first
      if (a.source === 'user' && b.source !== 'user') return -1;
      if (a.source !== 'user' && b.source === 'user') return 1;
      // Secondary sort: alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [songs]);

  // Drag and Drop Handlers
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
    event.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Check if the leave event is going outside the component boundary
    // event.relatedTarget helps determine if we left the component or just moved over a child
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setIsDraggingOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
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
  };

  return (
    <div
      className={`p-4 border border-blue-500 flex flex-col transition-colors duration-200 ${isDraggingOver ? 'bg-blue-900/30 border-blue-300' : ''} ${className || ''}`}
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      style={{ '--aug-border-color': isDraggingOver ? 'dodgerblue' : 'deepskyblue' } as React.CSSProperties}
      // Attach drag/drop handlers
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="text-lg font-semibold mb-2 text-blue-400 flex-shrink-0">Song Pool ({activeSongIds.size}/{songs.length} selected)</h2>
      
      {/* Drop Target Hint */} 
       {isDraggingOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-cyan-300 font-bold pointer-events-none z-10">
          Drop Audio Files Here
        </div>
      )}

      {/* Song List Area - Add hide-scrollbar class */}
      <div className="flex-grow overflow-y-auto mb-2 hide-scrollbar relative z-0"> {/* Ensure list is below hint */}
         <ul className="list-none p-0">
            {/* Map over the SORTED 'songs' array */}
            {sortedSongs.map((song) => ( 
            <li key={song.id} className="group flex justify-between items-center text-xs mb-1 p-1 pr-2 hover:bg-gray-800/50 border-b border-gray-700/50 relative"> {/* Add group and relative positioning */}
                <div className="flex items-center flex-grow mr-2 min-w-0 overflow-hidden">
                    <input 
                        type="checkbox" 
                        checked={activeSongIds.has(song.id)}
                        onChange={() => onToggleSongActive(song.id)}
                        disabled={isProcessing} // Disable toggle while processing maybe?
                        className="mr-2 flex-shrink-0 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                        title={activeSongIds.has(song.id) ? "Exclude from processing" : "Include in processing"}
                    />
                    {/* Song Name - Takes up available space and truncates */}
                    <span title={song.name} className="truncate flex-grow mr-2">
                        {song.name}
                    </span>
                    {/* Container for details button and status */}
                    <span className="flex-shrink-0 flex items-center gap-1"> 
                        {/* Details Button (conditional) */}
                        {featureStatus[song.id] === 'complete' && (
                            <button
                                onClick={() => onShowDetails(song.id)}
                                className="text-blue-400 hover:text-blue-300 text-xs px-1 py-0.5 rounded bg-gray-700 hover:bg-gray-600 border border-blue-900/50"
                                title="Show Details"
                                // disabled={isProcessing} // Decide if viewing details should be blocked by global processing
                            >
                                Show
                            </button>
                        )}
                        
                        {/* Status Indicator */}
                        <span> {/* Wrap status in span for alignment */}
                            {featureStatus[song.id] === 'processing' && <span className="text-yellow-400">(Proc...)</span>}
                            {featureStatus[song.id] === 'complete' && <span className="text-green-400">(Done)</span>}
                            {featureStatus[song.id] === 'error' && <span className="text-red-500">(Error)</span>}
                        </span>
                    </span>
                </div>
                {/* Remove song.source === 'user' condition */}
                {/* Add group-hover visibility and adjust positioning/styling */}
                <button
                    onClick={() => onRemoveSong(song.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 invisible group-hover:visible text-red-600 hover:text-red-400 text-xs px-1 py-0.5 rounded bg-gray-700 hover:bg-gray-600 flex-shrink-0 border border-red-900/50 z-10" // Added positioning, visibility, z-index
                    disabled={isProcessing} // Disable remove while processing
                    title="Remove Song" // Generic title
                >
                    X
                </button>
            </li>
            ))}
        </ul>
      </div>

      {/* Selection Controls Area (Pagination removed) */}
      <div className="flex justify-between items-center mt-2 mb-2 flex-shrink-0">
        {/* Select/Clear Buttons */}
        <div className="flex gap-1">
            <button
                onClick={onSelectAll}
                disabled={isProcessing}
                className="px-4 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                title="Select all songs"
                data-augmented-ui="tl-clip br-clip"
            >
                All
            </button>
            <button
                onClick={onClearAll}
                disabled={isProcessing || activeSongIds.size === 0}
                className="px-4 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                title="Deselect all songs"
                data-augmented-ui="tl-clip br-clip"
            >
                Clear
            </button>
        </div>

        {/* Removed Pagination Controls section */}
        {/* <div className="flex justify-center items-center"> ... </div> */}
        {/* Add an empty div or adjust justify content if needed to keep Select/Clear left-aligned */}
        <div className="flex-grow"></div> 
      </div>

      {/* Upload Button */}
      <button
        onClick={onUploadClick}
        className="w-full p-2 mt-auto text-center rounded font-semibold text-sm bg-cyan-700 hover:bg-cyan-600 text-cyan-100 flex-shrink-0"
        data-augmented-ui="tl-clip br-clip border"
        style={{ '--aug-border-color': 'cyan' } as React.CSSProperties}
        disabled={isProcessing} // Disable upload during processing?
      >
        Upload Audio Files
      </button>

    </div>
  );
};

export default SongListPanel; 