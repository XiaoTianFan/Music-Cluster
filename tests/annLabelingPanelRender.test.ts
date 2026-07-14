import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DndContext } from '@dnd-kit/core';
import LabelingPanel from '../src/components/LabelingPanel';

const songs = [
  { id: 'song-a', name: 'Song A', url: '/audio/a.mp3', source: 'default' as const },
  { id: 'song-b', name: 'Song B', url: '/audio/b.mp3', source: 'default' as const },
  { id: 'song-c', name: 'Song C', url: '/audio/c.mp3', source: 'default' as const },
];

type LabelingPanelProps = React.ComponentProps<typeof LabelingPanel>;

function renderLabelingPanel(
  namedLists: Record<string, Set<string>>,
  overrides: Partial<LabelingPanelProps> = {}
) {
  return renderToStaticMarkup(
    React.createElement(
      DndContext,
      null,
      React.createElement(LabelingPanel, {
        songs,
        namedLists,
        onCreateList: () => {},
        onRenameList: () => {},
        onRemoveSongFromList: () => {},
        onRemoveSongFromSession: () => {},
        onShowDetails: () => {},
        onPlayRequest: () => {},
        currentlyPlayingSongId: null,
        isPlaying: false,
        onUploadSongs: () => {},
        ...overrides,
      })
    )
  );
}

test('LabelingPanel renders label creation controls with disabled empty create action', () => {
  const html = renderLabelingPanel({});

  assert.match(html, /Data Labeling/);
  assert.match(html, /placeholder="New Label Name\.\.\."/);
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, /Create/);
  assert.match(html, /Upload Audio/);
  assert.ok(html.indexOf('Data Labeling') < html.indexOf('data-ann-label-rail="true"'));
  assert.ok(html.indexOf('data-ann-label-rail="true"') < html.indexOf('placeholder="New Label Name..."'));
});

test('LabelingPanel renders existing labels and keeps unassigned songs visible', () => {
  const html = renderLabelingPanel({
    Rock: new Set(['song-a']),
    Jazz: new Set<string>(),
  });

  assert.match(html, /Rock/);
  assert.match(html, /Jazz/);
  assert.match(html, /Song A/);
  assert.match(html, /Song B/);
  assert.match(html, /Song C/);
  assert.match(html, /Unassigned Songs/);
  assert.match(html, /data-ann-label-rail="true"/);
});

test('LabelingPanel renders shared song actions with context-aware removal labels', () => {
  const html = renderLabelingPanel(
    {
      Rock: new Set(['uploaded-b']),
    },
    {
      songs: [
        { id: 'default-a', name: 'Default Song', url: '/audio/default.mp3', source: 'default' },
        { id: 'uploaded-a', name: 'Uploaded Free.wav', url: 'blob:free', source: 'user' },
        { id: 'uploaded-b', name: 'Uploaded Labeled.wav', url: 'blob:labeled', source: 'user' },
      ],
    }
  );

  const detailControls = html.match(/data-ann-song-action="details"/g) ?? [];
  const playControls = html.match(/data-ann-song-action="play"/g) ?? [];
  const removeControls = html.match(/data-ann-song-action="remove"/g) ?? [];
  const sessionRemovalControls = html.match(/title="Remove Song from Session"/g) ?? [];
  const unassignControls = html.match(/title="Move to Unassigned Songs"/g) ?? [];

  assert.equal(detailControls.length, 3);
  assert.equal(playControls.length, 3);
  assert.equal(removeControls.length, 3);
  assert.equal(sessionRemovalControls.length, 2);
  assert.equal(unassignControls.length, 1);
  assert.match(html, /Uploaded Free\.wav/);
  assert.match(html, /Uploaded Labeled\.wav/);
});
