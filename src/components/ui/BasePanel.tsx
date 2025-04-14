import React, { DragEventHandler } from 'react';

// Extend HTMLAttributes<HTMLDivElement> to accept all standard div props like event handlers
interface BasePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  // style prop is already included in React.HTMLAttributes<HTMLDivElement>
  // Explicitly keep React.CSSProperties for clarity if preferred, but it might be redundant.
  // style?: React.CSSProperties; 
  'data-augmented-ui'?: string;
  // Event handlers like onDragOver, onDrop etc. are covered by React.HTMLAttributes
}

const BasePanel: React.FC<BasePanelProps> = ({
  children,
  className = '',
  style, // style comes from props now (included in HTMLAttributes)
  'data-augmented-ui': dataAugmentedUi = 'tl-clip tr-clip br-clip bl-clip border inlay',
  ...rest // <-- Capture rest of the props (including event handlers)
}) => {
  // Combine default classes, augmented-ui styles, and passed className
  const combinedClassName = `
    p-4 relative
    before:absolute before:inset-0 before:bg-red-500 before:content-[\'\'] // DEBUG: Solid red, no blur, no z-index
    ${className} 
  `.trim();

  // Define augmented-ui specific styles using CSS variables
  // Apply these to the main element, which will be *above* the pseudo-element
  const augmentedStyles: React.CSSProperties = {
    // Keep base augmented styles for now, but the attribute is commented out below
    '--aug-border-all': '3px', 
    '--aug-border-bg': `var(--foreground)`, 
    '--aug-border-opacity': `0.9`, 
    filter: `drop-shadow(0 0 5px var(--accent-primary))`, 
    '--aug-inlay-all': '10px', 
    '--aug-inlay-bg': `var(--background)`,
    '--aug-inlay-opacity': '0.0', 
    '--aug-tl': '20px', 
    '--aug-tr': '20px', 
    '--aug-br': '20px', 
    '--aug-bl': '20px',
    ...style, // Spread the incoming style prop here to allow overrides on the main element
  } as React.CSSProperties;

  return (
    <div
      className={combinedClassName} // Contains base, pseudo-element, and custom classes
      data-augmented-ui={dataAugmentedUi} // <-- Restore augmented-ui attribute
      style={augmentedStyles}
      {...rest} // <-- Spread the rest of the props (like onDragOver, etc.) onto the div
    >
      {/* Render children inside the panel, implicitly above the ::before pseudo-element */}
      {children}
    </div>
  );
};

export default BasePanel; 