import React from 'react';
import { Song, Features } from '../app/page'; // Assuming types are exported from page.tsx
import BasePanel from './ui/BasePanel'; // <-- Import BasePanel

interface SongDetailsDialogProps {
  song: Song;
  features: Features | null;
  onClose: () => void;
}

const SongDetailsDialog: React.FC<SongDetailsDialogProps> = ({ song, features, onClose }) => {
  
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
  const panelClassName = "text-gray-100 shadow-xl max-w-lg w-full relative max-h-[80vh] flex flex-col"; // Adjusted max-width, added flex
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
        // Note: No stopPropagation needed here as BasePanel doesn't handle onClose directly
      >
        {/* Content Wrapper - Apply padding here */}
        <div className="p-6 flex flex-col flex-grow min-h-0"> 
          {/* Header */}
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-xl font-semibold text-[var(--accent-primary)] truncate pr-10" title={song.name}>
              Details: {song.name}
            </h2>
            <button 
              onClick={onClose} 
              className="absolute top-3 right-3 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold p-1 leading-none" // Updated hover color
              aria-label="Close details dialog"
              title="Close"
            >
              &times; {/* Unicode multiplication sign for 'X' */}
            </button>
          </div>

          {/* Content Area - Scrollable */}
          <div className="overflow-y-auto flex-grow pr-2 text-sm hide-scrollbar"> {/* Added hide-scrollbar */}
            {!features ? (
              <p className="text-yellow-400">Feature data not available for this song.</p>
            ) : (
              <ul className="list-none p-0 space-y-2">
                {Object.entries(features).map(([key, value]) => (
                  <li key={key} className="flex justify-between border-b border-gray-700 pb-1">
                    <span className="font-medium text-[var(--accent-primary)] mr-2">{key}:</span> 
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
                  className="px-4 py-2 bg-[var(--accent-primary)]/80 hover:bg-[var(--accent-primary)]/100 text-gray-100 text-sm font-semibold"
                  data-augmented-ui="tl-clip br-clip border"
                  style={{ '--aug-border-color': 'var(--accent-primary)' } as React.CSSProperties} // Use accent color
              >
                  Close
              </button>
          </div>
        </div>
      </BasePanel>
    </div>
  );
};

export default SongDetailsDialog; 