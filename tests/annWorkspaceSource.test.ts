import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve(process.cwd(), 'src/app/ann/page.tsx'), 'utf8');

test('ANN workspace provides four fixed-height tab pages in the requested order', () => {
  assert.match(pageSource, /\{ id: 'data', label: 'Data & Labels'/);
  assert.match(pageSource, /\{ id: 'model', label: 'Model Inspection'/);
  assert.match(pageSource, /\{ id: 'performance', label: 'Performance'/);
  assert.match(pageSource, /\{ id: 'logs', label: 'Program Logs'/);
  assert.match(pageSource, /data-ann-workspace-pages/);
  assert.match(pageSource, /grid-rows-\[24rem_minmax\(0,1fr\)\]/);
  assert.match(pageSource, /role="tablist"/);
  assert.match(pageSource, /role="tabpanel"/);
  assert.match(pageSource, /isVisible=\{workspacePage === 'model'\}/);
});

test('switching an active session to Automatic waits for explicit authorization', () => {
  assert.match(pageSource, /setIsAutomaticTrainingArmed\(false\)/);
  assert.match(pageSource, /const handleStartAutomaticTraining = useCallback/);
  assert.match(pageSource, /\|\| !isAutomaticTrainingArmed/);
  assert.match(pageSource, /onStartAutomaticTraining=\{handleStartAutomaticTraining\}/);
  assert.match(pageSource, /Click Train Automatic to resume this session/);
});

test('ANN program logs cover training modes, epochs, and both inference paths', () => {
  assert.match(pageSource, /\[ANN Train\]\[\$\{getTrainingModeLabel\(mode\)\}\] Epoch/);
  assert.match(pageSource, /\[ANN Train\]\[Internal Steps\]/);
  assert.match(pageSource, /\[ANN Infer\]\[Dataset\]/);
  assert.match(pageSource, /\[ANN Infer\]\[Uploaded\]/);
});
