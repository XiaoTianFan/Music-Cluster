export type FeatureStatus = 'idle' | 'processing' | 'complete' | 'error';
export type LogLevel = 'info' | 'warn' | 'error' | 'complete';
export type ProcessingMethod = 'none' | 'standardize' | 'normalize';
export type ReductionMethod = 'pca' | 'tsne' | 'umap';
export type TrainingInputKind = 'raw' | 'processed' | 'reduced';
export type ReductionSourceKind = 'raw' | 'processed';
export type FeatureId =
  | 'mfcc'
  | 'energy'
  | 'entropy'
  | 'key'
  | 'dynamicComplexity'
  | 'loudness'
  | 'rms'
  | 'tuningFrequency'
  | 'rhythm'
  | 'rhythmSlow'
  | 'onsetRate'
  | 'danceability'
  | 'intensity'
  | 'spectralCentroidTime'
  | 'spectralComplexity'
  | 'spectralContrast'
  | 'inharmonicity'
  | 'dissonance'
  | 'melBands'
  | 'pitchSalience'
  | 'spectralFlux';

export interface Song {
  id: string;
  name: string;
  url: string;
  source: 'default' | 'user';
  externalId?: string;
}

export interface Features {
  mfccMeans?: number[];
  mfccStdDevs?: number[];
  energy?: number;
  entropy?: number;
  key?: string;
  keyScale?: string;
  keyStrength?: number;
  dynamicComplexity?: number;
  loudness?: number;
  rms?: number;
  tuningFrequency?: number;
  bpm?: number;
  bpmSlow?: number;
  rhythmConfidence?: number;
  onsetRate?: number;
  danceability?: number;
  intensity?: number;
  spectralCentroidTimeMean?: number;
  spectralCentroidTimeStdDev?: number;
  spectralComplexityMean?: number;
  spectralComplexityStdDev?: number;
  spectralContrastMeans?: number[];
  spectralContrastStdDevs?: number[];
  inharmonicityMean?: number;
  inharmonicityStdDev?: number;
  dissonanceMean?: number;
  dissonanceStdDev?: number;
  melBandsMeans?: number[];
  melBandsStdDevs?: number[];
  pitchSalienceMean?: number;
  pitchSalienceStdDev?: number;
  spectralFluxMean?: number;
  spectralFluxStdDev?: number;
  [key: string]: number | number[] | string | undefined;
}

export type FeatureDataKey = keyof Features;

export interface FeatureMatrix {
  vectors: number[][];
  songIds: string[];
  isOHEColumn: boolean[];
  columnLabels: string[];
}

export interface ProcessingStats {
  method: ProcessingMethod;
  range?: [number, number];
  isOHEColumn: boolean[];
  means?: number[];
  stdDevs?: number[];
  mins?: number[];
  maxs?: number[];
}

export interface FeatureMatrixStructure {
  featureKeys: FeatureDataKey[];
  keyValues: string[];
  scaleValues: string[];
  arrayLengths: Partial<Record<FeatureDataKey, number>>;
  columnLabels: string[];
  isOHEColumn: boolean[];
}

export interface TrainingPipelineSnapshot {
  inputKind: TrainingInputKind;
  selectedFeatureIds: FeatureId[];
  rawStructure: FeatureMatrixStructure;
  rawMatrix: FeatureMatrix;
  processingStats: ProcessingStats | null;
  reduction: {
    method: ReductionMethod;
    dimensions: number;
    sourceKind: ReductionSourceKind;
    trainingVectors: number[][];
    perplexity?: number;
    neighbors?: number;
    minDist?: number;
  } | null;
  labelMap: Record<string, number>;
  songIds: string[];
  inputDimension: number;
}

export interface InferenceResult {
  predictedLabel: string;
  confidence: number;
}

export interface ActivationLayerSnapshot {
  name: string;
  units: number;
  values?: number[];
  min: number;
  max: number;
  mean: number;
}

export interface ActivationSnapshot {
  epoch?: number;
  songId?: string;
  layers: ActivationLayerSnapshot[];
}

export const canonicalFeatureOrder: FeatureDataKey[] = [
  'energy', 'entropy', 'loudness', 'rms', 'dynamicComplexity', 'bpm', 'bpmSlow', 'onsetRate',
  'keyStrength', 'tuningFrequency', 'rhythmConfidence', 'pitchSalienceMean', 'pitchSalienceStdDev',
  'spectralCentroidTimeMean', 'spectralCentroidTimeStdDev',
  'spectralComplexityMean', 'spectralComplexityStdDev',
  'spectralFluxMean', 'spectralFluxStdDev',
  'inharmonicityMean', 'inharmonicityStdDev',
  'dissonanceMean', 'dissonanceStdDev',
  'danceability', 'intensity',
  'mfccMeans', 'mfccStdDevs',
  'spectralContrastMeans', 'spectralContrastStdDevs',
  'melBandsMeans', 'melBandsStdDevs',
  'key', 'keyScale',
];

export const availableMirFeatures: Array<{ id: FeatureId; name: string }> = [
  { id: 'mfcc', name: 'MFCC' },
  { id: 'energy', name: 'Aggregate Energy' },
  { id: 'entropy', name: 'ZCR Entropy' },
  { id: 'key', name: 'Key & Scale' },
  { id: 'dynamicComplexity', name: 'Dynamic Complexity' },
  { id: 'rms', name: 'RMS' },
  { id: 'tuningFrequency', name: 'Tuning Frequency' },
  { id: 'rhythm', name: 'BPM (Fast)' },
  { id: 'rhythmSlow', name: 'BPM (Slow)' },
  { id: 'danceability', name: 'Danceability' },
  { id: 'intensity', name: 'Intensity' },
  { id: 'spectralCentroidTime', name: 'Spectral Centroid' },
  { id: 'spectralComplexity', name: 'Spectral Complexity' },
  { id: 'spectralContrast', name: 'Spectral Contrast' },
  { id: 'inharmonicity', name: 'Inharmonicity' },
  { id: 'dissonance', name: 'Dissonance' },
  { id: 'melBands', name: 'Mel Bands' },
  { id: 'pitchSalience', name: 'Pitch Salience' },
  { id: 'spectralFlux', name: 'Spectral Flux' },
];

export const featureIdToDataKeysMap: ReadonlyMap<FeatureId, FeatureDataKey[]> = new Map([
  ['mfcc', ['mfccMeans', 'mfccStdDevs']],
  ['energy', ['energy']],
  ['entropy', ['entropy']],
  ['dynamicComplexity', ['dynamicComplexity', 'loudness']],
  ['loudness', ['loudness']],
  ['key', ['key', 'keyScale', 'keyStrength']],
  ['rms', ['rms']],
  ['rhythm', ['bpm']],
  ['rhythmSlow', ['bpmSlow']],
  ['onsetRate', ['onsetRate']],
  ['danceability', ['danceability']],
  ['intensity', ['intensity']],
  ['spectralCentroidTime', ['spectralCentroidTimeMean', 'spectralCentroidTimeStdDev']],
  ['spectralComplexity', ['spectralComplexityMean', 'spectralComplexityStdDev']],
  ['spectralContrast', ['spectralContrastMeans', 'spectralContrastStdDevs']],
  ['inharmonicity', ['inharmonicityMean', 'inharmonicityStdDev']],
  ['dissonance', ['dissonanceMean', 'dissonanceStdDev']],
  ['melBands', ['melBandsMeans', 'melBandsStdDevs']],
  ['pitchSalience', ['pitchSalienceMean', 'pitchSalienceStdDev']],
  ['spectralFlux', ['spectralFluxMean', 'spectralFluxStdDev']],
  ['tuningFrequency', ['tuningFrequency']],
]);

const keyValuesFallback = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const scaleValuesFallback = ['major', 'minor'];

export function expandFeatureIds(featureIds: Iterable<string>): FeatureDataKey[] {
  const expanded = new Set<FeatureDataKey>();
  for (const featureId of featureIds) {
    const mappedKeys = featureIdToDataKeysMap.get(featureId as FeatureId);
    if (mappedKeys) {
      mappedKeys.forEach(key => expanded.add(key));
    } else if (canonicalFeatureOrder.includes(featureId as FeatureDataKey)) {
      expanded.add(featureId as FeatureDataKey);
    }
  }
  return canonicalFeatureOrder.filter(key => expanded.has(key));
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function getCommonFeatureKeys(activeFeatures: Array<{ features: Features }>, requestedKeys: FeatureDataKey[]): FeatureDataKey[] {
  return requestedKeys.filter(key => activeFeatures.every(({ features }) => {
    const value = features[key];
    if (Array.isArray(value)) return value.length > 0 && value.every(isFiniteNumber);
    if (key === 'key' || key === 'keyScale') return typeof value === 'string' && value.trim() !== '';
    return isFiniteNumber(value);
  }));
}

function createStructure(activeFeatures: Array<{ features: Features }>, featureKeys: FeatureDataKey[]): FeatureMatrixStructure {
  const keyValues = featureKeys.includes('key')
    ? [...new Set(activeFeatures.map(({ features }) => String(features.key)).filter(Boolean))].sort()
    : [];
  const scaleValues = featureKeys.includes('keyScale')
    ? [...new Set(activeFeatures.map(({ features }) => String(features.keyScale)).filter(Boolean))].sort()
    : [];
  const arrayLengths: Partial<Record<FeatureDataKey, number>> = {};
  const columnLabels: string[] = [];
  const isOHEColumn: boolean[] = [];

  for (const key of featureKeys) {
    if (key === 'key') {
      const values = keyValues.length > 0 ? keyValues : keyValuesFallback;
      values.forEach(value => columnLabels.push(`Key: ${value}`));
      isOHEColumn.push(...Array(values.length).fill(true));
    } else if (key === 'keyScale') {
      const values = scaleValues.length > 0 ? scaleValues : scaleValuesFallback;
      values.forEach(value => columnLabels.push(`Scale: ${value}`));
      isOHEColumn.push(...Array(values.length).fill(true));
    } else {
      const firstValue = activeFeatures.find(({ features }) => Array.isArray(features[key]))?.features[key];
      if (Array.isArray(firstValue)) {
        arrayLengths[key] = firstValue.length;
        for (let index = 0; index < firstValue.length; index++) {
          columnLabels.push(`${String(key)}[${index}]`);
          isOHEColumn.push(false);
        }
      } else {
        columnLabels.push(String(key));
        isOHEColumn.push(false);
      }
    }
  }

  return { featureKeys, keyValues, scaleValues, arrayLengths, columnLabels, isOHEColumn };
}

function vectorFromFeatures(id: string, features: Features, structure: FeatureMatrixStructure, logFn?: (message: string, level: LogLevel) => void): number[] | null {
  const vector: number[] = [];

  for (const key of structure.featureKeys) {
    const value = features[key];
    if (key === 'key') {
      const values = structure.keyValues.length > 0 ? structure.keyValues : keyValuesFallback;
      vector.push(...values.map(keyValue => keyValue === value ? 1 : 0));
    } else if (key === 'keyScale') {
      const values = structure.scaleValues.length > 0 ? structure.scaleValues : scaleValuesFallback;
      vector.push(...values.map(scaleValue => scaleValue === value ? 1 : 0));
    } else if (Array.isArray(value)) {
      const expectedLength = structure.arrayLengths[key] ?? value.length;
      if (value.length !== expectedLength || !value.every(isFiniteNumber)) {
        logFn?.(`Feature ${String(key)} for ${id} has invalid vector length or values.`, 'warn');
        return null;
      }
      vector.push(...value);
    } else if (isFiniteNumber(value)) {
      vector.push(value);
    } else {
      logFn?.(`Feature ${String(key)} for ${id} is missing or not finite.`, 'warn');
      return null;
    }
  }

  if (vector.length !== structure.columnLabels.length) {
    logFn?.(`Prepared vector for ${id} has ${vector.length} columns; expected ${structure.columnLabels.length}.`, 'error');
    return null;
  }
  return vector;
}

export function prepareFeatureMatrix(
  activeFeatures: Array<{ id: string; features: Features }>,
  selectedFeatureIds: Iterable<string>,
  logFn?: (message: string, level: LogLevel) => void
): { matrix: FeatureMatrix; structure: FeatureMatrixStructure } | null {
  if (activeFeatures.length === 0) {
    logFn?.('No songs with features are available for matrix preparation.', 'warn');
    return null;
  }

  const requestedKeys = expandFeatureIds(selectedFeatureIds);
  if (requestedKeys.length === 0) {
    logFn?.('No selected features map to data keys.', 'warn');
    return null;
  }

  const featureKeys = getCommonFeatureKeys(activeFeatures, requestedKeys);
  if (featureKeys.length === 0) {
    logFn?.('No selected features are present across all feature-complete songs.', 'warn');
    return null;
  }

  const structure = createStructure(activeFeatures, featureKeys);
  const vectors: number[][] = [];
  const songIds: string[] = [];
  for (const item of activeFeatures) {
    const vector = vectorFromFeatures(item.id, item.features, structure, logFn);
    if (vector) {
      vectors.push(vector);
      songIds.push(item.id);
    }
  }

  if (vectors.length === 0) {
    logFn?.('No valid vectors were produced from the selected features.', 'error');
    return null;
  }

  logFn?.(`Prepared ANN matrix: ${vectors.length} songs, ${structure.columnLabels.length} columns.`, 'complete');
  return {
    matrix: {
      vectors,
      songIds,
      isOHEColumn: [...structure.isOHEColumn],
      columnLabels: [...structure.columnLabels],
    },
    structure,
  };
}

export function prepareFeatureMatrixWithStructure(
  activeFeatures: Array<{ id: string; features: Features }>,
  structure: FeatureMatrixStructure,
  logFn?: (message: string, level: LogLevel) => void
): FeatureMatrix | null {
  const vectors: number[][] = [];
  const songIds: string[] = [];
  for (const item of activeFeatures) {
    const vector = vectorFromFeatures(item.id, item.features, structure, logFn);
    if (!vector) return null;
    vectors.push(vector);
    songIds.push(item.id);
  }
  return {
    vectors,
    songIds,
    isOHEColumn: [...structure.isOHEColumn],
    columnLabels: [...structure.columnLabels],
  };
}
