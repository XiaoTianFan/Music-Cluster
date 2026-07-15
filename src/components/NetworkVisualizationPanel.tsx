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

const Network2DView: React.FC<{
    graph: AnnNetworkGraph;
    phase?: AnnTrainingPhaseSnapshot | null;
    hoveredNodeId: string | null;
    onHoverNode: (nodeId: string | null) => void;
}> = ({ graph, phase, hoveredNodeId, onHoverNode }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const [transform, setTransform] = useState<ViewTransform>(defaultTransform);
    const layout = useMemo(() => build2dLayout(graph), [graph]);
    const incidentIds = useMemo(() => new Set(
        getAnnNetworkIncidentConnections(graph, hoveredNodeId).map(connection => connection.id)
    ), [graph, hoveredNodeId]);

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

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const dx = (event.clientX - drag.x) * (layout.width / bounds.width);
        const dy = (event.clientY - drag.y) * (layout.height / bounds.height);
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        setTransform(previous => ({ ...previous, x: previous.x + dx, y: previous.y + dy }));
    };

    const weightLabels = hoveredNodeId ? getAnnNetworkIncidentConnections(graph, hoveredNodeId) : [];

    return (
        <div className="relative h-full min-h-0 overflow-hidden bg-black/20" data-ann-network-view="2d">
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
                    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={event => {
                    dragRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => { dragRef.current = null; }}
                onDoubleClick={() => setTransform(defaultTransform)}
            >
                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                    {graph.connections.map(connection => {
                        const source = layout.nodePositions.get(connection.sourceId);
                        const target = layout.nodePositions.get(connection.targetId);
                        if (!source || !target) return null;
                        const isHovered = incidentIds.has(connection.id);
                        const isPhaseActive = !hoveredNodeId && isPhaseConnection(connection, graph, phase);
                        return (
                            <line
                                key={connection.id}
                                data-ann-network-connection={connection.id}
                                data-ann-network-connection-active={isHovered || isPhaseActive ? 'true' : 'false'}
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke={getConnectionColor(connection)}
                                strokeWidth={isHovered || isPhaseActive ? getConnectionWidth(connection, graph.maxAbsoluteWeight) + 1.3 : getConnectionWidth(connection, graph.maxAbsoluteWeight)}
                                strokeOpacity={isHovered ? 0.95 : isPhaseActive ? 0.72 : 0.11}
                                vectorEffect="non-scaling-stroke"
                            />
                        );
                    })}
                    {weightLabels.map(connection => {
                        const source = layout.nodePositions.get(connection.sourceId);
                        const target = layout.nodePositions.get(connection.targetId);
                        if (!source || !target) return null;
                        return (
                            <text
                                key={`weight-${connection.id}`}
                                data-ann-network-weight-label={connection.id}
                                x={(source.x + target.x) / 2}
                                y={(source.y + target.y) / 2 - 3}
                                fill={getConnectionColor(connection)}
                                stroke="#020617"
                                strokeWidth="3"
                                paintOrder="stroke"
                                fontSize="10"
                                textAnchor="middle"
                                vectorEffect="non-scaling-stroke"
                            >
                                {connection.weight === null ? 'uninitialized' : connection.weight.toFixed(4)}
                            </text>
                        );
                    })}
                    {graph.layers.map((layer, layerIndex) => {
                        const layerX = layout.nodePositions.get(layer.nodes[0]?.id)?.x ?? 0;
                        const activeLayerName = phase?.activeLayerName ? normalizeAnnLayerName(phase.activeLayerName) : null;
                        return (
                            <g
                                key={layer.id}
                                data-ann-network-layer={layer.name}
                                data-ann-network-layer-active={layer.activationMean !== null ? 'true' : 'false'}
                            >
                                <text x={layerX} y="30" textAnchor="middle" fill="var(--accent-primary)" fontSize="17" fontWeight="700">
                                    {layer.name}
                                </text>
                                <text x={layerX} y="51" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">
                                    {layer.units} units{layer.activationMean === null ? '' : ` | mean ${layer.activationMean.toFixed(3)}`}
                                </text>
                                {layer.nodes.map(node => {
                                    const position = layout.nodePositions.get(node.id);
                                    if (!position) return null;
                                    const isHovered = hoveredNodeId === node.id;
                                    const isPhaseActive = activeLayerName === node.layerName;
                                    const radius = isHovered ? 10 : isPhaseActive ? 8.5 : 7;
                                    return (
                                        <g key={node.id}>
                                            <circle
                                                cx={position.x}
                                                cy={position.y}
                                                r={radius}
                                                fill={layerColors[layerIndex % layerColors.length]}
                                                fillOpacity={0.28 + node.normalizedValue * 0.72}
                                                stroke={isHovered ? '#ffffff' : isPhaseActive ? '#fbbf24' : layerColors[layerIndex % layerColors.length]}
                                                strokeWidth={isHovered ? 2.2 : isPhaseActive ? 1.8 : 1}
                                                data-ann-network-node={`${node.layerName}-${node.nodeIndex + 1}`}
                                                data-ann-network-node-active={node.value !== null ? 'true' : 'false'}
                                                {...({ title: getNodeTitle(node) } as Record<string, string>)}
                                                tabIndex={0}
                                                role="button"
                                                aria-label={getNodeTitle(node)}
                                                onMouseEnter={() => onHoverNode(node.id)}
                                                onMouseLeave={() => onHoverNode(null)}
                                                onFocus={() => onHoverNode(node.id)}
                                                onBlur={() => onHoverNode(null)}
                                            />
                                            {layer.name === 'Output' && (
                                                <text
                                                    x={position.x + 14}
                                                    y={position.y + 4}
                                                    fill="var(--text-primary)"
                                                    fontSize="11"
                                                    data-ann-network-output-label={node.label}
                                                >
                                                    {node.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

function build3dPositions(graph: AnnNetworkGraph): Map<string, NetworkPoint> {
    const positions = new Map<string, NetworkPoint>();
    graph.layers.forEach((layer, layerIndex) => {
        const columns = Math.max(1, Math.ceil(Math.sqrt(layer.units)));
        const rows = Math.max(1, Math.ceil(layer.units / columns));
        layer.nodes.forEach(node => {
            const row = Math.floor(node.nodeIndex / columns);
            const column = node.nodeIndex % columns;
            positions.set(node.id, {
                x: (layerIndex - (graph.layers.length - 1) / 2) * 220,
                y: ((rows - 1) / 2 - row) * 28,
                z: (column - (columns - 1) / 2) * 28,
            });
        });
    });
    return positions;
}

const Network3DView: React.FC<{
    graph: AnnNetworkGraph;
    phase?: AnnTrainingPhaseSnapshot | null;
    onHoverNode: (nodeId: string | null) => void;
}> = ({ graph, phase, onHoverNode }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasHostRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [resetVersion, setResetVersion] = useState(0);
    const [zoomCommand, setZoomCommand] = useState<{ id: number; factor: number } | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        setRenderError(null);

        void import('three').then(THREE => {
            if (disposed || !containerRef.current || !canvasHostRef.current || !overlayRef.current) return;
            const container = containerRef.current;
            const canvasHost = canvasHostRef.current;
            const overlay = overlayRef.current;
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setClearColor(0x020617, 0.18);
            renderer.domElement.setAttribute('data-ann-network-canvas', 'true');
            renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional neural network');
            canvasHost.replaceChildren(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(48, 1, 1, 10000);
            const group = new THREE.Group();
            scene.add(group);
            const positions = build3dPositions(graph);
            const maxSpan = Math.max(
                300,
                (graph.layers.length - 1) * 220,
                ...graph.layers.map(layer => Math.ceil(Math.sqrt(layer.units)) * 28)
            );
            const target = new THREE.Vector3(0, 0, 0);
            let yaw = 0.72;
            let pitch = 0.28;
            const baseDistance = maxSpan * 1.7;
            let distance = baseDistance;
            let lastAspect: number | null = null;
            let hoveredNodeId: string | null = null;
            let pointerDrag: { id: number; x: number; y: number; mode: 'rotate' | 'pan'; moved: boolean } | null = null;

            const nodeMeshes: any[] = [];
            const nodeById = new Map<string, any>();
            graph.nodes.forEach(node => {
                const position = positions.get(node.id);
                if (!position) return;
                const color = layerColors[node.layerIndex % layerColors.length];
                const geometry = new THREE.SphereGeometry(7, 16, 12);
                const material = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.36 + node.normalizedValue * 0.64,
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(position.x, position.y, position.z);
                mesh.userData.nodeId = node.id;
                mesh.userData.baseOpacity = 0.36 + node.normalizedValue * 0.64;
                group.add(mesh);
                nodeMeshes.push(mesh);
                nodeById.set(node.id, mesh);
            });

            const lineGroups: any[] = [];
            const addLineGroup = (connections: AnnNetworkGraphConnection[], color: number, opacity: number) => {
                if (connections.length === 0) return null;
                const vertices: number[] = [];
                connections.forEach(connection => {
                    const source = positions.get(connection.sourceId);
                    const targetPosition = positions.get(connection.targetId);
                    if (!source || !targetPosition) return;
                    vertices.push(source.x, source.y, source.z, targetPosition.x, targetPosition.y, targetPosition.z);
                });
                const geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
                const lines = new THREE.LineSegments(geometry, material);
                group.add(lines);
                lineGroups.push(lines);
                return lines;
            };
            addLineGroup(graph.connections.filter(connection => connection.weight === null), 0x64748b, 0.12);
            addLineGroup(graph.connections.filter(connection => (connection.weight ?? 0) >= 0 && connection.weight !== null), 0x22d3ee, 0.12);
            addLineGroup(graph.connections.filter(connection => (connection.weight ?? 0) < 0), 0xfb7185, 0.12);
            let highlightGroups: any[] = [];
            const clearHighlights = () => {
                highlightGroups.forEach(lines => {
                    group.remove(lines);
                    lines.geometry.dispose();
                    lines.material.dispose();
                });
                highlightGroups = [];
            };

            const layerLabels = graph.layers.map(layer => {
                const element = document.createElement('div');
                element.className = 'network-3d-layer-label';
                element.textContent = `${layer.name} | ${layer.units}`;
                overlay.appendChild(element);
                const x = (layer.index - (graph.layers.length - 1) / 2) * 220;
                const maxRows = Math.ceil(layer.units / Math.max(1, Math.ceil(Math.sqrt(layer.units))));
                return { element, position: new THREE.Vector3(x, maxRows * 15 + 34, 0) };
            });
            let weightLabels: Array<{ element: HTMLDivElement; position: any }> = [];

            const rebuildHighlights = (nodeId: string | null) => {
                clearHighlights();
                weightLabels.forEach(label => label.element.remove());
                weightLabels = [];
                const activeConnections = nodeId
                    ? getAnnNetworkIncidentConnections(graph, nodeId)
                    : graph.connections.filter(connection => isPhaseConnection(connection, graph, phase));
                const positive = activeConnections.filter(connection => (connection.weight ?? 0) >= 0);
                const negative = activeConnections.filter(connection => (connection.weight ?? 0) < 0);
                const positiveLines = addLineGroup(positive, 0x67e8f9, 0.95);
                const negativeLines = addLineGroup(negative, 0xfda4af, 0.95);
                highlightGroups = [positiveLines, negativeLines].filter(Boolean);
                nodeMeshes.forEach(mesh => {
                    const id = mesh.userData.nodeId as string;
                    const connected = nodeId && activeConnections.some(connection => connection.sourceId === id || connection.targetId === id);
                    const activeLayer = phase?.activeLayerName && normalizeAnnLayerName(phase.activeLayerName) === graph.nodes.find(node => node.id === id)?.layerName;
                    mesh.scale.setScalar(id === nodeId ? 1.55 : connected || activeLayer ? 1.22 : 1);
                    mesh.material.opacity = nodeId && !connected && id !== nodeId ? 0.26 : mesh.userData.baseOpacity;
                });
                if (nodeId) {
                    activeConnections.forEach(connection => {
                        const source = positions.get(connection.sourceId);
                        const targetPosition = positions.get(connection.targetId);
                        if (!source || !targetPosition) return;
                        const element = document.createElement('div');
                        element.className = 'network-3d-weight-label';
                        element.dataset.annNetworkWeightLabel = connection.id;
                        element.textContent = connection.weight === null ? 'uninitialized' : connection.weight.toFixed(4);
                        element.style.color = getConnectionColor(connection);
                        overlay.appendChild(element);
                        weightLabels.push({
                            element,
                            position: new THREE.Vector3(
                                (source.x + targetPosition.x) / 2,
                                (source.y + targetPosition.y) / 2,
                                (source.z + targetPosition.z) / 2
                            ),
                        });
                    });
                }
            };

            const updateCamera = () => {
                const cosPitch = Math.cos(pitch);
                camera.position.set(
                    target.x + distance * cosPitch * Math.sin(yaw),
                    target.y + distance * Math.sin(pitch),
                    target.z + distance * cosPitch * Math.cos(yaw)
                );
                camera.lookAt(target);
            };
            const projectElement = (element: HTMLElement, position: any, bounds: DOMRect) => {
                const projected = position.clone().project(camera);
                const visible = projected.z > -1 && projected.z < 1;
                element.style.display = visible ? 'block' : 'none';
                element.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * bounds.width}px, ${((-projected.y + 1) / 2) * bounds.height}px)`;
            };
            const render = () => {
                const bounds = container.getBoundingClientRect();
                layerLabels.forEach(label => projectElement(label.element, label.position, bounds));
                weightLabels.forEach(label => projectElement(label.element, label.position, bounds));
                renderer.render(scene, camera);
            };
            const resize = () => {
                const width = Math.max(1, container.clientWidth);
                const height = Math.max(1, container.clientHeight);
                renderer.setSize(width, height, false);
                const nextAspect = width / height;
                camera.aspect = nextAspect;
                camera.updateProjectionMatrix();
                if (lastAspect === null || Math.abs(nextAspect - lastAspect) > 0.1) {
                    distance = baseDistance * Math.max(1, 0.9 / nextAspect);
                    updateCamera();
                    lastAspect = nextAspect;
                }
                render();
            };
            updateCamera();
            rebuildHighlights(null);
            resize();
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(container);

            const raycaster = new THREE.Raycaster();
            const pointer = new THREE.Vector2();
            const setHoveredNode = (nodeId: string | null) => {
                if (hoveredNodeId === nodeId) return;
                hoveredNodeId = nodeId;
                renderer.domElement.style.cursor = nodeId ? 'pointer' : 'grab';
                rebuildHighlights(nodeId);
                onHoverNode(nodeId);
                render();
            };
            const updateHover = (event: PointerEvent) => {
                const bounds = renderer.domElement.getBoundingClientRect();
                pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
                pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
                raycaster.setFromCamera(pointer, camera);
                const hit = raycaster.intersectObjects(nodeMeshes)[0];
                setHoveredNode(hit?.object?.userData?.nodeId ?? null);
            };
            const handlePointerDown = (event: PointerEvent) => {
                pointerDrag = {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    mode: event.button === 2 || event.shiftKey ? 'pan' : 'rotate',
                    moved: false,
                };
                renderer.domElement.setPointerCapture(event.pointerId);
                renderer.domElement.style.cursor = 'grabbing';
            };
            const handlePointerMove = (event: PointerEvent) => {
                if (!pointerDrag || pointerDrag.id !== event.pointerId) {
                    updateHover(event);
                    return;
                }
                const dx = event.clientX - pointerDrag.x;
                const dy = event.clientY - pointerDrag.y;
                pointerDrag.x = event.clientX;
                pointerDrag.y = event.clientY;
                pointerDrag.moved ||= Math.abs(dx) + Math.abs(dy) > 2;
                if (pointerDrag.mode === 'rotate') {
                    yaw -= dx * 0.008;
                    pitch = Math.max(-1.25, Math.min(1.25, pitch + dy * 0.008));
                } else {
                    const scale = distance / Math.max(300, container.clientHeight);
                    target.x -= dx * scale;
                    target.y += dy * scale;
                }
                updateCamera();
                render();
            };
            const handlePointerUp = (event: PointerEvent) => {
                const moved = pointerDrag?.moved;
                pointerDrag = null;
                renderer.domElement.releasePointerCapture(event.pointerId);
                renderer.domElement.style.cursor = hoveredNodeId ? 'pointer' : 'grab';
                if (!moved) updateHover(event);
            };
            const handleWheel = (event: WheelEvent) => {
                event.preventDefault();
                distance = Math.max(100, Math.min(maxSpan * 8, distance * Math.exp(event.deltaY * 0.0015)));
                updateCamera();
                render();
            };
            const handleContextMenu = (event: MouseEvent) => event.preventDefault();
            renderer.domElement.addEventListener('pointerdown', handlePointerDown);
            renderer.domElement.addEventListener('pointermove', handlePointerMove);
            renderer.domElement.addEventListener('pointerup', handlePointerUp);
            renderer.domElement.addEventListener('pointercancel', handlePointerUp);
            renderer.domElement.addEventListener('pointerleave', (event: PointerEvent) => {
                if (!pointerDrag) setHoveredNode(null);
                if (pointerDrag && pointerDrag.id === event.pointerId) handlePointerUp(event);
            });
            renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
            renderer.domElement.addEventListener('contextmenu', handleContextMenu);

            const handleZoomCommand = (event: Event) => {
                const detail = (event as CustomEvent<number>).detail;
                distance = Math.max(100, Math.min(maxSpan * 8, distance * detail));
                updateCamera();
                render();
            };
            container.addEventListener('ann-network-zoom', handleZoomCommand);

            cleanup = () => {
                resizeObserver.disconnect();
                container.removeEventListener('ann-network-zoom', handleZoomCommand);
                onHoverNode(null);
                clearHighlights();
                layerLabels.forEach(label => label.element.remove());
                weightLabels.forEach(label => label.element.remove());
                scene.traverse((object: any) => {
                    object.geometry?.dispose?.();
                    if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.());
                    else object.material?.dispose?.();
                });
                renderer.dispose();
                renderer.forceContextLoss?.();
                renderer.domElement.remove();
            };
        }).catch(error => {
            if (!disposed) setRenderError(error instanceof Error ? error.message : String(error));
        });

        return () => {
            disposed = true;
            cleanup();
        };
    }, [graph, onHoverNode, phase, resetVersion]);

    useEffect(() => {
        if (!zoomCommand || !containerRef.current) return;
        containerRef.current.dispatchEvent(new CustomEvent('ann-network-zoom', { detail: zoomCommand.factor }));
    }, [zoomCommand]);

    return (
        <div ref={containerRef} className="relative h-full min-h-0 overflow-hidden bg-black/25" data-ann-network-view="3d">
            <div ref={canvasHostRef} className="absolute inset-0" />
            <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
            <div className="absolute right-3 top-3 z-20 flex gap-1">
                <button type="button" className="network-tool-button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoomCommand(command => ({ id: (command?.id ?? 0) + 1, factor: 0.8 }))}>
                    <MagnifyingGlassPlusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoomCommand(command => ({ id: (command?.id ?? 0) + 1, factor: 1.25 }))}>
                    <MagnifyingGlassMinusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Reset view" aria-label="Reset view" onClick={() => setResetVersion(version => version + 1)}>
                    <ArrowPathIcon className="h-4 w-4" />
                </button>
            </div>
            {renderError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-red-300">
                    3D renderer unavailable: {renderError}
                </div>
            )}
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
}) => {
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const graph = useMemo(() => buildAnnNetworkGraph({
        networkConfig,
        inputDimension,
        outputDimension,
        labelNames,
        activationSnapshot,
        modelStateSnapshot,
    }), [activationSnapshot, inputDimension, labelNames, modelStateSnapshot, networkConfig, outputDimension]);
    const hoveredNode = hoveredNodeId ? graph.nodes.find(node => node.id === hoveredNodeId) ?? null : null;
    const statusText = graph.layers.length === 0
        ? 'Configure labels, extract features, and prepare data to visualize the network.'
        : trainingPhaseSnapshot
            ? `${trainingPhaseSnapshot.label} | epoch ${trainingPhaseSnapshot.epoch} of ${trainingPhaseSnapshot.targetEpochs}`
            : isTraining
                ? `Training${activationSnapshot?.epoch ? `, epoch ${activationSnapshot.epoch}` : ''}`
                : isModelTrained
                    ? 'Trained model'
                    : 'Waiting for training activations';
    const handleHoverNode = useCallback((nodeId: string | null) => setHoveredNodeId(nodeId), []);

    return (
        <BasePanel className={`min-h-[780px] ${className ?? ''}`} title="Model Structure & Internal State">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="ml-2 text-lg font-semibold text-[var(--accent-secondary)]">Model Structure &amp; Internal State</h2>
                    <p className="ml-2 mt-1 text-xs text-[var(--text-secondary)]" data-ann-network-status>
                        {statusText}
                    </p>
                </div>
                <div className="flex border border-[var(--foreground)]/35 bg-black/25 p-0.5" role="group" aria-label="Network visualization mode">
                    <button
                        type="button"
                        className={`network-mode-button ${viewMode === '2d' ? 'network-mode-button-active' : ''}`}
                        aria-pressed={viewMode === '2d'}
                        onClick={() => setViewMode('2d')}
                    >
                        <Squares2X2Icon className="h-4 w-4" />
                        <span>2D</span>
                    </button>
                    <button
                        type="button"
                        className={`network-mode-button ${viewMode === '3d' ? 'network-mode-button-active' : ''}`}
                        aria-pressed={viewMode === '3d'}
                        onClick={() => setViewMode('3d')}
                    >
                        <CubeIcon className="h-4 w-4" />
                        <span>3D</span>
                    </button>
                </div>
            </div>
            {graph.layers.length === 0 ? (
                <div className="flex h-[680px] items-center justify-center p-4 text-center text-sm italic text-[var(--text-secondary)]">
                    No network structure available yet.
                </div>
            ) : (
                <div className="relative h-[680px] overflow-hidden border border-[var(--foreground)]/18">
                    {viewMode === '2d' ? (
                        <Network2DView graph={graph} phase={trainingPhaseSnapshot} hoveredNodeId={hoveredNodeId} onHoverNode={handleHoverNode} />
                    ) : (
                        <Network3DView graph={graph} phase={trainingPhaseSnapshot} onHoverNode={handleHoverNode} />
                    )}
                    <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[calc(100%-1rem)] bg-black/75 px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                        {hoveredNode
                            ? `${hoveredNode.label}${hoveredNode.value === null ? '' : ` | activation ${hoveredNode.value.toFixed(4)}`}${hoveredNode.bias === null ? '' : ` | bias ${hoveredNode.bias.toFixed(4)}`}`
                            : `${graph.nodes.length} nodes | ${graph.connections.length} connections | drag to navigate, wheel to zoom`}
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
                    color: var(--accent-primary);
                    font-size: 12px;
                    font-weight: 700;
                }
                .network-3d-weight-label {
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    background: rgba(2, 6, 23, 0.88);
                    padding: 1px 3px;
                    font-size: 9px;
                }
            `}</style>
        </BasePanel>
    );
};

export default NetworkVisualizationPanel;
