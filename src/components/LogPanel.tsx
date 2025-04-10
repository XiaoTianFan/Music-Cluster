// songcluster/src/components/LogPanel.tsx
import React, { useRef, useEffect } from 'react';

// Re-import LogLevel and LogMessage if they are defined elsewhere and exported,
// or define them here if they are specific to this component usage.
// Assuming they are defined in page.tsx for now and might need to be moved to types file.
type LogLevel = 'info' | 'warn' | 'error' | 'complete';
interface LogMessage {
  text: string;
  level: LogLevel;
  timestamp: string;
}

interface LogPanelProps {
  logs: LogMessage[]; // Expect LogMessage objects
  className?: string;
}

// Define color mapping
const levelColors: Record<LogLevel, string> = {
  info: 'text-gray-300', // Common foreground
  warn: 'text-yellow-400', // Current yellow-ish
  error: 'text-red-500', // Red
  complete: 'text-green-400', // Green
};

const LogPanel: React.FC<LogPanelProps> = ({ logs, className }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom when new logs arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className={`flex flex-col p-4 border border-yellow-500 text-yellow-400 ${className}`}
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      style={{ '--aug-border-color': 'goldenrod', '--aug-border-bg': '#FEFEFE' } as React.CSSProperties}
    >
      <h2 className="text-lg font-semibold mb-2 text-yellow-300">Program Logs</h2>
      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto bg-grey/90 p-2 text-xs font-mono"
        style={{ maxHeight: '500px' }} // Adjust max height as needed
      >
        {logs.length === 0 ? (
          <p className="text-gray-500 italic">No logs yet...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`whitespace-pre-wrap break-words ${levelColors[log.level]}`}>
              {`[${log.timestamp}] ${log.text}`}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogPanel; 