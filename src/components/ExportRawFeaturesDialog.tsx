'use client';

import React, { useEffect, useState, useCallback } from 'react';
import BasePanel from './ui/BasePanel';
import Button from './ui/Button';
import type { ExportFormat } from '@/lib/exportRawFeatureMatrix';

interface ExportRawFeaturesDialogProps {
  isOpen: boolean;
  columnLabels: string[];
  onClose: () => void;
  onConfirm: (selectedIndices: number[], format: ExportFormat) => void;
}

const ExportRawFeaturesDialog: React.FC<ExportRawFeaturesDialogProps> = ({
  isOpen,
  columnLabels,
  onClose,
  onConfirm,
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('csv');

  useEffect(() => {
    if (isOpen && columnLabels.length > 0) {
      setSelected(new Set(columnLabels.map((_, i) => i)));
      setFormat('csv');
    }
  }, [isOpen, columnLabels]);

  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const toggleIndex = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(columnLabels.map((_, i) => i)));
  }, [columnLabels]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleExport = () => {
    if (selected.size === 0) return;
    onConfirm([...selected].sort((a, b) => a - b), format);
    onClose();
  };

  if (!isOpen) return null;

  const panelClassName = 'text-gray-100 shadow-xl max-w-xl w-full relative';
  const panelStyle: React.CSSProperties = {
    '--aug-border-bg': 'var(--foreground)',
  } as React.CSSProperties;
  const panelDataAugmentedUi = 'tl-clip-x tr-round br-clip bl-round border';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <BasePanel
        className={panelClassName}
        data-augmented-ui={panelDataAugmentedUi}
        style={panelStyle}
        onClick={handleDialogClick}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold leading-none p-1"
          aria-label="Close export dialog"
        >
          &times;
        </button>

        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-[var(--accent-primary)]">Export raw features</h2>

          <p className="text-sm text-gray-300 mb-4">
            Choose which matrix dimensions to include and the file format. Values come from the current raw feature
            matrix.
          </p>

          <div className="flex gap-2 mb-3">
            <Button type="button" variant="secondary" className="px-3 py-0.5 text-xs" onClick={selectAll}>
              All
            </Button>
            <Button type="button" variant="secondary" className="px-3 py-0.5 text-xs" onClick={clearAll}>
              Clear
            </Button>
          </div>

          <div
            className="text-sm text-gray-300 overflow-y-auto max-h-60 pr-2 mb-4 border border-gray-600/50 rounded-sm p-2"
            role="group"
            aria-label="Feature dimensions"
          >
            {columnLabels.map((label, index) => (
              <label
                key={`${label}-${index}`}
                className="flex items-start gap-2 py-1 px-0.5 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => toggleIndex(index)}
                  className="mt-0.5 shrink-0 accent-[var(--accent-primary)]"
                />
                <span className="break-all">
                  <span className="text-gray-500 mr-2 tabular-nums">{index}</span>
                  {label}
                </span>
              </label>
            ))}
          </div>

          <fieldset className="mb-4 text-sm text-gray-300">
            <legend className="text-gray-400 mb-2">Format</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="accent-[var(--accent-primary)]"
                />
                CSV
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="accent-[var(--accent-primary)]"
                />
                JSON
              </label>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleExport}
              disabled={selected.size === 0}
            >
              Export
            </Button>
          </div>
        </div>
      </BasePanel>
    </div>
  );
};

export default ExportRawFeaturesDialog;
