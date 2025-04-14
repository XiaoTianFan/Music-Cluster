import React from 'react';
import BasePanel from './ui/BasePanel';

interface FeatureExplanationDialogProps {
  isOpen: boolean;
  featureName: string;
  explanation: string;
  onClose: () => void;
}

const FeatureExplanationDialog: React.FC<FeatureExplanationDialogProps> = ({
  isOpen,
  featureName,
  explanation,
  onClose,
}) => {
  if (!isOpen) return null;

  // Prevent clicks inside the dialog from closing it
  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  // Define styles and props for BasePanel (copied from AboutDialog)
  const panelClassName = "text-gray-100 shadow-xl max-w-md w-full relative"; // Adjusted max-width
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
  } as React.CSSProperties;
  const panelDataAugmentedUi = "tl-clip-x tr-round br-clip bl-round border";

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose} // Close on overlay click
    >
      {/* Use BasePanel */}
      <BasePanel
        className={panelClassName}
        data-augmented-ui={panelDataAugmentedUi}
        style={panelStyle}
        onClick={handleDialogClick} // Prevent close on dialog click
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold p-1 leading-none" // Updated color
          aria-label="Close explanation"
        >
          &times;
        </button>

        {/* Content Wrapper with Padding */}
        <div className="p-6"> 
          {/* Title */}
          <h3
            className="text-xl font-semibold mb-4 text-[var(--accent-primary)]" // Updated color
          >
            {featureName || 'Feature Explanation'}
          </h3>

          {/* Explanation Text */}
          <p className="text-sm text-gray-300 leading-relaxed">
            {explanation || 'Loading explanation...'}
          </p>

          {/* Optional Close Button at Bottom */}
          <button
            onClick={onClose}
            className="mt-6 w-full p-2 text-center font-semibold text-sm bg-[var(--accent-primary)]/80 hover:bg-[var(--accent-primary)]/100 text-gray-100"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': 'var(--accent-primary)' } as React.CSSProperties} // Use accent color
          >
            Close
          </button>
        </div>
      </BasePanel>
    </div>
  );
};

export default FeatureExplanationDialog;
