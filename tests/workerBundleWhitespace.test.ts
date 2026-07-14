import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const workerBundleDir = join(process.cwd(), 'public', 'workers');

test('generated worker bundles do not contain trailing whitespace', () => {
  const bundleFiles = readdirSync(workerBundleDir)
    .filter(fileName => fileName.endsWith('.bundled.js'))
    .sort();

  assert.ok(bundleFiles.length > 0, 'Expected generated worker bundles to exist.');

  const offenders: string[] = [];
  for (const fileName of bundleFiles) {
    const contents = readFileSync(join(workerBundleDir, fileName), 'utf8');
    contents.split(/\r?\n/).forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        offenders.push(`${fileName}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(offenders, []);
});
