import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ANNTrainingPerformancePanel from '../src/components/ANNTrainingPerformancePanel';

test('ANNTrainingPerformancePanel renders four enlarged charts with labeled axes and grids', () => {
  const html = renderToStaticMarkup(
    React.createElement(ANNTrainingPerformancePanel, {
      history: {
        loss: [{ x: 1, y: 0.8 }, { x: 2, y: 0.4 }],
        acc: [{ x: 1, y: 0.5 }, { x: 2, y: 0.85 }],
        valLoss: [{ x: 1, y: 0.9 }, { x: 2, y: 0.55 }],
        valAcc: [{ x: 1, y: 0.45 }, { x: 2, y: 0.75 }],
      },
      isTraining: false,
      currentEpoch: 2,
    })
  );

  assert.match(html, /Training Performance/);
  assert.match(html, /h-full min-h-0/);
  assert.equal((html.match(/data-ann-training-chart=/g) ?? []).length, 4);
  assert.equal((html.match(/aria-label="[^"]+ by epoch"/g) ?? []).length, 4);
  assert.equal((html.match(/>Epoch</g) ?? []).length, 4);
  assert.match(html, /Training Loss/);
  assert.match(html, /Validation Accuracy/);
  assert.match(html, /Latest 75\.0%/);
  assert.match(html, /<polyline/);
});

test('ANNTrainingPerformancePanel keeps the enlarged empty state before training', () => {
  const html = renderToStaticMarkup(
    React.createElement(ANNTrainingPerformancePanel, {
      history: { loss: [], acc: [], valLoss: [], valAcc: [] },
      isTraining: false,
      currentEpoch: 0,
    })
  );

  assert.match(html, /Waiting for a training run/);
  assert.match(html, /min-h-0 flex-1/);
  assert.match(html, /Train the network to see loss and accuracy history\./);
});
