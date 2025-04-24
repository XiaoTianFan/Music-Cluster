import React, { useEffect, useRef } from 'react';
import BasePanel from '@/components/ui/BasePanel';
// Import TensorSpace types if available, otherwise use any
// import * as TSP from 'tensorspace';

// Placeholder types - define MLPConfig properly in a shared location
interface MLPConfig {
    hiddenLayers: number;
    nodesPerLayer: number[];
    // Add other relevant config fields if needed by visualization
}

interface NetworkVisualizationPanelProps {
    className?: string;
    networkConfig: MLPConfig | null;
    inputDimension: number;
    outputDimension: number;
    labelNames: string[];
}

const NetworkVisualizationPanel: React.FC<NetworkVisualizationPanelProps> = ({ className, networkConfig, inputDimension, outputDimension, labelNames }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tspModelRef = useRef<any>(null); // Use 'any' if TensorSpace types aren't imported

    useEffect(() => {
        const TSP = (window as any).TSP; // Access TensorSpace globally if loaded via script
        if (!TSP || !containerRef.current || !networkConfig || inputDimension <= 0 || outputDimension <= 0) {
            // Clear previous visualization if config is invalid
            if (containerRef.current) containerRef.current.innerHTML = '';
            tspModelRef.current = null;
            return;
        }

        console.log('Attempting to build TensorSpace model structure...');

        // --- Cleanup previous model if exists ---
        // Check TensorSpace documentation for the correct way to dispose/remove a model
        // This might involve removing the canvas/svg or calling a specific dispose method.
        containerRef.current.innerHTML = ''; // Simple cleanup for now
        tspModelRef.current = null;

        try {
            // 1. Create Model Instance
            const model = new TSP.models.Sequential(containerRef.current);
            tspModelRef.current = model;

            // 2. Add Input Layer (Representing flat features)
            // Use Dense layer to represent the input size conceptually
            model.add(new TSP.layers.Dense({
                name: "Input Features",
                units: inputDimension,
                // Additional styling options if needed
            }));

            // 3. Add Hidden Layers
            networkConfig.nodesPerLayer.forEach((nodes, index) => {
                if (nodes > 0) { // Only add if nodes exist
                    model.add(new TSP.layers.Dense({
                        name: `Hidden Layer ${index + 1}`,
                        units: nodes,
                        // Add activation function indication if possible?
                    }));
                }
            });

            // 4. Add Output Layer
            model.add(new TSP.layers.Output1d({
                name: "Output Labels",
                units: outputDimension,
                outputs: labelNames, // Pass label names
                paging: outputDimension > 50, // Enable paging for many labels
                segmentLength: 50,
            }));

            // 5. Initialize Visualization (Render Structure)
            model.init();
            console.log('TensorSpace model structure initialized.');

        } catch (error: any) {
            console.error('Error building TensorSpace model:', error);
            if (containerRef.current) {
                containerRef.current.innerHTML = `<p class="text-red-500 p-4">Error initializing TensorSpace visualization: ${error.message}</p>`;
            }
            tspModelRef.current = null;
        }

        // Cleanup function (optional, might depend on TensorSpace internal handling)
        // return () => {
        //     tspModelRef.current?.dispose(); // If a dispose method exists
        // };

    }, [networkConfig, inputDimension, outputDimension, labelNames]); // Dependencies

    return (
        <BasePanel className={className} title="Network Structure (TensorSpace)">
            <div ref={containerRef} className="p-2 min-h-[250px] w-full h-full overflow-hidden relative">
                 {/* TensorSpace visualization renders here */} 
                 {(!networkConfig || inputDimension <= 0 || outputDimension <= 0) && (
                     <p className="text-center text-sm text-[var(--text-secondary)] italic p-4">
                         Configure the network in the controls panel to visualize its structure.
                     </p>
                 )}
            </div>
        </BasePanel>
    );
};

export default NetworkVisualizationPanel; 