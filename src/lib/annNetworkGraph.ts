import type { ActivationSnapshot, AnnModelStateSnapshot } from './annPipeline';

export interface AnnNetworkConfigShape {
  hiddenLayers: number;
  nodesPerLayer: number[];
}

export interface AnnNetworkGraphNode {
  id: string;
  layerId: string;
  layerName: string;
  layerIndex: number;
  nodeIndex: number;
  label: string;
  value: number | null;
  normalizedValue: number;
  bias: number | null;
}

export interface AnnNetworkGraphLayer {
  id: string;
  name: string;
  index: number;
  units: number;
  activationMin: number | null;
  activationMax: number | null;
  activationMean: number | null;
  nodes: AnnNetworkGraphNode[];
}

export interface AnnNetworkGraphConnection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceLayerIndex: number;
  targetLayerIndex: number;
  sourceNodeIndex: number;
  targetNodeIndex: number;
  weight: number | null;
  magnitude: number;
}

export interface AnnNetworkGraph {
  layers: AnnNetworkGraphLayer[];
  nodes: AnnNetworkGraphNode[];
  connections: AnnNetworkGraphConnection[];
  maxAbsoluteWeight: number;
}

export function normalizeAnnLayerName(name: string): string {
  if (name === 'input' || name === 'Input') return 'Input';
  if (name === 'output' || name === 'Output') return 'Output';
  const hiddenMatch = name.match(/^hidden[_ -]?(\d+)$/i);
  if (hiddenMatch) return `Hidden ${hiddenMatch[1]}`;
  return name;
}

function normalizeActivation(value: number | null, min: number | null, max: number | null): number {
  if (value === null || min === null || max === null || !Number.isFinite(value)) return 0.15;
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function buildAnnNetworkGraph({
  networkConfig,
  inputDimension,
  outputDimension,
  labelNames,
  activationSnapshot,
  modelStateSnapshot,
}: {
  networkConfig: AnnNetworkConfigShape | null;
  inputDimension: number;
  outputDimension: number;
  labelNames: readonly string[];
  activationSnapshot?: ActivationSnapshot | null;
  modelStateSnapshot?: AnnModelStateSnapshot | null;
}): AnnNetworkGraph {
  if (!networkConfig || inputDimension <= 0 || outputDimension <= 0) {
    return { layers: [], nodes: [], connections: [], maxAbsoluteWeight: 0 };
  }

  const activationByName = new Map(
    (activationSnapshot?.layers ?? []).map(layer => [normalizeAnnLayerName(layer.name), layer])
  );
  const weightByTargetName = new Map(
    (modelStateSnapshot?.layers ?? []).map(layer => [normalizeAnnLayerName(layer.layerName), layer])
  );
  const layerShapes = [
    { id: 'Input', name: 'Input', units: inputDimension },
    ...networkConfig.nodesPerLayer.slice(0, networkConfig.hiddenLayers).map((units, index) => ({
      id: `Hidden ${index + 1}`,
      name: `Hidden ${index + 1}`,
      units,
    })),
    { id: 'Output', name: 'Output', units: outputDimension },
  ];

  const layers: AnnNetworkGraphLayer[] = layerShapes.map((shape, layerIndex) => {
    const activation = activationByName.get(shape.name);
    const targetWeights = weightByTargetName.get(shape.name);
    const nodes = Array.from({ length: shape.units }, (_, nodeIndex): AnnNetworkGraphNode => {
      const rawValue = activation?.values?.[nodeIndex];
      const value = Number.isFinite(rawValue) ? rawValue as number : null;
      const rawBias = targetWeights?.biases[nodeIndex];
      return {
        id: `${shape.id}:${nodeIndex}`,
        layerId: shape.id,
        layerName: shape.name,
        layerIndex,
        nodeIndex,
        label: shape.name === 'Output' ? labelNames[nodeIndex] ?? `Output ${nodeIndex + 1}` : `${shape.name} ${nodeIndex + 1}`,
        value,
        normalizedValue: normalizeActivation(
          value,
          activation?.min ?? null,
          activation?.max ?? null
        ),
        bias: Number.isFinite(rawBias) ? rawBias as number : null,
      };
    });
    return {
      id: shape.id,
      name: shape.name,
      index: layerIndex,
      units: shape.units,
      activationMin: activation?.min ?? null,
      activationMax: activation?.max ?? null,
      activationMean: activation?.mean ?? null,
      nodes,
    };
  });

  const connections: AnnNetworkGraphConnection[] = [];
  let maxAbsoluteWeight = 0;
  for (let targetLayerIndex = 1; targetLayerIndex < layers.length; targetLayerIndex++) {
    const sourceLayer = layers[targetLayerIndex - 1];
    const targetLayer = layers[targetLayerIndex];
    const targetWeights = weightByTargetName.get(targetLayer.name);
    for (let sourceNodeIndex = 0; sourceNodeIndex < sourceLayer.units; sourceNodeIndex++) {
      for (let targetNodeIndex = 0; targetNodeIndex < targetLayer.units; targetNodeIndex++) {
        const rawWeight = targetWeights?.weights[sourceNodeIndex]?.[targetNodeIndex];
        const weight = Number.isFinite(rawWeight) ? rawWeight ?? null : null;
        const magnitude = weight === null ? 0 : Math.abs(weight);
        maxAbsoluteWeight = Math.max(maxAbsoluteWeight, magnitude);
        connections.push({
          id: `${sourceLayer.id}:${sourceNodeIndex}->${targetLayer.id}:${targetNodeIndex}`,
          sourceId: sourceLayer.nodes[sourceNodeIndex].id,
          targetId: targetLayer.nodes[targetNodeIndex].id,
          sourceLayerIndex: targetLayerIndex - 1,
          targetLayerIndex,
          sourceNodeIndex,
          targetNodeIndex,
          weight,
          magnitude,
        });
      }
    }
  }

  return {
    layers,
    nodes: layers.flatMap(layer => layer.nodes),
    connections,
    maxAbsoluteWeight,
  };
}

export function getAnnNetworkIncidentConnections(
  graph: AnnNetworkGraph,
  nodeId: string | null
): AnnNetworkGraphConnection[] {
  if (!nodeId) return [];
  return graph.connections.filter(connection => connection.sourceId === nodeId || connection.targetId === nodeId);
}
