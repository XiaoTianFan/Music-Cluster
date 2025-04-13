'use client'; // << This component handles client-side logic

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown'; // << Import react-markdown

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
      <div className="fixed top-0 left-0 w-full h-full -z-20 p-8 space-y-8 overflow-y-auto hide-scrollbar bg-gray-950/20">
          {/* Notification Box */}
          <div 
              className="flex flex-col h-[90vh] items-center justify-center text-center p-6 mb-6 text-cyan-300 bg-gray-900/80 border border-cyan-500"
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
              style={{ '--aug-border-color': 'cyan'} as React.CSSProperties}
          >
              <h1 className="text-xl font-bold mb-3">Desktop Recommended</h1>
              <p className="text-base">
              This application is designed for optimal viewing and interaction on a desktop display.
              </p>
              <p className="text-xs mt-3 text-gray-400">
              Mobile layout is not supported.
              </p>
          </div>

          {/* About Section Box */}
          <div className="p-6 mt-8 border border-gray-700 text-gray-300 bg-gray-950/20 max-w-3xl mx-auto text-sm" 
               data-augmented-ui="tl-round tr-round br-round bl-round inlay border" 
               style={{ '--aug-border-color': '#555'} as React.CSSProperties}
           >
             {isLoadingAbout ? (
                 <p>Loading About information...</p>
             ) : (
                /* Apply prose styling to a wrapper div */
                 <div className="prose prose-sm prose-invert max-w-none prose-headings:text-cyan-400 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-gray-100 prose-code:text-pink-400 prose-code:before:content-none prose-code:after:content-none prose-code:px-1 prose-code:py-0.5 prose-code:bg-gray-900/50 prose-code:rounded">
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