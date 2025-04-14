import React from 'react';
import BasePanel from './ui/BasePanel';

interface ExplanationDialogProps {
  isOpen: boolean;
  title: string;
  explanation: string;
  onClose: () => void;
}

const ExplanationDialog: React.FC<ExplanationDialogProps> = ({ 
    isOpen, 
    title, 
    explanation, 
    onClose 
}) => {
  if (!isOpen) return null;

  // Prevent clicks inside the dialog from closing it
  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Define styles and props for BasePanel (copied from AboutDialog)
  const panelClassName = "text-gray-100 shadow-xl max-w-xl w-full relative"; // Adjusted max-width
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
  } as React.CSSProperties;
  const panelDataAugmentedUi = "tl-clip-x tr-round br-clip bl-round border";


  return (
    // Overlay
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose} // Close when clicking the overlay
    >
      {/* Use BasePanel */}
      <BasePanel 
        className={panelClassName}
        data-augmented-ui={panelDataAugmentedUi}
        style={panelStyle}
        onClick={handleDialogClick} // Prevent overlay click from propagating
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold leading-none p-1" // Updated color
          aria-label="Close Explanation"
        >
          &times;
        </button>

        {/* Content Wrapper with Padding */}
        <div className="p-6">
          {/* Title */}
          <h2 
            className="text-xl font-bold mb-4 text-[var(--accent-primary)]" // Updated color
            // data-augmented-ui="tl-clip br-clip inlay" // Remove inlay effect for consistency? or style with accent?
            // style={{ '--aug-inlay-bg': 'var(--accent-primary-darker)', '--aug-inlay-opacity': '0.8' } as React.CSSProperties} // Example: Use accent color
          >
            {title}
          </h2>

          {/* Explanation Content */}
          <div className="text-sm text-gray-300 whitespace-pre-wrap overflow-y-auto max-h-60 pr-2">
            {explanation}
          </div>
        </div>
      </BasePanel>
    </div>
  );
};

export default ExplanationDialog; 