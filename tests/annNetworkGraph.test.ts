import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnNetworkGraph, getAnnNetworkIncidentConnections } from '../src/lib/annNetworkGraph';
import type { ActivationSnapshot, AnnModelStateSnapshot } from '../src/lib/annPipeline';

test('buildAnnNetworkGraph keeps every configured node and maps dense weights without truncation', () => {
  const activationSnapshot: ActivationSnapshot = {
    epoch: 2,
    layers: [
      { name: 'Input', units: 3, values: [0.1, 0.2, 0.3], min: 0.1, max: 0.3, mean: 0.2 },
      { name: 'hidden_1', units: 64, values: Array.from({ length: 64 }, (_, index) => index / 64), min: 0, max: 63 / 64, mean: 0.4921875 },
      { name: 'output', units: 2, values: [0.75, 0.25], min: 0.25, max: 0.75, mean: 0.5 },
    ],
  };
  const modelStateSnapshot: AnnModelStateSnapshot = {
    epoch: 2,
    layers: [
      {
        layerName: 'hidden_1', sourceLayerName: 'Input', inputUnits: 3, outputUnits: 64,
        weights: Array.from({ length: 3 }, (_, source) => Array.from({ length: 64 }, (_, target) => (source + target) / 100)),
        biases: Array(64).fill(0.01), min: 0, max: 0.65, meanAbsolute: 0.32,
      },
      {
        layerName: 'output', sourceLayerName: 'hidden_1', inputUnits: 64, outputUnits: 2,
        weights: Array.from({ length: 64 }, (_, source) => [source / 100, -source / 100]),
        biases: [0.2, -0.2], min: -0.63, max: 0.63, meanAbsolute: 0.315,
      },
    ],
  };

  const graph = buildAnnNetworkGraph({
    networkConfig: { hiddenLayers: 1, nodesPerLayer: [64] },
    inputDimension: 3,
    outputDimension: 2,
    labelNames: ['Rock', 'Jazz'],
    activationSnapshot,
    modelStateSnapshot,
  });

  assert.deepEqual(graph.layers.map(layer => layer.units), [3, 64, 2]);
  assert.equal(graph.nodes.length, 69);
  assert.equal(graph.connections.length, 3 * 64 + 64 * 2);
  assert.equal(graph.layers[1].nodes[63].value, 63 / 64);
  assert.equal(graph.layers[2].nodes[0].label, 'Rock');
  assert.equal(graph.layers[2].nodes[0].bias, 0.2);
  assert.equal(graph.connections.at(-1)?.weight, -0.63);
  assert.equal(getAnnNetworkIncidentConnections(graph, 'Hidden 1:10').length, 5);
});

test('buildAnnNetworkGraph exposes topology before model weights exist', () => {
  const graph = buildAnnNetworkGraph({
    networkConfig: { hiddenLayers: 2, nodesPerLayer: [4, 3] },
    inputDimension: 2,
    outputDimension: 2,
    labelNames: ['A', 'B'],
  });

  assert.equal(graph.nodes.length, 11);
  assert.equal(graph.connections.length, 2 * 4 + 4 * 3 + 3 * 2);
  assert.ok(graph.connections.every(connection => connection.weight === null));
});
