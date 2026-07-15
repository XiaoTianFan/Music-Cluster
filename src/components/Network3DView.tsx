'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowPathIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import type { AnnTrainingPhaseSnapshot } from '../lib/annPipeline';
import {
    getAnnNetworkIncidentConnections,
    normalizeAnnLayerName,
    type AnnNetworkGraph,
    type AnnNetworkGraphConnection,
} from '../lib/annNetworkGraph';

interface NetworkPoint {
    x: number;
    y: number;
    z: number;
}

interface Network3DViewProps {
    graph: AnnNetworkGraph;
    phase?: AnnTrainingPhaseSnapshot | null;
    activeNodeId: string | null;
    activeConnectionId: string | null;
    selectedNodeId: string | null;
    selectedConnectionId: string | null;
    isVisible?: boolean;
    onHoverNode: (nodeId: string | null) => void;
    onHoverConnection: (connectionId: string | null) => void;
    onSelectNode: (nodeId: string | null) => void;
    onSelectConnection: (connectionId: string | null) => void;
}

interface ConnectionRecord {
    id: string;
    source: NetworkPoint;
    target: NetworkPoint;
    color: any;
}

type LatestRendererState = Network3DViewProps;

const layerColors = ['#22d3ee', '#4ade80', '#f59e0b', '#fb7185', '#c084fc'];
const idleConnectionIntensity = 0.11;
const pulseFrameIntervalMs = 33;
const pulseDurationMs = 1200;
const pulseSegmentLength = 0.26;

function getConnectionColor(connection: AnnNetworkGraphConnection): string {
    if (connection.weight === null) return '#64748b';
    return connection.weight >= 0 ? '#22d3ee' : '#fb7185';
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

function getTopologySignature(graph: AnnNetworkGraph): string {
    return graph.layers.map(layer => `${layer.name}:${layer.units}`).join('|');
}

const Network3DView: React.FC<Network3DViewProps> = props => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasHostRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const latestRef = useRef<LatestRendererState>(props);
    const updateSceneRef = useRef<(() => void) | null>(null);
    const resetViewRef = useRef<(() => void) | null>(null);
    const zoomViewRef = useRef<((factor: number) => void) | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    latestRef.current = props;

    useEffect(() => {
        updateSceneRef.current?.();
    }, [
        props.activeConnectionId,
        props.activeNodeId,
        props.graph,
        props.isVisible,
        props.phase,
        props.selectedConnectionId,
        props.selectedNodeId,
    ]);

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        setRenderError(null);

        void import('three').then(THREE => {
            if (disposed || !containerRef.current || !canvasHostRef.current || !overlayRef.current) return;
            const container = containerRef.current;
            const canvasHost = canvasHostRef.current;
            const overlay = overlayRef.current;
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer.setClearColor(0x020617, 0.18);
            renderer.domElement.setAttribute('data-ann-network-canvas', 'true');
            renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional neural network');
            renderer.domElement.dataset.annNetworkRendererId = `ann-3d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            canvasHost.replaceChildren(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(48, 1, 1, 10000);
            const graphGroup = new THREE.Group();
            scene.add(graphGroup);
            const target = new THREE.Vector3(0, 0, 0);
            const sharedNodeGeometry = new THREE.SphereGeometry(7, 10, 8);
            let yaw = 0.72;
            let pitch = 0.28;
            let distance = 600;
            let maxSpan = 300;
            let lastAspect: number | null = null;
            let topologySignature = '';
            let renderedGraph: AnnNetworkGraph | null = null;
            let positions = new Map<string, NetworkPoint>();
            let nodeMeshes: any[] = [];
            let connectionSegments: any | null = null;
            let phaseSegmentLines: any | null = null;
            let connectionRecords: ConnectionRecord[] = [];
            let connectionIndexById = new Map<string, number>();
            let layerLabels: Array<{ element: HTMLDivElement; position: any }> = [];
            let weightLabels: Array<{ element: HTMLDivElement; position: any }> = [];
            let phaseConnectionIndices: number[] = [];
            let interactionConnectionIds = new Set<string>();
            let pulseKey = '';
            let pulseStartedAt = 0;
            let pulseDirection: 'forward' | 'backward' | '' = '';
            let pulseTimer: number | null = null;
            let renderCount = 0;
            let hoveredNodeId: string | null = null;
            let hoveredConnectionId: string | null = null;
            let pointerDrag: { id: number; x: number; y: number; mode: 'rotate' | 'pan'; moved: boolean } | null = null;

            const isVisible = () => latestRef.current.isVisible !== false;
            const disposeObject = (object: any) => {
                if (object.geometry !== sharedNodeGeometry) object.geometry?.dispose?.();
                if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.());
                else object.material?.dispose?.();
            };
            const clearGroup = () => {
                while (graphGroup.children.length > 0) {
                    const child = graphGroup.children[graphGroup.children.length - 1];
                    graphGroup.remove(child);
                    disposeObject(child);
                }
            };
            const stopPulse = () => {
                if (pulseTimer !== null) window.clearTimeout(pulseTimer);
                pulseTimer = null;
            };

            const updateCamera = () => {
                const cosPitch = Math.cos(pitch);
                camera.position.set(
                    target.x + distance * cosPitch * Math.sin(yaw),
                    target.y + distance * Math.sin(pitch),
                    target.z + distance * cosPitch * Math.cos(yaw)
                );
                camera.lookAt(target);
                container.dataset.annNetworkCamera = JSON.stringify({
                    yaw: Number(yaw.toFixed(5)),
                    pitch: Number(pitch.toFixed(5)),
                    distance: Number(distance.toFixed(3)),
                    target: [Number(target.x.toFixed(3)), Number(target.y.toFixed(3)), Number(target.z.toFixed(3))],
                });
            };
            const getResetDistance = () => maxSpan * 1.55 * Math.max(1, 1.05 / Math.max(0.1, camera.aspect));
            const resetView = () => {
                target.set(0, 0, 0);
                yaw = 0.72;
                pitch = 0.28;
                distance = getResetDistance();
                updateCamera();
            };

            const projectPoint = (position: any, bounds: DOMRect) => {
                const projected = position.clone().project(camera);
                return {
                    visible: projected.z > -1 && projected.z < 1,
                    x: ((projected.x + 1) / 2) * bounds.width,
                    y: ((-projected.y + 1) / 2) * bounds.height,
                };
            };
            const projectElement = (element: HTMLElement, position: any, bounds: DOMRect) => {
                const projected = projectPoint(position, bounds);
                element.style.display = projected.visible ? 'block' : 'none';
                if (!projected.visible) return;
                const halfWidth = element.offsetWidth / 2;
                const halfHeight = element.offsetHeight / 2;
                const x = Math.max(halfWidth + 4, Math.min(bounds.width - halfWidth - 4, projected.x));
                const y = Math.max(halfHeight + 4, Math.min(bounds.height - halfHeight - 4, projected.y));
                element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            };
            const updateProjectedScene = () => {
                const bounds = container.getBoundingClientRect();
                layerLabels.forEach(label => projectElement(label.element, label.position, bounds));
                weightLabels.forEach(label => projectElement(label.element, label.position, bounds));
                const hitTargets = {
                    nodes: nodeMeshes.map(mesh => {
                        const projected = projectPoint(mesh.position, bounds);
                        return { id: mesh.userData.nodeId, x: projected.x, y: projected.y, visible: projected.visible };
                    }),
                    connections: connectionRecords.map(record => {
                        const midpoint = new THREE.Vector3(
                            (record.source.x + record.target.x) / 2,
                            (record.source.y + record.target.y) / 2,
                            (record.source.z + record.target.z) / 2
                        );
                        const projected = projectPoint(midpoint, bounds);
                        return { id: record.id, x: projected.x, y: projected.y, visible: projected.visible };
                    }),
                };
                container.dataset.annNetworkHitTargets = JSON.stringify(hitTargets);
            };
            const render = (projectScene = true) => {
                if (!isVisible()) return;
                if (projectScene) updateProjectedScene();
                renderer.render(scene, camera);
                renderCount++;
                const renderCalls = renderer.info?.render?.calls ?? 0;
                container.dataset.annNetworkRenderCount = String(renderCount);
                container.dataset.annNetworkDrawCalls = String(renderCalls);
                renderer.domElement.dataset.annNetworkRenderCount = String(renderCount);
                renderer.domElement.dataset.annNetworkDrawCalls = String(renderCalls);
            };

            const setConnectionIntensity = (index: number, intensity: number) => {
                const record = connectionRecords[index];
                const colorAttribute = connectionSegments?.geometry?.attributes?.color;
                if (!record || !colorAttribute) return;
                const red = record.color.r * intensity;
                const green = record.color.g * intensity;
                const blue = record.color.b * intensity;
                colorAttribute.setXYZ(index * 2, red, green, blue);
                colorAttribute.setXYZ(index * 2 + 1, red, green, blue);
            };
            const markConnectionColorsDirty = () => {
                const colorAttribute = connectionSegments?.geometry?.attributes?.color;
                if (colorAttribute) colorAttribute.needsUpdate = true;
            };
            const updatePhaseSegments = (progress: number) => {
                const positionAttribute = phaseSegmentLines?.geometry?.attributes?.position;
                const colorAttribute = phaseSegmentLines?.geometry?.attributes?.color;
                if (!phaseSegmentLines || !positionAttribute || !colorAttribute) return;

                const head = progress * (1 + pulseSegmentLength);
                const segmentStart = Math.max(0, head - pulseSegmentLength);
                const segmentEnd = Math.min(1, head);
                phaseConnectionIndices.forEach((connectionIndex, segmentIndex) => {
                    const record = connectionRecords[connectionIndex];
                    if (!record) return;
                    const from = pulseDirection === 'backward' ? record.target : record.source;
                    const to = pulseDirection === 'backward' ? record.source : record.target;
                    const startOffset = segmentIndex * 2;
                    positionAttribute.setXYZ(
                        startOffset,
                        from.x + (to.x - from.x) * segmentStart,
                        from.y + (to.y - from.y) * segmentStart,
                        from.z + (to.z - from.z) * segmentStart
                    );
                    positionAttribute.setXYZ(
                        startOffset + 1,
                        from.x + (to.x - from.x) * segmentEnd,
                        from.y + (to.y - from.y) * segmentEnd,
                        from.z + (to.z - from.z) * segmentEnd
                    );
                    colorAttribute.setXYZ(startOffset, record.color.r, record.color.g, record.color.b);
                    colorAttribute.setXYZ(startOffset + 1, record.color.r, record.color.g, record.color.b);
                });
                positionAttribute.needsUpdate = true;
                colorAttribute.needsUpdate = true;
                phaseSegmentLines.geometry.setDrawRange(0, phaseConnectionIndices.length * 2);
                phaseSegmentLines.visible = phaseConnectionIndices.length > 0;
                container.dataset.annNetworkPulseProgress = progress.toFixed(4);
                container.dataset.annNetworkPulseSegmentStart = segmentStart.toFixed(4);
                container.dataset.annNetworkPulseSegmentEnd = segmentEnd.toFixed(4);
            };
            const runPulse = () => {
                pulseTimer = null;
                if (!isVisible() || phaseConnectionIndices.length === 0) return;
                const progress = ((performance.now() - pulseStartedAt) % pulseDurationMs) / pulseDurationMs;
                container.dataset.annNetworkPulseConnectionCount = String(phaseConnectionIndices.length);
                updatePhaseSegments(progress);
                render(false);
                pulseTimer = window.setTimeout(runPulse, pulseFrameIntervalMs);
            };
            const updatePulse = (indices: number[], nextPulseKey: string, direction: 'forward' | 'backward' | '') => {
                phaseConnectionIndices = indices;
                pulseDirection = direction;
                container.dataset.annNetworkPulseConnectionCount = String(indices.length);
                const isNewPulse = nextPulseKey !== pulseKey;
                if (isNewPulse) {
                    pulseKey = nextPulseKey;
                    pulseStartedAt = performance.now();
                }
                stopPulse();
                if (indices.length === 0) {
                    if (phaseSegmentLines) {
                        phaseSegmentLines.visible = false;
                        phaseSegmentLines.geometry.setDrawRange(0, 0);
                    }
                    container.dataset.annNetworkPulseProgress = '';
                    container.dataset.annNetworkPulseSegmentStart = '';
                    container.dataset.annNetworkPulseSegmentEnd = '';
                } else {
                    const progress = isNewPulse ? 0 : ((performance.now() - pulseStartedAt) % pulseDurationMs) / pulseDurationMs;
                    updatePhaseSegments(progress);
                }
                if (indices.length > 0 && isVisible()) pulseTimer = window.setTimeout(runPulse, pulseFrameIntervalMs);
            };

            const rebuildGraph = (graph: AnnNetworkGraph) => {
                clearGroup();
                stopPulse();
                overlay.replaceChildren();
                nodeMeshes = [];
                connectionSegments = null;
                phaseSegmentLines = null;
                connectionRecords = [];
                connectionIndexById = new Map<string, number>();
                layerLabels = [];
                weightLabels = [];
                positions = build3dPositions(graph);
                maxSpan = Math.max(
                    300,
                    (graph.layers.length - 1) * 220,
                    ...graph.layers.map(layer => Math.ceil(Math.sqrt(layer.units)) * 28)
                );

                const segmentPositions = new Float32Array(graph.connections.length * 6);
                const segmentColors = new Float32Array(graph.connections.length * 6);
                graph.connections.forEach((connection, connectionIndex) => {
                    const source = positions.get(connection.sourceId);
                    const destination = positions.get(connection.targetId);
                    if (!source || !destination) return;
                    segmentPositions.set([
                        source.x, source.y, source.z,
                        destination.x, destination.y, destination.z,
                    ], connectionIndex * 6);
                    const color = new THREE.Color(getConnectionColor(connection));
                    segmentColors.set([
                        color.r * idleConnectionIntensity, color.g * idleConnectionIntensity, color.b * idleConnectionIntensity,
                        color.r * idleConnectionIntensity, color.g * idleConnectionIntensity, color.b * idleConnectionIntensity,
                    ], connectionIndex * 6);
                    connectionRecords.push({ id: connection.id, source, target: destination, color });
                    connectionIndexById.set(connection.id, connectionIndex);
                });
                const segmentGeometry = new THREE.BufferGeometry();
                segmentGeometry.addAttribute('position', new THREE.BufferAttribute(segmentPositions, 3));
                segmentGeometry.addAttribute('color', new THREE.BufferAttribute(segmentColors, 3));
                const segmentMaterial = new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors,
                    transparent: true,
                    opacity: 1,
                    depthTest: true,
                });
                connectionSegments = new THREE.LineSegments(segmentGeometry, segmentMaterial);
                connectionSegments.renderOrder = 1;
                graphGroup.add(connectionSegments);

                const phaseGeometry = new THREE.BufferGeometry();
                phaseGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(graph.connections.length * 6), 3));
                phaseGeometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(graph.connections.length * 6), 3));
                phaseGeometry.setDrawRange(0, 0);
                const phaseMaterial = new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors,
                    transparent: true,
                    opacity: 1,
                    depthTest: false,
                    depthWrite: false,
                });
                phaseSegmentLines = new THREE.LineSegments(phaseGeometry, phaseMaterial);
                phaseSegmentLines.renderOrder = 25;
                phaseSegmentLines.visible = false;
                graphGroup.add(phaseSegmentLines);

                graph.nodes.forEach(node => {
                    const position = positions.get(node.id);
                    if (!position) return;
                    const material = new THREE.MeshBasicMaterial({
                        color: layerColors[node.layerIndex % layerColors.length],
                        transparent: true,
                        opacity: 0.36 + node.normalizedValue * 0.64,
                        depthTest: true,
                    });
                    const mesh = new THREE.Mesh(sharedNodeGeometry, material);
                    mesh.position.set(position.x, position.y, position.z);
                    mesh.userData.nodeId = node.id;
                    mesh.userData.baseOpacity = 0.36 + node.normalizedValue * 0.64;
                    graphGroup.add(mesh);
                    nodeMeshes.push(mesh);
                });

                layerLabels = graph.layers.map(layer => {
                    const element = document.createElement('div');
                    element.className = 'network-3d-layer-label';
                    element.textContent = `${layer.name} | ${layer.units}`;
                    overlay.appendChild(element);
                    const x = (layer.index - (graph.layers.length - 1) / 2) * 220;
                    const maxRows = Math.ceil(layer.units / Math.max(1, Math.ceil(Math.sqrt(layer.units))));
                    return { element, position: new THREE.Vector3(x, maxRows * 15 + 34, 0) };
                });

                const nextSignature = getTopologySignature(graph);
                if (topologySignature !== nextSignature) {
                    topologySignature = nextSignature;
                    resetView();
                }
                renderedGraph = graph;
                container.dataset.annNetworkConnectionObjects = connectionSegments ? '1' : '0';
                container.dataset.annNetworkPhaseSegmentObjects = phaseSegmentLines ? '1' : '0';
            };

            const updateGraphValues = (graph: AnnNetworkGraph) => {
                graph.connections.forEach((connection, index) => {
                    const record = connectionRecords[index];
                    if (record) record.color.set(getConnectionColor(connection));
                });
                graph.nodes.forEach((node, index) => {
                    const mesh = nodeMeshes[index];
                    if (!mesh) return;
                    const baseOpacity = 0.36 + node.normalizedValue * 0.64;
                    mesh.userData.baseOpacity = baseOpacity;
                    mesh.material.opacity = baseOpacity;
                });
                renderedGraph = graph;
            };

            const applyVisualState = () => {
                const state = latestRef.current;
                const graph = state.graph;
                const nextSignature = getTopologySignature(graph);
                if (nextSignature !== topologySignature || nodeMeshes.length !== graph.nodes.length || connectionRecords.length !== graph.connections.length) {
                    rebuildGraph(graph);
                } else if (renderedGraph !== graph) {
                    updateGraphValues(graph);
                }

                const activeConnections = state.activeConnectionId
                    ? graph.connections.filter(connection => connection.id === state.activeConnectionId)
                    : state.activeNodeId
                        ? getAnnNetworkIncidentConnections(graph, state.activeNodeId)
                        : [];
                interactionConnectionIds = new Set(activeConnections.map(connection => connection.id));
                const connectedNodeIds = new Set(activeConnections.flatMap(connection => [connection.sourceId, connection.targetId]));
                const phaseConnections = graph.connections.filter(connection => isPhaseConnection(connection, graph, state.phase));

                connectionRecords.forEach((record, index) => {
                    setConnectionIntensity(index, interactionConnectionIds.has(record.id) ? 0.98 : idleConnectionIntensity);
                });
                markConnectionColorsDirty();
                nodeMeshes.forEach((mesh, index) => {
                    const node = graph.nodes[index];
                    const nodeId = mesh.userData.nodeId as string;
                    const isActive = nodeId === state.activeNodeId;
                    const isConnected = connectedNodeIds.has(nodeId);
                    const phaseActive = state.phase?.activeLayerName
                        ? normalizeAnnLayerName(state.phase.activeLayerName) === node?.layerName
                        : false;
                    mesh.scale.setScalar(isActive ? 1.65 : isConnected || phaseActive ? 1.2 : 1);
                    mesh.material.opacity = state.activeNodeId && !isConnected && !isActive ? 0.24 : mesh.userData.baseOpacity;
                    mesh.material.depthTest = !isActive;
                    mesh.material.depthWrite = !isActive;
                    mesh.renderOrder = isActive ? 30 : isConnected ? 20 : 10;
                });

                weightLabels.forEach(label => label.element.remove());
                weightLabels = [];
                activeConnections.forEach(connection => {
                    const source = positions.get(connection.sourceId);
                    const destination = positions.get(connection.targetId);
                    if (!source || !destination) return;
                    const element = document.createElement('div');
                    element.className = 'network-3d-weight-label';
                    element.dataset.annNetworkWeightLabel = connection.id;
                    element.textContent = connection.weight === null ? 'uninitialized' : connection.weight.toFixed(4);
                    element.style.color = getConnectionColor(connection);
                    overlay.appendChild(element);
                    weightLabels.push({
                        element,
                        position: new THREE.Vector3(
                            source.x * 0.54 + destination.x * 0.46,
                            source.y * 0.54 + destination.y * 0.46,
                            source.z * 0.54 + destination.z * 0.46
                        ),
                    });
                });

                container.dataset.annNetworkFocusedNode = state.selectedNodeId ?? '';
                container.dataset.annNetworkFocusedConnection = state.selectedConnectionId ?? '';
                const direction = state.phase?.direction;
                const nextPulseKey = direction === 'forward' || direction === 'backward'
                    ? `${direction}:${state.phase?.activeLayerName ?? ''}`
                    : '';
                container.dataset.annNetworkPulseDirection = direction === 'forward' || direction === 'backward' ? direction : '';
                updatePulse(
                    phaseConnections.flatMap(connection => {
                        const index = connectionIndexById.get(connection.id);
                        return index === undefined ? [] : [index];
                    }),
                    nextPulseKey,
                    direction === 'forward' || direction === 'backward' ? direction : ''
                );
                render();
            };

            const resize = () => {
                const width = Math.max(1, container.clientWidth);
                const height = Math.max(1, container.clientHeight);
                renderer.setSize(width, height);
                const nextAspect = width / height;
                camera.aspect = nextAspect;
                camera.updateProjectionMatrix();
                if (lastAspect === null) {
                    lastAspect = nextAspect;
                    resetView();
                } else if (Math.abs(nextAspect - lastAspect) > 0.1) {
                    distance = Math.max(distance, getResetDistance());
                    lastAspect = nextAspect;
                    updateCamera();
                }
                render();
            };

            const raycaster = new THREE.Raycaster();
            raycaster.linePrecision = 6;
            if (raycaster.params?.Line) raycaster.params.Line.threshold = 6;
            const pointer = new THREE.Vector2();
            const getHit = (event: PointerEvent): { nodeId: string | null; connectionId: string | null } => {
                const bounds = renderer.domElement.getBoundingClientRect();
                pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
                pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
                raycaster.setFromCamera(pointer, camera);
                const nodeHit = raycaster.intersectObjects(nodeMeshes)[0];
                if (nodeHit?.object?.userData?.nodeId) return { nodeId: nodeHit.object.userData.nodeId, connectionId: null };
                const connectionHit = connectionSegments ? raycaster.intersectObject(connectionSegments)[0] : null;
                const segmentIndex = typeof connectionHit?.index === 'number' ? Math.floor(connectionHit.index / 2) : -1;
                return { nodeId: null, connectionId: connectionRecords[segmentIndex]?.id ?? null };
            };
            const updateHover = (event: PointerEvent) => {
                const hit = getHit(event);
                if (hoveredNodeId !== hit.nodeId) {
                    hoveredNodeId = hit.nodeId;
                    latestRef.current.onHoverNode(hit.nodeId);
                }
                if (hoveredConnectionId !== hit.connectionId) {
                    hoveredConnectionId = hit.connectionId;
                    latestRef.current.onHoverConnection(hit.connectionId);
                }
                renderer.domElement.style.cursor = hit.nodeId || hit.connectionId ? 'pointer' : 'grab';
            };
            const clearHover = () => {
                if (hoveredNodeId !== null) latestRef.current.onHoverNode(null);
                if (hoveredConnectionId !== null) latestRef.current.onHoverConnection(null);
                hoveredNodeId = null;
                hoveredConnectionId = null;
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
                if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
                if (!moved) {
                    const hit = getHit(event);
                    if (hit.nodeId) latestRef.current.onSelectNode(hit.nodeId);
                    else if (hit.connectionId) latestRef.current.onSelectConnection(hit.connectionId);
                    else {
                        latestRef.current.onSelectNode(null);
                        latestRef.current.onSelectConnection(null);
                    }
                    updateHover(event);
                }
                renderer.domElement.style.cursor = hoveredNodeId || hoveredConnectionId ? 'pointer' : 'grab';
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
            renderer.domElement.addEventListener('pointerleave', clearHover);
            renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
            renderer.domElement.addEventListener('contextmenu', handleContextMenu);

            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(container);
            updateSceneRef.current = applyVisualState;
            resetViewRef.current = () => { resetView(); render(); };
            zoomViewRef.current = factor => {
                distance = Math.max(100, Math.min(maxSpan * 8, distance * factor));
                updateCamera();
                render();
            };
            rebuildGraph(latestRef.current.graph);
            resize();
            applyVisualState();

            cleanup = () => {
                stopPulse();
                resizeObserver.disconnect();
                clearHover();
                clearGroup();
                sharedNodeGeometry.dispose();
                layerLabels.forEach(label => label.element.remove());
                weightLabels.forEach(label => label.element.remove());
                renderer.dispose();
                renderer.forceContextLoss?.();
                renderer.domElement.remove();
                updateSceneRef.current = null;
                resetViewRef.current = null;
                zoomViewRef.current = null;
            };
        }).catch(error => {
            if (!disposed) setRenderError(error instanceof Error ? error.message : String(error));
        });

        return () => {
            disposed = true;
            cleanup();
        };
    }, []);

    return (
        <div ref={containerRef} className="relative h-full min-h-0 overflow-hidden bg-black/25" data-ann-network-view="3d">
            <div ref={canvasHostRef} className="absolute inset-0 z-0" />
            <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
            <div className="absolute right-3 top-3 z-20 flex gap-1">
                <button type="button" className="network-tool-button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomViewRef.current?.(0.8)}>
                    <MagnifyingGlassPlusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomViewRef.current?.(1.25)}>
                    <MagnifyingGlassMinusIcon className="h-4 w-4" />
                </button>
                <button type="button" className="network-tool-button" title="Reset view" aria-label="Reset view" onClick={() => resetViewRef.current?.()}>
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

export default Network3DView;
