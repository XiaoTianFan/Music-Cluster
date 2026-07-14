import React, { useMemo } from 'react';

import BasePanel from './ui/BasePanel';

export interface ANNTrainingPoint {
    x: number;
    y: number;
}

export interface ANNTrainingHistory {
    loss: ANNTrainingPoint[];
    acc: ANNTrainingPoint[];
    valLoss: ANNTrainingPoint[];
    valAcc: ANNTrainingPoint[];
}

interface ANNTrainingPerformancePanelProps {
    history: ANNTrainingHistory;
    isTraining: boolean;
    currentEpoch: number;
    className?: string;
}

interface MetricChartProps {
    label: string;
    points: ANNTrainingPoint[];
    color: string;
    scale: 'loss' | 'accuracy';
}

const VIEWBOX_WIDTH = 520;
const VIEWBOX_HEIGHT = 250;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 18;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 44;
const PLOT_WIDTH = VIEWBOX_WIDTH - PLOT_LEFT - PLOT_RIGHT;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
const TICK_COUNT = 4;

const formatLossTick = (value: number) => value >= 10 ? value.toFixed(1) : value.toFixed(2);

const MetricChart: React.FC<MetricChartProps> = ({ label, points, color, scale }) => {
    const chart = useMemo(() => {
        const finitePoints = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
        const maxEpoch = Math.max(1, ...finitePoints.map((point, index) => point.x || index + 1));
        const observedMax = Math.max(0, ...finitePoints.map(point => point.y));
        const yMax = scale === 'accuracy'
            ? Math.max(1, Math.ceil(observedMax * 10) / 10)
            : Math.max(0.1, observedMax * 1.1);
        const polyline = finitePoints.map((point, index) => {
            const epoch = point.x || index + 1;
            const x = PLOT_LEFT + (epoch / maxEpoch) * PLOT_WIDTH;
            const y = PLOT_TOP + PLOT_HEIGHT - (Math.max(0, point.y) / yMax) * PLOT_HEIGHT;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
        return {
            finitePoints,
            maxEpoch,
            yMax,
            polyline,
            latest: finitePoints.at(-1)?.y ?? null,
        };
    }, [points, scale]);

    const xTicks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
        const ratio = index / TICK_COUNT;
        return {
            x: PLOT_LEFT + ratio * PLOT_WIDTH,
            value: Math.round(ratio * chart.maxEpoch),
        };
    });
    const yTicks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
        const ratio = index / TICK_COUNT;
        return {
            y: PLOT_TOP + PLOT_HEIGHT - ratio * PLOT_HEIGHT,
            value: ratio * chart.yMax,
        };
    });

    return (
        <section className="min-w-0 border border-[var(--foreground)]/20 bg-black/15 p-3" data-ann-training-chart={label}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
                <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                    {chart.latest === null
                        ? 'No samples'
                        : `Latest ${scale === 'accuracy' ? `${(chart.latest * 100).toFixed(1)}%` : chart.latest.toFixed(4)}`}
                </span>
            </div>
            <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className="h-60 w-full"
                role="img"
                aria-label={`${label} by epoch`}
            >
                {yTicks.map(tick => (
                    <g key={`y-${tick.value}`}>
                        <line
                            x1={PLOT_LEFT}
                            x2={PLOT_LEFT + PLOT_WIDTH}
                            y1={tick.y}
                            y2={tick.y}
                            stroke="rgba(148, 163, 184, 0.22)"
                            strokeWidth="1"
                        />
                        <text x={PLOT_LEFT - 8} y={tick.y + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="11">
                            {scale === 'accuracy' ? `${Math.round(tick.value * 100)}%` : formatLossTick(tick.value)}
                        </text>
                    </g>
                ))}
                {xTicks.map(tick => (
                    <g key={`x-${tick.x}`}>
                        <line
                            x1={tick.x}
                            x2={tick.x}
                            y1={PLOT_TOP}
                            y2={PLOT_TOP + PLOT_HEIGHT}
                            stroke="rgba(148, 163, 184, 0.16)"
                            strokeWidth="1"
                        />
                        <text x={tick.x} y={PLOT_TOP + PLOT_HEIGHT + 18} textAnchor="middle" fill="var(--text-secondary)" fontSize="11">
                            {tick.value}
                        </text>
                    </g>
                ))}
                <line x1={PLOT_LEFT} x2={PLOT_LEFT} y1={PLOT_TOP} y2={PLOT_TOP + PLOT_HEIGHT} stroke="var(--foreground)" strokeWidth="1.5" />
                <line x1={PLOT_LEFT} x2={PLOT_LEFT + PLOT_WIDTH} y1={PLOT_TOP + PLOT_HEIGHT} y2={PLOT_TOP + PLOT_HEIGHT} stroke="var(--foreground)" strokeWidth="1.5" />
                <text x={PLOT_LEFT + PLOT_WIDTH / 2} y={VIEWBOX_HEIGHT - 7} textAnchor="middle" fill="var(--text-secondary)" fontSize="12">
                    Epoch
                </text>
                <text
                    x="14"
                    y={PLOT_TOP + PLOT_HEIGHT / 2}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize="12"
                    transform={`rotate(-90 14 ${PLOT_TOP + PLOT_HEIGHT / 2})`}
                >
                    {scale === 'accuracy' ? 'Accuracy' : 'Loss'}
                </text>
                {chart.polyline && (
                    <polyline
                        points={chart.polyline}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                )}
            </svg>
        </section>
    );
};

const ANNTrainingPerformancePanel: React.FC<ANNTrainingPerformancePanelProps> = ({
    history,
    isTraining,
    currentEpoch,
    className = '',
}) => {
    const hasHistory = history.loss.length > 0 || history.acc.length > 0 || history.valLoss.length > 0 || history.valAcc.length > 0;

    return (
        <BasePanel className={`min-h-[660px] ${className}`} title="Training Performance">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="ml-2 text-lg font-semibold text-[var(--accent-secondary)]">Training Performance</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                    {isTraining ? `Training in progress, epoch ${currentEpoch}` : hasHistory ? `${history.loss.length} epochs recorded` : 'Waiting for a training run'}
                </p>
            </div>
            {!hasHistory ? (
                <div className="flex min-h-[560px] items-center justify-center text-sm italic text-[var(--text-secondary)]">
                    Train the network to see loss and accuracy history.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <MetricChart label="Training Loss" points={history.loss} color="#ef4444" scale="loss" />
                    <MetricChart label="Training Accuracy" points={history.acc} color="#22c55e" scale="accuracy" />
                    <MetricChart label="Validation Loss" points={history.valLoss} color="#f97316" scale="loss" />
                    <MetricChart label="Validation Accuracy" points={history.valAcc} color="#38bdf8" scale="accuracy" />
                </div>
            )}
        </BasePanel>
    );
};

export default ANNTrainingPerformancePanel;
