// src/essentia.js.d.ts (or src/types/essentia.js.d.ts)

declare module 'essentia.js' {
    // Declare the factory function for the WASM module
    // It returns a Promise resolving to the Emscripten module instance
    export function EssentiaWASM(options?: Record<string, unknown>): Promise<EssentiaWASMModule>;
  
    // Declare the main Essentia class
    export class Essentia {
      constructor(wasmModule: EssentiaWASMModule);
  
      // Add common methods we know we'll use (can add more later)
      // Use 'unknown' for complex Essentia-specific types for now
      arrayToVector(data: number[] | Float32Array): unknown;
      vectorToArray(vector: unknown): unknown; // Adjust return type if known (e.g., number[] or number[][])
      MFCC(
          signal: unknown, 
          sampleRate?: number, 
          numCoefficients?: number, 
          numBands?: number, 
          lowFrequencyBound?: number, 
          highFrequencyBound?: number, 
          frameSize?: number, 
          hopSize?: number, 
          // ... add other parameters if needed
      ): { mfcc: unknown }; // Return type should be { mfcc: vector } which translates to unknown here
      
      // Add other algorithms as needed
      // ReplayGain(signal: any, sampleRate?: number): any;
  
      // Essential utility methods
      delete(): void;
      shutdown(): void;
  
      // Properties
      version: string;
      algorithmNames: string[];
  
      // Add other known properties or methods if necessary
    }
  
    // Define a placeholder type for the WASM module instance
    // This could be refined later if the structure is known
    interface EssentiaWASMModule {}
  
    // If there are other top-level exports from the module, declare them here
    // export const someOtherExport: any; 
  }