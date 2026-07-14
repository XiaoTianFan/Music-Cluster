import React, { useMemo } from 'react';
import BasePanel from './ui/BasePanel';
import type { ActivationSnapshot } from '@/lib/annPipeline';

interface MLPConfig {
    hiddenLayers: number;
    nodesPerLayer: number[];
}

interface NetworkVisualizationPanelProps {
    className?: string;
    networkConfig: MLPConfig | null;
    inputDimension: number;
    outputDimension: number;
    labelNames: string[];
    activationSnapshot?: ActivationSnapshot | null;
    isTraining?: boolean;
    isModelTrained?: boolean;
}

const layerColors = ['#38bdf8', '#22c55e', '#f97316', '#f43f5e', '#a78bfa'];

const normalize = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return 0;
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

const NetworkVisualizationPanel: React.FC<NetworkVisualizationPanelProps> = ({
    className,
    networkConfig,
    inputDimension,
    outputDimension,
    labelNames,
    activationSnapshot,
    isTraining = false,
    isModelTrained = false,
}) => {
    const layers = useMemo(() => {
        if (!networkConfig || inputDimension <= 0 || outputDimension <= 0) return [];
        return [
            { name: 'Input', units: inputDimension },
            ...networkConfig.nodesPerLayer.slice(0, networkConfig.hiddenLayers).map((units, index) => ({
                name: `Hidden ${index + 1}`,
                units,
            })),
            { name: 'Output', units: outputDimension },
        ];
    }, [inputDimension, networkConfig, outputDimension]);

    const activationByName = useMemo(() => {
        const map = new Map<string, ActivationSnapshot['layers'][number]>();
        activationSnapshot?.layers.forEach(layer => {
            map.set(layer.name, layer);
            if (layer.name.startsWith('hidden_')) {
                const index = Number(layer.name.replace('hidden_', '')) - 1;
                map.set(`Hidden ${index + 1}`, layer);
            }
            if (layer.name === 'output') map.set('Output', layer);
        });
        return map;
    }, [activationSnapshot]);

    const statusText = !networkConfig || inputDimension <= 0 || outputDimension <= 0
        ? 'Configure labels, extract features, and prepare data to visualize the network.'
        : isTraining
            ? `Training${activationSnapshot?.epoch ? `, epoch ${activationSnapshot.epoch}` : ''}`
            : isModelTrained
                ? 'Trained model'
                : 'Waiting for training activations';

    return (
        <BasePanel className={className} title="Model Structure & Internal State">
            <h2 className="ml-2 mb-2 text-lg font-semibold text-[var(--accent-secondary)]">
                Model Structure &amp; Internal State
            </h2>
            <div className="min-h-[250px] h-full w-full p-3 pt-1">
                <p className="text-xs text-[var(--text-secondary)] mb-3" data-ann-network-status>
                    {statusText}
                </p>
                {layers.length === 0 ? (
                    <p className="text-center text-sm text-[var(--text-secondary)] italic p-4">
                        No network structure available yet.
                    </p>
                ) : (
                    <div className="flex gap-4 items-stretch overflow-x-auto pb-2">
                        {layers.map((layer, layerIndex) => {
                            const activation = activationByName.get(layer.name);
                            const displayCount = Math.min(layer.units, 28);
                            const values = activation?.values ?? [];
                            return (
                                <div
                                    key={`${layer.name}-${layerIndex}`}
                                    className="min-w-[120px] flex-1"
                                    data-ann-network-layer={layer.name}
                                    data-ann-network-layer-active={activation ? 'true' : 'false'}
                                >
                                    <div className="text-sm font-semibold text-[var(--accent-primary)] truncate" title={layer.name}>
                                        {layer.name}
                                    </div>
                                    <div className="text-[11px] text-[var(--text-secondary)] mb-2">
                                        {layer.units} units
                                        {activation ? ` | mean ${activation.mean.toFixed(3)}` : ''}
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {Array.from({ length: displayCount }).map((_, nodeIndex) => {
                                            const value = values[nodeIndex] ?? activation?.mean ?? 0;
                                            const intensity = activation ? normalize(value, activation.min, activation.max) : 0.15;
                                            const color = layerColors[layerIndex % layerColors.length];
                                            return (
                                                <div
                                                    key={nodeIndex}
                                                    className="h-4 border border-[var(--foreground)]/30"
                                                    data-ann-network-node={`${layer.name}-${nodeIndex + 1}`}
                                                    data-ann-network-node-active={activation ? 'true' : 'false'}
                                                    title={`${layer.name} node ${nodeIndex + 1}${activation ? `: ${value.toFixed(4)}` : ''}`}
                                                    style={{
                                                        backgroundColor: color,
                                                        opacity: 0.2 + intensity * 0.8,
                                                        boxShadow: activation ? `0 0 ${2 + intensity * 8}px ${color}` : 'none',
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                    {layer.units > displayCount && (
                                        <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                            Showing {displayCount} of {layer.units}
                                        </div>
                                    )}
                                    {layer.name === 'Output' && labelNames.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {labelNames.slice(0, 8).map(label => (
                                                <span
                                                    key={label}
                                                    className="border border-[var(--foreground)]/30 px-1 py-0.5 text-[10px] text-[var(--text-secondary)]"
                                                    data-ann-network-output-label={label}
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </BasePanel>
    );
};

export default NetworkVisualizationPanel;
