import React from 'react';
import BasePanel from '@/components/ui/BasePanel'; 
import LabelListComponent from './LabelListComponent'; 
import Button from '@/components/ui/Button'; 
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Assuming Song type is defined elsewhere (e.g., ../app/ann/page.tsx or a types file)
import type { Song } from '../app/ann/page'; // Adjust path as needed

interface DraggableSongItemProps {
    song: Song;
    listName: string | null; // Can be null for unassigned
    onRemove?: (songId: string, listName: string) => void; // Optional for unassigned
}
function DraggableSongItem({ song, listName, onRemove }: DraggableSongItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: song.id,
        data: { type: 'song', fromList: listName },
    });
    const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' };
    return (
        <li ref={setNodeRef} style={style} {...listeners} {...attributes} className="flex justify-between items-center p-1 bg-[var(--background)]/50 rounded hover:bg-[var(--background)]/80 cursor-grab touch-none" title={song.name}>
            <span className="truncate flex-grow mr-2">{song.name}</span>
            {onRemove && listName && (
                <Button onClick={(e) => { e.stopPropagation(); onRemove(song.id, listName); }} className="text-red-500 hover:text-red-400 flex-shrink-0 px-1 py-0 h-auto cursor-pointer" title="Remove from list" >✕</Button>
            )}
        </li>
    );
}

interface LabelingPanelProps {
    className?: string;
    songs: Song[]; // Full list of available songs
    namedLists: Record<string, Set<string>>; // Current labeled lists { name: Set<songId> }
    // Callbacks to update state in parent (page.tsx)
    onCreateList: (listName: string) => void;
    onRenameList: (oldName: string, newName: string) => void;
    onRemoveSongFromList: (songId: string, listName: string) => void;
}

const UNASSIGNED_LIST_ID = '__unassigned__';

const LabelingPanel: React.FC<LabelingPanelProps> = ({
    className,
    songs,
    namedLists,
    onCreateList,
    onRenameList,
    onRemoveSongFromList
}) => {

    const [newListName, setNewListName] = React.useState('');

    const { isOver: isOverUnassigned, setNodeRef: setUnassignedNodeRef } = useDroppable({
        id: UNASSIGNED_LIST_ID,
        data: { type: 'list', listName: null },
    });

    const handleCreateClick = () => {
        const trimmedName = newListName.trim();
        if (trimmedName && !namedLists.hasOwnProperty(trimmedName)) {
            onCreateList(trimmedName);
            setNewListName('');
        } else if (trimmedName) {
            console.warn('List name already exists');
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewListName(event.target.value);
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleCreateClick();
        }
    };

    const assignedSongIds = React.useMemo(() => {
        const allIds = new Set<string>();
        Object.values(namedLists).forEach(set => {
            set.forEach(id => allIds.add(id));
        });
        return allIds;
    }, [namedLists]);

    const unassignedSongs = React.useMemo(() => {
        return songs.filter(song => !assignedSongIds.has(song.id));
    }, [songs, assignedSongIds]);

    const unassignedStyle: React.CSSProperties = {
        borderColor: isOverUnassigned ? 'var(--accent-primary)' : 'var(--foreground)/30',
        borderWidth: '1px',
        borderStyle: 'dashed',
    };

    return (
        <BasePanel className={`${className} flex flex-col`} title="Label Editor">
            <div className="flex items-center gap-2 p-2 border-b border-[var(--foreground)]/30 mb-2 flex-shrink-0">
                <input
                    type="text"
                    placeholder="New Label Name..."
                    value={newListName}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    className="flex-grow bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <Button
                    onClick={handleCreateClick}
                    disabled={!newListName.trim() || namedLists.hasOwnProperty(newListName.trim())}
                >
                    Create
                </Button>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-4">
                 <div
                    ref={setUnassignedNodeRef}
                    style={unassignedStyle}
                    className={`p-2 rounded transition-colors duration-150 ease-in-out ${isOverUnassigned ? 'bg-[var(--accent-primary)]/10' : ''}`}
                 >
                    <h3 className="text-[var(--text-secondary)] font-bold text-lg mb-2">Unassigned Songs</h3>
                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-1 text-sm">
                        {unassignedSongs.length === 0 && (
                             <p className="text-xs text-[var(--text-secondary)] italic text-center py-2">
                                 All songs assigned or no songs loaded.
                             </p>
                        )}
                        {unassignedSongs.map(song => (
                            <DraggableSongItem
                                key={song.id}
                                song={song}
                                listName={null}
                            />
                        ))}
                    </ul>
                 </div>

                 {Object.entries(namedLists).map(([listName, songIds]) => (
                     <LabelListComponent
                         key={listName}
                         id={`list-${listName}`}
                         listName={listName}
                         songIds={songIds}
                         allSongs={songs}
                         onRename={onRenameList}
                         onRemoveSongFromList={onRemoveSongFromList}
                     />
                 ))}
            </div>
        </BasePanel>
    );
};

export default LabelingPanel; 