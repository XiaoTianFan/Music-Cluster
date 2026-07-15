import * as tf from '@tensorflow/tfjs';
import { createStratifiedTrainValidationSplit, validateTrainingRows } from './mlpTraining';
import type {
  ActivationLayerSnapshot,
  ActivationSnapshot,
  AnnModelStateSnapshot,
  AnnTrainingExecutionMode,
  AnnTrainingPhaseKind,
  AnnTrainingPhaseSnapshot,
  AnnTrainingSessionStatus,
  DenseLayerWeightSnapshot,
} from './annPipeline';

export type {
  ActivationLayerSnapshot,
  ActivationSnapshot,
  AnnModelStateSnapshot,
  AnnTrainingExecutionMode,
  AnnTrainingPhaseKind,
  AnnTrainingPhaseSnapshot,
  AnnTrainingSessionStatus,
  DenseLayerWeightSnapshot,
};

export interface MLPConfig {
  layers: number;
  nodes: number[];
  activation: 'relu' | 'sigmoid' | 'tanh';
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  learningRate: number;
}

export interface TrainPayload {
  vectors: number[][];
  labels: string[];
  validationVectors?: number[][];
  validationLabels?: string[];
  config: MLPConfig;
  labelMap: Record<string, number>;
  trainIterations: number;
  batchSize: number;
  splitRatio: number;
  seed?: number;
  activationSampleSongId?: string;
  executionMode?: AnnTrainingExecutionMode;
}

export interface InferPayload {
  vectors: number[][];
  songIds: string[];
  labelMap?: Record<string, number>;
}

export interface ContinueTrainingPayload {
  additionalEpochs: number;
  executionMode: AnnTrainingExecutionMode;
}

export interface MlpModelArtifactsPayload {
  modelTopology: {};
  weightSpecs: tf.io.WeightsManifestEntry[];
  weightData: ArrayBuffer;
  format?: string;
  generatedBy?: string;
  convertedBy?: string | null;
}

export interface MlpModelPersistencePayload {
  modelArtifacts: MlpModelArtifactsPayload;
  outputLabels: string[];
}

interface TrainingSession {
  trainVectors: number[][];
  trainLabelIndices: number[];
  validationVectors: number[][];
  validationLabelIndices: number[];
  outputLabels: string[];
  batchSize: number;
  batchCount: number;
  completedEpochs: number;
  targetEpochs: number;
  mode: AnnTrainingExecutionMode;
  activationSampleSongId?: string;
  stepBatchIndex: number;
  stepPhaseIndex: number;
  stepActivationSnapshot: ActivationSnapshot | null;
}

type WithRequestId<T> = T & { requestId?: string };

export type MlpWorkerRecvMessage = WithRequestId<
  | { type: 'reset'; payload?: unknown }
  | { type: 'train'; payload: TrainPayload }
  | { type: 'advanceTraining'; payload?: unknown }
  | { type: 'continueTraining'; payload: ContinueTrainingPayload }
  | { type: 'infer'; payload: InferPayload }
  | { type: 'exportModel'; payload?: unknown }
  | { type: 'importModel'; payload: MlpModelPersistencePayload }
>;

export type MlpWorkerSendMessage = WithRequestId<
  | { type: 'mlpWorkerReady' }
  | { type: 'mlpResetComplete' }
  | { type: 'epochMetrics'; payload: { epoch: number; metrics: { loss: number; acc: number; valLoss: number; valAcc: number } } }
  | { type: 'activationSnapshot'; payload: ActivationSnapshot }
  | { type: 'modelStateSnapshot'; payload: AnnModelStateSnapshot }
  | { type: 'trainingPhase'; payload: AnnTrainingPhaseSnapshot }
  | { type: 'trainingSessionReady'; payload: { status: AnnTrainingSessionStatus; activationSnapshot: ActivationSnapshot; modelStateSnapshot: AnnModelStateSnapshot } }
  | { type: 'trainingPaused'; payload: { status: AnnTrainingSessionStatus; phaseSnapshot?: AnnTrainingPhaseSnapshot } }
  | { type: 'trainingComplete'; payload: { finalMetrics: { loss: number; accuracy: number }; activationSnapshot: ActivationSnapshot; modelStateSnapshot: AnnModelStateSnapshot; status: AnnTrainingSessionStatus } }
  | { type: 'inferenceComplete'; payload: { results: Record<string, { predictedLabel: string; confidence: number }> } }
  | { type: 'modelExportComplete'; payload: MlpModelPersistencePayload }
  | { type: 'modelImportComplete'; payload: { outputLabels: string[]; modelStateSnapshot: AnnModelStateSnapshot } }
  | { type: 'mlpError'; payload: { error: string } }
>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withRequestId<T extends MlpWorkerSendMessage>(message: T, requestId: string | undefined): T {
  return requestId ? { ...message, requestId } : message;
}

function createOptimizer(config: MLPConfig): tf.Optimizer {
  switch (config.optimizer) {
    case 'adam': return tf.train.adam(config.learningRate);
    case 'sgd': return tf.train.sgd(config.learningRate);
    case 'rmsprop': return tf.train.rmsprop(config.learningRate);
    default: throw new Error(`Unsupported optimizer: ${(config as { optimizer?: string }).optimizer}`);
  }
}

function normalizeWeightData(weightData: tf.io.WeightData | undefined): ArrayBuffer {
  if (weightData instanceof ArrayBuffer) return weightData.slice(0);
  if (Array.isArray(weightData) && weightData.every(item => item instanceof ArrayBuffer)) {
    const totalBytes = weightData.reduce((sum, item) => sum + item.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    weightData.forEach(item => {
      merged.set(new Uint8Array(item), offset);
      offset += item.byteLength;
    });
    return merged.buffer;
  }
  throw new Error('Trained model artifacts are missing weight data.');
}

function validateModelArtifactsPayload(payload: MlpModelPersistencePayload): void {
  if (!payload || !payload.modelArtifacts) throw new Error('Imported model artifacts are missing.');
  const { modelArtifacts, outputLabels } = payload;
  if (!modelArtifacts.modelTopology || modelArtifacts.modelTopology instanceof ArrayBuffer) {
    throw new Error('Imported model artifacts are missing model topology.');
  }
  if (!Array.isArray(modelArtifacts.weightSpecs) || modelArtifacts.weightSpecs.length === 0) {
    throw new Error('Imported model artifacts are missing weight specs.');
  }
  if (!(modelArtifacts.weightData instanceof ArrayBuffer) || modelArtifacts.weightData.byteLength === 0) {
    throw new Error('Imported model artifacts are missing weight data.');
  }
  if (!Array.isArray(outputLabels) || outputLabels.length < 2 || outputLabels.some(label => typeof label !== 'string' || !label.trim())) {
    throw new Error('Imported model output labels are missing or invalid.');
  }
}

function createModel(inputDimension: number, outputDimension: number, config: MLPConfig): tf.Sequential {
  const model = tf.sequential();
  const hiddenLayerCount = Math.max(0, config.layers);

  if (hiddenLayerCount === 0) {
    model.add(tf.layers.dense({ inputShape: [inputDimension], units: outputDimension, activation: 'softmax', name: 'output' }));
  } else {
    for (let layerIndex = 0; layerIndex < hiddenLayerCount; layerIndex++) {
      const fallbackUnits = config.nodes[config.nodes.length - 1] ?? 16;
      model.add(tf.layers.dense({
        inputShape: layerIndex === 0 ? [inputDimension] : undefined,
        units: config.nodes[layerIndex] ?? fallbackUnits,
        activation: config.activation,
        name: `hidden_${layerIndex + 1}`,
      }));
    }
    model.add(tf.layers.dense({ units: outputDimension, activation: 'softmax', name: 'output' }));
  }

  model.compile({ optimizer: createOptimizer(config), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return model;
}

function validateExplicitValidationRows({
  vectors,
  labels,
  labelMap,
  inputDimension,
}: {
  vectors: number[][] | undefined;
  labels: string[] | undefined;
  labelMap: Record<string, number>;
  inputDimension: number;
}): Array<{ vector: number[]; label: string }> {
  if (!vectors || !labels || vectors.length === 0 || labels.length !== vectors.length) {
    throw new Error('Explicit validation rows must include matching vectors and labels.');
  }
  for (let index = 0; index < vectors.length; index++) {
    const vector = vectors[index];
    const label = labels[index];
    if (!Array.isArray(vector) || vector.length !== inputDimension || !vector.every(Number.isFinite)) {
      throw new Error('Explicit validation vectors must match the training input dimension.');
    }
    if (labelMap[label] === undefined) throw new Error(`Unknown validation label "${label}" is missing from labelMap.`);
  }
  return vectors.map((vector, index) => ({ vector, label: labels[index] }));
}

function summarizeValues(name: string, values: number[]): ActivationLayerSnapshot {
  const finiteValues = values.filter(Number.isFinite);
  const min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  const mean = finiteValues.length > 0 ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : 0;
  return { name, units: values.length, values: [...values], min, max, mean };
}

async function getActivationSnapshot(
  model: tf.LayersModel,
  probeVector: number[],
  epoch?: number,
  songId?: string
): Promise<ActivationSnapshot> {
  const layers: ActivationLayerSnapshot[] = [summarizeValues('Input', probeVector)];
  let currentTensor: tf.Tensor | null = tf.tensor2d([probeVector]);
  try {
    for (const layer of model.layers) {
      const outputTensor = layer.apply(currentTensor) as tf.Tensor | tf.Tensor[];
      if (Array.isArray(outputTensor)) throw new Error('Unexpected multi-output layer in MLP activation snapshot.');
      currentTensor.dispose();
      currentTensor = outputTensor;
      layers.push(summarizeValues(layer.name, Array.from(await currentTensor.data())));
    }
  } finally {
    currentTensor?.dispose();
  }
  return { epoch, songId, layers };
}

async function getModelStateSnapshot(
  model: tf.LayersModel,
  epoch: number,
  phase?: AnnTrainingPhaseKind
): Promise<AnnModelStateSnapshot> {
  const layers: DenseLayerWeightSnapshot[] = [];
  for (let layerIndex = 0; layerIndex < model.layers.length; layerIndex++) {
    const layer = model.layers[layerIndex];
    const tensors = layer.getWeights();
    if (tensors.length === 0) continue;
    const kernel = tensors[0];
    const bias = tensors[1];
    const inputUnits = kernel.shape[0] ?? 0;
    const outputUnits = kernel.shape[1] ?? 0;
    const flatWeights = Array.from(await kernel.data());
    const weights = Array.from({ length: inputUnits }, (_, sourceIndex) => (
      flatWeights.slice(sourceIndex * outputUnits, (sourceIndex + 1) * outputUnits)
    ));
    const biases = bias ? Array.from(await bias.data()) : Array(outputUnits).fill(0);
    let min = 0;
    let max = 0;
    let absoluteTotal = 0;
    if (flatWeights.length > 0) {
      min = flatWeights[0];
      max = flatWeights[0];
      for (const weight of flatWeights) {
        min = Math.min(min, weight);
        max = Math.max(max, weight);
        absoluteTotal += Math.abs(weight);
      }
    }
    layers.push({
      layerName: layer.name,
      sourceLayerName: layerIndex === 0 ? 'Input' : model.layers[layerIndex - 1].name,
      inputUnits,
      outputUnits,
      weights,
      biases,
      min,
      max,
      meanAbsolute: flatWeights.length > 0 ? absoluteTotal / flatWeights.length : 0,
    });
  }
  return { epoch, phase, layers };
}

function getSessionStatus(session: TrainingSession, nextAction: string): AnnTrainingSessionStatus {
  return {
    mode: session.mode,
    completedEpochs: session.completedEpochs,
    targetEpochs: session.targetEpochs,
    batchIndex: session.stepBatchIndex,
    batchCount: session.batchCount,
    nextAction,
  };
}

function getBatch(session: TrainingSession): { vectors: number[][]; labelIndices: number[] } {
  const start = session.stepBatchIndex * session.batchSize;
  const end = Math.min(session.trainVectors.length, start + session.batchSize);
  return {
    vectors: session.trainVectors.slice(start, end),
    labelIndices: session.trainLabelIndices.slice(start, end),
  };
}

async function getPredictionSummary(
  model: tf.LayersModel,
  vector: number[],
  targetIndex: number,
  outputLabels: string[]
): Promise<{ predictedLabel: string; confidence: number; loss: number }> {
  const input = tf.tensor2d([vector]);
  let prediction: tf.Tensor | null = null;
  try {
    prediction = model.predict(input) as tf.Tensor;
    const probabilities = Array.from(await prediction.data());
    let bestIndex = 0;
    probabilities.forEach((value, index) => {
      if (value > (probabilities[bestIndex] ?? Number.NEGATIVE_INFINITY)) bestIndex = index;
    });
    const targetProbability = Math.max(probabilities[targetIndex] ?? Number.EPSILON, Number.EPSILON);
    return {
      predictedLabel: outputLabels[bestIndex] ?? 'Unknown',
      confidence: probabilities[bestIndex] ?? 0,
      loss: -Math.log(targetProbability),
    };
  } finally {
    prediction?.dispose();
    input.dispose();
  }
}

function getMeanAbsoluteWeightDelta(before: AnnModelStateSnapshot, after: AnnModelStateSnapshot): number {
  let total = 0;
  let count = 0;
  after.layers.forEach((layer, layerIndex) => {
    const previousLayer = before.layers[layerIndex];
    layer.weights.forEach((row, sourceIndex) => {
      row.forEach((weight, targetIndex) => {
        total += Math.abs(weight - (previousLayer?.weights[sourceIndex]?.[targetIndex] ?? weight));
        count++;
      });
    });
  });
  return count > 0 ? total / count : 0;
}

export class MlpWorkerController {
  private trainedModel: tf.LayersModel | null = null;
  private outputLabels: string[] = [];
  private trainingSession: TrainingSession | null = null;

  dispose(): void {
    this.trainedModel?.dispose();
    this.trainedModel = null;
    this.outputLabels = [];
    this.trainingSession = null;
  }

  async handleMessage(message: MlpWorkerRecvMessage, postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    const requestId = message.requestId;
    const reply = (replyMessage: MlpWorkerSendMessage) => postMessage(withRequestId(replyMessage, requestId));
    try {
      switch (message.type) {
        case 'reset': this.dispose(); reply({ type: 'mlpResetComplete' }); break;
        case 'train': await this.startTraining(message.payload, reply); break;
        case 'advanceTraining': await this.advanceTraining(reply); break;
        case 'continueTraining': await this.continueTraining(message.payload, reply); break;
        case 'infer': await this.infer(message.payload, reply); break;
        case 'exportModel': await this.exportModel(reply); break;
        case 'importModel': await this.importModel(message.payload, reply); break;
        default: throw new Error(`Unknown message type: ${(message as { type?: string }).type}`);
      }
    } catch (error: unknown) {
      if (message.type === 'train') this.dispose();
      reply({ type: 'mlpError', payload: { error: getErrorMessage(error) } });
    }
  }

  private async startTraining(payload: TrainPayload, postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    this.dispose();
    const {
      vectors, labels, config, labelMap, trainIterations, batchSize, splitRatio, seed,
      activationSampleSongId, validationVectors, validationLabels,
    } = payload;
    if (!config || !labelMap || !trainIterations || !batchSize || !splitRatio) throw new Error('Invalid training parameters.');

    const validation = validateTrainingRows(vectors, labels, labelMap);
    const hasExplicitValidationRows = validationVectors !== undefined || validationLabels !== undefined;
    const { trainPairs, validationPairs } = hasExplicitValidationRows
      ? {
          trainPairs: vectors.map((vector, index) => ({ vector, label: labels[index] })),
          validationPairs: validateExplicitValidationRows({
            vectors: validationVectors,
            labels: validationLabels,
            labelMap,
            inputDimension: validation.inputDimension,
          }),
        }
      : createStratifiedTrainValidationSplit(vectors, labels, labelMap, splitRatio, seed);
    if (trainPairs.length === 0 || validationPairs.length === 0) {
      throw new Error(`Training split produced ${trainPairs.length} train rows and ${validationPairs.length} validation rows.`);
    }

    this.outputLabels = validation.outputLabels;
    this.trainedModel = createModel(validation.inputDimension, validation.numClasses, config);
    this.trainingSession = {
      trainVectors: trainPairs.map(pair => [...pair.vector]),
      trainLabelIndices: trainPairs.map(pair => labelMap[pair.label]),
      validationVectors: validationPairs.map(pair => [...pair.vector]),
      validationLabelIndices: validationPairs.map(pair => labelMap[pair.label]),
      outputLabels: [...validation.outputLabels],
      batchSize,
      batchCount: Math.ceil(trainPairs.length / batchSize),
      completedEpochs: 0,
      targetEpochs: trainIterations,
      mode: payload.executionMode ?? 'automatic',
      activationSampleSongId,
      stepBatchIndex: 0,
      stepPhaseIndex: 0,
      stepActivationSnapshot: null,
    };

    if (this.trainingSession.mode === 'automatic') {
      await this.runAutomatic(postMessage);
      return;
    }

    const activationSnapshot = await getActivationSnapshot(this.trainedModel, this.trainingSession.trainVectors[0], 0, activationSampleSongId);
    const modelStateSnapshot = await getModelStateSnapshot(this.trainedModel, 0);
    postMessage({ type: 'activationSnapshot', payload: activationSnapshot });
    postMessage({ type: 'modelStateSnapshot', payload: modelStateSnapshot });
    postMessage({
      type: 'trainingSessionReady',
      payload: {
        status: getSessionStatus(this.trainingSession, this.trainingSession.mode === 'step' ? 'Advance the input propagation step.' : 'Train the next epoch.'),
        activationSnapshot,
        modelStateSnapshot,
      },
    });
  }

  private async continueTraining(payload: ContinueTrainingPayload, postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    if (!this.trainedModel || !this.trainingSession) throw new Error('No completed local training session is available to continue.');
    if (this.trainingSession.completedEpochs < this.trainingSession.targetEpochs) {
      throw new Error('Finish the active training target before adding more epochs.');
    }
    if (!Number.isInteger(payload.additionalEpochs) || payload.additionalEpochs <= 0) throw new Error('Additional epochs must be a positive integer.');
    this.trainingSession.targetEpochs = this.trainingSession.completedEpochs + payload.additionalEpochs;
    this.trainingSession.mode = payload.executionMode;
    this.trainingSession.stepBatchIndex = 0;
    this.trainingSession.stepPhaseIndex = 0;
    this.trainingSession.stepActivationSnapshot = null;

    if (payload.executionMode === 'automatic') {
      await this.runAutomatic(postMessage);
      return;
    }

    const activationSnapshot = await getActivationSnapshot(
      this.trainedModel,
      this.trainingSession.trainVectors[0],
      this.trainingSession.completedEpochs,
      this.trainingSession.activationSampleSongId
    );
    const modelStateSnapshot = await getModelStateSnapshot(this.trainedModel, this.trainingSession.completedEpochs);
    postMessage({
      type: 'trainingSessionReady',
      payload: {
        status: getSessionStatus(this.trainingSession, payload.executionMode === 'step' ? 'Advance the next internal training phase.' : 'Train the next epoch.'),
        activationSnapshot,
        modelStateSnapshot,
      },
    });
  }

  private async advanceTraining(postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    if (!this.trainedModel || !this.trainingSession) throw new Error('Start an interactive training session before advancing it.');
    if (this.trainingSession.mode === 'automatic') throw new Error('Automatic training cannot be advanced manually.');
    if (this.trainingSession.mode === 'epoch') {
      await this.runEpoch(postMessage);
      return;
    }
    await this.runStep(postMessage);
  }

  private async runAutomatic(postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    if (!this.trainingSession) throw new Error('Training session is missing.');
    while (this.trainingSession.completedEpochs < this.trainingSession.targetEpochs) {
      const completed = await this.runEpoch(postMessage, false);
      if (completed) return;
    }
  }

  private async runEpoch(
    postMessage: (message: MlpWorkerSendMessage) => void,
    pauseWhenIncomplete = true
  ): Promise<boolean> {
    const model = this.trainedModel;
    const session = this.trainingSession;
    if (!model || !session) throw new Error('Training session is missing.');
    const trainXs = tf.tensor2d(session.trainVectors);
    const trainYs = tf.oneHot(session.trainLabelIndices, session.outputLabels.length);
    const validationXs = tf.tensor2d(session.validationVectors);
    const validationYs = tf.oneHot(session.validationLabelIndices, session.outputLabels.length);
    try {
      const history = await model.fit(trainXs, trainYs, {
        epochs: 1,
        batchSize: session.batchSize,
        shuffle: true,
        validationData: [validationXs, validationYs],
        verbose: 0,
      });
      session.completedEpochs++;
      const metrics = {
        loss: Number(history.history.loss?.[0] ?? 0),
        acc: Number((history.history.acc ?? history.history.accuracy)?.[0] ?? 0),
        valLoss: Number(history.history.val_loss?.[0] ?? 0),
        valAcc: Number((history.history.val_acc ?? history.history.val_accuracy)?.[0] ?? 0),
      };
      postMessage({ type: 'epochMetrics', payload: { epoch: session.completedEpochs, metrics } });
      const activationSnapshot = await getActivationSnapshot(model, session.trainVectors[0], session.completedEpochs, session.activationSampleSongId);
      const modelStateSnapshot = await getModelStateSnapshot(model, session.completedEpochs, 'epoch-complete');
      postMessage({ type: 'activationSnapshot', payload: activationSnapshot });
      postMessage({ type: 'modelStateSnapshot', payload: modelStateSnapshot });
      postMessage({
        type: 'trainingPhase',
        payload: {
          phase: 'epoch-complete',
          label: `Epoch ${session.completedEpochs} complete`,
          description: 'Training and validation metrics are updated with the latest model weights.',
          epoch: session.completedEpochs,
          targetEpochs: session.targetEpochs,
          batchIndex: session.batchCount,
          batchCount: session.batchCount,
          direction: 'none',
        },
      });
      if (session.completedEpochs >= session.targetEpochs) {
        await this.completeTraining(postMessage);
        return true;
      }
      if (pauseWhenIncomplete) {
        postMessage({ type: 'trainingPaused', payload: { status: getSessionStatus(session, 'Train the next epoch.') } });
      }
      return false;
    } finally {
      trainXs.dispose();
      trainYs.dispose();
      validationXs.dispose();
      validationYs.dispose();
    }
  }

  private async runStep(postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    const model = this.trainedModel;
    const session = this.trainingSession;
    if (!model || !session) throw new Error('Training session is missing.');
    const layerCount = model.layers.length;
    const inputPhaseIndex = 0;
    const firstForwardIndex = 1;
    const lossPhaseIndex = firstForwardIndex + layerCount;
    const firstBackwardIndex = lossPhaseIndex + 1;
    const updatePhaseIndex = firstBackwardIndex + layerCount;
    const batch = getBatch(session);
    const sampleVector = batch.vectors[0];
    const sampleTargetIndex = batch.labelIndices[0];
    const epoch = session.completedEpochs + 1;
    let phaseSnapshot: AnnTrainingPhaseSnapshot;

    if (session.stepPhaseIndex === inputPhaseIndex) {
      session.stepActivationSnapshot = await getActivationSnapshot(model, sampleVector, epoch, session.activationSampleSongId);
      postMessage({ type: 'activationSnapshot', payload: session.stepActivationSnapshot });
      postMessage({ type: 'modelStateSnapshot', payload: await getModelStateSnapshot(model, session.completedEpochs, 'input') });
      phaseSnapshot = {
        phase: 'input', label: 'Load training batch',
        description: 'The selected batch enters the input layer before forward propagation.',
        epoch, targetEpochs: session.targetEpochs, batchIndex: session.stepBatchIndex + 1, batchCount: session.batchCount,
        activeLayerName: 'Input', direction: 'forward', sampleLabel: session.outputLabels[sampleTargetIndex],
      };
    } else if (session.stepPhaseIndex < lossPhaseIndex) {
      const layer = model.layers[session.stepPhaseIndex - firstForwardIndex];
      phaseSnapshot = {
        phase: 'forward', label: `Activate ${layer.name}`,
        description: `Weighted inputs and bias flow forward through ${layer.name}.`,
        epoch, targetEpochs: session.targetEpochs, batchIndex: session.stepBatchIndex + 1, batchCount: session.batchCount,
        activeLayerName: layer.name, direction: 'forward', sampleLabel: session.outputLabels[sampleTargetIndex],
      };
    } else if (session.stepPhaseIndex === lossPhaseIndex) {
      const prediction = await getPredictionSummary(model, sampleVector, sampleTargetIndex, session.outputLabels);
      phaseSnapshot = {
        phase: 'loss', label: 'Measure prediction loss',
        description: 'The output probabilities are compared with the target label before backpropagation.',
        epoch, targetEpochs: session.targetEpochs, batchIndex: session.stepBatchIndex + 1, batchCount: session.batchCount,
        activeLayerName: model.layers[model.layers.length - 1]?.name,
        direction: 'none', sampleLabel: session.outputLabels[sampleTargetIndex],
        predictedLabel: prediction.predictedLabel, predictionConfidence: prediction.confidence, loss: prediction.loss,
      };
    } else if (session.stepPhaseIndex < updatePhaseIndex) {
      const backwardOffset = session.stepPhaseIndex - firstBackwardIndex;
      const layer = model.layers[layerCount - 1 - backwardOffset];
      phaseSnapshot = {
        phase: 'backward', label: `Backpropagate through ${layer.name}`,
        description: `The loss signal travels backward through ${layer.name}; the optimizer update follows after every layer is visited.`,
        epoch, targetEpochs: session.targetEpochs, batchIndex: session.stepBatchIndex + 1, batchCount: session.batchCount,
        activeLayerName: layer.name, direction: 'backward', sampleLabel: session.outputLabels[sampleTargetIndex],
      };
    } else {
      const before = await getModelStateSnapshot(model, session.completedEpochs, 'update');
      const batchXs = tf.tensor2d(batch.vectors);
      const batchYs = tf.oneHot(batch.labelIndices, session.outputLabels.length);
      try {
        await model.trainOnBatch(batchXs, batchYs);
      } finally {
        batchXs.dispose();
        batchYs.dispose();
      }
      const after = await getModelStateSnapshot(model, session.completedEpochs, 'update');
      const meanAbsoluteWeightDelta = getMeanAbsoluteWeightDelta(before, after);
      const activationSnapshot = await getActivationSnapshot(model, sampleVector, epoch, session.activationSampleSongId);
      postMessage({ type: 'activationSnapshot', payload: activationSnapshot });
      postMessage({ type: 'modelStateSnapshot', payload: after });
      phaseSnapshot = {
        phase: 'update', label: 'Apply optimizer update',
        description: 'The optimizer applies the computed gradients to every connected weight and bias in this batch.',
        epoch, targetEpochs: session.targetEpochs, batchIndex: session.stepBatchIndex + 1, batchCount: session.batchCount,
        direction: 'none', sampleLabel: session.outputLabels[sampleTargetIndex], meanAbsoluteWeightDelta,
      };
      session.stepBatchIndex++;
      session.stepPhaseIndex = 0;
      session.stepActivationSnapshot = null;
      postMessage({ type: 'trainingPhase', payload: phaseSnapshot });

      if (session.stepBatchIndex >= session.batchCount) {
        session.stepBatchIndex = 0;
        session.completedEpochs++;
        const metrics = await this.evaluateMetrics();
        postMessage({ type: 'epochMetrics', payload: { epoch: session.completedEpochs, metrics } });
        if (session.completedEpochs >= session.targetEpochs) {
          await this.completeTraining(postMessage);
          return;
        }
      }
      postMessage({ type: 'trainingPaused', payload: { status: getSessionStatus(session, 'Advance the next internal training phase.'), phaseSnapshot } });
      return;
    }

    session.stepPhaseIndex++;
    postMessage({ type: 'trainingPhase', payload: phaseSnapshot });
    postMessage({ type: 'trainingPaused', payload: { status: getSessionStatus(session, 'Advance the next internal training phase.'), phaseSnapshot } });
  }

  private async evaluateMetrics(): Promise<{ loss: number; acc: number; valLoss: number; valAcc: number }> {
    const model = this.trainedModel;
    const session = this.trainingSession;
    if (!model || !session) throw new Error('Training session is missing.');
    const evaluateRows = async (vectors: number[][], labels: number[]) => {
      const xs = tf.tensor2d(vectors);
      const ys = tf.oneHot(labels, session.outputLabels.length);
      try {
        const result = model.evaluate(xs, ys) as tf.Tensor | tf.Tensor[];
        const tensors = Array.isArray(result) ? result : [result];
        try {
          return {
            loss: (await tensors[0].data())[0] ?? 0,
            accuracy: tensors[1] ? (await tensors[1].data())[0] ?? 0 : 0,
          };
        } finally {
          tensors.forEach(tensor => tensor.dispose());
        }
      } finally {
        xs.dispose();
        ys.dispose();
      }
    };
    const train = await evaluateRows(session.trainVectors, session.trainLabelIndices);
    const validation = await evaluateRows(session.validationVectors, session.validationLabelIndices);
    return { loss: train.loss, acc: train.accuracy, valLoss: validation.loss, valAcc: validation.accuracy };
  }

  private async completeTraining(postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    const model = this.trainedModel;
    const session = this.trainingSession;
    if (!model || !session) throw new Error('Training session is missing.');
    const metrics = await this.evaluateMetrics();
    const activationSnapshot = await getActivationSnapshot(model, session.trainVectors[0], session.completedEpochs, session.activationSampleSongId);
    const modelStateSnapshot = await getModelStateSnapshot(model, session.completedEpochs, 'epoch-complete');
    postMessage({
      type: 'trainingComplete',
      payload: {
        finalMetrics: { loss: metrics.valLoss, accuracy: metrics.valAcc },
        activationSnapshot,
        modelStateSnapshot,
        status: getSessionStatus(session, 'Training target reached. Continue with more epochs or run inference.'),
      },
    });
  }

  private async infer(payload: InferPayload, postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    if (!this.trainedModel) throw new Error('Model not trained yet. Train the model before running inference.');
    const { vectors, songIds } = payload;
    if (!vectors || vectors.length === 0 || !songIds || songIds.length !== vectors.length) {
      throw new Error('Invalid inference data: vectors or songIds are missing or mismatched.');
    }
    if (!this.outputLabels.length) throw new Error('Output label mapping is missing from the trained model context.');
    const inputDimension = vectors[0]?.length ?? 0;
    if (inputDimension <= 0 || !vectors.every(vector => vector.length === inputDimension && vector.every(Number.isFinite))) {
      throw new Error('Inference vectors must be finite and share one non-empty dimension.');
    }
    const inferTensor = tf.tensor2d(vectors);
    let predictions: tf.Tensor | null = null;
    try {
      predictions = this.trainedModel.predict(inferTensor) as tf.Tensor;
      const probabilities = await predictions.array() as number[][];
      const results: Record<string, { predictedLabel: string; confidence: number }> = {};
      probabilities.forEach((row, index) => {
        let bestIndex = 0;
        row.forEach((confidence, candidateIndex) => {
          if (confidence > (row[bestIndex] ?? Number.NEGATIVE_INFINITY)) bestIndex = candidateIndex;
        });
        results[songIds[index]] = { predictedLabel: this.outputLabels[bestIndex] ?? 'Unknown', confidence: row[bestIndex] ?? 0 };
      });
      postMessage({ type: 'activationSnapshot', payload: await getActivationSnapshot(this.trainedModel, vectors[0], undefined, songIds[0]) });
      postMessage({ type: 'modelStateSnapshot', payload: await getModelStateSnapshot(this.trainedModel, this.trainingSession?.completedEpochs ?? 0) });
      postMessage({ type: 'inferenceComplete', payload: { results } });
    } finally {
      predictions?.dispose();
      inferTensor.dispose();
    }
  }

  private async exportModel(postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    if (!this.trainedModel) throw new Error('Model not trained yet. Train the model before exporting it.');
    if (!this.outputLabels.length) throw new Error('Output label mapping is missing from the trained model context.');
    let savedArtifacts: tf.io.ModelArtifacts | null = null;
    await this.trainedModel.save(tf.io.withSaveHandler(async artifacts => {
      savedArtifacts = artifacts;
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(), modelTopologyType: 'JSON',
          modelTopologyBytes: artifacts.modelTopology ? JSON.stringify(artifacts.modelTopology).length : 0,
          weightSpecsBytes: artifacts.weightSpecs ? JSON.stringify(artifacts.weightSpecs).length : 0,
          weightDataBytes: normalizeWeightData(artifacts.weightData).byteLength,
        },
      };
    }));
    const artifacts = savedArtifacts as tf.io.ModelArtifacts | null;
    if (!artifacts || !artifacts.modelTopology || artifacts.modelTopology instanceof ArrayBuffer) throw new Error('Trained model artifacts are missing model topology.');
    if (!Array.isArray(artifacts.weightSpecs) || artifacts.weightSpecs.length === 0) throw new Error('Trained model artifacts are missing weight specs.');
    postMessage({
      type: 'modelExportComplete',
      payload: {
        modelArtifacts: {
          modelTopology: artifacts.modelTopology,
          weightSpecs: artifacts.weightSpecs,
          weightData: normalizeWeightData(artifacts.weightData),
          format: artifacts.format,
          generatedBy: artifacts.generatedBy,
          convertedBy: artifacts.convertedBy,
        },
        outputLabels: [...this.outputLabels],
      },
    });
  }

  private async importModel(payload: MlpModelPersistencePayload, postMessage: (message: MlpWorkerSendMessage) => void): Promise<void> {
    validateModelArtifactsPayload(payload);
    const nextModel = await tf.loadLayersModel(tf.io.fromMemory({
      modelTopology: payload.modelArtifacts.modelTopology,
      weightSpecs: payload.modelArtifacts.weightSpecs,
      weightData: payload.modelArtifacts.weightData,
      format: payload.modelArtifacts.format,
      generatedBy: payload.modelArtifacts.generatedBy,
      convertedBy: payload.modelArtifacts.convertedBy,
    }));
    this.dispose();
    this.trainedModel = nextModel;
    this.outputLabels = [...payload.outputLabels];
    postMessage({
      type: 'modelImportComplete',
      payload: {
        outputLabels: [...this.outputLabels],
        modelStateSnapshot: await getModelStateSnapshot(nextModel, 0),
      },
    });
  }
}
