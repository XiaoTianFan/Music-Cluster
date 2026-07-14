/// <reference lib="webworker" />

import {
    handleDruidWorkerMessage,
    type DruidWorkerRecvMessage,
    type DruidWorkerSendMessage,
} from '../lib/druidWorkerContract';

declare const self: DedicatedWorkerGlobalScope;

const postMsg = (message: DruidWorkerSendMessage) => {
    self.postMessage(message);
};

self.onmessage = async (event: MessageEvent<DruidWorkerRecvMessage>) => {
    await handleDruidWorkerMessage(event.data, postMsg, console);
};

self.onerror = (error) => {
    const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown worker error';
    console.error('[Druid Worker] Unhandled error:', error);
    self.postMessage({ type: 'reductionError', payload: { error: `Unhandled worker error: ${errorMessage}` } });
};

console.log('[Druid Worker] Worker setup complete. Waiting for messages.');
self.postMessage({ type: 'druidWorkerReady' });
