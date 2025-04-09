import React, { useState } from 'react';

// Define props based on analysis of page.tsx
interface ControlsPanelProps {
  isProcessing: boolean; // True if MIR extraction is running
  isReducing: boolean; // True if dimensionality reduction is running
  essentiaWorkerReady: boolean;
  activeSongCount: number;
  // Check if *any* of the active songs have successfully computed features
  hasFeaturesForActiveSongs: boolean; 
  onExtractFeatures: (selectedFeatures: Set<string>) => void;
  // Type for the reduction method, mirroring page.tsx
  onReduceDimensions: (method: 'pca' | 'tsne' | 'umap', dimensions: number, params?: any) => void;
  className?: string; // Allow passing className for layout adjustments
}

// Placeholder for available MIR features
const availableMirFeatures = [
  { id: 'mfcc', name: 'MFCC' },
  { id: 'energy', name: 'Energy' },
  { id: 'entropy', name: 'Entropy' },
  { id: 'key', name: 'Key' },
  // { id: 'loudness', name: 'Loudness (EBU R128)' }, // Removed Loudness
  { id: 'dynamicComplexity', name: 'Dynamic Complexity' },
  // { id: 'onsetRate', name: 'Onset Rate' }, // Removed Onset Rate
  { id: 'rms', name: 'RMS' },
  { id: 'tuningFrequency', name: 'Tuning Frequency (Slow)' },
  // { id: 'spectral_centroid', name: 'Spectral Centroid' },
  // { id: 'spectral_flux', name: 'Spectral Flux' },
];

// Placeholder for available Dim Reduction algorithms
const availableDimReducers = [
  { id: 'pca', name: 'PCA' },
  { id: 'tsne', name: 't-SNE' },
  { id: 'umap', name: 'UMAP' },
];

const ControlsPanel: React.FC<ControlsPanelProps> = ({ 
  isProcessing,
  isReducing,
  essentiaWorkerReady,
  activeSongCount,
  hasFeaturesForActiveSongs,
  onExtractFeatures,
  onReduceDimensions,
  className 
}) => {
  // State for selected controls
  const [selectedMirFeatures, setSelectedMirFeatures] = useState<Set<string>>(() => new Set(['mfcc'])); // Default MFCC
  const [selectedDimReducer, setSelectedDimReducer] = useState<'pca' | 'tsne' | 'umap'>('tsne'); // Default t-SNE, use specific type
  const [targetDimensions, setTargetDimensions] = useState<number>(2); // Default 2D
  const [numClusters, setNumClusters] = useState<number>(3); // Default k=3

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
    if (!isNaN(value) && value > 0) {
        setNumClusters(value);
    } else if (e.target.value === '') {
        setNumClusters(1); // Or handle empty input case as needed
    }
  };

  // Handler to trigger dimension reduction
  const handleProceedReduction = () => {
    // TODO: Add logic here later to gather method-specific parameters if needed (e.g., perplexity)
    const params = {}; // Placeholder for extra parameters
    onReduceDimensions(selectedDimReducer, targetDimensions, params);
  };

  // Determine if the reduction button should be enabled
  const canReduce = !isProcessing && !isReducing && activeSongCount > 0 && hasFeaturesForActiveSongs;

  return (
    <div
      className={`p-4 border border-green-500 flex flex-col ${className || ''}`}
      data-augmented-ui="tl-round tr-clip br-clip-x bl-clip border"
      style={{ '--aug-border-color': 'lime' } as React.CSSProperties}
    >
      <h2 className="text-lg font-semibold mb-3 text-green-400 flex-shrink-0">Controls</h2>

      {/* Scrollable area for controls */}
      <div className="flex-grow overflow-y-auto pr-1">
        {/* === MIR Feature Selection === */}
        <div 
            className="mb-4 p-3 border border-gray-700/80 flex flex-col"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
          <h3 className="text-md font-semibold mb-2 text-green-300">MIR Features</h3>
          <div className="space-y-1 flex-grow">
            {availableMirFeatures.map(feature => (
              <label key={feature.id} className="flex items-center text-xs cursor-pointer">
                <input 
                  type="checkbox"
                  checked={selectedMirFeatures.has(feature.id)}
                  onChange={() => handleMirFeatureToggle(feature.id)}
                  className="mr-2 accent-green-500 cursor-pointer"
                  disabled={isProcessing}
                />
                {feature.name}
              </label>
            ))}
             {/* Add more features later */}
          </div>
          <div className="mt-3 flex-shrink-0">
             <button
                onClick={() => onExtractFeatures(selectedMirFeatures)}
                disabled={!essentiaWorkerReady || isProcessing || activeSongCount === 0 || selectedMirFeatures.size === 0}
                className={`w-full p-2 text-center rounded font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${(essentiaWorkerReady && !isProcessing && activeSongCount > 0 && selectedMirFeatures.size > 0) ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400'}`}
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

        {/* === Dimensionality Reduction === */}
         <div 
            className="mb-4 p-3 border border-gray-700/80"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
          <h3 className="text-md font-semibold mb-2 text-green-300">Dimensionality Reduction</h3>
          {/* Combined Algorithm and Dimensions Selection */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3 items-start">
            {/* Algorithm Selection */}
            <div >
               <span className="text-xs block mb-1 text-gray-400">Algorithm:</span>
               <div className="flex gap-2 flex-wrap">
                  {availableDimReducers.map(reducer => (
                      <label key={reducer.id} className="text-xs px-2 py-1 rounded cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={selectedDimReducer === reducer.id}>
                          <input 
                              type="radio" 
                              name="dimReducer" 
                              value={reducer.id}
                              checked={selectedDimReducer === reducer.id}
                              onChange={(e) => setSelectedDimReducer(e.target.value as 'pca' | 'tsne' | 'umap')}
                              className="hidden" // Style the label instead
                               disabled={isProcessing || isReducing}
                          />
                          {reducer.name}
                      </label>
                  ))}
              </div>
            </div>
            {/* Target Dimensions */}
            <div>
               <span className="text-xs block mb-1 text-gray-400">Target Dimensions:</span>
                <div className="flex gap-2">
                   <label className="text-xs px-2 py-1 rounded cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={targetDimensions === 2}>
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
                   <label className="text-xs px-2 py-1 rounded cursor-pointer border border-transparent hover:border-green-500/50 data-[checked=true]:bg-green-800/50 data-[checked=true]:border-green-600" data-checked={targetDimensions === 3}>
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
                onClick={handleProceedReduction} // Wire up the handler
                disabled={!canReduce} // Use the calculated enabled state
                className={`w-full p-1 text-center rounded font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed ${canReduce ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                data-augmented-ui="tl-clip br-clip border"
                style={{ '--aug-border-color': canReduce ? 'cyan' : '#555' } as React.CSSProperties}
                title={
                    isProcessing ? "MIR extraction in progress..." :
                    isReducing ? "Dimension reduction in progress..." :
                    activeSongCount === 0 ? "Select songs first" :
                    !hasFeaturesForActiveSongs ? "Extract MIR features first" :
                    `Reduce dimensions using ${selectedDimReducer.toUpperCase()} to ${targetDimensions}D`
                }
            >
                {isReducing ? 'Reducing...' : 'Reduce Dimensions'}
            </button>
        </div>

        {/* === Clustering === */}
         <div 
            className="mb-4 p-3 border border-gray-700/80"
            data-augmented-ui="tl-clip br-clip border"
            style={{ '--aug-border-color': '#555' } as React.CSSProperties} >
          <h3 className="text-md font-semibold mb-2 text-green-300">K-Means Clustering</h3>
            <div className="mb-2">
                <label htmlFor="numClusters" className="text-xs block mb-1 text-gray-400">Number of Clusters (k):</label>
                <input 
                    type="number"
                    id="numClusters"
                    value={numClusters}
                    onChange={handleNumClustersChange}
                    min="1"
                    step="1"
                    className="w-20 p-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
                     disabled={isProcessing || isReducing}
                />
            </div>
            {/* ADDED Button Row */}
            <div className="flex gap-2 mt-2">
                 <button 
                    // onClick={handleResetClustering} // Add handler later
                    disabled={isProcessing || isReducing}
                    className="flex-1 p-1 text-center rounded font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"
                    title="Reset Clustering (Not Implemented)"
                 >
                    Reset
                 </button>
                <button 
                    // onClick={handleNextIteration} // Add handler later
                    disabled={isProcessing || isReducing}
                    className="flex-1 p-1 text-center rounded font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 text-gray-400"
                    data-augmented-ui="tl-clip br-clip border"
                    style={{ '--aug-border-color': '#555' } as React.CSSProperties}
                    title="Next Iteration (Not Implemented)"
                >
                    Next Iteration
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ControlsPanel; 