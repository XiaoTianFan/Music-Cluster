import React, { useMemo, useState, ChangeEvent } from 'react';
import Plot from 'react-plotly.js';
import { Song, Features, KmeansAssignments } from '@/app/page'; // Assuming types are exported from page

// --- Helper Types (from page.tsx, ensure they are exported or redefine here) ---
// Type for unprocessed data structure (including OHE info)
interface UnprocessedDataType {
    vectors: number[][];
    songIds: string[];
    isOHEColumn: boolean[];
}

// Type for processed data structure
interface ProcessedDataType {
    vectors: number[][];
    songIds: string[];
}
// --- End Helper Types ---

// Define props based on analysis of page.tsx
interface VisualizationPanelProps {
  className?: string; // Allow passing className for layout adjustments
  activeSongIds: Set<string>;
  songs: Song[]; // For hover text
  // --- New Data Props ---
  songFeatures: Record<string, Features | null>;
  unprocessedData: UnprocessedDataType | null;
  processedData: ProcessedDataType | null;
  // --- Existing Data Props ---
  reducedDataPoints: Record<string, number[]>;
  reductionDimensions: number;
  kmeansAssignments: KmeansAssignments; // Uses the KmeansAssignments type defined (or to be defined) in page.tsx
  kmeansCentroids: number[][];
  kmeansIteration: number;
}

// Define types for internal state
type DataStage = 'raw' | 'processed' | 'clustering';
type DimensionSelection = 2 | 3;
type AxisScale = 'linear' | 'log';

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
  // Destructure new props
  songFeatures,
  unprocessedData,
  processedData,
  // Destructure existing props
  reducedDataPoints,
  reductionDimensions,
  kmeansAssignments,
  kmeansCentroids,
  kmeansIteration 
}) => {

  // --- Internal State for Visualization Controls ---
  const [selectedDataStage, setSelectedDataStage] = useState<DataStage>('clustering');
  const [selectedDimensions, setSelectedDimensions] = useState<DimensionSelection>(2);
  // Default to 'cluster' if clustering data exists and stage is clustering, else null
  const [selectedColorBy, setSelectedColorBy] = useState<string | null>(
    () => (selectedDataStage === 'clustering' && Object.keys(kmeansAssignments).length > 0) ? 'cluster' : null
  );
  const [selectedAxisX, setSelectedAxisX] = useState<string | null>(null); // Will be set dynamically
  const [selectedAxisY, setSelectedAxisY] = useState<string | null>(null); // Will be set dynamically
  const [selectedAxisZ, setSelectedAxisZ] = useState<string | null>(null); // Will be set dynamically
  const [selectedScaleX, setSelectedScaleX] = useState<AxisScale>('linear');
  const [selectedScaleY, setSelectedScaleY] = useState<AxisScale>('linear');
  const [selectedScaleZ, setSelectedScaleZ] = useState<AxisScale>('linear');
  // -------------------------------------------------

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
    const dataTrace: Partial<Plotly.PlotData> = {
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
        dataTrace.z = activePoints.map(p => p.z).filter((z): z is number => z !== undefined);
    }

    // Centroids Trace
    const centroidTrace: Partial<Plotly.PlotData> = {
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

  // --- Control Handlers (Basic Structure) ---
  const handleStageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDataStage(event.target.value as DataStage);
    // TODO: Reset axis/color selections based on the new stage in Phase 3
  };

  const handleDimensionChange = (dim: DimensionSelection) => {
    setSelectedDimensions(dim);
     // Reset Z-axis selection if switching to 2D
    if (dim === 2) {
        setSelectedAxisZ(null);
        setSelectedScaleZ('linear');
    }
    // TODO: Potentially update default axis selections in Phase 3
  };

  const handleColorByChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedColorBy(event.target.value || null);
  };

  const handleAxisChange = (axis: 'X' | 'Y' | 'Z', value: string | null) => {
    if (axis === 'X') setSelectedAxisX(value);
    if (axis === 'Y') setSelectedAxisY(value);
    if (axis === 'Z') setSelectedAxisZ(value);
  };

  const handleScaleChange = (axis: 'X' | 'Y' | 'Z', value: AxisScale) => {
    if (axis === 'X') setSelectedScaleX(value);
    if (axis === 'Y') setSelectedScaleY(value);
    if (axis === 'Z') setSelectedScaleZ(value);
  };
  // --------------------------------------------

  // --- TODO Phase 3: Helper functions for dynamic options ---
  const getAvailableColorOptions = () => {
    // Placeholder
    let options = [{ value: 'cluster', label: 'Cluster Assignment' }];
    // Logic to add categorical features based on unprocessedData/songFeatures
    return options;
  };

  const getAvailableAxisFeatures = () => {
      // Placeholder
      let options: { value: string, label: string }[] = [];
      if (selectedDataStage === 'clustering') {
          options = [
              { value: 'dim1', label: 'Dimension 1' }, 
              { value: 'dim2', label: 'Dimension 2' },
              ...(selectedDimensions === 3 ? [{ value: 'dim3', label: 'Dimension 3' }] : [])
            ];
      } else {
          // Logic to get numerical features from unprocessed/processed data
          // using the mapping helper to be created in Phase 3
          options = [{ value: 'placeholder_feature_1', label: 'Placeholder Feature 1' }, { value: 'placeholder_feature_2', label: 'Placeholder Feature 2' }];
      }
      return options;
  };
  // ---------------------------------------------------------

  // --- Determine data availability for enabling/disabling controls (Basic) ---
  const isUnprocessedDataAvailable = unprocessedData !== null;
  const isProcessedDataAvailable = processedData !== null;
  const isClusteringDataAvailable = Object.keys(kmeansAssignments).length > 0;
  const canSelectRaw = isUnprocessedDataAvailable;
  const canSelectProcessed = isProcessedDataAvailable;
  const canSelectClustering = isClusteringDataAvailable && reducedDataPoints && Object.keys(reducedDataPoints).length > 0 && reductionDimensions > 0;
  // ----------------------------------------------------------------------

  return (
    <div
      className={`p-1 border border-pink-500 flex flex-col items-center justify-start ${className || ''}`}
      data-augmented-ui="tl-clip-x tr-round br-clip bl-round border"
      style={{ '--aug-border-color': 'hotpink' } as React.CSSProperties}
    >
      {/* Plot Area (Takes up most space) */}
      <div className="w-full h-full flex-grow relative mb-2 min-h-0"> {/* Use flex-grow and relative positioning */}
          {/* TODO Phase 3: Add message overlay for no data */}
          <Plot
              data={plotDataAndLayout.plotData as Plotly.Data[]} // Render even if empty
              layout={plotDataAndLayout.plotLayout} // Render even if empty
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }} // Let Plotly fill the container
              config={{ responsive: true, displaylogo: false }} // Make responsive and hide Plotly logo
          />
           {/* Message Overlay (Example) - Refine in Phase 3 */}
           {plotDataAndLayout.plotData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 text-gray-400 text-sm pointer-events-none">
                  No data available for current selection.
              </div>
           )}
      </div>

      {/* Controls Container (Fixed height at the bottom) */}
      <div 
        className="w-full flex-shrink-0 p-2 border-t border-pink-700/50 bg-gray-900/80"
        style={{ backdropFilter: 'blur(2px)' }} // Optional: Add blur for better separation
        >
          {/* Control Row 1 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs mb-2">
              {/* 1. Data Stage */}
              <div className="flex items-center gap-1">
                  <label htmlFor="data-stage-select" className="text-gray-400">Stage:</label>
                  <select 
                      id="data-stage-select"
                      value={selectedDataStage}
                      onChange={handleStageChange}
                      className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                  >
                      <option value="raw" disabled={!canSelectRaw}>Raw Features</option>
                      <option value="processed" disabled={!canSelectProcessed}>Processed Data</option>
                      <option value="clustering" disabled={!canSelectClustering}>Clustering Results</option>
                  </select>
              </div>

              {/* 2. Dimensionality */}
              <div className="flex items-center gap-1">
                  <span className="text-gray-400">Dim:</span>
                  <button 
                    onClick={() => handleDimensionChange(2)}
                    disabled={selectedDimensions === 2}
                    className={`px-2 py-0.5 rounded ${selectedDimensions === 2 ? 'bg-pink-700 text-white cursor-default' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >2D</button>
                  <button 
                    onClick={() => handleDimensionChange(3)}
                    disabled={selectedDimensions === 3}
                    className={`px-2 py-0.5 rounded ${selectedDimensions === 3 ? 'bg-pink-700 text-white cursor-default' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >3D</button>
              </div>

              {/* 3. Color By */}
              <div className="flex items-center gap-1">
                  <label htmlFor="color-by-select" className="text-gray-400">Color:</label>
                  <select 
                      id="color-by-select"
                      value={selectedColorBy ?? ''}
                      onChange={handleColorByChange}
                      className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                      // Disable logic needs refinement based on selected stage in Phase 3
                      disabled={selectedDataStage === 'clustering' ? !canSelectClustering : (!canSelectRaw && !canSelectProcessed) }
                  >
                      <option value="" disabled>Select...</option>
                      {/* TODO Phase 3: Dynamically populate based on getAvailableColorOptions() */}
                      {getAvailableColorOptions().map(opt => (
                          <option key={opt.value} value={opt.value} disabled={selectedDataStage !== 'clustering' && opt.value === 'cluster'}>{opt.label}</option>
                      ))}
                      {/* Example for categorical feature */}
                      {selectedDataStage !== 'clustering' && <option value="feature:key">Feature: Key</option>}
                  </select>
              </div>

               {/* Conditionally Render Axis/Scale controls for 2D on first row */}
              {selectedDimensions === 2 && (
                  <>
                      {/* 4. X-Axis Feature */}
                      <div className="flex items-center gap-1">
                          <label htmlFor="axis-x-select" className="text-gray-400">X:</label>
                          <select
                              id="axis-x-select"
                              value={selectedAxisX ?? ''}
                              onChange={(e) => handleAxisChange('X', e.target.value || null)}
                              className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                              // Disable logic needs refinement in Phase 3
                              disabled={!canSelectRaw && !canSelectProcessed && !canSelectClustering}
                          >
                              <option value="" disabled>Select...</option>
                              {/* TODO Phase 3: Dynamically populate based on getAvailableAxisFeatures() */}
                              {getAvailableAxisFeatures().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                          </select>
                      </div>
                      {/* 5. X-Axis Scale */}
                      <div className="flex items-center gap-1">
                          <label htmlFor="scale-x-select" className="text-gray-400">Scale:</label>
                          <select
                              id="scale-x-select"
                              value={selectedScaleX}
                              onChange={(e) => handleScaleChange('X', e.target.value as AxisScale)}
                              className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                              disabled={!selectedAxisX}
                          >
                              <option value="linear">Linear</option>
                              <option value="log">Log</option>
                          </select>
                      </div>
                       {/* 4. Y-Axis Feature */}
                      <div className="flex items-center gap-1">
                          <label htmlFor="axis-y-select" className="text-gray-400">Y:</label>
                          <select
                              id="axis-y-select"
                              value={selectedAxisY ?? ''}
                              onChange={(e) => handleAxisChange('Y', e.target.value || null)}
                              className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                              disabled={!canSelectRaw && !canSelectProcessed && !canSelectClustering}
                          >
                              <option value="" disabled>Select...</option>
                               {/* TODO Phase 3: Dynamically populate based on getAvailableAxisFeatures() */}
                              {getAvailableAxisFeatures().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                          </select>
                      </div>
                      {/* 5. Y-Axis Scale */}
                      <div className="flex items-center gap-1">
                          <label htmlFor="scale-y-select" className="text-gray-400">Scale:</label>
                          <select
                              id="scale-y-select"
                              value={selectedScaleY}
                              onChange={(e) => handleScaleChange('Y', e.target.value as AxisScale)}
                              className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                              disabled={!selectedAxisY}
                          >
                              <option value="linear">Linear</option>
                              <option value="log">Log</option>
                          </select>
                      </div>
                  </>
              )}
          </div>

          {/* Control Row 2 (Only for 3D) */}
          {selectedDimensions === 3 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  {/* 4. X-Axis Feature */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="axis-x-select-3d" className="text-gray-400">X-Axis:</label>
                      <select
                          id="axis-x-select-3d"
                          value={selectedAxisX ?? ''}
                          onChange={(e) => handleAxisChange('X', e.target.value || null)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                          disabled={!canSelectRaw && !canSelectProcessed && !canSelectClustering}
                      >
                          <option value="" disabled>Select...</option>
                          {/* TODO Phase 3: Dynamically populate based on getAvailableAxisFeatures() */}
                          {getAvailableAxisFeatures().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
                      </select>
                  </div>
                  {/* 5. X-Axis Scale */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="scale-x-select-3d" className="text-gray-400">Scale:</label>
                      <select
                          id="scale-x-select-3d"
                          value={selectedScaleX}
                          onChange={(e) => handleScaleChange('X', e.target.value as AxisScale)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                          disabled={!selectedAxisX}
                      >
                          <option value="linear">Linear</option>
                          <option value="log">Log</option>
                      </select>
                  </div>
                   {/* 4. Y-Axis Feature */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="axis-y-select-3d" className="text-gray-400">Y-Axis:</label>
                      <select
                          id="axis-y-select-3d"
                          value={selectedAxisY ?? ''}
                          onChange={(e) => handleAxisChange('Y', e.target.value || null)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                          disabled={!canSelectRaw && !canSelectProcessed && !canSelectClustering}
                      >
                          <option value="" disabled>Select...</option>
                          {/* TODO Phase 3: Dynamically populate based on getAvailableAxisFeatures() */}
                          {getAvailableAxisFeatures().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
                      </select>
                  </div>
                  {/* 5. Y-Axis Scale */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="scale-y-select-3d" className="text-gray-400">Scale:</label>
                      <select
                          id="scale-y-select-3d"
                          value={selectedScaleY}
                          onChange={(e) => handleScaleChange('Y', e.target.value as AxisScale)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                          disabled={!selectedAxisY}
                      >
                          <option value="linear">Linear</option>
                          <option value="log">Log</option>
                      </select>
                  </div>
                   {/* 4. Z-Axis Feature */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="axis-z-select-3d" className="text-gray-400">Z-Axis:</label>
                      <select
                          id="axis-z-select-3d"
                          value={selectedAxisZ ?? ''}
                          onChange={(e) => handleAxisChange('Z', e.target.value || null)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                          disabled={!canSelectRaw && !canSelectProcessed && !canSelectClustering}
                      >
                          <option value="" disabled>Select...</option>
                           {/* TODO Phase 3: Dynamically populate based on getAvailableAxisFeatures() */}
                           {getAvailableAxisFeatures().map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
                      </select>
                  </div>
                  {/* 5. Z-Axis Scale */}
                  <div className="flex items-center gap-1">
                      <label htmlFor="scale-z-select-3d" className="text-gray-400">Scale:</label>
                      <select
                          id="scale-z-select-3d"
                          value={selectedScaleZ}
                          onChange={(e) => handleScaleChange('Z', e.target.value as AxisScale)}
                          className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                          disabled={!selectedAxisZ}
                      >
                          <option value="linear">Linear</option>
                          <option value="log">Log</option>
                      </select>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default VisualizationPanel;
