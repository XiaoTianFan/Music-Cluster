import React from 'react';
import { useDroppable } from '@dnd-kit/core';

import ANNLabelSongItem from './ANNLabelSongItem';
import BasePanel from './ui/BasePanel';
import Button from './ui/Button';
import LabelListComponent from './LabelListComponent';
import type { Song } from '../lib/annPipeline';

const UNASSIGNED_LIST_ID = '__unassigned__';
const LABEL_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17becf'];
const LABEL_COLUMN_BORDER = 'color-mix(in srgb, var(--foreground) 28%, transparent)';

const withAlpha = (hex: string, alpha: number) => {
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

interface LabelingPanelProps {
    className?: string;
    songs: Song[];
    namedLists: Record<string, Set<string>>;
    onCreateList: (listName: string) => void;
    onRenameList: (oldName: string, newName: string) => void;
    onRemoveSongFromList: (songId: string, listName: string) => void;
    onRemoveSongFromSession: (songId: string) => void;
    onShowDetails: (songId: string) => void;
    onPlayRequest: (songId: string) => void;
    currentlyPlayingSongId: string | null;
    isPlaying: boolean;
    onUploadSongs?: () => void;
    uploadDisabled?: boolean;
    interactionDisabled?: boolean;
}

const LabelingPanel: React.FC<LabelingPanelProps> = ({
    className = '',
    songs,
    namedLists,
    onCreateList,
    onRenameList,
    onRemoveSongFromList,
    onRemoveSongFromSession,
    onShowDetails,
    onPlayRequest,
    currentlyPlayingSongId,
    isPlaying,
    onUploadSongs,
    uploadDisabled = false,
    interactionDisabled = false,
}) => {
    const [newListName, setNewListName] = React.useState('');
    const labelRailRef = React.useRef<HTMLDivElement>(null);
    const { isOver: isOverUnassigned, setNodeRef: setUnassignedNodeRef } = useDroppable({
        id: UNASSIGNED_LIST_ID,
        data: { type: 'list', listName: null },
    });

    const assignedSongIds = React.useMemo(() => {
        const allIds = new Set<string>();
        Object.values(namedLists).forEach(ids => ids.forEach(id => allIds.add(id)));
        return allIds;
    }, [namedLists]);

    const unassignedSongs = React.useMemo(
        () => songs.filter(song => !assignedSongIds.has(song.id)),
        [songs, assignedSongIds]
    );

    const handleCreateClick = () => {
        const trimmedName = newListName.trim();
        if (!trimmedName || Object.hasOwn(namedLists, trimmedName)) return;
        onCreateList(trimmedName);
        setNewListName('');
    };

    const handleRailWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!event.shiftKey || !labelRailRef.current) return;
        event.preventDefault();
        labelRailRef.current.scrollLeft += event.deltaY || event.deltaX;
    };

    return (
        <BasePanel className={`${className} flex h-96 min-h-96 flex-col`} title="Data Labeling">
            <h2 className="ml-2 mb-2 flex-shrink-0 text-lg font-semibold text-[var(--accent-secondary)]">
                Data Labeling
            </h2>

            <div
                ref={labelRailRef}
                className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-2 pb-2 hide-scrollbar"
                onWheel={handleRailWheel}
                data-ann-label-rail="true"
            >
                <section
                    ref={setUnassignedNodeRef}
                    data-ann-drop-list={UNASSIGNED_LIST_ID}
                    style={{ borderColor: isOverUnassigned ? 'var(--accent-primary)' : LABEL_COLUMN_BORDER }}
                    className={`flex h-full min-h-0 w-80 min-w-80 flex-col rounded border border-dashed p-2 transition-colors duration-150 ${
                        isOverUnassigned ? 'bg-[var(--accent-primary)]/10' : ''
                    }`}
                >
                    <h3 className="mb-2 text-sm font-bold text-[var(--text-secondary)]">Unassigned Songs</h3>
                    <ul className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
                        {unassignedSongs.length === 0 && (
                            <li className="py-2 text-center text-xs italic text-[var(--text-secondary)]">
                                All songs assigned or no songs loaded.
                            </li>
                        )}
                        {unassignedSongs.map(song => (
                            <ANNLabelSongItem
                                key={song.id}
                                song={song}
                                listName={null}
                                onShowDetails={onShowDetails}
                                onPlayRequest={onPlayRequest}
                                onRemove={onRemoveSongFromSession}
                                isPlaying={currentlyPlayingSongId === song.id && isPlaying}
                                interactionDisabled={interactionDisabled}
                                removeTitle="Remove Song from Session"
                            />
                        ))}
                    </ul>
                </section>

                {Object.entries(namedLists).map(([listName, songIds], labelIndex) => (
                    <LabelListComponent
                        key={listName}
                        id={`list-${listName}`}
                        listName={listName}
                        songIds={songIds}
                        allSongs={songs}
                        onRename={onRenameList}
                        onRemoveSongFromList={onRemoveSongFromList}
                        onShowDetails={onShowDetails}
                        onPlayRequest={onPlayRequest}
                        currentlyPlayingSongId={currentlyPlayingSongId}
                        isPlaying={isPlaying}
                        interactionDisabled={interactionDisabled}
                        tintColor={withAlpha(LABEL_COLORS[labelIndex % LABEL_COLORS.length], 0.18)}
                    />
                ))}
            </div>

            <div className="mt-2 flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-[var(--foreground)]/30 px-2 pt-3">
                <input
                    type="text"
                    placeholder="New Label Name..."
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') handleCreateClick();
                    }}
                    className="min-w-48 flex-grow rounded border border-[var(--foreground)]/50 bg-transparent px-2 py-1 text-xs focus:border-[var(--accent-primary)] focus:outline-none"
                />
                <Button
                    onClick={handleCreateClick}
                    disabled={!newListName.trim() || Object.hasOwn(namedLists, newListName.trim())}
                    className="px-3 py-1 text-xs"
                >
                    Create
                </Button>
                {onUploadSongs && (
                    <Button
                        type="button"
                        onClick={onUploadSongs}
                        disabled={uploadDisabled}
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                    >
                        Upload Audio
                    </Button>
                )}
            </div>
        </BasePanel>
    );
};

export default LabelingPanel;
