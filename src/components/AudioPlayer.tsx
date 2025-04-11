import React, { useRef, useEffect, useMemo, useState, ChangeEvent } from 'react';
import { PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'; // Assuming heroicons is installed

// Define Song interface (or import if global)
interface Song {
  id: string;
  name: string;
  url: string;
  source: 'default' | 'user';
}

// Helper function to format time (seconds to MM:SS)
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
      return '00:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface AudioPlayerProps {
  song: Song | null; // Song object or null if nothing selected
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onSongEnd: () => void;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  song,
  isPlaying,
  onTogglePlayPause,
  onSongEnd,
  className 
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // --- NEW State Variables ---
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1); // Default volume 100%
  const [isMuted, setIsMuted] = useState<boolean>(false); // Track muted state as boolean
  // --------------------------

  // Effect to handle song changes
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      if (song) {
        console.log(`AudioPlayer: Loading new song: ${song.name}`);
        audioElement.src = song.url;
        audioElement.load(); // Load the new source
        // Reset time/duration for new song
        setCurrentTime(0);
        setDuration(0); 
        if (isPlaying) {
          audioElement.play().catch(e => console.error("AudioPlayer: Auto-play failed after src change:", e));
        }
      } else {
        console.log("AudioPlayer: Song is null, pausing.");
        audioElement.pause();
        audioElement.removeAttribute('src'); 
        audioElement.load(); 
        setCurrentTime(0);
        setDuration(0);
      }
    }
  }, [song]); 

  // Effect to handle play/pause state changes
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && song) { 
      if (isPlaying) {
        console.log(`AudioPlayer: Playing song: ${song.name}`);
        audioElement.play().catch(e => console.error("AudioPlayer: Play failed:", e));
      } else {
        console.log(`AudioPlayer: Pausing song: ${song.name}`);
        audioElement.pause();
      }
    }
  }, [isPlaying, song]); 

  // Effect for event listeners (timeupdate, loadedmetadata, volumechange, ended, error)
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      const handleTimeUpdate = () => setCurrentTime(audioElement.currentTime);
      const handleDurationChange = () => setDuration(audioElement.duration);
      const handleEnded = () => {
        console.log("AudioPlayer: Song ended.");
        onSongEnd();
      };
      const handleError = (e: Event) => {
        console.error("AudioPlayer: Error encountered:", e);
        onSongEnd(); 
      };
       const handleVolumeChange = () => {
           setVolume(audioElement.volume);
           setIsMuted(audioElement.muted); // Assign boolean directly
       }; 

      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('loadedmetadata', handleDurationChange); // Use loadedmetadata for duration
      audioElement.addEventListener('durationchange', handleDurationChange); // Also listen for durationchange
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('error', handleError);
      audioElement.addEventListener('volumechange', handleVolumeChange); // Listen for volume changes

      // Set initial volume
      audioElement.volume = volume;
      audioElement.muted = isMuted; // Assign boolean directly

      // Cleanup
      return () => {
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
        audioElement.removeEventListener('loadedmetadata', handleDurationChange);
        audioElement.removeEventListener('durationchange', handleDurationChange);
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('error', handleError);
        audioElement.removeEventListener('volumechange', handleVolumeChange);
      };
    }
  }, [onSongEnd]); // Rerun only if onSongEnd changes

  // --- NEW Handler Functions ---
  const handleTimeSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(event.target.value);
    if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime); // Update state immediately for responsiveness
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(event.target.value);
    if (audioRef.current) {
        audioRef.current.volume = newVolume;
        // State updates via the 'volumechange' event listener
        // setVolume(newVolume); 
        // setIsMuted(newVolume === 0); // Auto-mute at 0, unmute otherwise?
        // audioRef.current.muted = newVolume === 0;
    }
  };

  const handleMuteToggle = () => {
      if (audioRef.current) {
          audioRef.current.muted = !audioRef.current.muted;
          // State updates via the 'volumechange' event listener
      }
  };
  // ---------------------------

  const buttonTitle = useMemo(() => {
    if (!song) return "Play (no song selected)";
    return isPlaying ? "Pause" : "Play";
  }, [isPlaying, song]);

  return (
    <div className={`flex flex-col items-center gap-1 text-cyan-300 ${className || ''}`}>
      {/* The actual audio element, hidden from view */}
      <audio ref={audioRef} />
      
      {/* Top Row: Controls + Song Name */}
      <div className="flex items-center justify-center gap-2 w-full">
          {/* Play/Pause Button */}
          <button 
            onClick={onTogglePlayPause}
            disabled={!song} 
            title={buttonTitle}
            className={`p-1 rounded-full transition-colors duration-150 flex-shrink-0 
                      ${!song 
                          ? 'text-gray-600 cursor-not-allowed' 
                          : 'text-cyan-400 hover:bg-cyan-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50'}
                      `}
          >
            {isPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5" />
            )}
          </button>
          
          {/* Display Song Name (Truncated) */}
          <span className="text-xs truncate flex-grow text-center min-w-0">
            {song ? song.name : 'No song selected'}
          </span>

          {/* Volume Control Area */}
          <div className="flex items-center gap-1 flex-shrink-0">
             <button 
                onClick={handleMuteToggle}
                title={isMuted ? "Unmute" : "Mute"}
                className="text-cyan-400 hover:text-cyan-200 p-0.5"
             >
                {isMuted || volume === 0 ? (
                   <SpeakerXMarkIcon className="h-4 w-4" />
                 ) : (
                   <SpeakerWaveIcon className="h-4 w-4" />
                 )}
             </button>
             <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume} // Show 0 if muted
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-cyan-500 cursor-pointer " // Basic styling 
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
      </div>

      {/* Bottom Row: Progress Bar + Timestamps */}
      <div className="flex items-center gap-2 w-full px-2">
        <span className="text-xs font-mono flex-shrink-0">{formatTime(currentTime)}</span>
        <input 
          type="range" 
          min="0" 
          max={duration || 0} // Use duration, default to 0 if not loaded
          value={currentTime}
          onChange={handleTimeSeek}
          disabled={!song || duration === 0} // Disable if no song or duration unknown
          className="w-full h-1 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" // Basic styling
          title={`Seek (${formatTime(currentTime)} / ${formatTime(duration)})`}
        />
        <span className="text-xs font-mono flex-shrink-0">{formatTime(duration)}</span>
      </div>
      
    </div>
  );
};

export default AudioPlayer;
