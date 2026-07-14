import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { annWorkerAssetPaths } from '../src/lib/annWorkerAssets';

const host = '127.0.0.1';
const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function getOpenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate an HTTP smoke-test port.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
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
    if (output.length > 10000) output = output.slice(-10000);
  };

  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  return {
    child,
    getOutput: () => output,
  };
}

async function stopNextDev(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill();
  const exited = once(child, 'exit').then(() => true);
  const timedOut = delay(5000).then(() => false);
  if (!(await Promise.race([exited, timedOut]))) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

async function waitForAnnRoute(
  url: string,
  child: ChildProcessWithoutNullStreams,
  getOutput: () => string
): Promise<{ status: number; html: string }> {
  const deadline = Date.now() + 70000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Next dev server exited before /ann responded.\n${getOutput()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return {
          status: response.status,
          html: await response.text(),
        };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for /ann. Last error: ${String(lastError)}\n${getOutput()}`);
}

async function assertWorkerAssetsServed(baseUrl: string): Promise<void> {
  for (const assetPath of annWorkerAssetPaths) {
    const response = await fetch(new URL(assetPath, baseUrl), { method: 'HEAD' });
    assert.equal(response.status, 200, `${assetPath} should be served by Next dev`);
    assert.match(
      response.headers.get('content-type') ?? '',
      /javascript|octet-stream/i,
      `${assetPath} should be served as a script-like asset`
    );
  }
}

test('ANN route serves its client-page shell through Next dev', { timeout: 90000 }, async () => {
  const port = await getOpenPort();
  const url = `http://${host}:${port}/ann`;
  const { child, getOutput } = startNextDev(port);

  try {
    const { status, html } = await waitForAnnRoute(url, child, getOutput);

    assert.equal(status, 200);
    assert.match(html, /MusicCluster - MIR with Unsupervised Music Clustering/);
    assert.match(html, /Loading\.\.\./);
    assert.match(html, /src_app_ann_page_tsx/);
    assert.match(html, /ClientPageRoot/);
    assert.doesNotMatch(html, /Application error|Unhandled Runtime Error|nextjs-portal|__nextjs_original-stack-frames/i);
    await assertWorkerAssetsServed(url);
  } finally {
    await stopNextDev(child);
  }
});
