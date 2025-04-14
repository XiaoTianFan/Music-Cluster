'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BasePanel from './ui/BasePanel';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !markdownContent && !isLoading) {
      setIsLoading(true);
      setError(null);
      fetch('/ABOUT.md') // Path relative to the public folder
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          setMarkdownContent(text);
          setIsLoading(false);
        })
        .catch((e) => {
          console.error('Error fetching ABOUT.md:', e);
          setError('Failed to load content. Please try again later.');
          setIsLoading(false);
        });
    }
  }, [isOpen, markdownContent, isLoading]); // Re-fetch if opened and content not loaded

  if (!isOpen) {
    return null;
  }

  // Define styles and props for BasePanel
  const panelClassName = "text-gray-100 max-w-3xl w-full relative"; // Removed padding, border, data-aug
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
  } as React.CSSProperties;
  const panelDataAugmentedUi = "tl-clip-x tr-round br-clip bl-round border";

  return (
    // Basic Dialog Styling
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose} // Close on overlay click
    >
      {/* Use BasePanel for the main dialog container */}
      <BasePanel
        className={panelClassName}
        data-augmented-ui={panelDataAugmentedUi}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the dialog
      >
        {/* Close button positioned relative to the BasePanel */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold z-10 p-1 leading-none" // Ensure button is above content, add padding + leading for better click area
          aria-label="Close dialog"
        >
          &times; {/* Unicode multiplication sign for 'X' */}
        </button>
        
        {/* Inner container for scrolling content - Adjust padding here */}
        <div className="max-h-[calc(80vh-48px)] overflow-y-auto p-6 pr-2 hide-scrollbar"> {/* Added p-6 here */}
          <h2 className="text-2xl font-bold mb-4 text-[var(--accent-primary)]">About MusicCluster</h2>
          <div className="prose prose-invert max-w-none"> {/* Removed prose-pink */}
            {isLoading && <p>Loading...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!isLoading && !error && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdownContent}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </BasePanel>
    </div>
  );
};

export default AboutDialog; 