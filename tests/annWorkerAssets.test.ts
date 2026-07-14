import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { annWorkerAssetPaths, annWorkerAssets } from '../src/lib/annWorkerAssets';

test('ann worker asset manifest points at generated public worker bundles', () => {
  assert.deepEqual(Object.keys(annWorkerAssets), ['essentia', 'dataProcessing', 'druid', 'mlp']);
  assert.equal(new Set(annWorkerAssetPaths).size, annWorkerAssetPaths.length);

  for (const assetPath of annWorkerAssetPaths) {
    assert.match(assetPath, /^\/workers\/[\w-]+\.bundled\.js$/);
    assert.equal(existsSync(join(process.cwd(), 'public', assetPath.slice(1))), true, `${assetPath} should exist in public/`);
  }
});
