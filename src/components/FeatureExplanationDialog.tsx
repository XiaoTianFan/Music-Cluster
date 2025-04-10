import React from 'react';

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

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose} // Close on overlay click
    >
      {/* Dialog Box */}
      <div
        className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-indigo-500 relative"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        style={{ '--aug-border-color': 'indigo' } as React.CSSProperties}
        onClick={handleDialogClick} // Prevent close on dialog click
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl font-bold"
          aria-label="Close explanation"
        >
          &times;
        </button>

        {/* Title */}
        <h3
          className="text-xl font-semibold mb-4 text-indigo-300"
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
          className="mt-6 w-full p-2 text-center rounded font-semibold text-sm bg-indigo-700 hover:bg-indigo-600 text-indigo-100"
          data-augmented-ui="tl-clip br-clip border"
          style={{ '--aug-border-color': 'indigo' } as React.CSSProperties}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default FeatureExplanationDialog;
