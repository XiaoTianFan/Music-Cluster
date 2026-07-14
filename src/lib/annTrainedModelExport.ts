import type { AnnModelComparisonRun } from './annModelComparison';
import {
  parseAnnModelComparisonSnapshot,
  serializeAnnModelComparisonSnapshot,
} from './annModelComparisonStorage';
import type { TrainingInputKind, TrainingPipelineSnapshot } from './annPipeline';
import type { AnnTrainingSummary } from './annTrainingSummary';

export interface AnnTrainedModelWorkerArtifacts {
  modelTopology: {};
  weightSpecs: unknown[];
  weightData: ArrayBuffer;
  format?: string;
  generatedBy?: string;
  convertedBy?: string | null;
}

export interface AnnTrainedModelInputData {
  inputKind: TrainingInputKind;
  songIds: string[];
  vectors: number[][];
}

export interface AnnTrainedModelLabelAssignments {
  assignedSongCount: number;
  namedLists: Record<string, string[]>;
}

export interface AnnTrainedModelExportPayload {
  schemaVersion: 1;
  kind: 'musiccluster-ann-trained-model';
  exportedAt: string;
  portabilityNote: string;
  training: AnnTrainingSummary;
  pipeline: TrainingPipelineSnapshot;
  modelInput: AnnTrainedModelInputData;
  labelAssignments: AnnTrainedModelLabelAssignments;
  outputLabels: string[];
  model: {
    modelTopology: {};
    weightSpecs: unknown[];
    weightDataBase64: string;
    weightDataByteLength: number;
    format?: string;
    generatedBy?: string;
    convertedBy?: string | null;
  };
  comparisonRun: AnnModelComparisonRun | null;
}

export type AnnTrainedModelImportResult =
  | {
      ok: true;
      trainingSummary: AnnTrainingSummary;
      pipelineSnapshot: TrainingPipelineSnapshot;
      modelInput: AnnTrainedModelInputData;
      labelAssignments: AnnTrainedModelLabelAssignments | null;
      modelArtifacts: AnnTrainedModelWorkerArtifacts;
      outputLabels: string[];
      comparisonRun: AnnModelComparisonRun | null;
    }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(value, 'base64'));
    }

    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function cloneModelInput(modelInput: AnnTrainedModelInputData): AnnTrainedModelInputData {
  return {
    inputKind: modelInput.inputKind,
    songIds: [...modelInput.songIds],
    vectors: modelInput.vectors.map(vector => [...vector]),
  };
}

function cloneLabelAssignments(assignments: AnnTrainedModelLabelAssignments): AnnTrainedModelLabelAssignments {
  return {
    assignedSongCount: assignments.assignedSongCount,
    namedLists: Object.fromEntries(
      Object.entries(assignments.namedLists).map(([label, songIds]) => [label, [...songIds]])
    ),
  };
}

function cloneComparisonRun(run: AnnModelComparisonRun): AnnModelComparisonRun {
  return serializeAnnModelComparisonSnapshot([run]).runs[0];
}

function createLabelAssignments({
  namedLists,
  outputLabels,
  modelInputSongIds,
}: {
  namedLists: Record<string, ReadonlySet<string>>;
  outputLabels: readonly string[];
  modelInputSongIds: readonly string[];
}): AnnTrainedModelLabelAssignments {
  const allowedSongIds = new Set(modelInputSongIds);
  const seenSongIds = new Set<string>();
  const assignments: Record<string, string[]> = {};

  for (const label of outputLabels) {
    const sourceSongIds = namedLists[label] ?? new Set<string>();
    const assignedSongIds = Array.from(sourceSongIds).filter(songId => allowedSongIds.has(songId));
    assignments[label] = assignedSongIds;
    for (const songId of assignedSongIds) seenSongIds.add(songId);
  }

  return {
    assignedSongCount: seenSongIds.size,
    namedLists: assignments,
  };
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasLegacyComparisonRunStub(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string'
    && typeof value.runNumber === 'number'
    && typeof value.trainedAt === 'string'
    && typeof value.reviewStatus === 'string'
    && typeof value.note === 'string';
}

function hasFullComparisonRunSignal(value: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(value, 'inputKind')
    || Object.prototype.hasOwnProperty.call(value, 'inputDimension')
    || Object.prototype.hasOwnProperty.call(value, 'selectedFeatureIds')
    || Object.prototype.hasOwnProperty.call(value, 'trainingAccuracy')
    || Object.prototype.hasOwnProperty.call(value, 'warningCodes');
}

function getOutputLabelsFromLabelMap(labelMap: Record<string, number>): string[] | null {
  const entries = Object.entries(labelMap);
  if (entries.length === 0) return null;
  const seenIndexes = new Set<number>();
  for (const [label, index] of entries) {
    if (!label.trim() || !Number.isInteger(index) || index < 0 || seenIndexes.has(index)) {
      return null;
    }
    seenIndexes.add(index);
  }
  return entries
    .sort(([, left], [, right]) => left - right)
    .map(([label]) => label);
}

function hasFiniteMatrix(vectors: unknown, songIds: unknown, expectedDimension: number): boolean {
  return Array.isArray(vectors)
    && Array.isArray(songIds)
    && vectors.length > 0
    && songIds.length === vectors.length
    && songIds.every(songId => typeof songId === 'string' && songId.trim() !== '')
    && vectors.every(vector => (
      Array.isArray(vector)
      && vector.length === expectedDimension
      && vector.every(value => typeof value === 'number' && Number.isFinite(value))
    ));
}

function validateTrainingSummary(value: unknown): value is AnnTrainingSummary {
  return isRecord(value)
    && ['raw', 'processed', 'reduced'].includes(String(value.inputKind))
    && Array.isArray(value.selectedFeatureIds)
    && typeof value.inputDimension === 'number'
    && Number.isInteger(value.inputDimension)
    && value.inputDimension > 0
    && typeof value.classCount === 'number'
    && Number.isInteger(value.classCount)
    && value.classCount >= 2
    && typeof value.labeledSongCount === 'number'
    && Number.isInteger(value.labeledSongCount)
    && value.labeledSongCount >= value.classCount
    && Array.isArray(value.labelCounts)
    && Array.isArray(value.warnings)
    && typeof value.hiddenLayers === 'number'
    && Array.isArray(value.nodesPerLayer)
    && typeof value.activation === 'string'
    && typeof value.optimizer === 'string'
    && typeof value.learningRate === 'number'
    && typeof value.epochs === 'number'
    && typeof value.splitRatio === 'number'
    && typeof value.validationRatio === 'number'
    && typeof value.batchSize === 'number'
    && typeof value.seed === 'number';
}

function validatePipelineSnapshot(value: unknown): value is TrainingPipelineSnapshot {
  if (!isRecord(value)) return false;
  if (!['raw', 'processed', 'reduced'].includes(String(value.inputKind))) return false;
  if (!isRecord(value.rawMatrix) || !isRecord(value.rawStructure)) return false;
  if (!isRecord(value.labelMap)) return false;
  if (!Array.isArray(value.songIds) || typeof value.inputDimension !== 'number') return false;
  const rawMatrix = value.rawMatrix;
  const rawColumnLabels = Array.isArray(rawMatrix.columnLabels) ? rawMatrix.columnLabels : [];
  return hasFiniteMatrix(rawMatrix.vectors, rawMatrix.songIds, rawColumnLabels.length)
    && value.songIds.every(songId => typeof songId === 'string')
    && Number.isInteger(value.inputDimension)
    && value.inputDimension > 0
    && getOutputLabelsFromLabelMap(value.labelMap as Record<string, number>) !== null;
}

function validateModelInput(value: unknown, expectedKind: TrainingInputKind, expectedDimension: number): value is AnnTrainedModelInputData {
  return isRecord(value)
    && value.inputKind === expectedKind
    && hasFiniteMatrix(value.vectors, value.songIds, expectedDimension);
}

function validateLabelAssignments(
  value: unknown,
  expectedLabels: readonly string[],
  modelInputSongIds: readonly string[]
): AnnTrainedModelLabelAssignments | null {
  if (!isRecord(value) || !isRecord(value.namedLists) || !Number.isInteger(value.assignedSongCount)) return null;
  const assignedSongCount = value.assignedSongCount as number;
  if (assignedSongCount < 0) return null;

  const allowedSongIds = new Set(modelInputSongIds);
  const seenSongIds = new Set<string>();
  const namedLists: Record<string, string[]> = {};
  const expectedLabelSet = new Set(expectedLabels);
  const providedLabels = Object.keys(value.namedLists);

  if (
    providedLabels.length !== expectedLabels.length
    || providedLabels.some(label => !expectedLabelSet.has(label))
  ) {
    return null;
  }

  for (const label of expectedLabels) {
    const songIds = value.namedLists[label];
    if (!Array.isArray(songIds)) return null;

    const labelSongIds: string[] = [];
    const seenLabelSongIds = new Set<string>();
    for (const songId of songIds) {
      if (
        typeof songId !== 'string'
        || songId.trim() === ''
        || !allowedSongIds.has(songId)
        || seenSongIds.has(songId)
        || seenLabelSongIds.has(songId)
      ) {
        return null;
      }
      seenSongIds.add(songId);
      seenLabelSongIds.add(songId);
      labelSongIds.push(songId);
    }
    namedLists[label] = labelSongIds;
  }

  if (seenSongIds.size !== assignedSongCount) return null;

  return {
    assignedSongCount: seenSongIds.size,
    namedLists,
  };
}

function parseComparisonRun(
  value: unknown,
  trainingSummary: AnnTrainingSummary
):
  | { ok: true; comparisonRun: AnnModelComparisonRun | null }
  | { ok: false; reason: string } {
  if (value === undefined || value === null) {
    return { ok: true, comparisonRun: null };
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      reason: 'Trained model import comparison context does not match the expected schema.',
    };
  }

  const snapshot = parseAnnModelComparisonSnapshot({
    version: 1,
    runs: [value],
  });
  if (!snapshot || snapshot.runs.length !== 1) {
    if (hasLegacyComparisonRunStub(value) && !hasFullComparisonRunSignal(value)) {
      return { ok: true, comparisonRun: null };
    }
    return {
      ok: false,
      reason: 'Trained model import comparison context does not match the expected schema.',
    };
  }

  const [comparisonRun] = snapshot.runs;
  if (
    comparisonRun.inputKind !== trainingSummary.inputKind
    || comparisonRun.inputDimension !== trainingSummary.inputDimension
    || !stringArraysEqual(comparisonRun.selectedFeatureIds, trainingSummary.selectedFeatureIds)
  ) {
    return {
      ok: false,
      reason: 'Trained model import comparison context does not match the saved training metadata.',
    };
  }

  return { ok: true, comparisonRun };
}

export function createAnnTrainedModelExportPayload({
  exportedAt,
  trainingSummary,
  pipelineSnapshot,
  modelInput,
  namedLists,
  modelArtifacts,
  outputLabels,
  comparisonRun,
}: {
  exportedAt: string;
  trainingSummary: AnnTrainingSummary;
  pipelineSnapshot: TrainingPipelineSnapshot;
  modelInput: AnnTrainedModelInputData;
  namedLists: Record<string, ReadonlySet<string>>;
  modelArtifacts: AnnTrainedModelWorkerArtifacts;
  outputLabels: readonly string[];
  comparisonRun?: AnnModelComparisonRun | null;
}): AnnTrainedModelExportPayload {
  const weightBytes = new Uint8Array(modelArtifacts.weightData);
  const clonedModelInput = cloneModelInput(modelInput);
  return {
    schemaVersion: 1,
    kind: 'musiccluster-ann-trained-model',
    exportedAt,
    portabilityNote: 'This file contains ANN model topology, weights, and pipeline metadata. It does not contain uploaded audio bytes; uploaded songs may still need reattachment for new feature extraction.',
    training: cloneJson(trainingSummary),
    pipeline: cloneJson(pipelineSnapshot),
    modelInput: clonedModelInput,
    labelAssignments: createLabelAssignments({
      namedLists,
      outputLabels,
      modelInputSongIds: clonedModelInput.songIds,
    }),
    outputLabels: [...outputLabels],
    model: {
      modelTopology: cloneJson(modelArtifacts.modelTopology),
      weightSpecs: cloneJson(modelArtifacts.weightSpecs),
      weightDataBase64: bytesToBase64(weightBytes),
      weightDataByteLength: weightBytes.byteLength,
      format: modelArtifacts.format,
      generatedBy: modelArtifacts.generatedBy,
      convertedBy: modelArtifacts.convertedBy,
    },
    comparisonRun: comparisonRun ? cloneComparisonRun(comparisonRun) : null,
  };
}

export function parseAnnTrainedModelImportPayload(raw: unknown): AnnTrainedModelImportResult {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'Trained model import is not valid JSON.' };
    }
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || parsed.kind !== 'musiccluster-ann-trained-model') {
    return { ok: false, reason: 'Trained model import does not match the expected schema.' };
  }
  if (!validateTrainingSummary(parsed.training)) {
    return { ok: false, reason: 'Trained model import has invalid training metadata.' };
  }
  if (!validatePipelineSnapshot(parsed.pipeline)) {
    return { ok: false, reason: 'Trained model import has an invalid training pipeline snapshot.' };
  }
  if (!validateModelInput(parsed.modelInput, parsed.pipeline.inputKind, parsed.pipeline.inputDimension)) {
    return { ok: false, reason: 'Trained model import has invalid model input rows.' };
  }
  if (!isRecord(parsed.model) || !isRecord(parsed.model.modelTopology) || !Array.isArray(parsed.model.weightSpecs)) {
    return { ok: false, reason: 'Trained model import is missing model topology or weight specs.' };
  }
  if (typeof parsed.model.weightDataBase64 !== 'string' || !Number.isInteger(parsed.model.weightDataByteLength)) {
    return { ok: false, reason: 'Trained model import is missing model weight data.' };
  }

  const outputLabels = Array.isArray(parsed.outputLabels)
    ? parsed.outputLabels.filter(label => typeof label === 'string' && label.trim() !== '')
    : [];
  const expectedLabels = getOutputLabelsFromLabelMap(parsed.pipeline.labelMap);
  if (
    !expectedLabels
    || outputLabels.length !== expectedLabels.length
    || outputLabels.some((label, index) => label !== expectedLabels[index])
  ) {
    return { ok: false, reason: 'Trained model import output labels do not match the saved label map.' };
  }

  const labelAssignments = Object.prototype.hasOwnProperty.call(parsed, 'labelAssignments')
    ? validateLabelAssignments(parsed.labelAssignments, expectedLabels, parsed.modelInput.songIds)
    : null;
  if (Object.prototype.hasOwnProperty.call(parsed, 'labelAssignments') && !labelAssignments) {
    return { ok: false, reason: 'Trained model import label assignments do not match the saved model input rows.' };
  }

  const weightBytes = base64ToBytes(parsed.model.weightDataBase64);
  if (!weightBytes || weightBytes.byteLength !== parsed.model.weightDataByteLength || weightBytes.byteLength === 0) {
    return { ok: false, reason: 'Trained model import has invalid model weight data.' };
  }

  const comparisonRun = parseComparisonRun(parsed.comparisonRun, parsed.training);
  if (!comparisonRun.ok) {
    return { ok: false, reason: comparisonRun.reason };
  }

  return {
    ok: true,
    trainingSummary: cloneJson(parsed.training),
    pipelineSnapshot: cloneJson(parsed.pipeline),
    modelInput: cloneModelInput(parsed.modelInput),
    labelAssignments: labelAssignments ? cloneLabelAssignments(labelAssignments) : null,
    modelArtifacts: {
      modelTopology: cloneJson(parsed.model.modelTopology),
      weightSpecs: cloneJson(parsed.model.weightSpecs),
      weightData: (() => {
        const buffer = new ArrayBuffer(weightBytes.byteLength);
        new Uint8Array(buffer).set(weightBytes);
        return buffer;
      })(),
      format: typeof parsed.model.format === 'string' ? parsed.model.format : undefined,
      generatedBy: typeof parsed.model.generatedBy === 'string' ? parsed.model.generatedBy : undefined,
      convertedBy: typeof parsed.model.convertedBy === 'string' || parsed.model.convertedBy === null
        ? parsed.model.convertedBy
        : undefined,
    },
    outputLabels,
    comparisonRun: comparisonRun.comparisonRun ? cloneComparisonRun(comparisonRun.comparisonRun) : null,
  };
}

export function createAnnTrainedModelExportFilename({
  exportedAt,
  runNumber,
}: {
  exportedAt: string;
  runNumber?: number | null;
}): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  const runPart = runNumber === undefined || runNumber === null ? '' : `-run-${runNumber}`;
  return `musiccluster-ann-trained-model${runPart}-${safeTimestamp}.json`;
}

export function downloadAnnTrainedModelExport({
  payload,
  filename,
}: {
  payload: AnnTrainedModelExportPayload;
  filename: string;
}): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
