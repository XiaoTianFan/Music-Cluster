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

interface TransformNewDataPayload {
    newVectors: number[][];
    songIds: string[];
    method: 'pca' | 'tsne' | 'umap';
    dimensions: number;
    // Training data needed for PCA transform (for t-SNE/UMAP, we'd need full model)
    trainingVectors: number[][];
    // Method-specific parameters (should match training)
    perplexity?: number;
    neighbors?: number;
    minDist?: number;
}

type WorkerMessageData =
    | { type: 'reduceDimensions', payload: ReduceDimensionsPayload }
    | { type: 'transformNewData', payload: TransformNewDataPayload };

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
                    // PCA constructor likely expects options object: (X: Matrix | number[][], parameters?: { d?: number })
                    drInstance = new druid.PCA(matrix, { d: dimensions }); // Pass dimensions inside an object
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
        return;
    }

    if (type === 'transformNewData') {
        const {
            newVectors,
            songIds,
            method,
            dimensions,
            trainingVectors,
            perplexity,
            neighbors,
            minDist
        } = payload as TransformNewDataPayload;

        console.log(`[Druid Worker] Transforming new data with method: ${method}, dimensions: ${dimensions}`);
        console.log(`[Druid Worker] New vectors: ${newVectors.length}, Training vectors: ${trainingVectors.length}`);

        if (!newVectors || newVectors.length === 0 || !newVectors[0] || newVectors[0].length === 0) {
            self.postMessage({ type: 'reductionError', payload: { error: 'Received empty or invalid new vectors.' } });
            return;
        }

        if (newVectors.length !== songIds.length) {
            self.postMessage({ type: 'reductionError', payload: { error: 'Mismatch between number of new vectors and song IDs.' } });
            return;
        }

        if (!trainingVectors || trainingVectors.length === 0) {
            self.postMessage({ type: 'reductionError', payload: { error: 'Training vectors required for transformation.' } });
            return;
        }

        // Validate dimension consistency
        const newVectorDim = newVectors[0].length;
        const trainingVectorDim = trainingVectors[0]?.length;
        if (newVectorDim !== trainingVectorDim) {
            self.postMessage({ 
                type: 'reductionError', 
                payload: { error: `Dimension mismatch: new vectors have ${newVectorDim} dimensions, training vectors have ${trainingVectorDim} dimensions.` } 
            });
            return;
        }

        try {
            // For PCA, we can fit on training data and transform new data
            // For t-SNE/UMAP, this is more complex and may not work well
            if (method === 'pca') {
                console.log('[Druid Worker] Using PCA for transformation...');
                // Create PCA model with training data and fit it
                const trainingMatrix = druid.Matrix.from(trainingVectors);
                const pcaModel = new druid.PCA(trainingMatrix, { d: dimensions });
                
                // Fit the model on training data (transform training data to compute principal components)
                pcaModel.transform(); // This computes the principal components from training data
                
                // Transform new data using the fitted PCA model
                // DruidJS PCA.transform() accepts a Matrix or number[][] as parameter to transform new data
                const transformedResult = pcaModel.transform(newVectors);
                
                // Convert result to array format
                let transformedNewData: number[][];
                if (Array.isArray(transformedResult)) {
                    // Check if it's a 2D array or 1D array
                    if (transformedResult.length > 0 && Array.isArray(transformedResult[0])) {
                        transformedNewData = transformedResult as number[][];
                    } else {
                        // It's a 1D array, wrap it in an array to make it 2D
                        transformedNewData = [transformedResult as number[]];
                    }
                } else if (transformedResult instanceof druid.Matrix) {
                    transformedNewData = transformedResult.to2dArray;
                } else {
                    // Fallback: try to access as array property
                    const fallbackArray = (transformedResult as any).to2dArray || (transformedResult as any).asArray || [];
                    // Ensure it's 2D
                    if (fallbackArray.length > 0 && Array.isArray(fallbackArray[0])) {
                        transformedNewData = fallbackArray;
                    } else {
                        transformedNewData = [fallbackArray];
                    }
                }
                
                console.log(`[Druid Worker] PCA transformation complete. Transformed ${transformedNewData.length} new points.`);
                
                self.postMessage({
                    type: 'reductionComplete',
                    payload: {
                        reducedData: transformedNewData,
                        songIds: songIds
                    }
                });
            } else {
                // t-SNE and UMAP don't support direct transformation of new points
                // We need to re-fit with training + new data
                console.log(`[Druid Worker] ${method} requires re-fitting with training + new data...`);
                const combinedVectors = [...trainingVectors, ...newVectors];
                const combinedMatrix = druid.Matrix.from(combinedVectors);
                
                let drInstance: druid.DR;
                switch (method) {
                    case 'tsne':
                        drInstance = new druid.TSNE(combinedMatrix, {
                            d: dimensions,
                            perplexity: perplexity ?? 30,
                        });
                        break;
                    case 'umap':
                        drInstance = new druid.UMAP(combinedMatrix, {
                            d: dimensions,
                            n_neighbors: neighbors ?? 5,
                            min_dist: minDist ?? 0.1,
                        });
                        break;
                    default:
                        throw new Error(`Unsupported method for transformation: ${method}`);
                }
                
                const combinedReduced = drInstance.transform();
                const combinedReducedArray = combinedReduced.to2dArray;
                
                // Extract only the new data points
                const transformedNewData = combinedReducedArray.slice(trainingVectors.length);
                
                console.log(`[Druid Worker] ${method} transformation complete. Transformed ${transformedNewData.length} new points.`);
                
                self.postMessage({
                    type: 'reductionComplete',
                    payload: {
                        reducedData: transformedNewData,
                        songIds: songIds
                    }
                });
            }
        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            console.error(`[Druid Worker] Error during transformation (${method}):`, error);
            self.postMessage({ type: 'reductionError', payload: { error: errorMessage } });
        }
        return;
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

// Signal readiness to the main thread
self.postMessage({ type: 'druidWorkerReady' }); 