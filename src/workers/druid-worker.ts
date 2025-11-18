import * as druid from "@saehrimnir/druidjs";

// --- Helper utilities for ensuring numeric arrays ---
const isTypedNumericArray = (value: unknown): value is ArrayLike<number> => {
    return (
        typeof value === 'object' &&
        value !== null &&
        ArrayBuffer.isView(value as ArrayLike<unknown>) &&
        !(value instanceof DataView)
    );
};

const ensureNumericValue = (
    value: unknown,
    methodLabel: string,
    rowIndex: number,
    colIndex: number
): number => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`[Druid Worker] [${methodLabel}] Value at row ${rowIndex}, col ${colIndex} is not finite.`);
        }
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
    }
    throw new Error(
        `[Druid Worker] [${methodLabel}] Value at row ${rowIndex}, col ${colIndex} is not numeric (received ${typeof value}).`
    );
};

const convertRowLikeToNumberArray = (
    value: unknown,
    methodLabel: string,
    rowIndex: number
): number[] => {
    if (Array.isArray(value)) {
        return value.map((colValue, colIndex) => ensureNumericValue(colValue, methodLabel, rowIndex, colIndex));
    }
    if (isTypedNumericArray(value)) {
        return Array.from(value as ArrayLike<number>).map((colValue, colIndex) =>
            ensureNumericValue(colValue, methodLabel, rowIndex, colIndex)
        );
    }
    if (typeof value === 'object' && value !== null) {
        const numericKeys = Object.keys(value)
            .filter(key => !Number.isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));
        if (numericKeys.length > 0) {
            return numericKeys.map((key, index) =>
                ensureNumericValue((value as Record<string, unknown>)[key], methodLabel, rowIndex, index)
            );
        }
    }
    if (typeof value === 'number') {
        return [ensureNumericValue(value, methodLabel, rowIndex, 0)];
    }
    throw new Error(
        `[Druid Worker] [${methodLabel}] Unable to convert row ${rowIndex} of type ${typeof value} to numeric array.`
    );
};

const ensureRowContainers = (
    data: unknown,
    rowCount: number,
    dimensions: number,
    methodLabel: string
): unknown[] => {
    if (Array.isArray(data)) {
        return data;
    }
    if (isTypedNumericArray(data)) {
        const flat = Array.from(data as ArrayLike<number>);
        if (rowCount === 1 && flat.length === dimensions) {
            return [flat];
        }
        if (flat.length % dimensions === 0) {
            const rows: number[][] = [];
            for (let i = 0; i < flat.length; i += dimensions) {
                rows.push(flat.slice(i, i + dimensions));
            }
            return rows;
        }
        console.warn(
            `[Druid Worker] [${methodLabel}] Typed array length ${flat.length} not divisible by ${dimensions}. Wrapping as single row.`
        );
        return [flat];
    }
    if (typeof data === 'object' && data !== null) {
        return [data];
    }
    return [data];
};

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
                
                // Convert result to array format with robust validation
                let transformedNewData: number[][];
                
                // Step 1: Convert to array format
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
                    } else if (typeof fallbackArray === 'number') {
                        // Edge case: scalar result when dimensions=1, wrap it
                        transformedNewData = [[fallbackArray]];
                    } else {
                        transformedNewData = [fallbackArray];
                    }
                }
                
                // Step 2: Validate and normalize format
                // Ensure transformedNewData is number[][] with correct dimensions
                transformedNewData = transformedNewData.map((item, index) => {
                    // Handle scalar values (edge case for dimensions=1)
                    if (typeof item === 'number') {
                        console.log(`[Druid Worker] Found scalar at index ${index}, wrapping as array`);
                        return [item];
                    }
                    // Ensure item is an array
                    if (!Array.isArray(item)) {
                        console.warn(`[Druid Worker] Non-array item at index ${index}, attempting conversion`);
                        return [item as number];
                    }
                    // Validate length matches expected dimensions
                    if (item.length !== dimensions) {
                        console.warn(`[Druid Worker] Vector at index ${index} has ${item.length} dimensions, expected ${dimensions}`);
                        // Pad or truncate to match dimensions
                        if (item.length < dimensions) {
                            return [...item, ...Array(dimensions - item.length).fill(0)];
                        } else {
                            return item.slice(0, dimensions);
                        }
                    }
                    return item;
                });
                
                // Step 3: Final validation
                if (transformedNewData.length !== newVectors.length) {
                    throw new Error(`Transformed data length (${transformedNewData.length}) doesn't match input length (${newVectors.length})`);
                }
                
                // Validate each vector has correct dimensions
                for (let i = 0; i < transformedNewData.length; i++) {
                    if (!Array.isArray(transformedNewData[i])) {
                        throw new Error(`Transformed data at index ${i} is not an array`);
                    }
                    if (transformedNewData[i].length !== dimensions) {
                        throw new Error(`Transformed data at index ${i} has ${transformedNewData[i].length} dimensions, expected ${dimensions}`);
                    }
                }
                
                console.log(`[Druid Worker] PCA transformation complete. Transformed ${transformedNewData.length} new points, each with ${dimensions} dimensions.`);
                
                self.postMessage({
                    type: 'transformNewDataComplete',
                    payload: {
                        reducedData: transformedNewData,
                        songIds: songIds
                    }
                });
            } else {
                // t-SNE and UMAP don't support direct transformation of new points
                // We need to re-fit with training + new data
                console.log(`[Druid Worker] ${method.toUpperCase()} requires re-fitting with training + new data...`);
                console.log(`[Druid Worker] ${method.toUpperCase()} configuration: dimensions=${dimensions}, training vectors=${trainingVectors.length}, new vectors=${newVectors.length}`);
                const combinedVectors = [...trainingVectors, ...newVectors];
                const combinedMatrix = druid.Matrix.from(combinedVectors);
                
                let drInstance: druid.DR;
                switch (method) {
                    case 'tsne':
                        drInstance = new druid.TSNE(combinedMatrix, {
                            d: dimensions,
                            perplexity: perplexity ?? 30,
                        });
                        console.log(`[Druid Worker] t-SNE initialized with perplexity=${perplexity ?? 30}`);
                        break;
                    case 'umap':
                        drInstance = new druid.UMAP(combinedMatrix, {
                            d: dimensions,
                            n_neighbors: neighbors ?? 5,
                            min_dist: minDist ?? 0.1,
                        });
                        console.log(`[Druid Worker] UMAP initialized with n_neighbors=${neighbors ?? 5}, min_dist=${minDist ?? 0.1}`);
                        break;
                    default:
                        throw new Error(`Unsupported method for transformation: ${method}`);
                }
                
                console.log(`[Druid Worker] Running ${method.toUpperCase()} transformation on combined data...`);
                const combinedReduced = drInstance.transform();
                const combinedReducedArray = combinedReduced.to2dArray;
                
                console.log(`[Druid Worker] [${method.toUpperCase()}] Combined reduced array type: ${Array.isArray(combinedReducedArray) ? 'array' : typeof combinedReducedArray}`);
                console.log(`[Druid Worker] [${method.toUpperCase()}] Combined reduced array length: ${Array.isArray(combinedReducedArray) ? combinedReducedArray.length : 'N/A'}`);
                if (Array.isArray(combinedReducedArray) && combinedReducedArray.length > 0) {
                    console.log(`[Druid Worker] [${method.toUpperCase()}] First item type: ${Array.isArray(combinedReducedArray[0]) ? 'array' : typeof combinedReducedArray[0]}`);
                    if (Array.isArray(combinedReducedArray[0])) {
                        console.log(`[Druid Worker] [${method.toUpperCase()}] First item length: ${combinedReducedArray[0].length}`);
                    }
                }
                
                // Extract only the new data points
                const extractedDataRaw = combinedReducedArray.slice(trainingVectors.length);
                
                console.log(
                    `[Druid Worker] [${method.toUpperCase()}] Extracted data length: ${
                        (extractedDataRaw as unknown[]).length ?? 'N/A'
                    }`
                );
                console.log(
                    `[Druid Worker] [${method.toUpperCase()}] Extracted data type: ${
                        Array.isArray(extractedDataRaw) ? 'array' : typeof extractedDataRaw
                    }`
                );
                
                const rawRows = ensureRowContainers(
                    extractedDataRaw,
                    newVectors.length,
                    dimensions,
                    method.toUpperCase()
                );
                
                if (rawRows.length > 0) {
                    console.log(
                        `[Druid Worker] [${method.toUpperCase()}] First extracted item type: ${
                            Array.isArray(rawRows[0]) ? 'array' : typeof rawRows[0]
                        }`
                    );
                }
                
                // Convert every row-like structure into a plain number[]
                let transformedNewData: number[][] = rawRows.map((item, index) => {
                    const numericRow = convertRowLikeToNumberArray(item, method.toUpperCase(), index);
                    if (numericRow.length !== dimensions) {
                        console.warn(
                            `[Druid Worker] [${method.toUpperCase()}] Vector at index ${index} has ${numericRow.length} dimensions, expected ${dimensions}. Padding/truncating...`
                        );
                        if (numericRow.length < dimensions) {
                            const padded = [
                                ...numericRow,
                                ...Array(dimensions - numericRow.length).fill(0)
                            ];
                            console.log(
                                `[Druid Worker] [${method.toUpperCase()}] Padded vector at index ${index} from ${numericRow.length} to ${dimensions} dimensions`
                            );
                            return padded;
                        } else {
                            const truncated = numericRow.slice(0, dimensions);
                            console.log(
                                `[Druid Worker] [${method.toUpperCase()}] Truncated vector at index ${index} from ${numericRow.length} to ${dimensions} dimensions`
                            );
                            return truncated;
                        }
                    }
                    return numericRow;
                });
                
                // Final validation
                if (transformedNewData.length !== newVectors.length) {
                    throw new Error(`Transformed data length (${transformedNewData.length}) doesn't match input length (${newVectors.length})`);
                }
                
                // Validate each vector has correct dimensions
                // Double-check and fix any remaining dimension mismatches before final validation
                // This ensures both t-SNE and UMAP outputs are properly formatted
                for (let i = 0; i < transformedNewData.length; i++) {
                    if (!Array.isArray(transformedNewData[i])) {
                        console.error(`[Druid Worker] [${method.toUpperCase()}] Vector at index ${i} is not an array after normalization: ${typeof transformedNewData[i]}`);
                        // Convert to array
                        const value = transformedNewData[i] as unknown;
                        transformedNewData[i] = typeof value === 'number' ? [value] : [value as number];
                    }
                    const currentLength = transformedNewData[i].length;
                    if (currentLength !== dimensions) {
                        console.warn(`[Druid Worker] [${method.toUpperCase()}] Vector at index ${i} still has ${currentLength} dimensions after normalization, fixing...`);
                        if (currentLength < dimensions) {
                            // Pad with zeros
                            transformedNewData[i] = [...transformedNewData[i], ...Array(dimensions - currentLength).fill(0)];
                            console.log(`[Druid Worker] [${method.toUpperCase()}] Padded vector at index ${i} to ${dimensions} dimensions`);
                        } else {
                            // Truncate
                            transformedNewData[i] = transformedNewData[i].slice(0, dimensions);
                            console.log(`[Druid Worker] [${method.toUpperCase()}] Truncated vector at index ${i} to ${dimensions} dimensions`);
                        }
                    }
                }
                
                // Final validation - should all pass now
                // This validation applies to both t-SNE and UMAP outputs
                for (let i = 0; i < transformedNewData.length; i++) {
                    if (!Array.isArray(transformedNewData[i])) {
                        throw new Error(`[${method.toUpperCase()}] Transformed data at index ${i} is not an array after final normalization`);
                    }
                    if (transformedNewData[i].length !== dimensions) {
                        throw new Error(`[${method.toUpperCase()}] Transformed data at index ${i} has ${transformedNewData[i].length} dimensions after normalization, expected ${dimensions}`);
                    }
                }
                
                console.log(`[Druid Worker] ${method.toUpperCase()} transformation complete. Transformed ${transformedNewData.length} new points, each with ${dimensions} dimensions.`);
                
                self.postMessage({
                    type: 'transformNewDataComplete',
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