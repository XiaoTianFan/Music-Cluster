'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

  return (
    // Basic Dialog Styling (Adapt to your project's UI library/styling)
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose} // Close on overlay click
    >
      <div
        className="bg-gray-900 text-gray-100 p-6 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto relative border border-pink-500"
        data-augmented-ui="tl-clip-x tr-round br-clip bl-round border"
        style={{ '--aug-border-color': 'hotpink' } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the dialog
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-pink-400 text-2xl font-bold"
          aria-label="Close dialog"
        >
          &times; {/* Unicode multiplication sign for 'X' */}
        </button>
        <h2 className="text-2xl font-bold mb-4 text-pink-400">About SongCluster</h2>
        <div className="prose prose-invert max-w-none prose-pink"> {/* Basic markdown styling */}
          {isLoading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

export default AboutDialog; 