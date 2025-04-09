// songcluster/webpack.worker.config.js
const path = require('path');

module.exports = {
  // Target the webworker environment
  target: 'webworker',
  // Entry point for the worker script
  entry: './src/workers/essentia-worker.ts',
  output: {
    // Output directory for the bundled worker (inside public)
    path: path.resolve(__dirname, 'public/workers'),
    // Output filename
    filename: 'essentia-worker.bundled.js',
    // Important for WASM loading within worker
    publicPath: '/workers/' 
  },
  resolve: {
    // Add '.ts' and '.js' as resolvable extensions.
    extensions: ['.ts', '.js'],
    // Add fallbacks for Node.js core modules used by essentia.js and its dependencies
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "fs": false, // Provide an empty module for fs
      "vm": require.resolve("vm-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/") // Note the trailing slash for buffer
    }
  },
  module: {
    rules: [
      // Rule to handle TypeScript files
      {
        test: /\.ts$/,
        loader: 'ts-loader', // Use loader property for options
        exclude: /node_modules/,
        options: {
          // Point ts-loader to the worker-specific tsconfig
          configFile: 'tsconfig.worker.json'
        }
      },
    ],
  },
  // Enable experiments for async WebAssembly (often needed for WASM in workers)
  experiments: {
      asyncWebAssembly: true,
      // If using top-level await in worker (like for initialization)
      // topLevelAwait: true // Uncomment if needed
  },
  // Development mode for easier debugging
  mode: 'development',
  // Optional: Generate source maps for debugging
  devtool: 'source-map', 
};