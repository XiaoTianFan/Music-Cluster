export interface AnnRouteSongRef {
  id: string;
}

export type AnnRouteNamedLists = Record<string, ReadonlySet<string>>;

export interface AnnRouteLabelState {
  labelMap: Map<string, number>;
  outputDimension: number;
  unassignedSongIds: string[];
  nonEmptyLabelCount: number;
  assignedSongCount: number;
  labelsHaveEnoughExamples: boolean;
  trueLabels: Record<string, string>;
}

export interface AnnRouteLabelStateInput {
  songs: readonly AnnRouteSongRef[];
  namedLists: AnnRouteNamedLists;
}

export function getAnnRouteLabelState({
  songs,
  namedLists,
}: AnnRouteLabelStateInput): AnnRouteLabelState {
  const labelMap = new Map<string, number>();
  const assignedIds = new Set<string>();
  const trueLabels: Record<string, string> = {};
  let assignedSongCount = 0;
  let labelsHaveEnoughExamples = true;

  for (const [label, songIds] of Object.entries(namedLists)) {
    if (songIds.size === 0) continue;

    if (songIds.size < 2) labelsHaveEnoughExamples = false;
    labelMap.set(label, labelMap.size);

    for (const songId of songIds) {
      assignedIds.add(songId);
      trueLabels[songId] = label;
      assignedSongCount += 1;
    }
  }

  const nonEmptyLabelCount = labelMap.size;
  if (nonEmptyLabelCount === 0) labelsHaveEnoughExamples = false;

  return {
    labelMap,
    outputDimension: nonEmptyLabelCount,
    unassignedSongIds: songs
      .filter(song => !assignedIds.has(song.id))
      .map(song => song.id),
    nonEmptyLabelCount,
    assignedSongCount,
    labelsHaveEnoughExamples,
    trueLabels,
  };
}
