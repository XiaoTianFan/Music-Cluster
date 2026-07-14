export interface WorkerRequestMessage {
  requestId?: string | null;
}

let requestSequence = 0;

export function createWorkerRequestId(scope: string, timestamp = Date.now()): string {
  requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${scope}-${timestamp}-${requestSequence}`;
}

export function isRequestScopedWorkerReply(message: WorkerRequestMessage): boolean {
  return typeof message.requestId === 'string' && message.requestId.length > 0;
}

export function isCurrentWorkerReply(message: WorkerRequestMessage, activeRequestId: string | null): boolean {
  return isRequestScopedWorkerReply(message) && message.requestId === activeRequestId;
}

export function shouldIgnoreRequestScopedReply(message: WorkerRequestMessage, activeRequestId: string | null): boolean {
  return isRequestScopedWorkerReply(message) && message.requestId !== activeRequestId;
}

export function clearActiveWorkerRequestId(activeRequestId: string | null, completedRequestId?: string | null): string | null {
  if (!completedRequestId || completedRequestId === activeRequestId) {
    return null;
  }
  return activeRequestId;
}
