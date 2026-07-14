import {
  getAnnModelComparisonGuidance,
  type AnnModelComparisonCoverageStatus,
  type AnnModelComparisonNextAction,
  type AnnModelComparisonRun,
} from './annModelComparison';
import type { TrainingInputKind } from './annPipeline';
import {
  parseAnnModelComparisonSnapshot,
  serializeAnnModelComparisonSnapshot,
} from './annModelComparisonStorage';

export interface AnnModelComparisonExportGuidanceCoverage {
  inputKind: TrainingInputKind;
  status: AnnModelComparisonCoverageStatus;
  runCount: number;
  bestRunId: string | null;
}

export interface AnnModelComparisonExportGuidance {
  headline: string;
  recommendation: string;
  nextAction: AnnModelComparisonNextAction;
  nextInputKind: TrainingInputKind | null;
  coverage: AnnModelComparisonExportGuidanceCoverage[];
}

export interface AnnModelComparisonExportPayload {
  schemaVersion: 1;
  exportedAt: string;
  runCount: number;
  guidance: AnnModelComparisonExportGuidance;
  runs: AnnModelComparisonRun[];
}

export type AnnModelComparisonImportResult =
  | { ok: true; runs: AnnModelComparisonRun[] }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createExportGuidance(runs: readonly AnnModelComparisonRun[]): AnnModelComparisonExportGuidance {
  const guidance = getAnnModelComparisonGuidance(runs);
  return {
    headline: guidance.headline,
    recommendation: guidance.recommendation,
    nextAction: guidance.nextAction,
    nextInputKind: guidance.nextInputKind,
    coverage: guidance.coverage.map(item => ({
      inputKind: item.inputKind,
      status: item.status,
      runCount: item.runCount,
      bestRunId: item.bestRun?.id ?? null,
    })),
  };
}

export function createAnnModelComparisonExportPayload({
  exportedAt,
  runs,
}: {
  exportedAt: string;
  runs: readonly AnnModelComparisonRun[];
}): AnnModelComparisonExportPayload {
  const snapshot = serializeAnnModelComparisonSnapshot(runs);
  return {
    schemaVersion: 1,
    exportedAt,
    runCount: snapshot.runs.length,
    guidance: createExportGuidance(snapshot.runs),
    runs: snapshot.runs,
  };
}

export function parseAnnModelComparisonImportPayload(raw: unknown): AnnModelComparisonImportResult {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        reason: 'Comparison import is not valid JSON.',
      };
    }
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      reason: 'Comparison import does not match the expected schema.',
    };
  }

  const possibleSnapshot = parsed.schemaVersion === 1
    ? { version: 1, runs: parsed.runs }
    : parsed;
  const snapshot = parseAnnModelComparisonSnapshot(possibleSnapshot);
  if (!snapshot) {
    return {
      ok: false,
      reason: 'Comparison import does not match the expected schema.',
    };
  }

  return {
    ok: true,
    runs: serializeAnnModelComparisonSnapshot(snapshot.runs).runs,
  };
}

export function createAnnModelComparisonExportFilename({
  exportedAt,
}: {
  exportedAt: string;
}): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  return `musiccluster-ann-comparison-history-${safeTimestamp}.json`;
}

export function downloadAnnModelComparisonExport({
  payload,
  filename,
}: {
  payload: AnnModelComparisonExportPayload;
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
