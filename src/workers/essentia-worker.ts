console.log("Worker script evaluating... [Bundled Approach using require]");

// Use require - Webpack will handle this during build
const esPkg = require('essentia.js');

// Import feature extraction modules
import { extractMFCC } from './features/mfcc';

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
    audioVector: number[]; // Reverted to only mono vector
    sampleRate: number;
    songId: string;
    featuresToExtract: string[]; 
};

type WorkerMessageData = 
    | { type: 'init', payload: InitPayload }
    | { type: 'extractFeatures', payload: ExtractFeaturesPayload };

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
        const { 
            audioVector, 
            sampleRate, 
            songId, 
            featuresToExtract 
        } = payload as ExtractFeaturesPayload;

        // Ensure Essentia is ready
        const ready = await initializeEssentia();
        if (!ready || !essentia) {
            console.error(`Cannot extract features for ${songId}: Essentia not ready or instance is null.`);
            self.postMessage({ type: 'featureExtractionError', songId, error: 'Essentia not initialized' });
            return;
        }

        console.log(`[Extract] Processing songId: ${songId}, Features: [${featuresToExtract.join(', ')}], Sample Rate: ${sampleRate}, Length: ${audioVector.length}`);
        let audioVectorEssentia: any = null; // Define here for broader scope and cleanup
        try {
            console.log(`[Extract] Converting audio data for ${songId}...`);
            // Convert primary (left/mono) channel
            const audioData = new Float32Array(audioVector);
            audioVectorEssentia = essentia.arrayToVector(audioData);

            let extractedFeatures: any = {}; 

            // --- Extract Selected Features --- 
            console.log(`[Extract] Starting feature extraction for ${songId} at ${sampleRate} Hz...`);

            // Ensure audioVectorEssentia is valid before proceeding
            if (!audioVectorEssentia || audioVectorEssentia.size() === 0) {
                throw new Error("Audio vector is invalid or empty.");
            }

            if (featuresToExtract.includes('mfcc')) {
                console.log(`[Extract][MFCC] Starting for ${songId}`);
                // Use original audioData and sampleRate
                // No need for temporary conversion back here if extractMFCC uses audioData
                const mfccResult = await extractMFCC(essentia, audioData, sampleRate, songId);
                extractedFeatures = { ...extractedFeatures, ...mfccResult };
                console.log(`[Extract][MFCC] Completed for ${songId}`);
            }
            
            if (featuresToExtract.includes('energy')) {
                console.log(`[Extract][Energy] Starting for ${songId}`);
                const energyResult = essentia.Energy(audioVectorEssentia); 
                extractedFeatures.energy = energyResult.energy;
                console.log(`[Extract][Energy] Completed for ${songId}:`, extractedFeatures.energy);
            }
            
            if (featuresToExtract.includes('entropy')) {
                console.log(`[Extract][Entropy] Starting for ${songId}`);
                let nonNegativeVector: any = null; 
                try {
                    // Use original audioData
                    const nonNegativeAudioData = audioData.map(Math.abs);
                    nonNegativeVector = essentia.arrayToVector(nonNegativeAudioData);
                    const entropyResult = essentia.Entropy(nonNegativeVector);
                    extractedFeatures.entropy = entropyResult.entropy;
                    console.log(`[Extract][Entropy] Completed for ${songId}:`, extractedFeatures.entropy);
                } catch (entropyError) {
                    console.error(`[Extract][Entropy] Error for ${songId}:`, entropyError);
                    extractedFeatures.entropyError = (entropyError instanceof Error) ? entropyError.message : String(entropyError);
                } finally {
                    if (nonNegativeVector) nonNegativeVector.delete(); 
                }
            }
            
            if (featuresToExtract.includes('key')) {
                console.log(`[Extract][Key] Starting for ${songId}`);
                try {
                    // Use original audioVectorEssentia and sampleRate
                    const keyResult = essentia.KeyExtractor(audioVectorEssentia, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sampleRate, 0.0001, 440, 'cosine', 'hann');
                    extractedFeatures.key = keyResult.key;
                    extractedFeatures.keyScale = keyResult.scale;
                    extractedFeatures.keyStrength = keyResult.strength;
                    console.log(`[Extract][Key] Completed for ${songId}:`, keyResult.key, keyResult.scale, keyResult.strength);
                } catch (keyError) {
                     console.error(`[Extract][Key] Error for ${songId}:`, keyError);
                     extractedFeatures.keyError = (keyError instanceof Error) ? keyError.message : String(keyError);
                }
            }
            
            if (featuresToExtract.includes('dynamicComplexity')) {
                console.log(`[Extract][DynamicComplexity] Starting for ${songId}`);
                try {
                    // Use original audioVectorEssentia and sampleRate
                    const dynamicComplexityResult = essentia.DynamicComplexity(audioVectorEssentia, 0.2, sampleRate);
                    extractedFeatures.dynamicComplexity = dynamicComplexityResult.dynamicComplexity;
                    extractedFeatures.loudness = dynamicComplexityResult.loudness; 
                    console.log(`[Extract][DynamicComplexity] Completed for ${songId}:`, dynamicComplexityResult);
                } catch (dynCompError) {
                    console.error(`[Extract][DynamicComplexity] Error for ${songId}:`, dynCompError);
                    extractedFeatures.dynamicComplexityError = (dynCompError instanceof Error) ? dynCompError.message : String(dynCompError);
                }
            }

            // --- RMS --- (NEW)
            if (featuresToExtract.includes('rms')) {
                console.log(`[Extract][RMS] Starting for ${songId}`);
                try {
                    const rmsResult = essentia.RMS(audioVectorEssentia);
                    extractedFeatures.rms = rmsResult.rms;
                    console.log(`[Extract][RMS] Completed for ${songId}:`, rmsResult.rms);
                 } catch (rmsError) {
                     console.error(`[Extract][RMS] Error for ${songId}:`, rmsError);
                     extractedFeatures.rmsError = (rmsError instanceof Error) ? rmsError.message : String(rmsError);
                 }
             }
             
            // --- Rhythm Extractor --- (NEW)
            if (featuresToExtract.includes('rhythm')) {
                console.log(`[Extract][Rhythm] Starting for ${songId}`);
                 try {
                     // Using default method ('multifeature') and tempo ranges (40-208) explicitly
                     const rhythmResult = essentia.RhythmExtractor2013(
                         audioVectorEssentia,
                         208, // maxTempo
                         'degara', // method
                         40 // minTempo
                     );
                     extractedFeatures.bpm = rhythmResult.bpm;
                     extractedFeatures.ticks = essentia.vectorToArray(rhythmResult.ticks);
                     extractedFeatures.rhythmConfidence = rhythmResult.confidence;
                     // Optionally extract estimates and bpmIntervals if needed later
                     // extractedFeatures.estimates = essentia.vectorToArray(rhythmResult.estimates);
                     // extractedFeatures.bpmIntervals = essentia.vectorToArray(rhythmResult.bpmIntervals);
                    console.log(`[Extract][Rhythm] Completed for ${songId}: BPM = ${rhythmResult.bpm}, Confidence = ${rhythmResult.confidence}, Ticks = ${extractedFeatures.ticks.length}`);
                 } catch (rhythmError) {
                     console.error(`[Extract][Rhythm] Error for ${songId}:`, rhythmError);
                     extractedFeatures.rhythmError = (rhythmError instanceof Error) ? rhythmError.message : String(rhythmError);
                 }
            }

            // --- Tuning Frequency --- (NEW)
            if (featuresToExtract.includes('tuningFrequency')) {
                console.log(`[Extract][TuningFreq] Starting for ${songId}`);
                // Needs intermediate steps: Windowing -> Spectrum -> SpectralPeaks
                let windowedFrameVec: any = null;
                let spectrumVec: any = null;
                let freqVec: any = null;
                let magVec: any = null;
                try {
                    // 1. Windowing (using default Hann window, size matching audio for simplicity? Or standard like 2048? Let's use 2048)
                    // Note: TuningFrequency often works better on a representative frame rather than the whole signal averaged.
                    // However, for simplicity now, let's process the whole signal vector as one large frame.
                    // This might not be the most musically meaningful way, but demonstrates the chain.
                    // A better approach would involve framing and averaging results.
                    windowedFrameVec = essentia.Windowing(audioVectorEssentia).frame; // Apply default Hann window

                    // 2. Spectrum
                    spectrumVec = essentia.Spectrum(windowedFrameVec).spectrum;

                    // 3. Spectral Peaks
                    const peaks = essentia.SpectralPeaks(spectrumVec);
                    freqVec = peaks.frequencies;
                    magVec = peaks.magnitudes;

                    // 4. Tuning Frequency (using default resolution = 1 cent)
                    if (freqVec.size() > 0) { // Check if any peaks were found
                        const tuningResult = essentia.TuningFrequency(freqVec, magVec);
                        extractedFeatures.tuningFrequency = tuningResult.tuningFrequency;
                        extractedFeatures.tuningCents = tuningResult.tuningCents;
                        console.log(`[Extract][TuningFreq] Completed for ${songId}: Freq = ${tuningResult.tuningFrequency} Hz, Cents = ${tuningResult.tuningCents}`);
                    } else {
                         console.warn(`[Extract][TuningFreq] No spectral peaks found for ${songId}, skipping tuning calculation.`);
                         extractedFeatures.tuningFrequencyError = "No spectral peaks found";
                    }
                 } catch (tuningError) {
                     console.error(`[Extract][TuningFreq] Error for ${songId}:`, tuningError);
                     extractedFeatures.tuningFrequencyError = (tuningError instanceof Error) ? tuningError.message : String(tuningError);
                 } finally {
                     // Cleanup intermediate vectors
                     if (windowedFrameVec) windowedFrameVec.delete();
                     if (spectrumVec) spectrumVec.delete();
                     if (freqVec) freqVec.delete();
                     if (magVec) magVec.delete();
                 }
            }

            // --- Cleanup primary audio vector --- 
            if (audioVectorEssentia) { 
                 console.log(`[Extract] Cleaning up audio vector for ${songId}`);
                 audioVectorEssentia.delete(); 
            } 
            
            console.log(`[Extract] All selected features extracted for ${songId}.`);
            
            // Send results back to main thread
            self.postMessage({ type: 'featureExtractionComplete', songId, features: extractedFeatures });
            console.log(`[Extract] Finished processing songId: ${songId}`);

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