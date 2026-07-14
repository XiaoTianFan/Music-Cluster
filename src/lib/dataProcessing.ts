export type ProcessingMethod = 'none' | 'standardize' | 'normalize';
export type NormalizationRange = [number, number];

export interface ProcessingStats {
  means?: number[];
  stdDevs?: number[];
  mins?: number[];
  maxs?: number[];
}

export interface ProcessDataMatrixInput {
  vectors: number[][];
  isOHEColumn: boolean[];
  method: ProcessingMethod;
  range?: NormalizationRange;
}

export interface ProcessDataMatrixResult {
  processedVectors: number[][];
  stats: ProcessingStats;
}

export interface TransformDataMatrixInput extends ProcessDataMatrixInput {
  means?: number[];
  stdDevs?: number[];
  mins?: number[];
  maxs?: number[];
}

function cloneVectors(vectors: number[][]): number[][] {
  return vectors.map(row => [...row]);
}

function validateMatrix(vectors: number[][], isOHEColumn: boolean[]): number {
  if (!vectors || vectors.length === 0 || !Array.isArray(vectors[0])) {
    throw new Error('Received empty or invalid vectors.');
  }

  const numCols = vectors[0].length;
  if (numCols === 0) {
    throw new Error('Received vectors with no columns.');
  }
  if (!isOHEColumn || isOHEColumn.length !== numCols) {
    throw new Error('Received invalid or mismatched OHE column definition.');
  }
  if (!vectors.every(row => row.length === numCols && row.every(Number.isFinite))) {
    throw new Error('Vectors must be finite and share the same column count.');
  }

  return numCols;
}

function validateStats(stats: number[] | undefined, numCols: number, label: string): number[] {
  if (!stats || stats.length !== numCols || !stats.every(Number.isFinite)) {
    throw new Error(`${label} must be provided for every matrix column.`);
  }
  return stats;
}

export function getColumnStats(vectors: number[][]): { means: number[]; stdDevs: number[] } {
  if (!vectors || vectors.length === 0) {
    return { means: [], stdDevs: [] };
  }

  const numCols = vectors[0].length;
  const numRows = vectors.length;
  const means = Array(numCols).fill(0);
  const stdDevs = Array(numCols).fill(0);

  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    let sum = 0;
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      sum += vectors[rowIndex][colIndex];
    }
    means[colIndex] = sum / numRows;
  }

  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    let sumSqDiff = 0;
    for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
      sumSqDiff += Math.pow(vectors[rowIndex][colIndex] - means[colIndex], 2);
    }
    stdDevs[colIndex] = Math.sqrt(sumSqDiff / numRows);
  }

  return { means, stdDevs };
}

export function getColumnMinMax(vectors: number[][]): { mins: number[]; maxs: number[] } {
  if (!vectors || vectors.length === 0) {
    return { mins: [], maxs: [] };
  }

  const numCols = vectors[0].length;
  const mins = [...vectors[0]];
  const maxs = [...vectors[0]];

  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    for (let rowIndex = 1; rowIndex < vectors.length; rowIndex++) {
      mins[colIndex] = Math.min(mins[colIndex], vectors[rowIndex][colIndex]);
      maxs[colIndex] = Math.max(maxs[colIndex], vectors[rowIndex][colIndex]);
    }
  }

  return { mins, maxs };
}

export function standardizeWithStats(
  vectors: number[][],
  isOHEColumn: boolean[],
  means: number[],
  stdDevs: number[]
): number[][] {
  const numCols = validateMatrix(vectors, isOHEColumn);
  const validatedMeans = validateStats(means, numCols, 'Standardization means');
  const validatedStdDevs = validateStats(stdDevs, numCols, 'Standardization stdDevs');

  return vectors.map(row => row.map((value, colIndex) => {
    if (isOHEColumn[colIndex]) return value;
    const stdDev = validatedStdDevs[colIndex];
    return stdDev === 0 ? 0 : (value - validatedMeans[colIndex]) / stdDev;
  }));
}

export function normalizeWithStats(
  vectors: number[][],
  isOHEColumn: boolean[],
  mins: number[],
  maxs: number[],
  range: NormalizationRange = [0, 1]
): number[][] {
  const numCols = validateMatrix(vectors, isOHEColumn);
  const validatedMins = validateStats(mins, numCols, 'Normalization mins');
  const validatedMaxs = validateStats(maxs, numCols, 'Normalization maxs');
  const [minRange, maxRange] = range;

  return vectors.map(row => row.map((value, colIndex) => {
    if (isOHEColumn[colIndex]) return value;
    const minCol = validatedMins[colIndex];
    const maxCol = validatedMaxs[colIndex];
    const rangeCol = maxCol - minCol;
    return rangeCol === 0
      ? minRange
      : minRange + ((value - minCol) * (maxRange - minRange)) / rangeCol;
  }));
}

export function processDataMatrix(input: ProcessDataMatrixInput): ProcessDataMatrixResult {
  const { vectors, isOHEColumn, method, range } = input;
  validateMatrix(vectors, isOHEColumn);

  switch (method) {
    case 'standardize': {
      const { means, stdDevs } = getColumnStats(vectors);
      return {
        processedVectors: standardizeWithStats(vectors, isOHEColumn, means, stdDevs),
        stats: { means, stdDevs },
      };
    }
    case 'normalize': {
      const { mins, maxs } = getColumnMinMax(vectors);
      return {
        processedVectors: normalizeWithStats(vectors, isOHEColumn, mins, maxs, range ?? [0, 1]),
        stats: { mins, maxs },
      };
    }
    case 'none':
      return {
        processedVectors: cloneVectors(vectors),
        stats: {},
      };
    default:
      throw new Error(`Unsupported processing method: ${method satisfies never}`);
  }
}

export function transformDataMatrix(input: TransformDataMatrixInput): number[][] {
  const { vectors, isOHEColumn, method, range, means, stdDevs, mins, maxs } = input;
  const numCols = validateMatrix(vectors, isOHEColumn);

  switch (method) {
    case 'standardize':
      return standardizeWithStats(
        vectors,
        isOHEColumn,
        validateStats(means, numCols, 'Standardization means'),
        validateStats(stdDevs, numCols, 'Standardization stdDevs')
      );
    case 'normalize':
      return normalizeWithStats(
        vectors,
        isOHEColumn,
        validateStats(mins, numCols, 'Normalization mins'),
        validateStats(maxs, numCols, 'Normalization maxs'),
        range ?? [0, 1]
      );
    case 'none':
      return cloneVectors(vectors);
    default:
      throw new Error(`Unsupported processing method: ${method satisfies never}`);
  }
}
