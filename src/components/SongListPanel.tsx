import React, { useState, ChangeEvent } from 'react';

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
  className 
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(songs.length / SONGS_PER_PAGE);
  const startIndex = (currentPage - 1) * SONGS_PER_PAGE;
  const endIndex = startIndex + SONGS_PER_PAGE;
  const currentSongs = songs.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div
      className={`p-4 border border-blue-500 flex flex-col ${className || ''}`}
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      style={{ '--aug-border-color': 'deepskyblue' } as React.CSSProperties}
    >
      <h2 className="text-lg font-semibold mb-2 text-blue-400 flex-shrink-0">Song Pool ({activeSongIds.size} / {songs.length} selected)</h2>
      
      {/* Song List Area */}
      <div className="flex-grow overflow-y-auto mb-2">
         <ul className="list-none p-0">
            {currentSongs.map((song) => (
            <li key={song.id} className="flex justify-between items-center text-xs mb-1 p-1 pr-2 hover:bg-gray-800/50 border-b border-gray-700/50">
                <div className="flex items-center flex-grow mr-2 min-w-0">
                    <input 
                        type="checkbox" 
                        checked={activeSongIds.has(song.id)}
                        onChange={() => onToggleSongActive(song.id)}
                        disabled={isProcessing} // Disable toggle while processing maybe?
                        className="mr-2 flex-shrink-0 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                        title={activeSongIds.has(song.id) ? "Exclude from processing" : "Include in processing"}
                    />
                    <span title={song.name} className="truncate">
                        {song.name}
                        {featureStatus[song.id] === 'processing' && <span className="text-yellow-400 ml-1"> (Proc...)</span>}
                        {featureStatus[song.id] === 'complete' && <span className="text-green-400 ml-1"> (Done)</span>}
                        {featureStatus[song.id] === 'error' && <span className="text-red-500 ml-1"> (Error)</span>}
                    </span>
                </div>
                {song.source === 'user' && (
                <button
                    onClick={() => onRemoveSong(song.id)}
                    className="text-red-600 hover:text-red-400 text-xs px-1 py-0.5 rounded bg-gray-700 hover:bg-gray-600 flex-shrink-0 border border-red-900/50"
                    // data-augmented-ui="br-clip" // Keep button simple for now
                    disabled={isProcessing} // Disable remove while processing
                    title="Remove User Song"
                >
                    X
                </button>
                )}
            </li>
            ))}
        </ul>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-2 mb-2 flex-shrink-0">
          <button 
            onClick={handlePreviousPage} 
            disabled={currentPage === 1}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-l"
            data-augmented-ui="bl-clip"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-xs bg-gray-800 border-t border-b border-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-r"
             data-augmented-ui="br-clip"
          >
            Next
          </button>
        </div>
      )}

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