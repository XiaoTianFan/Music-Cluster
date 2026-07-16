'use client';

import React from 'react';

interface AppFooterProps {
  onAbout: () => void;
}

const AppFooter: React.FC<AppFooterProps> = ({ onAbout }) => (
  <footer
    className="mt-2 flex h-10 min-h-10 max-h-10 w-full flex-shrink-0 items-center justify-center gap-4 border-t border-gray-700 p-2 text-center text-xs text-gray-500"
    data-app-footer
    data-augmented-ui="tl-clip tr-clip border"
    style={{ '--aug-border-color': '#444', '--aug-border-bg': 'transparent' } as React.CSSProperties}
  >
    <a
      href="https://xiaotianfanx.com"
      target="_blank"
      rel="noopener noreferrer"
      className="transition-colors hover:text-gray-400"
    >
      Copyright (c) 2025 Xiaotian Fan, As33
    </a>
    <span>|</span>
    <a
      href="https://github.com/XiaoTianFan/Music-Cluster"
      target="_blank"
      rel="noopener noreferrer"
      className="transition-colors hover:text-gray-400"
    >
      GitHub Repository
    </a>
    <span>|</span>
    <button
      type="button"
      onClick={onAbout}
      className="cursor-pointer transition-colors hover:text-gray-400"
    >
      About
    </button>
  </footer>
);

export default AppFooter;
