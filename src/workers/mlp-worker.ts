/// <reference lib="webworker" />

import {
    MlpWorkerController,
    type MlpWorkerRecvMessage,
    type MlpWorkerSendMessage,
} from '../lib/mlpWorkerContract';

declare const self: DedicatedWorkerGlobalScope;

const controller = new MlpWorkerController();

const postMsg = (message: MlpWorkerSendMessage) => {
    self.postMessage(message);
};

self.onmessage = async (event: MessageEvent<MlpWorkerRecvMessage>) => {
    await controller.handleMessage(event.data, postMsg);
};

self.postMessage({ type: 'mlpWorkerReady' });
