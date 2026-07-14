import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnUploadedDatasetReattachmentReviewConfirmation,
  getAnnUploadedDatasetReattachmentReviewSections,
  getAnnUploadedDatasetReattachmentReviewVisibleSections,
  type AnnUploadedDatasetReattachmentReviewSummaryInput,
} from '../src/lib/annUploadedDatasetReattachmentReview';

test('getAnnUploadedDatasetReattachmentReviewSections builds metadata-rich and legacy sections', () => {
  const summary: AnnUploadedDatasetReattachmentReviewSummaryInput = {
    attachedNames: ['Lead Guitar.wav'],
    missingNames: ['Room Take.mp3'],
    unmatchedFileNames: ['Other.wav'],
    skippedNames: ['Bad Notes.txt'],
    attachedFiles: [{ name: 'Lead Guitar.wav', externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' }],
    missingFiles: [{ name: 'Room Take.mp3', externalId: 'browser-file:room-take-mp3:4096:1780000001000' }],
    unmatchedFiles: [{ name: 'Other.wav', externalId: 'browser-file:other-wav:1024:1780000002000' }],
  };

  const sections = getAnnUploadedDatasetReattachmentReviewSections(summary);

  assert.deepEqual(sections.map(section => ({
    key: section.key,
    label: section.label,
    itemLabel: section.itemLabel,
    needsAttention: section.needsAttention,
    items: section.items,
  })), [
    {
      key: 'attached',
      label: 'Attached',
      itemLabel: 'attached file',
      needsAttention: false,
      items: [{ name: 'Lead Guitar.wav', externalId: 'browser-file:lead-guitar-wav:2048:1780000000000' }],
    },
    {
      key: 'missing',
      label: 'Still missing',
      itemLabel: 'still-missing file',
      needsAttention: true,
      items: [{ name: 'Room Take.mp3', externalId: 'browser-file:room-take-mp3:4096:1780000001000' }],
    },
    {
      key: 'extra',
      label: 'Extra selected',
      itemLabel: 'extra selected file',
      needsAttention: true,
      items: [{ name: 'Other.wav', externalId: 'browser-file:other-wav:1024:1780000002000' }],
    },
    {
      key: 'skipped',
      label: 'Skipped',
      itemLabel: 'skipped file',
      needsAttention: true,
      items: [{ name: 'Bad Notes.txt' }],
    },
  ]);
});

test('getAnnUploadedDatasetReattachmentReviewSections filters review status slices', () => {
  const summary: AnnUploadedDatasetReattachmentReviewSummaryInput = {
    attachedNames: ['Lead Guitar.wav'],
    missingNames: ['Room Take.mp3'],
    unmatchedFileNames: ['Other.wav'],
    skippedNames: ['Bad Notes.txt'],
  };

  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewSections(summary, 'needs-attention').map(section => section.key),
    ['missing', 'extra', 'skipped']
  );
  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewSections(summary, 'attached').map(section => section.key),
    ['attached']
  );
  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewSections(summary, 'missing').map(section => section.key),
    ['missing']
  );
  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewSections({
      attachedNames: [],
      missingNames: [],
      unmatchedFileNames: [],
      skippedNames: [],
    }),
    []
  );
});

test('getAnnUploadedDatasetReattachmentReviewConfirmation confirms clean reattachments', () => {
  const confirmation = getAnnUploadedDatasetReattachmentReviewConfirmation({
    attachedNames: ['Lead Guitar.wav', 'Room Take.mp3'],
    missingNames: [],
    unmatchedFileNames: [],
    skippedNames: [],
  });

  assert.deepEqual(confirmation, {
    status: 'ready',
    label: 'Ready to continue',
    message: '2 uploaded files reattached. Re-extract features before training.',
    toneClassName: 'text-green-300',
    attachedCount: 2,
    attentionCount: 0,
    missingCount: 0,
    extraCount: 0,
    skippedCount: 0,
  });
});

test('getAnnUploadedDatasetReattachmentReviewConfirmation flags incomplete or empty reattachments', () => {
  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewConfirmation({
      attachedNames: ['Lead Guitar.wav'],
      missingNames: ['Room Take.mp3'],
      unmatchedFileNames: ['Other.wav'],
      skippedNames: ['Bad Notes.txt'],
    }),
    {
      status: 'needs-attention',
      label: 'Needs attention',
      message: '1 uploaded file reattached, but 3 selected items still need review before training.',
      toneClassName: 'text-yellow-300',
      attachedCount: 1,
      attentionCount: 3,
      missingCount: 1,
      extraCount: 1,
      skippedCount: 1,
    }
  );

  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewConfirmation({
      attachedNames: [],
      missingNames: [],
      unmatchedFileNames: [],
      skippedNames: [],
    }),
    {
      status: 'no-change',
      label: 'No files reattached',
      message: 'Select matching uploaded audio files or re-import setup before training on the uploaded dataset.',
      toneClassName: 'text-yellow-300',
      attachedCount: 0,
      attentionCount: 0,
      missingCount: 0,
      extraCount: 0,
      skippedCount: 0,
    }
  );
});

test('getAnnUploadedDatasetReattachmentReviewConfirmation records deliberate partial continuation', () => {
  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewConfirmation({
      attachedNames: ['Lead Guitar.wav'],
      missingNames: ['Room Take.mp3'],
      unmatchedFileNames: ['Other.wav'],
      skippedNames: ['Bad Notes.txt'],
      continuedWithAttached: true,
    }),
    {
      status: 'continued',
      label: 'Continuing with attached files',
      message: '1 uploaded file reattached. 3 selected items were left out of this ANN setup.',
      toneClassName: 'text-green-300',
      attachedCount: 1,
      attentionCount: 3,
      missingCount: 1,
      extraCount: 1,
      skippedCount: 1,
    }
  );
});

test('getAnnUploadedDatasetReattachmentReviewVisibleSections searches large reviews before previewing', () => {
  const sections = getAnnUploadedDatasetReattachmentReviewVisibleSections({
    attachedNames: ['Lead Guitar.wav', 'Bass.wav'],
    missingNames: ['Room Take.mp3', 'Cello Stem.wav', 'Hidden Fifth.wav', 'Piano Stem.wav', 'Vocal Stem.wav'],
    unmatchedFileNames: ['Other.wav'],
    skippedNames: [],
  }, {
    statusFilter: 'needs-attention',
    searchQuery: 'hidden',
    previewLimit: 4,
  });

  assert.deepEqual(sections.map(section => ({
    key: section.key,
    itemNames: section.visibleItems.map(item => item.name),
    hiddenCount: section.hiddenCount,
    totalCount: section.totalCount,
    isExpanded: section.isExpanded,
  })), [
    {
      key: 'missing',
      itemNames: ['Hidden Fifth.wav'],
      hiddenCount: 0,
      totalCount: 1,
      isExpanded: false,
    },
  ]);
});

test('getAnnUploadedDatasetReattachmentReviewVisibleSections previews and expands large sections', () => {
  const review: AnnUploadedDatasetReattachmentReviewSummaryInput = {
    attachedNames: ['Lead Guitar.wav', 'Bass.wav', 'Drums.wav', 'Keys.wav', 'Hidden Fifth.wav'],
    missingNames: [],
    unmatchedFileNames: [],
    skippedNames: [],
  };

  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewVisibleSections(review, {
      previewLimit: 4,
    }).map(section => ({
      key: section.key,
      itemNames: section.visibleItems.map(item => item.name),
      hiddenCount: section.hiddenCount,
      totalCount: section.totalCount,
      isExpanded: section.isExpanded,
    })),
    [
      {
        key: 'attached',
        itemNames: ['Lead Guitar.wav', 'Bass.wav', 'Drums.wav', 'Keys.wav'],
        hiddenCount: 1,
        totalCount: 5,
        isExpanded: false,
      },
    ]
  );

  assert.deepEqual(
    getAnnUploadedDatasetReattachmentReviewVisibleSections(review, {
      expandedSectionKeys: ['attached'],
      previewLimit: 4,
    }).map(section => ({
      key: section.key,
      itemNames: section.visibleItems.map(item => item.name),
      hiddenCount: section.hiddenCount,
      totalCount: section.totalCount,
      isExpanded: section.isExpanded,
    })),
    [
      {
        key: 'attached',
        itemNames: ['Lead Guitar.wav', 'Bass.wav', 'Drums.wav', 'Keys.wav', 'Hidden Fifth.wav'],
        hiddenCount: 0,
        totalCount: 5,
        isExpanded: true,
      },
    ]
  );
});
