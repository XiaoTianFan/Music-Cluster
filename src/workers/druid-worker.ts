import * as druid from "@saehrimnir/druidjs";

interface ReduceDimensionsPayload {
    featureVectors: number[][];
    songIds: string[];
    method: 'pca' | 'tsne' | 'umap'; // Add other methods if needed
    dimensions: number;
    // Add method-specific parameters as needed, e.g.:
    perplexity?: number; // for t-SNE
    neighbors?: number; // for UMAP
    minDist?: number; // for UMAP
}

type WorkerMessageData =
    | { type: 'reduceDimensions', payload: ReduceDimensionsPayload };

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
    console.log("Druid worker received message EVENT:", event);
    // Add detailed log of the received data
    console.log("Druid worker received message DATA:", JSON.stringify(event.data, null, 2));

    const { type, payload } = event.data;
    console.log(`[Druid Worker] Processing message type: ${type}`);

    if (type === 'reduceDimensions') {
        const { 
            featureVectors, 
            songIds, 
            method, 
            dimensions, 
            // Destructure specific params
            perplexity, 
            neighbors,
            minDist 
        } = payload;

        console.log('[Druid Worker] Destructured payload:', { method, dimensions, perplexity, neighbors, minDist, vectorCount: featureVectors?.length, idCount: songIds?.length });

        if (!featureVectors || featureVectors.length === 0 || !featureVectors[0] || featureVectors[0].length === 0) {
             console.error('[Druid Worker] Validation failed: Empty or invalid feature vectors.');
             self.postMessage({ type: 'reductionError', payload: { error: 'Received empty or invalid feature vectors.' } });
             return;
        }
        
        if (featureVectors.length !== songIds.length) {
            self.postMessage({ type: 'reductionError', payload: { error: 'Mismatch between number of feature vectors and song IDs.' } });
            return;
        }
        
        // Basic check: Need more samples than dimensions for many methods
        if (featureVectors.length <= dimensions) {
             self.postMessage({ type: 'reductionError', payload: { error: `Insufficient data points (${featureVectors.length}) for ${dimensions} dimensions.` } });
             return;
        }

        console.log('[Druid Worker] Payload validated. Entering try block...');
        try {
            console.log(`[Druid Worker] Starting reduction with method: ${method}, target dimensions: ${dimensions}`);
            console.log(`[Druid Worker] Input data shape: ${featureVectors.length}x${featureVectors[0].length}`);

            // Create DruidJS Matrix
            const matrix = druid.Matrix.from(featureVectors);

            let drInstance: druid.DR; // Use the base DR type or a union type if stricter typing is needed

            // Instantiate the correct DR method
            switch (method) {
                case 'pca':
                    // PCA constructor: (X: Matrix | number[][], d?: number)
                    drInstance = new druid.PCA(matrix, dimensions);
                    break;
                case 'tsne':
                    // TSNE constructor: (X: Matrix | number[][], parameters?: { perplexity?: number, d?: number, seed?: number, metric?: string | function, epsilon?: number, exageration?: number })
                    drInstance = new druid.TSNE(matrix, { 
                        d: dimensions, 
                        perplexity: perplexity ?? 30, // Default perplexity if not provided
                        // Add other t-SNE params as needed
                    });
                    break;
                case 'umap':
                     // UMAP constructor: (X: Matrix | number[][], parameters?: { nn?: number, d?: number, seed?: number, metric?: string | function, iterations?: number, lr?: number, minDist?: number })
                     drInstance = new druid.UMAP(matrix, { 
                        d: dimensions, 
                        n_neighbors: neighbors ?? 5, // Default neighbors if not provided
                        min_dist: minDist ?? 0.1, // Default min_dist if not provided
                        // Add other UMAP params as needed
                    });
                    break;
                default:
                    throw new Error(`Unsupported dimensionality reduction method: ${method}`);
            }

            console.log(`[Druid Worker] Method ${method} instantiated. Starting transform...`);

            // Perform the transformation
            // `.transform()` returns a Matrix
            const reducedMatrix = drInstance.transform();

            console.log(`[Druid Worker] Transform complete. Result dimensions: ${reducedMatrix.rows}x${reducedMatrix.cols}`);

            // Convert result back to standard 2D array
            const reducedData = reducedMatrix.to2dArray;

            // Send results back to main thread
            self.postMessage({ 
                type: 'reductionComplete', 
                payload: { 
                    reducedData: reducedData, 
                    songIds: songIds // Pass song IDs back for mapping
                } 
            });
            console.log(`[Druid Worker] Finished processing reduction.`);

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            console.error(`[Druid Worker] Error during dimensionality reduction (${method}):`, error);
            self.postMessage({ type: 'reductionError', payload: { error: errorMessage } });
        }
    }
};

// Generic error handler for the worker itself
self.onerror = (error) => {
    const errorMessage = (error instanceof Error) ? error.message : (typeof error === 'string' ? error : 'Unknown worker error');
    console.error("[Druid Worker] Unhandled error:", error);
    // Post a generic error back if the worker crashes unexpectedly
    self.postMessage({ type: 'reductionError', payload: { error: `Unhandled worker error: ${errorMessage}` } });
};

console.log("[Druid Worker] Worker setup complete. Waiting for messages..."); 