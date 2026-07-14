/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/lib/druidWorkerContract.ts":
/*!****************************************!*\
  !*** ./src/lib/druidWorkerContract.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleDruidWorkerMessage: () => (/* binding */ handleDruidWorkerMessage)
/* harmony export */ });
const defaultLogger = console;
function isTypedNumericArray(value) {
    return (typeof value === 'object' &&
        value !== null &&
        ArrayBuffer.isView(value) &&
        !(value instanceof DataView));
}
function ensureNumericValue(value, methodLabel, rowIndex, colIndex) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`[Druid Worker] [${methodLabel}] Value at row ${rowIndex}, col ${colIndex} is not finite.`);
        }
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
    }
    throw new Error(`[Druid Worker] [${methodLabel}] Value at row ${rowIndex}, col ${colIndex} is not numeric (received ${typeof value}).`);
}
function rowLikeToNumberArray(value, methodLabel, rowIndex) {
    if (Array.isArray(value)) {
        return value.map((colValue, colIndex) => ensureNumericValue(colValue, methodLabel, rowIndex, colIndex));
    }
    if (isTypedNumericArray(value)) {
        return Array.from(value).map((colValue, colIndex) => ensureNumericValue(colValue, methodLabel, rowIndex, colIndex));
    }
    if (typeof value === 'object' && value !== null) {
        const numericKeys = Object.keys(value)
            .filter(key => !Number.isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b));
        if (numericKeys.length > 0) {
            return numericKeys.map((key, index) => ensureNumericValue(value[key], methodLabel, rowIndex, index));
        }
    }
    if (typeof value === 'number') {
        return [ensureNumericValue(value, methodLabel, rowIndex, 0)];
    }
    throw new Error(`[Druid Worker] [${methodLabel}] Unable to convert row ${rowIndex} of type ${typeof value} to numeric array.`);
}
function splitTypedRows(value, dimensions) {
    const flat = Array.from(value);
    const rows = [];
    for (let index = 0; index < flat.length; index += dimensions) {
        rows.push(flat.slice(index, index + dimensions));
    }
    return rows;
}
function getRawRows(value, expectedRows, dimensions) {
    if (Array.isArray(value))
        return value;
    if (isTypedNumericArray(value)) {
        const flat = Array.from(value);
        if (flat.length === expectedRows * dimensions)
            return splitTypedRows(flat, dimensions);
        return [flat];
    }
    if (typeof value === 'object' && value !== null)
        return [value];
    return [value];
}
function normalizeReducedRows(value, expectedRows, dimensions, methodLabel, logger) {
    const rows = getRawRows(value, expectedRows, dimensions).map((row, index) => {
        const numericRow = rowLikeToNumberArray(row, methodLabel, index);
        if (numericRow.length === dimensions)
            return numericRow;
        logger.warn(`[Druid Worker] [${methodLabel}] Vector at index ${index} has ${numericRow.length} dimensions, expected ${dimensions}. Padding/truncating.`);
        if (numericRow.length < dimensions) {
            return [...numericRow, ...Array(dimensions - numericRow.length).fill(0)];
        }
        return numericRow.slice(0, dimensions);
    });
    if (rows.length !== expectedRows) {
        throw new Error(`Transformed data length (${rows.length}) does not match input length (${expectedRows}).`);
    }
    rows.forEach((row, index) => {
        if (row.length !== dimensions || !row.every(Number.isFinite)) {
            throw new Error(`[${methodLabel}] Transformed data at index ${index} is not a finite ${dimensions}D vector.`);
        }
    });
    return rows;
}
function validateMatrix(name, vectors) {
    if (!Array.isArray(vectors) || vectors.length === 0 || !Array.isArray(vectors[0]) || vectors[0].length === 0) {
        throw new Error(`Received empty or invalid ${name}.`);
    }
    const expectedColumns = vectors[0].length;
    return vectors.map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== expectedColumns) {
            throw new Error(`${name} row ${rowIndex} has inconsistent dimensions.`);
        }
        return row.map((value, colIndex) => ensureNumericValue(value, name, rowIndex, colIndex));
    });
}
function validateDimensions(dimensions) {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
        throw new Error(`Invalid reduction dimensions: ${dimensions}.`);
    }
}
async function loadDruid() {
    return __webpack_require__.e(/*! import() */ "vendors-node_modules_saehrimnir_druidjs_src_index_js").then(__webpack_require__.bind(__webpack_require__, /*! @saehrimnir/druidjs */ "./node_modules/@saehrimnir/druidjs/src/index.js"));
}
function createReducer(druidApi, method, matrix, payload) {
    var _a, _b, _c;
    switch (method) {
        case 'pca':
            return new druidApi.PCA(matrix, { d: payload.dimensions });
        case 'tsne':
            return new druidApi.TSNE(matrix, {
                d: payload.dimensions,
                perplexity: (_a = payload.perplexity) !== null && _a !== void 0 ? _a : 30,
            });
        case 'umap':
            return new druidApi.UMAP(matrix, {
                d: payload.dimensions,
                n_neighbors: (_b = payload.neighbors) !== null && _b !== void 0 ? _b : 5,
                min_dist: (_c = payload.minDist) !== null && _c !== void 0 ? _c : 0.1,
            });
        default:
            throw new Error(`Unsupported dimensionality reduction method: ${method}`);
    }
}
function withRequestId(message, requestId) {
    return requestId ? Object.assign(Object.assign({}, message), { requestId }) : message;
}
async function reduceDimensions(payload, logger) {
    validateDimensions(payload.dimensions);
    const featureVectors = validateMatrix('feature vectors', payload.featureVectors);
    const druidApi = await loadDruid();
    if (!Array.isArray(payload.songIds) || featureVectors.length !== payload.songIds.length) {
        throw new Error('Mismatch between number of feature vectors and song IDs.');
    }
    if (featureVectors.length <= payload.dimensions) {
        throw new Error(`Insufficient data points (${featureVectors.length}) for ${payload.dimensions} dimensions.`);
    }
    logger.log(`[Druid Worker] Starting reduction with method: ${payload.method}, target dimensions: ${payload.dimensions}`);
    const matrix = druidApi.Matrix.from(featureVectors);
    const reducer = createReducer(druidApi, payload.method, matrix, payload);
    const reducedMatrix = reducer.transform();
    const reducedData = normalizeReducedRows(reducedMatrix instanceof druidApi.Matrix ? reducedMatrix.to2dArray : reducedMatrix, featureVectors.length, payload.dimensions, payload.method.toUpperCase(), logger);
    return { reducedData, songIds: payload.songIds };
}
async function transformNewData(payload, logger) {
    validateDimensions(payload.dimensions);
    const newVectors = validateMatrix('new vectors', payload.newVectors);
    const trainingVectors = validateMatrix('training vectors', payload.trainingVectors);
    const druidApi = await loadDruid();
    if (!Array.isArray(payload.songIds) || newVectors.length !== payload.songIds.length) {
        throw new Error('Mismatch between number of new vectors and song IDs.');
    }
    const newVectorDim = newVectors[0].length;
    const trainingVectorDim = trainingVectors[0].length;
    if (newVectorDim !== trainingVectorDim) {
        throw new Error(`Dimension mismatch: new vectors have ${newVectorDim} dimensions, training vectors have ${trainingVectorDim} dimensions.`);
    }
    if (payload.method === 'pca') {
        logger.log('[Druid Worker] Using PCA for transformation.');
        const trainingMatrix = druidApi.Matrix.from(trainingVectors);
        const pcaModel = new druidApi.PCA(trainingMatrix, { d: payload.dimensions });
        pcaModel.transform();
        const transformedResult = pcaModel.transform(newVectors);
        const reducedData = normalizeReducedRows(transformedResult instanceof druidApi.Matrix ? transformedResult.to2dArray : transformedResult, newVectors.length, payload.dimensions, 'PCA', logger);
        return { reducedData, songIds: payload.songIds };
    }
    logger.log(`[Druid Worker] ${payload.method.toUpperCase()} requires re-fitting with training and new data.`);
    const combinedVectors = [...trainingVectors, ...newVectors];
    const combinedMatrix = druidApi.Matrix.from(combinedVectors);
    const reducer = createReducer(druidApi, payload.method, combinedMatrix, payload);
    const combinedReduced = reducer.transform();
    const combinedReducedRows = normalizeReducedRows(combinedReduced instanceof druidApi.Matrix ? combinedReduced.to2dArray : combinedReduced, combinedVectors.length, payload.dimensions, payload.method.toUpperCase(), logger);
    return {
        reducedData: combinedReducedRows.slice(trainingVectors.length),
        songIds: payload.songIds,
    };
}
async function handleDruidWorkerMessage(message, postMessage, logger = defaultLogger) {
    const { requestId } = message;
    try {
        switch (message.type) {
            case 'reduceDimensions': {
                const result = await reduceDimensions(message.payload, logger);
                postMessage(withRequestId({ type: 'reductionComplete', payload: result }, requestId));
                return;
            }
            case 'transformNewData': {
                const result = await transformNewData(message.payload, logger);
                postMessage(withRequestId({ type: 'transformNewDataComplete', payload: result }, requestId));
                return;
            }
            default:
                throw new Error(`Unsupported Druid worker message: ${message.type}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[Druid Worker] ${message.type} failed:`, error);
        postMessage(withRequestId({ type: 'reductionError', payload: { error: errorMessage } }, requestId));
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
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
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
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".bundled.js";
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
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "/workers/";
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/importScripts chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "already loaded"
/******/ 		var installedChunks = {
/******/ 			"druid-worker": 1
/******/ 		};
/******/
/******/ 		// importScripts chunk loading
/******/ 		var installChunk = (data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			while(chunkIds.length)
/******/ 				installedChunks[chunkIds.pop()] = 1;
/******/ 			parentChunkLoadingFunction(data);
/******/ 		};
/******/ 		__webpack_require__.f.i = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					importScripts(__webpack_require__.p + __webpack_require__.u(chunkId));
/******/ 				}
/******/ 			}
/******/ 		};
/******/
/******/ 		var chunkLoadingGlobal = self["webpackChunksongcluster"] = self["webpackChunksongcluster"] || [];
/******/ 		var parentChunkLoadingFunction = chunkLoadingGlobal.push.bind(chunkLoadingGlobal);
/******/ 		chunkLoadingGlobal.push = installChunk;
/******/
/******/ 		// no HMR
/******/
/******/ 		// no HMR manifest
/******/ 	})();
/******/
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*************************************!*\
  !*** ./src/workers/druid-worker.ts ***!
  \*************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _lib_druidWorkerContract__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/druidWorkerContract */ "./src/lib/druidWorkerContract.ts");
/// <reference lib="webworker" />

const postMsg = (message) => {
    self.postMessage(message);
};
self.onmessage = async (event) => {
    await (0,_lib_druidWorkerContract__WEBPACK_IMPORTED_MODULE_0__.handleDruidWorkerMessage)(event.data, postMsg, console);
};
self.onerror = (error) => {
    const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown worker error';
    console.error('[Druid Worker] Unhandled error:', error);
    self.postMessage({ type: 'reductionError', payload: { error: `Unhandled worker error: ${errorMessage}` } });
};
console.log('[Druid Worker] Worker setup complete. Waiting for messages.');
self.postMessage({ type: 'druidWorkerReady' });

})();

/******/ })()
;
//# sourceMappingURL=druid-worker.bundled.js.map