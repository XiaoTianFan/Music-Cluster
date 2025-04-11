import React, { useMemo, useState, ChangeEvent, useEffect } from 'react';
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
  latestSuccessfulStage: ProcessingStage; // Prop from parent
}

// Define types for internal state
type DataStage = 'raw' | 'processed' | 'reduction' | 'clustering';
type DimensionSelection = 2 | 3;
type AxisScale = 'linear' | 'log';

// Define possible stages for visualization
type VisualizationStage = 'features' | 'unprocessed' | 'processed' | 'reduced' | 'clusters';

// Type received from parent for the latest completed step
type ProcessingStage = 'features' | 'processed' | 'reduced' | 'kmeans' | null;

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
  '#17becf',  // Blue-teal
  '#aec7e8',  // Light blue
  '#ffbb78',  // Light orange
  '#98df8a',  // Light green
  '#ff9896',  // Light red
  '#c5b0d5',  // Light purple
  '#c49c94',  // Light brown
  '#f7b6d2',  // Light pink
  '#c7c7c7',  // Light gray
  '#dbdb8d',  // Light yellow-green
  '#9edae5',  // Light blue-teal
  '#393b79',  // Dark blue
  '#843c39',  // Dark red
  '#5254a3',  // Dark purple
  '#8c6d31',  // Dark brown
  '#637939',  // Dark green
  '#8ca252',  // Olive green
  '#b5cf6b',  // Lime green
  '#cedb9c',  // Pale green
  '#8c6d31',  // Dark gold
  '#bd9e39'   // Gold
];

// Define feature field order and mappings for better visualization
const FEATURE_FIELD_ORDER = [
  // MFCC fields
  { key: 'mfccMeans', prefix: 'MFCC Mean', isArray: true },
  { key: 'mfccStdDevs', prefix: 'MFCC Std', isArray: true },
  // Energy and complexity fields
  { key: 'energy', prefix: 'Energy', isArray: false },
  { key: 'entropy', prefix: 'Entropy', isArray: false },
  { key: 'dynamicComplexity', prefix: 'Dynamic Complexity', isArray: false },
  { key: 'loudness', prefix: 'Loudness', isArray: false },
  { key: 'rms', prefix: 'RMS', isArray: false },
  // Tuning fields
  { key: 'tuningFrequency', prefix: 'Tuning Frequency', isArray: false },
  { key: 'tuningCents', prefix: 'Tuning Cents', isArray: false },
  // Categorical fields (for coloring, not for axes)
  { key: 'key', prefix: 'Key', isArray: false, isCategorical: true },
  { key: 'keyScale', prefix: 'Scale', isArray: false, isCategorical: true },
  { key: 'keyStrength', prefix: 'Key Strength', isArray: false }
];

// Define a type for feature column metadata
interface FeatureColumn {
  name: string;        // Display name
  columnIndex: number; // Index in the matrix
  featureKey: string;  // Original feature key
  arrayIndex?: number; // If from array, which index
}

// Define a type for categorical value mapping
interface CategoryValueMap {
  [category: string]: { // Category like 'key' or 'keyScale'
    values: string[];   // Possible values in order of encoding
  };
}

// Base layout configuration to ensure consistent styling even when no data is plotted
const basePlotLayout: Partial<Plotly.Layout> = {
  title: 'Visualization', // Generic initial title
  autosize: true,
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0, 0, 0, 0)',
  font: {
    color: '#cccccc'
  },
  margin: { l: 40, r: 40, b: 40, t: 60, pad: 4 },
  legend: {
    x: 0.05,
    y: 0.95,
    bgcolor: 'rgba(50,50,50,0.7)',
    bordercolor: '#aaaaaa',
    borderwidth: 1
  },
  hovermode: 'closest',
  // Default axis styling (can be overridden later)
  xaxis: {
    title: 'X',
    color: '#cccccc',
    gridcolor: '#555555',
    zerolinecolor: '#777777'
  },
  yaxis: {
    title: 'Y',
    color: '#cccccc',
    gridcolor: '#555555',
    zerolinecolor: '#777777'
  },
  scene: { // Default 3D scene styling
    xaxis: { title: 'X', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
    yaxis: { title: 'Y', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
    zaxis: { title: 'Z', color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' },
    bgcolor: 'rgba(0,0,0,0)',
    camera: { eye: { x: 1.25, y: 1.25, z: 1.25 } } 
  }
};

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
  kmeansIteration,
  latestSuccessfulStage,
}) => {

  // --- Internal State for Visualization Controls ---
  const [selectedDataStage, setSelectedDataStage] = useState<DataStage>('raw');
  const [selectedDimensions, setSelectedDimensions] = useState<DimensionSelection>(2);
  // Default to 'cluster' if clustering data exists and stage is clustering, else null
  const [selectedColorBy, setSelectedColorBy] = useState<string | null>(
    () => (Object.keys(kmeansAssignments).length > 0) ? 'cluster' : null
  );
  const [selectedAxisX, setSelectedAxisX] = useState<string | null>(null); // Will be set dynamically
  const [selectedAxisY, setSelectedAxisY] = useState<string | null>(null); // Will be set dynamically
  const [selectedAxisZ, setSelectedAxisZ] = useState<string | null>(null); // Will be set dynamically
  const [selectedScaleX, setSelectedScaleX] = useState<AxisScale>('linear');
  const [selectedScaleY, setSelectedScaleY] = useState<AxisScale>('linear');
  const [selectedScaleZ, setSelectedScaleZ] = useState<AxisScale>('linear');
  const [showLegend, setShowLegend] = useState<boolean>(false); // State for legend visibility
  const [isFeatureTableVisible, setIsFeatureTableVisible] = useState(false);
  const [featureTableData, setFeatureTableData] = useState<Array<Record<string, any>> | null>(null);
  // -------------------------------------------------

  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs]);

  // --- Determine data availability for enabling/disabling controls (MOVED UP) ---
  const isUnprocessedDataAvailable = unprocessedData !== null;
  const isProcessedDataAvailable = processedData !== null;
  const isReducedDataAvailable = reducedDataPoints && Object.keys(reducedDataPoints).length > 0; 
  const isClusteringDataAvailable = isReducedDataAvailable && Object.keys(kmeansAssignments).length > 0 && reductionDimensions > 0; 
  const canSelectRaw = isUnprocessedDataAvailable;
  const canSelectProcessed = isProcessedDataAvailable;
  const canSelectReduction = isReducedDataAvailable; 
  const canSelectClustering = isClusteringDataAvailable;
  // ----------------------------------------------------------------------

  // --- Helper functions for mapping feature columns and names ---
  const featureColumnsMap = useMemo<{ numerical: FeatureColumn[], categorical: string[] }>(() => {
    if (!unprocessedData) {
      return { numerical: [], categorical: [] };
    }

    // Initialize result objects
    const numerical: FeatureColumn[] = [];
    const categorical: string[] = [];
    
    // Track column index as we build the mapping
    let currentColIndex = 0;
    
    // Process features in canonical order
    FEATURE_FIELD_ORDER.forEach(fieldInfo => {
      const { key, prefix, isArray, isCategorical } = fieldInfo;
      
      if (isCategorical) {
        // This is a categorical feature, add it to the categorical list
        categorical.push(key);
        
        // Skip the corresponding OHE columns in the numerical matrix
        // Need to determine how many columns this categorical feature uses
        if (unprocessedData.isOHEColumn) {
          for (let i = currentColIndex; i < unprocessedData.vectors[0]?.length; i++) {
            if (unprocessedData.isOHEColumn[i]) {
              currentColIndex++;
            } else {
              break; // Stop when we hit a non-OHE column
            }
          }
        }
      } else if (isArray) {
        // This is an array feature (like mfccMeans with multiple coefficients)
        // Need to determine array length by analyzing the first song's feature
        let arrayLength = 0;
        
        // Find a song that has this feature
        for (const songId of unprocessedData.songIds) {
          const features = songFeatures[songId];
          if (features && features[key as keyof Features] && Array.isArray(features[key as keyof Features])) {
            // @ts-ignore - we verified it's an array above
            arrayLength = features[key as keyof Features].length;
            break;
          }
        }
        
        // Now create a column entry for each array element
        for (let i = 0; i < arrayLength; i++) {
          numerical.push({
            name: `${prefix} ${i + 1}`, // e.g., "MFCC Mean 1", "MFCC Mean 2"
            columnIndex: currentColIndex,
            featureKey: key,
            arrayIndex: i
          });
          currentColIndex++;
        }
      } else {
        // This is a regular numerical feature
        numerical.push({
          name: prefix,
          columnIndex: currentColIndex,
          featureKey: key
        });
        currentColIndex++;
      }
    });
    
    return { numerical, categorical };
  }, [unprocessedData, songFeatures]);

  // Get the category value map (mapping from OHE indices to original values)
  const categoryValueMap = useMemo<CategoryValueMap>(() => {
    const result: CategoryValueMap = {};
    
    if (!songFeatures) return result;
    
    // For each known categorical feature
    featureColumnsMap.categorical.forEach(category => {
      // Get all unique values for this category across all songs
      const uniqueValues = new Set<string>();
      
      Object.values(songFeatures).forEach(features => {
        if (features && features[category as keyof Features]) {
          const value = features[category as keyof Features];
          if (typeof value === 'string') {
            uniqueValues.add(value);
          }
        }
      });
      
      // Sort values for consistent ordering
      result[category] = {
        values: Array.from(uniqueValues).sort()
      };
    });
    
    return result;
  }, [songFeatures, featureColumnsMap.categorical]);

  // Helper to get the original categorical value for a song
  const getCategoricalValueForSong = (songId: string, category: string): string => {
    if (!songFeatures || !songFeatures[songId]) return 'N/A';
    
    const features = songFeatures[songId];
    if (!features) return 'N/A';
    
    const value = features[category as keyof Features];
    return typeof value === 'string' ? value : 'N/A';
  };

  // --- Dynamic options for controls ---
  const getAvailableColorOptions = useMemo(() => {
    // Start with cluster option
    let options = [{ value: 'cluster', label: 'Cluster Assignment' }];
    
    // Add categorical features from our mapping
    featureColumnsMap.categorical.forEach(category => {
      options.push({ 
        value: `feature:${category}`, 
        label: `Feature: ${category.charAt(0).toUpperCase() + category.slice(1)}` 
      });
    });
    
    return options;
  }, [featureColumnsMap.categorical]);

  const getAvailableAxisFeatures = useMemo(() => {
    let options: { value: string, label: string }[] = [];
    
    // Check if stage is 'reduction' OR 'clustering'
    if (selectedDataStage === 'reduction' || selectedDataStage === 'clustering') { 
      // For reduction/clustering stages, use dimensions from reduction
      options = [
        { value: 'dim1', label: 'Dimension 1' }, 
        { value: 'dim2', label: 'Dimension 2' }
      ];
      if (reductionDimensions >= 3) { // Use reductionDimensions state
        options.push({ value: 'dim3', label: 'Dimension 3' });
      }
    } else { 
      // For raw or processed stages, use numerical features
      options = featureColumnsMap.numerical.map(col => ({
        value: `col:${col.columnIndex}`,
        label: col.name
      }));
    }
    
    return options;
  }, [selectedDataStage, reductionDimensions, featureColumnsMap.numerical]);

  // Set default axis and color selections when stage changes
  useEffect(() => {
    // Default color selection
    // In 'reduction' or 'clustering' stages, default to cluster coloring IF available, otherwise first feature
    if (selectedDataStage === 'clustering' && isClusteringDataAvailable) {
      setSelectedColorBy('cluster');
    } else if (selectedDataStage === 'reduction' || selectedDataStage === 'clustering') {
      // Fallback for reduction/clustering if cluster data not ready or not applicable
      if (featureColumnsMap.categorical.length > 0) {
        setSelectedColorBy(`feature:${featureColumnsMap.categorical[0]}`);
      } else {
        setSelectedColorBy(null); // No categories available
      }
    } else { // 'raw' or 'processed' stages
      if (featureColumnsMap.categorical.length > 0) {
        setSelectedColorBy(`feature:${featureColumnsMap.categorical[0]}`);
      } else {
        setSelectedColorBy(null); // No categories available
      }
    }
    
    // Default axis selections
    // Use dimensions for 'reduction' and 'clustering' stages
    if (selectedDataStage === 'reduction' || selectedDataStage === 'clustering') {
      setSelectedAxisX('dim1');
      setSelectedAxisY('dim2');
      if (selectedDimensions === 3) {
        setSelectedAxisZ('dim3');
      } else {
        setSelectedAxisZ(null); // Ensure Z is null in 2D mode
      }
    } else if (featureColumnsMap.numerical.length > 0) { // Use features for 'raw'/'processed'
      const availableFeatures = featureColumnsMap.numerical;
      const firstFeatureIndex = availableFeatures.length > 0 ? `col:${availableFeatures[0].columnIndex}` : null;
      const secondFeatureIndex = availableFeatures.length > 1 ? `col:${availableFeatures[1].columnIndex}` : null;
      const thirdFeatureIndex = selectedDimensions === 3 && availableFeatures.length > 2 ? `col:${availableFeatures[2].columnIndex}` : null;
      
      setSelectedAxisX(firstFeatureIndex);
      setSelectedAxisY(secondFeatureIndex);
      setSelectedAxisZ(thirdFeatureIndex); // Set Z axis for 3D if possible
    } else { // No numerical features for raw/processed
       setSelectedAxisX(null);
       setSelectedAxisY(null);
       setSelectedAxisZ(null);
    }
  }, [selectedDataStage, featureColumnsMap.categorical, featureColumnsMap.numerical, selectedDimensions, isClusteringDataAvailable]);

  // --- Auto-Switch Logic --- 
  useEffect(() => {
    // console.log(`[VizPanel] useEffect triggered. latestSuccessfulStage: ${latestSuccessfulStage}`);

    // Map parent stage to panel stage
    let targetStage: DataStage | null = null; // Use DataStage type directly
    if (latestSuccessfulStage === 'features') targetStage = 'raw'; // Map 'features' -> 'raw'
    else if (latestSuccessfulStage === 'processed') targetStage = 'processed';
    else if (latestSuccessfulStage === 'reduced') targetStage = 'reduction';
    else if (latestSuccessfulStage === 'kmeans') targetStage = 'clustering';

    if (targetStage && targetStage !== selectedDataStage) { // Compare with selectedDataStage
        // Check if data for the target stage exists before switching
        let dataExists = false;
        if (targetStage === 'raw' && unprocessedData?.vectors && unprocessedData.vectors.length > 0) dataExists = true; 
        else if (targetStage === 'processed' && processedData?.vectors && processedData.vectors.length > 0) dataExists = true;
        else if (targetStage === 'reduction' && Object.keys(reducedDataPoints).length > 0) dataExists = true;
        // UPDATED CHECK: Verify both reduced points and assignments exist for clustering stage
        else if (targetStage === 'clustering' && Object.keys(reducedDataPoints).length > 0 && Object.keys(kmeansAssignments).length > 0) dataExists = true; 

        if (dataExists) {
            console.log(`[VizPanel] Auto-switching view from ${selectedDataStage} to ${targetStage}`);
            setSelectedDataStage(targetStage); // <-- UPDATE: Set the correct state
        } else {
            // console.log(`[VizPanel] Auto-switch to ${targetStage} skipped: Data not available.`);
        }
    } else {
        // console.log(`[VizPanel] Auto-switch condition not met (target: ${targetStage}, current selected: ${selectedDataStage})`);
    }
  // UPDATED DEPENDENCIES: Added kmeansAssignments and setSelectedDataStage
  }, [latestSuccessfulStage, songFeatures, unprocessedData, processedData, reducedDataPoints, kmeansAssignments, selectedDataStage, setSelectedDataStage]); 

  // Helper function to create detailed hover information
  const createDetailedHoverText = (songId: string, songName: string, stage: DataStage): string => {
    let hoverText = `<b>${songName}</b>`;
    
    // Add cluster information if available (for any stage)
    if (kmeansAssignments[songId] !== undefined) {
      hoverText += `<br><b>Cluster:</b> ${kmeansAssignments[songId]}`;
    }
    
    // Add all available MIR features for the song
    const features = songFeatures[songId];
    if (features) {
      hoverText += '<br><br><b>MIR Features:</b>';
      
      // Add single numeric values
      if (features.energy !== undefined) hoverText += `<br>Energy: ${features.energy.toFixed(3)}`;
      if (features.entropy !== undefined) hoverText += `<br>Entropy: ${features.entropy.toFixed(3)}`;
      if (features.dynamicComplexity !== undefined) hoverText += `<br>Dynamic Complexity: ${features.dynamicComplexity.toFixed(3)}`;
      if (features.loudness !== undefined) hoverText += `<br>Loudness: ${features.loudness.toFixed(3)}`;
      if (features.rms !== undefined) hoverText += `<br>RMS: ${features.rms.toFixed(3)}`;
      if (features.keyStrength !== undefined) hoverText += `<br>Key Strength: ${features.keyStrength.toFixed(3)}`;
      if (features.tuningFrequency !== undefined) hoverText += `<br>Tuning Frequency: ${features.tuningFrequency.toFixed(2)} Hz`;
      if (features.tuningCents !== undefined) hoverText += `<br>Tuning Cents: ${features.tuningCents.toFixed(2)}`;
      
      // Add categorical values
      if (features.key !== undefined) hoverText += `<br>Key: ${features.key}`;
      if (features.keyScale !== undefined) hoverText += `<br>Scale: ${features.keyScale}`;
      
      // Add summary of array values (first 3 values if array is longer)
      if (features.mfccMeans && features.mfccMeans.length > 0) {
        const mfccPreview = features.mfccMeans.slice(0, 3).map(v => v.toFixed(3)).join(', ');
        hoverText += `<br>MFCC Means: [${mfccPreview}${features.mfccMeans.length > 3 ? ', ...' : ''}]`;
      }
      if (features.mfccStdDevs && features.mfccStdDevs.length > 0) {
        const stdPreview = features.mfccStdDevs.slice(0, 3).map(v => v.toFixed(3)).join(', ');
        hoverText += `<br>MFCC StdDevs: [${stdPreview}${features.mfccStdDevs.length > 3 ? ', ...' : ''}]`;
      }
    }
    
    return hoverText;
  };

  // Handler to toggle legend visibility
  const handleToggleLegend = (event: ChangeEvent<HTMLInputElement>) => {
    setShowLegend(event.target.checked);
  };

  const plotDataAndLayout = useMemo(() => {
    try { 
      // console.log('[Plot Memo] Recalculating plot data...'); 
      let dataPoints: Record<string, number[]> = {};
      let songIds: string[] = [];
      let dataTitle = '';

      // console.log(`[Plot Memo] Selected Stage: ${selectedDataStage}`); 

      switch (selectedDataStage) {
        case 'raw':
          if (!unprocessedData || unprocessedData.vectors.length === 0) {
            // console.log('[Plot Memo] No raw data available.'); 
            return { plotData: [], plotLayout: basePlotLayout }; 
          }
          dataTitle = 'Raw Features';
          songIds = unprocessedData.songIds;
          unprocessedData.vectors.forEach((vector, idx) => {
            const songId = unprocessedData.songIds[idx];
            if (activeSongIds.has(songId)) { dataPoints[songId] = vector; }
          });
          break;
        case 'processed':
          if (!processedData || processedData.vectors.length === 0) {
            // console.log('[Plot Memo] No processed data available.');
            return { plotData: [], plotLayout: basePlotLayout };
          }
          dataTitle = 'Processed Data';
          songIds = processedData.songIds;
          processedData.vectors.forEach((vector, idx) => {
            const songId = processedData.songIds[idx];
            if (activeSongIds.has(songId)) { dataPoints[songId] = vector; }
          });
          break;
        case 'reduction':
          if (!isReducedDataAvailable) {
            // console.log('[Plot Memo] No reduced data points available.'); 
            return { plotData: [], plotLayout: basePlotLayout }; 
          }
          dataTitle = 'Reduced Dimensions';
          dataPoints = reducedDataPoints;
          songIds = Object.keys(reducedDataPoints);
          break;
        case 'clustering':
        default:
          if (!isClusteringDataAvailable) {
            // console.log('[Plot Memo] No clustering data available.'); 
            return { plotData: [], plotLayout: basePlotLayout }; 
          }
          dataTitle = `K-Means Clustering - Iteration ${kmeansIteration}`;
          dataPoints = reducedDataPoints;
          songIds = Object.keys(reducedDataPoints);
          break;
      }
      
      const filteredSongIds = songIds.filter(id => activeSongIds.has(id));
      if (filteredSongIds.length === 0) {
        // console.log('[Plot Memo] No active songs for current stage/filter.'); 
        return { plotData: [], plotLayout: basePlotLayout }; 
      }
      
      let xAxisIndex = 0, yAxisIndex = 1, zAxisIndex = 2;
      let xAxisTitle = 'Dim 1', yAxisTitle = 'Dim 2', zAxisTitle = 'Dim 3';
      const getColumnIndex = (sel: string | null): number | null => sel ? (sel.startsWith('dim') ? parseInt(sel.substring(3))-1 : (sel.startsWith('col:') ? parseInt(sel.substring(4)) : null)) : null;
      const getAxisTitle = (sel: string | null, defaultPrefix: string): string => {
        const colIdx = getColumnIndex(sel);
        if (colIdx === null) return defaultPrefix;
        // Use dimension prefix for reduction or clustering stages
        if (selectedDataStage === 'reduction' || selectedDataStage === 'clustering') { 
          return `${defaultPrefix} ${colIdx + 1}`;
        } 
        // Otherwise, look up the feature name for raw/processed
        const feature = featureColumnsMap.numerical.find(f => f.columnIndex === colIdx);
        return feature ? feature.name : `${defaultPrefix} ${colIdx + 1}`; // Fallback if feature name not found
      };

      xAxisIndex = getColumnIndex(selectedAxisX) ?? 0;
      yAxisIndex = getColumnIndex(selectedAxisY) ?? 1;
      zAxisIndex = getColumnIndex(selectedAxisZ) ?? 2;
      xAxisTitle = getAxisTitle(selectedAxisX, 'Dimension');
      yAxisTitle = getAxisTitle(selectedAxisY, 'Dimension');
      zAxisTitle = getAxisTitle(selectedAxisZ, 'Dimension');

      // console.log(`[Plot Memo] Axis Indices: X=${xAxisIndex}, Y=${yAxisIndex}, Z=${zAxisIndex}`); 
      // console.log(`[Plot Memo] Axis Titles: X='${xAxisTitle}', Y='${yAxisTitle}', Z='${zAxisTitle}'`); 
      
      const traceType = selectedDimensions === 3 ? 'scatter3d' : 'scatter';
      
      // Prepare intermediate point representation
      const intermediatePoints: { 
        x: number; y: number; z?: number; id: string; name: string; cluster?: number; colorCategory?: string; 
      }[] = [];
      
      // Determine max required dimension based on selected axes AND 2D/3D mode
      let maxRequiredDimIndex = Math.max(xAxisIndex, yAxisIndex);
      if (selectedDimensions === 3) {
        maxRequiredDimIndex = Math.max(maxRequiredDimIndex, zAxisIndex);
      }
      
      filteredSongIds.forEach(id => {
        const point = dataPoints[id];
        const song = songMap.get(id);
        // Check if point exists and has enough dimensions for the selected axes
        if (point && point.length > maxRequiredDimIndex && song) { 
          intermediatePoints.push({
            x: point[xAxisIndex],
            y: point[yAxisIndex],
            z: selectedDimensions === 3 ? point[zAxisIndex] : undefined,
            id: id,
            name: song.name,
            cluster: selectedDataStage === 'clustering' ? kmeansAssignments[id] : undefined,
            colorCategory: selectedColorBy?.startsWith('feature:') ? getCategoricalValueForSong(id, selectedColorBy.substring(8)) : undefined
          });
        }
      });
      
      // console.log(`[Plot Memo] Generated ${intermediatePoints.length} intermediate points.`);
      if (intermediatePoints.length === 0) {
        // console.log('[Plot Memo] No valid points generated after axis mapping.');
        return { plotData: [], plotLayout: basePlotLayout }; 
      }
      
      // Determine coloring strategy & Group points
      const colorByCluster = selectedColorBy === 'cluster' && selectedDataStage === 'clustering';
      const colorByCategorical = selectedColorBy?.startsWith('feature:');
      const categoryKey = colorByCategorical ? selectedColorBy!.substring(8) : null;
      // console.log(`[Plot Memo] Color Strategy: ${selectedColorBy ?? 'Default'}`);

      const groupedPoints: Record<string, typeof intermediatePoints> = {};
      const categoryToColor: Record<string, string> = {};
      let colorIndexCounter = 0;
      const defaultGroupName = 'Songs';

      intermediatePoints.forEach(point => {
        let groupName: string = defaultGroupName;
        let pointColorNeedsAssign = false;

        if (colorByCluster && point.cluster !== undefined) {
          groupName = `Cluster ${point.cluster}`;
          if (!categoryToColor[groupName]) {
             categoryToColor[groupName] = plotlyColors[point.cluster % plotlyColors.length];
          }
        } else if (colorByCategorical && categoryKey && point.colorCategory && point.colorCategory !== 'N/A') {
          groupName = point.colorCategory;
          pointColorNeedsAssign = !categoryToColor[groupName];
        } 
        
        if (!groupedPoints[groupName]) {
          groupedPoints[groupName] = [];
          // Assign color if needed (either first time seeing category or default)
          if (!categoryToColor[groupName]) { 
             const assignedColor = pointColorNeedsAssign 
               ? plotlyColors[colorIndexCounter++ % plotlyColors.length] 
               : plotlyColors[0]; // Default color for 'Songs' group
             categoryToColor[groupName] = assignedColor;
          }
        }
        groupedPoints[groupName].push(point);
      });
      // console.log(`[Plot Memo] Generated ${Object.keys(groupedPoints).length} groups/traces.`);

      // Generate Traces from Groups
      const plotData: Partial<Plotly.PlotData>[] = [];
      Object.entries(groupedPoints).forEach(([groupName, pointsInGroup]) => {
        if (pointsInGroup.length === 0) return;
        const traceColor = categoryToColor[groupName];
        
        const trace: Partial<Plotly.PlotData> = {
          x: pointsInGroup.map(p => p.x),
          y: pointsInGroup.map(p => p.y),
          type: traceType,
          mode: 'markers',
          marker: { color: traceColor, size: 8, opacity: 0.8 },
          text: pointsInGroup.map(p => createDetailedHoverText(p.id, p.name, selectedDataStage)),
          hoverinfo: 'text',
          name: groupName, 
          showlegend: true 
        };
        if (selectedDimensions === 3) {
          trace.z = pointsInGroup.map(p => p.z).filter((z): z is number => z !== undefined);
        }
        plotData.push(trace);
      });
      
      // Add Centroid Trace (ONLY if clustering)
      if (selectedDataStage === 'clustering' && kmeansCentroids.length > 0) {
        const centroidTrace: Partial<Plotly.PlotData> = {
          x: kmeansCentroids.map(c => c[xAxisIndex] || 0),
          y: kmeansCentroids.map(c => c[yAxisIndex] || 0),
          z: selectedDimensions === 3 ? kmeansCentroids.map(c => c[zAxisIndex] || 0) : undefined,
          type: traceType,
          mode: 'markers',
          marker: {
            color: kmeansCentroids.map((c, i) => plotlyColors[i % plotlyColors.length]), 
            size: 14, symbol: 'diamond', opacity: 1, line: { color: '#000000', width: 1 }
          },
          text: kmeansCentroids.map((c, i) => `Centroid ${i}`),
          hoverinfo: 'text',
          name: 'Centroids', 
          showlegend: true 
        };
        plotData.push(centroidTrace);
      }
      
      // Configure Layout
      const xAxisConfig = { title: xAxisTitle, type: selectedScaleX, color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' };
      const yAxisConfig = { title: yAxisTitle, type: selectedScaleY, color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' };
      const zAxisConfig = selectedDimensions === 3 ? { title: zAxisTitle, type: selectedScaleZ, color: '#cccccc', gridcolor: '#555555', zerolinecolor: '#777777' } : undefined;

      const plotLayout: Partial<Plotly.Layout> = {
        ...basePlotLayout, 
        title: dataTitle, 
        showlegend: showLegend, 
        // colorway removed - colors set per trace
        legend: { ...basePlotLayout.legend, traceorder: 'normal' } 
      };
      
      if (selectedDimensions === 3) {
        plotLayout.scene = { ...(basePlotLayout.scene || {}), xaxis: xAxisConfig as any, yaxis: yAxisConfig as any, zaxis: zAxisConfig as any };
        delete plotLayout.xaxis; delete plotLayout.yaxis;
      } else {
        plotLayout.xaxis = xAxisConfig as any; 
        plotLayout.yaxis = yAxisConfig as any;
        delete plotLayout.scene;
      }
      
      // console.log('[Plot Memo] Final Plot Data Length:', plotData.length); 
      // console.log('[Plot Memo] Final Plot Layout Title:', plotLayout.title);
      // console.log('[Plot Memo] Final Plot Layout BgColor:', plotLayout.paper_bgcolor, plotLayout.plot_bgcolor);
      
      return { plotData, plotLayout };
    } catch (error) { 
      // console.error('[Plot Memo] Error calculating plot data:', error); 
      return { plotData: [], plotLayout: { ...basePlotLayout, showlegend: showLegend } }; 
    }
  }, [
    selectedDataStage, unprocessedData, processedData, reducedDataPoints, kmeansAssignments, 
    kmeansCentroids, reductionDimensions, kmeansIteration, activeSongIds, songMap, 
    selectedDimensions, selectedAxisX, selectedAxisY, selectedAxisZ, selectedScaleX, 
    selectedScaleY, selectedScaleZ, selectedColorBy, featureColumnsMap.numerical, 
    featureColumnsMap.categorical, categoryValueMap, getCategoricalValueForSong, 
    createDetailedHoverText, songFeatures, showLegend, 
    isReducedDataAvailable, isClusteringDataAvailable
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

  return (
    <div
      className={`flex flex-col items-center justify-start ${className || ''}`}
    >
      {/* Plot Area (Takes up most space) */}
      <div 
        className="w-full h-full flex-grow relative mb-2 min-h-0 border border-pink-500 justify-center items-center"
        data-augmented-ui="tl-clip-x tr-round br-clip bl-round border"
        style={{ '--aug-border-color': 'hotpink' } as React.CSSProperties}
      >
          <Plot
              data={plotDataAndLayout.plotData as Plotly.Data[]} // Render even if empty
              layout={plotDataAndLayout.plotLayout} // Render even if empty
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }} // Let Plotly fill the container
              config={{ responsive: true, displaylogo: false }} // Make responsive and hide Plotly logo
              className="w-full h-full flex-grow relative mb-2 px-4 min-h-0"
          />
      </div>

      {/* Controls Container (Fixed height at the bottom) */}
      <div 
        className="w-full flex-shrink-0 p-2 mt-2 border-t border-b border-pink-700/50 bg-gray-900/80"
        style={{ backdropFilter: 'blur(2px)' }} // Optional: Add blur for better separation
        >
          {/* Control Row 1: ALWAYS contains Data Stage, Dimensionality, and Color selection */}
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
                      <option value="reduction" disabled={!canSelectReduction}>Reduced Data</option>
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
                      disabled={selectedDataStage === 'clustering' ? !canSelectClustering : (!canSelectRaw && !canSelectProcessed)}
                  >
                      <option value="" disabled>Select...</option>
                      {getAvailableColorOptions.map((opt: { value: string, label: string }) => (
                        <option 
                          key={opt.value} 
                          value={opt.value} 
                          disabled={selectedDataStage !== 'clustering' && opt.value === 'cluster'}
                        >
                          {opt.label}
                        </option>
                      ))}
                  </select>
              </div>

              {/* 4. Show Legend Toggle */}
              <div className="flex items-center gap-1">
                  <input
                      type="checkbox"
                      id="show-legend-toggle"
                      checked={showLegend}
                      onChange={handleToggleLegend}
                      className="form-checkbox h-3 w-3 text-pink-500 bg-gray-800 border-gray-600 rounded focus:ring-pink-500/50"
                  />
                  <label htmlFor="show-legend-toggle" className="text-gray-400 select-none">Legend</label>
              </div>
          </div>

          {/* Control Row 2: ALWAYS contains axis controls, conditionally shows Z-axis based on dimension */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {/* X-Axis Feature */}
              <div className="flex items-center gap-1">
                  <label htmlFor="axis-x-select" className="text-gray-400">X:</label>
                  <select
                      id="axis-x-select"
                      value={selectedAxisX ?? ''}
                      onChange={(e) => handleAxisChange('X', e.target.value || null)}
                      className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                      disabled={(selectedDataStage === 'raw' && !canSelectRaw) || 
                                (selectedDataStage === 'processed' && !canSelectProcessed) || 
                                (selectedDataStage === 'clustering' && !canSelectClustering)}
                  >
                      <option value="" disabled>Select...</option>
                      {getAvailableAxisFeatures.map((opt: { value: string, label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                  </select>
              </div>
              
              {/* X-Axis Scale */}
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
              
              {/* Y-Axis Feature */}
              <div className="flex items-center gap-1">
                  <label htmlFor="axis-y-select" className="text-gray-400">Y:</label>
                  <select
                      id="axis-y-select"
                      value={selectedAxisY ?? ''}
                      onChange={(e) => handleAxisChange('Y', e.target.value || null)}
                      className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                      disabled={(selectedDataStage === 'raw' && !canSelectRaw) || 
                               (selectedDataStage === 'processed' && !canSelectProcessed) || 
                               (selectedDataStage === 'clustering' && !canSelectClustering)}
                  >
                      <option value="" disabled>Select...</option>
                      {getAvailableAxisFeatures.map((opt: { value: string, label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                  </select>
              </div>
              
              {/* Y-Axis Scale */}
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
              
              {/* Z-Axis Feature - Only shown in 3D mode */}
              {selectedDimensions === 3 && (
                <div className="flex items-center gap-1">
                    <label htmlFor="axis-z-select" className="text-gray-400">Z:</label>
                    <select
                        id="axis-z-select"
                        value={selectedAxisZ ?? ''}
                        onChange={(e) => handleAxisChange('Z', e.target.value || null)}
                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500 min-w-[100px]"
                        disabled={(selectedDataStage === 'raw' && !canSelectRaw) || 
                                 (selectedDataStage === 'processed' && !canSelectProcessed) || 
                                 (selectedDataStage === 'clustering' && !canSelectClustering)}
                    >
                        <option value="" disabled>Select...</option>
                        {getAvailableAxisFeatures.map((opt: { value: string, label: string }) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
              )}
              
              {/* Z-Axis Scale - Only shown in 3D mode */}
              {selectedDimensions === 3 && (
                <div className="flex items-center gap-1">
                    <label htmlFor="scale-z-select" className="text-gray-400">Scale:</label>
                    <select
                        id="scale-z-select"
                        value={selectedScaleZ}
                        onChange={(e) => handleScaleChange('Z', e.target.value as AxisScale)}
                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-pink-500"
                        disabled={!selectedAxisZ}
                    >
                        <option value="linear">Linear</option>
                        <option value="log">Log</option>
                    </select>
                </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default VisualizationPanel;
