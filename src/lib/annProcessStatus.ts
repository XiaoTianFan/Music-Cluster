export interface AnnProcessStatusInput {
  allWorkersReady: boolean;
  isExtracting: boolean;
  isProcessingData: boolean;
  isReducing: boolean;
  isTraining: boolean;
  isTrainingSessionActive?: boolean;
  isInferring: boolean;
  isValidating?: boolean;
  isAnalyzingPermutationImportance?: boolean;
}

export type AnnProcessStatusTone = 'loading' | 'active' | 'ready';

export interface AnnProcessStatus {
  text: string;
  tone: AnnProcessStatusTone;
}

export function getAnnProcessStatus(input: AnnProcessStatusInput): AnnProcessStatus {
  if (!input.allWorkersReady) return { text: 'Initializing Workers...', tone: 'loading' };
  if (input.isExtracting) return { text: 'Extracting Features...', tone: 'active' };
  if (input.isProcessingData) return { text: 'Processing Data...', tone: 'active' };
  if (input.isReducing) return { text: 'Reducing Dimensions...', tone: 'active' };
  if (input.isTraining) return { text: 'Training Network...', tone: 'active' };
  if (input.isTrainingSessionActive) return { text: 'Training Paused - Ready to Advance', tone: 'active' };
  if (input.isInferring) return { text: 'Inferring Labels...', tone: 'active' };
  if (input.isValidating) return { text: 'Running Validation...', tone: 'active' };
  if (input.isAnalyzingPermutationImportance) return { text: 'Analyzing Feature Impact...', tone: 'active' };
  return { text: 'Ready', tone: 'ready' };
}
