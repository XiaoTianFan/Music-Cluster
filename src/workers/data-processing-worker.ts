/// <reference lib="webworker" />

// Define types for communication between main thread and worker
type ProcessingMethod = 'none' | 'standardize' | 'normalize';
type NormalizationRange = [number, number];

interface ProcessDataPayload {
    vectors: number[][];
    songIds: string[];
    isOHEColumn: boolean[];
    method: ProcessingMethod;
    range?: NormalizationRange; // Only used for 'normalize'
}

interface TransformDataPayload {
    vectors: number[][];
    songIds: string[];
    isOHEColumn: boolean[];
    method: ProcessingMethod;
    range?: NormalizationRange;
    // Pre-computed statistics from training data
    means?: number[];
    stdDevs?: number[];
    mins?: number[];
    maxs?: number[];
}

// --- Helper Functions for Scaling ---

// Calculates mean and standard deviation for each column
const getColumnStats = (vectors: number[][]): { means: number[], stdDevs: number[] } => {
    if (!vectors || vectors.length === 0) {
        return { means: [], stdDevs: [] };
    }
    const numCols = vectors[0].length;
    const numRows = vectors.length;
    const means: number[] = Array(numCols).fill(0);
    const stdDevs: number[] = Array(numCols).fill(0);

    // Calculate means
    for (let j = 0; j < numCols; j++) {
        let sum = 0;
        for (let i = 0; i < numRows; i++) {
            sum += vectors[i][j];
        }
        means[j] = sum / numRows;
    }

    // Calculate standard deviations
    for (let j = 0; j < numCols; j++) {
        let sumSqDiff = 0;
        for (let i = 0; i < numRows; i++) {
            sumSqDiff += Math.pow(vectors[i][j] - means[j], 2);
        }
        // Use population standard deviation (divide by N). Use sample (N-1) if preferred.
        stdDevs[j] = Math.sqrt(sumSqDiff / numRows);
    }

    return { means, stdDevs };
};

// Calculates min and max for each column
const getColumnMinMax = (vectors: number[][]): { mins: number[], maxs: number[] } => {
    if (!vectors || vectors.length === 0) {
        return { mins: [], maxs: [] };
    }
    const numCols = vectors[0].length;
    const mins: number[] = [...vectors[0]]; // Initialize with first row
    const maxs: number[] = [...vectors[0]]; // Initialize with first row

    for (let j = 0; j < numCols; j++) {
        for (let i = 1; i < vectors.length; i++) {
            if (vectors[i][j] < mins[j]) mins[j] = vectors[i][j];
            if (vectors[i][j] > maxs[j]) maxs[j] = vectors[i][j];
        }
    }
    return { mins, maxs };
};

// --- Processing Functions ---

const standardize = (vectors: number[][], isOHEColumn: boolean[]): number[][] => {
    console.log("[Data Processing Worker] Standardizing (Z-score) skipping OHE...", vectors.length);
    const { means, stdDevs } = getColumnStats(vectors);
    const processedVectors: number[][] = [];
    const numCols = vectors[0]?.length ?? 0;

    if (numCols !== isOHEColumn.length) {
        console.error('[Data Processing Worker] Mismatch between vector columns and OHE definition length.');
        throw new Error('Vector column count does not match OHE definition length during standardization.');
    }

    for (let i = 0; i < vectors.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < numCols; j++) {
            if (isOHEColumn[j]) {
                row.push(vectors[i][j]);
            } else {
                const stdDev = stdDevs[j];
                const scaledValue = (stdDev === 0) ? 0 : (vectors[i][j] - means[j]) / stdDev;
                row.push(scaledValue);
            }
        }
        processedVectors.push(row);
    }
    console.log("[Data Processing Worker] Standardization complete (OHE skipped).");
    return processedVectors;
};

const normalize = (vectors: number[][], isOHEColumn: boolean[], range: NormalizationRange = [0, 1]): number[][] => {
    console.log(`[Data Processing Worker] Normalizing (Min-Max) to [${range.join(', ')}] skipping OHE...`, vectors.length);
    const { mins, maxs } = getColumnMinMax(vectors);
    const [minRange, maxRange] = range;
    const processedVectors: number[][] = [];
    const numCols = vectors[0]?.length ?? 0;

    if (numCols !== isOHEColumn.length) {
        console.error('[Data Processing Worker] Mismatch between vector columns and OHE definition length.');
        throw new Error('Vector column count does not match OHE definition length during normalization.');
    }

     for (let i = 0; i < vectors.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < numCols; j++) {
            if (isOHEColumn[j]) {
                row.push(vectors[i][j]);
            } else {
                const minCol = mins[j];
                const maxCol = maxs[j];
                const rangeCol = maxCol - minCol;
                let scaledValue: number;
                if (rangeCol === 0) {
                    scaledValue = minRange;
                } else {
                    scaledValue = minRange + ((vectors[i][j] - minCol) * (maxRange - minRange)) / rangeCol;
                }
                row.push(scaledValue);
            }
        }
        processedVectors.push(row);
    }
    console.log("[Data Processing Worker] Normalization complete (OHE skipped).");
    return processedVectors;
};

// --- Define specific message types ---

type WorkerRecvMessageData =
    | { type: 'processData', payload: ProcessDataPayload }
    | { type: 'transformData', payload: TransformDataPayload }
    | { type: 'init', payload?: unknown }; // Init might not have a payload

type WorkerSendMessageData =
    | { type: 'processingComplete', payload: { processedVectors: number[][], songIds: string[], stats?: { means?: number[], stdDevs?: number[], mins?: number[], maxs?: number[] } } }
    | { type: 'processingError', payload: { error: string } }
    | { type: 'dataProcessingWorkerReady', payload: boolean }
    | { type: 'transformComplete', payload: { transformedVectors: number[][], songIds: string[] } }
    | { type: 'transformError', payload: { error: string } };

// Helper to post messages with type safety (Optional but good practice)
const postMsg = (message: WorkerSendMessageData) => {
    self.postMessage(message);
};

// Worker message handler
// Use the specific message type union
self.onmessage = (event: MessageEvent<WorkerRecvMessageData>) => {
    const { type, payload } = event.data;
    console.log(`[Data Processing Worker] Received message: ${type}`);

    switch (type) {
        case 'processData':
            try {
                const { vectors, songIds, isOHEColumn, method, range } = payload as ProcessDataPayload;
                let processedVectors: number[][] = [];

                if (!vectors || vectors.length === 0) {
                    throw new Error("Received empty or invalid vectors for processing.");
                }

                if (!isOHEColumn || isOHEColumn.length !== vectors[0]?.length) {
                    throw new Error("Received invalid or mismatched OHE column definition.");
                }

                // --- Log Matrix BEFORE Processing ---
                console.log(`[Data Processing Worker] Matrix BEFORE processing (Method: ${method}, ${vectors.length}x${vectors[0]?.length}):`);
                // Note: console.table might be slow or truncated for very large matrices.
                console.table(vectors);
                // --- End Log ---

                let stats: { means?: number[], stdDevs?: number[], mins?: number[], maxs?: number[] } | undefined = undefined;

                switch (method) {
                    case 'standardize':
                        const stdStats = getColumnStats(vectors);
                        processedVectors = standardize(vectors, isOHEColumn);
                        stats = { means: stdStats.means, stdDevs: stdStats.stdDevs };
                        break;
                    case 'normalize':
                        if (!range) {
                            console.warn("[Data Processing Worker] Normalization range not provided, defaulting to [0, 1].");
                        }
                        const normStats = getColumnMinMax(vectors);
                        processedVectors = normalize(vectors, isOHEColumn, range ?? [0, 1]);
                        stats = { mins: normStats.mins, maxs: normStats.maxs };
                        break;
                    case 'none':
                    default: // Pass through if 'none' or unknown
                         console.log("[Data Processing Worker] Method is 'none', passing data through.");
                        processedVectors = vectors;
                        break;
                }

                // --- Log Matrix AFTER Processing ---
                console.log(`[Data Processing Worker] Matrix AFTER processing (Method: ${method}, ${processedVectors.length}x${processedVectors[0]?.length}):`);
                // Note: console.table might be slow or truncated for very large matrices.
                console.table(processedVectors);
                // --- End Log ---

                // Send processed data back to the main thread with stats
                postMsg({
                    type: 'processingComplete',
                    payload: { processedVectors, songIds, stats }
                });

            } catch (error: unknown) {
                 console.error("[Data Processing Worker] Error processing data:", error);
                 let errorMessage = 'Unknown processing error';
                 if (error instanceof Error) {
                     errorMessage = error.message;
                 } else if (typeof error === 'string') {
                     errorMessage = error;
                 }
                postMsg({
                    type: 'processingError',
                    payload: { error: errorMessage }
                });
            }
            break;

        case 'transformData':
            try {
                const transformPayload = payload as TransformDataPayload;
                const { vectors, songIds, isOHEColumn, method, range, means, stdDevs, mins, maxs } = transformPayload;
                let transformedVectors: number[][] = [];

                if (!vectors || vectors.length === 0) {
                    throw new Error("Received empty or invalid vectors for transformation.");
                }

                if (!isOHEColumn || isOHEColumn.length !== vectors[0]?.length) {
                    throw new Error("Received invalid or mismatched OHE column definition.");
                }

                console.log(`[Data Processing Worker] Transforming data using stored statistics (Method: ${method})...`);

                switch (method) {
                    case 'standardize':
                        if (!means || !stdDevs) {
                            throw new Error("Standardization requires means and stdDevs to be provided.");
                        }
                        transformedVectors = [];
                        const numCols = vectors[0]?.length ?? 0;
                        for (let i = 0; i < vectors.length; i++) {
                            const row: number[] = [];
                            for (let j = 0; j < numCols; j++) {
                                if (isOHEColumn[j]) {
                                    row.push(vectors[i][j]);
                                } else {
                                    const stdDev = stdDevs[j];
                                    const scaledValue = (stdDev === 0) ? 0 : (vectors[i][j] - means[j]) / stdDev;
                                    row.push(scaledValue);
                                }
                            }
                            transformedVectors.push(row);
                        }
                        break;
                    case 'normalize':
                        if (!mins || !maxs) {
                            throw new Error("Normalization requires mins and maxs to be provided.");
                        }
                        if (!range) {
                            console.warn("[Data Processing Worker] Normalization range not provided, defaulting to [0, 1].");
                        }
                        const [minRange, maxRange] = range ?? [0, 1];
                        transformedVectors = [];
                        const numColsNorm = vectors[0]?.length ?? 0;
                        for (let i = 0; i < vectors.length; i++) {
                            const row: number[] = [];
                            for (let j = 0; j < numColsNorm; j++) {
                                if (isOHEColumn[j]) {
                                    row.push(vectors[i][j]);
                                } else {
                                    const minCol = mins[j];
                                    const maxCol = maxs[j];
                                    const rangeCol = maxCol - minCol;
                                    let scaledValue: number;
                                    if (rangeCol === 0) {
                                        scaledValue = minRange;
                                    } else {
                                        scaledValue = minRange + ((vectors[i][j] - minCol) * (maxRange - minRange)) / rangeCol;
                                    }
                                    row.push(scaledValue);
                                }
                            }
                            transformedVectors.push(row);
                        }
                        break;
                    case 'none':
                    default:
                        console.log("[Data Processing Worker] Method is 'none', passing data through.");
                        transformedVectors = vectors;
                        break;
                }

                console.log(`[Data Processing Worker] Transformation complete. ${transformedVectors.length} vectors transformed.`);

                postMsg({
                    type: 'transformComplete',
                    payload: { transformedVectors, songIds }
                });

            } catch (error: unknown) {
                console.error("[Data Processing Worker] Error transforming data:", error);
                let errorMessage = 'Unknown transformation error';
                if (error instanceof Error) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }
                postMsg({
                    type: 'transformError',
                    payload: { error: errorMessage }
                });
            }
            break;

        case 'init': // Placeholder for potential future initialization
            console.log("[Data Processing Worker] Initialized.");
            // Optionally post back readiness
             postMsg({ type: 'dataProcessingWorkerReady', payload: true });
            break;

        default:
            console.warn(`[Data Processing Worker] Unknown message type received: ${type}`);
    }
};

// Optional: Handle initialization errors or unhandled rejections
self.onerror = (event) => {
    console.error('[Data Processing Worker] Uncaught error:', event);
    // Optionally inform the main thread about a critical failure
};

console.log("[Data Processing Worker] Worker script loaded.");
// Signal readiness on load (alternative to explicit 'init' message)
// self.postMessage({ type: 'dataProcessingWorkerReady', payload: true }); 