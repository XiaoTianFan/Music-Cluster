export type AnnNamedLists = Record<string, ReadonlySet<string>>;

export type AnnLabelDistributionStatus = 'empty' | 'too-small' | 'ready';

export interface AnnLabelDistributionRow {
  label: string;
  count: number;
  status: AnnLabelDistributionStatus;
  message: string;
}

export interface AnnLabelDistributionSummary {
  totalLabelCount: number;
  nonEmptyLabelCount: number;
  assignedSongCount: number;
  readyLabelCount: number;
  minimumSamplesPerLabel: number;
  labelsBelowMinimum: string[];
  rows: AnnLabelDistributionRow[];
}

function getRowStatus(count: number, minimumSamplesPerLabel: number): AnnLabelDistributionStatus {
  if (count === 0) return 'empty';
  return count < minimumSamplesPerLabel ? 'too-small' : 'ready';
}

function getRowMessage(status: AnnLabelDistributionStatus, count: number, minimumSamplesPerLabel: number): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'empty':
      return 'Empty';
    case 'too-small': {
      const missingCount = minimumSamplesPerLabel - count;
      return `Needs ${missingCount} more`;
    }
    default:
      return status satisfies never;
  }
}

export function getAnnLabelDistribution(
  namedLists: AnnNamedLists,
  minimumSamplesPerLabel = 2
): AnnLabelDistributionSummary {
  const rows = Object.entries(namedLists).map(([label, songIds]) => {
    const count = songIds.size;
    const status = getRowStatus(count, minimumSamplesPerLabel);
    return {
      label,
      count,
      status,
      message: getRowMessage(status, count, minimumSamplesPerLabel),
    };
  });

  return {
    totalLabelCount: rows.length,
    nonEmptyLabelCount: rows.filter(row => row.count > 0).length,
    assignedSongCount: rows.reduce((total, row) => total + row.count, 0),
    readyLabelCount: rows.filter(row => row.status === 'ready').length,
    minimumSamplesPerLabel,
    labelsBelowMinimum: rows
      .filter(row => row.status === 'too-small')
      .map(row => row.label),
    rows,
  };
}
