export type AnnUploadedDatasetReattachmentReviewFilter =
  | 'all'
  | 'needs-attention'
  | 'attached'
  | 'missing'
  | 'extra'
  | 'skipped';

export type AnnUploadedDatasetReattachmentReviewSectionKey =
  | 'attached'
  | 'missing'
  | 'extra'
  | 'skipped';

export interface AnnUploadedDatasetReattachmentReviewFile {
  name: string;
  externalId?: string;
}

export interface AnnUploadedDatasetReattachmentReviewSummaryInput {
  attachedNames: readonly string[];
  missingNames: readonly string[];
  unmatchedFileNames: readonly string[];
  skippedNames: readonly string[];
  attachedFiles?: readonly AnnUploadedDatasetReattachmentReviewFile[];
  missingFiles?: readonly AnnUploadedDatasetReattachmentReviewFile[];
  unmatchedFiles?: readonly AnnUploadedDatasetReattachmentReviewFile[];
  skippedFiles?: readonly AnnUploadedDatasetReattachmentReviewFile[];
  continuedWithAttached?: boolean;
}

export interface AnnUploadedDatasetReattachmentReviewSection {
  key: AnnUploadedDatasetReattachmentReviewSectionKey;
  label: string;
  toneClassName: string;
  itemLabel: string;
  needsAttention: boolean;
  items: readonly AnnUploadedDatasetReattachmentReviewFile[];
}

export interface AnnUploadedDatasetReattachmentReviewVisibleSection extends AnnUploadedDatasetReattachmentReviewSection {
  visibleItems: readonly AnnUploadedDatasetReattachmentReviewFile[];
  hiddenCount: number;
  totalCount: number;
  isExpanded: boolean;
}

export interface AnnUploadedDatasetReattachmentReviewViewOptions {
  statusFilter?: AnnUploadedDatasetReattachmentReviewFilter;
  searchQuery?: string;
  expandedSectionKeys?: readonly AnnUploadedDatasetReattachmentReviewSectionKey[];
  previewLimit?: number;
}

export type AnnUploadedDatasetReattachmentReviewConfirmationStatus =
  | 'ready'
  | 'needs-attention'
  | 'no-change'
  | 'continued';

export interface AnnUploadedDatasetReattachmentReviewConfirmation {
  status: AnnUploadedDatasetReattachmentReviewConfirmationStatus;
  label: string;
  message: string;
  toneClassName: string;
  attachedCount: number;
  attentionCount: number;
  missingCount: number;
  extraCount: number;
  skippedCount: number;
}

function getReattachmentFileReviewItems(
  names: readonly string[],
  files?: readonly AnnUploadedDatasetReattachmentReviewFile[]
): readonly AnnUploadedDatasetReattachmentReviewFile[] {
  return files && files.length > 0 ? files : names.map(name => ({ name }));
}

function sectionMatchesFilter(
  key: AnnUploadedDatasetReattachmentReviewSectionKey,
  filter: AnnUploadedDatasetReattachmentReviewFilter
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs-attention':
      return key !== 'attached';
    case 'attached':
    case 'missing':
    case 'extra':
    case 'skipped':
      return key === filter;
    default:
      return filter satisfies never;
  }
}

export function getAnnUploadedDatasetReattachmentReviewSections(
  review: AnnUploadedDatasetReattachmentReviewSummaryInput,
  filter: AnnUploadedDatasetReattachmentReviewFilter = 'all'
): readonly AnnUploadedDatasetReattachmentReviewSection[] {
  const sections: readonly AnnUploadedDatasetReattachmentReviewSection[] = [
    {
      key: 'attached',
      label: 'Attached',
      toneClassName: 'text-green-300',
      itemLabel: 'attached file',
      needsAttention: false,
      items: getReattachmentFileReviewItems(review.attachedNames, review.attachedFiles),
    },
    {
      key: 'missing',
      label: 'Still missing',
      toneClassName: 'text-yellow-300',
      itemLabel: 'still-missing file',
      needsAttention: true,
      items: getReattachmentFileReviewItems(review.missingNames, review.missingFiles),
    },
    {
      key: 'extra',
      label: 'Extra selected',
      toneClassName: 'text-yellow-300',
      itemLabel: 'extra selected file',
      needsAttention: true,
      items: getReattachmentFileReviewItems(review.unmatchedFileNames, review.unmatchedFiles),
    },
    {
      key: 'skipped',
      label: 'Skipped',
      toneClassName: 'text-red-300',
      itemLabel: 'skipped file',
      needsAttention: true,
      items: getReattachmentFileReviewItems(review.skippedNames, review.skippedFiles),
    },
  ];

  return sections.filter(section => (
    section.items.length > 0 && sectionMatchesFilter(section.key, filter)
  ));
}

export function getAnnUploadedDatasetReattachmentReviewVisibleSections(
  review: AnnUploadedDatasetReattachmentReviewSummaryInput,
  {
    statusFilter = 'all',
    searchQuery = '',
    expandedSectionKeys = [],
    previewLimit = 4,
  }: AnnUploadedDatasetReattachmentReviewViewOptions = {}
): readonly AnnUploadedDatasetReattachmentReviewVisibleSection[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const expandedKeys = new Set(expandedSectionKeys);
  const normalizedLimit = Math.max(1, Math.floor(previewLimit));

  return getAnnUploadedDatasetReattachmentReviewSections(review, statusFilter)
    .map(section => {
      const searchedItems = normalizedQuery
        ? section.items.filter(item => (
          item.name.toLowerCase().includes(normalizedQuery)
          || (item.externalId ?? '').toLowerCase().includes(normalizedQuery)
        ))
        : section.items;
      const isExpanded = expandedKeys.has(section.key);
      const visibleItems = isExpanded ? searchedItems : searchedItems.slice(0, normalizedLimit);
      return {
        ...section,
        items: searchedItems,
        visibleItems,
        hiddenCount: Math.max(0, searchedItems.length - visibleItems.length),
        totalCount: searchedItems.length,
        isExpanded,
      };
    })
    .filter(section => section.totalCount > 0);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function leftOutPhrase(count: number): string {
  return `${pluralize(count, 'selected item')} ${count === 1 ? 'was' : 'were'} left out of this ANN setup.`;
}

function needsReviewPhrase(count: number): string {
  return `${pluralize(count, 'selected item')} still ${count === 1 ? 'needs' : 'need'} review before training.`;
}

export function getAnnUploadedDatasetReattachmentReviewConfirmation(
  review: AnnUploadedDatasetReattachmentReviewSummaryInput
): AnnUploadedDatasetReattachmentReviewConfirmation {
  const attachedCount = getReattachmentFileReviewItems(review.attachedNames, review.attachedFiles).length;
  const missingCount = getReattachmentFileReviewItems(review.missingNames, review.missingFiles).length;
  const extraCount = getReattachmentFileReviewItems(review.unmatchedFileNames, review.unmatchedFiles).length;
  const skippedCount = getReattachmentFileReviewItems(review.skippedNames, review.skippedFiles).length;
  const attentionCount = missingCount + extraCount + skippedCount;

  if (review.continuedWithAttached && attachedCount > 0) {
    return {
      status: 'continued',
      label: 'Continuing with attached files',
      message: `${pluralize(attachedCount, 'uploaded file')} reattached. ${leftOutPhrase(attentionCount)}`,
      toneClassName: 'text-green-300',
      attachedCount,
      attentionCount,
      missingCount,
      extraCount,
      skippedCount,
    };
  }

  if (attentionCount > 0) {
    return {
      status: 'needs-attention',
      label: 'Needs attention',
      message: `${pluralize(attachedCount, 'uploaded file')} reattached, but ${needsReviewPhrase(attentionCount)}`,
      toneClassName: 'text-yellow-300',
      attachedCount,
      attentionCount,
      missingCount,
      extraCount,
      skippedCount,
    };
  }

  if (attachedCount > 0) {
    return {
      status: 'ready',
      label: 'Ready to continue',
      message: `${pluralize(attachedCount, 'uploaded file')} reattached. Re-extract features before training.`,
      toneClassName: 'text-green-300',
      attachedCount,
      attentionCount,
      missingCount,
      extraCount,
      skippedCount,
    };
  }

  return {
    status: 'no-change',
    label: 'No files reattached',
    message: 'Select matching uploaded audio files or re-import setup before training on the uploaded dataset.',
    toneClassName: 'text-yellow-300',
    attachedCount,
    attentionCount,
    missingCount,
    extraCount,
    skippedCount,
  };
}
