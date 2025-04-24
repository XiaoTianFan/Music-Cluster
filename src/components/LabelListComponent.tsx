// src/components/LabelListComponent.tsx
import React from 'react';
import Button from '@/components/ui/Button'; // Corrected import casing and assuming default export
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Assuming Song type is defined elsewhere (e.g., ../app/ann/page.tsx or a types file)
import type { Song } from '../app/ann/page'; // Adjust path as needed

interface LabelListComponentProps {
    listName: string;
    songIds: Set<string>;
    allSongs: Song[]; // Map or full list to find song details
    onRename: (oldName: string, newName: string) => void;
    onRemoveSongFromList: (songId: string, listName: string) => void;
    className?: string;
    id: string;
}

interface DraggableSongItemProps {
    song: Song;
    listName: string; // Needed for remove callback
    onRemove: (songId: string, listName: string) => void;
}

function DraggableSongItem({ song, listName, onRemove }: DraggableSongItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: song.id, // Use song ID as the draggable ID
        data: { type: 'song', fromList: listName }, // Pass data about the dragged item
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 'auto', // Ensure dragging item is above others
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex justify-between items-center p-1 bg-[var(--background)]/50 rounded hover:bg-[var(--background)]/80 cursor-grab touch-none" // Added touch-none for compatibility
            title={song.name}
        >
            <span className="truncate flex-grow mr-2">{song.name}</span>
            <Button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent drag start when clicking remove
                    onRemove(song.id, listName);
                }}
                className="text-red-500 hover:text-red-400 flex-shrink-0 px-1 py-0 h-auto cursor-pointer" // Added cursor-pointer
                title="Remove from list"
            >
                ✕
            </Button>
        </li>
    );
}

const LabelListComponent: React.FC<LabelListComponentProps> = ({
    listName,
    songIds,
    allSongs,
    onRename,
    onRemoveSongFromList,
    className,
    id
}) => {

    const { isOver, setNodeRef } = useDroppable({
        id: id,
        data: { type: 'list', listName: listName },
    });

    const [isEditing, setIsEditing] = React.useState(false);
    const [currentName, setCurrentName] = React.useState(listName);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const songsInList = React.useMemo(() => {
        return allSongs.filter(song => songIds.has(song.id));
    }, [allSongs, songIds]);

    const handleNameClick = () => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentName(event.target.value);
    };

    const handleNameBlur = () => {
        const trimmedName = currentName.trim();
        if (trimmedName && trimmedName !== listName) {
            onRename(listName, trimmedName);
        } else {
             setCurrentName(listName); // Revert if empty or unchanged
        }
        setIsEditing(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleNameBlur();
        } else if (event.key === 'Escape') {
            setCurrentName(listName);
            setIsEditing(false);
        }
    };

    React.useEffect(() => {
        setCurrentName(listName);
    }, [listName]);

    const dropZoneStyle: React.CSSProperties = {
        borderColor: isOver ? 'var(--accent-primary)' : 'var(--foreground)/50',
        borderWidth: '1px',
    };

    return (
        <div
            ref={setNodeRef}
            style={dropZoneStyle}
            className={`p-2 border rounded ${className} transition-colors duration-150 ease-in-out ${isOver ? 'bg-[var(--accent-primary)]/10' : ''}`}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={currentName}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-b border-[var(--accent-primary)] text-[var(--text-primary)] font-bold text-lg w-full focus:outline-none mb-2"
                />
            ) : (
                <h3
                    onClick={handleNameClick}
                    className="text-[var(--accent-primary)] font-bold text-lg cursor-pointer hover:text-cyan-400 truncate mb-2"
                    title={`Click to rename ${listName}`}
                 >
                    {currentName} <span className="text-xs font-normal text-[var(--text-secondary)]">({songIds.size})</span>
                </h3>
            )}

            <ul className="space-y-1 max-h-48 overflow-y-auto pr-1 text-sm">
                {songsInList.length === 0 && (
                    <p className="text-xs text-[var(--text-secondary)] italic text-center py-2">
                        Drag songs here
                    </p>
                )}
                {songsInList.map(song => (
                    <DraggableSongItem
                        key={song.id}
                        song={song}
                        listName={listName}
                        onRemove={onRemoveSongFromList}
                    />
                ))}
            </ul>
        </div>
    );
};

export default LabelListComponent; 