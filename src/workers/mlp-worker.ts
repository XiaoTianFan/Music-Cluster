// src/workers/mlp-worker.ts

// Define types for clarity (consider moving to a shared types file later)
interface MLPConfig {
    layers: number;
    nodes: number;
    activation: 'relu' | 'sigmoid' | 'tanh'; // Add more as needed
    optimizer: 'adam' | 'sgd' | 'rmsprop'; // Add more as needed
    learningRate: number;
    // epochs: number; // Handled by trainIterations
    // targetLoss: number; // Optional, handle in training loop if needed
    // splitRatio: number; // Handled separately
    // seed: number; // Handled separately
}

interface Point { x: number; y: number; }
interface EpochMetrics {
    epoch: number;
    metrics: { loss: number; acc: number };
}

interface TrainPayload {
    vectors: number[][];
    labels: string[]; // String labels corresponding to vectors
    config: MLPConfig;
    labelMap: Record<string, number>; // Maps string label to numerical index
    trainIterations: number;
    batchSize: number;
    splitRatio: number; // e.g., 0.8 for 80% training
    seed: number;
}

interface InferPayload {
    vectors: number[][];
    songIds: string[];
    labelMap: Record<string, number>; // Needed to decode output
}

// Make TypeScript happy about the global worker scope
declare const self: DedicatedWorkerGlobalScope;

import * as tf from '@tensorflow/tfjs';

console.log('MLP Worker: Script loaded');

// Store the trained model and label mapping info within the worker's scope
let trainedModel: tf.Sequential | null = null;
let outputLabels: string[] = []; // Store the order of labels for decoding predictions

// Helper function to shuffle two arrays in unison
function shuffleArraysInUnison<T, U>(arr1: T[], arr2: U[], seed?: number): void {
    // Simple Fisher-Yates shuffle - consider a seeded PRNG if strict reproducibility needed
    // For simplicity here, we'll use Math.random, but tf.data.Dataset.shuffle is better if using tf.data
    for (let i = arr1.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr1[i], arr1[j]] = [arr1[j], arr1[i]];
        [arr2[i], arr2[j]] = [arr2[j], arr2[i]];
    }
}

self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    console.log(`MLP Worker: Received message type: ${type}`);

    try {
        switch (type) {
            case 'train':
                trainedModel = null; // Clear previous model
                outputLabels = [];   // Clear previous labels
                console.log('MLP Worker: Received train command with payload:', payload);
                const {
                    vectors,
                    labels,
                    config,
                    labelMap,
                    trainIterations,
                    batchSize,
                    splitRatio,
                    seed // Note: Simple Math.random shuffle used below, seed not directly applied yet
                }: TrainPayload = payload;

                if (!vectors || vectors.length === 0 || !labels || labels.length !== vectors.length) {
                    throw new Error('Invalid input data: vectors or labels are missing or mismatched.');
                }
                if (!config || !labelMap || !trainIterations || !batchSize || !splitRatio) {
                    throw new Error('Invalid training parameters.');
                }

                const numClasses = Object.keys(labelMap).length;
                if (numClasses < 2) {
                    throw new Error('Need at least two distinct labels for classification.');
                }
                outputLabels = Object.keys(labelMap).sort((a, b) => labelMap[a] - labelMap[b]); // Store labels in index order

                tf.tidy(() => { // Wrap tensor operations for automatic disposal
                    // 1. Shuffle data (important!)
                    // Consider using tf.data.Dataset for more robust shuffling/batching if data gets large
                    const indices = Array.from(vectors.keys());
                    shuffleArraysInUnison(indices, labels, seed); // Shuffle indices and labels together
                    const shuffledVectors = indices.map(i => vectors[i]);
                    const shuffledLabels = labels; // Already shuffled in place by the helper

                    // 2. Split data
                    const numTrainExamples = Math.round(shuffledVectors.length * splitRatio);
                    const numTestExamples = shuffledVectors.length - numTrainExamples;

                    const trainVectors = shuffledVectors.slice(0, numTrainExamples);
                    const testVectors = shuffledVectors.slice(numTrainExamples);
                    const trainLabelsRaw = shuffledLabels.slice(0, numTrainExamples);
                    const testLabelsRaw = shuffledLabels.slice(numTestExamples);

                    if (trainVectors.length === 0 || testVectors.length === 0) {
                        throw new Error(`Training (count: ${trainVectors.length}) or testing (count: ${testVectors.length}) set is empty after split. Adjust split ratio or increase data.`);
                    }

                    // 3. One-hot encode labels
                    const trainLabels = tf.oneHot(trainLabelsRaw.map(l => labelMap[l]), numClasses);
                    const testLabels = tf.oneHot(testLabelsRaw.map(l => labelMap[l]), numClasses);

                    // 4. Convert vectors to tensors
                    const trainTensors = tf.tensor2d(trainVectors);
                    const testTensors = tf.tensor2d(testVectors);

                    // 5. Build tf.sequential model
                    const model = tf.sequential();
                    const inputShape: [number] = [trainVectors[0].length];

                    // Input Layer (implicitly defined by the first dense layer's inputShape)
                    // Hidden Layers
                    for (let i = 0; i < config.layers; i++) {
                        model.add(tf.layers.dense({
                            inputShape: i === 0 ? inputShape : undefined, // Only specify for the first layer
                            units: config.nodes,
                            activation: config.activation,
                        }));
                    }
                    // Output Layer
                    model.add(tf.layers.dense({
                        units: numClasses,
                        activation: 'softmax' // For multi-class classification
                    }));

                    // 6. Compile model
                    let optimizerInstance: tf.Optimizer;
                    switch (config.optimizer) {
                        case 'adam': optimizerInstance = tf.train.adam(config.learningRate); break;
                        case 'sgd': optimizerInstance = tf.train.sgd(config.learningRate); break;
                        case 'rmsprop': optimizerInstance = tf.train.rmsprop(config.learningRate); break;
                        default: throw new Error(`Unsupported optimizer: ${config.optimizer}`);
                    }

                    model.compile({
                        optimizer: optimizerInstance,
                        loss: 'categoricalCrossentropy',
                        metrics: ['accuracy'],
                    });

                    console.log('MLP Worker: Model built and compiled. Summary:');
                    model.summary();

                    // 7. Train model
                    console.log(`MLP Worker: Starting training for ${trainIterations} iterations...`);
                    const history = model.fit(trainTensors, trainLabels, {
                        epochs: trainIterations,
                        batchSize: batchSize,
                        validationData: [testTensors, testLabels],
                        callbacks: {
                            onEpochEnd: (epoch, logs) => {
                                if (logs) {
                                    console.log(`Epoch ${epoch + 1}/${trainIterations} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc?.toFixed(4)}, val_loss: ${logs.val_loss?.toFixed(4)}, val_acc: ${logs.val_acc?.toFixed(4)}`);
                                    const epochMetrics: EpochMetrics = {
                                        epoch: epoch + 1,
                                        metrics: {
                                            loss: logs.loss,
                                            acc: logs.acc ?? 0 // Handle potential undefined acc
                                        }
                                    };
                                    // 8. Post metrics back
                                    self.postMessage({ type: 'epochMetrics', payload: epochMetrics });
                                }
                            }
                        }
                    }); // Don't await here if you want the worker to be responsive

                    // Wait for training to actually finish before storing the model and sending completion message
                    history.then(async (result) => {
                         console.log('MLP Worker: Training finished.');
                         // 9. Store the trained model
                         // Detach the model from the current tf.tidy scope if keeping it long-term
                         // However, tfjs manages model weights separately, so direct storage might be okay.
                         // For safety, let's serialize and deserialize, or manage scopes carefully.
                         // Simplest approach: just assign it. Ensure no other tidy block disposes it unintentionally.
                         trainedModel = model; // Store reference
                         console.log("MLP Worker: Trained model stored.");

                         // Optional: Evaluate final performance on test set
                         const evalResult = model.evaluate(testTensors, testLabels) as tf.Scalar[];
                         const testLoss = await evalResult[0].data();
                         const testAcc = await evalResult[1].data();
                         console.log(`MLP Worker: Final Test Set Performance - Loss: ${testLoss[0].toFixed(4)}, Accuracy: ${testAcc[0].toFixed(4)}`);


                         // 10. Post completion message
                         self.postMessage({ type: 'trainingComplete', payload: { finalMetrics: { loss: testLoss[0], accuracy: testAcc[0] } } });

                     }).catch(err => {
                        console.error("MLP Worker: Error during model.fit finalization:", err);
                        self.postMessage({ type: 'mlpError', payload: { error: `Training finalization failed: ${err.message}` } });
                     });


                }); // End tf.tidy() for training setup tensors

                // Note: The 'trainedModel' (tf.Sequential instance) itself is NOT disposed by the tidy block.
                // We need to manage its lifecycle separately or ensure it's used before the worker terminates.

                break; // End of 'train' case

            case 'infer':
                console.log('MLP Worker: Received infer command with payload:', payload);
                const { vectors: inferVectors, songIds, labelMap: inferLabelMap }: InferPayload = payload;

                if (!trainedModel) {
                    throw new Error('Model not trained yet. Train the model before running inference.');
                }
                if (!inferVectors || inferVectors.length === 0 || !songIds || songIds.length !== inferVectors.length) {
                    throw new Error('Invalid inference data: vectors or songIds are missing or mismatched.');
                }
                 if (!outputLabels || outputLabels.length === 0) {
                     throw new Error('Output label mapping is missing from the trained model context.');
                 }


                const results: Record<string, string> = {};

                tf.tidy(() => { // Tidy scope for inference tensors
                    // 2. Convert vectors to tensor
                    const inferTensor = tf.tensor2d(inferVectors);

                    // 3. Use trainedModel.predict()
                    console.log('MLP Worker: Running inference...');
                    const predictions = trainedModel!.predict(inferTensor) as tf.Tensor; // Type assertion safe due to check above

                    // 4. Process predictions (argMax)
                    const predictedIndices = predictions.argMax(1).dataSync(); // Get indices synchronously

                    // 5. Convert indices back to labels
                    predictedIndices.forEach((index, i) => {
                        const songId = songIds[i];
                        const predictedLabel = outputLabels[index]; // Use the stored label order
                        results[songId] = predictedLabel;
                    });

                    console.log('MLP Worker: Inference completed.');
                }); // End tf.tidy() for inference

                // 6. postMessage results
                self.postMessage({ type: 'inferenceComplete', payload: { results } });

                break; // End of 'infer' case

            default:
                console.warn(`MLP Worker: Unknown message type: ${type}`);
                self.postMessage({ type: 'mlpError', payload: { error: `Unknown message type: ${type}` } });
        }
    } catch (error: any) {
        console.error('MLP Worker Error:', error);
        // Ensure stack trace is included if available
        const errorMessage = error instanceof Error ? `${error.message} (Stack: ${error.stack})` : String(error);
        self.postMessage({ type: 'mlpError', payload: { error: errorMessage } });
        // If training failed, ensure the model reference is cleared
        if (type === 'train') {
            trainedModel = null;
            outputLabels = [];
        }
    }
};

// Optional: Signal readiness
self.postMessage({ type: 'mlpWorkerReady' });
console.log('MLP Worker: Ready and listening for messages.'); 