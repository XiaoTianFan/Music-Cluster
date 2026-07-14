import {
  processDataMatrix,
  transformDataMatrix,
  type NormalizationRange,
  type ProcessingMethod,
} from './dataProcessing';

export interface ProcessDataPayload {
  vectors: number[][];
  songIds: string[];
  isOHEColumn: boolean[];
  method: ProcessingMethod;
  range?: NormalizationRange;
}

export interface TransformDataPayload {
  vectors: number[][];
  songIds: string[];
  isOHEColumn: boolean[];
  method: ProcessingMethod;
  range?: NormalizationRange;
  means?: number[];
  stdDevs?: number[];
  mins?: number[];
  maxs?: number[];
}

type WithRequestId<T> = T & { requestId?: string };

export type DataProcessingWorkerRecvMessage = WithRequestId<
  | { type: 'processData'; payload: ProcessDataPayload }
  | { type: 'transformData'; payload: TransformDataPayload }
  | { type: 'init'; payload?: unknown }
>;

export type DataProcessingWorkerSendMessage = WithRequestId<
  | { type: 'processingComplete'; payload: { processedVectors: number[][]; songIds: string[]; stats: { means?: number[]; stdDevs?: number[]; mins?: number[]; maxs?: number[] } } }
  | { type: 'processingError'; payload: { error: string } }
  | { type: 'dataProcessingWorkerReady'; payload: boolean }
  | { type: 'transformComplete'; payload: { transformedVectors: number[][]; songIds: string[] } }
  | { type: 'transformError'; payload: { error: string } }
>;

export interface DataProcessingWorkerLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  table?: (tabularData?: unknown, properties?: string[]) => void;
}

const noopLogger: DataProcessingWorkerLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

function withRequestId<T extends DataProcessingWorkerSendMessage>(
  message: T,
  requestId: string | undefined
): T {
  return requestId ? { ...message, requestId } : message;
}

export function handleDataProcessingWorkerMessage(
  message: DataProcessingWorkerRecvMessage,
  postMessage: (message: DataProcessingWorkerSendMessage) => void,
  logger: DataProcessingWorkerLogger = noopLogger
): void {
  logger.log(`[Data Processing Worker] Received message: ${message.type}`);
  const requestId = message.requestId;
  const reply = (replyMessage: DataProcessingWorkerSendMessage) => {
    postMessage(withRequestId(replyMessage, requestId));
  };

  switch (message.type) {
    case 'processData':
      try {
        const { vectors, songIds, isOHEColumn, method, range } = message.payload;

        logger.log(`[Data Processing Worker] Matrix BEFORE processing (Method: ${method}, ${vectors.length}x${vectors[0]?.length}):`);
        logger.table?.(vectors);

        const { processedVectors, stats } = processDataMatrix({ vectors, isOHEColumn, method, range });

        logger.log(`[Data Processing Worker] Matrix AFTER processing (Method: ${method}, ${processedVectors.length}x${processedVectors[0]?.length}):`);
        logger.table?.(processedVectors);

        reply({
          type: 'processingComplete',
          payload: { processedVectors, songIds, stats },
        });
      } catch (error: unknown) {
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
        const transformedVectors = transformDataMatrix({
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
      } catch (error: unknown) {
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
      logger.warn(`[Data Processing Worker] Unknown message type received: ${(message as { type?: string }).type}`);
  }
}
