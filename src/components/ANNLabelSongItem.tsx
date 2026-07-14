import React from 'react';
import { InformationCircleIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/solid';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Marquee from 'react-fast-marquee';

import type { Song } from '../lib/annPipeline';

interface ANNLabelSongItemProps {
    song: Song;
    listName: string | null;
    onShowDetails: (songId: string) => void;
    onPlayRequest: (songId: string) => void;
    onRemove: (songId: string) => void;
    isPlaying: boolean;
    interactionDisabled?: boolean;
    removeTitle: string;
    tintColor?: string;
}

const ANNLabelSongItem: React.FC<ANNLabelSongItemProps> = ({
    song,
    listName,
    onShowDetails,
    onPlayRequest,
    onRemove,
    isPlaying,
    interactionDisabled = false,
    removeTitle,
    tintColor = 'transparent',
}) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: song.id,
        data: { type: 'song', fromList: listName },
        disabled: interactionDisabled,
    });

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                opacity: isDragging ? 0.5 : 1,
                zIndex: isDragging ? 10 : 'auto',
                backgroundColor: isHovered ? 'rgba(31, 41, 55, 0.78)' : tintColor,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            data-ann-song-id={song.id}
            data-ann-list-name={listName ?? '__unassigned__'}
            className="group relative isolate flex min-h-8 items-center overflow-hidden border-b border-gray-700/50 text-xs transition-colors duration-150"
            title={song.name}
        >
            <div
                {...listeners}
                {...attributes}
                className="relative z-0 flex min-w-0 flex-1 cursor-grab items-center px-2 py-1.5 touch-none active:cursor-grabbing"
            >
                <div className="min-w-0 flex-1 overflow-hidden">
                    {isHovered ? (
                        <Marquee
                            play
                            gradient={false}
                            speed={30}
                            pauseOnHover={false}
                            className="overflow-visible"
                        >
                            {song.name}<>&nbsp;&nbsp;&nbsp;</>
                        </Marquee>
                    ) : (
                        <span className="block truncate">{song.name}</span>
                    )}
                </div>
            </div>

            <span
                className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 rounded bg-gray-800/90 px-1 py-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => onShowDetails(song.id)}
                    title="Show Features & Audio"
                    aria-label={`Show details for ${song.name}`}
                    className="border-0 bg-transparent p-0.5 text-blue-400 hover:bg-transparent hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={interactionDisabled}
                    data-ann-song-action="details"
                >
                    <InformationCircleIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => onPlayRequest(song.id)}
                    title={isPlaying ? 'Pause' : 'Play'}
                    aria-label={`${isPlaying ? 'Pause' : 'Play'} ${song.name}`}
                    className={`border-0 bg-transparent p-0.5 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
                        isPlaying ? 'text-green-400 hover:text-green-300' : 'text-cyan-400 hover:text-cyan-300'
                    }`}
                    disabled={interactionDisabled}
                    data-ann-song-action="play"
                >
                    {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                </button>
                <button
                    type="button"
                    onClick={() => onRemove(song.id)}
                    title={removeTitle}
                    aria-label={`${removeTitle}: ${song.name}`}
                    className="border-0 bg-transparent p-0.5 text-base leading-none text-red-500 hover:bg-transparent hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={interactionDisabled}
                    data-ann-song-action="remove"
                >
                    <span aria-hidden="true">&times;</span>
                </button>
            </span>
        </li>
    );
};

export default ANNLabelSongItem;
