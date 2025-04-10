/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!***********************************************!*\
  !*** ./src/workers/data-processing-worker.ts ***!
  \***********************************************/

/// <reference lib="webworker" />
// --- Helper Functions for Scaling ---
// Calculates mean and standard deviation for each column
const getColumnStats = (vectors) => {
    if (!vectors || vectors.length === 0) {
        return { means: [], stdDevs: [] };
    }
    const numCols = vectors[0].length;
    const numRows = vectors.length;
    const means = Array(numCols).fill(0);
    const stdDevs = Array(numCols).fill(0);
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
const getColumnMinMax = (vectors) => {
    if (!vectors || vectors.length === 0) {
        return { mins: [], maxs: [] };
    }
    const numCols = vectors[0].length;
    const mins = [...vectors[0]]; // Initialize with first row
    const maxs = [...vectors[0]]; // Initialize with first row
    for (let j = 0; j < numCols; j++) {
        for (let i = 1; i < vectors.length; i++) {
            if (vectors[i][j] < mins[j])
                mins[j] = vectors[i][j];
            if (vectors[i][j] > maxs[j])
                maxs[j] = vectors[i][j];
        }
    }
    return { mins, maxs };
};
// --- Processing Functions ---
const standardize = (vectors, isOHEColumn) => {
    var _a, _b;
    console.log("[Data Processing Worker] Standardizing (Z-score) skipping OHE...", vectors.length);
    const { means, stdDevs } = getColumnStats(vectors);
    const processedVectors = [];
    const numCols = (_b = (_a = vectors[0]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    if (numCols !== isOHEColumn.length) {
        console.error('[Data Processing Worker] Mismatch between vector columns and OHE definition length.');
        throw new Error('Vector column count does not match OHE definition length during standardization.');
    }
    for (let i = 0; i < vectors.length; i++) {
        const row = [];
        for (let j = 0; j < numCols; j++) {
            if (isOHEColumn[j]) {
                row.push(vectors[i][j]);
            }
            else {
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
const normalize = (vectors, isOHEColumn, range = [0, 1]) => {
    var _a, _b;
    console.log(`[Data Processing Worker] Normalizing (Min-Max) to [${range.join(', ')}] skipping OHE...`, vectors.length);
    const { mins, maxs } = getColumnMinMax(vectors);
    const [minRange, maxRange] = range;
    const processedVectors = [];
    const numCols = (_b = (_a = vectors[0]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    if (numCols !== isOHEColumn.length) {
        console.error('[Data Processing Worker] Mismatch between vector columns and OHE definition length.');
        throw new Error('Vector column count does not match OHE definition length during normalization.');
    }
    for (let i = 0; i < vectors.length; i++) {
        const row = [];
        for (let j = 0; j < numCols; j++) {
            if (isOHEColumn[j]) {
                row.push(vectors[i][j]);
            }
            else {
                const minCol = mins[j];
                const maxCol = maxs[j];
                const rangeCol = maxCol - minCol;
                let scaledValue;
                if (rangeCol === 0) {
                    scaledValue = minRange;
                }
                else {
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
// Worker message handler
self.onmessage = (event) => {
    var _a, _b, _c;
    const { type, payload } = event.data;
    console.log(`[Data Processing Worker] Received message: ${type}`);
    switch (type) {
        case 'processData':
            try {
                const { vectors, songIds, isOHEColumn, method, range } = payload;
                let processedVectors = [];
                if (!vectors || vectors.length === 0) {
                    throw new Error("Received empty or invalid vectors for processing.");
                }
                if (!isOHEColumn || isOHEColumn.length !== ((_a = vectors[0]) === null || _a === void 0 ? void 0 : _a.length)) {
                    throw new Error("Received invalid or mismatched OHE column definition.");
                }
                // --- Log Matrix BEFORE Processing ---
                console.log(`[Data Processing Worker] Matrix BEFORE processing (Method: ${method}, ${vectors.length}x${(_b = vectors[0]) === null || _b === void 0 ? void 0 : _b.length}):`);
                // Note: console.table might be slow or truncated for very large matrices.
                console.table(vectors);
                // --- End Log ---
                switch (method) {
                    case 'standardize':
                        processedVectors = standardize(vectors, isOHEColumn);
                        break;
                    case 'normalize':
                        if (!range) {
                            console.warn("[Data Processing Worker] Normalization range not provided, defaulting to [0, 1].");
                        }
                        processedVectors = normalize(vectors, isOHEColumn, range !== null && range !== void 0 ? range : [0, 1]);
                        break;
                    case 'none':
                    default: // Pass through if 'none' or unknown
                        console.log("[Data Processing Worker] Method is 'none', passing data through.");
                        processedVectors = vectors;
                        break;
                }
                // --- Log Matrix AFTER Processing ---
                console.log(`[Data Processing Worker] Matrix AFTER processing (Method: ${method}, ${processedVectors.length}x${(_c = processedVectors[0]) === null || _c === void 0 ? void 0 : _c.length}):`);
                // Note: console.table might be slow or truncated for very large matrices.
                console.table(processedVectors);
                // --- End Log ---
                // Send processed data back to the main thread
                self.postMessage({
                    type: 'processingComplete',
                    payload: { processedVectors, songIds }
                });
            }
            catch (error) {
                console.error("[Data Processing Worker] Error processing data:", error);
                self.postMessage({
                    type: 'processingError',
                    payload: { error: error.message || 'Unknown processing error' }
                });
            }
            break;
        case 'init': // Placeholder for potential future initialization
            console.log("[Data Processing Worker] Initialized.");
            // Optionally post back readiness
            self.postMessage({ type: 'dataProcessingWorkerReady', payload: true });
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

/******/ })()
;
//# sourceMappingURL=data-processing-worker.bundled.js.map