import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve(process.cwd(), 'src/app/ann/page.tsx'), 'utf8');
const clusterPageSource = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');
const logPanelSource = readFileSync(resolve(process.cwd(), 'src/components/LogPanel.tsx'), 'utf8');
const mobileLayoutSource = readFileSync(resolve(process.cwd(), 'src/components/MobileLayoutWrapper.tsx'), 'utf8');

test('ANN workspace provides five fixed-height tab pages in the requested order', () => {
  assert.match(pageSource, /\{ id: 'data', label: 'Data Labeling'/);
  assert.match(pageSource, /\{ id: 'model', label: 'Model Inspection'/);
  assert.match(pageSource, /\{ id: 'performance', label: 'Performance'/);
  assert.match(pageSource, /\{ id: 'visualization', label: 'Data Visualization'/);
  assert.match(pageSource, /\{ id: 'logs', label: 'Program Logs'/);
  assert.match(pageSource, /data-ann-workspace-pages/);
  assert.match(pageSource, /data-ann-workspace-page="visualization"/);
  assert.match(pageSource, /grid-cols-5/);
  assert.match(pageSource, /role="tablist"/);
  assert.match(pageSource, /role="tabpanel"/);
  assert.match(pageSource, /isVisible=\{workspacePage === 'model'\}/);
});

test('Cluster and ANN logs append chronologically and follow the latest row', () => {
  assert.match(clusterPageSource, /setLogMessages\(prevLogs => \[\.\.\.prevLogs, logEntry\]\)/);
  assert.match(pageSource, /setLogMessages\(prevLogs => \[\.\.\.prevLogs\.slice\(-199\), logEntry\]\)/);
  assert.match(logPanelSource, /scrollContainer\.scrollTop = scrollContainer\.scrollHeight/);
  assert.match(logPanelSource, /role="log"/);
  assert.doesNotMatch(logPanelSource, /scrollTop = 0/);
});

test('ANN desktop shell is fixed to the viewport with contained overflow', () => {
  assert.match(pageSource, /data-ann-shell/);
  assert.match(pageSource, /md:h-full md:min-h-0 md:overflow-hidden/);
  assert.match(pageSource, /data-ann-content/);
  assert.match(pageSource, /md:min-h-0 md:flex-1/);
  assert.match(pageSource, /md:flex-1 md:overflow-hidden/);
  assert.match(pageSource, /md:h-full md:min-h-0 md:grid-cols-\[3fr_1fr\]/);
  assert.match(mobileLayoutSource, /data-ann-layout-wrapper/);
  assert.match(mobileLayoutSource, /md:overflow-hidden/);
  assert.doesNotMatch(pageSource, /md:h-\[85vh\]/);
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
