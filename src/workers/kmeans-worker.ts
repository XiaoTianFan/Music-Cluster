// songcluster/src/workers/kmeans-worker.ts
import * as KMeans from 'tf-kmeans';
import * as tf from '@tensorflow/tfjs';

console.log('[KMeans Worker] Loading TensorFlow.js backend...');
// It might be beneficial to explicitly set a backend, e.g., WASM
// tf.setBackend('wasm').then(() => console.log('[KMeans Worker] WASM backend set.'));
// Default is webgl -> cpu
tf.ready().then(() => {
    console.log(`[KMeans Worker] TensorFlow.js backend: ${tf.getBackend()}`);
});

// --- Interfaces for Worker Communication ---
interface StartTrainingPayload {
    reducedData: number[][];
    songIds: string[];
    k: number;
    maxIter?: number;
}

interface KMeansIterationUpdatePayload {
    iteration: number;
    centroids: number[][];
    assignments: number[]; // Index corresponds to songIds order
    songIds: string[]; // Pass back for easier mapping on main thread
}

interface KMeansCompletePayload {
    finalCentroids: number[][];
    finalAssignments: number[];
    songIds: string[];
}

interface KMeansErrorPayload {
    error: string;
}

type WorkerMessageData =
    | { type: 'startTraining', payload: StartTrainingPayload };

// --- Main Message Handler ---
self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
    console.log('[KMeans Worker] Received message:', event.data.type);
    const { type, payload } = event.data;

    if (type === 'startTraining') {
        const { reducedData, songIds, k, maxIter = 30 } = payload;

        // --- Input Validation ---
        if (!reducedData || reducedData.length === 0 || !reducedData[0] || reducedData[0].length === 0) {
            self.postMessage({ type: 'kmeansError', payload: { error: 'Received empty or invalid reduced data.' } });
            return;
        }
        if (reducedData.length !== songIds.length) {
            self.postMessage({ type: 'kmeansError', payload: { error: 'Mismatch between number of data points and song IDs.' } });
            return;
        }
        if (reducedData.length < k) {
            self.postMessage({ type: 'kmeansError', payload: { error: `Insufficient data points (${reducedData.length}) for k=${k} clusters.` } });
            return;
        }
        if (k <= 0) {
            self.postMessage({ type: 'kmeansError', payload: { error: `Invalid k value: ${k}. Must be > 0.` } });
            return;
        }

        // --- Start K-Means Training ---
        try {
            console.log(`[KMeans Worker] Starting training with k=${k}, maxIter=${maxIter}. Data points: ${reducedData.length}`);
            const datasetTensor = tf.tensor2d(reducedData);

            const kmeans = new KMeans.default({
                k: k,
                maxIter: maxIter,
                distanceFunction: KMeans.default.EuclideanDistance
                // No random seed setting available in this library apparently
            });

            // Async training with iteration callback
            const finalAssignmentsTensor = await kmeans.TrainAsync(
                datasetTensor,
                // Iteration Callback
                async (iter: number, centroids: tf.Tensor, assignments: tf.Tensor) => {
                    // Convert tensors to arrays for posting
                    const centroidsArray = await centroids.array() as number[][];
                    const assignmentsArray = await assignments.array() as number[];

                    // Post update to main thread
                    self.postMessage({
                        type: 'kmeansIterationUpdate',
                        payload: {
                            iteration: iter,
                            centroids: centroidsArray,
                            assignments: assignmentsArray,
                            songIds: songIds // Pass back IDs for mapping
                        }
                    });
                    console.log(`[KMeans Worker] Completed iteration ${iter}`);
                     // Yield control briefly to allow other tasks (like message posting)
                    await tf.nextFrame();
                }
            );

            // --- Training Complete ---
            const finalCentroidsTensor = kmeans.Centroids();
            const finalCentroidsArray = await finalCentroidsTensor.array() as number[][];
            const finalAssignmentsArray = await finalAssignmentsTensor.array() as number[];

            console.log('[KMeans Worker] Training complete.');
            self.postMessage({
                type: 'kmeansComplete',
                payload: {
                    finalCentroids: finalCentroidsArray,
                    finalAssignments: finalAssignmentsArray,
                    songIds: songIds
                }
            });

            // Dispose tensors to free memory
            datasetTensor.dispose();
            finalAssignmentsTensor.dispose();
            finalCentroidsTensor.dispose();

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            console.error('[KMeans Worker] Error during K-Means training:', error);
            self.postMessage({ type: 'kmeansError', payload: { error: errorMessage } });
        } finally {
             // Clean up potentially remaining tensors in case of intermediate error?
             // tf.disposeVariables(); // Use cautiously, might affect tf state if worker is reused
             console.log(`[KMeans Worker] TensorFlow memory: ${JSON.stringify(tf.memory())}`);
        }
    } else {
        console.warn('[KMeans Worker] Received unknown message type:', type);
    }
};

// --- Generic Error Handler ---
self.onerror = (error) => {
    // This catches errors happening outside the onmessage handler's try/catch
    const errorMessage = (error instanceof Error) ? error.message : (typeof error === 'string' ? error : 'Unknown worker error');
    console.error('[KMeans Worker] Unhandled error:', error);
    self.postMessage({ type: 'kmeansError', payload: { error: `Unhandled worker error: ${errorMessage}` } });
};

console.log('[KMeans Worker] Worker setup complete. Waiting for messages...');
