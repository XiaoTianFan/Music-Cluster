import {
  availableMirFeatures,
  type FeatureId,
  type ProcessingMethod,
  type ReductionMethod,
} from './annPipeline';

export const ANN_SETUP_STORAGE_KEY = 'musiccluster-ann-setup-v1';

type ActivationName = 'relu' | 'sigmoid' | 'tanh';
type OptimizerName = 'adam' | 'sgd' | 'rmsprop';

export interface AnnSetupNetworkConfig {
  hiddenLayers: number;
  nodesPerLayer: number[];
  activation: ActivationName;
  optimizer: OptimizerName;
  learningRate: number;
  epochs: number;
  targetLoss?: number;
  splitRatio: number;
  randomSeed?: number;
  batchSize: number;
}

export interface AnnSetupSnapshot {
  version: 1;
  namedLists: Record<string, string[]>;
  selectedFeatureIds: FeatureId[];
  processingMethod: ProcessingMethod;
  useDimensionalityReduction: boolean;
  reductionMethod: ReductionMethod;
  targetDimensions: number;
  networkConfig: AnnSetupNetworkConfig;
}

export interface HydratedAnnSetup {
  namedLists: Record<string, Set<string>>;
  selectedFeatures: Set<FeatureId>;
  processingMethod: ProcessingMethod;
  useDimensionalityReduction: boolean;
  reductionMethod: ReductionMethod;
  targetDimensions: number;
  networkConfig: AnnSetupNetworkConfig;
}

export interface SerializeAnnSetupInput {
  namedLists: Record<string, Set<string>>;
  selectedFeatures: Iterable<string>;
  processingMethod: ProcessingMethod;
  useDimensionalityReduction: boolean;
  reductionMethod: ReductionMethod;
  targetDimensions: number;
  networkConfig: AnnSetupNetworkConfig;
  persistableSongIds?: ReadonlySet<string>;
}

const featureIds = new Set(availableMirFeatures.map(feature => feature.id));
const processingMethods = new Set<ProcessingMethod>(['none', 'standardize', 'normalize']);
const reductionMethods = new Set<ReductionMethod>(['pca', 'tsne', 'umap']);
const activations = new Set<ActivationName>(['relu', 'sigmoid', 'tanh']);
const optimizers = new Set<OptimizerName>(['adam', 'sgd', 'rmsprop']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isFeatureId(value: string): value is FeatureId {
  return featureIds.has(value as FeatureId);
}

function uniqueStrings<T extends string>(values: Iterable<T>): T[] {
  return Array.from(new Set(values));
}

function cleanNetworkConfig(config: AnnSetupNetworkConfig): AnnSetupNetworkConfig {
  return {
    hiddenLayers: config.hiddenLayers,
    nodesPerLayer: [...config.nodesPerLayer],
    activation: config.activation,
    optimizer: config.optimizer,
    learningRate: config.learningRate,
    epochs: config.epochs,
    splitRatio: config.splitRatio,
    batchSize: config.batchSize,
    ...(Number.isFinite(config.randomSeed) ? { randomSeed: config.randomSeed } : {}),
    ...(Number.isFinite(config.targetLoss) ? { targetLoss: config.targetLoss } : {}),
  };
}

function parseNetworkConfig(value: unknown): AnnSetupNetworkConfig | null {
  if (!isRecord(value)) return null;

  const {
    hiddenLayers,
    nodesPerLayer,
    activation,
    optimizer,
    learningRate,
    epochs,
    targetLoss,
    splitRatio,
    randomSeed,
    batchSize,
  } = value;

  if (!Number.isInteger(hiddenLayers) || Number(hiddenLayers) < 0) return null;
  if (!Array.isArray(nodesPerLayer) || nodesPerLayer.length !== hiddenLayers || !nodesPerLayer.every(isPositiveInteger)) return null;
  if (typeof activation !== 'string' || !activations.has(activation as ActivationName)) return null;
  if (typeof optimizer !== 'string' || !optimizers.has(optimizer as OptimizerName)) return null;
  if (!isFiniteNumber(learningRate) || learningRate <= 0) return null;
  if (!isPositiveInteger(epochs)) return null;
  if (!isFiniteNumber(splitRatio) || splitRatio <= 0 || splitRatio >= 1) return null;
  if (!isPositiveInteger(batchSize)) return null;
  if (randomSeed !== undefined && (!Number.isInteger(randomSeed) || !isFiniteNumber(randomSeed))) return null;
  if (targetLoss !== undefined && (!isFiniteNumber(targetLoss) || targetLoss < 0)) return null;

  return {
    hiddenLayers,
    nodesPerLayer: [...nodesPerLayer],
    activation: activation as ActivationName,
    optimizer: optimizer as OptimizerName,
    learningRate,
    epochs,
    splitRatio,
    batchSize,
    ...(randomSeed !== undefined ? { randomSeed } : {}),
    ...(targetLoss !== undefined ? { targetLoss } : {}),
  };
}

export function serializeAnnSetupSnapshot(input: SerializeAnnSetupInput): AnnSetupSnapshot {
  const namedLists = Object.fromEntries(
    Object.entries(input.namedLists).map(([label, songIds]) => {
      const filteredSongIds = Array.from(songIds)
        .filter(songId => !input.persistableSongIds || input.persistableSongIds.has(songId))
        .sort();

      return [label, filteredSongIds];
    })
  );

  return {
    version: 1,
    namedLists,
    selectedFeatureIds: uniqueStrings(Array.from(input.selectedFeatures).filter(isFeatureId)),
    processingMethod: input.processingMethod,
    useDimensionalityReduction: input.useDimensionalityReduction,
    reductionMethod: input.reductionMethod,
    targetDimensions: input.targetDimensions,
    networkConfig: cleanNetworkConfig(input.networkConfig),
  };
}

export function parseAnnSetupSnapshot(raw: unknown): AnnSetupSnapshot | null {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== 1) return null;
  if (!isRecord(parsed.namedLists)) return null;
  if (!Array.isArray(parsed.selectedFeatureIds) || !parsed.selectedFeatureIds.every(id => typeof id === 'string' && isFeatureId(id))) return null;
  if (typeof parsed.processingMethod !== 'string' || !processingMethods.has(parsed.processingMethod as ProcessingMethod)) return null;
  if (typeof parsed.useDimensionalityReduction !== 'boolean') return null;
  if (typeof parsed.reductionMethod !== 'string' || !reductionMethods.has(parsed.reductionMethod as ReductionMethod)) return null;
  if (parsed.targetDimensions !== 2 && parsed.targetDimensions !== 3) return null;

  const namedLists: Record<string, string[]> = {};
  for (const [label, songIds] of Object.entries(parsed.namedLists)) {
    if (label.trim() === '' || !Array.isArray(songIds) || !songIds.every(songId => typeof songId === 'string')) return null;
    namedLists[label] = uniqueStrings(songIds);
  }

  const networkConfig = parseNetworkConfig(parsed.networkConfig);
  if (!networkConfig) return null;

  return {
    version: 1,
    namedLists,
    selectedFeatureIds: uniqueStrings(parsed.selectedFeatureIds) as FeatureId[],
    processingMethod: parsed.processingMethod as ProcessingMethod,
    useDimensionalityReduction: parsed.useDimensionalityReduction,
    reductionMethod: parsed.reductionMethod as ReductionMethod,
    targetDimensions: parsed.targetDimensions,
    networkConfig,
  };
}

export function hydrateAnnSetupSnapshot(
  snapshot: AnnSetupSnapshot,
  availableSongIds?: ReadonlySet<string>
): HydratedAnnSetup {
  return {
    namedLists: Object.fromEntries(
      Object.entries(snapshot.namedLists).map(([label, songIds]) => [
        label,
        new Set(songIds.filter(songId => !availableSongIds || availableSongIds.has(songId))),
      ])
    ),
    selectedFeatures: new Set(snapshot.selectedFeatureIds),
    processingMethod: snapshot.processingMethod,
    useDimensionalityReduction: snapshot.useDimensionalityReduction,
    reductionMethod: snapshot.reductionMethod,
    targetDimensions: snapshot.targetDimensions,
    networkConfig: cleanNetworkConfig(snapshot.networkConfig),
  };
}
