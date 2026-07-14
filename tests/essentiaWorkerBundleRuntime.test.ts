import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerBundleHarness } from './helpers/workerBundleHarness';

test('generated Essentia worker bundle extracts full-signal energy after init', async () => {
  const worker = createWorkerBundleHarness('essentia-worker.bundled.js');

  await worker.send({
    type: 'init',
    requestId: 'bundle-essentia-init',
    payload: {},
  });

  const initReply = worker.messages.find(message => message.type === 'essentiaReady') as any;
  assert.ok(initReply, 'Expected generated Essentia worker bundle to report initialization status.');
  assert.equal(initReply.payload, true);
  assert.equal(worker.messages.some(message => message.type === 'workerError'), false);

  const extractStartIndex = worker.messages.length;
  await worker.send({
    type: 'extractFeatures',
    requestId: 'bundle-essentia-extract',
    payload: {
      songId: 'song-a',
      audioVector: [0, 0.25, -0.25, 0.5, -0.5, 0.1, -0.1, 0],
      sampleRate: 44100,
      featuresToExtract: ['energy'],
    },
  });

  const scopedReplies = worker.messages
    .slice(extractStartIndex)
    .filter(message => message.requestId === 'bundle-essentia-extract') as any[];
  assert.ok(scopedReplies.length > 0, 'Expected extraction request to produce a request-scoped reply.');

  const finalReply = scopedReplies.at(-1);
  assert.ok(finalReply);
  assert.equal(finalReply.songId, 'song-a');
  assert.equal(finalReply.type, 'featureExtractionComplete');
  assert.equal(typeof finalReply.features.energy, 'number');
  assert.ok(Number.isFinite(finalReply.features.energy));
  assert.ok(finalReply.features.energy > 0);
});
