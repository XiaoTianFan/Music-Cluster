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

  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const panelClassName = 'text-gray-100 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col relative';
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
          className="absolute top-2 right-2 text-gray-400 hover:text-[var(--accent-primary)] text-2xl font-bold p-1 leading-none z-10"
          aria-label="Close export dialog"
        >
          &times;
        </button>

        <div className="p-6 flex flex-col min-h-0 flex-1">
          <h3 className="text-xl font-semibold mb-2 text-[var(--accent-primary)] font-mono">
            Export raw features
          </h3>
          <p className="text-xs text-gray-400 mb-4 font-mono">
            Choose matrix dimensions and file format. Values come from the current raw feature matrix.
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
            className="flex-1 overflow-y-auto border border-[var(--accent-primary)]/40 rounded-sm p-2 mb-4 max-h-[40vh] font-mono text-xs"
            role="group"
            aria-label="Feature dimensions"
          >
            {columnLabels.map((label, index) => (
              <label
                key={`${label}-${index}`}
                className="flex items-start gap-2 py-1 px-1 hover:bg-white/5 cursor-pointer text-[var(--accent-primary)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => toggleIndex(index)}
                  className="mt-0.5 shrink-0"
                />
                <span className="break-all">
                  <span className="text-gray-500 mr-2">{index}</span>
                  {label}
                </span>
              </label>
            ))}
          </div>

          <fieldset className="mb-4 font-mono text-sm">
            <legend className="text-gray-400 mb-2">Format</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-[var(--accent-primary)] cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
                CSV
              </label>
              <label className="flex items-center gap-2 text-[var(--accent-primary)] cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                />
                JSON
              </label>
            </div>
          </fieldset>

          <div className="flex gap-2 mt-auto">
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
