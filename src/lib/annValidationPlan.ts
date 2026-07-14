import type { AnnValidationStrategy } from './annValidationGuidance';

export interface AnnValidationPlanItem {
  songId: string;
  label: string;
}

export interface AnnValidationFold {
  foldNumber: number;
  trainingSongIds: string[];
  validationSongIds: string[];
  validationLabelCounts: Array<{ label: string; count: number }>;
}

export interface AnnValidationPlan {
  strategy: AnnValidationStrategy;
  foldCount: number;
  totalSongCount: number;
  labelCount: number;
  folds: AnnValidationFold[];
}

export type AnnValidationPlanResult =
  | { plan: AnnValidationPlan; reason: null }
  | { plan: null; reason: string };

function groupItemsByLabel(items: readonly AnnValidationPlanItem[]): Map<string, AnnValidationPlanItem[]> {
  const groups = new Map<string, AnnValidationPlanItem[]>();
  for (const item of items) {
    const label = item.label.trim();
    const songId = item.songId.trim();
    if (!label || !songId) continue;
    const group = groups.get(label) ?? [];
    group.push({ songId, label });
    groups.set(label, group);
  }
  return groups;
}

function getDuplicateSongId(items: readonly AnnValidationPlanItem[]): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const songId = item.songId.trim();
    if (!songId) continue;
    if (seen.has(songId)) return songId;
    seen.add(songId);
  }
  return null;
}

function validateLabelGroups(groups: Map<string, AnnValidationPlanItem[]>): string | null {
  if (groups.size < 2) {
    return 'Validation needs at least two labels.';
  }

  for (const [label, group] of groups) {
    if (group.length < 2) {
      return `${label} has only ${group.length} labeled song${group.length === 1 ? '' : 's'}; validation needs at least 2 per label.`;
    }
  }

  return null;
}

function countValidationLabels(validationItems: readonly AnnValidationPlanItem[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of validationItems) {
    counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count }));
}

function createFold(
  foldIndex: number,
  allItems: readonly AnnValidationPlanItem[],
  validationItems: readonly AnnValidationPlanItem[],
): AnnValidationFold {
  const validationSongIds = validationItems.map(item => item.songId);
  const validationSongIdSet = new Set(validationSongIds);
  return {
    foldNumber: foldIndex + 1,
    trainingSongIds: allItems.filter(item => !validationSongIdSet.has(item.songId)).map(item => item.songId),
    validationSongIds,
    validationLabelCounts: countValidationLabels(validationItems),
  };
}

function createPlan(
  strategy: AnnValidationStrategy,
  allItems: readonly AnnValidationPlanItem[],
  groups: Map<string, AnnValidationPlanItem[]>,
  folds: AnnValidationFold[],
): AnnValidationPlanResult {
  return {
    plan: {
      strategy,
      foldCount: folds.length,
      totalSongCount: allItems.length,
      labelCount: groups.size,
      folds,
    },
    reason: null,
  };
}

function createLeaveOneOutPlan(
  allItems: readonly AnnValidationPlanItem[],
  groups: Map<string, AnnValidationPlanItem[]>,
): AnnValidationPlanResult {
  const folds = allItems.map((item, index) => createFold(index, allItems, [item]));
  return createPlan('leave-one-out', allItems, groups, folds);
}

function createKFoldPlan(
  allItems: readonly AnnValidationPlanItem[],
  groups: Map<string, AnnValidationPlanItem[]>,
  requestedFoldCount: number | null | undefined,
): AnnValidationPlanResult {
  const smallestLabelCount = Math.min(...Array.from(groups.values(), group => group.length));
  const foldCount = requestedFoldCount ?? Math.min(5, smallestLabelCount);

  if (!Number.isInteger(foldCount) || foldCount < 2) {
    return { plan: null, reason: 'K-fold validation needs at least 2 folds.' };
  }

  if (foldCount > smallestLabelCount) {
    return {
      plan: null,
      reason: `K-fold validation needs every label to have at least ${foldCount} songs.`,
    };
  }

  const validationGroups: AnnValidationPlanItem[][] = Array.from({ length: foldCount }, () => []);
  for (const group of groups.values()) {
    group.forEach((item, index) => {
      validationGroups[index % foldCount].push(item);
    });
  }

  const folds = validationGroups.map((validationItems, index) => createFold(index, allItems, validationItems));
  return createPlan('k-fold', allItems, groups, folds);
}

function createHoldoutPlan(
  allItems: readonly AnnValidationPlanItem[],
  groups: Map<string, AnnValidationPlanItem[]>,
  validationRatio: number,
): AnnValidationPlanResult {
  if (!Number.isFinite(validationRatio) || validationRatio <= 0 || validationRatio >= 1) {
    return { plan: null, reason: 'Holdout validation ratio must be greater than 0 and less than 1.' };
  }

  const validationItems: AnnValidationPlanItem[] = [];
  for (const group of groups.values()) {
    const validationCount = Math.min(group.length - 1, Math.max(1, Math.floor(group.length * validationRatio)));
    validationItems.push(...group.slice(0, validationCount));
  }

  return createPlan('holdout', allItems, groups, [createFold(0, allItems, validationItems)]);
}

export function createAnnValidationPlan({
  items,
  strategy,
  foldCount,
  validationRatio = 0.2,
}: {
  items: readonly AnnValidationPlanItem[];
  strategy: AnnValidationStrategy;
  foldCount?: number | null;
  validationRatio?: number;
}): AnnValidationPlanResult {
  const groups = groupItemsByLabel(items);
  const allItems = Array.from(groups.values()).flat();
  if (allItems.length === 0) {
    return { plan: null, reason: 'Validation needs labeled songs.' };
  }

  const duplicateSongId = getDuplicateSongId(allItems);
  if (duplicateSongId) {
    return { plan: null, reason: `Validation song IDs must be unique; duplicate found: ${duplicateSongId}.` };
  }

  const invalidReason = validateLabelGroups(groups);
  if (invalidReason) {
    return { plan: null, reason: invalidReason };
  }

  switch (strategy) {
    case 'leave-one-out':
      return createLeaveOneOutPlan(allItems, groups);
    case 'k-fold':
      return createKFoldPlan(allItems, groups, foldCount);
    case 'holdout':
      return createHoldoutPlan(allItems, groups, validationRatio);
    default:
      return strategy satisfies never;
  }
}
