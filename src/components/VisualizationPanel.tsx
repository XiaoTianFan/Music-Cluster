import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Song } from '@/app/page'; // Assuming types are exported from page

// Define props based on analysis of page.tsx
interface VisualizationPanelProps {
  className?: string; // Allow passing className for layout adjustments
  activeSongIds: Set<string>;
  songs: Song[]; // For hover text
  reducedDataPoints: Record<string, number[]>;
  reductionDimensions: number;
  kmeansAssignments: Record<string, number>; // Uses the KmeansAssignments type defined (or to be defined) in page.tsx
  kmeansCentroids: number[][];
  kmeansIteration: number;
}

// Define a color scale for clusters - add more colors if needed
const plotlyColors = [
  '#1f77b4',  // Muted blue
  '#ff7f0e',  // Safety orange
  '#2ca02c',  // Cooked asparagus green
  '#d62728',  // Brick red
  '#9467bd',  // Muted purple
  '#8c564b',  // Chestnut brown
  '#e377c2',  // Raspberry yogurt pink
  '#7f7f7f',  // Middle gray
  '#bcbd22',  // Curry yellow-green
  '#17becf'   // Blue-teal
];

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  className,
  activeSongIds,
  songs,
  reducedDataPoints,
  reductionDimensions,
  kmeansAssignments,
  kmeansCentroids,
  kmeansIteration 
}) => {

  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs]);

  const plotDataAndLayout = useMemo(() => {
    if (reductionDimensions !== 2 && reductionDimensions !== 3) {
      return { plotData: [], plotLayout: {} }; // Invalid dimensions
    }

    const activePoints: { x: number; y: number; z?: number; id: string; name: string; cluster: number | undefined }[] = [];
    activeSongIds.forEach(id => {
      const point = reducedDataPoints[id];
      const assignment = kmeansAssignments[id];
      const song = songMap.get(id);
      if (point && point.length === reductionDimensions && song) {
        activePoints.push({
          x: point[0],
          y: point[1],
          z: reductionDimensions === 3 ? point[2] : undefined,
          id: id,
          name: song.name,
          cluster: assignment, // Will be undefined if not yet assigned
        });
      }
    });

    if (activePoints.length === 0) {
        return { plotData: [], plotLayout: {} }; // No valid points to plot
    }

    const traceType = reductionDimensions === 3 ? 'scatter3d' : 'scatter';

    // Data Points Trace
    const dataTrace: any = {
      x: activePoints.map(p => p.x),
      y: activePoints.map(p => p.y),
      type: traceType,
      mode: 'markers',
      marker: {
        color: activePoints.map(p => 
            p.cluster !== undefined ? plotlyColors[p.cluster % plotlyColors.length] : '#cccccc' // Default gray if no cluster
        ),
        size: 8,
        opacity: 0.8
      },
      text: activePoints.map(p => `${p.name}<br>Cluster: ${p.cluster ?? 'N/A'}`), // Hover text
      hoverinfo: 'text',
      name: 'Songs'
    };
    if (reductionDimensions === 3) {
        dataTrace.z = activePoints.map(p => p.z);
    }

    // Centroids Trace
    const centroidTrace: any = {
        x: kmeansCentroids.map(c => c[0]),
        y: kmeansCentroids.map(c => c[1]),
        type: traceType,
        mode: 'markers',
        marker: {
            color: kmeansCentroids.map((c, i) => plotlyColors[i % plotlyColors.length]),
            size: 14,
            symbol: 'diamond', // Use diamond for centroids
            opacity: 1,
            line: { // Add a border to centroids
                color: '#000000', 
                width: 1
            }
        },
        text: kmeansCentroids.map((c, i) => `Centroid ${i}`),
        hoverinfo: 'text',
        name: 'Centroids'
    };
    if (reductionDimensions === 3) {
        centroidTrace.z = kmeansCentroids.map(c => c[2]);
    }

    const plotData = [dataTrace, centroidTrace];

    // Layout
    const plotLayout: Partial<Plotly.Layout> = {
      title: `K-Means Clustering - Iteration ${kmeansIteration}`, // Dynamic title
      autosize: true,
      // Use transparent background to match page
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)', 
      font: {
        color: '#cccccc' // Light text for dark background
      },
      margin: { l: 40, r: 40, b: 40, t: 60, pad: 4 }, // Adjust margins
      legend: {
        x: 0.05,
        y: 0.95,
        bgcolor: 'rgba(50,50,50,0.7)',
        bordercolor: '#aaaaaa',
        borderwidth: 1
      },
      hovermode: 'closest'
    };

    if (reductionDimensions === 3) {
      plotLayout.scene = {
          xaxis: { title: 'Dim 1', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
          yaxis: { title: 'Dim 2', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
          zaxis: { title: 'Dim 3', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
          bgcolor: 'rgba(0,0,0,0)',
           camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } } // Adjust camera view
      };
    } else {
        plotLayout.xaxis = { title: 'Dimension 1', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' };
        plotLayout.yaxis = { title: 'Dimension 2', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' };
    }

    return { plotData, plotLayout };

  }, [
      activeSongIds, 
      reducedDataPoints, 
      kmeansAssignments, 
      kmeansCentroids, 
      reductionDimensions, 
      kmeansIteration,
      songMap // Include songMap dependency
    ]);

  return (
    <div
      className={`p-4 border border-pink-500 flex flex-col items-center justify-center ${className || ''}`}
      data-augmented-ui="tl-clip-x tr-round br-clip bl-round border"
      style={{ '--aug-border-color': 'hotpink' } as React.CSSProperties}
    >
      {/* Conditional Rendering based on data availability */}
      {plotDataAndLayout.plotData.length > 0 ? (
        <Plot
          data={plotDataAndLayout.plotData as Plotly.Data[]}
          layout={plotDataAndLayout.plotLayout}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displaylogo: false }} // Make responsive and hide Plotly logo
        />
      ) : (
        <p className="text-sm text-gray-400">
          {reductionDimensions === 0 
            ? "Run Dimensionality Reduction first."
            : "No data points to display for active songs."
          }
        </p>
      )}
    </div>
  );
};

export default VisualizationPanel;
