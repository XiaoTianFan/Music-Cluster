import React from 'react';
import { Song, Features } from '../app/page'; // Assuming types are exported from page.tsx

interface SongDetailsDialogProps {
  song: Song;
  features: Features | null;
  onClose: () => void;
}

const SongDetailsDialog: React.FC<SongDetailsDialogProps> = ({ song, features, onClose }) => {
  
  // Helper to format feature values
  const formatValue = (value: any): string => {
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

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div 
        className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full border border-teal-500 relative max-h-[80vh] flex flex-col"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        style={{ '--aug-border-color': 'teal' } as React.CSSProperties}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-teal-300 truncate pr-10" title={song.name}>
            Details: {song.name}
          </h2>
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl font-bold"
            aria-label="Close details dialog"
            title="Close"
          >
            &times; {/* Unicode multiplication sign for 'X' */}
          </button>
        </div>

        {/* Content Area - Scrollable */}
        <div className="overflow-y-auto flex-grow pr-2 text-sm"> 
          {!features ? (
            <p className="text-yellow-400">Feature data not available for this song.</p>
          ) : (
            <ul className="list-none p-0 space-y-2">
              {Object.entries(features).map(([key, value]) => (
                <li key={key} className="flex justify-between border-b border-gray-700 pb-1">
                  <span className="font-medium text-teal-400 mr-2">{key}:</span> 
                  <span className="text-right text-gray-300 truncate" title={String(value)}>
                     {formatValue(value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

         {/* Footer/Actions (Optional) */}
         <div className="mt-4 pt-3 border-t border-gray-700 flex justify-end flex-shrink-0">
             <button 
                onClick={onClose} 
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-teal-100 rounded text-sm font-semibold"
                data-augmented-ui="tl-clip br-clip border"
                style={{ '--aug-border-color': 'teal' } as React.CSSProperties}
             >
                Close
             </button>
         </div>
      </div>
    </div>
  );
};

export default SongDetailsDialog; 