// MFCC feature extraction module for Essentia.js worker

// Helper function to calculate mean
export const mean = (arr: number[]): number => arr.reduce((acc, val) => acc + val, 0) / arr.length;

// Helper function to calculate standard deviation
export const stdDev = (arr: number[], arrMean: number): number => {
  if (arr.length === 0) return 0; // Avoid division by zero
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - arrMean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

// MFCC extraction from audio data
export async function extractMFCC(
  essentia: any,
  audioData: Float32Array,
  sampleRate: number,
  songId: string
): Promise<{ mfccMeans: number[], mfccStdDevs: number[] }> {
  console.log(`[MFCC] Setting up frame processing for ${songId}...`);
  const frameSize = 2048;
  const hopSize = 1024;
  
  let mfccs: number[][] = [];
  
  // Use FrameGenerator with Float32Array directly as per documentation
  console.log(`[MFCC] Using FrameGenerator for ${songId}...`);
  
  try {
    // Generate frames using FrameGenerator - IMPORTANT: it expects a Float32Array directly
    const frames = essentia.FrameGenerator(audioData, frameSize, hopSize);
    const totalFrames = frames.size();
    console.log(`[MFCC] Generated ${totalFrames} frames for ${songId}`);
    
    // Sample frames throughout the song instead of just the first few
    const maxFramesToSample = 100; // Sample 100 frames spread throughout the song
    
    // Calculate sampling stride to distribute frames evenly
    const frameStride = Math.max(1, Math.floor(totalFrames / maxFramesToSample));
    const framesToProcess = Math.min(maxFramesToSample, totalFrames);
    
    console.log(`[MFCC] Will process ${framesToProcess} frames with stride ${frameStride} for ${songId}`);
    
    // Process sampled frames
    for (let frameIdx = 0; frameIdx < framesToProcess; frameIdx++) {
      // Calculate the actual frame index using the stride to spread throughout the song
      const actualFrameIdx = Math.min(Math.floor(frameIdx * frameStride), totalFrames - 1);
      
      try {
        const frame = frames.get(actualFrameIdx);
        
        // Compute spectrum
        const spectrum = essentia.Spectrum(frame);
        
        // Compute MFCC
        const mfccResult = essentia.MFCC(spectrum.spectrum);
        
        // Convert to array and add to results
        const frameMfccs = essentia.vectorToArray(mfccResult.mfcc);
        mfccs.push(frameMfccs);
        
        // Clean up
        spectrum.spectrum.delete();
        mfccResult.mfcc.delete();
      } catch (frameError) {
        console.error(`[MFCC] Error processing frame ${actualFrameIdx} for ${songId}:`, frameError);
        // Continue with next frame
      }
      
      // Log progress occasionally
      if (frameIdx % 100 === 0) {
        console.log(`[MFCC] Processed ${frameIdx}/${framesToProcess} frames for ${songId}`);
      }
    }
    
    // Clean up frames
    frames.delete();
  } catch (framesError) {
    console.error(`[MFCC] Error using FrameGenerator for ${songId}:`, framesError);
    throw new Error(`FrameGenerator failed: ${(framesError as Error).message || String(framesError)}`);
  }
  
  // Check if we extracted any features
  if (!mfccs || mfccs.length === 0 || !mfccs[0]) {
    console.error(`[MFCC] Calculation empty or invalid format for ${songId}`);
    throw new Error(`Failed to extract any valid MFCC features for ${songId}`);
  }

  console.log(`[MFCC] Calculating stats for ${songId}...`);
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

  console.log(`[MFCC] Completed feature extraction for ${songId}`);
  return {
    mfccMeans,
    mfccStdDevs,
  };
} 