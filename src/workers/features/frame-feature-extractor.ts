// Helper function to calculate mean
export const mean = (arr: number[]): number => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

// Helper function to calculate standard deviation
export const stdDev = (arr: number[], arrMean: number): number => {
  if (!arr || arr.length <= 1) return 0; // StdDev is 0 for 0 or 1 samples
  // Use population variance matching typical feature extraction
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - arrMean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

// Helper for vector aggregation
const aggregateVectorFeature = (vectors: number[][]): { means: number[], stdDevs: number[] } => {
  if (!vectors || vectors.length === 0 || !vectors[0]) {
      return { means: [], stdDevs: [] };
  }
  const numDimensions = vectors[0].length;
  const numVectors = vectors.length;
  const means: number[] = Array(numDimensions).fill(0);
  const stdDevs: number[] = Array(numDimensions).fill(0);

  // Calculate means
  for (let j = 0; j < numDimensions; j++) {
      let sum = 0;
      for (let i = 0; i < numVectors; i++) {
          sum += vectors[i]?.[j] ?? 0;
      }
      means[j] = sum / numVectors;
  }

  // Calculate standard deviations
  if (numVectors > 1) {
      for (let j = 0; j < numDimensions; j++) {
          let varianceSum = 0;
          for (let i = 0; i < numVectors; i++) {
              varianceSum += Math.pow((vectors[i]?.[j] ?? 0) - means[j], 2);
          }
          stdDevs[j] = Math.sqrt(varianceSum / numVectors);
      }
  }

  return { means, stdDevs };
};

// Define a minimal type for the Essentia instance based on known usage
// Expand this as more algorithms are used
interface EssentiaInstance {
  FrameGenerator: (audioData: Float32Array, frameSize: number, hopSize: number) => any;
  Windowing: (frame: any) => { frame: any };
  Spectrum: (frame: any) => { spectrum: any };
  SpectralPeaks: (spectrum: any, ...args: any[]) => { frequencies: any, magnitudes: any };
  MFCC: (spectrum: any, ...args: any[]) => { mfcc: any };
  Flux: (spectrum: any, ...args: any[]) => { flux: number };
  SpectralCentroidTime: (frame: any, sampleRate: number) => { centroid: number };
  SpectralComplexity: (spectrum: any, ...args: any[]) => { spectralComplexity: number };
  SpectralContrast: (spectrum: any, ...args: any[]) => { spectralContrast: any, spectralValley: any };
  Inharmonicity: (frequencies: any, magnitudes: any) => { inharmonicity: number };
  Dissonance: (frequencies: any, magnitudes: any) => { dissonance: number };
  MelBands: (spectrum: any, ...args: any[]) => { bands: any };
  PitchSalience: (spectrum: any, ...args: any[]) => { pitchSalience: number };
  vectorToArray: (vector: any) => number[];
  // arrayToVector might be needed if cloning previousSpectrum
  // arrayToVector: (array: number[]) => any;
}

// Main function to extract all requested frame-based features
export async function extractFrameBasedFeatures(
  essentia: EssentiaInstance,
  audioData: Float32Array, // Expect Float32Array
  sampleRate: number,
  songId: string,
  featuresToExtract: string[] // List of frame-based feature IDs
): Promise<{ [key: string]: number | number[] | string }> { // Return aggregated features and errors

  console.log(`[FrameExtractor ${songId}] Starting. Features: [${featuresToExtract.join(', ')}]`);

  const frameSize = 2048;
  const hopSize = 1024;

  // --- Result Collectors ---
  const collectedFeatures: { [key: string]: number[] | number[][] } = {};
  featuresToExtract.forEach(key => {
      // Initialize based on expected output type
      if (['mfcc', 'spectralContrast', 'melBands'].includes(key)) {
          collectedFeatures[key] = [] as number[][]; // Store vectors
      } else {
          collectedFeatures[key] = [] as number[]; // Store numbers
      }
  });
  let previousSpectrum: any = null; // For SpectralFlux

  // --- Determine if peak detection is needed ---
  const requiresPeakDetection = featuresToExtract.some(f => ['inharmonicity', 'dissonance'].includes(f));
  console.log(`[FrameExtractor ${songId}] Requires Peak Detection: ${requiresPeakDetection}`);

  let frames: any = null; // Essentia FrameGenerator object
  const aggregatedResults: { [key: string]: number | number[] | string } = {}; // Store final results and errors

  try {
      // --- Framing ---
      console.log(`[FrameExtractor ${songId}] Generating frames... FrameSize: ${frameSize}, HopSize: ${hopSize}`);
      frames = essentia.FrameGenerator(audioData, frameSize, hopSize);
      const totalFrames = frames.size();
      console.log(`[FrameExtractor ${songId}] Generated ${totalFrames} frames.`);

      // --- Sampling Strategy ---
      const maxFramesToSample = 200;
      const frameStride = Math.max(1, Math.floor(totalFrames / maxFramesToSample));
      const framesToProcess = Math.min(maxFramesToSample, totalFrames);
      console.log(`[FrameExtractor ${songId}] Processing ${framesToProcess} sampled frames with stride ${frameStride}.`);

      // --- Frame Processing Loop ---
      for (let frameIdx = 0; frameIdx < framesToProcess; frameIdx++) {
          const actualFrameIdx = Math.min(Math.floor(frameIdx * frameStride), totalFrames - 1);

          let frame: any = null;
          let windowedFrame: any = null;
          let spectrumResult: any = null;
          let spectrumVec: any = null;
          let peaks: any = null;
          let peakFreqs: any = null;
          let peakMags: any = null;

          try {
              frame = frames.get(actualFrameIdx);

              // --- Common Pre-processing ---
              windowedFrame = essentia.Windowing(frame).frame;
              spectrumResult = essentia.Spectrum(windowedFrame);
              spectrumVec = spectrumResult.spectrum; // This is the spectrum for the current frame

              if (requiresPeakDetection) {
                  try {
                      peaks = essentia.SpectralPeaks(spectrumVec);
                      peakFreqs = peaks.frequencies;
                      peakMags = peaks.magnitudes;
                  } catch (peakError) {
                      console.warn(`[FrameExtractor ${songId}] Peak detection failed frame ${actualFrameIdx}:`, peakError);
                      if (peakFreqs) { peakFreqs.delete(); peakFreqs = null; }
                      if (peakMags) { peakMags.delete(); peakMags = null; }
                  }
              }

              // --- Individual Feature Extraction ---
              // MFCC
              if (featuresToExtract.includes('mfcc')) {
                  try {
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: Attempting MFCC calculation...`);
                      const mfccResult = essentia.MFCC(spectrumVec); // Using precomputed spectrumVec
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: MFCC Result type: ${typeof mfccResult?.mfcc}, Size: ${mfccResult?.mfcc?.size()}`);
                      if (!mfccResult || !mfccResult.mfcc || typeof mfccResult.mfcc.delete !== 'function') {
                           throw new Error('Invalid MFCC result object received from Essentia.');
                      }
                      const mfccVector = mfccResult.mfcc; // Get the Essentia vector
                      const mfccFloat32Array = essentia.vectorToArray(mfccVector);
                      const mfccFrame = Array.from(mfccFloat32Array); // Convert to standard number[]
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: Converted MFCC vector to array.`);
                      (collectedFeatures['mfcc'] as number[][]).push(mfccFrame);
                      mfccVector.delete(); // Delete the original Essentia vector
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: Deleted MFCC result vector.`);
                  } catch (e) {
                      // Log the specific MFCC error more clearly
                      const mfccErrorMsg = (e instanceof Error) ? e.message : String(e);
                      console.error(`[FrameExtractor ${songId}] MFCC specific error frame ${actualFrameIdx}: ${mfccErrorMsg}`, e);
                      console.warn(`[FrameExtractor ${songId}] MFCC failed frame ${actualFrameIdx}:`, e);
                  }
              }
              // SpectralCentroidTime
              if (featuresToExtract.includes('spectralCentroidTime')) {
                  try {
                      const centroidResult = essentia.SpectralCentroidTime(frame, sampleRate);
                      (collectedFeatures['spectralCentroidTime'] as number[]).push(centroidResult.centroid);
                  } catch (e) { console.warn(`[FrameExtractor ${songId}] SpectralCentroidTime failed frame ${actualFrameIdx}:`, e); }
              }
               // SpectralComplexity
              if (featuresToExtract.includes('spectralComplexity')) {
                  try {
                      const complexityResult = essentia.SpectralComplexity(spectrumVec, 0.005, sampleRate);
                      (collectedFeatures['spectralComplexity'] as number[]).push(complexityResult.spectralComplexity);
                  } catch (e) { console.warn(`[FrameExtractor ${songId}] SpectralComplexity failed frame ${actualFrameIdx}:`, e); }
              }
              // SpectralContrast
              if (featuresToExtract.includes('spectralContrast')) {
                  try {
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: Attempting SpectralContrast...`);
                      const contrastResult = essentia.SpectralContrast(spectrumVec, frameSize, 11000, 20, 0.4, 6, sampleRate, 0.15);
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: SpectralContrast result type: ${typeof contrastResult?.spectralContrast}, Size: ${contrastResult?.spectralContrast?.size()}`);
                      if (!contrastResult || !contrastResult.spectralContrast || typeof contrastResult.spectralContrast.delete !== 'function') {
                           throw new Error('Invalid SpectralContrast result object received from Essentia.');
                      }
                      // *** FIX: Explicitly convert Float32Array to number[] ***
                      const contrastVector = contrastResult.spectralContrast;
                      const contrastFloat32Array = essentia.vectorToArray(contrastVector);
                      const contrastFrame = Array.from(contrastFloat32Array);
                      // *********************************************************
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: SpectralContrast array (sample):`, contrastFrame.slice(0,3)); // Log first few values
                      (collectedFeatures['spectralContrast'] as number[][]).push(contrastFrame);
                      contrastVector.delete(); // Delete original vector
                      contrastResult.spectralValley.delete();
                      console.log(`[FrameExtractor ${songId}] Frame ${actualFrameIdx}: Deleted SpectralContrast vectors.`);
                  } catch (e) { 
                    const contrastErrorMsg = (e instanceof Error) ? e.message : String(e);
                    console.error(`[FrameExtractor ${songId}] SpectralContrast specific error frame ${actualFrameIdx}: ${contrastErrorMsg}`, e);
                }
              }
              // Inharmonicity
              if (featuresToExtract.includes('inharmonicity') && peakFreqs && peakMags && peakFreqs.size() > 0) {
                  // Additional check: Essentia's Inharmonicity requires the fundamental frequency (first peak) > 0 Hz
                  if (peakFreqs.get(0) === 0) {
                      console.warn(`[FrameExtractor ${songId}] Skipping Inharmonicity frame ${actualFrameIdx}: Fundamental frequency (peakFreqs[0]) is 0 Hz.`);
                  } else {
                      // Proceed only if fundamental frequency is valid
                      try {
                          const inharmResult = essentia.Inharmonicity(peakFreqs, peakMags);
                          (collectedFeatures['inharmonicity'] as number[]).push(inharmResult.inharmonicity);
                      } catch (e) {
                          // Enhanced error logging
                          const errorMsg = (e instanceof Error) ? e.message : String(e);
                          console.warn(`[FrameExtractor ${songId}] Inharmonicity failed frame ${actualFrameIdx}. Error: ${errorMsg}. Freqs size: ${peakFreqs?.size()}, Mags size: ${peakMags?.size()}. Raw error:`, e);
                      }
                  }
              }
              // Dissonance
              if (featuresToExtract.includes('dissonance') && peakFreqs && peakMags && peakFreqs.size() > 1) {
                  try {
                      const dissonResult = essentia.Dissonance(peakFreqs, peakMags);
                      (collectedFeatures['dissonance'] as number[]).push(dissonResult.dissonance);
                  } catch (e) { console.warn(`[FrameExtractor ${songId}] Dissonance failed frame ${actualFrameIdx}:`, e); }
              }
              // MelBands
              if (featuresToExtract.includes('melBands')) {
                  try {
                      const melBandsResult = essentia.MelBands(spectrumVec, 22050, spectrumVec.size(), false, 0, 'unit_sum', 24, sampleRate);
                      // *** FIX: Explicitly convert Float32Array to number[] ***
                      const melVector = melBandsResult.bands;
                      const melFloat32Array = essentia.vectorToArray(melVector);
                      const melFrame = Array.from(melFloat32Array);
                      // *********************************************************
                      (collectedFeatures['melBands'] as number[][]).push(melFrame);
                      melVector.delete(); // Delete original vector
                  } catch (e) { console.warn(`[FrameExtractor ${songId}] MelBands failed frame ${actualFrameIdx}:`, e); }
              }
              // PitchSalience
              if (featuresToExtract.includes('pitchSalience')) {
                  try {
                      const salienceResult = essentia.PitchSalience(spectrumVec, 5000, 100, sampleRate);
                      (collectedFeatures['pitchSalience'] as number[]).push(salienceResult.pitchSalience);
                  } catch (e) { console.warn(`[FrameExtractor ${songId}] PitchSalience failed frame ${actualFrameIdx}:`, e); }
              }

              // SpectralFlux
              if (featuresToExtract.includes('spectralFlux')) {
                  if (previousSpectrum) { // Can only calculate if there's a previous frame's spectrum
                      try {
                          // Assuming Flux takes the current spectrum and implicitly compares with an internal state or requires prior setup not shown
                          // Or, more likely, it calculates flux based on the difference between consecutive calls if the algorithm instance is stateful.
                          // Let's call it with the current spectrum, using defaults (L2 norm, no half-rectify)
                          const fluxResult = essentia.Flux(spectrumVec); 
                          (collectedFeatures['spectralFlux'] as number[]).push(fluxResult.flux);
                      } catch (e) {
                          console.warn(`[FrameExtractor ${songId}] SpectralFlux failed frame ${actualFrameIdx}:`, e);
                      }
                  } else {
                      // Cannot calculate flux for the very first frame
                      console.log(`[FrameExtractor ${songId}] Skipping SpectralFlux for first frame ${actualFrameIdx}.`);
                  }
              }

              // --- Update Previous Spectrum for Next Iteration (needed for Flux) ---
              // Should be the LAST step in the try block before finally
              if (previousSpectrum) {
                  // Delete the spectrum from the *previous* iteration first
                  previousSpectrum.delete();
              }
              // Then, make the *current* spectrum the *previous* one for the next loop
              // Important: Only assign if spectrumVec is valid
              if (spectrumVec) {
                previousSpectrum = spectrumVec;
              } else {
                // Ensure previousSpectrum is nullified if spectrumVec calculation failed
                previousSpectrum = null;
              }
              // ----------------------------------------------------------------------

          } catch (frameProcessingError) {
              console.error(`[FrameExtractor ${songId}] Error processing frame ${actualFrameIdx}:`, frameProcessingError);
          } finally {
              // --- Per-Frame Cleanup --- 
              if (frame) frame.delete();

              // --- Cleanup Current Spectrum ONLY if it wasn't carried over ---
              if (spectrumVec && spectrumVec !== previousSpectrum) {
                  // If spectrumVec is valid BUT wasn't assigned to previousSpectrum (e.g., error before assignment),
                  // it needs to be deleted here.
                  spectrumVec.delete();
              }
              // If spectrumVec === previousSpectrum, it's handled in the next iteration or the outer finally block.

              if (peaks) { /* result object itself doesn't need delete */ }
              if (peakFreqs) peakFreqs.delete();
              if (peakMags) peakMags.delete();
          }
      }
      // --- End Frame Processing Loop ---

      // --- Aggregation (After Loop) ---
      console.log(`[FrameExtractor ${songId}] Aggregating results...`);
      // *** ADD LOGGING HERE ***
      if (featuresToExtract.includes('mfcc')) {
          const collectedMfccData = collectedFeatures['mfcc'] as number[][];
          console.log(`[FrameExtractor ${songId}] Collected MFCC frames count: ${collectedMfccData?.length ?? 'N/A'}`);
          if (collectedMfccData?.length > 0 && collectedMfccData[0]) {
              console.log(`[FrameExtractor ${songId}] First collected MFCC frame (sample):`, collectedMfccData[0].slice(0, 5)); // Log first few coeffs of first frame
              console.log(`[FrameExtractor ${songId}] First collected MFCC frame length:`, collectedMfccData[0].length);
          }
      }

      if (featuresToExtract.includes('spectralContrast')) {
        const collectedContrastData = collectedFeatures['spectralContrast'] as number[][];
        console.log(`[FrameExtractor ${songId}] Collected SpectralContrast frames count: ${collectedContrastData?.length ?? 'N/A'}`);
        if (collectedContrastData?.length > 0 && collectedContrastData[0]) {
            console.log(`[FrameExtractor ${songId}] First collected SpectralContrast frame (sample):`, collectedContrastData[0].slice(0, 3));
            console.log(`[FrameExtractor ${songId}] First collected SpectralContrast frame length:`, collectedContrastData[0].length);
        }
      }
      // *** END LOGGING ***

      for (const key of featuresToExtract) {
          const collected = collectedFeatures[key];
          if (!collected || collected.length === 0) {
              console.warn(`[FrameExtractor ${songId}] No data collected for feature: ${key}`);
              aggregatedResults[`${key}Error`] = "No data collected";
              continue;
          };

          try {
              if (Array.isArray(collected[0])) { // Array of vectors
                  const vectors = collected as number[][];
                  const { means, stdDevs } = aggregateVectorFeature(vectors);
                  // Use more descriptive names based on feature key
                  aggregatedResults[`${key}Means`] = means; // e.g., mfccMeans
                  aggregatedResults[`${key}StdDevs`] = stdDevs; // e.g., mfccStdDevs
              } else { // Array of numbers
                  const values = collected as number[];
                  const featureMean = mean(values);
                  const featureStdDev = stdDev(values, featureMean);
                   // Use more descriptive names based on feature key
                  aggregatedResults[`${key}Mean`] = featureMean; // e.g., pitchSalienceMean
                  aggregatedResults[`${key}StdDev`] = featureStdDev;// e.g., pitchSalienceStdDev
              }
          } catch (aggregationError) {
               console.error(`[FrameExtractor ${songId}] Error aggregating feature ${key}:`, aggregationError);
               aggregatedResults[`${key}Error`] = `Aggregation failed: ${(aggregationError as Error).message}`;
          }
      }

  } catch (error) { // Catch for the main frame processing block
      // --- Enhanced Error Logging ---
      let errorMessage = 'Unknown frame processing error';
      if (error instanceof Error) {
          errorMessage = error.message;
          console.error(`[FrameExtractor ${songId}] Error Stack:`, error.stack); // Log stack trace
      } else {
          errorMessage = String(error);
      }
      console.error(`[FrameExtractor ${songId}] Full Error Object:`, error); // Log the full error object
      // -----------------------------
      console.error(`[FrameExtractor ${songId}] Unhandled error during frame processing:`, error);
      // Add a general error field to the results if the whole process fails
      aggregatedResults['frameProcessingError'] = `Frame processing failed: ${errorMessage}`;
  } finally {
      // --- Final Cleanup ---
      if (frames) frames.delete();
      if (previousSpectrum) previousSpectrum.delete(); // Cleanup spectrum from last iteration
      console.log(`[FrameExtractor ${songId}] Final cleanup complete.`);
  }

  console.log(`[FrameExtractor ${songId}] Completed. Returning aggregated features.`);
  return aggregatedResults;
}