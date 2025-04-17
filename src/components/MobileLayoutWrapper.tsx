'use client'; // << This component handles client-side logic

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown'; // << Import react-markdown
import 'github-markdown-css/github-markdown-dark.css'; // << Add this import

// Define the mobile breakpoint
const MOBILE_BREAKPOINT = 768;

interface MobileLayoutWrapperProps {
  children: React.ReactNode;
}

const MobileLayoutWrapper: React.FC<MobileLayoutWrapperProps> = ({ children }) => {
  // State to track viewport status: loading, mobile, or desktop
  const [viewportStatus, setViewportStatus] = useState<'loading' | 'mobile' | 'desktop'>('loading');
  const [aboutContent, setAboutContent] = useState<string>(''); // << State for markdown content
  const [isLoadingAbout, setIsLoadingAbout] = useState<boolean>(true);

  // Effect to fetch ABOUT.md content
  useEffect(() => {
    setIsLoadingAbout(true);
    fetch('/ABOUT.md') // Fetch from the public directory
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch ABOUT.md');
        }
        return response.text();
      })
      .then(text => {
        setAboutContent(text);
      })
      .catch(error => {
        console.error("Error fetching ABOUT.md:", error);
        setAboutContent('# Error\n\nCould not load About information.'); // Set error message in markdown
      })
      .finally(() => {
        setIsLoadingAbout(false);
      });
  }, []); // Run once on mount

  useEffect(() => {
    const checkViewport = () => {
      // Calculate aspect ratio
      const aspectRatio = window.innerWidth / window.innerHeight;
      
      // Check width OR aspect ratio for mobile
      if (window.innerWidth < MOBILE_BREAKPOINT || aspectRatio < 1.1) { 
        setViewportStatus('mobile');
      } else {
        setViewportStatus('desktop');
      }
    };

    // Initial check
    checkViewport();

    // Add listener for resize events
    window.addEventListener('resize', checkViewport);

    // Cleanup listener on component unmount
    return () => window.removeEventListener('resize', checkViewport);
  }, []); // Empty dependency array ensures this runs only once on mount

  // Render based on status
  if (viewportStatus === 'loading') {
    // Render minimal loading state or null during initial client check
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  if (viewportStatus === 'mobile') {
    // Render Notification and About Content for Mobile
    return (
      // Outer container for scrolling if content overflows
      <div 
        className="fixed top-0 left-0 w-full h-full -z-20 p-8 space-y-8 overflow-y-auto hide-scrollbar bg-gray-950/20"
        style={{ 
            // Apply the scanline gradient layered over the background color
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(40, 40, 50, 0.5) 0px, rgba(40, 40, 50, 0.5) 2px, transparent 2px, transparent 5px)'
        }}
      >
          {/* Notification Box - Apply BasePanel style */}
          <div 
              className="flex flex-col h-[90vh] items-center justify-center text-center p-6 mb-6 text-[var(--accent-primary)] bg-gray-900/30"
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" // Match BasePanel shape
              style={{ 
                '--aug-border-bg': 'var(--accent-primary)', // Use correct var and theme color
                '--aug-border-all': '1px' // Explicit border width
              } as React.CSSProperties}
          >
              {/* Original Content */}
              <div className="relative z-0"> {/* Content wrapper, relative z-index no longer strictly needed */}
                  <h1 className="text-xl font-bold mb-3">Desktop Recommended</h1>
                  <p className="text-base">
                  This application is designed for optimal viewing and interaction on a desktop display.
                  </p>
                  <p className="text-xs mt-3 text-gray-400">
                  Mobile layout is not supported.
                  </p>
              </div>
          </div>

          {/* About Section Box - Apply BasePanel style */}
          <div className="about-dialog-markdown-wrapper p-6 mt-8 text-gray-300 bg-gray-950/20 max-w-3xl mx-auto text-sm"
               data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" // Match BasePanel shape 
               style={{ 
                 '--aug-border-bg': 'var(--text-secondary)', // Use correct var and theme color
                 '--aug-border-all': '1px' // Explicit border width
                } as React.CSSProperties}
           >
             {isLoadingAbout ? (
                 <p>Loading About information...</p>
             ) : (
                /* Apply markdown-body styling */
                 <div className="markdown-body max-w-none">
                     <ReactMarkdown>
                         {aboutContent}
                     </ReactMarkdown>
                 </div>
             )}
          </div>
      </div>
    );
  }

  // If desktop, render the actual application content
  return <>{children}</>; 
};

export default MobileLayoutWrapper; 