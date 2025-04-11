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

    // Log the entire received payload
    console.log('[KMeans Worker] Full payload received:', JSON.stringify(payload));

    if (type === 'startTraining') {
        const { reducedData, songIds, k, maxIter = 30 } = payload as StartTrainingPayload; // Cast needed after logging

        // --- Input Validation ---
        if (!reducedData || reducedData.length === 0 || !reducedData[0] || reducedData[0].length === 0) {
            self.postMessage({ type: 'kmeansError', payload: { error: 'Received empty or invalid reduced data format (expected array of objects with numeric keys).' } });
            return;
        }
        // Add a check to ensure the elements are objects, not arrays already
        if (Array.isArray(reducedData[0])) {
             console.warn('[KMeans Worker] Received data appears to already be in array format. Proceeding, but check upstream source.');
             // If it's already number[][], direct flattening might work, but the conversion below is safer
        } else if (typeof reducedData[0] !== 'object' || reducedData[0] === null) {
            self.postMessage({ type: 'kmeansError', payload: { error: 'Received data elements are not objects.' } });
            return;
        }

        // --- Convert Array of Objects to number[][] ---
        console.log('[KMeans Worker] Converting received array of objects to number[][]...');
        let formattedReducedData: number[][];
        try {
            formattedReducedData = reducedData.map(obj => 
                Object.values(obj) // Assumes keys '0', '1', ... are in correct order
            );
            // Optional: Add check for consistent inner array lengths here if needed
        } catch (conversionError) {
            console.error('[KMeans Worker] Error converting object array to number[][]:', conversionError);
            self.postMessage({ type: 'kmeansError', payload: { error: 'Failed to convert received data format.' } });
            return;
        }
        console.log('[KMeans Worker] Conversion complete. Data format now number[][].');
        // ---------------------------------------------

        // --- Start K-Means Training ---
        try {
            console.log(`[KMeans Worker] Starting training with k=${k}, maxIter=${maxIter}. Data points: ${formattedReducedData.length}`);
            
            // Use the *formatted* data for logging and shape calculation
            console.log('[KMeans Worker] Formatted Data (first 5 rows):', JSON.stringify(formattedReducedData.slice(0, 5)));
            console.log('[KMeans Worker] Typeof formattedReducedData:', typeof formattedReducedData);
            console.log('[KMeans Worker] Is formattedReducedData an array? ', Array.isArray(formattedReducedData));
            if (formattedReducedData.length > 0) {
                console.log('[KMeans Worker] Is formattedReducedData[0] an array? ', Array.isArray(formattedReducedData[0]));
                console.log('[KMeans Worker] Inferred shape:', `[${formattedReducedData.length}, ${formattedReducedData[0]?.length}]`);
            }
            
            // Calculate shape explicitly using the *formatted* data
            const numRows = formattedReducedData.length;
            const numCols = formattedReducedData[0].length; // Now this should work correctly
            const shape: [number, number] = [numRows, numCols];

            // --- Explicitly flatten the *formatted* array --- 
            const flatData = formattedReducedData.flat();

            // Log the length of the flat array to verify it matches rows * cols
            console.log(`[KMeans Worker] Data *after* flattening (first 10 elements):`, JSON.stringify(flatData.slice(0, 10)));
            console.log(`[KMeans Worker] Length of flat data: ${flatData.length} (Expected: ${numRows} * ${numCols} = ${numRows * numCols})`);
            
            // Use the explicit shape and the *flattened* data in tensor2d
            console.log('[KMeans Worker] Creating tensor with shape:', JSON.stringify(shape), 'and flattened data.');
            const datasetTensor = tf.tensor2d(flatData, shape);

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

                    // Log iteration details
                    console.log(`[KMeans Worker] Iteration ${iter}: Centroids (first 2):`, JSON.stringify(centroidsArray.slice(0, 2)));
                    console.log(`[KMeans Worker] Iteration ${iter}: Assignments (first 10):`, JSON.stringify(assignmentsArray.slice(0, 10)));
                    
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
            console.log('[KMeans Worker] Final Centroids (first 2):', JSON.stringify(finalCentroidsArray.slice(0, 2)));
            console.log('[KMeans Worker] Final Assignments (first 10):', JSON.stringify(finalAssignmentsArray.slice(0, 10)));

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
