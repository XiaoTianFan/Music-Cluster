import * as tf from '@tensorflow/tfjs';
import { createStratifiedTrainValidationSplit, validateTrainingRows } from './mlpTraining';

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
}

export interface InferPayload {
  vectors: number[][];
  songIds: string[];
  labelMap?: Record<string, number>;
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

type WithRequestId<T> = T & { requestId?: string };

export type MlpWorkerRecvMessage = WithRequestId<
  | { type: 'reset'; payload?: unknown }
  | { type: 'train'; payload: TrainPayload }
  | { type: 'infer'; payload: InferPayload }
  | { type: 'exportModel'; payload?: unknown }
  | { type: 'importModel'; payload: MlpModelPersistencePayload }
>;

export type MlpWorkerSendMessage = WithRequestId<
  | { type: 'mlpWorkerReady' }
  | { type: 'mlpResetComplete' }
  | { type: 'epochMetrics'; payload: { epoch: number; metrics: { loss: number; acc: number; valLoss: number; valAcc: number } } }
  | { type: 'activationSnapshot'; payload: ActivationSnapshot }
  | { type: 'trainingComplete'; payload: { finalMetrics: { loss: number; accuracy: number }; activationSnapshot: ActivationSnapshot } }
  | { type: 'inferenceComplete'; payload: { results: Record<string, { predictedLabel: string; confidence: number }> } }
  | { type: 'modelExportComplete'; payload: MlpModelPersistencePayload }
  | { type: 'modelImportComplete'; payload: { outputLabels: string[] } }
  | { type: 'mlpError'; payload: { error: string } }
>;

const activationValueLimit = 64;

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
  if (!payload || !payload.modelArtifacts) {
    throw new Error('Imported model artifacts are missing.');
  }
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
    model.add(tf.layers.dense({
      inputShape: [inputDimension],
      units: outputDimension,
      activation: 'softmax',
      name: 'output',
    }));
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
    model.add(tf.layers.dense({
      units: outputDimension,
      activation: 'softmax',
      name: 'output',
    }));
  }

  model.compile({
    optimizer: createOptimizer(config),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
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
    if (labelMap[label] === undefined) {
      throw new Error(`Unknown validation label "${label}" is missing from labelMap.`);
    }
  }

  return vectors.map((vector, index) => ({ vector, label: labels[index] }));
}

function summarizeValues(name: string, values: number[]): ActivationLayerSnapshot {
  const finiteValues = values.filter(Number.isFinite);
  const min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  const mean = finiteValues.length > 0
    ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
    : 0;
  return {
    name,
    units: values.length,
    values: values.slice(0, activationValueLimit),
    min,
    max,
    mean,
  };
}

async function getActivationSnapshot(model: tf.LayersModel, probeVector: number[], epoch?: number, songId?: string): Promise<ActivationSnapshot> {
  const layers: ActivationLayerSnapshot[] = [summarizeValues('Input', probeVector)];
  let currentTensor: tf.Tensor | null = tf.tensor2d([probeVector]);

  try {
    for (const layer of model.layers) {
      const outputTensor = layer.apply(currentTensor) as tf.Tensor | tf.Tensor[];
      if (Array.isArray(outputTensor)) {
        throw new Error('Unexpected multi-output layer in MLP activation snapshot.');
      }
      currentTensor.dispose();
      currentTensor = outputTensor;
      const values = Array.from(await currentTensor.data());
      layers.push(summarizeValues(layer.name, values));
    }
  } finally {
    currentTensor?.dispose();
  }

  return { epoch, songId, layers };
}

export class MlpWorkerController {
  private trainedModel: tf.LayersModel | null = null;
  private outputLabels: string[] = [];

  dispose(): void {
    if (this.trainedModel) {
      this.trainedModel.dispose();
      this.trainedModel = null;
    }
    this.outputLabels = [];
  }

  async handleMessage(
    message: MlpWorkerRecvMessage,
    postMessage: (message: MlpWorkerSendMessage) => void
  ): Promise<void> {
    const requestId = message.requestId;
    const reply = (replyMessage: MlpWorkerSendMessage) => {
      postMessage(withRequestId(replyMessage, requestId));
    };

    try {
      switch (message.type) {
        case 'reset':
          this.dispose();
          reply({ type: 'mlpResetComplete' });
          break;
        case 'train':
          await this.train(message.payload, reply);
          break;
        case 'infer':
          await this.infer(message.payload, reply);
          break;
        case 'exportModel':
          await this.exportModel(reply);
          break;
        case 'importModel':
          await this.importModel(message.payload, reply);
          break;
        default:
          throw new Error(`Unknown message type: ${(message as { type?: string }).type}`);
      }
    } catch (error: unknown) {
      if (message.type === 'train') this.dispose();
      reply({ type: 'mlpError', payload: { error: getErrorMessage(error) } });
    }
  }

  private async train(
    payload: TrainPayload,
    postMessage: (message: MlpWorkerSendMessage) => void
  ): Promise<void> {
    this.dispose();

    const {
      vectors,
      labels,
      config,
      labelMap,
      trainIterations,
      batchSize,
      splitRatio,
      seed,
      activationSampleSongId,
      validationVectors,
      validationLabels,
    } = payload;

    if (!config || !labelMap || !trainIterations || !batchSize || !splitRatio) {
      throw new Error('Invalid training parameters.');
    }

    const validation = validateTrainingRows(vectors, labels, labelMap);
    const hasExplicitValidationRows = validationVectors !== undefined || validationLabels !== undefined;
    const { trainPairs, validationPairs: testPairs } = hasExplicitValidationRows
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
    const { inputDimension, numClasses } = validation;
    this.outputLabels = validation.outputLabels;

    if (trainPairs.length === 0 || testPairs.length === 0) {
      throw new Error(`Training split produced ${trainPairs.length} train rows and ${testPairs.length} validation rows.`);
    }

    const trainTensors = tf.tensor2d(trainPairs.map(pair => pair.vector));
    const testTensors = tf.tensor2d(testPairs.map(pair => pair.vector));
    const trainLabels = tf.oneHot(trainPairs.map(pair => labelMap[pair.label]), numClasses);
    const testLabels = tf.oneHot(testPairs.map(pair => labelMap[pair.label]), numClasses);
    const model = createModel(inputDimension, numClasses, config);
    const probeVector = trainPairs[0].vector;

    try {
      for (let epoch = 0; epoch < trainIterations; epoch++) {
        const history = await model.fit(trainTensors, trainLabels, {
          epochs: 1,
          batchSize,
          shuffle: true,
          validationData: [testTensors, testLabels],
          verbose: 0,
        });
        const loss = Number(history.history.loss?.[0] ?? 0);
        const acc = Number((history.history.acc ?? history.history.accuracy)?.[0] ?? 0);
        const valLoss = Number(history.history.val_loss?.[0] ?? 0);
        const valAcc = Number((history.history.val_acc ?? history.history.val_accuracy)?.[0] ?? 0);

        postMessage({
          type: 'epochMetrics',
          payload: {
            epoch: epoch + 1,
            metrics: { loss, acc, valLoss, valAcc },
          },
        });

        postMessage({
          type: 'activationSnapshot',
          payload: await getActivationSnapshot(model, probeVector, epoch + 1, activationSampleSongId),
        });
      }

      const evalResult = model.evaluate(testTensors, testLabels) as tf.Tensor | tf.Tensor[];
      const evalTensors = Array.isArray(evalResult) ? evalResult : [evalResult];
      const testLoss = (await evalTensors[0].data())[0] ?? 0;
      const testAcc = evalTensors[1] ? (await evalTensors[1].data())[0] ?? 0 : 0;
      evalTensors.forEach(tensor => tensor.dispose());

      this.trainedModel = model;
      postMessage({
        type: 'trainingComplete',
        payload: {
          finalMetrics: { loss: testLoss, accuracy: testAcc },
          activationSnapshot: await getActivationSnapshot(model, probeVector, trainIterations, activationSampleSongId),
        },
      });
    } catch (error) {
      model.dispose();
      throw error;
    } finally {
      trainTensors.dispose();
      testTensors.dispose();
      trainLabels.dispose();
      testLabels.dispose();
    }
  }

  private async infer(
    payload: InferPayload,
    postMessage: (message: MlpWorkerSendMessage) => void
  ): Promise<void> {
    if (!this.trainedModel) {
      throw new Error('Model not trained yet. Train the model before running inference.');
    }
    const { vectors, songIds } = payload;
    if (!vectors || vectors.length === 0 || !songIds || songIds.length !== vectors.length) {
      throw new Error('Invalid inference data: vectors or songIds are missing or mismatched.');
    }
    if (!this.outputLabels.length) {
      throw new Error('Output label mapping is missing from the trained model context.');
    }

    const inputDimension = vectors[0]?.length ?? 0;
    if (inputDimension <= 0 || !vectors.every(vector => vector.length === inputDimension && vector.every(Number.isFinite))) {
      throw new Error('Inference vectors must be finite and share one non-empty dimension.');
    }

    const inferTensor = tf.tensor2d(vectors);
    try {
      const predictions = this.trainedModel.predict(inferTensor) as tf.Tensor;
      const probabilities = await predictions.array() as number[][];
      const results: Record<string, { predictedLabel: string; confidence: number }> = {};

      probabilities.forEach((row, index) => {
        let bestIndex = 0;
        let bestConfidence = row[0] ?? 0;
        row.forEach((confidence, candidateIndex) => {
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIndex = candidateIndex;
          }
        });
        results[songIds[index]] = {
          predictedLabel: this.outputLabels[bestIndex] ?? 'Unknown',
          confidence: bestConfidence,
        };
      });

      postMessage({
        type: 'activationSnapshot',
        payload: await getActivationSnapshot(this.trainedModel, vectors[0], undefined, songIds[0]),
      });
      postMessage({ type: 'inferenceComplete', payload: { results } });
      predictions.dispose();
    } finally {
      inferTensor.dispose();
    }
  }

  private async exportModel(
    postMessage: (message: MlpWorkerSendMessage) => void
  ): Promise<void> {
    if (!this.trainedModel) {
      throw new Error('Model not trained yet. Train the model before exporting it.');
    }
    if (!this.outputLabels.length) {
      throw new Error('Output label mapping is missing from the trained model context.');
    }

    let savedArtifacts: tf.io.ModelArtifacts | null = null;
    await this.trainedModel.save(tf.io.withSaveHandler(async artifacts => {
      savedArtifacts = artifacts;
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          modelTopologyBytes: artifacts.modelTopology ? JSON.stringify(artifacts.modelTopology).length : 0,
          weightSpecsBytes: artifacts.weightSpecs ? JSON.stringify(artifacts.weightSpecs).length : 0,
          weightDataBytes: normalizeWeightData(artifacts.weightData).byteLength,
        },
      };
    }));

    const artifacts = savedArtifacts as tf.io.ModelArtifacts | null;
    if (!artifacts || !artifacts.modelTopology || artifacts.modelTopology instanceof ArrayBuffer) {
      throw new Error('Trained model artifacts are missing model topology.');
    }
    if (!Array.isArray(artifacts.weightSpecs) || artifacts.weightSpecs.length === 0) {
      throw new Error('Trained model artifacts are missing weight specs.');
    }

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

  private async importModel(
    payload: MlpModelPersistencePayload,
    postMessage: (message: MlpWorkerSendMessage) => void
  ): Promise<void> {
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
      payload: { outputLabels: [...this.outputLabels] },
    });
  }
}
