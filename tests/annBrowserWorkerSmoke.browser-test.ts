import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { createServer as createNetServer } from 'node:net';

const host = '127.0.0.1';
const chromeCandidates = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean) as string[];

type CdpMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string; value?: unknown };
  };
};

type BrowserSmokeResult = {
  status: 'passed' | 'failed' | 'running';
  current?: string;
  error?: string;
  results?: Record<string, unknown>;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function websocketDataToString(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  if (data instanceof Blob) return await data.text();
  return String(data);
}

function getOpenPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a browser smoke-test port.'));
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

function findChromeExecutables(): string[] {
  return chromeCandidates.filter(candidate => existsSync(candidate));
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.html':
      return 'text/html; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function browserSmokeHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>ANN Browser Worker Smoke</title>
</head>
<body>
  <main>ANN browser worker smoke is running.</main>
  <script>
    window.__annWorkerSmokeResult = { status: 'running', results: {} };

    const vectors = [
      [1, 10, 1],
      [3, 20, 0],
      [5, 30, 1],
    ];
    const songIds = ['song-a', 'song-b', 'song-c'];
    const isOHEColumn = [false, false, true];
    const featureVectors = [
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 1],
      [3, 1, 1],
    ];
    const nonPcaFeatureVectors = [
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 1],
      [3, 1, 1],
      [4, 0, 2],
      [5, 1, 2],
    ];
    const nonPcaSongIds = ['song-a', 'song-b', 'song-c', 'song-d', 'song-e', 'song-f'];
    const trainingPayload = {
      vectors: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      labels: ['left', 'left', 'right', 'right'],
      labelMap: { left: 0, right: 1 },
      config: {
        layers: 0,
        nodes: [],
        activation: 'relu',
        optimizer: 'sgd',
        learningRate: 0.1,
      },
      trainIterations: 1,
      batchSize: 2,
      splitRatio: 0.5,
      seed: 7,
      activationSampleSongId: 'song-a',
    };

    function assert(condition, message) {
      if (!condition) {
        throw new Error(message);
      }
    }

    function toPlainMatrix(value) {
      assert(Array.isArray(value), 'Expected a matrix array.');
      return value.map(row => {
        assert(Array.isArray(row), 'Expected each matrix row to be an array.');
        return Array.from(row);
      });
    }

    function assertFiniteReductionRows(rows, expectedRows, expectedDimensions) {
      assert(rows.length === expectedRows, 'Unexpected reduction row count.');
      rows.forEach(row => {
        assert(row.length === expectedDimensions, 'Unexpected reduction dimension count.');
        row.forEach(value => assert(Number.isFinite(value), 'Reduction value should be finite.'));
      });
    }

    function createWorkerHarness(workerUrl) {
      const worker = new Worker(workerUrl);
      const messages = [];
      const waiters = [];
      let failure = null;

      function fail(error) {
        failure = error;
        while (waiters.length > 0) {
          const waiter = waiters.shift();
          clearTimeout(waiter.timer);
          waiter.reject(error);
        }
      }

      worker.addEventListener('message', event => {
        messages.push(event.data);
        for (let index = waiters.length - 1; index >= 0; index -= 1) {
          const waiter = waiters[index];
          if (waiter.predicate(event.data)) {
            waiters.splice(index, 1);
            clearTimeout(waiter.timer);
            waiter.resolve(event.data);
          }
        }
      });

      worker.addEventListener('error', event => {
        fail(new Error(workerUrl + ' worker error: ' + event.message));
      });

      worker.addEventListener('messageerror', () => {
        fail(new Error(workerUrl + ' worker produced an unreadable message.'));
      });

      return {
        messages,
        post(message) {
          worker.postMessage(message);
        },
        waitFor(predicate, label, timeoutMs = 45000) {
          const existing = messages.find(predicate);
          if (existing) return Promise.resolve(existing);
          if (failure) return Promise.reject(failure);
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              const index = waiters.findIndex(waiter => waiter.timer === timer);
              if (index >= 0) waiters.splice(index, 1);
              reject(new Error('Timed out waiting for ' + label + ' from ' + workerUrl + '. Seen: ' + JSON.stringify(messages)));
            }, timeoutMs);
            waiters.push({ predicate, resolve, reject, timer });
          });
        },
        terminate() {
          worker.terminate();
        },
      };
    }

    async function runDataProcessingWorkerSmoke() {
      const harness = createWorkerHarness('/workers/data-processing-worker.bundled.js');
      try {
        harness.post({ type: 'init', requestId: 'browser-data-init' });
        const ready = await harness.waitFor(
          message => message.type === 'dataProcessingWorkerReady' && message.requestId === 'browser-data-init',
          'data processing readiness'
        );
        assert(ready.payload === true, 'Data-processing worker should report ready.');

        harness.post({
          type: 'processData',
          requestId: 'browser-data-process',
          payload: { vectors, songIds, isOHEColumn, method: 'standardize' },
        });
        const processed = await harness.waitFor(
          message => message.type === 'processingComplete' && message.requestId === 'browser-data-process',
          'data processing completion'
        );
        const processedRows = toPlainMatrix(processed.payload.processedVectors);
        assert(processedRows.length === 3, 'Data-processing worker should return three rows.');
        assert(Array.from(processed.payload.songIds).join('|') === songIds.join('|'), 'Data-processing song IDs should round-trip.');

        harness.post({
          type: 'transformData',
          requestId: 'browser-data-transform',
          payload: {
            vectors: [[7, 40, 0]],
            songIds: ['uploaded'],
            isOHEColumn,
            method: 'standardize',
            means: Array.from(processed.payload.stats.means),
            stdDevs: Array.from(processed.payload.stats.stdDevs),
          },
        });
        const transformed = await harness.waitFor(
          message => message.type === 'transformComplete' && message.requestId === 'browser-data-transform',
          'data transform completion'
        );
        assert(toPlainMatrix(transformed.payload.transformedVectors).length === 1, 'Data transform should return one row.');
        return { processedRows: processedRows.length };
      } finally {
        harness.terminate();
      }
    }

    async function runDruidWorkerSmoke() {
      const harness = createWorkerHarness('/workers/druid-worker.bundled.js');
      try {
        await harness.waitFor(message => message.type === 'druidWorkerReady', 'Druid worker readiness');

        harness.post({
          type: 'reduceDimensions',
          requestId: 'browser-druid-pca',
          payload: {
            featureVectors,
            songIds: ['song-a', 'song-b', 'song-c', 'song-d'],
            method: 'pca',
            dimensions: 2,
          },
        });
        const pca = await harness.waitFor(
          message => message.type === 'reductionComplete' && message.requestId === 'browser-druid-pca',
          'Druid PCA reduction'
        );
        assertFiniteReductionRows(pca.payload.reducedData, 4, 2);

        for (const payload of [
          { method: 'tsne', requestId: 'browser-druid-tsne', extra: { perplexity: 2 } },
          { method: 'umap', requestId: 'browser-druid-umap', extra: { neighbors: 2, minDist: 0.1 } },
        ]) {
          harness.post({
            type: 'reduceDimensions',
            requestId: payload.requestId,
            payload: {
              featureVectors: nonPcaFeatureVectors,
              songIds: nonPcaSongIds,
              method: payload.method,
              dimensions: 2,
              ...payload.extra,
            },
          });
          const reduced = await harness.waitFor(
            message => message.type === 'reductionComplete' && message.requestId === payload.requestId,
            'Druid ' + payload.method + ' reduction'
          );
          assert(Array.from(reduced.payload.songIds).join('|') === nonPcaSongIds.join('|'), payload.method + ' song IDs should round-trip.');
          assertFiniteReductionRows(reduced.payload.reducedData, nonPcaFeatureVectors.length, 2);
        }

        return { methods: ['pca', 'tsne', 'umap'] };
      } finally {
        harness.terminate();
      }
    }

    async function runMlpWorkerSmoke() {
      const harness = createWorkerHarness('/workers/mlp-worker.bundled.js');
      try {
        await harness.waitFor(message => message.type === 'mlpWorkerReady', 'MLP worker readiness');

        harness.post({
          type: 'infer',
          requestId: 'browser-mlp-infer-before-train',
          payload: { vectors: [[0, 0]], songIds: ['song-a'] },
        });
        const inferBeforeTrain = await harness.waitFor(
          message => message.type === 'mlpError' && message.requestId === 'browser-mlp-infer-before-train',
          'MLP infer-before-train error'
        );
        assert(/Model not trained/.test(inferBeforeTrain.payload.error), 'MLP should reject inference before training.');

        harness.post({
          type: 'train',
          requestId: 'browser-mlp-train',
          payload: trainingPayload,
        });
        const trainingComplete = await harness.waitFor(
          message => message.type === 'trainingComplete' && message.requestId === 'browser-mlp-train',
          'MLP training completion',
          60000
        );
        assert(Number.isFinite(trainingComplete.payload.finalMetrics.loss), 'MLP final loss should be finite.');
        assert(Number.isFinite(trainingComplete.payload.finalMetrics.accuracy), 'MLP final accuracy should be finite.');

        harness.post({
          type: 'infer',
          requestId: 'browser-mlp-infer',
          payload: {
            vectors: [[0, 0], [1, 1]],
            songIds: ['song-a', 'song-d'],
          },
        });
        const inferenceComplete = await harness.waitFor(
          message => message.type === 'inferenceComplete' && message.requestId === 'browser-mlp-infer',
          'MLP inference completion'
        );
        assert(Object.keys(inferenceComplete.payload.results).length === 2, 'MLP inference should return two predictions.');

        harness.post({ type: 'reset', requestId: 'browser-mlp-reset' });
        await harness.waitFor(
          message => message.type === 'mlpResetComplete' && message.requestId === 'browser-mlp-reset',
          'MLP reset completion'
        );
        return { predictions: Object.keys(inferenceComplete.payload.results).length };
      } finally {
        harness.terminate();
      }
    }

    async function runEssentiaWorkerSmoke() {
      const harness = createWorkerHarness('/workers/essentia-worker.bundled.js');
      try {
        harness.post({ type: 'init', requestId: 'browser-essentia-init', payload: {} });
        const init = await harness.waitFor(
          message => message.type === 'essentiaReady',
          'Essentia worker init status',
          60000
        );
        assert(init.payload === true, 'Essentia worker should initialize before extraction.');

        harness.post({
          type: 'extractFeatures',
          requestId: 'browser-essentia-energy-extract',
          payload: {
            songId: 'song-a',
            audioVector: [0, 0.25, -0.25, 0.5, -0.5, 0.1, -0.1, 0],
            sampleRate: 44100,
            featuresToExtract: ['energy'],
          },
        });
        const extraction = await harness.waitFor(
          message => message.requestId === 'browser-essentia-energy-extract' && /featureExtractionComplete|featureExtractionError/.test(message.type),
          'Essentia energy extraction reply',
          60000
        );
        assert(extraction.songId === 'song-a', 'Essentia extraction reply should keep the song ID.');
        assert(
          extraction.type === 'featureExtractionComplete',
          'Essentia energy extraction should complete, got ' + extraction.type + ': ' + (extraction.error ?? '')
        );
        assert(Number.isFinite(extraction.features.energy), 'Essentia energy extraction should return finite energy.');
        assert(extraction.features.energy > 0, 'Essentia energy extraction should return positive energy for the smoke signal.');
        return { initStatus: init.payload, extractionType: extraction.type, energy: extraction.features.energy };
      } finally {
        harness.terminate();
      }
    }

    async function runSmoke() {
      const results = {};
      function mark(current) {
        window.__annWorkerSmokeResult = { status: 'running', current, results };
      }
      try {
        mark('dataProcessing');
        results.dataProcessing = await runDataProcessingWorkerSmoke();
        mark('druid');
        results.druid = await runDruidWorkerSmoke();
        mark('mlp');
        results.mlp = await runMlpWorkerSmoke();
        mark('essentia');
        results.essentia = await runEssentiaWorkerSmoke();
        window.__annWorkerSmokeResult = { status: 'passed', results };
      } catch (error) {
        window.__annWorkerSmokeResult = {
          status: 'failed',
          error: error && error.stack ? error.stack : String(error),
          results,
        };
        throw error;
      }
    }

    runSmoke();
  </script>
</body>
</html>`;
}

function createSmokeServer(port: number): Promise<{ url: string; server: Server }> {
  const publicRoot = resolve(process.cwd(), 'public');
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);

    if (url.pathname === '/ann-worker-browser-smoke') {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(browserSmokeHtml());
      return;
    }

    if (!url.pathname.startsWith('/workers/') && !url.pathname.startsWith('/lib/')) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const relativePath = url.pathname.replace(/^\/+/, '').replace(/\//g, sep);
    const filePath = resolve(publicRoot, relativePath);
    if (!filePath.startsWith(`${publicRoot}${sep}`) || !existsSync(filePath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': getContentType(filePath),
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolveServer({
        url: `http://${host}:${port}/ann-worker-browser-smoke`,
        server,
      });
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}

function launchChrome(chromePath: string, debugPort: number): {
  child: ChildProcessWithoutNullStreams;
  profileDir: string;
  getOutput: () => string;
} {
  const profileDir = mkdtempSync(join(tmpdir(), 'ann-browser-worker-smoke-'));
  let output = '';
  const child = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-popup-blocking',
    '--disable-sync',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-features=RendererCodeIntegrity,DawnGraphite,WebGPU',
    '--remote-allow-origins=*',
    'about:blank',
  ]);

  const appendOutput = (chunk: Buffer) => {
    output += chunk.toString('utf8');
    if (output.length > 12000) output = output.slice(-12000);
  };
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  return {
    child,
    profileDir,
    getOutput: () => output,
  };
}

async function stopChrome(child: ChildProcessWithoutNullStreams, profileDir: string): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    const exited = once(child, 'exit').then(() => true);
    const timedOut = delay(5000).then(() => false);
    if (!(await Promise.race([exited, timedOut]))) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
  }
  rmSync(profileDir, { recursive: true, force: true });
}

async function waitForChromeVersion(
  debugPort: number,
  child: ChildProcessWithoutNullStreams,
  getOutput: () => string
): Promise<{ webSocketDebuggerUrl: string }> {
  const versionUrl = `http://${host}:${debugPort}/json/version`;
  const deadline = Date.now() + 30000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready.\n${getOutput()}`);
    }

    try {
      const response = await fetch(versionUrl);
      if (response.ok) {
        const version = await response.json() as { webSocketDebuggerUrl?: string };
        if (version.webSocketDebuggerUrl) {
          return { webSocketDebuggerUrl: version.webSocketDebuggerUrl };
        }
      }
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for Chrome DevTools. Last error: ${String(lastError)}\n${getOutput()}`);
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (reason?: unknown) => void; timer: NodeJS.Timeout }>();
  readonly events: CdpMessage[] = [];

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener('message', async event => {
      let message: CdpMessage;
      try {
        message = JSON.parse(await websocketDataToString(event.data)) as CdpMessage;
      } catch (error) {
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Could not parse Chrome DevTools websocket message: ${error instanceof Error ? error.message : String(error)}`));
        }
        this.pending.clear();
        return;
      }

      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (pending) clearTimeout(pending.timer);
        if (message.error) {
          pending?.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
        } else {
          pending?.resolve(message.result);
        }
        return;
      }
      this.events.push(message);
    });

    this.socket.addEventListener('error', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chrome DevTools websocket failed.'));
      }
      this.pending.clear();
    });

    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chrome DevTools websocket closed.'));
      }
      this.pending.clear();
    });
  }

  static connect(webSocketDebuggerUrl: string): Promise<CdpClient> {
    const socket = new WebSocket(webSocketDebuggerUrl);
    return new Promise((resolveClient, reject) => {
      socket.addEventListener('open', () => resolveClient(new CdpClient(socket)), { once: true });
      socket.addEventListener('error', () => reject(new Error('Could not open Chrome DevTools websocket.')), { once: true });
    });
  }

  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 30000, sessionId?: string): Promise<any> {
    const id = this.nextId;
    this.nextId += 1;
    const payload = sessionId ? { id, sessionId, method, params } : { id, method, params };
    return new Promise((resolveSend, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Chrome DevTools response to ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveSend, reject, timer });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluateSmokeResult(client: CdpClient, sessionId: string): Promise<BrowserSmokeResult | null> {
  const evaluation = await client.send('Runtime.evaluate', {
    expression: 'window.__annWorkerSmokeResult || null',
    returnByValue: true,
  }, 30000, sessionId) as { result?: { value?: BrowserSmokeResult | null }; exceptionDetails?: CdpMessage['exceptionDetails'] };

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description ?? evaluation.exceptionDetails.text ?? 'Runtime evaluation failed.');
  }

  return evaluation.result?.value ?? null;
}

async function waitForBrowserSmokeResult(client: CdpClient, sessionId: string, timeoutMs = 90000): Promise<BrowserSmokeResult> {
  const deadline = Date.now() + timeoutMs;
  let lastResult: BrowserSmokeResult | null = null;
  while (Date.now() < deadline) {
    const result = await evaluateSmokeResult(client, sessionId);
    lastResult = result;
    if (result?.status === 'passed' || result?.status === 'failed') {
      return result;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ANN browser worker smoke result. Last state: ${JSON.stringify(lastResult)}`);
}

async function runBrowserWorkerSmoke(chromePath: string, url: string): Promise<BrowserSmokeResult> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  let client: CdpClient | null = null;

  try {
    const version = await waitForChromeVersion(debugPort, child, getOutput);
    client = await CdpClient.connect(version.webSocketDebuggerUrl);
    const target = await client.send('Target.createTarget', { url: 'about:blank' }) as { targetId: string };
    const attached = await client.send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    }) as { sessionId: string };
    const { sessionId } = attached;

    await client.send('Runtime.enable', {}, 30000, sessionId);
    await client.send('Page.enable', {}, 30000, sessionId);
    await client.send('Runtime.evaluate', {
      expression: '1 + 1',
      returnByValue: true,
    }, 30000, sessionId).catch(error => {
      throw new Error(`Chrome target crashed before ANN worker page navigation: ${error instanceof Error ? error.message : String(error)}`);
    });
    await client.send('Page.navigate', { url }, 30000, sessionId).catch(error => {
      throw new Error(`Chrome target crashed while navigating to ANN worker page: ${error instanceof Error ? error.message : String(error)}`);
    });

    const result = await waitForBrowserSmokeResult(client, sessionId);
    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return result;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

test('generated ANN worker bundles execute as browser Workers in headless Chrome', { timeout: 300000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-worker smoke coverage.');
    return;
  }

  const serverPort = await getOpenPort();
  const { url, server } = await createSmokeServer(serverPort);
  const failures: string[] = [];

  try {
    for (const chromePath of chromePaths) {
      try {
        const result = await runBrowserWorkerSmoke(chromePath, url);
        assert.equal(result.status, 'passed', result.error ?? `Browser smoke failed: ${JSON.stringify(result)}`);
        assert.ok(result.results?.dataProcessing, 'Expected data-processing browser-worker result.');
        assert.ok(result.results?.druid, 'Expected Druid browser-worker result.');
        assert.ok(result.results?.mlp, 'Expected MLP browser-worker result.');
        assert.ok(result.results?.essentia, 'Expected Essentia browser-worker result.');
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN worker smoke coverage:\n${failures.join('\n\n')}`);
  } finally {
    await closeServer(server);
  }
});
