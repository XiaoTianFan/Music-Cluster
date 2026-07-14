type DruidModule = typeof import('@saehrimnir/druidjs');
type DruidMatrix = import('@saehrimnir/druidjs').Matrix;
type DruidReducer = import('@saehrimnir/druidjs').DR;

export type ReductionMethod = 'pca' | 'tsne' | 'umap';

export interface ReduceDimensionsPayload {
  featureVectors: number[][];
  songIds: string[];
  method: ReductionMethod;
  dimensions: number;
  perplexity?: number;
  neighbors?: number;
  minDist?: number;
}

export interface TransformNewDataPayload {
  newVectors: number[][];
  songIds: string[];
  method: ReductionMethod;
  dimensions: number;
  trainingVectors: number[][];
  perplexity?: number;
  neighbors?: number;
  minDist?: number;
}

export type DruidWorkerRecvMessage =
  | ({ type: 'reduceDimensions'; payload: ReduceDimensionsPayload } & { requestId?: string })
  | ({ type: 'transformNewData'; payload: TransformNewDataPayload } & { requestId?: string });

type WithRequestId<T> = T & { requestId?: string };

export type DruidWorkerSendMessage =
  | WithRequestId<{ type: 'druidWorkerReady'; payload?: true }>
  | WithRequestId<{ type: 'reductionComplete'; payload: { reducedData: number[][]; songIds: string[] } }>
  | WithRequestId<{ type: 'transformNewDataComplete'; payload: { reducedData: number[][]; songIds: string[] } }>
  | WithRequestId<{ type: 'reductionError'; payload: { error: string } }>;

type DruidLogger = Pick<Console, 'log' | 'warn' | 'error'>;

const defaultLogger: DruidLogger = console;

function isTypedNumericArray(value: unknown): value is ArrayLike<number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ArrayBuffer.isView(value as ArrayLike<unknown>) &&
    !(value instanceof DataView)
  );
}

function ensureNumericValue(
  value: unknown,
  methodLabel: string,
  rowIndex: number,
  colIndex: number
): number {
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
}

function rowLikeToNumberArray(value: unknown, methodLabel: string, rowIndex: number): number[] {
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
}

function splitTypedRows(value: ArrayLike<number>, dimensions: number): number[][] {
  const flat = Array.from(value);
  const rows: number[][] = [];
  for (let index = 0; index < flat.length; index += dimensions) {
    rows.push(flat.slice(index, index + dimensions));
  }
  return rows;
}

function getRawRows(value: unknown, expectedRows: number, dimensions: number): unknown[] {
  if (Array.isArray(value)) return value;
  if (isTypedNumericArray(value)) {
    const flat = Array.from(value as ArrayLike<number>);
    if (flat.length === expectedRows * dimensions) return splitTypedRows(flat, dimensions);
    return [flat];
  }
  if (typeof value === 'object' && value !== null) return [value];
  return [value];
}

function normalizeReducedRows(
  value: unknown,
  expectedRows: number,
  dimensions: number,
  methodLabel: string,
  logger: DruidLogger
): number[][] {
  const rows = getRawRows(value, expectedRows, dimensions).map((row, index) => {
    const numericRow = rowLikeToNumberArray(row, methodLabel, index);
    if (numericRow.length === dimensions) return numericRow;

    logger.warn(
      `[Druid Worker] [${methodLabel}] Vector at index ${index} has ${numericRow.length} dimensions, expected ${dimensions}. Padding/truncating.`
    );
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

function validateMatrix(name: string, vectors: number[][]): number[][] {
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

function validateDimensions(dimensions: number): void {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`Invalid reduction dimensions: ${dimensions}.`);
  }
}

async function loadDruid(): Promise<DruidModule> {
  return import('@saehrimnir/druidjs');
}

function createReducer(
  druidApi: DruidModule,
  method: ReductionMethod,
  matrix: DruidMatrix,
  payload: ReduceDimensionsPayload | TransformNewDataPayload
): DruidReducer {
  switch (method) {
    case 'pca':
      return new druidApi.PCA(matrix, { d: payload.dimensions });
    case 'tsne':
      return new druidApi.TSNE(matrix, {
        d: payload.dimensions,
        perplexity: payload.perplexity ?? 30,
      });
    case 'umap':
      return new druidApi.UMAP(matrix, {
        d: payload.dimensions,
        n_neighbors: payload.neighbors ?? 5,
        min_dist: payload.minDist ?? 0.1,
      });
    default:
      throw new Error(`Unsupported dimensionality reduction method: ${method satisfies never}`);
  }
}

function withRequestId<T extends DruidWorkerSendMessage>(message: T, requestId?: string): T {
  return requestId ? { ...message, requestId } : message;
}

async function reduceDimensions(payload: ReduceDimensionsPayload, logger: DruidLogger): Promise<{ reducedData: number[][]; songIds: string[] }> {
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
  const reducedData = normalizeReducedRows(
    reducedMatrix instanceof druidApi.Matrix ? reducedMatrix.to2dArray : reducedMatrix,
    featureVectors.length,
    payload.dimensions,
    payload.method.toUpperCase(),
    logger
  );

  return { reducedData, songIds: payload.songIds };
}

async function transformNewData(payload: TransformNewDataPayload, logger: DruidLogger): Promise<{ reducedData: number[][]; songIds: string[] }> {
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
    const reducedData = normalizeReducedRows(
      transformedResult instanceof druidApi.Matrix ? transformedResult.to2dArray : transformedResult,
      newVectors.length,
      payload.dimensions,
      'PCA',
      logger
    );
    return { reducedData, songIds: payload.songIds };
  }

  logger.log(`[Druid Worker] ${payload.method.toUpperCase()} requires re-fitting with training and new data.`);
  const combinedVectors = [...trainingVectors, ...newVectors];
  const combinedMatrix = druidApi.Matrix.from(combinedVectors);
  const reducer = createReducer(druidApi, payload.method, combinedMatrix, payload);
  const combinedReduced = reducer.transform();
  const combinedReducedRows = normalizeReducedRows(
    combinedReduced instanceof druidApi.Matrix ? combinedReduced.to2dArray : combinedReduced,
    combinedVectors.length,
    payload.dimensions,
    payload.method.toUpperCase(),
    logger
  );

  return {
    reducedData: combinedReducedRows.slice(trainingVectors.length),
    songIds: payload.songIds,
  };
}

export async function handleDruidWorkerMessage(
  message: DruidWorkerRecvMessage,
  postMessage: (message: DruidWorkerSendMessage) => void,
  logger: DruidLogger = defaultLogger
): Promise<void> {
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
        throw new Error(`Unsupported Druid worker message: ${(message as { type?: string }).type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Druid Worker] ${message.type} failed:`, error);
    postMessage(withRequestId({ type: 'reductionError', payload: { error: errorMessage } }, requestId));
  }
}
