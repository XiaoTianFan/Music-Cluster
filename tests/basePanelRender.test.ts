import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import BasePanel from '../src/components/ui/BasePanel';

test('BasePanel isolates its decorative glow from descendant controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      BasePanel,
      null,
      React.createElement('select', { 'aria-label': 'Activation' }, React.createElement('option', null, 'ReLU'))
    )
  );

  assert.match(html, /^<div[^>]+filter:none/);
  assert.match(html, /data-base-panel-glow="true"/);
  assert.match(html, /drop-shadow\(0 0 5px var\(--accent-primary\)\)/);
});
