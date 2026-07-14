import type { AnnPermutationImportanceRow, AnnPermutationImportanceSummary } from './annPermutationImportance';

export interface AnnPermutationImportanceGroup {
  groupLabel: string;
  rowCount: number;
  inputCountLabel: string;
  topDimensionLabel: string;
  accuracyDrop: number;
  accuracyDropLabel: string;
  confidenceDrop: number | null;
  confidenceDropLabel: string;
  lowConfidenceDelta: number;
  summaryLabel: string;
}

export interface AnnPermutationImportanceView {
  rows: readonly AnnPermutationImportanceRow[];
  groups: readonly AnnPermutationImportanceGroup[];
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  hasHiddenRows: boolean;
  statusLabel: string;
  toggleLabel: string | null;
}

function normalizeLimit(limit: number | undefined): number {
  return Number.isFinite(limit) && limit !== undefined && limit > 0
    ? Math.floor(limit)
    : 5;
}

function stripArrayIndex(label: string): string {
  return label.replace(/\[\d+\]$/, '');
}

function stripStatisticSuffix(label: string): string {
  for (const suffix of ['StdDevs', 'StdDev', 'Means', 'Mean']) {
    if (label.endsWith(suffix) && label.length > suffix.length) {
      return label.slice(0, -suffix.length);
    }
  }
  return label;
}

function humanizeCamelCase(label: string): string {
  const words = label
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!words) return label;
  return words
    .split(/\s+/)
    .map(word => {
      const lower = word.toLowerCase();
      if (lower === 'mfcc' || lower === 'rms' || lower === 'bpm') return word.toUpperCase();
      if (lower === 'zcr') return 'ZCR';
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function getFeatureGroupLabel(row: AnnPermutationImportanceRow, summary: AnnPermutationImportanceSummary): string {
  const label = row.dimensionLabel.trim() || `Input ${row.dimensionIndex + 1}`;

  if (summary.inputKind === 'reduced') {
    const reducedMatch = label.match(/^([A-Za-z]+)\s+\d+$/);
    return reducedMatch ? `${reducedMatch[1].toUpperCase()} components` : 'Reduced components';
  }

  if (/^(Key|Scale):\s+/i.test(label) || label === 'keyStrength') {
    return 'Key & Scale';
  }

  const baseLabel = stripStatisticSuffix(stripArrayIndex(label));
  const knownLabels: Record<string, string> = {
    mfcc: 'MFCC',
    energy: 'Energy',
    entropy: 'ZCR Entropy',
    dynamicComplexity: 'Dynamic Complexity',
    loudness: 'Loudness',
    rms: 'RMS',
    tuningFrequency: 'Tuning Frequency',
    bpm: 'BPM',
    bpmSlow: 'BPM Slow',
    rhythmConfidence: 'Rhythm Confidence',
    onsetRate: 'Onset Rate',
    danceability: 'Danceability',
    intensity: 'Intensity',
    spectralCentroidTime: 'Spectral Centroid',
    spectralComplexity: 'Spectral Complexity',
    spectralContrast: 'Spectral Contrast',
    inharmonicity: 'Inharmonicity',
    dissonance: 'Dissonance',
    melBands: 'Mel Bands',
    pitchSalience: 'Pitch Salience',
    spectralFlux: 'Spectral Flux',
    key: 'Key & Scale',
    keyScale: 'Key & Scale',
  };
  return knownLabels[baseLabel] ?? humanizeCamelCase(baseLabel);
}

function compareImpactRows(left: AnnPermutationImportanceRow, right: AnnPermutationImportanceRow): number {
  return (
    right.accuracyDrop - left.accuracyDrop
    || (right.confidenceDrop ?? Number.NEGATIVE_INFINITY) - (left.confidenceDrop ?? Number.NEGATIVE_INFINITY)
    || left.dimensionIndex - right.dimensionIndex
  );
}

function createPermutationImportanceGroups(
  summary: AnnPermutationImportanceSummary,
  groupLimit: number
): AnnPermutationImportanceGroup[] {
  const rowsByGroup = new Map<string, AnnPermutationImportanceRow[]>();
  for (const row of summary.rows) {
    const groupLabel = getFeatureGroupLabel(row, summary);
    const rows = rowsByGroup.get(groupLabel) ?? [];
    rows.push(row);
    rowsByGroup.set(groupLabel, rows);
  }

  return Array.from(rowsByGroup.entries())
    .map(([groupLabel, groupRows]) => {
      const [topRow] = [...groupRows].sort(compareImpactRows);
      const inputCountLabel = `${groupRows.length} ${groupRows.length === 1 ? 'input' : 'related inputs'}`;
      return {
        groupLabel,
        rowCount: groupRows.length,
        inputCountLabel,
        topDimensionLabel: topRow.dimensionLabel,
        accuracyDrop: topRow.accuracyDrop,
        accuracyDropLabel: topRow.accuracyDropLabel,
        confidenceDrop: topRow.confidenceDrop,
        confidenceDropLabel: topRow.confidenceDropLabel,
        lowConfidenceDelta: groupRows.reduce((sum, row) => sum + row.lowConfidenceDelta, 0),
        summaryLabel: `${groupLabel}: ${inputCountLabel}; top input ${topRow.dimensionLabel}; ${topRow.accuracyDropLabel}.`,
      };
    })
    .sort((left, right) => (
      right.accuracyDrop - left.accuracyDrop
      || (right.confidenceDrop ?? Number.NEGATIVE_INFINITY) - (left.confidenceDrop ?? Number.NEGATIVE_INFINITY)
      || right.rowCount - left.rowCount
      || left.groupLabel.localeCompare(right.groupLabel)
    ))
    .slice(0, groupLimit);
}

export function getAnnPermutationImportanceView(
  summary: AnnPermutationImportanceSummary,
  options: {
    isExpanded?: boolean;
    limit?: number;
    groupLimit?: number;
  } = {}
): AnnPermutationImportanceView {
  const limit = normalizeLimit(options.limit);
  const groupLimit = normalizeLimit(options.groupLimit ?? 3);
  const totalCount = summary.rows.length;
  const isExpanded = options.isExpanded === true;
  const rows = isExpanded ? summary.rows : summary.rows.slice(0, limit);
  const visibleCount = rows.length;
  const hiddenCount = Math.max(0, totalCount - visibleCount);
  const hasMoreThanLimit = totalCount > limit;

  return {
    rows,
    groups: createPermutationImportanceGroups(summary, groupLimit),
    totalCount,
    visibleCount,
    hiddenCount,
    hasHiddenRows: hiddenCount > 0,
    statusLabel: hiddenCount > 0
      ? `Showing top ${visibleCount} of ${totalCount} inputs`
      : `Showing all ${totalCount} input${totalCount === 1 ? '' : 's'}`,
    toggleLabel: hasMoreThanLimit
      ? isExpanded
        ? `Show top ${limit}`
        : `Show all ${totalCount} inputs`
      : null,
  };
}
