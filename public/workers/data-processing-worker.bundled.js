/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/lib/dataProcessing.ts":
/*!***********************************!*\
  !*** ./src/lib/dataProcessing.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getColumnMinMax: () => (/* binding */ getColumnMinMax),
/* harmony export */   getColumnStats: () => (/* binding */ getColumnStats),
/* harmony export */   normalizeWithStats: () => (/* binding */ normalizeWithStats),
/* harmony export */   processDataMatrix: () => (/* binding */ processDataMatrix),
/* harmony export */   standardizeWithStats: () => (/* binding */ standardizeWithStats),
/* harmony export */   transformDataMatrix: () => (/* binding */ transformDataMatrix)
/* harmony export */ });
function cloneVectors(vectors) {
    return vectors.map(row => [...row]);
}
function validateMatrix(vectors, isOHEColumn) {
    if (!vectors || vectors.length === 0 || !Array.isArray(vectors[0])) {
        throw new Error('Received empty or invalid vectors.');
    }
    const numCols = vectors[0].length;
    if (numCols === 0) {
        throw new Error('Received vectors with no columns.');
    }
    if (!isOHEColumn || isOHEColumn.length !== numCols) {
        throw new Error('Received invalid or mismatched OHE column definition.');
    }
    if (!vectors.every(row => row.length === numCols && row.every(Number.isFinite))) {
        throw new Error('Vectors must be finite and share the same column count.');
    }
    return numCols;
}
function validateStats(stats, numCols, label) {
    if (!stats || stats.length !== numCols || !stats.every(Number.isFinite)) {
        throw new Error(`${label} must be provided for every matrix column.`);
    }
    return stats;
}
function getColumnStats(vectors) {
    if (!vectors || vectors.length === 0) {
        return { means: [], stdDevs: [] };
    }
    const numCols = vectors[0].length;
    const numRows = vectors.length;
    const means = Array(numCols).fill(0);
    const stdDevs = Array(numCols).fill(0);
    for (let colIndex = 0; colIndex < numCols; colIndex++) {
        let sum = 0;
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
            sum += vectors[rowIndex][colIndex];
        }
        means[colIndex] = sum / numRows;
    }
    for (let colIndex = 0; colIndex < numCols; colIndex++) {
        let sumSqDiff = 0;
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
            sumSqDiff += Math.pow(vectors[rowIndex][colIndex] - means[colIndex], 2);
        }
        stdDevs[colIndex] = Math.sqrt(sumSqDiff / numRows);
    }
    return { means, stdDevs };
}
function getColumnMinMax(vectors) {
    if (!vectors || vectors.length === 0) {
        return { mins: [], maxs: [] };
    }
    const numCols = vectors[0].length;
    const mins = [...vectors[0]];
    const maxs = [...vectors[0]];
    for (let colIndex = 0; colIndex < numCols; colIndex++) {
        for (let rowIndex = 1; rowIndex < vectors.length; rowIndex++) {
            mins[colIndex] = Math.min(mins[colIndex], vectors[rowIndex][colIndex]);
            maxs[colIndex] = Math.max(maxs[colIndex], vectors[rowIndex][colIndex]);
        }
    }
    return { mins, maxs };
}
function standardizeWithStats(vectors, isOHEColumn, means, stdDevs) {
    const numCols = validateMatrix(vectors, isOHEColumn);
    const validatedMeans = validateStats(means, numCols, 'Standardization means');
    const validatedStdDevs = validateStats(stdDevs, numCols, 'Standardization stdDevs');
    return vectors.map(row => row.map((value, colIndex) => {
        if (isOHEColumn[colIndex])
            return value;
        const stdDev = validatedStdDevs[colIndex];
        return stdDev === 0 ? 0 : (value - validatedMeans[colIndex]) / stdDev;
    }));
}
function normalizeWithStats(vectors, isOHEColumn, mins, maxs, range = [0, 1]) {
    const numCols = validateMatrix(vectors, isOHEColumn);
    const validatedMins = validateStats(mins, numCols, 'Normalization mins');
    const validatedMaxs = validateStats(maxs, numCols, 'Normalization maxs');
    const [minRange, maxRange] = range;
    return vectors.map(row => row.map((value, colIndex) => {
        if (isOHEColumn[colIndex])
            return value;
        const minCol = validatedMins[colIndex];
        const maxCol = validatedMaxs[colIndex];
        const rangeCol = maxCol - minCol;
        return rangeCol === 0
            ? minRange
            : minRange + ((value - minCol) * (maxRange - minRange)) / rangeCol;
    }));
}
function processDataMatrix(input) {
    const { vectors, isOHEColumn, method, range } = input;
    validateMatrix(vectors, isOHEColumn);
    switch (method) {
        case 'standardize': {
            const { means, stdDevs } = getColumnStats(vectors);
            return {
                processedVectors: standardizeWithStats(vectors, isOHEColumn, means, stdDevs),
                stats: { means, stdDevs },
            };
        }
        case 'normalize': {
            const { mins, maxs } = getColumnMinMax(vectors);
            return {
                processedVectors: normalizeWithStats(vectors, isOHEColumn, mins, maxs, range !== null && range !== void 0 ? range : [0, 1]),
                stats: { mins, maxs },
            };
        }
        case 'none':
            return {
                processedVectors: cloneVectors(vectors),
                stats: {},
            };
        default:
            throw new Error(`Unsupported processing method: ${method}`);
    }
}
function transformDataMatrix(input) {
    const { vectors, isOHEColumn, method, range, means, stdDevs, mins, maxs } = input;
    const numCols = validateMatrix(vectors, isOHEColumn);
    switch (method) {
        case 'standardize':
            return standardizeWithStats(vectors, isOHEColumn, validateStats(means, numCols, 'Standardization means'), validateStats(stdDevs, numCols, 'Standardization stdDevs'));
        case 'normalize':
            return normalizeWithStats(vectors, isOHEColumn, validateStats(mins, numCols, 'Normalization mins'), validateStats(maxs, numCols, 'Normalization maxs'), range !== null && range !== void 0 ? range : [0, 1]);
        case 'none':
            return cloneVectors(vectors);
        default:
            throw new Error(`Unsupported processing method: ${method}`);
    }
}


/***/ }),

/***/ "./src/lib/dataProcessingWorkerContract.ts":
/*!*************************************************!*\
  !*** ./src/lib/dataProcessingWorkerContract.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleDataProcessingWorkerMessage: () => (/* binding */ handleDataProcessingWorkerMessage)
/* harmony export */ });
/* harmony import */ var _dataProcessing__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dataProcessing */ "./src/lib/dataProcessing.ts");

const noopLogger = {
    log: () => { },
    warn: () => { },
    error: () => { },
};
function getErrorMessage(error, fallback) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    return fallback;
}
function withRequestId(message, requestId) {
    return requestId ? Object.assign(Object.assign({}, message), { requestId }) : message;
}
function handleDataProcessingWorkerMessage(message, postMessage, logger = noopLogger) {
    var _a, _b, _c, _d;
    logger.log(`[Data Processing Worker] Received message: ${message.type}`);
    const requestId = message.requestId;
    const reply = (replyMessage) => {
        postMessage(withRequestId(replyMessage, requestId));
    };
    switch (message.type) {
        case 'processData':
            try {
                const { vectors, songIds, isOHEColumn, method, range } = message.payload;
                logger.log(`[Data Processing Worker] Matrix BEFORE processing (Method: ${method}, ${vectors.length}x${(_a = vectors[0]) === null || _a === void 0 ? void 0 : _a.length}):`);
                (_b = logger.table) === null || _b === void 0 ? void 0 : _b.call(logger, vectors);
                const { processedVectors, stats } = (0,_dataProcessing__WEBPACK_IMPORTED_MODULE_0__.processDataMatrix)({ vectors, isOHEColumn, method, range });
                logger.log(`[Data Processing Worker] Matrix AFTER processing (Method: ${method}, ${processedVectors.length}x${(_c = processedVectors[0]) === null || _c === void 0 ? void 0 : _c.length}):`);
                (_d = logger.table) === null || _d === void 0 ? void 0 : _d.call(logger, processedVectors);
                reply({
                    type: 'processingComplete',
                    payload: { processedVectors, songIds, stats },
                });
            }
            catch (error) {
                logger.error('[Data Processing Worker] Error processing data:', error);
                reply({
                    type: 'processingError',
                    payload: { error: getErrorMessage(error, 'Unknown processing error') },
                });
            }
            break;
        case 'transformData':
            try {
                const { vectors, songIds, isOHEColumn, method, range, means, stdDevs, mins, maxs } = message.payload;
                logger.log(`[Data Processing Worker] Transforming data using stored statistics (Method: ${method})...`);
                const transformedVectors = (0,_dataProcessing__WEBPACK_IMPORTED_MODULE_0__.transformDataMatrix)({
                    vectors,
                    isOHEColumn,
                    method,
                    range,
                    means,
                    stdDevs,
                    mins,
                    maxs,
                });
                logger.log(`[Data Processing Worker] Transformation complete. ${transformedVectors.length} vectors transformed.`);
                reply({
                    type: 'transformComplete',
                    payload: { transformedVectors, songIds },
                });
            }
            catch (error) {
                logger.error('[Data Processing Worker] Error transforming data:', error);
                reply({
                    type: 'transformError',
                    payload: { error: getErrorMessage(error, 'Unknown transformation error') },
                });
            }
            break;
        case 'init':
            logger.log('[Data Processing Worker] Initialized.');
            reply({ type: 'dataProcessingWorkerReady', payload: true });
            break;
        default:
            logger.warn(`[Data Processing Worker] Unknown message type received: ${message.type}`);
    }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***********************************************!*\
  !*** ./src/workers/data-processing-worker.ts ***!
  \***********************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _lib_dataProcessingWorkerContract__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/dataProcessingWorkerContract */ "./src/lib/dataProcessingWorkerContract.ts");
/// <reference lib="webworker" />

const postMsg = (message) => {
    self.postMessage(message);
};
self.onmessage = (event) => {
    (0,_lib_dataProcessingWorkerContract__WEBPACK_IMPORTED_MODULE_0__.handleDataProcessingWorkerMessage)(event.data, postMsg, console);
};
self.onerror = (event) => {
    console.error('[Data Processing Worker] Uncaught error:', event);
};
console.log("[Data Processing Worker] Worker script loaded.");
// Signal readiness on load (alternative to explicit 'init' message)
// self.postMessage({ type: 'dataProcessingWorkerReady', payload: true });

})();

/******/ })()
;
//# sourceMappingURL=data-processing-worker.bundled.js.map