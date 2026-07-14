import React from 'react';
import { useDroppable } from '@dnd-kit/core';

import ANNLabelSongItem from './ANNLabelSongItem';
import type { Song } from '../lib/annPipeline';

const LABEL_COLUMN_BORDER = 'color-mix(in srgb, var(--foreground) 28%, transparent)';

interface LabelListComponentProps {
    listName: string;
    songIds: Set<string>;
    allSongs: Song[];
    onRename: (oldName: string, newName: string) => void;
    onRemoveSongFromList: (songId: string, listName: string) => void;
    onShowDetails: (songId: string) => void;
    onPlayRequest: (songId: string) => void;
    currentlyPlayingSongId: string | null;
    isPlaying: boolean;
    interactionDisabled?: boolean;
    tintColor?: string;
    className?: string;
    id: string;
}

const LabelListComponent: React.FC<LabelListComponentProps> = ({
    listName,
    songIds,
    allSongs,
    onRename,
    onRemoveSongFromList,
    onShowDetails,
    onPlayRequest,
    currentlyPlayingSongId,
    isPlaying,
    interactionDisabled = false,
    tintColor,
    className = '',
    id,
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id,
        data: { type: 'list', listName },
    });

    const [isEditing, setIsEditing] = React.useState(false);
    const [currentName, setCurrentName] = React.useState(listName);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const songsInList = React.useMemo(
        () => allSongs.filter(song => songIds.has(song.id)),
        [allSongs, songIds]
    );

    const handleNameClick = () => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const finishEditing = () => {
        const trimmedName = currentName.trim();
        if (trimmedName && trimmedName !== listName) {
            onRename(listName, trimmedName);
        } else {
            setCurrentName(listName);
        }
        setIsEditing(false);
    };

    React.useEffect(() => {
        setCurrentName(listName);
    }, [listName]);

    return (
        <section
            ref={setNodeRef}
            data-ann-drop-list={listName}
            style={{ borderColor: isOver ? 'var(--accent-primary)' : LABEL_COLUMN_BORDER }}
            className={`flex h-full min-h-0 w-80 min-w-80 flex-col rounded border p-2 transition-colors duration-150 ${
                isOver ? 'bg-[var(--accent-primary)]/10' : ''
            } ${className}`}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={currentName}
                    onChange={(event) => setCurrentName(event.target.value)}
                    onBlur={finishEditing}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') finishEditing();
                        if (event.key === 'Escape') {
                            setCurrentName(listName);
                            setIsEditing(false);
                        }
                    }}
                    className="mb-2 w-full border-b border-[var(--accent-primary)] bg-transparent text-sm font-bold text-[var(--text-primary)] focus:outline-none"
                />
            ) : (
                <h3
                    onClick={handleNameClick}
                    className="mb-2 cursor-pointer truncate text-sm font-bold text-[var(--accent-primary)] hover:text-cyan-400"
                    title={`Click to rename ${listName}`}
                >
                    {currentName}{' '}
                    <span className="text-xs font-normal text-[var(--text-secondary)]">({songIds.size})</span>
                </h3>
            )}

            <ul className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
                {songsInList.length === 0 && (
                    <li className="py-2 text-center text-xs italic text-[var(--text-secondary)]">
                        Drag songs here
                    </li>
                )}
                {songsInList.map(song => (
                    <ANNLabelSongItem
                        key={song.id}
                        song={song}
                        listName={listName}
                        onShowDetails={onShowDetails}
                        onPlayRequest={onPlayRequest}
                        onRemove={(songId) => onRemoveSongFromList(songId, listName)}
                        isPlaying={currentlyPlayingSongId === song.id && isPlaying}
                        interactionDisabled={interactionDisabled}
                        removeTitle="Move to Unassigned Songs"
                        tintColor={tintColor}
                    />
                ))}
            </ul>
        </section>
    );
};

export default LabelListComponent;
