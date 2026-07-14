import { isCurrentWorkerReply } from './workerRequestIds';

export interface WorkerMessageEvent<TMessage> {
  data: TMessage;
}

export type WorkerMessageListener<TMessage> = (event: WorkerMessageEvent<TMessage>) => void;

export interface WorkerRequestTarget<TIncoming, TOutgoing> {
  addEventListener(type: 'message', listener: WorkerMessageListener<TIncoming>): void;
  removeEventListener(type: 'message', listener: WorkerMessageListener<TIncoming>): void;
  postMessage(message: TOutgoing): void;
}

export interface WorkerReplyMessage {
  type: string;
  requestId?: string | null;
  payload?: unknown;
}

export interface SendWorkerRequestOptions<TIncoming extends WorkerReplyMessage, TOutgoing, TResult> {
  worker: WorkerRequestTarget<TIncoming, TOutgoing>;
  message: TOutgoing;
  requestId: string;
  successTypes: readonly string[];
  errorTypes?: readonly string[];
  progressTypes?: readonly string[];
  getResult: (message: TIncoming) => TResult;
  getErrorMessage?: (message: TIncoming) => string;
  onProgress?: (message: TIncoming) => void;
  isRequestActive?: (requestId: string) => boolean;
  timeoutMs?: number;
  onSettled?: (requestId: string) => void;
}

function defaultErrorMessage(message: WorkerReplyMessage): string {
  const payload = message.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return `${message.type} failed.`;
}

export function sendWorkerRequest<TIncoming extends WorkerReplyMessage, TOutgoing, TResult>(
  options: SendWorkerRequestOptions<TIncoming, TOutgoing, TResult>
): Promise<TResult> {
  const {
    worker,
    message,
    requestId,
    successTypes,
    errorTypes = [],
    progressTypes = [],
    getResult,
    getErrorMessage = defaultErrorMessage,
    onProgress,
    isRequestActive,
    timeoutMs,
    onSettled,
  } = options;

  const successTypeSet = new Set(successTypes);
  const errorTypeSet = new Set(errorTypes);
  const progressTypeSet = new Set(progressTypes);

  return new Promise<TResult>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      onSettled?.(requestId);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleMessage: WorkerMessageListener<TIncoming> = (event) => {
      const reply = event.data;
      if (!isCurrentWorkerReply(reply, requestId)) return;

      if (isRequestActive) {
        let active: boolean;
        try {
          active = isRequestActive(requestId);
        } catch (error) {
          settle(() => reject(error instanceof Error ? error : new Error(String(error))));
          return;
        }
        if (!active) {
          settle(() => reject(new Error(`Worker request ${requestId} is no longer active.`)));
          return;
        }
      }

      if (successTypeSet.has(reply.type)) {
        let result: TResult;
        try {
          result = getResult(reply);
        } catch (error) {
          settle(() => reject(error instanceof Error ? error : new Error(String(error))));
          return;
        }
        settle(() => resolve(result));
        return;
      }

      if (errorTypeSet.has(reply.type)) {
        settle(() => reject(new Error(getErrorMessage(reply))));
        return;
      }

      if (progressTypeSet.has(reply.type)) {
        try {
          onProgress?.(reply);
        } catch (error) {
          settle(() => reject(error instanceof Error ? error : new Error(String(error))));
        }
      }
    };

    worker.addEventListener('message', handleMessage);
    if (timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        settle(() => reject(new Error(`Worker request ${requestId} timed out after ${timeoutMs}ms.`)));
      }, timeoutMs);
    }

    try {
      worker.postMessage(message);
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    }
  });
}
