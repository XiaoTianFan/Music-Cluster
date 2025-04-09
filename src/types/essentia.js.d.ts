// src/essentia.js.d.ts (or src/types/essentia.js.d.ts)

declare module 'essentia.js' {
    // Declare the factory function for the WASM module
    // It returns a Promise resolving to the Emscripten module instance
    export function EssentiaWASM(options?: any): Promise<any>;
  
    // Declare the main Essentia class
    export class Essentia {
      constructor(wasmModule: any);
  
      // Add common methods we know we'll use (can add more later)
      // Use 'any' for complex Essentia-specific types for now
      arrayToVector(data: number[] | Float32Array): any;
      vectorToArray(vector: any): any; // Adjust return type if known (e.g., number[] or number[][])
      MFCC(
          signal: any, 
          sampleRate?: number, 
          numCoefficients?: number, 
          numBands?: number, 
          lowFrequencyBound?: number, 
          highFrequencyBound?: number, 
          frameSize?: number, 
          hopSize?: number, 
          // ... add other parameters if needed
      ): any; // Adjust return type if known (e.g., { mfcc: any })
      
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
  
    // If there are other top-level exports from the module, declare them here
    // export const someOtherExport: any; 
  }