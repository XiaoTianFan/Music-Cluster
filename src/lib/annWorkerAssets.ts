export const annWorkerAssets = {
  essentia: '/workers/essentia-worker.bundled.js',
  dataProcessing: '/workers/data-processing-worker.bundled.js',
  druid: '/workers/druid-worker.bundled.js',
  mlp: '/workers/mlp-worker.bundled.js',
} as const;

export const annWorkerAssetPaths = Object.values(annWorkerAssets);
