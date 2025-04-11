import React from 'react';

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

  return (
    // Overlay
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose} // Close when clicking the overlay
    >
      {/* Dialog Box */}
      <div 
        className="relative bg-gray-800 p-6 rounded-lg shadow-xl max-w-xl w-full text-gray-200 border border-blue-500"
        data-augmented-ui="tl-clip tr-round br-clip bl-round border"
        style={{ '--aug-border-color': 'rgb(59 130 246)', '--aug-border-bg': '#1f293780' } as React.CSSProperties}
        onClick={handleDialogClick} // Prevent overlay click from propagating
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-100 text-2xl font-bold leading-none" // Adjusted styling
          aria-label="Close Explanation"
        >
          &times;
        </button>

        {/* Title */}
        <h2 
          className="text-xl font-bold mb-4 text-blue-400"
          data-augmented-ui="tl-clip br-clip inlay"
          style={{ '--aug-inlay-bg': 'rgba(59, 130, 246, 0.1)', '--aug-inlay-opacity': '0.8' } as React.CSSProperties}
        >
          {title}
        </h2>

        {/* Explanation Content */}
        <div className="text-sm text-gray-300 whitespace-pre-wrap overflow-y-auto max-h-60 pr-2">
          {explanation}
        </div>
      </div>
    </div>
  );
};

export default ExplanationDialog; 