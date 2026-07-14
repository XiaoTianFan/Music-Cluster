import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { TextDecoder, TextEncoder } from 'node:util';
import vm from 'node:vm';

export type WorkerMessage = {
  type: string;
  requestId?: string;
  payload?: any;
};

const workerBundleDir = join(process.cwd(), 'public', 'workers');

function runWorkerScript(context: vm.Context, filePath: string) {
  try {
    vm.runInContext(readFileSync(filePath, 'utf8'), context, { filename: filePath });
  } catch (error) {
    const errorLike = error as { message?: unknown; stack?: unknown };
    const message = typeof errorLike.message === 'string' ? errorLike.message : String(error);
    const stack = typeof errorLike.stack === 'string'
      ? `\n${errorLike.stack.split('\n').filter(line => line.trimStart().startsWith('at ')).slice(0, 6).join('\n')}`
      : '';
    throw new Error(`Worker bundle failed to evaluate ${filePath}: ${message}${stack}`);
  }
}

export function createWorkerBundleHarness(workerFileName: string) {
  const messages: WorkerMessage[] = [];

  const sandbox: any = {
    console: {
      log() {},
      warn() {},
      error() {},
      table() {},
    },
    ArrayBuffer,
    DataView,
    Float32Array,
    Float64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Number,
    Object,
    Promise,
    Symbol,
    Error,
    TypeError,
    TextDecoder,
    TextEncoder,
    WorkerGlobalScope: function WorkerGlobalScope() {},
    DedicatedWorkerGlobalScope: function DedicatedWorkerGlobalScope() {},
    location: {
      href: 'http://localhost/workers/test-worker.js',
      search: '',
    },
    navigator: {
      userAgent: 'Mozilla/5.0 WorkerHarness',
      vendor: 'Test Harness',
    },
    performance,
    setTimeout,
    clearTimeout,
  };

  if (workerFileName === 'essentia-worker.bundled.js') {
    Object.assign(sandbox, {
      Function,
      WebAssembly,
      setInterval,
      clearInterval,
    });
  }

  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.postMessage = (message: WorkerMessage) => {
    messages.push(message);
  };
  sandbox.importScripts = (...urls: string[]) => {
    for (const url of urls) {
      const fileName = url.replace(/^\/workers\//, '');
      const chunkPath = join(workerBundleDir, fileName);
      runWorkerScript(context, chunkPath);
    }
  };

  const context = vm.createContext(sandbox);
  const workerPath = join(workerBundleDir, workerFileName);
  runWorkerScript(context, workerPath);

  return {
    messages,
    async send(message: WorkerMessage) {
      assert.equal(typeof sandbox.onmessage, 'function', 'Expected worker bundle to register onmessage.');
      await sandbox.onmessage({ data: message });
    },
  };
}
