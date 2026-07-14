import type { ReductionMethod, TrainingInputKind } from './annPipeline';

export interface AnnFeatureSignalClassMean {
  label: string;
  count: number;
  mean: number;
}

export interface AnnFeatureSignalRow {
  dimensionIndex: number;
  dimensionLabel: string;
  score: number;
  scoreLabel: string;
  meanRange: number;
  strongestLabel: string;
  weakestLabel: string;
  classMeans: AnnFeatureSignalClassMean[];
}

export interface AnnFeatureSignalSummary {
  inputKind: TrainingInputKind;
  labeledRowCount: number;
  labelCount: number;
  dimensionCount: number;
  rows: AnnFeatureSignalRow[];
  summary: string;
}

export interface AnnFeatureSignalAssignedRows {
  songIds: string[];
  vectors: number[][];
  labels: string[];
}

export function getAnnFeatureSignalDimensionLabels({
  inputKind,
  inputDimension,
  rawColumnLabels,
  reductionMethod,
}: {
  inputKind: TrainingInputKind;
  inputDimension: number;
  rawColumnLabels?: readonly string[] | null;
  reductionMethod?: ReductionMethod | null;
}): string[] {
  if (!Number.isInteger(inputDimension) || inputDimension <= 0) return [];

  if (inputKind === 'reduced') {
    const prefix = reductionMethod ? reductionMethod.toUpperCase() : 'Reduced';
    return Array.from({ length: inputDimension }, (_, index) => `${prefix} ${index + 1}`);
  }

  if (rawColumnLabels && rawColumnLabels.length === inputDimension) {
    return rawColumnLabels.map((label, index) => label.trim() || `Input ${index + 1}`);
  }

  return Array.from({ length: inputDimension }, (_, index) => `Input ${index + 1}`);
}

export function getAnnFeatureSignalLabelsForSongIds({
  songIds,
  namedLists,
}: {
  songIds: readonly string[];
  namedLists: Record<string, Iterable<string>>;
}): string[] | null {
  const labelBySongId = new Map<string, string>();

  for (const [label, assignedSongIds] of Object.entries(namedLists)) {
    for (const songId of assignedSongIds) {
      if (!labelBySongId.has(songId)) {
        labelBySongId.set(songId, label);
      }
    }
  }

  const labels = songIds.map(songId => labelBySongId.get(songId));
  return labels.every((label): label is string => typeof label === 'string' && label.trim() !== '')
    ? labels
    : null;
}

export function getAnnFeatureSignalRowsForSongAssignments({
  songIds,
  vectors,
  namedLists,
}: {
  songIds: readonly string[];
  vectors: readonly (readonly number[])[];
  namedLists: Record<string, Iterable<string>>;
}): AnnFeatureSignalAssignedRows | null {
  if (songIds.length !== vectors.length) return null;

  const labelBySongId = new Map<string, string>();
  for (const [label, assignedSongIds] of Object.entries(namedLists)) {
    for (const songId of assignedSongIds) {
      if (!labelBySongId.has(songId)) {
        labelBySongId.set(songId, label);
      }
    }
  }

  const assignedRows: AnnFeatureSignalAssignedRows = {
    songIds: [],
    vectors: [],
    labels: [],
  };

  songIds.forEach((songId, index) => {
    const label = labelBySongId.get(songId);
    if (!label || !label.trim()) return;
    assignedRows.songIds.push(songId);
    assignedRows.vectors.push([...vectors[index]]);
    assignedRows.labels.push(label);
  });

  return assignedRows.labels.length > 0 ? assignedRows : null;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getScoreLabel(score: number): string {
  if (score >= 0.7) return 'Strong signal';
  if (score >= 0.35) return 'Moderate signal';
  if (score > 0) return 'Weak signal';
  return 'No separation';
}

function getVectorDimension(vectors: readonly (readonly number[])[]): number | null {
  if (vectors.length === 0) return null;
  const [firstVector] = vectors;
  if (!Array.isArray(firstVector) || firstVector.length === 0 || !firstVector.every(Number.isFinite)) {
    return null;
  }

  const dimension = firstVector.length;
  return vectors.every(vector => (
    Array.isArray(vector)
    && vector.length === dimension
    && vector.every(Number.isFinite)
  ))
    ? dimension
    : null;
}

function getClassMeansForDimension(
  vectors: readonly (readonly number[])[],
  labels: readonly string[],
  dimensionIndex: number
): AnnFeatureSignalClassMean[] {
  const valuesByLabel = new Map<string, number[]>();
  labels.forEach((label, rowIndex) => {
    const values = valuesByLabel.get(label) ?? [];
    values.push(vectors[rowIndex][dimensionIndex]);
    valuesByLabel.set(label, values);
  });

  return Array.from(valuesByLabel.entries()).map(([label, values]) => {
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      label,
      count: values.length,
      mean: total / values.length,
    };
  });
}

export function getAnnFeatureSignalSummary({
  inputKind,
  vectors,
  labels,
  dimensionLabels,
}: {
  inputKind: TrainingInputKind;
  vectors: readonly (readonly number[])[];
  labels: readonly string[];
  dimensionLabels?: readonly string[] | null;
}): AnnFeatureSignalSummary | null {
  if (vectors.length === 0 || vectors.length !== labels.length) return null;

  const normalizedLabels = labels.map(label => label.trim()).filter(Boolean);
  if (normalizedLabels.length !== labels.length || new Set(normalizedLabels).size < 2) return null;

  const dimension = getVectorDimension(vectors);
  if (dimension === null) return null;

  const labelsForRows = [...normalizedLabels];
  const labelsForDimensions = dimensionLabels?.length === dimension
    ? dimensionLabels.map((label, index) => label.trim() || `Input ${index + 1}`)
    : Array.from({ length: dimension }, (_, index) => `Input ${index + 1}`);

  const rows: AnnFeatureSignalRow[] = [];
  for (let dimensionIndex = 0; dimensionIndex < dimension; dimensionIndex++) {
    const classMeans = getClassMeansForDimension(vectors, labelsForRows, dimensionIndex);
    const totalMean = vectors.reduce((sum, vector) => sum + vector[dimensionIndex], 0) / vectors.length;
    const betweenVariance = classMeans.reduce((sum, row) => (
      sum + row.count * ((row.mean - totalMean) ** 2)
    ), 0) / vectors.length;
    const meanByLabel = new Map(classMeans.map(row => [row.label, row.mean]));
    const withinVariance = vectors.reduce((sum, vector, rowIndex) => {
      const labelMean = meanByLabel.get(labelsForRows[rowIndex]) ?? 0;
      return sum + ((vector[dimensionIndex] - labelMean) ** 2);
    }, 0) / vectors.length;
    const varianceTotal = betweenVariance + withinVariance;
    const score = varianceTotal > 0 ? betweenVariance / varianceTotal : 0;
    const sortedMeans = [...classMeans].sort((left, right) => right.mean - left.mean);
    const strongest = sortedMeans[0];
    const weakest = sortedMeans[sortedMeans.length - 1];

    rows.push({
      dimensionIndex,
      dimensionLabel: labelsForDimensions[dimensionIndex],
      score,
      scoreLabel: getScoreLabel(score),
      meanRange: strongest.mean - weakest.mean,
      strongestLabel: strongest.label,
      weakestLabel: weakest.label,
      classMeans,
    });
  }

  rows.sort((left, right) => (
    right.score - left.score
    || right.meanRange - left.meanRange
    || left.dimensionIndex - right.dimensionIndex
  ));

  const topSignal = rows[0];
  return {
    inputKind,
    labeledRowCount: vectors.length,
    labelCount: new Set(labelsForRows).size,
    dimensionCount: dimension,
    rows,
    summary: `Top signal: ${topSignal.dimensionLabel} separates labels strongest (${topSignal.scoreLabel.toLowerCase()}, ${formatPercent(topSignal.score)}).`,
  };
}
