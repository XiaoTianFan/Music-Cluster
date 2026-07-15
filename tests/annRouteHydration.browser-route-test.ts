import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { ANN_SETUP_STORAGE_KEY } from '../src/lib/annSetupPersistence';

const host = '127.0.0.1';
const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const labelName = 'Browser Smoke Label';
const uploadFileName = 'browser-upload.wav';
const realUploadFileName = 'browser-real-upload.mp3';
const inferenceFileName = 'browser-inference.wav';
const realInferenceFileName = 'browser-real-inference.mp3';
const trainingLabelA = 'Browser Route Alpha';
const trainingLabelB = 'Browser Route Beta';
const trainingSongIds = [
  '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3',
  '/audio/Excerpt_Yes - Roundabout.mp3',
  '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3',
  '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3',
] as const;
const dragRestoreSongId = '/audio/Excerpt_Frank Sinatra - Fly Me To The Moon.mp3';
const unassignedListId = '__unassigned__';
const realUploadSourcePath = join(
  process.cwd(),
  'public',
  'audio',
  'Excerpt_Richard Wagner - Ride of the Valkyries.mp3'
);
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
  params?: any;
  result?: unknown;
  error?: { message?: string };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string; value?: unknown };
  };
};

type RouteState = {
  href: string;
  title: string;
  textLength: number;
  textExcerpt: string;
  hasFrameworkError: boolean;
  hasInitializingOverlay: boolean;
  hasHeader: boolean;
  hasReadyStatus: boolean;
  hasLabelEditor: boolean;
  hasUnassignedSongs: boolean;
  hasFeatureExtraction: boolean;
  hasTrainInfer: boolean;
  hasProgramLogs: boolean;
  hasExtractButton: boolean;
  hasTrainButton: boolean;
  hasInferButton: boolean;
  hasUploadedInferButton: boolean;
  hasProcessButton: boolean;
  hasReduceButton: boolean;
  trainButtonDisabled: boolean | null;
  inferButtonDisabled: boolean | null;
  uploadedInferButtonDisabled: boolean | null;
  processButtonDisabled: boolean | null;
  reduceButtonDisabled: boolean | null;
  inferenceFileDisabled: boolean | null;
  createButtonDisabled: boolean | null;
  selectedDataStage: string | null;
  hasStoredSmokeLabel: boolean;
  hasSmokeLabel: boolean;
  hasSmokeLabelLog: boolean;
  hasTrainingLabelA: boolean;
  hasTrainingLabelB: boolean;
  hasSeededLabelCounts: boolean;
  hasDragUnderSampledCounts: boolean;
  hasDragRestoredCounts: boolean;
  hasDragRestoredPersisted: boolean;
  hasUploadedTrainingSong: boolean;
  hasRealUploadedTrainingSong: boolean;
  hasUploadedAddedLog: boolean;
  hasRestoreLog: boolean;
  hasDefaultCacheLoadedLog: boolean;
  hasDefaultCacheUnavailableLog: boolean;
  hasCacheUseLog: boolean;
  hasCacheCompleteLog: boolean;
  hasPreparedEnergyMatrixLog: boolean;
  hasPreparedTwoFeatureMatrixLog: boolean;
  hasDefaultCacheBypassExtractionLog: boolean;
  hasDefaultCacheBypassExtractionCompleteLog: boolean;
  hasMixedExtractionLog: boolean;
  hasMixedExtractionCompleteLog: boolean;
  hasPreparedMixedMatrixLog: boolean;
  hasProcessingStartedLog: boolean;
  hasProcessingCompleteLog: boolean;
  hasReductionStartedLog: boolean;
  hasPcaReductionStartedLog: boolean;
  hasReductionCompleteLog: boolean;
  hasStaleProcessErrorLog: boolean;
  hasStaleReductionErrorLog: boolean;
  hasRawTrainingInputLog: boolean;
  hasProcessedTrainingInputLog: boolean;
  hasReducedTrainingInputLog: boolean;
  hasTrainingStartedLog: boolean;
  hasTrainingCompleteLog: boolean;
  hasTrainingSummary: boolean;
  hasRawTrainingSummary: boolean;
  hasReducedTrainingSummary: boolean;
  hasTrainedNetworkStatus: boolean;
  hasNetworkActivationStatus: boolean;
  hasNetworkActivationLayers: boolean;
  hasNetworkActivationMeans: boolean;
  hasNetworkActivationNodeValues: boolean;
  hasNetworkActivationOutputLabels: boolean;
  hasStaleTrainingErrorLog: boolean;
  hasProcessedInferenceInputLog: boolean;
  hasInferenceStartedLog: boolean;
  hasDatasetInferenceCompleteLog: boolean;
  hasDatasetEvaluation: boolean;
  hasDatasetEvaluationPerfectAccuracy: boolean;
  hasDatasetEvaluationConfidenceSummary: boolean;
  hasValidationGuidance: boolean;
  hasValidationPlan: boolean;
  hasValidationExecutionPlan: boolean;
  hasValidationRunButton: boolean;
  hasValidationRunStartedLog: boolean;
  hasValidationRunCompleteLog: boolean;
  hasValidationRunResults: boolean;
  hasModelComparisonPendingRun: boolean;
  hasModelComparisonEvaluatedRun: boolean;
  hasStaleInferenceErrorLog: boolean;
  hasInferenceFileName: boolean;
  hasRealInferenceFileName: boolean;
  hasUploadedInferenceCompleteLog: boolean;
  hasUploadedPrediction: boolean;
  hasUploadedPredictionConfidence: boolean;
  hasStaleTransformErrorLog: boolean;
  hasUploadedInferenceFailureLog: boolean;
  hasUncachedExtractionLog: boolean;
  hasFeatureExtractionErrorLog: boolean;
  syntheticDefaultAudioFetchCount: number;
  transformDataRequestCount: number;
  transformNewDataRequestCount: number;
  realExtractFeaturesRequestCount: number;
  realProcessDataRequestCount: number;
  realReduceDimensionsRequestCount: number;
  realTransformDataRequestCount: number;
  realTransformNewDataRequestCount: number;
};

type ActivationPaintSummary = {
  width: number;
  height: number;
  sampledPixels: number;
  colorfulPixels: number;
  cyanPixels: number;
  greenPixels: number;
  warmPixels: number;
};

type PngImage = {
  width: number;
  height: number;
  rgba: Uint8Array;
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
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a browser route-test port.'));
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

function startNextDev(port: number): { child: ChildProcessWithoutNullStreams; getOutput: () => string } {
  let output = '';
  const child = spawn(process.execPath, [
    nextBin,
    'dev',
    '--turbopack',
    '--hostname',
    host,
    '--port',
    String(port),
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  const appendOutput = (chunk: Buffer) => {
    output += chunk.toString('utf8');
    if (output.length > 12000) output = output.slice(-12000);
  };

  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  return {
    child,
    getOutput: () => output,
  };
}

async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill();
  const exited = once(child, 'exit').then(() => true);
  const timedOut = delay(5000).then(() => false);
  if (!(await Promise.race([exited, timedOut]))) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

async function waitForAnnRouteHttp(
  url: string,
  child: ChildProcessWithoutNullStreams,
  getOutput: () => string
): Promise<void> {
  const deadline = Date.now() + 70000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Next dev server exited before /ann responded.\n${getOutput()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for /ann. Last error: ${String(lastError)}\n${getOutput()}`);
}

function launchChrome(chromePath: string, debugPort: number): {
  child: ChildProcessWithoutNullStreams;
  profileDir: string;
  getOutput: () => string;
} {
  const profileDir = mkdtempSync(join(tmpdir(), 'ann-route-hydration-'));
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
  await stopProcess(child);
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      rmSync(profileDir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code ?? '') || attempt === 6) {
        console.warn(`Could not remove Chrome profile directory ${profileDir}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await delay(250 * attempt);
    }
  }
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
        if (version.webSocketDebuggerUrl) return { webSocketDebuggerUrl: version.webSocketDebuggerUrl };
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

async function evaluateInPage<T>(client: CdpClient, sessionId: string, expression: string): Promise<T> {
  const evaluation = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  }, 30000, sessionId) as { result?: { value?: T }; exceptionDetails?: CdpMessage['exceptionDetails'] };

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description ?? evaluation.exceptionDetails.text ?? 'Runtime evaluation failed.');
  }

  return evaluation.result?.value as T;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodePngRgba(buffer: Buffer): PngImage {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(0, signature.length).equals(signature), true, 'Activation screenshot should be a PNG image.');

  let offset = signature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlaceMethod = data.readUInt8(12);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  assert.ok(width > 0 && height > 0, 'Activation screenshot PNG should have dimensions.');
  assert.equal(bitDepth, 8, 'Activation screenshot PNG should use 8-bit channels.');
  assert.equal(interlaceMethod, 0, 'Activation screenshot PNG should not be interlaced.');
  assert.ok(colorType === 2 || colorType === 6, `Unsupported activation screenshot PNG color type: ${colorType}`);

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = new Uint8Array(width * height * 4);
  let readOffset = 0;
  let previousRow = new Uint8Array(stride);
  let currentRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = inflated[readOffset++];
    for (let x = 0; x < stride; x++) {
      const raw = inflated[readOffset++] ?? 0;
      const left = x >= bytesPerPixel ? currentRow[x - bytesPerPixel] : 0;
      const up = previousRow[x] ?? 0;
      const upperLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;
      let value = raw;

      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upperLeft);
      else assert.equal(filter, 0, `Unsupported activation screenshot PNG row filter: ${filter}`);

      currentRow[x] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const sourceOffset = x * bytesPerPixel;
      const targetOffset = (y * width + x) * 4;
      rgba[targetOffset] = currentRow[sourceOffset];
      rgba[targetOffset + 1] = currentRow[sourceOffset + 1];
      rgba[targetOffset + 2] = currentRow[sourceOffset + 2];
      rgba[targetOffset + 3] = colorType === 6 ? currentRow[sourceOffset + 3] : 255;
    }

    const rowToReuse = previousRow;
    previousRow = currentRow;
    currentRow = rowToReuse;
    currentRow.fill(0);
  }

  return { width, height, rgba };
}

function summarizeActivationPaint(image: PngImage): ActivationPaintSummary {
  let sampledPixels = 0;
  let colorfulPixels = 0;
  let cyanPixels = 0;
  let greenPixels = 0;
  let warmPixels = 0;

  for (let index = 0; index < image.rgba.length; index += 4) {
    const alpha = image.rgba[index + 3];
    if (alpha < 16) continue;

    const red = image.rgba[index];
    const green = image.rgba[index + 1];
    const blue = image.rgba[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const chroma = max - min;
    const brightness = (red + green + blue) / 3;
    sampledPixels += 1;

    if (chroma >= 20 && brightness >= 25) colorfulPixels += 1;
    if (blue > red + 12 && green > red + 12 && brightness >= 35) cyanPixels += 1;
    if (green > red + 12 && green >= blue - 8 && brightness >= 35) greenPixels += 1;
    if (red > blue + 12 && green > blue + 8 && brightness >= 35) warmPixels += 1;
  }

  return {
    width: image.width,
    height: image.height,
    sampledPixels,
    colorfulPixels,
    cyanPixels,
    greenPixels,
    warmPixels,
  };
}

async function captureActivationPaintSummary(client: CdpClient, sessionId: string): Promise<ActivationPaintSummary> {
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const node = document.querySelector('[data-ann-network-node-active="true"]');
      node?.scrollIntoView({ block: 'center', inline: 'center' });
    })()`,
  }, 30000, sessionId);
  await delay(100);

  const rect = await evaluateInPage<{
    x: number;
    y: number;
    width: number;
    height: number;
    activeNodeCount: number;
  }>(client, sessionId, `(() => {
    const nodes = Array.from(document.querySelectorAll('[data-ann-network-node-active="true"]'));
    const rects = nodes
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0, activeNodeCount: 0 };
    const margin = 8;
    const left = Math.max(0, Math.floor(Math.min(...rects.map(rect => rect.left)) - margin));
    const top = Math.max(0, Math.floor(Math.min(...rects.map(rect => rect.top)) - margin));
    const right = Math.min(window.innerWidth, Math.ceil(Math.max(...rects.map(rect => rect.right)) + margin));
    const bottom = Math.min(window.innerHeight, Math.ceil(Math.max(...rects.map(rect => rect.bottom)) + margin));
    return {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      activeNodeCount: rects.length,
    };
  })()`);

  assert.ok(rect.activeNodeCount >= 3, `Expected active network nodes before screenshot capture, got ${rect.activeNodeCount}.`);
  assert.ok(rect.width >= 20 && rect.height >= 20, `Expected a visible activation screenshot clip, got ${JSON.stringify(rect)}.`);

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: 1,
    },
  }, 30000, sessionId) as { data?: string };
  assert.ok(screenshot.data, 'Activation screenshot capture should return PNG data.');

  return summarizeActivationPaint(decodePngRgba(Buffer.from(screenshot.data, 'base64')));
}

function routeStateExpression(): string {
  return `(() => {
    const text = document.body?.textContent ?? '';
    const html = document.documentElement?.innerHTML ?? '';
    const buttons = Array.from(document.querySelectorAll('button')).map(button => ({
      text: (button.textContent ?? '').replace(/\\s+/g, ' ').trim(),
      disabled: button.disabled,
    }));
    const findButton = label => buttons.find(button => button.text === label) ?? null;
    const annMockMessages = Array.isArray(window.__annMockWorkerMessages) ? window.__annMockWorkerMessages : [];
    const annRealMessages = Array.isArray(window.__annRealWorkerMessages) ? window.__annRealWorkerMessages : [];
    const countMockMessages = type => annMockMessages.filter(message => message?.type === type).length;
    const countRealMessages = type => annRealMessages.filter(message => message?.type === type).length;
    return {
      href: location.href,
      title: document.title,
      textLength: text.length,
      textExcerpt: text.slice(0, 1200),
      hasFrameworkError: /Application error|Unhandled Runtime Error/i.test(text),
      hasInitializingOverlay: text.includes('Please wait, loading necessary components.'),
      hasHeader: text.includes('Music Classification (ANN)'),
      hasReadyStatus: /\\bReady\\b/.test(text),
      hasLabelEditor: !!document.querySelector('input[placeholder="New Label Name..."]'),
      hasUnassignedSongs: text.includes('Unassigned Songs'),
      hasFeatureExtraction: text.includes('1. Feature Extraction'),
      hasTrainInfer: text.includes('5. Training') && text.includes('6. Inference'),
      hasProgramLogs: text.includes('Program Logs'),
      hasExtractButton: !!findButton('Extract Features'),
      hasTrainButton: !!findButton('Train Automatic'),
      hasInferButton: !!findButton('Infer Labels'),
      hasUploadedInferButton: !!findButton('Infer Uploaded Audio'),
      hasProcessButton: !!findButton('Process Data'),
      hasReduceButton: !!findButton('Reduce Dimensions'),
      trainButtonDisabled: findButton('Train Automatic')?.disabled ?? null,
      inferButtonDisabled: findButton('Infer Labels')?.disabled ?? null,
      uploadedInferButtonDisabled: findButton('Infer Uploaded Audio')?.disabled ?? null,
      processButtonDisabled: findButton('Process Data')?.disabled ?? null,
      reduceButtonDisabled: findButton('Reduce Dimensions')?.disabled ?? null,
      inferenceFileDisabled: document.querySelector('#annInferenceFile')?.disabled ?? null,
      createButtonDisabled: findButton('Create')?.disabled ?? null,
      selectedDataStage: document.querySelector('#data-stage-select')?.value ?? null,
      hasStoredSmokeLabel: (localStorage.getItem('${ANN_SETUP_STORAGE_KEY}') ?? '').includes('${labelName}'),
      hasSmokeLabel: text.includes('${labelName}'),
      hasSmokeLabelLog: text.includes('Created label list: "${labelName}"'),
      hasTrainingLabelA: text.includes('${trainingLabelA}'),
      hasTrainingLabelB: text.includes('${trainingLabelB}'),
      hasSeededLabelCounts: text.includes('${trainingLabelA} (2)') && text.includes('${trainingLabelB} (2)'),
      hasDragUnderSampledCounts: text.includes('${trainingLabelA} (1)') && text.includes('${trainingLabelB} (3)'),
      hasDragRestoredCounts: text.includes('${trainingLabelA} (2)') && text.includes('${trainingLabelB} (3)'),
      hasDragRestoredPersisted: (localStorage.getItem('${ANN_SETUP_STORAGE_KEY}') ?? '').includes('${dragRestoreSongId}'),
      hasUploadedTrainingSong: text.includes('${uploadFileName}'),
      hasRealUploadedTrainingSong: text.includes('${realUploadFileName}'),
      hasUploadedAddedLog: text.includes('Added 1 uploaded training song. Extract features again before training.'),
      hasRestoreLog: text.includes('[ANN Setup] Restored saved labels and pipeline settings.'),
      hasDefaultCacheLoadedLog: text.includes('[ANN Cache] Loaded cached default features for 25 songs.'),
      hasDefaultCacheUnavailableLog: text.includes('[ANN Cache] Default feature cache unavailable; uncached feature extraction will use workers.'),
      hasCacheUseLog: text.includes('[ANN Cache] Using cached default features for 25 songs.'),
      hasCacheCompleteLog: text.includes('Feature preparation complete from cache. Success: 25, Errors: 0'),
      hasPreparedEnergyMatrixLog: text.includes('Prepared ANN matrix: 25 songs, 1 columns.'),
      hasPreparedTwoFeatureMatrixLog: text.includes('Prepared ANN matrix: 25 songs, 2 columns.'),
      hasDefaultCacheBypassExtractionLog: text.includes('Extracting uncached features for 25 songs with the Essentia worker.'),
      hasDefaultCacheBypassExtractionCompleteLog: text.includes('Feature extraction complete. Success: 25, Errors: 0'),
      hasMixedExtractionLog: text.includes('Extracting uncached features for 1 song with the Essentia worker.'),
      hasMixedExtractionCompleteLog: text.includes('Feature extraction complete. Success: 26, Errors: 0'),
      hasPreparedMixedMatrixLog: text.includes('Prepared ANN matrix: 26 songs, 1 columns.'),
      hasProcessingStartedLog:
        text.includes('Processing data matrix (25 songs, 1 dims) using standardize...') ||
        text.includes('Processing data matrix (25 songs, 2 dims) using standardize...'),
      hasProcessingCompleteLog:
        text.includes('Data processing complete. New dimensions: 1') ||
        text.includes('Data processing complete. New dimensions: 2'),
      hasReductionStartedLog: text.includes('Starting dimensionality reduction using umap to 2 dimensions...'),
      hasPcaReductionStartedLog: text.includes('Starting dimensionality reduction using pca to 2 dimensions...'),
      hasReductionCompleteLog: text.includes('Dimensionality reduction complete.'),
      hasStaleProcessErrorLog: text.includes('stale process should be ignored'),
      hasStaleReductionErrorLog: text.includes('stale reduction should be ignored'),
      hasRawTrainingInputLog: text.includes('Using raw/unprocessed data for training.'),
      hasProcessedTrainingInputLog: text.includes('Using processed data for training.'),
      hasReducedTrainingInputLog: text.includes('Using reduced data for training.'),
      hasTrainingStartedLog: text.includes('Starting training with 4 labeled songs across 2 classes...'),
      hasTrainingCompleteLog: text.includes('Training complete. Final Test Accuracy: 87.50%'),
      hasTrainingSummary: text.includes('Training summary') && text.includes('processed / 1 dims') && text.includes('4 songs / 2 labels') && text.includes('87.5%'),
      hasRawTrainingSummary: text.includes('Training summary') && text.includes('raw / 1 dims') && text.includes('4 songs / 2 labels') && text.includes('87.5%'),
      hasReducedTrainingSummary: text.includes('Training summary') && text.includes('reduced / 2 dims') && text.includes('4 songs / 2 labels') && text.includes('87.5%'),
      hasTrainedNetworkStatus: text.includes('Trained model'),
      hasNetworkActivationStatus: (document.querySelector('[data-ann-network-status]')?.textContent ?? '').includes('Trained model'),
      hasNetworkActivationLayers:
        !!document.querySelector('[data-ann-network-layer="Input"][data-ann-network-layer-active="true"]') &&
        !!document.querySelector('[data-ann-network-layer="Hidden 1"][data-ann-network-layer-active="true"]') &&
        !!document.querySelector('[data-ann-network-layer="Output"][data-ann-network-layer-active="true"]'),
      hasNetworkActivationMeans:
        text.includes('1 units | mean 0.250') &&
        text.includes('16 units | mean 0.250') &&
        text.includes('2 units | mean 0.500'),
      hasNetworkActivationNodeValues: (() => {
        const titles = Array.from(document.querySelectorAll('[data-ann-network-node-active="true"]'))
          .map(element => element.getAttribute('title') ?? '');
        return titles.includes('Input node 1: 0.2500') &&
          titles.includes('Hidden 1 node 4: 0.4000') &&
          titles.includes('Output node 1: 0.8000');
      })(),
      hasNetworkActivationOutputLabels:
        !!document.querySelector('[data-ann-network-output-label="${trainingLabelA}"]') &&
        !!document.querySelector('[data-ann-network-output-label="${trainingLabelB}"]'),
      hasStaleTrainingErrorLog: text.includes('stale training should be ignored'),
      hasProcessedInferenceInputLog: text.includes('Using processed data for inference.'),
      hasInferenceStartedLog: text.includes('Starting inference on 25 songs...'),
      hasDatasetInferenceCompleteLog: text.includes('Dataset inference complete.'),
      hasDatasetEvaluation: text.includes('Dataset evaluation') && text.includes('4/4'),
      hasDatasetEvaluationPerfectAccuracy: text.includes('Dataset evaluation') && text.includes('100.0%'),
      hasDatasetEvaluationConfidenceSummary:
        text.includes('Avg confidence') &&
        text.includes('92.0%') &&
        text.includes('Low confidence') &&
        text.includes('0 below 70.0%'),
      hasValidationGuidance:
        text.includes('Validation guidance') &&
        text.includes('Exploratory validation') &&
        text.includes('leave-one-out') &&
        text.includes('All 4 evaluated predictions are at or above 70.0%'),
      hasValidationPlan:
        text.includes('Validation plan') &&
        text.includes('4 folds ready') &&
        text.includes('4 songs / 2 labels') &&
        text.includes('First fold holds out 1 song'),
      hasValidationExecutionPlan:
        text.includes('Validation execution') &&
        text.includes('4 train/infer payloads ready') &&
        text.includes('First payload trains 3 songs and validates 1'),
      hasValidationRunButton: text.includes('Run Validation'),
      hasValidationRunStartedLog: text.includes('Starting validation run with 4 folds...'),
      hasValidationRunCompleteLog: text.includes('Validation run complete. Accuracy: 100.00%'),
      hasValidationRunResults:
        text.includes('Validation results') &&
        text.includes('4/4 correct') &&
        text.includes('100.0%') &&
        text.includes('Avg confidence') &&
        text.includes('92.0%'),
      hasModelComparisonPendingRun:
        text.includes('Model comparison') &&
        text.includes('Run 1') &&
        text.includes('processed / 1 dims') &&
        text.includes('Test 87.5%') &&
        text.includes('Dataset pending'),
      hasModelComparisonEvaluatedRun:
        text.includes('Model comparison') &&
        text.includes('Best dataset accuracy 100.0%') &&
        text.includes('Dataset 100.0%') &&
        text.includes('4/4') &&
        text.includes('+50.0 pts'),
      hasStaleInferenceErrorLog: text.includes('stale inference should be ignored'),
      hasInferenceFileName: text.includes('File: ${inferenceFileName}'),
      hasRealInferenceFileName: text.includes('File: ${realInferenceFileName}'),
      hasUploadedInferenceCompleteLog: text.includes('Uploaded inference complete.'),
      hasUploadedPrediction: text.includes('Uploaded prediction: ${trainingLabelA}'),
      hasUploadedPredictionConfidence: text.includes('Uploaded prediction: ${trainingLabelA}') && text.includes('92.0%'),
      hasStaleTransformErrorLog: text.includes('stale transform should be ignored'),
      hasUploadedInferenceFailureLog: text.includes('Uploaded inference failed'),
      hasUncachedExtractionLog: text.includes('Extracting uncached features'),
      hasFeatureExtractionErrorLog: text.includes('Error extracting features for') || text.includes('Feature extraction complete. Success: 25, Errors: 1'),
      syntheticDefaultAudioFetchCount: window.__annSyntheticDefaultAudioFetchCount ?? 0,
      transformDataRequestCount: countMockMessages('transformData'),
      transformNewDataRequestCount: countMockMessages('transformNewData'),
      realExtractFeaturesRequestCount: countRealMessages('extractFeatures'),
      realProcessDataRequestCount: countRealMessages('processData'),
      realReduceDimensionsRequestCount: countRealMessages('reduceDimensions'),
      realTransformDataRequestCount: countRealMessages('transformData'),
      realTransformNewDataRequestCount: countRealMessages('transformNewData'),
    };
  })()`;
}

async function getRouteState(client: CdpClient, sessionId: string): Promise<RouteState> {
  return await evaluateInPage<RouteState>(client, sessionId, routeStateExpression());
}

async function waitForRouteState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: RouteState) => boolean,
  label: string,
  timeoutMs = 45000
): Promise<RouteState> {
  const deadline = Date.now() + timeoutMs;
  let lastState: RouteState | null = null;

  while (Date.now() < deadline) {
    const state = await getRouteState(client, sessionId);
    lastState = state;
    if (predicate(state)) return state;
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${label}. Last route state: ${JSON.stringify(lastState)}`);
}

async function waitForCdpEvent(
  client: CdpClient,
  predicate: (event: CdpMessage) => boolean,
  label: string,
  timeoutMs = 10000
): Promise<CdpMessage> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const event = client.events.find(predicate);
    if (event) return event;
    await delay(100);
  }

  throw new Error(`Timed out waiting for Chrome DevTools event: ${label}.`);
}

async function createLabelThroughReactUi(client: CdpClient, sessionId: string): Promise<{ disabledBeforeClick: boolean | null }> {
  return await evaluateInPage<{ disabledBeforeClick: boolean | null }>(client, sessionId, `(() => {
    const input = document.querySelector('input[placeholder="New Label Name..."]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Could not find new-label input.');
    const createButton = Array.from(document.querySelectorAll('button')).find(button => (button.textContent ?? '').trim() === 'Create');
    if (!(createButton instanceof HTMLButtonElement)) throw new Error('Could not find Create button.');
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) throw new Error('Could not find native input value setter.');
    valueSetter.call(input, '${labelName}');
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '${labelName}' }));
    const disabledBeforeClick = createButton.disabled;
    createButton.click();
    return { disabledBeforeClick };
  })()`);
}

async function clickButtonByText(client: CdpClient, sessionId: string, label: string): Promise<{ disabledBeforeClick: boolean }> {
  return await evaluateInPage<{ disabledBeforeClick: boolean }>(client, sessionId, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(candidate => (candidate.textContent ?? '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)});
    if (!(button instanceof HTMLButtonElement)) throw new Error('Could not find button: ${label}');
    const disabledBeforeClick = button.disabled;
    button.click();
    return { disabledBeforeClick };
  })()`);
}

async function pointerClickButtonByText(client: CdpClient, sessionId: string, label: string): Promise<{ disabledBeforeClick: boolean }> {
  const target = await evaluateInPage<{ x: number; y: number; disabledBeforeClick: boolean }>(client, sessionId, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(candidate => (candidate.textContent ?? '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)});
    if (!(button instanceof HTMLButtonElement)) throw new Error('Could not find button: ${label}');
    button.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      disabledBeforeClick: button.disabled,
    };
  })()`);
  if (!target.disabledBeforeClick) {
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: target.x,
      y: target.y,
      button: 'none',
    }, 30000, sessionId);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: target.x,
      y: target.y,
      button: 'left',
      clickCount: 1,
    }, 30000, sessionId);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: target.x,
      y: target.y,
      button: 'left',
      clickCount: 1,
    }, 30000, sessionId);
  }
  return { disabledBeforeClick: target.disabledBeforeClick };
}

async function clickCheckboxById(client: CdpClient, sessionId: string, id: string): Promise<{ checkedAfterClick: boolean; disabledBeforeClick: boolean }> {
  return await evaluateInPage<{ checkedAfterClick: boolean; disabledBeforeClick: boolean }>(client, sessionId, `(() => {
    const checkbox = document.getElementById(${JSON.stringify(id)});
    if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== 'checkbox') throw new Error('Could not find checkbox: ${id}');
    const disabledBeforeClick = checkbox.disabled;
    checkbox.click();
    return {
      checkedAfterClick: checkbox.checked,
      disabledBeforeClick,
    };
  })()`);
}

async function dragSongToList(
  client: CdpClient,
  sessionId: string,
  songId: string,
  fromListName: string,
  targetListName: string
): Promise<void> {
  const target = await evaluateInPage<{ startX: number; startY: number; endX: number; endY: number }>(
    client,
    sessionId,
    `(() => {
      const source = Array.from(document.querySelectorAll('[data-ann-song-id]')).find(element => (
        element.getAttribute('data-ann-song-id') === ${JSON.stringify(songId)}
        && element.getAttribute('data-ann-list-name') === ${JSON.stringify(fromListName)}
      ));
      const target = Array.from(document.querySelectorAll('[data-ann-drop-list]')).find(element => (
        element.getAttribute('data-ann-drop-list') === ${JSON.stringify(targetListName)}
      ));
      if (!(source instanceof HTMLElement)) throw new Error('Could not find draggable song ${songId} in ${fromListName}.');
      if (!(target instanceof HTMLElement)) throw new Error('Could not find drop list ${targetListName}.');
      source.scrollIntoView({ block: 'center', inline: 'center' });
      target.scrollIntoView({ block: 'center', inline: 'center' });
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return {
        startX: sourceRect.left + sourceRect.width / 2,
        startY: sourceRect.top + sourceRect.height / 2,
        endX: targetRect.left + targetRect.width / 2,
        endY: targetRect.top + Math.min(Math.max(targetRect.height / 2, 28), Math.max(targetRect.height - 8, 28)),
      };
    })()`
  );

  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: target.startX,
    y: target.startY,
    button: 'none',
  }, 30000, sessionId);
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.startX,
    y: target.startY,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  }, 30000, sessionId);
  await delay(100);

  const steps = 8;
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: target.startX + ((target.endX - target.startX) * progress),
      y: target.startY + ((target.endY - target.startY) * progress),
      button: 'left',
      buttons: 1,
    }, 30000, sessionId);
    await delay(30);
  }

  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.endX,
    y: target.endY,
    button: 'left',
    clickCount: 1,
  }, 30000, sessionId);
}

function mockAnnWorkerScript(): string {
  return `(() => {
    const trainingLabelA = ${JSON.stringify(trainingLabelA)};
    const trainingLabelB = ${JSON.stringify(trainingLabelB)};
    const trainingSongIds = ${JSON.stringify(trainingSongIds)};
    const labelBySongId = new Map([
      [trainingSongIds[0], trainingLabelA],
      [trainingSongIds[1], trainingLabelA],
      [trainingSongIds[2], trainingLabelB],
      [trainingSongIds[3], trainingLabelB],
    ]);
    window.__annMockWorkerMessages = [];

    function createActivationSnapshot(epoch, songId) {
      return {
        epoch,
        songId,
        layers: [
          { name: 'Input', units: 1, values: [0.25], min: 0.25, max: 0.25, mean: 0.25 },
          { name: 'hidden_1', units: 16, values: [0.1, 0.2, 0.3, 0.4], min: 0.1, max: 0.4, mean: 0.25 },
          { name: 'output', units: 2, values: [0.8, 0.2], min: 0.2, max: 0.8, mean: 0.5 },
        ],
      };
    }

    class MockAnnWorker {
      constructor(url) {
        this.url = String(url);
        this.onmessage = null;
        this.onerror = null;
        this.listeners = new Set();
        if (this.url.includes('druid-worker')) {
          this.emit({ type: 'druidWorkerReady' });
        }
        if (this.url.includes('mlp-worker')) {
          this.emit({ type: 'mlpWorkerReady' });
        }
      }

      addEventListener(type, listener) {
        if (type === 'message') this.listeners.add(listener);
      }

      removeEventListener(type, listener) {
        if (type === 'message') this.listeners.delete(listener);
      }

      postMessage(message) {
        window.__annMockWorkerMessages.push({
          url: this.url,
          type: message?.type,
          requestId: message?.requestId ?? null,
          payload: message?.payload ?? null,
        });
        if (message?.type === 'init') {
          if (this.url.includes('essentia-worker')) {
            this.emit({ type: 'essentiaReady', payload: true });
          } else if (this.url.includes('data-processing-worker')) {
            this.emit({ type: 'dataProcessingWorkerReady' });
          }
          return;
        }

        if (message?.type === 'extractFeatures') {
          const songId = message.payload?.songId ?? 'uploaded-song';
          this.emit({
            type: 'featureExtractionComplete',
            requestId: message.requestId,
            songId,
            features: { energy: 42.5 },
          }, 20);
        }

        if (message?.type === 'processData') {
          const vectors = Array.isArray(message.payload?.vectors) ? message.payload.vectors : [];
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const processedVectors = vectors.map(row => Array.isArray(row)
            ? row.map(value => (typeof value === 'number' && Number.isFinite(value)) ? value / 10 : 0)
            : []
          );
          this.emit({
            type: 'processingError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale process should be ignored' },
          }, 5);
          this.emit({
            type: 'processingComplete',
            requestId: message.requestId,
            payload: {
              processedVectors,
              songIds,
              stats: {
                means: [0],
                stdDevs: [1],
              },
            },
          }, 25);
        }

        if (message?.type === 'transformData') {
          const vectors = Array.isArray(message.payload?.vectors) ? message.payload.vectors : [];
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const transformedVectors = vectors.map(row => Array.isArray(row)
            ? row.map(value => (typeof value === 'number' && Number.isFinite(value)) ? value / 10 : 0)
            : []
          );
          this.emit({
            type: 'transformError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale transform should be ignored' },
          }, 5);
          this.emit({
            type: 'transformComplete',
            requestId: message.requestId,
            payload: {
              transformedVectors,
              songIds,
            },
          }, 25);
        }

        if (message?.type === 'reduceDimensions') {
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const dimensions = typeof message.payload?.dimensions === 'number' ? message.payload.dimensions : 2;
          const reducedData = songIds.map((songId, index) => {
            const row = [index, index % 5, songId.length % 7];
            return row.slice(0, dimensions);
          });
          this.emit({
            type: 'reductionError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale reduction should be ignored' },
          }, 5);
          this.emit({
            type: 'reductionComplete',
            requestId: message.requestId,
            payload: {
              reducedData,
              songIds,
            },
          }, 25);
        }

        if (message?.type === 'transformNewData') {
          const newVectors = Array.isArray(message.payload?.newVectors) ? message.payload.newVectors : [];
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const dimensions = typeof message.payload?.dimensions === 'number' ? message.payload.dimensions : 2;
          const reducedData = newVectors.map((row, index) => {
            const first = Array.isArray(row) && typeof row[0] === 'number' && Number.isFinite(row[0])
              ? row[0]
              : index;
            return [first, first / 2, index].slice(0, dimensions);
          });
          this.emit({
            type: 'reductionError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale reduction should be ignored' },
          }, 5);
          this.emit({
            type: 'transformNewDataComplete',
            requestId: message.requestId,
            payload: {
              reducedData,
              songIds,
            },
          }, 25);
        }

        if (message?.type === 'train') {
          const activationSampleSongId = message.payload?.activationSampleSongId ?? null;
          this.emit({
            type: 'mlpError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale training should be ignored' },
          }, 5);
          this.emit({
            type: 'epochMetrics',
            requestId: message.requestId,
            payload: {
              epoch: 1,
              metrics: { loss: 0.321, acc: 0.75, valLoss: 0.234, valAcc: 0.875 },
            },
          }, 15);
          this.emit({
            type: 'activationSnapshot',
            requestId: message.requestId,
            payload: createActivationSnapshot(1, activationSampleSongId),
          }, 20);
          this.emit({
            type: 'trainingComplete',
            requestId: message.requestId,
            payload: {
              finalMetrics: { loss: 0.123, accuracy: 0.875 },
              activationSnapshot: createActivationSnapshot(1, activationSampleSongId),
            },
          }, 35);
        }

        if (message?.type === 'infer') {
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const results = {};
          songIds.forEach((songId, index) => {
            const predictedLabel = labelBySongId.get(songId) ?? (index < 2
              ? trainingLabelA
              : index < 4
                ? trainingLabelB
                : trainingLabelA);
            results[songId] = {
              predictedLabel,
              confidence: index < 4 ? 0.92 : 0.61,
            };
          });
          this.emit({
            type: 'mlpError',
            requestId: String(message.requestId) + '-stale',
            payload: { error: 'stale inference should be ignored' },
          }, 5);
          this.emit({
            type: 'activationSnapshot',
            requestId: message.requestId,
            payload: createActivationSnapshot(undefined, songIds[0] ?? null),
          }, 15);
          this.emit({
            type: 'inferenceComplete',
            requestId: message.requestId,
            payload: { results },
          }, 30);
        }
      }

      emit(data, delay = 0) {
        setTimeout(() => {
          const event = { data };
          if (typeof this.onmessage === 'function') this.onmessage(event);
          this.listeners.forEach(listener => listener(event));
        }, delay);
      }

      terminate() {}
    }

    class MockAudioContext {
      decodeAudioData() {
        return Promise.resolve({
          sampleRate: 44100,
          getChannelData: () => new Float32Array([0, 0.25, -0.25, 0.5, -0.5, 0]),
        });
      }
    }

    window.Worker = MockAnnWorker;
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
  })();`;
}

async function installMockAnnWorkers(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: mockAnnWorkerScript(),
  }, 30000, sessionId);
}

function mockMlpWorkerOnlyScript(): string {
  return `(() => {
    const NativeWorker = window.Worker;
    const trainingLabelA = ${JSON.stringify(trainingLabelA)};
    const trainingLabelB = ${JSON.stringify(trainingLabelB)};
    const trainingSongIds = ${JSON.stringify(trainingSongIds)};
    const labelBySongId = new Map([
      [trainingSongIds[0], trainingLabelA],
      [trainingSongIds[1], trainingLabelA],
      [trainingSongIds[2], trainingLabelB],
      [trainingSongIds[3], trainingLabelB],
    ]);
    window.__annMockWorkerMessages = [];
    window.__annRealWorkerMessages = [];

    function createActivationSnapshot(epoch, songId) {
      return {
        epoch,
        songId,
        layers: [
          { name: 'Input', units: 1, values: [0.25], min: 0.25, max: 0.25, mean: 0.25 },
          { name: 'hidden_1', units: 16, values: [0.1, 0.2, 0.3, 0.4], min: 0.1, max: 0.4, mean: 0.25 },
          { name: 'output', units: 2, values: [0.8, 0.2], min: 0.2, max: 0.8, mean: 0.5 },
        ],
      };
    }

    class MockMlpWorker {
      constructor(url) {
        this.url = String(url);
        this.onmessage = null;
        this.onerror = null;
        this.listeners = new Set();
        this.emit({ type: 'mlpWorkerReady' });
      }

      addEventListener(type, listener) {
        if (type === 'message') this.listeners.add(listener);
      }

      removeEventListener(type, listener) {
        if (type === 'message') this.listeners.delete(listener);
      }

      postMessage(message) {
        window.__annMockWorkerMessages.push({
          url: this.url,
          type: message?.type,
          requestId: message?.requestId ?? null,
          payload: message?.payload ?? null,
        });

        if (message?.type === 'reset') {
          this.emit({ type: 'mlpResetComplete', requestId: message.requestId }, 5);
        }

        if (message?.type === 'train') {
          const activationSampleSongId = message.payload?.activationSampleSongId ?? null;
          this.emit({
            type: 'epochMetrics',
            requestId: message.requestId,
            payload: {
              epoch: 1,
              metrics: { loss: 0.321, acc: 0.75, valLoss: 0.234, valAcc: 0.875 },
            },
          }, 15);
          this.emit({
            type: 'activationSnapshot',
            requestId: message.requestId,
            payload: createActivationSnapshot(1, activationSampleSongId),
          }, 20);
          this.emit({
            type: 'trainingComplete',
            requestId: message.requestId,
            payload: {
              finalMetrics: { loss: 0.123, accuracy: 0.875 },
              activationSnapshot: createActivationSnapshot(1, activationSampleSongId),
            },
          }, 35);
        }

        if (message?.type === 'infer') {
          const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
          const results = {};
          songIds.forEach(songId => {
            results[songId] = {
              predictedLabel: labelBySongId.get(songId) ?? trainingLabelA,
              confidence: 0.92,
            };
          });
          this.emit({
            type: 'activationSnapshot',
            requestId: message.requestId,
            payload: createActivationSnapshot(undefined, songIds[0] ?? null),
          }, 15);
          this.emit({
            type: 'inferenceComplete',
            requestId: message.requestId,
            payload: { results },
          }, 30);
        }
      }

      emit(data, delay = 0) {
        setTimeout(() => {
          const event = { data };
          if (typeof this.onmessage === 'function') this.onmessage(event);
          this.listeners.forEach(listener => listener(event));
        }, delay);
      }

      terminate() {}
    }

    function recordRealWorkerMessage(url, message) {
      window.__annRealWorkerMessages.push({
        url,
        type: message?.type,
        requestId: message?.requestId ?? null,
        payload: message?.payload ?? null,
      });
    }

    function HybridWorker(url, options) {
      const urlText = String(url);
      if (urlText.includes('mlp-worker')) return new MockMlpWorker(urlText);
      const worker = new NativeWorker(url, options);
      const nativePostMessage = worker.postMessage.bind(worker);
      worker.postMessage = function(message, transfer) {
        recordRealWorkerMessage(urlText, message);
        if (typeof transfer !== 'undefined') return nativePostMessage(message, transfer);
        return nativePostMessage(message);
      };
      return worker;
    }

    HybridWorker.prototype = NativeWorker.prototype;
    window.Worker = HybridWorker;
  })();`;
}

async function installMockMlpWorkerOnly(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: mockMlpWorkerOnlyScript(),
  }, 30000, sessionId);
}

async function installUnavailableDefaultFeatureCache(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const nativeFetch = window.fetch.bind(window);
      window.__annSyntheticDefaultAudioFetchCount = 0;
      function writeAscii(view, offset, text) {
        for (let index = 0; index < text.length; index++) {
          view.setUint8(offset + index, text.charCodeAt(index));
        }
      }
      function createSyntheticWav() {
        const sampleRate = 8000;
        const sampleCount = 2048;
        const bytesPerSample = 2;
        const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
        const view = new DataView(buffer);
        writeAscii(view, 0, 'RIFF');
        view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
        writeAscii(view, 8, 'WAVE');
        writeAscii(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * bytesPerSample, true);
        view.setUint16(32, bytesPerSample, true);
        view.setUint16(34, 16, true);
        writeAscii(view, 36, 'data');
        view.setUint32(40, sampleCount * bytesPerSample, true);
        for (let index = 0; index < sampleCount; index++) {
          const value = Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 0.4;
          view.setInt16(44 + index * bytesPerSample, Math.max(-1, Math.min(1, value)) * 32767, true);
        }
        return buffer;
      }
      window.fetch = (input, init) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
        if (url.endsWith('/default_features.json') || url.includes('/default_features.json?')) {
          return Promise.resolve(new Response('', { status: 404, statusText: 'Not Found' }));
        }
        if (url.includes('/audio/')) {
          window.__annSyntheticDefaultAudioFetchCount += 1;
          return Promise.resolve(new Response(createSyntheticWav(), {
            status: 200,
            headers: { 'Content-Type': 'audio/wav' },
          }));
        }
        return nativeFetch(input, init);
      };
    })();`,
  }, 30000, sessionId);
}

type SeededTrainingReductionMethod = 'pca' | 'tsne' | 'umap';

interface SeededTrainingSetupOptions {
  useDimensionalityReduction?: boolean;
  reductionMethod?: SeededTrainingReductionMethod;
  targetDimensions?: number;
  selectedFeatureIds?: string[];
}

function seededTrainingSetupScript(options: SeededTrainingSetupOptions = {}): string {
  const snapshot = {
    version: 1,
    namedLists: {
      [trainingLabelA]: [trainingSongIds[0], trainingSongIds[1]],
      [trainingLabelB]: [trainingSongIds[2], trainingSongIds[3]],
    },
    selectedFeatureIds: options.selectedFeatureIds ?? ['energy'],
    processingMethod: 'standardize',
    useDimensionalityReduction: options.useDimensionalityReduction ?? false,
    reductionMethod: options.reductionMethod ?? 'umap',
    targetDimensions: options.targetDimensions ?? 2,
    networkConfig: {
      hiddenLayers: 1,
      nodesPerLayer: [16],
      activation: 'relu',
      optimizer: 'adam',
      learningRate: 0.001,
      epochs: 1,
      splitRatio: 0.5,
      randomSeed: 4242,
      batchSize: 2,
    },
  };

  return `(() => {
    localStorage.setItem(${JSON.stringify(ANN_SETUP_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(snapshot))});
  })();`;
}

async function installSeededTrainingSetup(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: seededTrainingSetupScript(),
  }, 30000, sessionId);
}

async function installSeededPcaTrainingSetup(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: seededTrainingSetupScript({
      useDimensionalityReduction: true,
      reductionMethod: 'pca',
      targetDimensions: 2,
    }),
  }, 30000, sessionId);
}

async function installSeededRealPcaTrainingSetup(client: CdpClient, sessionId: string): Promise<void> {
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: seededTrainingSetupScript({
      selectedFeatureIds: ['energy', 'rms'],
      useDimensionalityReduction: true,
      reductionMethod: 'pca',
      targetDimensions: 2,
    }),
  }, 30000, sessionId);
}

async function uploadTrainingAudioThroughReactUi(client: CdpClient, sessionId: string, filePath: string): Promise<{ fileChooserOpened: boolean }> {
  await client.send('Page.setInterceptFileChooserDialog', { enabled: true }, 30000, sessionId);
  const uploadClick = await pointerClickButtonByText(client, sessionId, 'Upload Audio');
  assert.equal(uploadClick.disabledBeforeClick, false, 'Upload Audio should be available before mixed extraction.');

  const fileChooser = await waitForCdpEvent(
    client,
    event => event.method === 'Page.fileChooserOpened' && Boolean(event.params?.backendNodeId),
    'file chooser for ANN training upload'
  );
  await client.send('DOM.setFileInputFiles', {
    backendNodeId: fileChooser.params.backendNodeId,
    files: [filePath],
  }, 30000, sessionId);
  return { fileChooserOpened: true };
}

async function setUploadedInferenceFile(client: CdpClient, sessionId: string, filePath: string): Promise<void> {
  await client.send('DOM.enable', {}, 30000, sessionId);
  const documentResult = await client.send('DOM.getDocument', {}, 30000, sessionId) as { root?: { nodeId?: number } };
  const documentNodeId = documentResult.root?.nodeId;
  if (typeof documentNodeId !== 'number') throw new Error('Could not resolve DOM document node for inference upload.');
  const queryResult = await client.send('DOM.querySelector', {
    nodeId: documentNodeId,
    selector: '#annInferenceFile',
  }, 30000, sessionId) as { nodeId?: number };
  if (typeof queryResult.nodeId !== 'number' || queryResult.nodeId === 0) throw new Error('Could not find uploaded-inference file input.');
  await client.send('DOM.setFileInputFiles', {
    nodeId: queryResult.nodeId,
    files: [filePath],
  }, 30000, sessionId);
}

async function runHydrationRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    const hydrated = await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasLabelEditor &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasReadyStatus &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'hydrated ANN route with workers ready');

    assert.equal(hydrated.title, 'MusicCluster - MIR with Unsupervised Music Clustering');
    assert.equal(hydrated.href, url);
    assert.equal(hydrated.trainButtonDisabled, true, 'Train should stay disabled until labels and features are ready.');
    assert.equal(hydrated.createButtonDisabled, true, 'Create should start disabled until a label name is entered.');

    const interaction = await createLabelThroughReactUi(client, sessionId);
    assert.equal(interaction.disabledBeforeClick, false, 'Create should enable after typing a label name.');

    const withLabel = await waitForRouteState(
      client,
      sessionId,
      state => state.hasSmokeLabel && state.hasSmokeLabelLog && state.hasStoredSmokeLabel,
      'created label to render and log'
    );

    await client.send('Page.reload', { ignoreCache: true }, 30000, sessionId);
    const restored = await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasReadyStatus &&
      state.hasSmokeLabel &&
      state.hasRestoreLog &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'stored label setup to restore after reload');

    assert.equal(restored.hasStoredSmokeLabel, true, 'Saved ANN setup should keep the smoke label in localStorage.');

    const mfccToggle = await clickButtonByText(client, sessionId, 'MFCC');
    assert.equal(mfccToggle.disabledBeforeClick, false, 'MFCC toggle should be available before extraction.');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be available once workers are ready and energy is selected.');

    const cached = await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false &&
      !state.hasUncachedExtractionLog
    ), 'cache-backed default feature preparation to complete');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Hydrated ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return cached;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runDefaultCacheBypassExtractionRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
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
    await installUnavailableDefaultFeatureCache(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasReadyStatus &&
      state.hasDefaultCacheUnavailableLog &&
      !state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'real-worker ANN route ready with default feature cache unavailable', 90000);

    const mfccToggle = await clickButtonByText(client, sessionId, 'MFCC');
    assert.equal(mfccToggle.disabledBeforeClick, false, 'MFCC toggle should be available before cache-bypass default extraction.');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be available for cache-bypass default extraction.');

    const extracted = await waitForRouteState(client, sessionId, state => (
      state.hasDefaultCacheUnavailableLog &&
      state.hasDefaultCacheBypassExtractionLog &&
      state.hasDefaultCacheBypassExtractionCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false &&
      state.syntheticDefaultAudioFetchCount >= 25 &&
      !state.hasCacheUseLog &&
      !state.hasCacheCompleteLog &&
      !state.hasFeatureExtractionErrorLog
    ), 'uncached default-song synthetic AudioContext decode plus generated Essentia extraction to prepare a 25-row matrix', 300000);

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Cache-bypass default synthetic extraction ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return extracted;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runUploadedMixedExtractionRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const uploadFilePath = join(profileDir, uploadFileName);
  writeFileSync(uploadFilePath, Buffer.from([82, 73, 70, 70, 0, 0, 0, 0]));
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
    await installMockAnnWorkers(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasLabelEditor &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasReadyStatus &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with workers ready and default cache loaded');

    const mfccToggle = await clickButtonByText(client, sessionId, 'MFCC');
    assert.equal(mfccToggle.disabledBeforeClick, false, 'MFCC toggle should be available before upload extraction.');

    const upload = await uploadTrainingAudioThroughReactUi(client, sessionId, uploadFilePath);
    assert.equal(upload.fileChooserOpened, true, 'The browser upload flow should open a file chooser.');

    await waitForRouteState(
      client,
      sessionId,
      state => state.hasUploadedTrainingSong && state.hasUploadedAddedLog,
      'uploaded training song to render and log'
    );

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be available for mixed cached/uploaded extraction.');

    const mixed = await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasMixedExtractionLog &&
      state.hasMixedExtractionCompleteLog &&
      state.hasPreparedMixedMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'mixed cached default and uploaded feature extraction to complete');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Mixed uploaded ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return mixed;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runRealAudioUploadedExtractionRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const uploadFilePath = join(profileDir, realUploadFileName);
  copyFileSync(realUploadSourcePath, uploadFilePath);
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasLabelEditor &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasReadyStatus &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'real-worker ANN route ready for uploaded-audio extraction', 90000);

    const mfccToggle = await clickButtonByText(client, sessionId, 'MFCC');
    assert.equal(mfccToggle.disabledBeforeClick, false, 'MFCC toggle should be available before real-audio extraction.');

    const upload = await uploadTrainingAudioThroughReactUi(client, sessionId, uploadFilePath);
    assert.equal(upload.fileChooserOpened, true, 'The real-audio browser upload flow should open a file chooser.');

    await waitForRouteState(
      client,
      sessionId,
      state => state.hasRealUploadedTrainingSong && state.hasUploadedAddedLog,
      'real uploaded training song to render and log'
    );

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be available for real uploaded-audio extraction.');

    const extracted = await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasMixedExtractionLog &&
      state.hasMixedExtractionCompleteLog &&
      state.hasPreparedMixedMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false &&
      !state.hasFeatureExtractionErrorLog
    ), 'real AudioContext decode plus generated Essentia extraction to prepare a 26-row matrix', 120000);

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Real uploaded-audio extraction ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return extracted;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runProcessReduceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
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
    await installMockAnnWorkers(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasReadyStatus &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route ready for process/reduce coverage');

    const mfccToggle = await clickButtonByText(client, sessionId, 'MFCC');
    assert.equal(mfccToggle.disabledBeforeClick, false, 'MFCC toggle should be available before process/reduce extraction.');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be available before process/reduce extraction.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'cache-backed feature matrix before process/reduce');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled after cache-backed matrix preparation.');

    const processed = await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.processButtonDisabled === true &&
      state.selectedDataStage === 'processed' &&
      !state.hasStaleProcessErrorLog
    ), 'data processing completion to render and ignore stale process replies');
    assert.equal(processed.selectedDataStage, 'processed');

    const reductionChoice = await clickButtonByText(client, sessionId, 'PCA');
    assert.equal(reductionChoice.disabledBeforeClick, false, 'PCA should be selectable after processing.');

    await waitForRouteState(client, sessionId, state => (
      state.hasReduceButton &&
      state.reduceButtonDisabled === false
    ), 'Reduce Dimensions control to enable after processed data is available');

    const reduceClick = await clickButtonByText(client, sessionId, 'Reduce Dimensions');
    assert.equal(reduceClick.disabledBeforeClick, false, 'Reduce Dimensions should be enabled after processing and reduction toggle.');

    const reduced = await waitForRouteState(client, sessionId, state => (
      state.hasReductionStartedLog &&
      state.hasReductionCompleteLog &&
      state.selectedDataStage === 'reduction' &&
      !state.hasStaleReductionErrorLog
    ), 'dimensionality reduction completion to render and ignore stale reduction replies');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Process/reduce ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return reduced;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runTrainingInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
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
    await installMockAnnWorkers(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with seeded training labels restored');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for seeded energy-only training flow.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'seeded training feature matrix to prepare from cache');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled before training.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.trainButtonDisabled === false &&
      state.selectedDataStage === 'processed' &&
      !state.hasStaleProcessErrorLog
    ), 'processed matrix to enable training');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled once labels and processed data are ready.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessedTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasTrainingSummary &&
      state.hasValidationPlan &&
      state.hasValidationExecutionPlan &&
      state.hasModelComparisonPendingRun &&
      state.hasTrainedNetworkStatus &&
      state.hasNetworkActivationStatus &&
      state.hasNetworkActivationLayers &&
      state.hasNetworkActivationMeans &&
      state.hasNetworkActivationNodeValues &&
      state.hasNetworkActivationOutputLabels &&
      state.inferButtonDisabled === false &&
      !state.hasStaleTrainingErrorLog
    ), 'training completion summary and activation rendering to appear while stale training replies stay hidden');

    const activationPaint = await captureActivationPaintSummary(client, sessionId);
    assert.ok(
      activationPaint.colorfulPixels >= 80,
      `Network activation screenshot should contain painted activation colors: ${JSON.stringify(activationPaint)}`
    );
    assert.ok(
      activationPaint.cyanPixels >= 8,
      `Network activation screenshot should contain cyan input-layer pixels: ${JSON.stringify(activationPaint)}`
    );
    assert.ok(
      activationPaint.greenPixels >= 8,
      `Network activation screenshot should contain green hidden-layer pixels: ${JSON.stringify(activationPaint)}`
    );
    assert.ok(
      activationPaint.warmPixels >= 8,
      `Network activation screenshot should contain warm output-layer pixels: ${JSON.stringify(activationPaint)}`
    );

    const inferClick = await clickButtonByText(client, sessionId, 'Infer Labels');
    assert.equal(inferClick.disabledBeforeClick, false, 'Infer Labels should be enabled after mocked training completes.');

    const inferred = await waitForRouteState(client, sessionId, state => (
      state.hasProcessedInferenceInputLog &&
      state.hasInferenceStartedLog &&
      state.hasDatasetInferenceCompleteLog &&
      state.hasDatasetEvaluation &&
      state.hasDatasetEvaluationPerfectAccuracy &&
      state.hasDatasetEvaluationConfidenceSummary &&
      state.hasValidationGuidance &&
      state.hasValidationPlan &&
      state.hasValidationExecutionPlan &&
      state.hasModelComparisonEvaluatedRun &&
      !state.hasStaleInferenceErrorLog
    ), 'dataset inference evaluation to render and stale inference replies to stay hidden');

    assert.equal(inferred.hasValidationRunButton, true, 'Run Validation should be visible after the execution plan is ready.');

    const validationClick = await clickButtonByText(client, sessionId, 'Run Validation');
    assert.equal(validationClick.disabledBeforeClick, false, 'Run Validation should be enabled after the execution plan is ready.');

    const validated = await waitForRouteState(client, sessionId, state => (
      state.hasValidationRunStartedLog &&
      state.hasValidationRunCompleteLog &&
      state.hasValidationRunResults &&
      !state.hasStaleTrainingErrorLog &&
      !state.hasStaleInferenceErrorLog
    ), 'validation runner to execute planned folds and render summary');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Training/inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return validated;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, inferenceFileName);
  writeFileSync(inferenceFilePath, Buffer.from([82, 73, 70, 70, 0, 0, 0, 0]));
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
    await installMockAnnWorkers(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasInferButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with uploaded-inference controls and seeded labels restored');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for seeded uploaded-inference training flow.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'seeded uploaded-inference feature matrix to prepare from cache');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled before uploaded-inference training.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.trainButtonDisabled === false &&
      state.selectedDataStage === 'processed' &&
      !state.hasStaleProcessErrorLog
    ), 'processed matrix to enable uploaded-inference training');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled before uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessedTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      !state.hasStaleTrainingErrorLog
    ), 'trained processed model to enable inference file selection');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'uploaded inference file to render and enable Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled after choosing an inference file.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog
    ), 'uploaded inference prediction to render and stale transform/MLP replies to stay hidden');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Uploaded inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runRealAudioUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, realInferenceFileName);
  copyFileSync(realUploadSourcePath, inferenceFilePath);
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
    await installMockMlpWorkerOnly(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'real-worker ANN route with MLP-only mock and seeded labels restored', 90000);

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for real-audio uploaded-inference training flow.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.trainButtonDisabled === false
    ), 'seeded raw matrix to prepare from cache before real uploaded-inference audio');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled before real uploaded-inference audio.');

    await waitForRouteState(client, sessionId, state => (
      state.hasRawTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasRawTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      !state.hasStaleTrainingErrorLog
    ), 'raw model to train with the deterministic MLP-only mock');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasRealInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'real uploaded inference MP3 to render and enable Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled for a real inference MP3.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleReductionErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog &&
      !state.hasFeatureExtractionErrorLog
    ), 'real uploaded-inference MP3 to decode, extract energy, and render a prediction', 120000);

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Real uploaded-inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runProcessedRealAudioUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, realInferenceFileName);
  copyFileSync(realUploadSourcePath, inferenceFilePath);
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
    await installMockMlpWorkerOnly(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'real-worker ANN route with processed pipeline controls and seeded labels restored', 90000);

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for processed real-audio uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'seeded raw matrix to prepare from cache before processing');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled for processed real-audio uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.trainButtonDisabled === false &&
      state.selectedDataStage === 'processed' &&
      state.realTransformDataRequestCount === 0 &&
      state.realTransformNewDataRequestCount === 0 &&
      !state.hasStaleProcessErrorLog
    ), 'real data-processing worker to process the training matrix before uploaded inference');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled after real processing.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessedTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      !state.hasStaleTrainingErrorLog
    ), 'processed model to train with the deterministic MLP-only mock');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasRealInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'real uploaded inference MP3 to render and enable processed Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled for a processed real inference MP3.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      state.realExtractFeaturesRequestCount === 1 &&
      state.realTransformDataRequestCount === 1 &&
      state.realTransformNewDataRequestCount === 0 &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleReductionErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog &&
      !state.hasFeatureExtractionErrorLog
    ), 'real uploaded-inference MP3 to decode, transform with stored processing stats, and render a processed prediction', 120000);

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Processed real uploaded-inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runRawUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, inferenceFileName);
  writeFileSync(inferenceFilePath, Buffer.from([82, 73, 70, 70, 0, 0, 0, 0]));
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
    await installMockAnnWorkers(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with raw uploaded-inference controls and seeded labels restored');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for seeded raw uploaded-inference flow.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.trainButtonDisabled === false
    ), 'seeded raw feature matrix to prepare from cache and enable training');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled for raw uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasRawTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasRawTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTrainingErrorLog
    ), 'raw model to train without preprocessing or reduction transforms');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'uploaded inference file to render and enable raw Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled for raw trained models.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleReductionErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog
    ), 'raw uploaded inference prediction to render without data or reduction transforms');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Raw uploaded inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runPcaUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, inferenceFileName);
  writeFileSync(inferenceFilePath, Buffer.from([82, 73, 70, 70, 0, 0, 0, 0]));
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
    await installMockAnnWorkers(client, sessionId);
    await installSeededPcaTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with PCA uploaded-inference controls and seeded labels restored');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for seeded PCA uploaded-inference flow.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'seeded PCA feature matrix to prepare from cache');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled before PCA uploaded-inference training.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.hasPcaReductionStartedLog &&
      state.hasReductionCompleteLog &&
      state.trainButtonDisabled === false &&
      state.selectedDataStage === 'reduction' &&
      !state.hasStaleProcessErrorLog &&
      !state.hasStaleReductionErrorLog
    ), 'processed matrix to auto-reduce with PCA and enable training');

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled after PCA reduction.');

    await waitForRouteState(client, sessionId, state => (
      state.hasReducedTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasReducedTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTrainingErrorLog
    ), 'PCA-reduced model to train before uploaded inference transforms run');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'uploaded inference file to render and enable PCA Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled for PCA-reduced trained models.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      state.transformDataRequestCount === 1 &&
      state.transformNewDataRequestCount === 1 &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleReductionErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog
    ), 'PCA uploaded inference prediction to render after data and reduction transforms');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `PCA uploaded inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runRealPcaUploadedInferenceRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
  const debugPort = await getOpenPort();
  const { child, profileDir, getOutput } = launchChrome(chromePath, debugPort);
  const inferenceFilePath = join(profileDir, realInferenceFileName);
  copyFileSync(realUploadSourcePath, inferenceFilePath);
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
    await installMockMlpWorkerOnly(client, sessionId);
    await installSeededRealPcaTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasUploadedInferButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'real-worker ANN route with PCA pipeline controls and seeded two-feature labels restored', 90000);

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled for PCA real-audio uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedTwoFeatureMatrixLog &&
      state.hasProcessButton &&
      state.processButtonDisabled === false
    ), 'seeded two-feature raw matrix to prepare from cache before real PCA reduction');

    const processClick = await clickButtonByText(client, sessionId, 'Process Data');
    assert.equal(processClick.disabledBeforeClick, false, 'Process Data should be enabled for PCA real-audio uploaded inference.');

    await waitForRouteState(client, sessionId, state => (
      state.hasProcessingStartedLog &&
      state.hasProcessingCompleteLog &&
      state.hasPcaReductionStartedLog &&
      state.hasReductionCompleteLog &&
      state.trainButtonDisabled === false &&
      state.selectedDataStage === 'reduction' &&
      state.realProcessDataRequestCount === 1 &&
      state.realReduceDimensionsRequestCount === 1 &&
      state.realTransformDataRequestCount === 0 &&
      state.realTransformNewDataRequestCount === 0 &&
      !state.hasStaleProcessErrorLog &&
      !state.hasStaleReductionErrorLog
    ), 'real data-processing and Druid workers to process and reduce the training matrix', 120000);

    const trainClick = await clickButtonByText(client, sessionId, 'Train Automatic');
    assert.equal(trainClick.disabledBeforeClick, false, 'Train Automatic should be enabled after real PCA reduction.');

    await waitForRouteState(client, sessionId, state => (
      state.hasReducedTrainingInputLog &&
      state.hasTrainingStartedLog &&
      state.hasTrainingCompleteLog &&
      state.hasReducedTrainingSummary &&
      state.hasTrainedNetworkStatus &&
      state.inferenceFileDisabled === false &&
      state.uploadedInferButtonDisabled === true &&
      !state.hasStaleTrainingErrorLog
    ), 'PCA-reduced model to train with the deterministic MLP-only mock');

    await setUploadedInferenceFile(client, sessionId, inferenceFilePath);

    await waitForRouteState(client, sessionId, state => (
      state.hasRealInferenceFileName &&
      state.uploadedInferButtonDisabled === false
    ), 'real uploaded inference MP3 to render and enable PCA Infer Uploaded Audio');

    const inferUploadedClick = await clickButtonByText(client, sessionId, 'Infer Uploaded Audio');
    assert.equal(inferUploadedClick.disabledBeforeClick, false, 'Infer Uploaded Audio should be enabled for a real PCA inference MP3.');

    const uploadedInference = await waitForRouteState(client, sessionId, state => (
      state.hasUploadedInferenceCompleteLog &&
      state.hasUploadedPrediction &&
      state.hasUploadedPredictionConfidence &&
      state.realExtractFeaturesRequestCount === 1 &&
      state.realProcessDataRequestCount === 1 &&
      state.realReduceDimensionsRequestCount === 1 &&
      state.realTransformDataRequestCount === 1 &&
      state.realTransformNewDataRequestCount === 1 &&
      state.transformDataRequestCount === 0 &&
      state.transformNewDataRequestCount === 0 &&
      !state.hasStaleTransformErrorLog &&
      !state.hasStaleReductionErrorLog &&
      !state.hasStaleInferenceErrorLog &&
      !state.hasUploadedInferenceFailureLog &&
      !state.hasFeatureExtractionErrorLog
    ), 'real uploaded-inference MP3 to decode, process, PCA-transform, and render a reduced prediction', 180000);

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `PCA real uploaded-inference ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return uploadedInference;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

async function runDragDropLabelingRouteSmoke(chromePath: string, url: string): Promise<RouteState> {
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
    await installMockAnnWorkers(client, sessionId);
    await installSeededTrainingSetup(client, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    await waitForRouteState(client, sessionId, state => (
      state.hasHeader &&
      state.hasFeatureExtraction &&
      state.hasTrainInfer &&
      state.hasProgramLogs &&
      state.hasExtractButton &&
      state.hasTrainButton &&
      state.hasReadyStatus &&
      state.hasRestoreLog &&
      state.hasTrainingLabelA &&
      state.hasTrainingLabelB &&
      state.hasSeededLabelCounts &&
      state.hasDefaultCacheLoadedLog &&
      !state.hasInitializingOverlay &&
      !state.hasFrameworkError
    ), 'mocked ANN route with seeded drag/drop labels restored');

    const extractClick = await clickButtonByText(client, sessionId, 'Extract Features');
    assert.equal(extractClick.disabledBeforeClick, false, 'Extract Features should be enabled before drag/drop gate checks.');

    await waitForRouteState(client, sessionId, state => (
      state.hasCacheUseLog &&
      state.hasCacheCompleteLog &&
      state.hasPreparedEnergyMatrixLog &&
      state.trainButtonDisabled === false
    ), 'seeded labels and cached matrix to enable training before drag/drop changes');

    await dragSongToList(client, sessionId, trainingSongIds[0], trainingLabelA, trainingLabelB);

    await waitForRouteState(client, sessionId, state => (
      state.hasDragUnderSampledCounts &&
      state.trainButtonDisabled === true
    ), 'dragged assignment to make one label under-sampled and disable training');

    await dragSongToList(client, sessionId, dragRestoreSongId, unassignedListId, trainingLabelA);

    const restored = await waitForRouteState(client, sessionId, state => (
      state.hasDragRestoredCounts &&
      state.hasDragRestoredPersisted &&
      state.trainButtonDisabled === false
    ), 'dragged assignment to restore label sample sufficiency and persist setup');

    const runtimeExceptions = client.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(runtimeExceptions, [], `Drag/drop ANN route should not throw runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);

    await client.send('Target.closeTarget', { targetId: target.targetId }).catch(() => undefined);
    return restored;
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${getOutput()}`);
  } finally {
    client?.close();
    await stopChrome(child, profileDir);
  }
}

test('ANN route hydrates, restores setup, and prepares cached default features in a browser', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route hydration coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runHydrationRouteSmoke(chromePath, url);
        assert.equal(state.hasSmokeLabel, true);
        assert.equal(state.hasCacheUseLog, true);
        assert.equal(state.hasCacheCompleteLog, true);
        assert.equal(state.hasPreparedEnergyMatrixLog, true);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN route hydration coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route extracts default-song features with synthetic audio responses when the cache is unavailable', { timeout: 420000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route cache-bypass extraction coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runDefaultCacheBypassExtractionRouteSmoke(chromePath, url);
        assert.equal(state.hasDefaultCacheUnavailableLog, true);
        assert.equal(state.hasDefaultCacheBypassExtractionLog, true);
        assert.equal(state.hasDefaultCacheBypassExtractionCompleteLog, true);
        assert.equal(state.hasPreparedEnergyMatrixLog, true);
        assert.equal(state.syntheticDefaultAudioFetchCount >= 25, true);
        assert.equal(state.hasCacheUseLog, false);
        assert.equal(state.hasFeatureExtractionErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN default cache-bypass extraction coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route combines cached default features with uploaded song extraction in a browser', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route upload coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runUploadedMixedExtractionRouteSmoke(chromePath, url);
        assert.equal(state.hasUploadedTrainingSong, true);
        assert.equal(state.hasCacheUseLog, true);
        assert.equal(state.hasMixedExtractionLog, true);
        assert.equal(state.hasMixedExtractionCompleteLog, true);
        assert.equal(state.hasPreparedMixedMatrixLog, true);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN uploaded extraction coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route decodes a real uploaded audio file and extracts features with the generated Essentia worker', { timeout: 300000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route real-audio extraction coverage.');
    return;
  }
  if (!existsSync(realUploadSourcePath)) {
    t.skip(`Real audio fixture not found: ${realUploadSourcePath}`);
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runRealAudioUploadedExtractionRouteSmoke(chromePath, url);
        assert.equal(state.hasRealUploadedTrainingSong, true);
        assert.equal(state.hasCacheUseLog, true);
        assert.equal(state.hasMixedExtractionLog, true);
        assert.equal(state.hasMixedExtractionCompleteLog, true);
        assert.equal(state.hasPreparedMixedMatrixLog, true);
        assert.equal(state.hasFeatureExtractionErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN real-audio uploaded extraction coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route processes and reduces cached features while ignoring stale worker replies', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route process/reduce coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runProcessReduceRouteSmoke(chromePath, url);
        assert.equal(state.hasProcessingCompleteLog, true);
        assert.equal(state.hasReductionCompleteLog, true);
        assert.equal(state.hasStaleProcessErrorLog, false);
        assert.equal(state.hasStaleReductionErrorLog, false);
        assert.equal(state.selectedDataStage, 'reduction');
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN process/reduce coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route trains and infers from seeded labels with mocked MLP replies', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route training/inference coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runTrainingInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasTrainingSummary, true);
        assert.equal(state.hasTrainedNetworkStatus, true);
        assert.equal(state.hasNetworkActivationStatus, true);
        assert.equal(state.hasNetworkActivationLayers, true);
        assert.equal(state.hasNetworkActivationMeans, true);
        assert.equal(state.hasNetworkActivationNodeValues, true);
        assert.equal(state.hasNetworkActivationOutputLabels, true);
        assert.equal(state.hasDatasetEvaluation, true);
        assert.equal(state.hasDatasetEvaluationPerfectAccuracy, true);
        assert.equal(state.hasStaleTrainingErrorLog, false);
        assert.equal(state.hasStaleInferenceErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN training/inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route infers an uploaded audio file through the trained processed pipeline', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route uploaded-inference coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.hasStaleTransformErrorLog, false);
        assert.equal(state.hasStaleInferenceErrorLog, false);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route decodes a real uploaded inference audio file and predicts with a trained raw pipeline', { timeout: 300000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route real uploaded-inference coverage.');
    return;
  }
  if (!existsSync(realUploadSourcePath)) {
    t.skip(`Real audio fixture not found: ${realUploadSourcePath}`);
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runRealAudioUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasRawTrainingInputLog, true);
        assert.equal(state.hasRawTrainingSummary, true);
        assert.equal(state.hasRealInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.transformDataRequestCount, 0);
        assert.equal(state.transformNewDataRequestCount, 0);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        assert.equal(state.hasFeatureExtractionErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN real uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route decodes a real uploaded inference audio file through the trained processed pipeline', { timeout: 360000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route processed real uploaded-inference coverage.');
    return;
  }
  if (!existsSync(realUploadSourcePath)) {
    t.skip(`Real audio fixture not found: ${realUploadSourcePath}`);
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runProcessedRealAudioUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasProcessedTrainingInputLog, true);
        assert.equal(state.hasTrainingSummary, true);
        assert.equal(state.hasRealInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.realExtractFeaturesRequestCount, 1);
        assert.equal(state.realTransformDataRequestCount, 1);
        assert.equal(state.realTransformNewDataRequestCount, 0);
        assert.equal(state.transformDataRequestCount, 0);
        assert.equal(state.transformNewDataRequestCount, 0);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        assert.equal(state.hasFeatureExtractionErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN processed real uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route infers an uploaded audio file through the trained raw pipeline without transforms', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route raw uploaded-inference coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runRawUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasRawTrainingInputLog, true);
        assert.equal(state.hasRawTrainingSummary, true);
        assert.equal(state.hasInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.transformDataRequestCount, 0);
        assert.equal(state.transformNewDataRequestCount, 0);
        assert.equal(state.hasStaleTransformErrorLog, false);
        assert.equal(state.hasStaleReductionErrorLog, false);
        assert.equal(state.hasStaleInferenceErrorLog, false);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN raw uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route infers an uploaded audio file through the trained PCA-reduced pipeline', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route PCA uploaded-inference coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runPcaUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasPcaReductionStartedLog, true);
        assert.equal(state.hasReductionCompleteLog, true);
        assert.equal(state.hasReducedTrainingInputLog, true);
        assert.equal(state.hasReducedTrainingSummary, true);
        assert.equal(state.hasInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.transformDataRequestCount, 1);
        assert.equal(state.transformNewDataRequestCount, 1);
        assert.equal(state.hasStaleTransformErrorLog, false);
        assert.equal(state.hasStaleReductionErrorLog, false);
        assert.equal(state.hasStaleInferenceErrorLog, false);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN PCA uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route decodes a real uploaded inference audio file through the trained PCA-reduced pipeline', { timeout: 420000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route PCA real uploaded-inference coverage.');
    return;
  }
  if (!existsSync(realUploadSourcePath)) {
    t.skip(`Real audio fixture not found: ${realUploadSourcePath}`);
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runRealPcaUploadedInferenceRouteSmoke(chromePath, url);
        assert.equal(state.hasPreparedTwoFeatureMatrixLog, true);
        assert.equal(state.hasPcaReductionStartedLog, true);
        assert.equal(state.hasReductionCompleteLog, true);
        assert.equal(state.hasReducedTrainingInputLog, true);
        assert.equal(state.hasReducedTrainingSummary, true);
        assert.equal(state.hasRealInferenceFileName, true);
        assert.equal(state.hasUploadedInferenceCompleteLog, true);
        assert.equal(state.hasUploadedPrediction, true);
        assert.equal(state.hasUploadedPredictionConfidence, true);
        assert.equal(state.realExtractFeaturesRequestCount, 1);
        assert.equal(state.realProcessDataRequestCount, 1);
        assert.equal(state.realReduceDimensionsRequestCount, 1);
        assert.equal(state.realTransformDataRequestCount, 1);
        assert.equal(state.realTransformNewDataRequestCount, 1);
        assert.equal(state.transformDataRequestCount, 0);
        assert.equal(state.transformNewDataRequestCount, 0);
        assert.equal(state.hasUploadedInferenceFailureLog, false);
        assert.equal(state.hasFeatureExtractionErrorLog, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN PCA real uploaded-inference coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route drag/drop label assignment updates training readiness in a browser', { timeout: 240000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run browser-route drag/drop coverage.');
    return;
  }

  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);
  const failures: string[] = [];

  try {
    await waitForAnnRouteHttp(url, child, getOutput);

    for (const chromePath of chromePaths) {
      try {
        const state = await runDragDropLabelingRouteSmoke(chromePath, url);
        assert.equal(state.hasDragRestoredCounts, true);
        assert.equal(state.hasDragRestoredPersisted, true);
        assert.equal(state.trainButtonDisabled, false);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN drag/drop label coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});
