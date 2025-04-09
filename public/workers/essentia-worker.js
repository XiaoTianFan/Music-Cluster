// public/workers/essentia-worker.js

// Import the Essentia.js ES Module library files
import { EssentiaWASM } from '../lib/essentia-wasm.es.js';
import { Essentia } from '../lib/essentia.js-core.es.js';

let essentia;
let essentiaInstancePromise = null;

// Initialize Essentia.js (now using imported modules)
const initializeEssentia = async () => {
  // Use a promise to ensure initialization only runs once
  if (!essentiaInstancePromise) {
      essentiaInstancePromise = (async () => {
            try {
                console.log('Initializing Essentia.js worker...');
                // EssentiaWASM is now directly imported
                if (typeof EssentiaWASM !== 'function') {
                    throw new Error('EssentiaWASM factory function not imported correctly.');
                }
                const EssentiaWasmModule = await EssentiaWASM(); // Call the factory
                essentia = new Essentia(EssentiaWasmModule);
                console.log('Essentia.js worker initialized, version:', essentia.version);
                self.postMessage({ type: 'essentiaReady', payload: true });
                return true;
            } catch (e) {
                console.error('Error initializing Essentia in worker:', e);
                self.postMessage({ type: 'essentiaReady', payload: false, error: e.message });
                return false;
            }
      })();
  }
  return await essentiaInstancePromise;
};

// Helper function to calculate mean of an array of numbers
const mean = (arr) => arr.reduce((acc, val) => acc + val, 0) / arr.length;

// Helper function to calculate standard deviation
const stdDev = (arr, arrMean) => {
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - arrMean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

// Main message handler
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    await initializeEssentia();
    return;
  }

  if (type === 'extractFeatures') {
    const { audioVector, sampleRate, songId } = payload;

    // Ensure Essentia is ready (waits for the initialization promise)
    const ready = await initializeEssentia();
    if (!ready || !essentia) { // Double check essentia instance exists
        self.postMessage({ type: 'featureExtractionError', songId, error: 'Essentia not initialized' });
        return;
    }

    console.log(`Worker received request for songId: ${songId}, sampleRate: ${sampleRate}, audio length: ${audioVector.length}`);

    try {
      const audioFloat32 = essentia.arrayToVector(audioVector); 

      // ---- Feature Extraction -----
      const frameSize = 2048;
      const hopSize = 1024;
      const mfccResult = essentia.MFCC(audioFloat32, sampleRate, 13, 40, 133.33, 6855.4, frameSize, hopSize);
      const mfccs = essentia.vectorToArray(mfccResult.mfcc);

      if (!mfccs || mfccs.length === 0) {
          throw new Error('MFCC calculation resulted in empty output.');
      }

      // Calculate statistics
      const numCoeffs = mfccs[0].length;
      const mfccMeans = [];
      const mfccStdDevs = [];

      for (let i = 0; i < numCoeffs; i++) {
        const coeffValues = mfccs.map(frame => frame[i]);
        const coeffMean = mean(coeffValues);
        const coeffStdDev = stdDev(coeffValues, coeffMean);
        mfccMeans.push(coeffMean);
        mfccStdDevs.push(coeffStdDev);
      }

      // Prepare results
      const features = {
        mfccMeans: mfccMeans,
        mfccStdDevs: mfccStdDevs,
      };

      self.postMessage({ type: 'featureExtractionComplete', songId, features });
      console.log(`Worker finished processing songId: ${songId}`);

      // Clean up
      audioFloat32.delete();
      mfccResult.mfcc.delete();

    } catch (error) {
      console.error(`Error extracting features for song ${songId} in worker:`, error);
      self.postMessage({ type: 'featureExtractionError', songId, error: error.message });
    }
  }
}; 