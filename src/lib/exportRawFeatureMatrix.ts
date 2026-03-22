export type ExportFormat = 'csv' | 'json';

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function uniqueJsonKeys(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    if (count === 0) return label;
    return `${label} (${count})`;
  });
}

export function downloadRawFeatureMatrixExport(options: {
  songs: { id: string; name: string }[];
  songIds: string[];
  vectors: number[][];
  columnLabels: string[];
  selectedIndices: number[];
  format: ExportFormat;
  filenameBase?: string;
}): void {
  const {
    songs,
    songIds,
    vectors,
    columnLabels,
    selectedIndices,
    format,
    filenameBase = 'musiccluster-raw-features',
  } = options;

  const sorted = [...new Set(selectedIndices)]
    .filter((i) => i >= 0 && i < columnLabels.length && vectors[0] && i < vectors[0].length)
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return;
  }

  const songMap = new Map(songs.map((s) => [s.id, s.name]));
  const selectedLabels = sorted.map((i) => columnLabels[i]);

  let blob: Blob;
  let ext: string;

  if (format === 'csv') {
    const header = ['song_id', 'song_name', ...selectedLabels.map(escapeCsvCell)].join(',');
    const lines = [header];
    for (let r = 0; r < songIds.length; r++) {
      const id = songIds[r];
      const row = vectors[r];
      if (!row) continue;
      const name = songMap.get(id) ?? '';
      const cells = [
        escapeCsvCell(id),
        escapeCsvCell(name),
        ...sorted.map((colIdx) => {
          const v = row[colIdx];
          const s = v === undefined || Number.isNaN(v) ? '' : String(v);
          return escapeCsvCell(s);
        }),
      ];
      lines.push(cells.join(','));
    }
    blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    ext = 'csv';
  } else {
    const keys = uniqueJsonKeys(selectedLabels);
    const rows = songIds.map((songId, r) => {
      const row = vectors[r];
      const values: Record<string, number> = {};
      sorted.forEach((colIdx, j) => {
        const v = row?.[colIdx];
        if (v !== undefined && !Number.isNaN(v)) {
          values[keys[j]] = v;
        }
      });
      return {
        songId,
        songName: songMap.get(songId) ?? '',
        values,
      };
    });
    const payload = {
      columns: keys,
      rows,
    };
    blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    ext = 'json';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
