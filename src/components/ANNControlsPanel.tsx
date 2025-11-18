// src/components/ANNControlsPanel.tsx
import React, { useState } from 'react';
import BasePanel from '@/components/ui/BasePanel';
import Button from '@/components/ui/Button';
// --- NEW: Import common form elements if available, or use native --- 
// import Input from '@/components/ui/Input'; 
// import Select from '@/components/ui/Select';
// import Checkbox from '@/components/ui/Checkbox';
// Using native elements for now
// ---------------------------------------------------------------------

// Placeholder types - Define properly later in shared location
type ProcessingMethod = 'none' | 'standardize' | 'normalize';
type ReductionMethod = 'pca' | 'tsne' | 'umap';
// --- NEW: Default MLP Config --- 
export interface MLPConfig { // Exporting for potential use in page.tsx
    hiddenLayers: number;
    nodesPerLayer: number[];
    activation: 'relu' | 'sigmoid' | 'tanh'; // Example options
    optimizer: 'adam' | 'sgd'; // Example options
    learningRate: number;
    epochs: number;
    targetLoss?: number;
    splitRatio: number;
    randomSeed?: number;
    batchSize: number;
}

export const DEFAULT_MLP_CONFIG: MLPConfig = {
    hiddenLayers: 1,
    nodesPerLayer: [16], // Default for 1 hidden layer
    activation: 'relu',
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 50,
    splitRatio: 0.8,
    batchSize: 32,
    // targetLoss: undefined,
    // randomSeed: undefined,
};
// ---------------------------

interface ANNControlsPanelProps {
    className?: string;
    // Worker Status
    essentiaWorkerReady: boolean;
    dataProcessingWorkerReady: boolean;
    druidWorkerReady: boolean;
    mlpWorkerReady: boolean;
    // Pipeline State Flags
    isExtracting: boolean;
    isProcessingData: boolean;
    isReducing: boolean;
    isTraining: boolean;
    isInferring: boolean;
    // Data Availability Flags
    canProcess: boolean;
    canReduce: boolean;
    canTrain: boolean;
    canInfer: boolean;
    // Config States & Setters
    useDimensionalityReduction: boolean;
    setUseDimensionalityReduction: (use: boolean) => void;
    networkConfig: MLPConfig | null; // Now expecting MLPConfig
    setNetworkConfig: (config: MLPConfig | null) => void;
    // Callbacks for Actions
    onExtractFeatures: (selectedFeatures: Set<string>) => void;
    onProcessData: (method: ProcessingMethod, range?: [number, number]) => void;
    onReduceDimensions: (method: ReductionMethod, dimensions: number) => void;
    onTrain: () => void;
    onInfer: () => void;
    onShowExplanation?: (id: string) => void;
    // --- NEW: Selected Features State/Callback from Parent --- 
    selectedFeatures: Set<string>; 
    onSelectedFeaturesChange: (features: Set<string>) => void;
}

// --- ADDED: Feature list from ControlsPanel.tsx --- 
const availableMirFeatures = [
  { id: 'mfcc', name: 'MFCC' }, // Represents mfccMeans, mfccStdDevs
  { id: 'energy', name: 'Aggregate Energy' },
  { id: 'entropy', name: 'ZCR Entropy' },
  { id: 'key', name: 'Key & Scale' }, // Represents key, keyScale, keyStrength
  { id: 'dynamicComplexity', name: 'Dynamic Complexity' }, // Represents dynamicComplexity, loudness
  { id: 'rms', name: 'RMS' },
  { id: 'tuningFrequency', name: 'Tuning Frequency' }, // Represents tuningFrequency
  { id: 'rhythm', name: 'BPM'}, // Represents bpm, rhythmConfidence
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
// --------------------------------------------------

// --- NEW: Helper Function for Nodes per Layer Input ---
const parseNodesPerLayer = (input: string, layerCount: number): number[] | null => {
    const parts = input.split(',').map(s => s.trim()).filter(s => s !== '');
    if (parts.length !== layerCount) return null; // Mismatch
    const numbers = parts.map(p => parseInt(p, 10));
    if (numbers.some(isNaN) || numbers.some(n => n <= 0)) return null; // Invalid number
    return numbers;
};
// -------------------------------------------------------

const ANNControlsPanel: React.FC<ANNControlsPanelProps> = ({
    className,
    essentiaWorkerReady,
    dataProcessingWorkerReady,
    druidWorkerReady,
    mlpWorkerReady,
    isExtracting,
    isProcessingData,
    isReducing,
    isTraining,
    isInferring,
    canProcess,
    canReduce,
    canTrain,
    canInfer,
    useDimensionalityReduction,
    setUseDimensionalityReduction,
    networkConfig,
    setNetworkConfig,
    onExtractFeatures,
    onProcessData,
    onReduceDimensions,
    onTrain,
    onInfer,
    onShowExplanation,
    // --- NEW: Destructure selectedFeatures props ---
    selectedFeatures,
    onSelectedFeaturesChange 
}) => {

    // --- Local State for Form Inputs --- 
    const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>('standardize');
    const [reductionMethod, setReductionMethod] = useState<ReductionMethod>('tsne');
    const [reductionDims, setReductionDims] = useState<number>(2);

    // Local state for MLP config derived from props or defaults
    const localConfig = networkConfig ?? DEFAULT_MLP_CONFIG;

    // Handler to update parent state
    const updateNetworkConfig = (key: keyof MLPConfig, value: any) => {
        // Basic type checks / conversions
        let processedValue = value;
        if (key === 'hiddenLayers' || key === 'epochs' || key === 'randomSeed') {
            processedValue = parseInt(value, 10);
            if (isNaN(processedValue)) processedValue = key === 'randomSeed' ? undefined : (key === 'hiddenLayers' ? 0 : 1);
            if (key === 'hiddenLayers') processedValue = Math.max(0, processedValue);
            if (key === 'epochs') processedValue = Math.max(1, processedValue);
        }
        if (key === 'learningRate' || key === 'splitRatio' || key === 'targetLoss') {
            processedValue = parseFloat(value);
            if (isNaN(processedValue)) processedValue = key === 'targetLoss' ? undefined : (key === 'splitRatio' ? 0.1 : 0.001);
            if (key === 'splitRatio') processedValue = Math.max(0.01, Math.min(0.99, processedValue));
        }
        if (key === 'nodesPerLayer' && typeof value === 'string') {
             const parsedNodes = parseNodesPerLayer(value, localConfig.hiddenLayers);
             if (parsedNodes) {
                 processedValue = parsedNodes;
             } else {
                 // Keep existing or default if parse fails? Or show error?
                 // For now, keep existing to avoid breaking visualization immediately
                 processedValue = localConfig.nodesPerLayer;
                 console.warn('Invalid nodes per layer input, not updating.');
             }
        }

        const newConfig = { ...localConfig, [key]: processedValue };

        // Adjust nodesPerLayer array size if hiddenLayers changes
        if (key === 'hiddenLayers') {
            const layerCount = Math.max(0, processedValue);
            if (newConfig.nodesPerLayer.length !== layerCount) {
                newConfig.nodesPerLayer = Array(layerCount).fill(16); // Default to 16 nodes
            }
        }

        setNetworkConfig(newConfig);
    };

    // --- Event Handlers --- 
    const handleExtractClick = () => { onExtractFeatures(selectedFeatures); };
    const handleProcessClick = () => { onProcessData(processingMethod); };
    const handleReduceClick = () => { onReduceDimensions(reductionMethod, reductionDims); };

    // MODIFIED: Handler for feature selection toggle buttons
    const handleFeatureToggle = (featureId: string) => {
        const newSet = new Set(selectedFeatures);
        if (newSet.has(featureId)) {
            newSet.delete(featureId);
        } else {
            newSet.add(featureId);
        }
        onSelectedFeaturesChange(newSet);
    };

    const isAnyProcessRunning = isExtracting || isProcessingData || isReducing || isTraining || isInferring;
    const areBaseWorkersReady = essentiaWorkerReady && dataProcessingWorkerReady && druidWorkerReady;

    // --- Component UI --- 
    return (
        <BasePanel
            className={`flex overflow-y-scroll hide-scrollbar flex-col h-[85vh] ${className || ''}`}
            data-augmented-ui="tl-clip tr-2-clip-x br-clip-x bl-clip border inlay"
            style={{ '--aug-border-x': '1px' } as React.CSSProperties}
        >
            <h2 className="text-xl font-semibold mb-3 text-[var(--accent-secondary)] flex-shrink-0 p-1">Controls</h2>

            {/* Scrollable area for controls */}
            <div className="flex-grow overflow-y-auto pr-1 pl-1 pb-3 hide-scrollbar space-y-4 text-base">
                {/* --- Section 1: Feature Extraction --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-lg font-semibold ml-2 mb-2 text-[var(--accent-primary)]">1. Feature Extraction</h3>
                    {/* MODIFIED to use availableMirFeatures */}
                    <div className="flex flex-wrap gap-x-1 gap-y-2 flex-grow mb-2 pr-1"> {/* REMOVED max-height and scroll */}
                        {availableMirFeatures.map(feature => (
                             <div key={feature.id} className="relative group flex items-center justify-between text-sm">
                                 <button
                                     onClick={() => handleFeatureToggle(feature.id)}
                                     className={`text-sm pr-2 pl-2 py-1 cursor-pointer border border-gray-700 hover:border-[var(--accent-primary)]/50 data-[checked=true]:bg-[var(--accent-primary)]/20 data-[checked=true]:border-[var(--accent-primary)] text-[var(--text-primary)] disabled:opacity-[var(--disabled-opacity)] disabled:cursor-not-allowed`}
                                     data-checked={selectedFeatures.has(feature.id)}
                                     disabled={isAnyProcessRunning}
                                     title={feature.name} // Use feature name for title
                                 >
                                     {feature.name} {/* Use feature name for display */}
                                 </button>
                                 {/* Optional: Add explanation button if needed 
                                 <button 
                                    onClick={() => onShowExplanation?.(feature.id)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 px-1 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-blue-900/50 invisible group-hover:visible disabled:opacity-[var(--disabled-opacity)] disabled:cursor-not-allowed z-10"
                                    title={`Explain ${feature.name}`}
                                    disabled={isAnyProcessRunning}
                                >
                                ?
                                </button> */}
                            </div>
                        ))}
                    </div>
                     {/* ADDED Select All / Clear Buttons */} 
                     <div className="flex gap-2 mt-2 mb-1">
                         <Button
                             onClick={() => {
                                 // MODIFIED to use availableMirFeatures
                                 const allFeatureIds = new Set(availableMirFeatures.map(f => f.id));
                                 onSelectedFeaturesChange(allFeatureIds);
                             }}
                             disabled={isAnyProcessRunning}
                             variant="secondary"
                             className="px-4 py-0.5 text-sm"
                             title="Select all available features"
                         >
                             All
                         </Button>
                         <Button
                             onClick={() => onSelectedFeaturesChange(new Set())}
                             disabled={isAnyProcessRunning || selectedFeatures.size === 0}
                             variant="secondary"
                             className="px-4 py-0.5 text-sm"
                             title="Clear feature selection"
                         >
                             Clear
                         </Button>
                    </div>
                    <Button
                        onClick={handleExtractClick}
                        disabled={isAnyProcessRunning || !essentiaWorkerReady || selectedFeatures.size === 0}
                        className="w-full text-base py-1 mt-2"
                        variant="primary" // Match ControlsPanel button style
                        enableTilt={true} // Match ControlsPanel button style
                    >
                        {isExtracting ? 'Processing...' : `Extract Features`}
                    </Button>
                </div>

                {/* --- Section 2: Data Processing --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-lg font-semibold ml-2 mb-2 text-[var(--accent-primary)]">2. Data Processing</h3>
                    {/* REPLACED dropdown with radio labels */}
                    <div className="mb-2">
                         <span className="text-sm block mb-1 text-[var(--text-secondary)]">Method:</span>
                         <div className="flex gap-2 flex-wrap">
                             {['standardize', 'normalize', 'none'].map(method => (
                                 <div key={method} className="relative group flex items-center">
                                     <label className="text-sm pl-1 py-1 cursor-pointer border border-gray-700 hover:border-[var(--accent-primary)]/50 data-[checked=true]:bg-[var(--accent-primary)]/20 data-[checked=true]:border-[var(--accent-primary)]" data-checked={processingMethod === method}>
                                         <input
                                             type="radio"
                                             name="processingMethod"
                                             value={method}
                                             checked={processingMethod === method}
                                             onChange={(e) => setProcessingMethod(e.target.value as ProcessingMethod)}
                                             className="hidden"
                                             disabled={isAnyProcessRunning || !dataProcessingWorkerReady || !canProcess}
                                         />
                                         {method === 'standardize' ? 'Standardize' : (method === 'normalize' ? 'Normalize (0-1)' : 'None')}
                                     </label>
                                     {/* Optional: Add explanation button */}
                                 </div>
                             ))}
                         </div>
                    </div>
                    <Button
                        onClick={handleProcessClick}
                        disabled={isAnyProcessRunning || !dataProcessingWorkerReady || !canProcess}
                        className="w-full text-base py-1"
                        variant="primary" // Match ControlsPanel button style
                        enableTilt={true} // Match ControlsPanel button style
                    >
                        {isProcessingData ? 'Processing...' : `Process Data`}
                    </Button>
                </div>

                {/* --- Section 3: Dimensionality Reduction --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-lg font-semibold ml-2 mb-2 text-[var(--accent-primary)]">3. Dim. Reduction</h3>
                    <div className="flex items-center mb-2 text-sm">
                        <input
                            type="checkbox"
                            id="useDimReduction"
                            checked={useDimensionalityReduction}
                            onChange={(e) => setUseDimensionalityReduction(e.target.checked)}
                            disabled={isAnyProcessRunning}
                            className="mr-2 h-4 w-4 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] bg-transparent"
                        />
                        <label htmlFor="useDimReduction" className="text-sm">Use before training?</label>
                        <span
                            title="Apply dimensionality reduction (e.g., t-SNE) to the processed data before feeding it into the neural network."
                            className="ml-1 cursor-help text-[var(--text-secondary)] hover:text-[var(--accent-primary)] text-sm"
                            onClick={() => onShowExplanation?.('ann-dim-reduction')}
                        >
                            (?) {/* Simple explanation trigger */}
                        </span>
                    </div>
                    {useDimensionalityReduction && (
                        <div className="space-y-2 pl-3 border-l border-[var(--foreground)]/30 ml-1">
                            <div>
                                <label htmlFor="reductionMethod" className="block text-sm mb-1">Method:</label>
                                <select
                                    id="reductionMethod"
                                    value={reductionMethod}
                                    onChange={(e) => setReductionMethod(e.target.value as ReductionMethod)}
                                    disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                    className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm"
                                >
                                    <option value="tsne">t-SNE</option>
                                    <option value="umap">UMAP</option>
                                    <option value="pca">PCA</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="reductionDims" className="block text-sm mb-1">Dimensions:</label>
                                <select
                                    id="reductionDims"
                                    value={reductionDims}
                                    onChange={(e) => setReductionDims(parseInt(e.target.value, 10))}
                                    disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                    className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm"
                                >
                                    <option value={2}>2D</option>
                                    <option value={3}>3D</option>
                                </select>
                            </div>
                            <Button
                                onClick={handleReduceClick}
                                disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                className="w-full text-base py-1 mt-1"
                                variant="secondary" // Match ControlsPanel button style
                                enableTilt={true} // Match ControlsPanel button style
                            >
                                Reduce Dimensions
                            </Button>
                        </div>
                    )}
                </div>

                {/* --- Section 4: MLP Configuration --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-lg font-semibold ml-2 mb-2 text-[var(--accent-primary)]">4. MLP Configuration</h3>
                    <div className="space-y-1.5 text-sm">
                        {/* Row 1: Hidden Layers & Nodes */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="hiddenLayers" className="block text-sm mb-0.5">Hidden Layers:</label>
                                <input type="number" id="hiddenLayers" value={localConfig.hiddenLayers} onChange={e => updateNetworkConfig('hiddenLayers', e.target.value)} min="0" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="nodesPerLayer" className="block text-sm mb-0.5">Nodes (csv):</label>
                                <input type="text" id="nodesPerLayer" value={localConfig.nodesPerLayer.join(', ')} onChange={e => updateNetworkConfig('nodesPerLayer', e.target.value)} placeholder="e.g., 16, 8" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning || localConfig.hiddenLayers === 0}/>
                            </div>
                        </div>
                        {/* Row 2: Activation & Optimizer */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="activation" className="block text-sm mb-0.5">Activation:</label>
                                <select id="activation" value={localConfig.activation} onChange={e => updateNetworkConfig('activation', e.target.value)} className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}>
                                    <option value="relu">ReLU</option>
                                    <option value="sigmoid">Sigmoid</option>
                                    <option value="tanh">Tanh</option>
                                </select>
                             </div>
                             <div>
                                <label htmlFor="optimizer" className="block text-sm mb-0.5">Optimizer:</label>
                                <select id="optimizer" value={localConfig.optimizer} onChange={e => updateNetworkConfig('optimizer', e.target.value)} className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}>
                                     <option value="adam">Adam</option>
                                     <option value="sgd">SGD</option>
                                 </select>
                            </div>
                        </div>
                         {/* Row 3: Learning Rate & Epochs */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="learningRate" className="block text-sm mb-0.5">Learn Rate:</label>
                                <input type="number" id="learningRate" value={localConfig.learningRate} onChange={e => updateNetworkConfig('learningRate', e.target.value)} step="0.0001" min="0.00001" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}/>
                            </div>
                             <div>
                                <label htmlFor="epochs" className="block text-sm mb-0.5">Max Epochs:</label>
                                <input type="number" id="epochs" value={localConfig.epochs} onChange={e => updateNetworkConfig('epochs', e.target.value)} min="1" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Row 4: Split Ratio & Seed */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="splitRatio" className="block text-sm mb-0.5">Train Split (%):</label>
                                <input type="number" id="splitRatio" value={localConfig.splitRatio * 100} onChange={e => updateNetworkConfig('splitRatio', parseFloat(e.target.value) / 100)} min="1" max="99" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="randomSeed" className="block text-sm mb-0.5">Seed (opt.):</label>
                                <input type="number" id="randomSeed" value={localConfig.randomSeed ?? ''} onChange={e => updateNetworkConfig('randomSeed', e.target.value === '' ? undefined : e.target.value)} placeholder="Optional" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-sm" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Optional: Target Loss */} 
                        {/* <div>
                             <label htmlFor="targetLoss" className="block text-xs mb-0.5">Target Loss (opt.):</label>
                             <input type="number" id="targetLoss" value={localConfig.targetLoss ?? ''} onChange={e => updateNetworkConfig('targetLoss', e.target.value === '' ? undefined : e.target.value)} step="0.001" placeholder="e.g., 0.05" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                         </div> */} 
                    </div>
                </div>

                {/* --- Section 5: Train & Infer --- */}
                <div 
                    className="mb-4 p-3 flex flex-col" 
                    data-augmented-ui="tl-clip br-clip border" 
                    style={{ '--aug-border-bg': 'var(--foreground)', 
                        '--aug-border-all': '1px', 
                        '--aug-border-y': '2px' } as React.CSSProperties}
                >
                    <h3 className="text-lg font-semibold ml-2 mb-2 text-[var(--accent-primary)]">5. Train & Infer</h3>
                    <div className="space-y-2">
                         <Button
                            onClick={onTrain}
                            disabled={isAnyProcessRunning || !mlpWorkerReady || !canTrain}
                            className="w-full font-semibold text-base py-1.5" // Ensured text-sm
                            variant="primary"
                             enableTilt={true}
                        >
                            {isTraining ? 'Training...' : 'Train Network'}
                        </Button>
                         <Button
                            onClick={onInfer}
                            disabled={isAnyProcessRunning || !mlpWorkerReady || !canInfer}
                            className="w-full font-semibold text-base py-1.5" // Ensured text-sm
                            variant="primary"
                             enableTilt={true}
                        >
                            {isInferring ? 'Inferring...' : 'Infer Labels'}
                        </Button>
                    </div>
                </div>

            </div>
        </BasePanel>
    );
};

export default ANNControlsPanel; 