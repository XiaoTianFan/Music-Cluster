'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowPathIcon,
    CubeIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';
import BasePanel from './ui/BasePanel';
import Network3DView from './Network3DView';
import type {
    ActivationSnapshot,
    AnnModelStateSnapshot,
    AnnTrainingPhaseSnapshot,
} from '../lib/annPipeline';
import {
    buildAnnNetworkGraph,
    getAnnNetworkIncidentConnections,
    normalizeAnnLayerName,
    type AnnNetworkGraph,
    type AnnNetworkGraphConnection,
    type AnnNetworkGraphNode,
} from '../lib/annNetworkGraph';

interface MLPConfig {
    hiddenLayers: number;
    nodesPerLayer: number[];
}

interface NetworkVisualizationPanelProps {
    className?: string;
    isVisible?: boolean;
    networkConfig: MLPConfig | null;
    inputDimension: number;
    outputDimension: number;
    labelNames: string[];
    activationSnapshot?: ActivationSnapshot | null;
    modelStateSnapshot?: AnnModelStateSnapshot | null;
    trainingPhaseSnapshot?: AnnTrainingPhaseSnapshot | null;
    isTraining?: boolean;
    isModelTrained?: boolean;
}

interface NetworkPoint {
    x: number;
    y: number;
    z: number;
}

interface NetworkLayout {
    width: number;
    height: number;
    nodePositions: Map<string, NetworkPoint>;
}

interface ViewTransform {
    x: number;
    y: number;
    scale: number;
}

interface Network2DViewProps {
    graph: AnnNetworkGraph;
    phase?: AnnTrainingPhaseSnapshot | null;
    activeNodeId: string | null;
    activeConnectionId: string | null;
    selectedNodeId: string | null;
    selectedConnectionId: string | null;
    onHoverNode: (nodeId: string | null) => void;
    onHoverConnection: (connectionId: string | null) => void;
    onSelectNode: (nodeId: string | null) => void;
    onSelectConnection: (connectionId: string | null) => void;
}

const layerColors = ['#22d3ee', '#4ade80', '#f59e0b', '#fb7185', '#c084fc'];
const defaultTransform: ViewTransform = { x: 0, y: 0, scale: 1 };

function getNodeTitle(node: AnnNetworkGraphNode): string {
    const activation = node.value === null ? '' : `: ${node.value.toFixed(4)}`;
    const bias = node.bias === null ? '' : ` | bias ${node.bias.toFixed(4)}`;
    return `${node.layerName} node ${node.nodeIndex + 1}${activation}${bias}`;
}

function getConnectionColor(connection: AnnNetworkGraphConnection): string {
    if (connection.weight === null) return '#64748b';
    return connection.weight >= 0 ? '#22d3ee' : '#fb7185';
}

function getConnectionWidth(connection: AnnNetworkGraphConnection, maxAbsoluteWeight: number): number {
    if (connection.weight === null || maxAbsoluteWeight <= 0) return 0.7;
    return 0.8 + (connection.magnitude / maxAbsoluteWeight) * 2.4;
}

function getConnectionLabel(connection: AnnNetworkGraphConnection): string {
    const weight = connection.weight === null ? 'uninitialized' : connection.weight.toFixed(4);
    return `${connection.sourceId} to ${connection.targetId}, weight ${weight}`;
}

function build2dLayout(graph: AnnNetworkGraph): NetworkLayout {
    const maxUnits = Math.max(1, ...graph.layers.map(layer => layer.units));
    const width = Math.max(960, 260 + Math.max(0, graph.layers.length - 1) * 300);
    const height = Math.max(620, 170 + Math.max(0, maxUnits - 1) * 28);
    const nodePositions = new Map<string, NetworkPoint>();
    graph.layers.forEach((layer, layerIndex) => {
        const x = graph.layers.length === 1
            ? width / 2
            : 130 + layerIndex * ((width - 260) / (graph.layers.length - 1));
        const availableHeight = height - 150;
        const gap = layer.units <= 1 ? 0 : Math.min(28, availableHeight / (layer.units - 1));
        const occupiedHeight = gap * Math.max(0, layer.units - 1);
        const startY = 100 + (availableHeight - occupiedHeight) / 2;
        layer.nodes.forEach(node => nodePositions.set(node.id, {
            x,
            y: startY + node.nodeIndex * gap,
            z: 0,
        }));
    });
    return { width, height, nodePositions };
}

function isPhaseConnection(
    connection: AnnNetworkGraphConnection,
    graph: AnnNetworkGraph,
    phase?: AnnTrainingPhaseSnapshot | null
): boolean {
    if (!phase?.activeLayerName) return false;
    const activeName = normalizeAnnLayerName(phase.activeLayerName);
    const sourceName = graph.layers[connection.sourceLayerIndex]?.name;
    const targetName = graph.layers[connection.targetLayerIndex]?.name;
    if (phase.direction === 'forward') return targetName === activeName;
    if (phase.direction === 'backward') return sourceName === activeName || targetName === activeName;
    return sourceName === activeName || targetName === activeName;
}

const Network2DView: React.FC<Network2DViewProps> = ({
    graph,
    phase,
    activeNodeId,
    activeConnectionId,
    selectedNodeId,
    selectedConnectionId,
    onHoverNode,
    onHoverConnection,
    onSelectNode,
    onSelectConnection,
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
    const [transform, setTransform] = useState<ViewTransform>(defaultTransform);
    const layout = useMemo(() => build2dLayout(graph), [graph]);
    const incidentIds = useMemo(() => new Set(
        getAnnNetworkIncidentConnections(graph, activeNodeId).map(connection => connection.id)
    ), [activeNodeId, graph]);
    const activeConnectionIds = useMemo(() => (
        activeConnectionId ? new Set([activeConnectionId]) : incidentIds
    ), [activeConnectionId, incidentIds]);
    const labelConnections = useMemo(() => (
        activeConnectionId
            ? graph.connections.filter(connection => connection.id === activeConnectionId)
            : activeNodeId
                ? getAnnNetworkIncidentConnections(graph, activeNodeId)
                : []
    ), [activeConnectionId, activeNodeId, graph]);

    const zoomAtCenter = useCallback((factor: number) => {
        setTransform(previous => ({ ...previous, scale: Math.max(0.2, Math.min(8, previous.scale * factor)) }));
    }, []);

    const handleWheel = useCallback((event: WheelEvent) => {
        const svg = svgRef.current;
        if (!svg) return;
        event.preventDefault();
        const bounds = svg.getBoundingClientRect();
        const pointerX = ((event.clientX - bounds.left) / bounds.width) * layout.width;
        const pointerY = ((event.clientY - bounds.top) / bounds.height) * layout.height;
        setTransform(previous => {
            const nextScale = Math.max(0.2, Math.min(8, previous.scale * Math.exp(-event.deltaY * 0.0015)));
            const ratio = nextScale / previous.scale;
            return {
                scale: nextScale,
                x: pointerX - (pointerX - previous.x) * ratio,
                y: pointerY - (pointerY - previous.y) * ratio,
            };
        });
    }, [layout.height, layout.width]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const renderNode = (node: AnnNetworkGraphNode) => {
        const position = layout.nodePositions.get(node.id);
        if (!position) return null;
        const isActive = activeNodeId === node.id;
        const isSelected = selectedNodeId === node.id;
        const activeLayerName = phase?.activeLayerName ? normalizeAnnLayerName(phase.activeLayerName) : null;
        const isPhaseActive = activeLayerName === node.layerName;
        const radius = isActive ? 10.5 : isPhaseActive ? 8.5 : 7;
        const color = layerColors[node.layerIndex % layerColors.length];
        return (
            <circle
                key={node.id}
                cx={position.x}
                cy={position.y}
                r={radius}
                fill={color}
                fillOpacity={0.28 + node.normalizedValue * 0.72}
                stroke={isActive ? '#ffffff' : isPhaseActive ? '#fbbf24' : color}
                strokeWidth={isActive ? 2.4 : isPhaseActive ? 1.8 : 1}
                data-ann-network-node={`${node.layerName}-${node.nodeIndex + 1}`}
                data-ann-network-node-active={node.value !== null ? 'true' : 'false'}
                data-ann-network-node-focused={isSelected ? 'true' : 'false'}
                {...({ title: getNodeTitle(node) } as Record<string, string>)}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={getNodeTitle(node)}
                onPointerDown={event => event.stopPropagation()}
                onPointerUp={event => event.stopPropagation()}
                onClick={event => {
                    event.stopPropagation();
                    onSelectNode(node.id);
                }}
                onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSelectNode(node.id);
                }}
                onMouseEnter={() => onHoverNode(node.id)}
                onMouseLeave={() => onHoverNode(null)}
                onFocus={() => onHoverNode(node.id)}
                onBlur={() => onHoverNode(null)}
                style={{ cursor: 'pointer' }}
            />
        );
    };

    return (
        <div
            className="relative h-full min-h-0 overflow-hidden bg-black/20"
            data-ann-network-view="2d"
            data-ann-network-focused-node={selectedNodeId ?? ''}
            data-ann-network-focused-connection={selectedConnectionId ?? ''}
        >
            <div className="absolute right-3 top-3 z-20 flex gap-1">
                <button type="button" className="network-tool-button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomAtCenter(1.25)}>
                    <MagnifyingGlassPlusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomAtCenter(0.8)}>
                    <MagnifyingGlassMinusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Reset view" aria-label="Reset view" onClick={() => setTransform(defaultTransform)}>
                    <ArrowPathIcon className="h-4 w-4" />
                </button>
            </div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="h-full min-h-0 w-full touch-none select-none"
                role="img"
                aria-label="Interactive two-dimensional neural network"
                onPointerDown={event => {
                    if (event.button !== 0) return;
                    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                    const drag = dragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const dx = (event.clientX - drag.x) * (layout.width / bounds.width);
                    const dy = (event.clientY - drag.y) * (layout.height / bounds.height);
                    dragRef.current = {
                        pointerId: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        moved: drag.moved || Math.abs(dx) + Math.abs(dy) > 2,
                    };
                    setTransform(previous => ({ ...previous, x: previous.x + dx, y: previous.y + dy }));
                }}
                onPointerUp={event => {
                    const moved = dragRef.current?.moved;
                    dragRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    if (!moved) {
                        onSelectNode(null);
                        onSelectConnection(null);
                    }
                }}
                onPointerCancel={() => { dragRef.current = null; }}
                onDoubleClick={() => setTransform(defaultTransform)}
            >
                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                    {graph.connections.map(connection => {
                        const source = layout.nodePositions.get(connection.sourceId);
                        const destination = layout.nodePositions.get(connection.targetId);
                        if (!source || !destination) return null;
                        const interactionActive = activeConnectionIds.has(connection.id);
                        const phaseActive = isPhaseConnection(connection, graph, phase);
                        return (
                            <React.Fragment key={connection.id}>
                                <line
                                    data-ann-network-connection={connection.id}
                                    data-ann-network-connection-active={interactionActive || phaseActive ? 'true' : 'false'}
                                    data-ann-network-connection-focused={selectedConnectionId === connection.id ? 'true' : 'false'}
                                    data-ann-network-flow={phaseActive && phase?.direction !== 'none' ? phase?.direction : undefined}
                                    x1={source.x}
                                    y1={source.y}
                                    x2={destination.x}
                                    y2={destination.y}
                                    stroke={getConnectionColor(connection)}
                                    strokeWidth={interactionActive ? getConnectionWidth(connection, graph.maxAbsoluteWeight) + 1.3 : getConnectionWidth(connection, graph.maxAbsoluteWeight)}
                                    strokeOpacity={interactionActive ? 0.98 : 0.1}
                                    vectorEffect="non-scaling-stroke"
                                    pointerEvents="none"
                                />
                                {phaseActive && (phase?.direction === 'forward' || phase?.direction === 'backward') && (
                                    <line
                                        className={`network-phase-segment network-phase-segment-${phase.direction}`}
                                        data-ann-network-phase-segment={connection.id}
                                        data-ann-network-flow={phase.direction}
                                        x1={source.x}
                                        y1={source.y}
                                        x2={destination.x}
                                        y2={destination.y}
                                        pathLength="100"
                                        stroke={getConnectionColor(connection)}
                                        strokeWidth={getConnectionWidth(connection, graph.maxAbsoluteWeight) + 1.5}
                                        strokeOpacity="0.96"
                                        strokeDasharray="26 100"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                        pointerEvents="none"
                                    />
                                )}
                                <line
                                    x1={source.x}
                                    y1={source.y}
                                    x2={destination.x}
                                    y2={destination.y}
                                    stroke="transparent"
                                    strokeWidth="14"
                                    vectorEffect="non-scaling-stroke"
                                    pointerEvents="stroke"
                                    tabIndex={0}
                                    role="button"
                                    aria-pressed={selectedConnectionId === connection.id}
                                    aria-label={getConnectionLabel(connection)}
                                    data-ann-network-connection-hit={connection.id}
                                    onPointerDown={event => event.stopPropagation()}
                                    onPointerUp={event => event.stopPropagation()}
                                    onClick={event => {
                                        event.stopPropagation();
                                        onSelectConnection(connection.id);
                                    }}
                                    onKeyDown={event => {
                                        if (event.key !== 'Enter' && event.key !== ' ') return;
                                        event.preventDefault();
                                        onSelectConnection(connection.id);
                                    }}
                                    onMouseEnter={() => onHoverConnection(connection.id)}
                                    onMouseLeave={() => onHoverConnection(null)}
                                    onFocus={() => onHoverConnection(connection.id)}
                                    onBlur={() => onHoverConnection(null)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </React.Fragment>
                        );
                    })}
                    {labelConnections.map(connection => {
                        const source = layout.nodePositions.get(connection.sourceId);
                        const destination = layout.nodePositions.get(connection.targetId);
                        if (!source || !destination) return null;
                        return (
                            <text
                                key={`weight-${connection.id}`}
                                data-ann-network-weight-label={connection.id}
                                x={source.x * 0.54 + destination.x * 0.46}
                                y={source.y * 0.54 + destination.y * 0.46 - 3}
                                fill={getConnectionColor(connection)}
                                stroke="#020617"
                                strokeWidth="3"
                                paintOrder="stroke"
                                fontSize="10"
                                textAnchor="middle"
                                vectorEffect="non-scaling-stroke"
                                pointerEvents="none"
                            >
                                {connection.weight === null ? 'uninitialized' : connection.weight.toFixed(4)}
                            </text>
                        );
                    })}
                    {graph.layers.map(layer => {
                        const layerX = layout.nodePositions.get(layer.nodes[0]?.id)?.x ?? 0;
                        return (
                            <g key={layer.id} data-ann-network-layer={layer.name} data-ann-network-layer-active={layer.activationMean !== null ? 'true' : 'false'} pointerEvents="none">
                                <text x={layerX} y="30" textAnchor="middle" fill="var(--accent-primary)" fontSize="17" fontWeight="700">{layer.name}</text>
                                <text x={layerX} y="51" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">
                                    {layer.units} units{layer.activationMean === null ? '' : ` | mean ${layer.activationMean.toFixed(3)}`}
                                </text>
                            </g>
                        );
                    })}
                    {graph.nodes.filter(node => node.layerName === 'Output').map(node => {
                        const position = layout.nodePositions.get(node.id);
                        return position ? (
                            <text key={`label-${node.id}`} x={position.x + 14} y={position.y + 4} fill="var(--text-primary)" fontSize="11" data-ann-network-output-label={node.label} pointerEvents="none">
                                {node.label}
                            </text>
                        ) : null;
                    })}
                    {graph.nodes.map(renderNode)}
                </g>
            </svg>
        </div>
    );
};

const NetworkVisualizationPanel: React.FC<NetworkVisualizationPanelProps> = ({
    className,
    networkConfig,
    inputDimension,
    outputDimension,
    labelNames,
    activationSnapshot,
    modelStateSnapshot,
    trainingPhaseSnapshot,
    isTraining = false,
    isModelTrained = false,
    isVisible = true,
}) => {
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const graph = useMemo(() => buildAnnNetworkGraph({
        networkConfig,
        inputDimension,
        outputDimension,
        labelNames,
        activationSnapshot,
        modelStateSnapshot,
    }), [activationSnapshot, inputDimension, labelNames, modelStateSnapshot, networkConfig, outputDimension]);

    useEffect(() => {
        if (selectedNodeId && !graph.nodes.some(node => node.id === selectedNodeId)) setSelectedNodeId(null);
        if (selectedConnectionId && !graph.connections.some(connection => connection.id === selectedConnectionId)) setSelectedConnectionId(null);
    }, [graph, selectedConnectionId, selectedNodeId]);

    const activeConnectionId = hoveredConnectionId ?? (hoveredNodeId ? null : selectedConnectionId);
    const activeNodeId = hoveredConnectionId
        ? null
        : hoveredNodeId ?? (selectedConnectionId ? null : selectedNodeId);
    const activeNode = activeNodeId ? graph.nodes.find(node => node.id === activeNodeId) ?? null : null;
    const activeConnection = activeConnectionId
        ? graph.connections.find(connection => connection.id === activeConnectionId) ?? null
        : null;
    const statusText = graph.layers.length === 0
        ? 'Configure labels, extract features, and prepare data to visualize the network.'
        : trainingPhaseSnapshot
            ? `${trainingPhaseSnapshot.label} | epoch ${trainingPhaseSnapshot.epoch} of ${trainingPhaseSnapshot.targetEpochs}`
            : isTraining
                ? `Training${activationSnapshot?.epoch ? `, epoch ${activationSnapshot.epoch}` : ''}`
                : isModelTrained
                    ? 'Trained model'
                    : 'Waiting for training activations';

    const handleSelectNode = useCallback((nodeId: string | null) => {
        setSelectedConnectionId(null);
        setSelectedNodeId(nodeId);
    }, []);
    const handleSelectConnection = useCallback((connectionId: string | null) => {
        setSelectedNodeId(null);
        setSelectedConnectionId(connectionId);
    }, []);

    const visiblePhase = isVisible ? trainingPhaseSnapshot : null;
    const interactionProps = {
        graph,
        phase: visiblePhase,
        activeNodeId,
        activeConnectionId,
        selectedNodeId,
        selectedConnectionId,
        onHoverNode: setHoveredNodeId,
        onHoverConnection: setHoveredConnectionId,
        onSelectNode: handleSelectNode,
        onSelectConnection: handleSelectConnection,
    };

    return (
        <BasePanel className={`flex h-full min-h-0 flex-col ${className ?? ''}`} title="Model Inspection">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="ml-2 text-lg font-semibold text-[var(--accent-secondary)]">Model Inspection</h2>
                    <p className="ml-2 mt-1 text-xs text-[var(--text-secondary)]" data-ann-network-status>{statusText}</p>
                </div>
                <div className="flex border border-[var(--foreground)]/35 bg-black/25 p-0.5" role="group" aria-label="Network visualization mode">
                    <button type="button" className={`network-mode-button ${viewMode === '2d' ? 'network-mode-button-active' : ''}`} aria-pressed={viewMode === '2d'} onClick={() => setViewMode('2d')}>
                        <Squares2X2Icon className="h-4 w-4" />
                        <span>2D</span>
                    </button>
                    <button type="button" className={`network-mode-button ${viewMode === '3d' ? 'network-mode-button-active' : ''}`} aria-pressed={viewMode === '3d'} onClick={() => setViewMode('3d')}>
                        <CubeIcon className="h-4 w-4" />
                        <span>3D</span>
                    </button>
                </div>
            </div>
            {graph.layers.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm italic text-[var(--text-secondary)]">No network structure available yet.</div>
            ) : (
                <div className="relative min-h-0 flex-1 overflow-hidden border border-[var(--foreground)]/18">
                    <div className={`absolute inset-0 ${viewMode === '2d' ? 'visible' : 'invisible pointer-events-none'}`} aria-hidden={viewMode !== '2d'}>
                        <Network2DView {...interactionProps} phase={viewMode === '2d' ? visiblePhase : null} />
                    </div>
                    <div className={`absolute inset-0 ${viewMode === '3d' ? 'visible' : 'invisible pointer-events-none'}`} aria-hidden={viewMode !== '3d'}>
                        <Network3DView {...interactionProps} isVisible={isVisible && viewMode === '3d'} phase={viewMode === '3d' ? visiblePhase : null} />
                    </div>
                    <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[calc(100%-1rem)] bg-black/75 px-2 py-1 text-[10px] text-[var(--text-secondary)]" data-ann-network-inspection>
                        {activeNode
                            ? `${selectedNodeId === activeNode.id ? 'Focused: ' : ''}${activeNode.label}${activeNode.value === null ? '' : ` | activation ${activeNode.value.toFixed(4)}`}${activeNode.bias === null ? '' : ` | bias ${activeNode.bias.toFixed(4)}`}`
                            : activeConnection
                                ? `${selectedConnectionId === activeConnection.id ? 'Focused: ' : ''}${getConnectionLabel(activeConnection)}`
                                : `${graph.nodes.length} nodes | ${graph.connections.length} connections | select a node or connection to keep it focused`}
                    </div>
                </div>
            )}
            <style>{`
                .network-mode-button {
                    display: inline-flex;
                    height: 28px;
                    align-items: center;
                    gap: 5px;
                    padding: 0 9px;
                    color: var(--text-secondary);
                    font-size: 11px;
                }
                .network-mode-button:hover,
                .network-mode-button-active {
                    background: color-mix(in srgb, var(--accent-primary) 20%, transparent);
                    color: var(--accent-primary);
                }
                .network-tool-button {
                    display: inline-flex;
                    width: 28px;
                    height: 28px;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid color-mix(in srgb, var(--foreground) 45%, transparent);
                    background: rgba(2, 6, 23, 0.82);
                    color: var(--text-secondary);
                }
                .network-tool-button:hover {
                    border-color: var(--accent-primary);
                    color: var(--accent-primary);
                }
                .network-phase-segment {
                    animation-duration: 1.2s;
                    animation-iteration-count: infinite;
                    animation-timing-function: linear;
                }
                .network-phase-segment-forward {
                    animation-name: ann-connection-segment-forward;
                }
                .network-phase-segment-backward {
                    animation-name: ann-connection-segment-backward;
                }
                @keyframes ann-connection-segment-forward {
                    from { stroke-dashoffset: 26; }
                    to { stroke-dashoffset: -100; }
                }
                @keyframes ann-connection-segment-backward {
                    from { stroke-dashoffset: -100; }
                    to { stroke-dashoffset: 26; }
                }
                .network-3d-layer-label,
                .network-3d-weight-label {
                    position: absolute;
                    left: 0;
                    top: 0;
                    white-space: nowrap;
                    font-family: inherit;
                    text-shadow: 0 1px 3px #000, 0 0 4px #000;
                }
                .network-3d-layer-label {
                    z-index: 8;
                    color: var(--accent-primary);
                    font-size: 12px;
                    font-weight: 700;
                }
                .network-3d-weight-label {
                    z-index: 12;
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    background: rgba(2, 6, 23, 0.88);
                    padding: 1px 3px;
                    font-size: 9px;
                }
                @media (prefers-reduced-motion: reduce) {
                    .network-phase-segment { animation: none; stroke-dashoffset: -37; }
                }
            `}</style>
        </BasePanel>
    );
};

export default NetworkVisualizationPanel;
