console.log("Worker script evaluating... [Bundled Approach using require]");

// Use require - Webpack will handle this during build
const esPkg = require('essentia.js');

// Import the new frame-based feature extractor
import { extractFrameBasedFeatures } from './features/frame-feature-extractor';
import { withEssentiaRequestId, type EssentiaWorkerSendMessage } from '../lib/essentiaWorkerMessages';

console.log('[Debug] esPkg structure keys:', Object.keys(esPkg));

let essentia: any; // Use 'any' for now
let essentiaInstancePromise: Promise<boolean> | null = null;

const isUsableEssentiaInstance = (candidate: any): boolean => {
    if (!candidate || typeof candidate.version === 'undefined' || typeof candidate.arrayToVector !== 'function') {
        return false;
    }

    let probeVector: any = null;
    try {
        probeVector = candidate.arrayToVector(new Float32Array([0, 0.25, -0.25]));
        if (!probeVector || typeof probeVector.size !== 'function' || typeof candidate.Energy !== 'function') {
            return false;
        }
        const energyResult = candidate.Energy(probeVector);
        return Number.isFinite(energyResult?.energy);
    } catch (error) {
        console.warn('[Initialize] Essentia instance probe failed:', error);
        return false;
    } finally {
        if (probeVector && typeof probeVector.delete === 'function') {
            probeVector.delete();
        }
    }
};

const acceptEssentiaInstance = (candidate: any, label: string): boolean => {
    if (!isUsableEssentiaInstance(candidate)) {
        console.warn(`[Initialize] ${label} Essentia instance was not usable for vector conversion.`);
        return false;
    }

    essentia = candidate;
    console.log(`[Initialize] Created using ${label}. Version:`, candidate.version);
    self.postMessage({ type: 'essentiaReady', payload: true });
    return true;
};

const createEssentiaWasmAdapter = (wasmModule: any): any => {
    const algorithms = new wasmModule.EssentiaJS(false);
    const adapter: any = {
        version: 'wasm-adapter',
        algorithmNames: [],
        arrayToVector: (inputArray: Float32Array) => wasmModule.arrayToVector(inputArray),
        vectorToArray: (inputVector: any) => wasmModule.vectorToArray(inputVector),
        shutdown: () => algorithms.shutdown?.(),
        delete: () => algorithms.delete?.(),
    };

    return new Proxy(adapter, {
        get(target, property) {
            if (property in target) return target[property as keyof typeof target];
            const algorithmValue = algorithms[property as keyof typeof algorithms];
            return typeof algorithmValue === 'function' ? algorithmValue.bind(algorithms) : algorithmValue;
        },
    });
};

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
                        console.log('[Debug] Found nested EssentiaWASM - using that first');
                        try {
                            const candidate = new esPkg.Essentia(esPkg.EssentiaWASM.EssentiaWASM);
                            if (acceptEssentiaInstance(candidate, 'nested WASM')) {
                                return true;
                            }
                        } catch (nestedError) {
                            console.error('[Debug] Nested WASM approach failed:', nestedError);
                        }

                        console.log('[Debug] Trying nested EssentiaWASM adapter');
                        try {
                            const candidate = createEssentiaWasmAdapter(esPkg.EssentiaWASM.EssentiaWASM);
                            if (acceptEssentiaInstance(candidate, 'nested EssentiaWASM adapter')) {
                                return true;
                            }
                        } catch (adapterError) {
                            console.error('[Debug] Nested WASM adapter failed:', adapterError);
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
                
                if (esPkg.EssentiaWASM) {
                    console.log('[Debug] Trying direct Essentia(EssentiaWASM)');
                    try {
                        const candidate = new esPkg.Essentia(esPkg.EssentiaWASM);
                        if (acceptEssentiaInstance(candidate, 'direct EssentiaWASM')) {
                            return true;
                        }
                    } catch (directWasmError) {
                        console.log('[Debug] Direct Essentia(EssentiaWASM) failed, continuing with patch if available.', directWasmError);
                    }
                }

                // Try direct initialization without arguments next; some bundles expose a version but cannot extract.
                try {
                    console.log('[Debug] Trying direct Essentia() with no args');
                    const candidate = new esPkg.Essentia();
                    if (acceptEssentiaInstance(candidate, 'direct no-args')) {
                        return true;
                    }
                } catch (directError) {
                    console.log('[Debug] Direct no-args approach failed, continuing with patch if available.', directError);
                }

                // Step 3: Try to use the patched module
                console.log('[Debug] Trying Essentia with enhanced patched WASM module');
                const candidate = new esPkg.Essentia(patchedWASM);

                // Check if we have a valid essentia instance
                if (acceptEssentiaInstance(candidate, 'enhanced patched WASM module')) {
                    return true;
                } else {
                    throw new Error('Essentia instance created but could not convert audio vectors');
                }
                
            } catch (e) {
                const errorMessage = (e instanceof Error) ? e.message : String(e);
                console.error('[Initialize] Error during Essentia initialization process:', e);
                
                // Provide a more helpful error message
                if (errorMessage.includes('EssentiaWASM.EssentiaJS is not a constructor') || errorMessage.includes('Failed to initialize Essentia')) {
                    const helpfulError = 'Essentia.js initialization failed: The current version may have worker compatibility issues. Please check console logs and Essentia.js documentation.';
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

// --- Define features requiring frame-based processing ---
const FRAME_BASED_FEATURES = new Set([
    'mfcc',
    'spectralCentroidTime',
    'spectralComplexity',
    'spectralContrast',
    'inharmonicity',
    'dissonance',
    'melBands',
    'pitchSalience',
    'spectralFlux'
]);

// --- Type definitions for message payloads (optional but good practice) ---
type InitPayload = {}; // No payload for init
type ExtractFeaturesPayload = {
    audioVector: number[]; // Reverted to only mono vector
    sampleRate: number;
    songId: string;
    featuresToExtract: string[]; 
};

type WithRequestId<T> = T & { requestId?: string };

type WorkerMessageData = WithRequestId<
    | { type: 'init', payload: InitPayload }
    | { type: 'extractFeatures', payload: ExtractFeaturesPayload }
>;

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
    console.log("Worker received message:", event.data.type);
    const { type, payload, requestId } = event.data;
    const postExtractionMessage = (message: EssentiaWorkerSendMessage) => {
        self.postMessage(withEssentiaRequestId(message, requestId));
    };

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
            postExtractionMessage({ type: 'featureExtractionError', songId, error: 'Essentia not initialized' });
            return;
        }

        console.log(`[MainWorker Extract ${songId}] Processing. Requested: [${featuresToExtract.join(', ')}]`);

        // Separate features
        const fullSignalFeaturesToExtract = featuresToExtract.filter(f => !FRAME_BASED_FEATURES.has(f));
        const frameBasedFeaturesToExtract = featuresToExtract.filter(f => FRAME_BASED_FEATURES.has(f));

        console.log(`[MainWorker Extract ${songId}] Full Signal Features: [${fullSignalFeaturesToExtract.join(', ')}]`);
        console.log(`[MainWorker Extract ${songId}] Frame-Based Features: [${frameBasedFeaturesToExtract.join(', ')}]`);

        let combinedFeatures: any = {}; // Object to hold all results
        let audioVectorEssentia: any = null; // Essentia vector for full-signal features

        try {
            // --- 1. Prepare Full Signal Vector (only if needed) ---
            if (fullSignalFeaturesToExtract.length > 0) {
                console.log(`[MainWorker Extract ${songId}] Converting audio data for full-signal features...`);
                const audioDataFull = new Float32Array(audioVector); // Create Float32Array once
                audioVectorEssentia = essentia.arrayToVector(audioDataFull);
                if (!audioVectorEssentia || audioVectorEssentia.size() === 0) {
                    throw new Error("Audio vector is invalid or empty for full-signal processing.");
                }
            }

            // --- 2. Extract Full Signal Features ---
            for (const featureId of fullSignalFeaturesToExtract) {
                console.log(`[MainWorker Extract ${songId}] Calculating full-signal feature: ${featureId}`);
                try {
                    switch (featureId) {
                        case 'energy':
                            const energyResult = essentia.Energy(audioVectorEssentia);
                            combinedFeatures.energy = energyResult.energy;
                            break;
                        case 'entropy': // Requires non-negative input
                            let nonNegativeVector: any = null;
                            try {
                                const nonNegativeAudioData = new Float32Array(audioVector).map(Math.abs);
                                nonNegativeVector = essentia.arrayToVector(nonNegativeAudioData);
                                const entropyResult = essentia.Entropy(nonNegativeVector);
                                combinedFeatures.entropy = entropyResult.entropy;
                            } finally {
                                if (nonNegativeVector) nonNegativeVector.delete();
                            }
                            break;
                        case 'key':
                            const keyResult = essentia.KeyExtractor(audioVectorEssentia, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sampleRate, 0.0001, 440, 'cosine', 'hann');
                            combinedFeatures.key = keyResult.key;
                            combinedFeatures.keyScale = keyResult.scale;
                            combinedFeatures.keyStrength = keyResult.strength;
                            break;
                        case 'dynamicComplexity':
                            const dynamicComplexityResult = essentia.DynamicComplexity(audioVectorEssentia, 0.2, sampleRate);
                            combinedFeatures.dynamicComplexity = dynamicComplexityResult.dynamicComplexity;
                            combinedFeatures.loudness = dynamicComplexityResult.loudness;
                            break;
                        case 'rms':
                            const rmsResult = essentia.RMS(audioVectorEssentia);
                            combinedFeatures.rms = rmsResult.rms;
                            break;
                        case 'rhythm': // BPM (Fast) — RhythmExtractor2013 degara
                            const rhythmResult = essentia.RhythmExtractor2013(audioVectorEssentia, 208, 'degara', 40);
                            combinedFeatures.bpm = rhythmResult.bpm;
                           // combinedFeatures.ticks = essentia.vectorToArray(rhythmResult.ticks); // Keep ticks commented unless needed
                           // combinedFeatures.rhythmConfidence = rhythmResult.confidence;
                           // rhythmResult.ticks?.delete(); // Clean up vector if extracted
                           // rhythmResult.estimates?.delete();
                           // rhythmResult.bpmIntervals?.delete();
                            break;
                        case 'rhythmSlow': // BPM (Slow) — RhythmExtractor2013 multifeature
                            const rhythmSlowResult = essentia.RhythmExtractor2013(audioVectorEssentia, 208, 'multifeature', 40);
                            combinedFeatures.bpmSlow = rhythmSlowResult.bpm;
                            break;
                        case 'tuningFrequency':
                            let vectorToDelete: any = null; // Keep track of vector to delete
                             try {
                                 // Use the dedicated extractor
                                 const tuningResult = essentia.TuningFrequencyExtractor(audioVectorEssentia);
                                 const frequencyVector = tuningResult.tuningFrequency;
                                 vectorToDelete = frequencyVector; // Assign vector for potential cleanup

                                 console.log(`[MainWorker Extract ${songId}] Raw tuningResult object:`, tuningResult);
                                 console.log(`[MainWorker Extract ${songId}] Type of frequencyVector:`, typeof frequencyVector);

                                 // Check if it's an object with a size method (likely VectorFloat)
                                 if (frequencyVector && typeof frequencyVector === 'object' && typeof frequencyVector.size === 'function') {
                                     if (frequencyVector.size() > 0) {
                                          const freqArray = essentia.vectorToArray(frequencyVector);

                                          // Calculate Median for robustness
                                          if (freqArray && freqArray.length > 0) {
                                               freqArray.sort((a: number, b: number) => a - b); // Sort numerically
                                               const mid = Math.floor(freqArray.length / 2);
                                               let medianFreq: number;
                                               if (freqArray.length % 2 === 0) {
                                                   // Even number of elements: average the two middle ones
                                                   medianFreq = (freqArray[mid - 1] + freqArray[mid]) / 2;
                                               } else {
                                                   // Odd number of elements: take the middle one
                                                   medianFreq = freqArray[mid];
                                               }

                                               console.log(`[MainWorker Extract ${songId}] Calculated median tuning frequency:`, medianFreq);

                                               if (typeof medianFreq === 'number' && isFinite(medianFreq)) {
                                                   combinedFeatures.tuningFrequency = medianFreq;
                                                   console.log(`[MainWorker Extract ${songId}] TuningFrequency assigned (median): ${medianFreq} Hz`);
                                               } else {
                                                   console.warn(`[MainWorker Extract ${songId}] Calculated median frequency is not a valid number.`);
                                                   combinedFeatures.tuningFrequency = undefined;
                                                   combinedFeatures.tuningFrequencyError = "Invalid median value calculated";
                                               }
                                          } else {
                                               console.warn(`[MainWorker Extract ${songId}] Tuning frequency vector is empty.`);
                                               combinedFeatures.tuningFrequency = undefined;
                                               combinedFeatures.tuningFrequencyError = "Result vector is empty";
                                          }
                                     } else {
                                          console.warn(`[MainWorker Extract ${songId}] Tuning frequency vector is empty.`);
                                          combinedFeatures.tuningFrequency = undefined;
                                          combinedFeatures.tuningFrequencyError = "Result vector is empty";
                                     }
                                 } else {
                                     console.warn(`[MainWorker Extract ${songId}] Invalid or missing tuning frequency VectorFloat in result.`);
                                     combinedFeatures.tuningFrequency = undefined;
                                     combinedFeatures.tuningFrequencyError = "Invalid/missing VectorFloat from extractor";
                                 }
                             } catch (tuningError) {
                                 const errorMsg = (tuningError instanceof Error) ? tuningError.message : String(tuningError);
                                 console.error(`[MainWorker Extract ${songId}] Error calculating TuningFrequency:`, tuningError);
                                 combinedFeatures.tuningFrequencyError = errorMsg;
                             } finally {
                                 // Clean up the VectorFloat if it was created
                                 if (vectorToDelete && typeof vectorToDelete.delete === 'function') {
                                     console.log(`[MainWorker Extract ${songId}] Cleaning up tuningFrequency vector.`);
                                     vectorToDelete.delete();
                                 }
                             }
                             break;
                         case 'onsetRate':
                             let vectorForOnset = audioVectorEssentia;
                             let needsCleanup = false;
                             try {
                                 if (sampleRate !== 44100) {
                                     console.log(`[MainWorker Extract ${songId}] Resampling for OnsetRate from ${sampleRate}Hz to 44100Hz...`);
                                     console.log(`[MainWorker Extract ${songId}] Input vector size for Resample: ${audioVectorEssentia?.size()}`);
                                     // *** Isolate Resample Call with Quality=0 ***
                                     let resampleResult: any = null;
                                     try {
                                         resampleResult = essentia.Resample(audioVectorEssentia, sampleRate, 44100, 0 /* quality=0 */);
                                         console.log(`[MainWorker Extract ${songId}] Raw resampleResult object:`, JSON.stringify(resampleResult));
                                         console.log(`[MainWorker Extract ${songId}] Type of resampleResult.signal:`, typeof resampleResult?.signal);
                                         // Add validation for the resampled vector
                                         if (!resampleResult || !resampleResult.signal || typeof resampleResult.signal.size !== 'function') {
                                             throw new Error("Resample algorithm failed to return a valid signal vector.");
                                         }
                                         vectorForOnset = resampleResult.signal;
                                         needsCleanup = true;
                                         console.log(`[MainWorker Extract ${songId}] Resampling complete.`);
                                     } catch (resampleError) {
                                         console.error(`[MainWorker Extract ${songId}] essentia.Resample call failed:`, resampleError);
                                         // Re-throw or handle specifically? Re-throwing to be caught by outer catch.
                                         throw resampleError;
                                     }
                                 } else {
                                     console.log(`[MainWorker Extract ${songId}] Using original sample rate (44100Hz) for OnsetRate.`);
                                 }

                                 const onsetResult = essentia.OnsetRate(vectorForOnset);
                                 combinedFeatures.onsetRate = onsetResult.onsetRate;
                                 console.log(`[MainWorker Extract ${songId}] OnsetRate completed: ${onsetResult.onsetRate}`);
                                 // onsetResult.onsets?.delete(); // Essentia object cleanup likely not needed for results

                             } catch (onsetRateError) {
                                 // Log the full error object for better debugging
                                console.error(`[MainWorker Extract ${songId}] Full OnsetRate Error Object:`, onsetRateError);
                                 const errorMsg = (onsetRateError instanceof Error) ? onsetRateError.message : String(onsetRateError);
                                 console.error(`[MainWorker Extract ${songId}] Error calculating OnsetRate:`, onsetRateError);
                                 combinedFeatures.onsetRateError = errorMsg;
                             } finally {
                                 // Clean up the resampled vector *only* if it was created
                                 if (needsCleanup && vectorForOnset) {
                                     console.log(`[MainWorker Extract ${songId}] Cleaning up resampled vector for OnsetRate.`);
                                     vectorForOnset.delete();
                                 }
                             }
                             break;
                         case 'danceability':
                             const danceResult = essentia.Danceability(audioVectorEssentia);
                             combinedFeatures.danceability = danceResult.danceability;
                             // danceResult.dfa?.delete(); // If DFA vector exists and needs cleanup
                             break;
                         case 'intensity':
                             const intensityResult = essentia.Intensity(audioVectorEssentia);
                             combinedFeatures.intensity = intensityResult.intensity;
                             break;
                        // Add cases for other full-signal features here
                        default:
                            console.warn(`[MainWorker Extract ${songId}] Unknown full-signal feature requested: ${featureId}`);
                            combinedFeatures[`${featureId}Error`] = "Unknown full-signal feature";
                    }
                    console.log(`[MainWorker Extract ${songId}] Completed full-signal feature: ${featureId}`);
                } catch (featureError) {
                    const errorMsg = (featureError instanceof Error) ? featureError.message : String(featureError);
                    console.error(`[MainWorker Extract ${songId}] Error calculating ${featureId}:`, featureError);
                    combinedFeatures[`${featureId}Error`] = errorMsg;
                }
            }

            // --- 3. Delegate Frame-Based Features ---
            if (frameBasedFeaturesToExtract.length > 0) {
                console.log(`[MainWorker Extract ${songId}] Delegating frame-based features...`);
                try {
                    // Pass Float32Array directly
                    const frameFeaturesResult = await extractFrameBasedFeatures(
                        essentia,
                        new Float32Array(audioVector), // Pass the raw audio data again
                        sampleRate,
                        songId,
                        frameBasedFeaturesToExtract
                    );
                    console.log(`[MainWorker Extract ${songId}] Received frame-based results.`);
                    // Merge results, potentially overwriting error keys if successful
                    combinedFeatures = { ...combinedFeatures, ...frameFeaturesResult };
                } catch (frameProcessingError) {
                     const errorMsg = (frameProcessingError instanceof Error) ? frameProcessingError.message : String(frameProcessingError);
                     console.error(`[MainWorker Extract ${songId}] Error during delegated frame processing:`, frameProcessingError);
                     combinedFeatures['frameProcessingError'] = errorMsg;
                }
            } else {
                 console.log(`[MainWorker Extract ${songId}] No frame-based features requested.`);
            }

            // --- 4. Post Combined Results ---
            console.log(`[MainWorker Extract ${songId}] All processing finished. Posting results.`);
            postExtractionMessage({ type: 'featureExtractionComplete', songId, features: combinedFeatures });

        } catch (error) {
            // Catch errors from top-level processing (e.g., initial vector conversion)
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            console.error(`[MainWorker Extract ${songId}] Top-level error extracting features:`, error);
            postExtractionMessage({ type: 'featureExtractionError', songId, error: errorMessage });
        } finally {
            // --- Cleanup Full Signal Vector ---
            if (audioVectorEssentia) {
                console.log(`[MainWorker Extract ${songId}] Cleaning up full-signal audio vector.`);
                audioVectorEssentia.delete();
            }
            console.log(`[MainWorker Extract ${songId}] Cleanup complete.`);
        }
    }
};

// Generic error handler for the worker itself
self.onerror = (error) => {
    const errorMessage = (error instanceof Error) ? error.message : (typeof error === 'string' ? error : 'Unknown worker error');
    console.error("Unhandled error in main worker:", error);
    self.postMessage({ type: 'workerError', error: errorMessage });
};

console.log("Main Worker setup complete. Waiting for messages...");
