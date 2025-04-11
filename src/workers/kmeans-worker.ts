// songcluster/src/workers/kmeans-worker.ts
// Remove tf-kmeans import, rely only on tfjs core
// import * as KMeans from 'tf-kmeans'; 
import * as tf from '@tensorflow/tfjs';

console.log('[KMeans Worker] Loading TensorFlow.js backend...');
// Optional: Set backend explicitly if needed
// tf.setBackend('wasm').then(() => console.log('[KMeans Worker] WASM backend set.'));
tf.ready().then(() => {
    console.log(`[KMeans Worker] TensorFlow.js backend: ${tf.getBackend()}`);
});

// --- Worker State ---
let datasetTensor: tf.Tensor2D | null = null;
let currentCentroidsTensor: tf.Tensor2D | null = null;
let k: number = 0;
let songIds: string[] = [];
let currentIteration: number = 0;
let isTrainingInitialized: boolean = false;

// --- Interfaces for Worker Communication ---
interface InitializeTrainingPayload {
    reducedData: Array<{[key: string]: number}> | number[][]; // Expect potentially object array
    songIds: string[];
    k: number;
}

interface StepCompletePayload {
    iteration: number;
    centroids: number[][];
    assignments: number[];
    songIds: string[];
}

interface InitializationCompletePayload {
    iteration: number;
    initialCentroids: number[][];
    initialAssignments: number[];
    songIds: string[];
}

interface KMeansErrorPayload {
    error: string;
    whileDoing?: 'init' | 'step' | 'reset' | 'conversion';
}

// Define message types for receiving
type WorkerRecvMessageData =
    | { type: 'initializeTraining', payload: InitializeTrainingPayload }
    | { type: 'runNextStep' }
    | { type: 'resetTraining' };

// Define message types for sending
type WorkerSendMessageData =
    | { type: 'initializationComplete', payload: InitializationCompletePayload }
    | { type: 'stepComplete', payload: StepCompletePayload }
    | { type: 'resetComplete' }
    | { type: 'kmeansError', payload: KMeansErrorPayload };

// Helper to post messages with type safety
const postMsg = (message: WorkerSendMessageData) => {
    self.postMessage(message);
};

// Helper function to calculate assignments
const calculateAssignments = (data: tf.Tensor2D, centroids: tf.Tensor2D): tf.Tensor1D => {
    return tf.tidy(() => {
        // Expand dims to enable broadcasting for distance calculation
        const expandedData = data.expandDims(1);      // Shape: [numPoints, 1, numDims]
        const expandedCentroids = centroids.expandDims(0); // Shape: [1, k, numDims]

        // Calculate squared distances (efficient)
        const diff = tf.sub(expandedData, expandedCentroids); // Broadcasting
        const squaredDist = tf.sum(tf.square(diff), 2);  // Sum along dimension 2 (numDims)
                                                        // Shape: [numPoints, k]

        // Find the index of the minimum distance (closest centroid)
        const assignments = tf.argMin(squaredDist, 1);     // Find min along dimension 1 (k)
                                                        // Shape: [numPoints]
        return assignments as tf.Tensor1D; // Explicit cast might help type checker
    });
};

// Helper function to update centroids
// Mark as async because booleanMaskAsync is used
// Remove tf.tidy and manage memory manually
const updateCentroids = async (data: tf.Tensor2D, assignments: tf.Tensor1D, k: number, oldCentroids: tf.Tensor2D): Promise<tf.Tensor2D> => {
    const newCentroidsList: tf.Tensor1D[] = []; // Collect new centroids (or reused old ones)
    const tensorsToDisposeLoop: tf.Tensor[] = []; // Tensors created inside the loop

    for (let i = 0; i < k; i++) {
        let clusterMask: tf.Tensor | null = null;
        let clusterPoints: tf.Tensor | null = null;
        let meanCentroid: tf.Tensor | null = null;
        try {
            // Get mask for points assigned to cluster i
            clusterMask = tf.equal(assignments, tf.scalar(i, 'int32'));
            
            // Get the points assigned to this cluster using await
            clusterPoints = await tf.booleanMaskAsync(data, clusterMask);
            tensorsToDisposeLoop.push(clusterPoints); // Add clusterPoints for disposal

            // Check if the cluster is empty
            if (clusterPoints.shape[0] === 0) {
                console.warn(`[KMeans Worker] Cluster ${i} is empty. Reusing old centroid.`);
                // Reuse the old centroid for this cluster (slicing creates a new tensor view)
                const oldCentroidForCluster = oldCentroids.slice([i, 0], [1, oldCentroids.shape[1]]).squeeze<tf.Tensor1D>([0]);
                // We don't own oldCentroidForCluster memory directly (it's from oldCentroids), 
                // but we need to keep it for stacking. Stacking creates a new tensor.
                newCentroidsList.push(oldCentroidForCluster);
            } else {
                // Calculate the mean of the points in the cluster
                meanCentroid = tf.mean(clusterPoints, 0);
                tensorsToDisposeLoop.push(meanCentroid); // Add meanCentroid for disposal
                newCentroidsList.push(meanCentroid as tf.Tensor1D); // Cast needed
            }
        } finally {
            // Dispose tensors created in this iteration (mask)
            if (clusterMask) tensorsToDisposeLoop.push(clusterMask);
            // clusterPoints and meanCentroid are added above if created
        }
    }
    
    // Stack the new centroids into a single tensor
    const newCentroidsTensor = tf.stack(newCentroidsList); 
    // Now dispose all intermediate tensors created in the loop
    tf.dispose(tensorsToDisposeLoop);
    // Also dispose the sliced views from oldCentroids if they were added to newCentroidsList
    // (stack should copy data, making this safe, but explicit disposal is cleaner)
    newCentroidsList.forEach(t => {
        // Check if it's a slice from oldCentroids (hard to tell definitively, 
        // but disposing views doesn't harm the original if stack copies)
        // Let's assume stack copies and dispose everything in newCentroidsList *except* the final stacked tensor
        // This is complex, let's rely on tf.stack creating a new tensor and dispose the loop tensors.
        // If memory issues arise, revisit disposal of sliced old centroids.
    }); 

    // Return the final stacked tensor (caller will keep/dispose)
    return newCentroidsTensor as tf.Tensor2D;
};

// --- Main Message Handler ---
self.onmessage = async (event: MessageEvent<WorkerRecvMessageData>) => {
    console.log('[KMeans Worker] Received message:', event.data.type);
    const { type } = event.data;

    // --- Reset Training ---
    if (type === 'resetTraining') {
        console.log('[KMeans Worker] Resetting training state...');
        // Dispose tensors individually after null checks (Corrected)
        if (datasetTensor && !datasetTensor.isDisposed) tf.dispose(datasetTensor);
        if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor);
        // Reset state variables
        datasetTensor = null;
        currentCentroidsTensor = null;
        k = 0;
        songIds = [];
        currentIteration = 0;
        isTrainingInitialized = false;
        postMsg({ type: 'resetComplete' });
        console.log('[KMeans Worker] Reset complete.');
        return;
    }

    // --- Initialize Training ---
    if (type === 'initializeTraining') {
        // MODIFICATION START: Always reset state *before* initializing
        // This handles potential race conditions where resetTraining hasn't finished
        // or allows re-initialization directly via this message.
        console.log('[KMeans Worker] Ensuring previous state is reset before initialization...');
        if (datasetTensor && !datasetTensor.isDisposed) tf.dispose(datasetTensor);
        if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor);
        datasetTensor = null;
        currentCentroidsTensor = null;
        // k, songIds will be overwritten by payload
        currentIteration = 0;
        isTrainingInitialized = false; // Explicitly set to false before starting
        // MODIFICATION END

        /* // REMOVED Original Check:
        if (isTrainingInitialized) {
            postMsg({ type: 'kmeansError', payload: { error: 'Training already initialized. Reset first.', whileDoing: 'init' } });
            return;
        }
        */
        const { payload } = event.data; // Payload is InitializeTrainingPayload
        console.log('[KMeans Worker] Initializing training with payload:', JSON.stringify(payload).substring(0, 500) + '...');

        k = payload.k;
        songIds = payload.songIds;

        let localDatasetTensor: tf.Tensor2D | null = null;
        let localInitialCentroidsTensor: tf.Tensor2D | null = null;
        let localInitialAssignmentsTensor: tf.Tensor1D | null = null;

        try {
             // --- Data Validation and Formatting ---
            const reducedData = payload.reducedData;
            if (!reducedData || reducedData.length === 0 || !reducedData[0]) {
                throw new Error('Received empty or invalid reduced data format.');
            }
             if (reducedData.length !== songIds.length) {
                 throw new Error('Mismatch between number of data points and song IDs.');
             }
            if (reducedData.length < k) {
                throw new Error(`Insufficient data points (${reducedData.length}) for k=${k} clusters.`);
            }
            if (k <= 0) {
                throw new Error(`Invalid k value: ${k}. Must be > 0.`);
            }

            let formattedReducedData: number[][];
            // Check if conversion is needed (array of objects?)
            if (!Array.isArray(reducedData[0])) {
                console.log('[KMeans Worker] Converting received array of objects to number[][]...');
                if (typeof reducedData[0] !== 'object' || reducedData[0] === null) {
                    throw new Error('Received data elements are not arrays or objects.');
                }
                try {
                    formattedReducedData = (reducedData as Array<{[key: string]: number}>).map(obj => Object.values(obj));
                } catch (conversionError: any) {
                    throw new Error(`Failed to convert received data format: ${conversionError.message}`);
                }
                console.log('[KMeans Worker] Conversion complete.');
            } else {
                // Already number[][] hopefully
                console.log('[KMeans Worker] Data received in number[][] format.');
                formattedReducedData = reducedData as number[][];
            }

             // --- Create Dataset Tensor ---
            const numRows = formattedReducedData.length;
            const numCols = formattedReducedData[0]?.length;
            if (!numCols || numCols === 0) {
                 throw new Error('Formatted data has rows with zero length.');
            }
            const shape: [number, number] = [numRows, numCols];
            const flatData = formattedReducedData.flat();
            if (flatData.length !== numRows * numCols) {
                 throw new Error(`Flattened data length (${flatData.length}) does not match shape (${numRows}*${numCols}=${numRows*numCols}).`);
            }
            localDatasetTensor = tf.tensor2d(flatData, shape);

            // --- Initialize Centroids (Random Selection from Data) ---
            console.log('[KMeans Worker] Initializing centroids randomly from dataset...');
            // Shuffle indices and pick the first k
            const indices = tf.util.createShuffledIndices(numRows);
            // Explicitly convert Uint32Array to number[] before creating tensor
            const initialCentroidIndicesArray = Array.from(indices.slice(0, k));
            const initialCentroidIndices = tf.tensor1d(initialCentroidIndicesArray, 'int32'); 
            localInitialCentroidsTensor = localDatasetTensor.gather(initialCentroidIndices);
            initialCentroidIndices.dispose(); // Dispose indices tensor

            // --- Calculate Initial Assignments ---
            console.log('[KMeans Worker] Calculating initial assignments...');
            localInitialAssignmentsTensor = calculateAssignments(localDatasetTensor, localInitialCentroidsTensor);

            // --- Store Tensors in Worker State ---
            datasetTensor = tf.keep(localDatasetTensor); // Keep tensors needed across steps
            currentCentroidsTensor = tf.keep(localInitialCentroidsTensor);
            
            // --- Prepare Data for Sending Back ---
            const initialCentroidsArray = await localInitialCentroidsTensor.array() as number[][];
            const initialAssignmentsArray = await localInitialAssignmentsTensor.array() as number[];

            // --- Mark as Initialized and Send ---            
            isTrainingInitialized = true;
            console.log('[KMeans Worker] Initialization complete.');
            postMsg({
                type: 'initializationComplete',
                payload: {
                    iteration: currentIteration,
                    initialCentroids: initialCentroidsArray,
                    initialAssignments: initialAssignmentsArray,
                    songIds: songIds
                }
            });

        } catch (error: any) {
            console.error('[KMeans Worker] Error during initialization:', error);
            // Dispose tensors individually after null checks (Corrected)
            if (localDatasetTensor && !localDatasetTensor.isDisposed) tf.dispose(localDatasetTensor);
            if (localInitialCentroidsTensor && !localInitialCentroidsTensor.isDisposed) tf.dispose(localInitialCentroidsTensor);
            if (localInitialAssignmentsTensor && !localInitialAssignmentsTensor.isDisposed) tf.dispose(localInitialAssignmentsTensor);
            if (datasetTensor && !datasetTensor.isDisposed) tf.dispose(datasetTensor); // Dispose potentially kept tensor
            if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor); // Dispose potentially kept tensor

            // Reset state variables
            datasetTensor = null;
            currentCentroidsTensor = null;
            isTrainingInitialized = false; // Reset state
            postMsg({ type: 'kmeansError', payload: { error: error.message || 'Unknown initialization error', whileDoing: 'init' } });
        } finally {
             // Dispose ONLY local tensors that weren't kept (if they exist and aren't disposed)
             if (localDatasetTensor && !localDatasetTensor.isDisposed && localDatasetTensor !== datasetTensor) tf.dispose(localDatasetTensor);
             if (localInitialCentroidsTensor && !localInitialCentroidsTensor.isDisposed && localInitialCentroidsTensor !== currentCentroidsTensor) tf.dispose(localInitialCentroidsTensor);
             if (localInitialAssignmentsTensor && !localInitialAssignmentsTensor.isDisposed) tf.dispose(localInitialAssignmentsTensor);
             console.log(`[KMeans Worker] TensorFlow memory after init: ${JSON.stringify(tf.memory())}`);
        }
        return;
    }

    // --- Run Next Step ---
    if (type === 'runNextStep') {
        if (!isTrainingInitialized || !datasetTensor || !currentCentroidsTensor) {
            postMsg({ type: 'kmeansError', payload: { error: 'Training not initialized or tensors missing. Initialize first.', whileDoing: 'step' } });
            return;
        }

        currentIteration++;
        console.log(`[KMeans Worker] Running step ${currentIteration}...`);

        let assignmentsTensor: tf.Tensor1D | null = null;
        let nextCentroidsTensor: tf.Tensor2D | null = null;

        try {
            // --- Assignment Step ---
            console.log('[KMeans Worker] Calculating assignments...');
            assignmentsTensor = calculateAssignments(datasetTensor, currentCentroidsTensor);

            // --- Update Step ---
            console.log('[KMeans Worker] Updating centroids...');
            // Use await here as updateCentroids is now async
            nextCentroidsTensor = await updateCentroids(datasetTensor, assignmentsTensor, k, currentCentroidsTensor);

             // --- Update Worker State ---
            if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor); // Dispose old centroids *before* reassignment
            currentCentroidsTensor = tf.keep(nextCentroidsTensor!); // Keep the new ones (assert non-null after successful update)

            // --- Prepare Data for Sending Back ---
            const centroidsArray = await nextCentroidsTensor.array() as number[][];
            const assignmentsArray = await assignmentsTensor.array() as number[];

            // --- Send Step Results ---            
            console.log(`[KMeans Worker] Step ${currentIteration} complete.`);
            postMsg({
                type: 'stepComplete',
                payload: {
                    iteration: currentIteration,
                    centroids: centroidsArray,
                    assignments: assignmentsArray,
                    songIds: songIds
                }
            });

        } catch (error: any) {
            console.error(`[KMeans Worker] Error during step ${currentIteration}:`, error);
            // Don't reset isTrainingInitialized here, allow potential retry? Or should we reset?
            // Let's reset for now to avoid inconsistent state.
            // Dispose tensors individually after null checks (Corrected)
            if (datasetTensor && !datasetTensor.isDisposed) tf.dispose(datasetTensor);
            if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor);
            if (assignmentsTensor && !assignmentsTensor.isDisposed) tf.dispose(assignmentsTensor);
            if (nextCentroidsTensor && !nextCentroidsTensor.isDisposed) tf.dispose(nextCentroidsTensor);

            // Reset state variables
            datasetTensor = null;
            currentCentroidsTensor = null;
            isTrainingInitialized = false;
            postMsg({ type: 'kmeansError', payload: { error: error.message || `Unknown error during step ${currentIteration}`, whileDoing: 'step' } });
        } finally {
            // Dispose intermediate tensors for this step (assignmentsTensor and nextCentroidsTensor *if not kept*)
            if (assignmentsTensor && !assignmentsTensor.isDisposed) tf.dispose(assignmentsTensor);
            if (nextCentroidsTensor && !nextCentroidsTensor.isDisposed && nextCentroidsTensor !== currentCentroidsTensor) {
                 tf.dispose(nextCentroidsTensor);
            }
            console.log(`[KMeans Worker] TensorFlow memory after step ${currentIteration}: ${JSON.stringify(tf.memory())}`);
        }
        return;
    }

    // --- Handle Unknown Message Type --- 
    console.warn('[KMeans Worker] Received unknown message type:', type);
};

// --- Generic Error Handler --- 
self.onerror = (error) => {
    const errorMessage = (error instanceof Error) ? error.message : (typeof error === 'string' ? error : 'Unknown worker error');
    console.error('[KMeans Worker] Unhandled error:', error);
    // Dispose tensors individually after null checks (Corrected)
    if (datasetTensor && !datasetTensor.isDisposed) tf.dispose(datasetTensor);
    if (currentCentroidsTensor && !currentCentroidsTensor.isDisposed) tf.dispose(currentCentroidsTensor);

    // Reset state variables
    datasetTensor = null;
    currentCentroidsTensor = null;
    isTrainingInitialized = false;
    postMsg({ type: 'kmeansError', payload: { error: `Unhandled worker error: ${errorMessage}` } });
};

console.log('[KMeans Worker] Worker setup complete for manual K-Means. Waiting for messages...');
