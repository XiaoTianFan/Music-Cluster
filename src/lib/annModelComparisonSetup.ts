import {
  getAnnModelComparisonGuidance,
  type AnnModelComparisonRun,
} from './annModelComparison';
import type {
  ProcessingMethod,
  ReductionMethod,
  TrainingInputKind,
} from './annPipeline';

export interface AnnModelComparisonSetupSettings {
  processingMethod: ProcessingMethod;
  useDimensionalityReduction: boolean;
  reductionMethod: ReductionMethod;
  targetDimensions: 2 | 3;
}

export interface AnnModelComparisonSetupSuggestion {
  targetInputKind: TrainingInputKind | null;
  canApplySetup: boolean;
  actionLabel: string;
  summary: string;
  nextStep: string;
  settings: AnnModelComparisonSetupSettings | null;
  clearsProcessedData: boolean;
  clearsReducedData: boolean;
}

const setupByInputKind: Record<TrainingInputKind, AnnModelComparisonSetupSettings> = {
  raw: {
    processingMethod: 'none',
    useDimensionalityReduction: false,
    reductionMethod: 'pca',
    targetDimensions: 2,
  },
  processed: {
    processingMethod: 'standardize',
    useDimensionalityReduction: false,
    reductionMethod: 'pca',
    targetDimensions: 2,
  },
  reduced: {
    processingMethod: 'standardize',
    useDimensionalityReduction: true,
    reductionMethod: 'pca',
    targetDimensions: 2,
  },
};

const labelByInputKind: Record<TrainingInputKind, string> = {
  raw: 'Raw',
  processed: 'Processed',
  reduced: 'PCA',
};

const summaryByInputKind: Record<TrainingInputKind, string> = {
  raw: 'Use raw feature vectors directly for the next comparison run.',
  processed: 'Use standardize processing before training the next comparison run.',
  reduced: 'Use standardize processing with PCA reduction before training the next comparison run.',
};

const nextStepByInputKind: Record<TrainingInputKind, string> = {
  raw: 'After applying this setup, click Train Network to create the raw comparison run.',
  processed: 'After applying this setup, click Process Data, then Train Network to create the processed comparison run.',
  reduced: 'After applying this setup, click Process Data, Reduce Dimensions, then Train Network to create the PCA comparison run.',
};

export function getAnnModelComparisonSetupSuggestion(
  runs: readonly AnnModelComparisonRun[]
): AnnModelComparisonSetupSuggestion {
  const guidance = getAnnModelComparisonGuidance(runs);
  if (guidance.nextInputKind === null) {
    return {
      targetInputKind: null,
      canApplySetup: false,
      actionLabel: 'Compare Evaluated Runs',
      summary: 'All raw, processed, and reduced pipelines have evaluated runs.',
      nextStep: 'Compare dataset accuracy, validation accuracy, confidence flags, and warnings before choosing a model.',
      settings: null,
      clearsProcessedData: false,
      clearsReducedData: false,
    };
  }

  const targetInputKind = guidance.nextInputKind;
  return {
    targetInputKind,
    canApplySetup: true,
    actionLabel: `Apply ${labelByInputKind[targetInputKind]} Setup`,
    summary: summaryByInputKind[targetInputKind],
    nextStep: nextStepByInputKind[targetInputKind],
    settings: setupByInputKind[targetInputKind],
    clearsProcessedData: true,
    clearsReducedData: true,
  };
}
