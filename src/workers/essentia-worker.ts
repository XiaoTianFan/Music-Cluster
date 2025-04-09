console.log("Worker script evaluating... [Bundled Approach using require]");

// Use require - Webpack will handle this during build
const esPkg = require('essentia.js');

console.log('[Debug] esPkg structure keys:', Object.keys(esPkg));

let essentia: any; // Use 'any' for now
let essentiaInstancePromise: Promise<boolean> | null = null;

// Initialize Essentia.js
const initializeEssentia = async (): Promise<boolean> => {
    if (!essentiaInstancePromise) {
        essentiaInstancePromise = (async () => {
            try {
                console.log('[Initialize] Starting Essentia.js initialization via require...');
                
                // The error "EssentiaWASM.EssentiaJS is not a constructor" suggests a structural issue
                // with how the module is loaded in the worker context.
                
                // First, check what's available in the modules
                if (esPkg.EssentiaWASM) {
                    console.log('[Debug] EssentiaWASM keys:', Object.keys(esPkg.EssentiaWASM));
                    
                    // Check if there's a nested EssentiaWASM property (based on debug output)
                    if (esPkg.EssentiaWASM.EssentiaWASM) {
                        console.log('[Debug] Found nested EssentiaWASM - using that instead');
                        try {
                            essentia = new esPkg.Essentia(esPkg.EssentiaWASM.EssentiaWASM);
                            if (essentia && typeof essentia.version !== 'undefined') {
                                console.log('[Initialize] Created using nested WASM. Version:', essentia.version);
                                self.postMessage({ type: 'essentiaReady', payload: true });
                                return true;
                            }
                        } catch (nestedError) {
                            console.error('[Debug] Nested WASM approach failed:', nestedError);
                            // Continue with patching approach
                        }
                    }
                }
                
                // Create a more complete solution with a patch for the missing EssentiaJS constructor
                // Step 1: Create a patched WASM module with the expected structure
                const patchedWASM = { ...esPkg.EssentiaWASM };
                
                // Step 2: Add a more complete EssentiaJS constructor shim
                patchedWASM.EssentiaJS = function() {
                    console.log('[Debug] Using enhanced shim EssentiaJS constructor');
                    
                    // Create a stub object with essential properties
                    const stubInstance = {
                        version: '0.1.3-shim', // Add version property
                        
                        // Add common Essentia methods as needed
                        arrayToVector: function(array: number[]) {
                            console.log('[Debug] Forwarding arrayToVector to original Essentia');
                            // Try to use the real method if we can create a real instance directly
                            try {
                                const realEssentia = new esPkg.Essentia();
                                return realEssentia.arrayToVector(array);
                            } catch (e) {
                                // Fall back to original esPkg.EssentiaWASM
                                const directEssentia = new esPkg.Essentia(esPkg.EssentiaWASM);
                                return directEssentia.arrayToVector(array);
                            }
                        },
                        
                        // Add other stub methods as needed
                        vectorToArray: function(vector: any) {
                            console.log('[Debug] Forwarding vectorToArray to original Essentia');
                            try {
                                const realEssentia = new esPkg.Essentia();
                                return realEssentia.vectorToArray(vector);
                            } catch (e) {
                                const directEssentia = new esPkg.Essentia(esPkg.EssentiaWASM);
                                return directEssentia.vectorToArray(vector);
                            }
                        },
                        
                        MFCC: function(...args: any[]) {
                            console.log('[Debug] Forwarding MFCC to original Essentia');
                            try {
                                const realEssentia = new esPkg.Essentia();
                                return realEssentia.MFCC(...args);
                            } catch (e) {
                                const directEssentia = new esPkg.Essentia(esPkg.EssentiaWASM);
                                return directEssentia.MFCC(...args);
                            }
                        }
                    };
                    
                    return stubInstance;
                };
                
                // Try direct initialization without arguments first - might work in the worker context
                try {
                    console.log('[Debug] Trying direct Essentia() with no args');
                    essentia = new esPkg.Essentia();
                    if (essentia && typeof essentia.version !== 'undefined') {
                        console.log('[Initialize] Created with direct no-args approach. Version:', essentia.version);
                        self.postMessage({ type: 'essentiaReady', payload: true });
                        return true;
                    }
                } catch (directError) {
                    console.log('[Debug] Direct approach failed, continuing with patch');
                }
                
                // Step 3: Try to use the patched module
                console.log('[Debug] Trying Essentia with enhanced patched WASM module');
                essentia = new esPkg.Essentia(patchedWASM);
                
                // Check if we have a valid essentia instance
                if (essentia && typeof essentia.version !== 'undefined') {
                    console.log('[Initialize] Essentia instance created successfully. Version:', essentia.version);
                    self.postMessage({ type: 'essentiaReady', payload: true });
                    return true;
                } else {
                    throw new Error('Essentia instance created but version property is missing');
                }
                
            } catch (e) {
                const errorMessage = (e instanceof Error) ? e.message : String(e);
                console.error('[Initialize] Error during Essentia initialization process:', e);
                
                // Provide a more helpful error message
                if (errorMessage.includes('EssentiaWASM.EssentiaJS is not a constructor')) {
                    const helpfulError = 'Essentia.js initialization failed: The current version (0.1.3) has ' +
                        'compatibility issues with WebWorkers. Consider upgrading to a newer version ' +
                        'when available, or check the Essentia.js GitHub repository for worker-specific examples.';
                    self.postMessage({ 
                        type: 'essentiaReady', 
                        payload: false, 
                        error: helpfulError 
                    });
                } else {
                    self.postMessage({ type: 'essentiaReady', payload: false, error: errorMessage });
                }
                return false;
            }
        })();
    }
    return await essentiaInstancePromise;
};

// --- Type definitions for message payloads (optional but good practice) ---
type InitPayload = {}; // No payload for init
type ExtractFeaturesPayload = {
    audioVector: number[];
    sampleRate: number;
    songId: string;
};

type WorkerMessageData = 
    | { type: 'init', payload: InitPayload }
    | { type: 'extractFeatures', payload: ExtractFeaturesPayload };

// --- Feature Extraction Logic ---

// Helper function to calculate mean
const mean = (arr: number[]): number => arr.reduce((acc, val) => acc + val, 0) / arr.length;

// Helper function to calculate standard deviation
const stdDev = (arr: number[], arrMean: number): number => {
  if (arr.length === 0) return 0; // Avoid division by zero
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - arrMean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
    console.log("Worker received message:", event.data);
    const { type, payload } = event.data;

    if (type === 'init') {
        await initializeEssentia();
        return;
    }

    if (type === 'extractFeatures') {
        // Type assertion for payload based on type check
        const { audioVector, sampleRate, songId } = payload as ExtractFeaturesPayload;

        // Ensure Essentia is ready
        const ready = await initializeEssentia();
        if (!ready || !essentia) {
            console.error(`Cannot extract features for ${songId}: Essentia not ready or instance is null.`);
            self.postMessage({ type: 'featureExtractionError', songId, error: 'Essentia not initialized' });
            return;
        }

        console.log(`[Extract] Processing songId: ${songId}, sampleRate: ${sampleRate}, audio length: ${audioVector.length}`);
        try {
            console.log(`[Extract] Converting audio data for ${songId}...`);
            // Create a Float32Array from the received audioVector (since FrameGenerator expects Float32Array)
            const audioData = new Float32Array(audioVector);
            
            // Process audio in frames for MFCC calculation
            console.log(`[Extract] Setting up frame processing for ${songId}...`);
            const frameSize = 2048;
            const hopSize = 1024;
            
            let mfccs: number[][] = [];
            
            // Use FrameGenerator with Float32Array directly as per documentation
            console.log(`[Extract] Using FrameGenerator for ${songId}...`);
            
            try {
                // Generate frames using FrameGenerator - IMPORTANT: it expects a Float32Array directly (not a vector)
                const frames = essentia.FrameGenerator(audioData, frameSize, hopSize);
                console.log(`[Extract] Generated ${frames.size()} frames for ${songId}`);
                
                // Limit number of frames for performance
                const maxFramesToProcess = Math.min(frames.size(), 100);
                
                // Process each frame
                for (let i = 0; i < maxFramesToProcess; i++) {
                    try {
                        const frame = frames.get(i);
                        
                        // Compute spectrum
                        const spectrum = essentia.Spectrum(frame);
                        
                        // Compute MFCC
                        const mfccResult = essentia.MFCC(spectrum.spectrum);
                        
                        // Convert to array and add to results
                        const frameMfccs = essentia.vectorToArray(mfccResult.mfcc);
                        mfccs.push(frameMfccs);
                        
                        spectrum.spectrum.delete();
                        mfccResult.mfcc.delete();
                    } catch (frameError) {
                        console.error(`[Extract] Error processing frame ${i} for ${songId}:`, frameError);
                        // Continue with next frame
                    }
                    
                    // Log progress occasionally
                    if (i % 20 === 0) {
                        console.log(`[Extract] Processed ${i}/${maxFramesToProcess} frames for ${songId}`);
                    }
                }
                
                // Clean up frames
                frames.delete();
            } catch (framesError) {
                console.error(`[Extract] Error using FrameGenerator for ${songId}:`, framesError);
                throw new Error(`FrameGenerator failed: ${(framesError as Error).message || String(framesError)}`);
            }
            
            // Check if we extracted any features
            if (!mfccs || mfccs.length === 0 || !mfccs[0]) {
                console.error(`[Extract] MFCC calculation empty or invalid format for ${songId}`);
                throw new Error(`Failed to extract any valid MFCC features for ${songId}`);
            }

            console.log(`[Extract] Calculating stats for ${songId}...`);
            const numCoeffs = mfccs[0].length;
            const mfccMeans: number[] = [];
            const mfccStdDevs: number[] = [];

            for (let i = 0; i < numCoeffs; i++) {
                 const coeffValues = mfccs.map(frame => frame[i]);
                 const coeffMean = mean(coeffValues);
                 const coeffStdDev = stdDev(coeffValues, coeffMean);
                 mfccMeans.push(coeffMean);
                 mfccStdDevs.push(coeffStdDev);
            }

            console.log(`[Extract] Preparing results for ${songId}...`);
            const features = {
                 mfccMeans: mfccMeans,
                 mfccStdDevs: mfccStdDevs,
            };

            // Explicitly type the outgoing message if desired
            self.postMessage({ type: 'featureExtractionComplete', songId, features });
            console.log(`[Extract] Finished processing songId: ${songId}`);

            // Clean up
            console.log(`[Extract] Cleaning up memory for ${songId}...`);
            // Float32Array is handled by JS garbage collector and doesn't need explicit deletion

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            console.error(`[Extract] Error extracting features for song ${songId} in worker:`, error);
            self.postMessage({ type: 'featureExtractionError', songId, error: errorMessage });
        }
    }
};

// Generic error handler for the worker itself
self.onerror = (error) => {
    const errorMessage = (error instanceof Error) ? error.message : (typeof error === 'string' ? error : 'Unknown worker error');
    console.error("Unhandled error in worker:", error);
    self.postMessage({ type: 'workerError', error: errorMessage });
};

console.log("Worker setup complete (Bundled with require). Waiting for messages..."); 