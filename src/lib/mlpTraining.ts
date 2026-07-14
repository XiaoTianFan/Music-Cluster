export interface LabeledVectorPair {
  vector: number[];
  label: string;
}

export interface TrainingRowsValidation {
  inputDimension: number;
  numClasses: number;
  outputLabels: string[];
  labelCounts: Record<string, number>;
}

export interface StratifiedTrainValidationSplit {
  trainPairs: LabeledVectorPair[];
  validationPairs: LabeledVectorPair[];
}

export function getLabelCounts(labels: Iterable<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const label of labels) {
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function getRandom(seed?: number): () => number {
  return typeof seed === 'number' && Number.isFinite(seed)
    ? createSeededRandom(seed)
    : Math.random;
}

function shuffledCopy<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function validateLabelMap(labelMap: Record<string, number>): string[] {
  const entries = Object.entries(labelMap);
  if (entries.length < 2) {
    throw new Error('Need at least two distinct labels for classification.');
  }

  const seenIndexes = new Set<number>();
  for (const [label, index] of entries) {
    if (!label.trim()) {
      throw new Error('Label names must not be empty.');
    }
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Label "${label}" has an invalid class index.`);
    }
    if (seenIndexes.has(index)) {
      throw new Error(`Duplicate class index ${index} in label map.`);
    }
    seenIndexes.add(index);
  }

  return entries
    .sort(([, leftIndex], [, rightIndex]) => leftIndex - rightIndex)
    .map(([label]) => label);
}

export function validateTrainingRows(
  vectors: number[][],
  labels: string[],
  labelMap: Record<string, number>
): TrainingRowsValidation {
  if (!vectors || vectors.length < 2 || !labels || labels.length !== vectors.length) {
    throw new Error('Need at least two labeled vectors for training.');
  }

  const inputDimension = vectors[0]?.length ?? 0;
  if (
    inputDimension <= 0 ||
    !vectors.every(vector => vector.length === inputDimension && vector.every(Number.isFinite))
  ) {
    throw new Error('Training vectors must be finite and share one non-empty dimension.');
  }

  const outputLabels = validateLabelMap(labelMap);
  const unknownLabel = labels.find(label => labelMap[label] === undefined);
  if (unknownLabel) {
    throw new Error(`Unknown label "${unknownLabel}" is missing from labelMap.`);
  }

  const labelCounts = getLabelCounts(labels);
  const emptyMappedLabel = outputLabels.find(label => !labelCounts[label]);
  if (emptyMappedLabel) {
    throw new Error(`Label "${emptyMappedLabel}" has no training rows.`);
  }

  return {
    inputDimension,
    numClasses: outputLabels.length,
    outputLabels,
    labelCounts,
  };
}

export function createStratifiedTrainValidationSplit(
  vectors: number[][],
  labels: string[],
  labelMap: Record<string, number>,
  splitRatio: number,
  seed?: number
): StratifiedTrainValidationSplit {
  const validation = validateTrainingRows(vectors, labels, labelMap);
  if (!Number.isFinite(splitRatio) || splitRatio <= 0 || splitRatio >= 1) {
    throw new Error('Train split ratio must be greater than 0 and less than 1.');
  }

  const tooSmallLabel = validation.outputLabels.find(label => validation.labelCounts[label] < 2);
  if (tooSmallLabel) {
    throw new Error(`Need at least two samples per label for stratified training; "${tooSmallLabel}" has ${validation.labelCounts[tooSmallLabel]}.`);
  }

  const random = getRandom(seed);
  const pairsByLabel = new Map<string, LabeledVectorPair[]>();
  vectors.forEach((vector, index) => {
    const label = labels[index];
    const pairs = pairsByLabel.get(label) ?? [];
    pairs.push({ vector, label });
    pairsByLabel.set(label, pairs);
  });

  const trainPairs: LabeledVectorPair[] = [];
  const validationPairs: LabeledVectorPair[] = [];

  validation.outputLabels.forEach(label => {
    const pairs = shuffledCopy(pairsByLabel.get(label) ?? [], random);
    const trainCount = Math.max(1, Math.min(pairs.length - 1, Math.round(pairs.length * splitRatio)));
    trainPairs.push(...pairs.slice(0, trainCount));
    validationPairs.push(...pairs.slice(trainCount));
  });

  return {
    trainPairs: shuffledCopy(trainPairs, random),
    validationPairs: shuffledCopy(validationPairs, random),
  };
}
