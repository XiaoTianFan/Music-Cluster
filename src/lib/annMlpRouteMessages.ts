import type { InferenceResult } from './annPipeline';
import {
  isRequestScopedWorkerReply,
  shouldIgnoreRequestScopedReply,
  type WorkerRequestMessage,
} from './workerRequestIds';

export interface AnnMlpRouteMessage extends WorkerRequestMessage {
  type: string;
  payload?: any;
}

export type AnnMlpRouteMessageDisposition = 'request-client' | 'stale' | 'legacy';

const mlpRequestClientMessageTypes = new Set([
  'epochMetrics',
  'activationSnapshot',
  'modelStateSnapshot',
  'trainingPhase',
  'trainingSessionReady',
  'trainingPaused',
  'trainingComplete',
  'inferenceComplete',
  'modelExportComplete',
  'modelImportComplete',
  'mlpError',
]);

export function isAnnMlpRequestClientMessage(type: string): boolean {
  return mlpRequestClientMessageTypes.has(type);
}

export function getAnnMlpRouteMessageDisposition(
  message: AnnMlpRouteMessage,
  activeRequestId: string | null
): AnnMlpRouteMessageDisposition {
  if (isRequestScopedWorkerReply(message) && isAnnMlpRequestClientMessage(message.type)) {
    return 'request-client';
  }

  if (shouldIgnoreRequestScopedReply(message, activeRequestId)) {
    return 'stale';
  }

  return 'legacy';
}

export function formatAnnMlpInferenceResults(payload: any): Record<string, InferenceResult> {
  const formattedResults: Record<string, InferenceResult> = {};
  if (!payload?.results) return formattedResults;

  for (const songId in payload.results) {
    const result = payload.results[songId];
    if (typeof result === 'string') {
      formattedResults[songId] = { predictedLabel: result, confidence: 0 };
    } else if (result?.predictedLabel) {
      formattedResults[songId] = result;
    }
  }

  return formattedResults;
}

export function getAnnWorkerErrorMessage(message: AnnMlpRouteMessage, fallback: string): string {
  return message.payload?.error ?? fallback;
}
