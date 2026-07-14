import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ModeSwitchLink from '../src/components/ModeSwitchLink';

test('ModeSwitchLink points Cluster mode to ANN mode', () => {
  const html = renderToStaticMarkup(React.createElement(ModeSwitchLink, { currentMode: 'cluster' }));

  assert.match(html, /href="\/ann"/);
  assert.match(html, /aria-label="Switch to Neural Network mode"/);
  assert.match(html, /data-mode-switch-to="ann"/);
});

test('ModeSwitchLink points ANN mode to Cluster mode', () => {
  const html = renderToStaticMarkup(React.createElement(ModeSwitchLink, { currentMode: 'ann' }));

  assert.match(html, /href="\/"/);
  assert.match(html, /aria-label="Switch to Cluster mode"/);
  assert.match(html, /data-mode-switch-to="cluster"/);
});
