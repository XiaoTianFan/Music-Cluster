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

    // Handler for placeholder feature selection change
    const handleFeatureCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.target;
        const newSet = new Set(selectedFeatures);
        if (checked) {
            newSet.add(value);
        } else {
            newSet.delete(value);
        }
        onSelectedFeaturesChange(newSet);
    };

    const isAnyProcessRunning = isExtracting || isProcessingData || isReducing || isTraining || isInferring;
    const areBaseWorkersReady = essentiaWorkerReady && dataProcessingWorkerReady && druidWorkerReady;

    // --- Component UI --- 
    return (
        <BasePanel className={`${className} flex flex-col`} title="ANN Controls">
            <div className="flex-grow overflow-y-auto p-3 space-y-4 text-sm"> {/* Reduced base text size */}

                {/* Status Indicator */}
                <div className="text-xs text-center mb-2 sticky top-0 bg-[var(--background-augmented)] py-1 z-10"> {/* Make status sticky */}
                    {!essentiaWorkerReady && <span className="text-red-500 font-bold block">Essentia Worker Error!</span>}
                    {!dataProcessingWorkerReady && <span className="text-red-500 font-bold block">DataProc Worker Error!</span>}
                    {!druidWorkerReady && <span className="text-red-500 font-bold block">Druid Worker Error!</span>}
                    {!mlpWorkerReady && <span className="text-red-500 font-bold block">MLP Worker Error!</span>}
                    {areBaseWorkersReady && mlpWorkerReady && !isAnyProcessRunning && <span className="text-green-400">Ready</span>}
                    {isExtracting && <span className="animate-pulse">Extracting Features...</span>}
                    {isProcessingData && <span className="animate-pulse">Processing Data...</span>}
                    {isReducing && <span className="animate-pulse">Reducing Dimensions...</span>}
                    {isTraining && <span className="animate-pulse">Training Network...</span>}
                    {isInferring && <span className="animate-pulse">Inferring Labels...</span>}
                </div>

                {/* --- Section 1: Feature Extraction --- */}
                <section data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" className="p-3">
                    <h3 className="text-md font-semibold mb-2 border-b border-[var(--foreground)]/30 pb-1">1. Feature Extraction</h3>
                    {/* Placeholder for feature selection checkboxes */}
                    <div className="mb-2 space-y-1 text-xs max-h-24 overflow-y-auto pr-1">
                        <p className="text-[var(--text-secondary)] italic text-xs mb-1">Select features:</p>
                        {/* Example - replace with actual dynamic checkboxes based on available features */} 
                        {['mfccMeans', 'mfccStdDevs', 'energy', 'entropy', 'bpm', 'loudness', 'key', 'keyScale'].map(f => (
                             <div key={f} className="flex items-center">
                                 <input
                                     type="checkbox"
                                     id={`feature-${f}`}
                                     value={f}
                                     checked={selectedFeatures.has(f)}
                                     onChange={handleFeatureCheckboxChange}
                                     className="mr-1.5 h-3 w-3 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] bg-transparent"
                                     disabled={isAnyProcessRunning} // Disable during any operation
                                 />
                                 <label htmlFor={`feature-${f}`} className="text-xs select-none">{f}</label>
                             </div>
                        ))}
                    </div>
                    <Button
                        onClick={handleExtractClick}
                        disabled={isAnyProcessRunning || !essentiaWorkerReady || selectedFeatures.size === 0}
                        className="w-full text-sm py-1"
                    >
                        Extract Features
                    </Button>
                </section>

                {/* --- Section 2: Data Processing --- */}
                <section data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" className="p-3">
                    <h3 className="text-md font-semibold mb-2 border-b border-[var(--foreground)]/30 pb-1">2. Data Processing</h3>
                    <div className="mb-2">
                        <label htmlFor="processingMethod" className="block text-xs mb-1">Scaling Method:</label>
                        <select
                            id="processingMethod"
                            value={processingMethod}
                            onChange={(e) => setProcessingMethod(e.target.value as ProcessingMethod)}
                            disabled={isAnyProcessRunning || !dataProcessingWorkerReady || !canProcess}
                            className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs"
                        >
                            <option value="standardize">Standardize</option>
                            <option value="normalize">Normalize (0-1)</option>
                            <option value="none">None</option>
                        </select>
                    </div>
                    <Button
                        onClick={handleProcessClick}
                        disabled={isAnyProcessRunning || !dataProcessingWorkerReady || !canProcess}
                        className="w-full text-sm py-1"
                    >
                        Process Data
                    </Button>
                </section>

                {/* --- Section 3: Dimensionality Reduction --- */}
                <section data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" className="p-3">
                    <h3 className="text-md font-semibold mb-1 border-b border-[var(--foreground)]/30 pb-1">3. Dim. Reduction</h3>
                    <div className="flex items-center mb-2">
                        <input
                            type="checkbox"
                            id="useDimReduction"
                            checked={useDimensionalityReduction}
                            onChange={(e) => setUseDimensionalityReduction(e.target.checked)}
                            disabled={isAnyProcessRunning}
                            className="mr-2 h-4 w-4 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] bg-transparent"
                        />
                        <label htmlFor="useDimReduction" className="text-xs">Use before training?</label>
                        <span
                            title="Apply dimensionality reduction (e.g., t-SNE) to the processed data before feeding it into the neural network."
                            className="ml-1 cursor-help text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                            onClick={() => onShowExplanation?.('ann-dim-reduction')}
                        >
                            (?) {/* Simple explanation trigger */}
                        </span>
                    </div>
                    {useDimensionalityReduction && (
                        <div className="space-y-2 pl-3 border-l border-[var(--foreground)]/30 ml-1">
                            <div>
                                <label htmlFor="reductionMethod" className="block text-xs mb-1">Method:</label>
                                <select
                                    id="reductionMethod"
                                    value={reductionMethod}
                                    onChange={(e) => setReductionMethod(e.target.value as ReductionMethod)}
                                    disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                    className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs"
                                >
                                    <option value="tsne">t-SNE</option>
                                    <option value="umap">UMAP</option>
                                    <option value="pca">PCA</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="reductionDims" className="block text-xs mb-1">Dimensions:</label>
                                <select
                                    id="reductionDims"
                                    value={reductionDims}
                                    onChange={(e) => setReductionDims(parseInt(e.target.value, 10))}
                                    disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                    className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-1 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs"
                                >
                                    <option value={2}>2D</option>
                                    <option value={3}>3D</option>
                                </select>
                            </div>
                            <Button
                                onClick={handleReduceClick}
                                disabled={isAnyProcessRunning || !druidWorkerReady || !canReduce}
                                className="w-full text-sm py-1 mt-1"
                                variant="secondary"
                            >
                                Reduce Dimensions
                            </Button>
                        </div>
                    )}
                </section>

                {/* --- Section 4: MLP Configuration --- */}
                <section data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" className="p-3">
                    <h3 className="text-md font-semibold mb-2 border-b border-[var(--foreground)]/30 pb-1">4. MLP Configuration</h3>
                    <div className="space-y-1.5">
                        {/* Row 1: Hidden Layers & Nodes */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="hiddenLayers" className="block text-xs mb-0.5">Hidden Layers:</label>
                                <input type="number" id="hiddenLayers" value={localConfig.hiddenLayers} onChange={e => updateNetworkConfig('hiddenLayers', e.target.value)} min="0" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="nodesPerLayer" className="block text-xs mb-0.5">Nodes (csv):</label>
                                <input type="text" id="nodesPerLayer" value={localConfig.nodesPerLayer.join(', ')} onChange={e => updateNetworkConfig('nodesPerLayer', e.target.value)} placeholder="e.g., 16, 8" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning || localConfig.hiddenLayers === 0}/>
                            </div>
                        </div>
                        {/* Row 2: Activation & Optimizer */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="activation" className="block text-xs mb-0.5">Activation:</label>
                                <select id="activation" value={localConfig.activation} onChange={e => updateNetworkConfig('activation', e.target.value)} className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}>
                                    <option value="relu">ReLU</option>
                                    <option value="sigmoid">Sigmoid</option>
                                    <option value="tanh">Tanh</option>
                                </select>
                             </div>
                             <div>
                                <label htmlFor="optimizer" className="block text-xs mb-0.5">Optimizer:</label>
                                <select id="optimizer" value={localConfig.optimizer} onChange={e => updateNetworkConfig('optimizer', e.target.value)} className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}>
                                     <option value="adam">Adam</option>
                                     <option value="sgd">SGD</option>
                                 </select>
                            </div>
                        </div>
                         {/* Row 3: Learning Rate & Epochs */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="learningRate" className="block text-xs mb-0.5">Learn Rate:</label>
                                <input type="number" id="learningRate" value={localConfig.learningRate} onChange={e => updateNetworkConfig('learningRate', e.target.value)} step="0.0001" min="0.00001" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                             <div>
                                <label htmlFor="epochs" className="block text-xs mb-0.5">Max Epochs:</label>
                                <input type="number" id="epochs" value={localConfig.epochs} onChange={e => updateNetworkConfig('epochs', e.target.value)} min="1" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Row 4: Split Ratio & Seed */} 
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label htmlFor="splitRatio" className="block text-xs mb-0.5">Train Split (%):</label>
                                <input type="number" id="splitRatio" value={localConfig.splitRatio * 100} onChange={e => updateNetworkConfig('splitRatio', parseFloat(e.target.value) / 100)} min="1" max="99" step="1" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                            <div>
                                <label htmlFor="randomSeed" className="block text-xs mb-0.5">Seed (opt.):</label>
                                <input type="number" id="randomSeed" value={localConfig.randomSeed ?? ''} onChange={e => updateNetworkConfig('randomSeed', e.target.value === '' ? undefined : e.target.value)} placeholder="Optional" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                            </div>
                        </div>
                        {/* Optional: Target Loss */} 
                        {/* <div>
                             <label htmlFor="targetLoss" className="block text-xs mb-0.5">Target Loss (opt.):</label>
                             <input type="number" id="targetLoss" value={localConfig.targetLoss ?? ''} onChange={e => updateNetworkConfig('targetLoss', e.target.value === '' ? undefined : e.target.value)} step="0.001" placeholder="e.g., 0.05" className="w-full bg-transparent border border-[var(--foreground)]/50 px-2 py-0.5 rounded focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none text-xs" disabled={isAnyProcessRunning}/>
                         </div> */} 
                    </div>
                </section>

                {/* --- Section 5: Train & Infer --- */}
                <section data-augmented-ui="tl-clip tr-clip br-clip bl-clip border" className="p-3">
                    <h3 className="text-md font-semibold mb-2 border-b border-[var(--foreground)]/30 pb-1">5. Train & Infer</h3>
                    <div className="space-y-2">
                         <Button
                            onClick={onTrain}
                            disabled={isAnyProcessRunning || !mlpWorkerReady || !canTrain}
                            className="w-full font-semibold bg-green-600 hover:bg-green-500 disabled:bg-green-600/30 text-sm py-1.5"
                            variant="primary"
                        >
                            {isTraining ? 'Training...' : 'Train Network'}
                        </Button>
                         <Button
                            onClick={onInfer}
                            disabled={isAnyProcessRunning || !mlpWorkerReady || !canInfer}
                            className="w-full font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 text-sm py-1.5"
                            variant="primary"
                        >
                            {isInferring ? 'Inferring...' : 'Infer Labels'}
                        </Button>
                    </div>
                </section>

            </div>
        </BasePanel>
    );
};

export default ANNControlsPanel; 