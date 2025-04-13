import React, { useState, useMemo, useCallback } from 'react';
import { CogIcon, InformationCircleIcon, BeakerIcon, PlayIcon, StopIcon, ArrowPathIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

// Type for reduction method (assuming it's defined elsewhere or should be here)
type ReductionMethod = 'pca' | 'tsne' | 'umap';
// Type for data processing method
type ProcessingMethod = 'none' | 'standardize' | 'normalize';

// Define props based on analysis of page.tsx
interface ControlsPanelProps {
  isProcessing: boolean; // True if MIR extraction is running
  isProcessingData: boolean; // True if Data Processing worker is running (NEW)
  isReducing: boolean; // True if dimensionality reduction is running
  isClustering: boolean; // True if K-Means clustering is running
  essentiaWorkerReady: boolean;
  activeSongCount: number;
  // Check if *any* of the active songs have successfully computed features
  hasFeaturesForActiveSongs: boolean; 
  // Check if *any* of the active songs have successfully computed reduced features
  hasReducedDataForActiveSongs: boolean;
  hasProcessedData: boolean; // Data has been processed (NEW derived state)
  onExtractFeatures: (selectedFeatures: Set<string>) => void;
  onProcessData: (method: ProcessingMethod, range?: [number, number]) => void; // (NEW)
  // Type for the reduction method, mirroring page.tsx
  onReduceDimensions: (method: ReductionMethod, dimensions: number, params?: Record<string, unknown>) => void;
  onRunClustering: (k: number) => void; // Handler to start clustering
  onShowExplanation: (featureId: string) => void; // For MIR features
  onShowAlgoExplanation: (algorithmId: string) => void; // <-- ADDED: For algorithms
  className?: string; // Allow passing className for layout adjustments
  // --- NEW Props for Manual K-Means Control ---
  isKmeansInitialized: boolean;
  onNextStep: () => void;
  isClusteringActive: boolean; // New flag specifically for K-Means activity state
}

// Placeholder for available MIR features
const availableMirFeatures = [
  { id: 'mfcc', name: 'MFCC' }, // Represents mfccMeans, mfccStdDevs
  { id: 'energy', name: 'Energy' },
  { id: 'entropy', name: 'ZCR Entropy' },
  { id: 'key', name: 'Key & Scale' }, // Represents key, keyScale, keyStrength
  { id: 'dynamicComplexity', name: 'Dynamic Complexity' }, // Represents dynamicComplexity, loudness
  { id: 'rms', name: 'RMS' },
  { id: 'tuningFrequency', name: 'Tuning Frequency' }, // Represents tuningFrequency
  // --- NEW FEATURES --- Based on worker capabilities ---
  { id: 'rhythm', name: 'BPM'}, // Represents bpm, rhythmConfidence
  // { id: 'onsetRate', name: 'Onset Rate'},
  { id: 'danceability', name: 'Danceability'},
  { id: 'intensity', name: 'Intensity'},
  { id: 'spectralCentroidTime', name: 'Spectral Centroid'},
  { id: 'spectralComplexity', name: 'Spectral Complexity'},
  { id: 'spectralContrast', name: 'Spectral Contrast'},
  { id: 'inharmonicity', name: 'Inharmonicity'},
  { id: 'dissonance', name: 'Dissonance'},
  { id: 'melBands', name: 'Mel Bands'},
  { id: 'pitchSalience', name: 'Pitch Salience'},
  { id: 'spectralFlux', name: 'Spectral Flux'},
];

// Placeholder for available Dim Reduction algorithms
const availableDimReducers = [
  { id: 'pca', name: 'PCA' },
  { id: 'tsne', name: 't-SNE' },
  { id: 'umap', name: 'UMAP' },
];

const ControlsPanel: React.FC<ControlsPanelProps> = ({ 
  isProcessing,
  isProcessingData,
  isReducing,
  isClustering,
  essentiaWorkerReady,
  activeSongCount,
  hasFeaturesForActiveSongs,
  hasReducedDataForActiveSongs,
  hasProcessedData,
  onExtractFeatures,
  onProcessData,
  onReduceDimensions,
  onRunClustering,
  onShowExplanation,
  onShowAlgoExplanation, // <-- Destructure the new prop
  className,
  // --- NEW Props for Manual K-Means Control ---
  isKmeansInitialized,
  onNextStep,
  isClusteringActive
}) => {
  // State for selected controls
  const [selectedMirFeatures, setSelectedMirFeatures] = useState<Set<string>>(() => new Set(['mfcc'])); // Default MFCC
  const [selectedDimReducer, setSelectedDimReducer] = useState<ReductionMethod>('tsne'); // Default t-SNE
  const [targetDimensions, setTargetDimensions] = useState<number>(2); // Default 2D
  const [numClusters, setNumClusters] = useState<number>(3); // Default k=3

  // --- NEW: State for Data Processing Method ---
  const [selectedProcessingMethod, setSelectedProcessingMethod] = useState<ProcessingMethod>('standardize');
  const [selectedNormalizationRange, setSelectedNormalizationRange] = useState<'[0,1]' | '[-1,1]'>('[0,1]');
  // -------------------------------------------

  const handleMirFeatureToggle = (featureId: string) => {
    setSelectedMirFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      // Basic validation: Ensure at least one feature is selected?
      // if (next.size === 0) return prev; // Don't allow deselecting the last one
      return next;
    });
  };

  const handleNumClustersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    // Allow value to be 1 or more
    if (!isNaN(value) && value >= 1) {
        setNumClusters(value);
    } else if (e.target.value === '' || value === 0) {
        setNumClusters(1); // Reset to 1 if empty or 0
    }
  };

  // --- NEW: Handler for starting data processing ---
  const handleStartProcessing = () => {
    const range = selectedProcessingMethod === 'normalize' 
                    ? (selectedNormalizationRange === '[0,1]' ? [0, 1] as [number, number] : [-1, 1] as [number, number])
                    : undefined;
    onProcessData(selectedProcessingMethod, range);
  };
  // ---------------------------------------------

  // Handler to trigger dimension reduction
  const handleProceedReduction = () => {
    // TODO: Add logic here later to gather method-specific parameters if needed (e.g., perplexity)
    const params = {}; // Placeholder for extra parameters
    onReduceDimensions(selectedDimReducer, targetDimensions, params);
  };

  const canProcessData = hasFeaturesForActiveSongs && !isProcessing && !isReducing;

  // Determine if the reduction button should be enabled
  const canReduceDimensions = hasProcessedData && !isProcessing && !isProcessingData;

  // --- NEW: Determine if K-Means can be *initialized* --- 
  const canInitializeCluster = !isProcessing && !isProcessingData && !isReducing && activeSongCount > 0 && hasReducedDataForActiveSongs && numClusters > 0;

  // --- NEW: Determine if the "Next Step" button should be enabled --- 
  const canRunNextStep = isKmeansInitialized && !isProcessing && !isProcessingData && !isReducing;

  return (
    <div
      className={`p-4 border border-green-500 bg-gray-900/60 flex overflow-y-scroll hide-scrollbar flex-col h-[85vh] ${className || ''}`}
      data-augmented-ui="tl-round tr-clip br-clip-x bl-clip border"
      style={{ '--aug-border-color': 'lime' } as React.CSSProperties}
    >
      <h2 className="text-lg font-semibold mb-3 text-green-400 flex-shrink-0">Controls</h2>

      {/* Scrollable area for controls */}
      <div className="flex-grow overflow-y-auto pr-1 hide-scrollbar">
        {/* === MIR Feature Selection === */}
        <div 
            className="mb-4 p-3 border border-gray-700/80 flex flex-col"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
          <h3 className="text-md font-semibold mb-2 text-green-300">MIR Features</h3>
          <div className="flex flex-wrap gap-x-1 gap-y-2 flex-grow">
            {availableMirFeatures.map(feature => (
              <div key={feature.id} className="relative group flex items-center justify-between text-xs">
                 <button 
                    onClick={() => handleMirFeatureToggle(feature.id)}
                    className={`text-xs pr-2 pl-2 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                    data-checked={selectedMirFeatures.has(feature.id)}
                    disabled={isProcessing}
                    title={feature.name}
                 >
                   {feature.name}
                 </button>
                <button 
                  onClick={() => onShowExplanation(feature.id)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-blue-300 hover:text-blue-200 border border-blue-900/50 invisible group-hover:visible disabled:opacity-50 disabled:cursor-not-allowed z-10"
                  title={`Explain ${feature.name}`}
                  
                >
                  ?
                </button>
              </div>
            ))}
          </div>
          {/* Select All / Clear Buttons */}
          <div className="flex gap-2 mt-2 mb-1">
            <button
              onClick={() => {
                const allFeatureIds = new Set(availableMirFeatures.map(f => f.id));
                setSelectedMirFeatures(allFeatureIds);
              }}
              disabled={isProcessing}
              className="px-4 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Select all available features"
              data-augmented-ui="tl-clip br-clip"
            >
              All
            </button>
            <button
              onClick={() => setSelectedMirFeatures(new Set())}
              disabled={isProcessing || selectedMirFeatures.size === 0}
              className="px-4 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear feature selection"
              data-augmented-ui="tl-clip br-clip"
            >
              Clear
            </button>
          </div>
          <div className="mt-2 flex-shrink-0">
             <button
                onClick={() => onExtractFeatures(selectedMirFeatures)}
                disabled={!essentiaWorkerReady || isProcessing || activeSongCount === 0 || selectedMirFeatures.size === 0}
                className={`w-full p-1 text-center font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${(essentiaWorkerReady && !isProcessing && activeSongCount > 0 && selectedMirFeatures.size > 0) ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                data-augmented-ui="tl-clip br-clip border"
                style={{ '--aug-border-color': (essentiaWorkerReady && !isProcessing && activeSongCount > 0 && selectedMirFeatures.size > 0) ? 'lime' : '#555' } as React.CSSProperties}
                title={
                    !essentiaWorkerReady ? "Worker initializing..." : 
                    (activeSongCount === 0 ? "Select songs to process" : 
                    (selectedMirFeatures.size === 0 ? "Select at least one MIR feature" : 
                    "Extract selected features from active songs"))}
             >
                {isProcessing ? 'Processing...' : `Extract Features (${activeSongCount})`}
             </button>
          </div>
        </div>

        {/* === NEW: Data Processing Selection === */}
        <div 
            className="mb-4 p-3 border border-gray-700/80 flex flex-col" 
            data-augmented-ui="tl-clip br-clip border" 
            style={{ '--aug-border-color': '#555' } as React.CSSProperties}
        >
            <h3 className="text-md font-semibold mb-2 text-green-300">Data Processing</h3>
            {/* Method Selection */} 
            <div className="mb-2">
                <span className="text-xs block mb-1 text-gray-400">Method:</span>
                <div className="flex gap-2 flex-wrap">
                    {['standardize', 'normalize'].map(method => (
                        <div key={method} className="relative group flex items-center">
                            <label className="text-xs pl-1 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={selectedProcessingMethod === method}>
                                <input 
                                    type="radio" 
                                    name="processingMethod" 
                                    value={method}
                                    checked={selectedProcessingMethod === method}
                                    onChange={(e) => setSelectedProcessingMethod(e.target.value as ProcessingMethod)}
                                    className="hidden"
                                    disabled={isProcessing}
                                />
                                {method === 'standardize' ? 'Standardize (Z-score)' : 'Normalize (Min-Max)'}
                            </label>
                            <button
                                onClick={() => onShowAlgoExplanation(method)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 ml-1 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-blue-300 hover:text-blue-200 border border-blue-900/50 invisible group-hover:visible disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                title={`Explain ${method === 'standardize' ? 'Standardization' : 'Normalization'}`}
                            >
                                ?
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            {/* Normalization Range (Conditional) */} 
            {selectedProcessingMethod === 'normalize' && (
                <div className="mb-3 ml-4">
                   <span className="text-xs block mb-1 text-gray-400">Normalization Range:</span>
                    <div className="flex gap-3 flex-wrap">
                        {['[0,1]', '[-1,1]'].map(range => (
                            <label key={range} className="text-xs px-2 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={selectedNormalizationRange === range}>
                                <input 
                                    type="radio" 
                                    name="normalizationRange" 
                                    value={range}
                                    checked={selectedNormalizationRange === range}
                                    onChange={(e) => setSelectedNormalizationRange(e.target.value as '[0,1]' | '[-1,1]')}
                                    className="hidden"
                                    disabled={isProcessing}
                                />
                                {range}
                            </label>
                        ))}
                    </div>
                </div>
            )}
            {/* Process Data Button */} 
             <button 
                 onClick={handleStartProcessing}
                 disabled={!canProcessData} 
                 className={`w-full p-1 mt-1 text-center font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${canProcessData ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                 data-augmented-ui="tl-clip br-clip border"
                 style={{ '--aug-border-color': canProcessData ? 'deepskyblue' : '#555' } as React.CSSProperties}
                 title={
                     !hasFeaturesForActiveSongs ? "Extract features first" :
                     isProcessing ? "Feature extraction active..." :
                     isReducing ? "Dimension reduction active..." :
                     "Process selected data"
                 }
             >
                 {isProcessingData ? 'Processing Data...' : `Process Data`}
             </button>
        </div>
        {/* === END: Data Processing Selection === */}

        {/* === Dimensionality Reduction === */}
         <div 
            className="mb-4 p-3 border border-gray-700/80"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
          <h3 className="text-md font-semibold mb-2 text-green-300">Dimensionality Reduction</h3>
          {/* Combined Algorithm and Dimensions Selection */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2 items-start">
            {/* Algorithm Selection */}
            <div >
               <span className="text-xs block mb-1 text-gray-400">Algorithm:</span>
               <div className="flex gap-2 flex-wrap">
                  {availableDimReducers.map(reducer => (
                      <div key={reducer.id} className="relative group flex items-center">
                          <label className="text-xs pl-1 pr-1 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={selectedDimReducer === reducer.id}>
                              <input 
                                  type="radio" 
                                  name="dimReducer" 
                                  value={reducer.id}
                                  checked={selectedDimReducer === reducer.id}
                                  onChange={(e) => setSelectedDimReducer(e.target.value as ReductionMethod)}
                                  className="hidden"
                                  disabled={isProcessing || isProcessingData || isReducing}
                              />
                              {reducer.name}
                          </label>
                          <button
                              onClick={() => onShowAlgoExplanation(reducer.id)}
                              className="absolute right-0 top-1/2 -translate-y-1/2 ml-1 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-blue-300 hover:text-blue-200 border border-blue-900/50 invisible group-hover:visible disabled:opacity-50 disabled:cursor-not-allowed z-10"
                              title={`Explain ${reducer.name}`}
                          >
                              ?
                          </button>
                      </div>
                  ))}
              </div>
            </div>
            {/* Target Dimensions */}
            <div>
               <span className="text-xs block mb-1 text-gray-400">Target Dimensions:</span>
                <div className="flex gap-2">
                   <label className="text-xs px-1 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={targetDimensions === 2}>
                      <input 
                          type="radio" 
                          name="targetDimensions" 
                          value={2}
                          checked={targetDimensions === 2}
                          onChange={() => setTargetDimensions(2)}
                          className="hidden"
                           disabled={isProcessing || isReducing}
                      />
                      2D
                  </label>
                   <label className="text-xs px-1 py-1 cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={targetDimensions === 3}>
                      <input 
                          type="radio" 
                          name="targetDimensions" 
                          value={3}
                          checked={targetDimensions === 3}
                          onChange={() => setTargetDimensions(3)}
                          className="hidden"
                           disabled={isProcessing || isReducing}
                      />
                      3D
                  </label>
                </div>
            </div>
          </div>
          {/* ADDED Proceed Button - Updated Logic */}
           <button 
                onClick={handleProceedReduction}
                disabled={!canReduceDimensions}
                className={`w-full p-1 text-center font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${canReduceDimensions ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                data-augmented-ui="tl-clip br-clip border"
                style={{ '--aug-border-color': canReduceDimensions ? 'cyan' : '#555' } as React.CSSProperties}
                title={
                    !hasFeaturesForActiveSongs ? "Extract features first" :
                    !hasProcessedData ? "Process data first" :
                    isProcessing ? "Feature extraction active..." :
                    isProcessingData ? "Data processing active..." :
                    isReducing ? "Dimension reduction active..." :
                    "Run selected reduction method"
                }
            >
                {isReducing ? 'Reducing...' : `Reduce Dimensions`}
            </button>
        </div>

        {/* === K-Means Clustering === */}
         <div 
            className="mb-4 p-3 border border-gray-700/80 relative group"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
           <h3 className="text-md font-semibold mb-2 text-green-300">K-Means Clustering</h3>
           <button
               onClick={() => onShowAlgoExplanation('kmeans')}
               className="absolute top-1 right-1 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-blue-300 hover:text-blue-200 border border-blue-900/50 invisible group-hover:visible disabled:opacity-50 disabled:cursor-not-allowed z-10"
               title="Explain K-Means Clustering"
               
           >
               ?
           </button>
           <div className="flex items-center gap-3 mb-2">
             <label htmlFor="num-clusters" className="text-xs text-gray-400 flex-shrink-0">Number of Clusters (k):</label>
             <input
               id="num-clusters"
               type="number"
               value={numClusters}
               onChange={handleNumClustersChange}
               className="p-1 bg-gray-800 border border-gray-600 text-xs w-16 flex-grow"
               disabled={!hasReducedDataForActiveSongs || isProcessing || isReducing || isProcessingData}
             />
           </div>
           <button 
               onClick={() => onRunClustering(numClusters)} 
               disabled={!canInitializeCluster}
               className={`w-full p-1 text-center  font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${canInitializeCluster ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-gray-600 text-gray-400'}`}
               data-augmented-ui="tl-clip br-clip border"
               style={{ '--aug-border-color': canInitializeCluster ? 'yellow' : '#555' } as React.CSSProperties}
               title={
                  !hasFeaturesForActiveSongs ? "Extract features first" :
                  !hasProcessedData ? "Process data first" :
                  !hasReducedDataForActiveSongs ? "Reduce dimensions first" : 
                  numClusters <= 0 ? "Set k > 0" : 
                  isProcessing ? "MIR processing..." : 
                  isProcessingData ? "Processing data..." : 
                  isReducing ? "Reducing dimensions..." : 
                  isClusteringActive ? "Re-Initialize K-Means (will reset current progress)" :
                  "Initialize K-Means Clustering"
                }
           >
               {isClusteringActive ? 'Re-Initialize Clustering' : `Initialize Clustering (k=${numClusters})`}
           </button>

           {/* --- NEW: Next Step Button --- */} 
            <button
                onClick={onNextStep}
                disabled={!canRunNextStep}
                className={`w-full p-1 mt-2 text-center font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${canRunNextStep ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                data-augmented-ui="tl-clip br-clip border"
                style={{ '--aug-border-color': canRunNextStep ? 'mediumorchid' : '#555' } as React.CSSProperties}
                title={
                    !isKmeansInitialized ? "Initialize clustering first" :
                    isProcessing ? "MIR processing active..." :
                    isProcessingData ? "Data processing active..." :
                    isReducing ? "Reduction active..." :
                    "Run next K-Means step"
                }
           >
               Next Step
            </button>
         </div>
      </div>

    </div>
  );
};

export default ControlsPanel; 