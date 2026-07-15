import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { ANN_MODEL_COMPARISON_STORAGE_KEY } from '../src/lib/annModelComparisonStorage';
import { ANN_SETUP_STORAGE_KEY, type AnnSetupSnapshot } from '../src/lib/annSetupPersistence';
import { ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY } from '../src/lib/annUploadedDatasetReattachmentStorage';

const host = '127.0.0.1';
const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const exportedLabelName = 'Setup Export Route Label';
const importedLabelName = 'Setup Import Route Label';
const exportedSongIds = [
  '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3',
  '/audio/Excerpt_Yes - Roundabout.mp3',
];
const importedSongIds = [
  '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3',
  '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3',
];
const trainedModelLabelA = 'Portable Model Alpha';
const trainedModelLabelB = 'Portable Model Beta';
const trainedModelSongIds = [
  '/audio/Excerpt_Tchaikovsky - Nutcracker March_Piano Solo.mp3',
  '/audio/Excerpt_Yes - Roundabout.mp3',
  '/audio/Excerpt_Grover Washington, Jr.-Bill Withers - Just the Two of Us.mp3',
  '/audio/Excerpt_Eric Clapton - Autumn Leaves.mp3',
];
const importedUploadedSong = {
  songId: 'user-upload-imported-route-upload',
  name: 'Imported Route Upload.wav',
  externalId: 'browser-file:imported-route-upload-wav:2048:1780000003000',
  assignedLabels: [importedLabelName],
};
const missingImportedUploadedSong = {
  songId: 'user-upload-missing-route-upload',
  name: 'Missing Route Upload.wav',
  externalId: 'browser-file:missing-route-upload-wav:1024:1780000004000',
  assignedLabels: [importedLabelName],
};
const explicitChromeCandidates = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
].filter(Boolean) as string[];
const defaultChromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

type CdpMessage = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string; value?: unknown };
  };
};

type SetupRouteState = {
  href: string;
  readyState: string;
  textExcerpt: string;
  hasInitializingOverlay: boolean;
  hasExportButton: boolean;
  hasImportButton: boolean;
  hasReattachButton: boolean;
  hasExportedLabel: boolean;
  hasImportedLabel: boolean;
  hasUploadedSong: boolean;
  hasReattachedImportedUpload: boolean;
  hasExpectedFilesReview: boolean;
  hasReattachmentReview: boolean;
  hasReattachmentFilter: boolean;
  hasReattachmentSearch: boolean;
  hasReadyReattachmentConfirmation: boolean;
  hasNeedsAttentionReattachmentConfirmation: boolean;
  hasContinueWithAttachedButton: boolean;
  hasContinuedWithAttachedConfirmation: boolean;
  hasExpectedFileMetadata: boolean;
  hasReattachmentMetadata: boolean;
  hasRestoreLog: boolean;
  hasImportLog: boolean;
  hasUploadLog: boolean;
  hasReattachLog: boolean;
  hasTrainedModelPortabilityPanel: boolean;
  hasExportTrainedModelButton: boolean;
  hasImportTrainedModelButton: boolean;
  exportTrainedModelButtonDisabled: boolean | null;
  hasTrainedModelLabelA: boolean;
  hasTrainedModelLabelB: boolean;
  hasDefaultCacheLoadedLog: boolean;
  hasPreparedEnergyMatrixLog: boolean;
  hasRawTrainingInputLog: boolean;
  hasTrainingCompleteLog: boolean;
  hasTrainedModelExportLog: boolean;
  hasTrainedModelImportLog: boolean;
  hasImportedTrainedModelContext: boolean;
  hasImportedTrainedModelReview: boolean;
  hasImportedTrainedModelWarnings: boolean;
  hasLiveModelComparison: boolean;
  hasFeatureSignal: boolean;
  hasDatasetInferenceCompleteLog: boolean;
  hasDatasetEvaluation: boolean;
  hasPermutationImportance: boolean;
  hasPermutationImpactCompleteLog: boolean;
  hasPermutationImpactExportLog: boolean;
  mockTrainRequestCount: number;
  mockExportModelRequestCount: number;
  mockImportModelRequestCount: number;
  mockInferRequestCount: number;
  storedTrainedLabelASongCount: number | null;
  storedTrainedLabelBSongCount: number | null;
  storedSelectedFeatureIds: string[] | null;
  storedComparisonRunCount: number | null;
  storedComparisonRunId: string | null;
  storedComparisonRunNumber: number | null;
  storedComparisonInputKind: string | null;
  storedComparisonSelectedFeatureIds: string[] | null;
  storedComparisonTrainingAccuracy: number | null;
  storedComparisonTrainingLoss: number | null;
  storedComparisonReviewStatus: string | null;
  storedComparisonNote: string | null;
  storedComparisonWarningCodes: string[] | null;
  selectedProcessingMethod: string | null;
  dimensionalityReductionChecked: boolean | null;
  selectedReductionMethod: string | null;
  selectedTargetDimensions: string | null;
  hiddenLayerCount: string | null;
  storageSnapshot: AnnSetupSnapshot | null;
  hasPendingReattachmentStorage: boolean;
  pendingReattachmentUserSongCount: number | null;
  audioFetchCount: number;
};

type SetupDownload = {
  filename: string | null;
  href: string | null;
  payload: unknown;
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
          reject(new Error('Could not allocate a setup route-test port.'));
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

function findChromeExecutables(): string[] {
  const candidates = explicitChromeCandidates.length > 0 ? explicitChromeCandidates : defaultChromeCandidates;
  return Array.from(new Set(candidates.filter(candidate => existsSync(candidate))));
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
  const profileDir = join(tmpdir(), `ann-setup-portability-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code ?? '') || attempt === 6) return;
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
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timer: NodeJS.Timeout }>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener('message', async event => {
      let message: CdpMessage;
      try {
        message = JSON.parse(await websocketDataToString(event.data)) as CdpMessage;
      } catch (error) {
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
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
      }
    });

    this.socket.addEventListener('error', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chrome DevTools websocket failed.'));
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
    awaitPromise: true,
    returnByValue: true,
  }, 30000, sessionId) as { result?: { value?: T }; exceptionDetails?: CdpMessage['exceptionDetails'] };

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description ?? evaluation.exceptionDetails.text ?? 'Runtime evaluation failed.');
  }

  return evaluation.result?.value as T;
}

async function waitForCondition<T>(
  client: CdpClient,
  sessionId: string,
  getter: () => Promise<T>,
  predicate: (value: T) => boolean,
  description: string,
  timeoutMs = 70000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | null = null;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const value = await getter();
      lastValue = value;
      if (predicate(value)) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}. Last error: ${String(lastError)}`);
}

function createStoredSetup(): AnnSetupSnapshot {
  return {
    version: 1,
    namedLists: {
      [exportedLabelName]: exportedSongIds,
    },
    selectedFeatureIds: ['energy'],
    processingMethod: 'normalize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 3,
    networkConfig: {
      hiddenLayers: 2,
      nodesPerLayer: [12, 6],
      activation: 'tanh',
      optimizer: 'sgd',
      learningRate: 0.01,
      epochs: 25,
      splitRatio: 0.75,
      batchSize: 8,
      randomSeed: 2026,
      targetLoss: 0.05,
    },
  };
}

function createImportedSetup(): AnnSetupSnapshot {
  return {
    version: 1,
    namedLists: {
      [importedLabelName]: importedSongIds,
    },
    selectedFeatureIds: ['mfcc', 'energy'],
    processingMethod: 'none',
    useDimensionalityReduction: false,
    reductionMethod: 'umap',
    targetDimensions: 2,
    networkConfig: {
      hiddenLayers: 1,
      nodesPerLayer: [8],
      activation: 'relu',
      optimizer: 'adam',
      learningRate: 0.001,
      epochs: 10,
      splitRatio: 0.8,
      batchSize: 4,
      randomSeed: 17,
    },
  };
}

function createTrainedModelSetup(): AnnSetupSnapshot {
  return {
    version: 1,
    namedLists: {
      [trainedModelLabelA]: trainedModelSongIds.slice(0, 2),
      [trainedModelLabelB]: trainedModelSongIds.slice(2, 4),
    },
    selectedFeatureIds: ['energy'],
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'pca',
    targetDimensions: 2,
    networkConfig: {
      hiddenLayers: 1,
      nodesPerLayer: [6],
      activation: 'relu',
      optimizer: 'sgd',
      learningRate: 0.01,
      epochs: 4,
      splitRatio: 0.5,
      batchSize: 2,
      randomSeed: 42,
    },
  };
}

function installPreloadScript(setup: AnnSetupSnapshot): string {
  return `
    (() => {
      const storageKey = ${JSON.stringify(ANN_SETUP_STORAGE_KEY)};
      const seedKey = 'musiccluster-ann-setup-portability-seeded';
      const setupSnapshot = ${JSON.stringify(JSON.stringify(setup))};
      if (window.sessionStorage.getItem(seedKey) !== '1') {
        window.localStorage.setItem(storageKey, setupSnapshot);
        window.sessionStorage.setItem(seedKey, '1');
      }
      window.__annSetupAudioFetches = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/audio/')) {
          window.__annSetupAudioFetches.push(url);
          return Promise.reject(new Error('Blocked /audio/ fetch during setup portability smoke.'));
        }
        return originalFetch(input, init);
      };
    })();
  `;
}

async function getSetupRouteState(client: CdpClient, sessionId: string): Promise<SetupRouteState> {
  return evaluateInPage<SetupRouteState>(client, sessionId, `
    (() => {
      const text = document.body.textContent || '';
      const storageRaw = window.localStorage.getItem(${JSON.stringify(ANN_SETUP_STORAGE_KEY)});
      const storageSnapshot = storageRaw ? JSON.parse(storageRaw) : null;
      const comparisonStorageRaw = window.localStorage.getItem(${JSON.stringify(ANN_MODEL_COMPARISON_STORAGE_KEY)});
      const comparisonStorageSnapshot = comparisonStorageRaw ? JSON.parse(comparisonStorageRaw) : null;
      const reattachmentStorageRaw = window.localStorage.getItem(${JSON.stringify(ANN_UPLOADED_DATASET_REATTACHMENT_STORAGE_KEY)});
      const reattachmentStorageSnapshot = reattachmentStorageRaw ? JSON.parse(reattachmentStorageRaw) : null;
      const processingInput = document.querySelector('button[data-ann-processing-method][aria-pressed="true"]');
      const reductionSelect = document.querySelector('button[data-ann-reduction-method][aria-pressed="true"]');
      const dimensionsSelect = document.querySelector('button[data-ann-reduction-dimensions][aria-pressed="true"]');
      const hiddenLayersInput = document.querySelector('#hiddenLayers');
      const reattachmentFilter = document.querySelector('#annUploadedDatasetReattachmentFilter');
      const reattachmentSearch = document.querySelector('#annUploadedDatasetReattachmentSearch');
      const buttons = Array.from(document.querySelectorAll('button'));
      const exportTrainedModelButton = buttons.find(button => button.textContent?.includes('Export Trained Model'));
      const mockWorkerMessages = Array.isArray(window.__annMockWorkerMessages) ? window.__annMockWorkerMessages : [];
      const storedNamedLists = storageSnapshot?.namedLists && typeof storageSnapshot.namedLists === 'object'
        ? storageSnapshot.namedLists
        : {};
      const storedLabelA = Array.isArray(storedNamedLists[${JSON.stringify(trainedModelLabelA)}])
        ? storedNamedLists[${JSON.stringify(trainedModelLabelA)}]
        : null;
      const storedLabelB = Array.isArray(storedNamedLists[${JSON.stringify(trainedModelLabelB)}])
        ? storedNamedLists[${JSON.stringify(trainedModelLabelB)}]
        : null;
      const storedComparisonRuns = Array.isArray(comparisonStorageSnapshot?.runs)
        ? comparisonStorageSnapshot.runs
        : null;
      const storedComparisonRun = storedComparisonRuns?.[0] ?? null;

      return {
        href: window.location.href,
        readyState: document.readyState,
        textExcerpt: text.slice(0, 500),
        hasInitializingOverlay: text.includes('Initializing Workers'),
        hasExportButton: Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('Export Labels & Setup')),
        hasImportButton: Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('Import Labels & Setup')),
        hasReattachButton: Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('Reattach Uploaded Files')),
        hasExportedLabel: text.includes(${JSON.stringify(exportedLabelName)}),
        hasImportedLabel: text.includes(${JSON.stringify(importedLabelName)}),
        hasUploadedSong: text.includes('Setup Route Upload.wav'),
        hasReattachedImportedUpload: text.includes(${JSON.stringify(importedUploadedSong.name)}),
        hasExpectedFilesReview: text.includes('Expected files')
          && text.includes(${JSON.stringify(importedUploadedSong.name)})
          && text.includes(${JSON.stringify(importedLabelName)}),
        hasReattachmentReview: text.includes('Reattachment review')
          && text.includes('Attached')
          && text.includes(${JSON.stringify(importedUploadedSong.name)}),
        hasReattachmentFilter: Boolean(reattachmentFilter)
          && reattachmentFilter.textContent?.includes('Needs attention')
          && reattachmentFilter.textContent?.includes('Attached only')
          && reattachmentFilter.textContent?.includes('Skipped only'),
        hasReattachmentSearch: Boolean(reattachmentSearch)
          && reattachmentSearch.getAttribute('placeholder') === 'Search files',
        hasReadyReattachmentConfirmation: text.includes('Ready to continue')
          && text.includes('1 uploaded file reattached. Re-extract features before training.'),
        hasNeedsAttentionReattachmentConfirmation: text.includes('Needs attention')
          && text.includes('1 uploaded file reattached, but 1 selected item still needs review before training.'),
        hasContinueWithAttachedButton: Array.from(document.querySelectorAll('button')).some(button => button.textContent?.includes('Continue With Attached Files')),
        hasContinuedWithAttachedConfirmation: text.includes('Continuing with attached files')
          && text.includes('1 uploaded file reattached. 1 selected item was left out of this ANN setup.'),
        hasExpectedFileMetadata: text.includes('2 KB') && text.includes('2026-05-28 20:26 UTC'),
        hasReattachmentMetadata: text.includes('Attached (1)')
          && text.includes('2 KB')
          && text.includes('2026-05-28 20:26 UTC'),
        hasRestoreLog: text.includes('[ANN Setup] Restored saved labels and pipeline settings.'),
        hasImportLog: text.includes('[ANN Setup] Imported 2 default-song assignments across 1 label. 2 uploaded songs need file reattachment. Re-extract features before training.'),
        hasUploadLog: text.includes('Added 1 uploaded training song. Extract features again before training.'),
        hasReattachLog: text.includes('[ANN Setup] Reattached 1 uploaded training song. Extract features again before training.'),
        hasTrainedModelPortabilityPanel: text.includes('Trained model portability'),
        hasExportTrainedModelButton: Boolean(exportTrainedModelButton),
        hasImportTrainedModelButton: buttons.some(button => button.textContent?.includes('Import Trained Model')),
        exportTrainedModelButtonDisabled: exportTrainedModelButton ? exportTrainedModelButton.disabled : null,
        hasTrainedModelLabelA: text.includes(${JSON.stringify(trainedModelLabelA)}),
        hasTrainedModelLabelB: text.includes(${JSON.stringify(trainedModelLabelB)}),
        hasDefaultCacheLoadedLog: text.includes('[ANN Cache] Loaded cached default features'),
        hasPreparedEnergyMatrixLog: text.includes('Prepared ANN matrix: 25 songs, 1 columns.'),
        hasRawTrainingInputLog: text.includes('Using raw/unprocessed data for training.'),
        hasTrainingCompleteLog: text.includes('Training complete. Final Test Accuracy: 87.50%'),
        hasTrainedModelExportLog: text.includes('[ANN Model] Exported trained model, weights, and pipeline snapshot.'),
        hasTrainedModelImportLog: text.includes('[ANN Model] Imported trained raw model with 2 output labels.'),
        hasImportedTrainedModelContext: text.includes('Imported model context')
          && text.includes('Run 1')
          && text.includes('raw / 1 dims'),
        hasImportedTrainedModelReview: text.includes('Unreviewed'),
        hasImportedTrainedModelWarnings: text.includes('Small training set')
          && text.includes('Under-sampled labels'),
        hasLiveModelComparison: text.includes('Live model comparison')
          && text.includes('Live model Run 1 uses raw input with training 87.5%.')
          && text.includes('Live model'),
        hasFeatureSignal: text.includes('Feature signal')
          && text.includes('Top signal:')
          && text.includes('1 input / 4 labeled rows'),
        hasDatasetInferenceCompleteLog: text.includes('[ANN Infer][Dataset] Complete |'),
        hasDatasetEvaluation: text.includes('Dataset evaluation')
          && text.includes('Correct')
          && text.includes('Avg confidence'),
        hasPermutationImportance: text.includes('Feature impact')
          && text.includes('Analyze Feature Impact')
          && text.includes('No tested input dimension reduced dataset accuracy when permuted.')
          && text.includes('No confidence change'),
        hasPermutationImpactCompleteLog: text.includes('Feature impact analysis complete.'),
        hasPermutationImpactExportLog: text.includes('Exported feature impact summary.'),
        mockTrainRequestCount: mockWorkerMessages.filter(message => message.type === 'train').length,
        mockExportModelRequestCount: mockWorkerMessages.filter(message => message.type === 'exportModel').length,
        mockImportModelRequestCount: mockWorkerMessages.filter(message => message.type === 'importModel').length,
        mockInferRequestCount: mockWorkerMessages.filter(message => message.type === 'infer').length,
        storedTrainedLabelASongCount: storedLabelA ? storedLabelA.length : null,
        storedTrainedLabelBSongCount: storedLabelB ? storedLabelB.length : null,
        storedSelectedFeatureIds: Array.isArray(storageSnapshot?.selectedFeatureIds)
          ? storageSnapshot.selectedFeatureIds
          : null,
        storedComparisonRunCount: storedComparisonRuns ? storedComparisonRuns.length : null,
        storedComparisonRunId: typeof storedComparisonRun?.id === 'string' ? storedComparisonRun.id : null,
        storedComparisonRunNumber: Number.isFinite(storedComparisonRun?.runNumber) ? storedComparisonRun.runNumber : null,
        storedComparisonInputKind: typeof storedComparisonRun?.inputKind === 'string' ? storedComparisonRun.inputKind : null,
        storedComparisonSelectedFeatureIds: Array.isArray(storedComparisonRun?.selectedFeatureIds)
          ? storedComparisonRun.selectedFeatureIds
          : null,
        storedComparisonTrainingAccuracy: Number.isFinite(storedComparisonRun?.trainingAccuracy)
          ? storedComparisonRun.trainingAccuracy
          : null,
        storedComparisonTrainingLoss: Number.isFinite(storedComparisonRun?.trainingLoss)
          ? storedComparisonRun.trainingLoss
          : null,
        storedComparisonReviewStatus: typeof storedComparisonRun?.reviewStatus === 'string'
          ? storedComparisonRun.reviewStatus
          : null,
        storedComparisonNote: typeof storedComparisonRun?.note === 'string' ? storedComparisonRun.note : null,
        storedComparisonWarningCodes: Array.isArray(storedComparisonRun?.warningCodes)
          ? storedComparisonRun.warningCodes
          : null,
        selectedProcessingMethod: processingInput ? processingInput.getAttribute('data-ann-processing-method') : null,
        dimensionalityReductionChecked: reductionSelect ? reductionSelect.dataset.annReductionMethod !== 'none' : null,
        selectedReductionMethod: reductionSelect?.dataset.annReductionMethod ?? null,
        selectedTargetDimensions: dimensionsSelect?.dataset.annReductionDimensions ?? null,
        hiddenLayerCount: hiddenLayersInput ? hiddenLayersInput.value : null,
        storageSnapshot,
        hasPendingReattachmentStorage: Number.isFinite(reattachmentStorageSnapshot?.userSongCount)
          && reattachmentStorageSnapshot.userSongCount > 0,
        pendingReattachmentUserSongCount: reattachmentStorageSnapshot?.userSongCount ?? null,
        audioFetchCount: Array.isArray(window.__annSetupAudioFetches) ? window.__annSetupAudioFetches.length : -1,
      };
    })()
  `);
}

function installTrainedModelMockWorkerScript(): string {
  return `
    (() => {
      const trainedModelLabelA = ${JSON.stringify(trainedModelLabelA)};
      const trainedModelLabelB = ${JSON.stringify(trainedModelLabelB)};
      const trainedModelSongIds = ${JSON.stringify(trainedModelSongIds)};
      const labelBySongId = new Map([
        [trainedModelSongIds[0], trainedModelLabelA],
        [trainedModelSongIds[1], trainedModelLabelA],
        [trainedModelSongIds[2], trainedModelLabelB],
        [trainedModelSongIds[3], trainedModelLabelB],
      ]);
      window.__annMockWorkerMessages = [];

      function createActivationSnapshot(epoch, songId) {
        return {
          epoch,
          songId,
          layers: [
            { name: 'Input', units: 1, values: [0.25], min: 0.25, max: 0.25, mean: 0.25 },
            { name: 'hidden_1', units: 6, values: [0.1, 0.2, 0.3, 0.4], min: 0.1, max: 0.4, mean: 0.25 },
            { name: 'output', units: 2, values: [0.8, 0.2], min: 0.2, max: 0.8, mean: 0.5 },
          ],
        };
      }

      class MockAnnWorker {
        constructor(url) {
          this.url = String(url);
          this.onmessage = null;
          this.listeners = new Set();
          if (this.url.includes('druid-worker')) this.emit({ type: 'druidWorkerReady' });
          if (this.url.includes('mlp-worker')) this.emit({ type: 'mlpWorkerReady' });
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

          if (message?.type === 'exportModel') {
            this.emit({
              type: 'modelExportComplete',
              requestId: message.requestId,
              payload: {
                outputLabels: [trainedModelLabelA, trainedModelLabelB],
                modelArtifacts: {
                  modelTopology: {
                    class_name: 'Sequential',
                    config: { name: 'route_portable_model' },
                  },
                  weightSpecs: [
                    { name: 'dense/kernel', shape: [1, 2], dtype: 'float32' },
                  ],
                  weightData: new Uint8Array([0, 1, 2, 255]).buffer,
                  format: 'layers-model',
                  generatedBy: 'MusicCluster route smoke',
                  convertedBy: null,
                },
              },
            }, 10);
          }

          if (message?.type === 'importModel') {
            this.emit({
              type: 'modelImportComplete',
              requestId: message.requestId,
              payload: {
                outputLabels: Array.isArray(message.payload?.outputLabels)
                  ? message.payload.outputLabels
                  : [trainedModelLabelA, trainedModelLabelB],
              },
            }, 10);
          }

          if (message?.type === 'infer') {
            const songIds = Array.isArray(message.payload?.songIds) ? message.payload.songIds : [];
            const results = {};
            songIds.forEach((songId, index) => {
              results[songId] = {
                predictedLabel: labelBySongId.get(songId) ?? (index < 13 ? trainedModelLabelA : trainedModelLabelB),
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

      window.Worker = MockAnnWorker;
    })();
  `;
}

async function clickButtonByText(client: CdpClient, sessionId: string, text: string): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find(item => item.textContent?.includes(${JSON.stringify(text)}));
      if (!button) throw new Error(${JSON.stringify(`${text} button was not rendered.`)});
      if (button.disabled) throw new Error(${JSON.stringify(`${text} button was disabled.`)});
      button.click();
      return true;
    })()
  `);
}

async function clickTrainedModelExport(client: CdpClient, sessionId: string): Promise<SetupDownload> {
  return evaluateInPage<SetupDownload>(client, sessionId, `
    (async () => {
      window.__annTrainedModelCapturedBlob = null;
      window.__annTrainedModelCapturedDownload = null;
      URL.createObjectURL = (blob) => {
        window.__annTrainedModelCapturedBlob = blob;
        return 'blob:ann-trained-model-portability-smoke';
      };
      URL.revokeObjectURL = (url) => {
        window.__annTrainedModelRevokedUrl = url;
      };
      HTMLAnchorElement.prototype.click = function() {
        window.__annTrainedModelCapturedDownload = {
          filename: this.download || null,
          href: this.href || null,
        };
      };
      const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Export Trained Model'));
      if (!button) throw new Error('Export Trained Model button was not rendered.');
      if (button.disabled) throw new Error('Export Trained Model button was disabled.');
      button.click();
      const deadline = Date.now() + 10000;
      while (!window.__annTrainedModelCapturedBlob && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!window.__annTrainedModelCapturedBlob) throw new Error('Trained model export did not create a JSON blob.');
      const payload = JSON.parse(await window.__annTrainedModelCapturedBlob.text());
      return {
        filename: window.__annTrainedModelCapturedDownload?.filename ?? null,
        href: window.__annTrainedModelCapturedDownload?.href ?? null,
        payload,
      };
    })()
  `);
}

async function clickFeatureImpactExport(client: CdpClient, sessionId: string): Promise<SetupDownload> {
  return evaluateInPage<SetupDownload>(client, sessionId, `
    (async () => {
      window.__annFeatureImpactCapturedBlob = null;
      window.__annFeatureImpactCapturedDownload = null;
      URL.createObjectURL = (blob) => {
        window.__annFeatureImpactCapturedBlob = blob;
        return 'blob:ann-feature-impact-portability-smoke';
      };
      URL.revokeObjectURL = (url) => {
        window.__annFeatureImpactRevokedUrl = url;
      };
      HTMLAnchorElement.prototype.click = function() {
        window.__annFeatureImpactCapturedDownload = {
          filename: this.download || null,
          href: this.href || null,
        };
      };
      const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Export Feature Impact'));
      if (!button) throw new Error('Export Feature Impact button was not rendered.');
      if (button.disabled) throw new Error('Export Feature Impact button was disabled.');
      button.click();
      const deadline = Date.now() + 10000;
      while (!window.__annFeatureImpactCapturedBlob && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!window.__annFeatureImpactCapturedBlob) throw new Error('Feature impact export did not create a JSON blob.');
      const payload = JSON.parse(await window.__annFeatureImpactCapturedBlob.text());
      return {
        filename: window.__annFeatureImpactCapturedDownload?.filename ?? null,
        href: window.__annFeatureImpactCapturedDownload?.href ?? null,
        payload,
      };
    })()
  `);
}

async function importTrainedModel(client: CdpClient, sessionId: string, payload: unknown): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const trainedModelInput = document.querySelector('#annTrainedModelImport');
      if (!trainedModelInput) throw new Error('Trained model import file input was not rendered.');
      const file = new File(
        [${JSON.stringify(JSON.stringify(payload))}],
        'musiccluster-ann-trained-model-import.json',
        { type: 'application/json' }
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      trainedModelInput.files = transfer.files;
      trainedModelInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
}

async function uploadTrainingSongForSetupExport(client: CdpClient, sessionId: string): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const uploadInput = document.querySelector('input[type="file"][accept="audio/*"]');
      if (!uploadInput) throw new Error('Training audio upload input was not rendered.');
      const file = new File(
        [new Uint8Array(2048)],
        'Setup Route Upload.wav',
        { type: 'audio/wav', lastModified: 1780000000000 }
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      uploadInput.files = transfer.files;
      uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
}

async function clickSetupExport(client: CdpClient, sessionId: string): Promise<SetupDownload> {
  return evaluateInPage<SetupDownload>(client, sessionId, `
    (async () => {
      window.__annSetupCapturedBlob = null;
      window.__annSetupCapturedDownload = null;
      URL.createObjectURL = (blob) => {
        window.__annSetupCapturedBlob = blob;
        return 'blob:ann-setup-portability-smoke';
      };
      URL.revokeObjectURL = (url) => {
        window.__annSetupRevokedUrl = url;
      };
      HTMLAnchorElement.prototype.click = function() {
        window.__annSetupCapturedDownload = {
          filename: this.download || null,
          href: this.href || null,
        };
      };
      const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Export Labels & Setup'));
      if (!button) throw new Error('Export Labels & Setup button was not rendered.');
      button.click();
      if (!window.__annSetupCapturedBlob) throw new Error('Setup export did not create a JSON blob.');
      const payload = JSON.parse(await window.__annSetupCapturedBlob.text());
      return {
        filename: window.__annSetupCapturedDownload?.filename ?? null,
        href: window.__annSetupCapturedDownload?.href ?? null,
        payload,
      };
    })()
  `);
}

async function importSetup(client: CdpClient, sessionId: string, setup: AnnSetupSnapshot): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const inputs = Array.from(document.querySelectorAll('input[type="file"][accept="application/json,.json"]'));
      const setupInput = inputs[0];
      if (!setupInput) throw new Error('Setup import file input was not rendered.');
      const payload = ${JSON.stringify(JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-06-17T13:00:00.000Z',
        setup,
        externalDataset: {
          version: 1,
          userSongCount: 2,
          assignedUserSongCount: 2,
          songs: [importedUploadedSong, missingImportedUploadedSong],
        },
      }))};
      const file = new File([payload], 'ann-setup-import.json', { type: 'application/json' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      setupInput.files = transfer.files;
      setupInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
}

async function reattachImportedUploadedDataset(client: CdpClient, sessionId: string): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const reattachInput = document.querySelector('#annUploadedDatasetReattachFiles');
      if (!reattachInput) throw new Error('Uploaded dataset reattach file input was not rendered.');
      const file = new File(
        [new Uint8Array(2048)],
        ${JSON.stringify(importedUploadedSong.name)},
        { type: 'audio/wav', lastModified: 1780000003000 }
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      reattachInput.files = transfer.files;
      reattachInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
}

async function continueWithAttachedUploadedDataset(client: CdpClient, sessionId: string): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find(item => item.textContent?.includes('Continue With Attached Files'));
      if (!button) throw new Error('Continue With Attached Files button was not rendered.');
      button.click();
      return true;
    })()
  `);
}

async function clearAnnSetupStorage(client: CdpClient, sessionId: string): Promise<void> {
  await evaluateInPage<boolean>(client, sessionId, `
    (() => {
      window.localStorage.removeItem(${JSON.stringify(ANN_SETUP_STORAGE_KEY)});
      window.localStorage.removeItem(${JSON.stringify(ANN_MODEL_COMPARISON_STORAGE_KEY)});
      return true;
    })()
  `);
}

async function runSetupPortabilitySmoke(chromePath: string, url: string): Promise<{
  download: SetupDownload;
  beforeImport: SetupRouteState;
  afterImport: SetupRouteState;
  afterImportReload: SetupRouteState;
  afterReattach: SetupRouteState;
  afterContinueWithAttached: SetupRouteState;
}> {
  const debugPort = await getOpenPort();
  const chrome = launchChrome(chromePath, debugPort);
  let client: CdpClient | null = null;

  try {
    const { webSocketDebuggerUrl } = await waitForChromeVersion(debugPort, chrome.child, chrome.getOutput);
    client = await CdpClient.connect(webSocketDebuggerUrl);
    const target = await client.send('Target.createTarget', { url: 'about:blank' }) as { targetId: string };
    const attached = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }) as { sessionId: string };
    const sessionId = attached.sessionId;

    await client.send('Page.enable', {}, 30000, sessionId);
    await client.send('Runtime.enable', {}, 30000, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: installPreloadScript(createStoredSetup()),
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    const beforeImport = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        !state.hasInitializingOverlay
        && state.hasExportButton
        && state.hasImportButton
        && state.hasExportedLabel
        && state.hasRestoreLog
        && state.selectedProcessingMethod === 'normalize'
        && state.dimensionalityReductionChecked === true
        && state.selectedReductionMethod === 'pca'
        && state.selectedTargetDimensions === '3'
      ),
      'restored setup export/import controls'
    );

    await uploadTrainingSongForSetupExport(client, sessionId);
    const afterUpload = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasUploadedSong
        && state.hasUploadLog
        && state.audioFetchCount === 0
      ),
      'uploaded song identity without audio fetches'
    );
    assert.equal(afterUpload.audioFetchCount, 0);

    const download = await clickSetupExport(client, sessionId);
    const payload = download.payload as {
      schemaVersion?: number;
      labelCount?: number;
      assignedSongCount?: number;
      selectedFeatureCount?: number;
      setup?: AnnSetupSnapshot;
      externalDataset?: {
        version?: number;
        userSongCount?: number;
        assignedUserSongCount?: number;
        songs?: Array<{
          songId?: string;
          name?: string;
          externalId?: string;
          assignedLabels?: string[];
        }>;
      };
    };
    assert.equal(download.href, 'blob:ann-setup-portability-smoke');
    assert.match(download.filename ?? '', /^musiccluster-ann-setup-.*\.json$/);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.labelCount, 1);
    assert.equal(payload.assignedSongCount, 2);
    assert.equal(payload.selectedFeatureCount, 1);
    assert.deepEqual(payload.setup?.namedLists[exportedLabelName], exportedSongIds);
    assert.equal(payload.setup?.processingMethod, 'normalize');
    assert.equal(payload.setup?.useDimensionalityReduction, true);
    assert.equal(payload.setup?.targetDimensions, 3);
    assert.equal(payload.externalDataset?.version, 1);
    assert.equal(payload.externalDataset?.userSongCount, 1);
    assert.equal(payload.externalDataset?.assignedUserSongCount, 0);
    assert.deepEqual(payload.externalDataset?.songs, [
      {
        songId: 'user-upload-setup-route-upload',
        name: 'Setup Route Upload.wav',
        externalId: 'browser-file:setup-route-upload-wav:2048:1780000000000',
        assignedLabels: [],
      },
    ]);
    assert.equal(JSON.stringify(payload).includes('blob:'), false);

    await importSetup(client, sessionId, createImportedSetup());
    const afterImport = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasImportedLabel
        && !state.hasExportedLabel
        && state.hasImportLog
        && state.hasReattachButton
        && state.hasExpectedFilesReview
        && state.hasExpectedFileMetadata
        && state.hasPendingReattachmentStorage
        && state.pendingReattachmentUserSongCount === 2
        && state.selectedProcessingMethod === 'none'
        && state.dimensionalityReductionChecked === false
        && state.hiddenLayerCount === '1'
        && state.storageSnapshot?.namedLists?.[importedLabelName]?.length === 2
        && state.storageSnapshot?.processingMethod === 'none'
        && state.storageSnapshot?.reductionMethod === 'umap'
        && state.storageSnapshot?.targetDimensions === 2
      ),
      'imported setup state'
    );

    assert.equal(afterImport.audioFetchCount, 0);

    await client.send('Page.reload', { ignoreCache: true }, 30000, sessionId);
    const afterImportReload = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        !state.hasInitializingOverlay
        && state.hasImportedLabel
        && state.hasReattachButton
        && state.hasExpectedFilesReview
        && state.hasExpectedFileMetadata
        && state.hasPendingReattachmentStorage
        && state.pendingReattachmentUserSongCount === 2
        && state.selectedProcessingMethod === 'none'
        && state.audioFetchCount === 0
      ),
      'restored pending uploaded-dataset reattachment after reload'
    );
    assert.equal(afterImportReload.audioFetchCount, 0);

    await reattachImportedUploadedDataset(client, sessionId);
    const afterReattach = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasImportedLabel
        && state.hasReattachedImportedUpload
        && state.hasReattachLog
        && state.hasReattachmentReview
        && state.hasReattachmentFilter
        && state.hasReattachmentSearch
        && state.hasNeedsAttentionReattachmentConfirmation
        && state.hasContinueWithAttachedButton
        && state.hasReattachmentMetadata
        && state.hasPendingReattachmentStorage
        && state.pendingReattachmentUserSongCount === 1
        && state.audioFetchCount === 0
      ),
      'partially reattached imported uploaded dataset'
    );

    assert.equal(afterReattach.audioFetchCount, 0);

    await continueWithAttachedUploadedDataset(client, sessionId);
    const afterContinueWithAttached = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasImportedLabel
        && state.hasReattachedImportedUpload
        && state.hasContinuedWithAttachedConfirmation
        && !state.hasContinueWithAttachedButton
        && !state.hasPendingReattachmentStorage
        && state.audioFetchCount === 0
      ),
      'continued with partially reattached uploaded dataset'
    );

    assert.equal(afterContinueWithAttached.audioFetchCount, 0);
    return { download, beforeImport, afterImport, afterImportReload, afterReattach, afterContinueWithAttached };
  } finally {
    client?.close();
    await stopChrome(chrome.child, chrome.profileDir);
  }
}

async function runTrainedModelPortabilitySmoke(chromePath: string, url: string): Promise<{
  download: SetupDownload;
  beforeTraining: SetupRouteState;
  afterFeatureExtraction: SetupRouteState;
  afterTraining: SetupRouteState;
  afterReload: SetupRouteState;
  afterImport: SetupRouteState;
  afterInference: SetupRouteState;
  afterPermutationImpact: SetupRouteState;
  afterFeatureImpactExport: SetupRouteState;
  featureImpactDownload: SetupDownload;
}> {
  const debugPort = await getOpenPort();
  const chrome = launchChrome(chromePath, debugPort);
  let client: CdpClient | null = null;

  try {
    const { webSocketDebuggerUrl } = await waitForChromeVersion(debugPort, chrome.child, chrome.getOutput);
    client = await CdpClient.connect(webSocketDebuggerUrl);
    const target = await client.send('Target.createTarget', { url: 'about:blank' }) as { targetId: string };
    const attached = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }) as { sessionId: string };
    const sessionId = attached.sessionId;

    await client.send('Page.enable', {}, 30000, sessionId);
    await client.send('Runtime.enable', {}, 30000, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }, 30000, sessionId);
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: installPreloadScript(createTrainedModelSetup()),
    }, 30000, sessionId);
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: installTrainedModelMockWorkerScript(),
    }, 30000, sessionId);
    await client.send('Page.navigate', { url }, 30000, sessionId);

    const beforeTraining = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        !state.hasInitializingOverlay
        && state.hasTrainedModelPortabilityPanel
        && state.hasExportTrainedModelButton
        && state.hasImportTrainedModelButton
        && state.exportTrainedModelButtonDisabled === true
        && state.hasTrainedModelLabelA
        && state.hasTrainedModelLabelB
        && state.hasDefaultCacheLoadedLog
        && state.selectedProcessingMethod === 'standardize'
        && state.dimensionalityReductionChecked === false
        && state.audioFetchCount === 0
      ),
      'trained-model portability controls before training'
    );

    await clickButtonByText(client, sessionId, 'Extract Features');
    const afterFeatureExtraction = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasPreparedEnergyMatrixLog
        && state.audioFetchCount === 0
      ),
      'cache-backed feature extraction for trained-model portability'
    );

    await clickButtonByText(client, sessionId, 'Train Automatic');
    const afterTraining = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasRawTrainingInputLog
        && state.hasTrainingCompleteLog
        && state.exportTrainedModelButtonDisabled === false
        && state.mockTrainRequestCount === 1
        && state.audioFetchCount === 0
      ),
      'trained model ready for export'
    );

    const download = await clickTrainedModelExport(client, sessionId);
    const payload = download.payload as {
      schemaVersion?: number;
      kind?: string;
      training?: { inputKind?: string; selectedFeatureIds?: string[]; finalAccuracy?: number };
      pipeline?: { inputKind?: string; labelMap?: Record<string, number> };
      modelInput?: { inputKind?: string; songIds?: string[]; vectors?: number[][] };
      labelAssignments?: { assignedSongCount?: number; namedLists?: Record<string, string[]> };
      outputLabels?: string[];
      model?: { weightDataBase64?: string; weightDataByteLength?: number; weightSpecs?: unknown[] };
      comparisonRun?: {
        id?: string;
        runNumber?: number;
        trainedAt?: string;
        inputKind?: string;
        inputDimension?: number;
        selectedFeatureIds?: string[];
        trainingAccuracy?: number | null;
        trainingLoss?: number | null;
        datasetAccuracy?: number | null;
        validationAccuracy?: number | null;
        reviewStatus?: string;
        note?: string;
        warningCodes?: string[];
      } | null;
    };
    assert.equal(download.href, 'blob:ann-trained-model-portability-smoke');
    assert.match(download.filename ?? '', /^musiccluster-ann-trained-model-run-1-.*\.json$/);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.kind, 'musiccluster-ann-trained-model');
    assert.equal(payload.training?.inputKind, 'raw');
    assert.deepEqual(payload.training?.selectedFeatureIds, ['energy']);
    assert.equal(payload.training?.finalAccuracy, 0.875);
    assert.equal(payload.pipeline?.inputKind, 'raw');
    assert.deepEqual(payload.pipeline?.labelMap, {
      [trainedModelLabelA]: 0,
      [trainedModelLabelB]: 1,
    });
    assert.equal(payload.modelInput?.inputKind, 'raw');
    assert.equal(payload.modelInput?.songIds?.length, 25);
    assert.equal(payload.modelInput?.vectors?.length, 25);
    assert.deepEqual(payload.labelAssignments, {
      assignedSongCount: 4,
      namedLists: {
        [trainedModelLabelA]: trainedModelSongIds.slice(0, 2),
        [trainedModelLabelB]: trainedModelSongIds.slice(2, 4),
      },
    });
    assert.deepEqual(payload.outputLabels, [trainedModelLabelA, trainedModelLabelB]);
    assert.equal(payload.model?.weightDataBase64, 'AAEC/w==');
    assert.equal(payload.model?.weightDataByteLength, 4);
    assert.equal(Array.isArray(payload.model?.weightSpecs), true);
    assert.equal(payload.comparisonRun?.runNumber, 1);
    assert.equal(payload.comparisonRun?.inputKind, 'raw');
    assert.equal(payload.comparisonRun?.inputDimension, 1);
    assert.deepEqual(payload.comparisonRun?.selectedFeatureIds, ['energy']);
    assert.equal(payload.comparisonRun?.trainingAccuracy, 0.875);
    assert.equal(payload.comparisonRun?.trainingLoss, 0.123);
    assert.equal(payload.comparisonRun?.datasetAccuracy, null);
    assert.equal(payload.comparisonRun?.validationAccuracy, null);
    assert.equal(payload.comparisonRun?.reviewStatus, 'unreviewed');
    assert.equal(payload.comparisonRun?.note, '');
    assert.deepEqual(payload.comparisonRun?.warningCodes, ['small-training-set', 'under-sampled-labels']);

    const afterExport = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasTrainedModelExportLog
        && state.mockExportModelRequestCount === 1
        && state.audioFetchCount === 0
      ),
      'trained model export log and worker message'
    );
    assert.equal(afterExport.audioFetchCount, 0);

    await clearAnnSetupStorage(client, sessionId);
    await client.send('Page.reload', { ignoreCache: true }, 30000, sessionId);
    const afterReload = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        !state.hasInitializingOverlay
        && state.hasTrainedModelPortabilityPanel
        && state.storedTrainedLabelASongCount === null
        && state.storedTrainedLabelBSongCount === null
        && state.storedComparisonRunCount === 0
        && state.exportTrainedModelButtonDisabled === true
        && state.hasDefaultCacheLoadedLog
        && state.audioFetchCount === 0
      ),
      'trained model state cleared after reload without saved setup'
    );

    await importTrainedModel(client, sessionId, download.payload);
    const afterImport = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasTrainedModelImportLog
        && state.exportTrainedModelButtonDisabled === false
        && state.storedTrainedLabelASongCount === 2
        && state.storedTrainedLabelBSongCount === 2
        && state.storedSelectedFeatureIds?.length === 1
        && state.storedSelectedFeatureIds.includes('energy')
        && state.storedComparisonRunCount === 1
        && state.storedComparisonRunNumber === 1
        && state.storedComparisonInputKind === 'raw'
        && state.storedComparisonSelectedFeatureIds?.length === 1
        && state.storedComparisonSelectedFeatureIds.includes('energy')
        && state.storedComparisonTrainingAccuracy === 0.875
        && state.storedComparisonTrainingLoss === 0.123
        && state.storedComparisonReviewStatus === 'unreviewed'
        && state.storedComparisonNote === ''
        && state.storedComparisonWarningCodes?.length === 2
        && state.storedComparisonWarningCodes.includes('small-training-set')
        && state.storedComparisonWarningCodes.includes('under-sampled-labels')
        && state.hasImportedTrainedModelContext
        && state.hasImportedTrainedModelReview
        && state.hasImportedTrainedModelWarnings
        && state.hasLiveModelComparison
        && state.hasFeatureSignal
        && state.mockImportModelRequestCount === 1
        && state.audioFetchCount === 0
      ),
      'trained model imported into route state'
    );

    await clickButtonByText(client, sessionId, 'Infer Labels');
    const afterInference = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasDatasetInferenceCompleteLog
        && state.hasDatasetEvaluation
        && state.mockInferRequestCount === 1
        && state.audioFetchCount === 0
      ),
      'dataset inference after trained model import'
    );

    await clickButtonByText(client, sessionId, 'Analyze Feature Impact');
    const afterPermutationImpact = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasPermutationImportance
        && state.hasPermutationImpactCompleteLog
        && state.mockInferRequestCount === 2
        && state.audioFetchCount === 0
      ),
      'permutation feature impact analysis after trained model import'
    );

    const featureImpactDownload = await clickFeatureImpactExport(client, sessionId);
    const featureImpactPayload = featureImpactDownload.payload as any;
    assert.equal(featureImpactPayload.schemaVersion, 1);
    assert.match(featureImpactDownload.filename ?? '', /^musiccluster-ann-feature-impact-run-1-/);
    assert.equal(featureImpactPayload.training.inputKind, 'raw');
    assert.deepEqual(featureImpactPayload.training.selectedFeatureIds, ['energy']);
    assert.equal(featureImpactPayload.impact.summary, 'No tested input dimension reduced dataset accuracy when permuted.');
    assert.equal(featureImpactPayload.impact.baselineAccuracy, 1);
    assert.equal(featureImpactPayload.impact.dimensionCount, 1);
    assert.equal(featureImpactPayload.impact.rows.length, 1);
    assert.equal(featureImpactPayload.impact.rows[0].dimensionLabel, 'energy');
    assert.equal(featureImpactPayload.impact.rows[0].impactLabel, 'No measured drop');
    assert.equal(featureImpactPayload.impact.rows[0].baselineAverageConfidence, 0.92);
    assert.equal(featureImpactPayload.impact.rows[0].permutedAverageConfidence, 0.92);
    assert.equal(featureImpactPayload.impact.rows[0].confidenceDrop, 0);
    assert.equal(featureImpactPayload.impact.rows[0].confidenceDropLabel, 'No confidence change');
    assert.equal(featureImpactPayload.impact.rows[0].lowConfidenceDelta, 0);
    assert.equal(featureImpactPayload.comparisonRun.runNumber, 1);
    assert.equal(featureImpactPayload.comparisonRun.datasetAccuracy, 1);
    const afterFeatureImpactExport = await waitForCondition(
      client,
      sessionId,
      () => getSetupRouteState(client as CdpClient, sessionId),
      state => (
        state.hasPermutationImpactExportLog
        && state.audioFetchCount === 0
      ),
      'feature impact export log without audio fetches'
    );

    return { download, beforeTraining, afterFeatureExtraction, afterTraining, afterReload, afterImport, afterInference, afterPermutationImpact, afterFeatureImpactExport, featureImpactDownload };
  } finally {
    client?.close();
    await stopChrome(chrome.child, chrome.profileDir);
  }
}

test('ANN route exports and imports setup JSON without requesting local audio files', { timeout: 180000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run setup portability browser-route coverage.');
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
        const result = await runSetupPortabilitySmoke(chromePath, url);
        assert.equal(result.beforeImport.audioFetchCount, 0);
        assert.equal(result.afterImport.audioFetchCount, 0);
        assert.equal(result.afterImportReload.audioFetchCount, 0);
        assert.equal(result.afterReattach.audioFetchCount, 0);
        assert.equal(result.afterContinueWithAttached.audioFetchCount, 0);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN setup portability route coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});

test('ANN route exports and imports a trained model without requesting local audio files', { timeout: 180000 }, async t => {
  const chromePaths = findChromeExecutables();
  if (chromePaths.length === 0) {
    t.skip('Chrome or Edge executable not found; set CHROME_BIN to run trained-model portability browser-route coverage.');
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
        const result = await runTrainedModelPortabilitySmoke(chromePath, url);
        assert.equal(result.beforeTraining.audioFetchCount, 0);
        assert.equal(result.afterFeatureExtraction.audioFetchCount, 0);
        assert.equal(result.afterTraining.audioFetchCount, 0);
        assert.equal(result.afterReload.audioFetchCount, 0);
        assert.equal(result.afterImport.audioFetchCount, 0);
        assert.equal(result.afterInference.audioFetchCount, 0);
        assert.equal(result.afterPermutationImpact.audioFetchCount, 0);
        assert.equal(result.afterFeatureImpactExport.audioFetchCount, 0);
        return;
      } catch (error) {
        failures.push(`${basename(chromePath)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    assert.fail(`All browser candidates failed ANN trained-model portability route coverage:\n${failures.join('\n\n')}`);
  } finally {
    await stopProcess(child);
  }
});
