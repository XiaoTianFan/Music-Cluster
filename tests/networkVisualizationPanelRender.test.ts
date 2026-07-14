import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NetworkVisualizationPanel from '../src/components/NetworkVisualizationPanel';
import type { ActivationSnapshot } from '../src/lib/annPipeline';

const activationSnapshot: ActivationSnapshot = {
  epoch: 3,
  songId: 'song-a',
  layers: [
    { name: 'Input', units: 1, values: [0.25], min: 0.25, max: 0.25, mean: 0.25 },
    { name: 'hidden_1', units: 16, values: [0.1, 0.2, 0.3, 0.4], min: 0.1, max: 0.4, mean: 0.25 },
    { name: 'output', units: 2, values: [0.8, 0.2], min: 0.2, max: 0.8, mean: 0.5 },
  ],
};

test('NetworkVisualizationPanel renders active layer hooks and node values after activation snapshots', () => {
  const html = renderToStaticMarkup(
    React.createElement(NetworkVisualizationPanel, {
      networkConfig: { hiddenLayers: 1, nodesPerLayer: [16] },
      inputDimension: 1,
      outputDimension: 2,
      labelNames: ['Rock', 'Jazz'],
      activationSnapshot,
      isModelTrained: true,
    })
  );

  assert.match(html, /Model Structure &amp; Internal State/);
  assert.match(html, /data-ann-network-status="true">Trained model/);
  assert.match(html, /data-ann-network-layer="Input"[^>]+data-ann-network-layer-active="true"/);
  assert.match(html, /data-ann-network-layer="Hidden 1"[^>]+data-ann-network-layer-active="true"/);
  assert.match(html, /data-ann-network-layer="Output"[^>]+data-ann-network-layer-active="true"/);
  assert.match(html, /1 units \| mean 0\.250/);
  assert.match(html, /16 units \| mean 0\.250/);
  assert.match(html, /2 units \| mean 0\.500/);
  assert.match(html, /data-ann-network-node="Input-1"[^>]+title="Input node 1: 0\.2500"/);
  assert.match(html, /data-ann-network-node="Hidden 1-4"[^>]+title="Hidden 1 node 4: 0\.4000"/);
  assert.match(html, /data-ann-network-node="Output-1"[^>]+title="Output node 1: 0\.8000"/);
  assert.match(html, /data-ann-network-output-label="Rock"/);
  assert.match(html, /data-ann-network-output-label="Jazz"/);
});

test('NetworkVisualizationPanel renders a configuration hint before a model is ready', () => {
  const html = renderToStaticMarkup(
    React.createElement(NetworkVisualizationPanel, {
      networkConfig: null,
      inputDimension: 0,
      outputDimension: 0,
      labelNames: [],
    })
  );

  assert.match(html, /Configure labels, extract features, and prepare data to visualize the network\./);
  assert.match(html, /No network structure available yet\./);
});
