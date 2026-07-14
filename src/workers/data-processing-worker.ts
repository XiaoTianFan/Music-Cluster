/// <reference lib="webworker" />

import {
    handleDataProcessingWorkerMessage,
    type DataProcessingWorkerRecvMessage,
    type DataProcessingWorkerSendMessage,
} from '../lib/dataProcessingWorkerContract';

const postMsg = (message: DataProcessingWorkerSendMessage) => {
    self.postMessage(message);
};

self.onmessage = (event: MessageEvent<DataProcessingWorkerRecvMessage>) => {
    handleDataProcessingWorkerMessage(event.data, postMsg, console);
};

self.onerror = (event) => {
    console.error('[Data Processing Worker] Uncaught error:', event);
};

console.log("[Data Processing Worker] Worker script loaded.");
// Signal readiness on load (alternative to explicit 'init' message)
// self.postMessage({ type: 'dataProcessingWorkerReady', payload: true });
