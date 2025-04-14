import React from 'react';
import TiltWrapper from '../effects/TiltWrapper';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  idleOpacity?: number;
  enableTilt?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  disabled,
  idleOpacity = 90,
  enableTilt = false,
  ...props
}) => {
  // Map variants to their CSS variables
  const variantVars = {
    primary: {
      accent: 'var(--accent-primary)',
      glow: 'var(--glow-primary)',
      active: 'var(--accent-primary-active)',
    },
    secondary: {
      accent: 'var(--accent-secondary)',
      glow: 'var(--glow-secondary)',
      active: 'var(--accent-secondary-active)',
    },
    tertiary: {
      accent: 'var(--accent-tertiary)',
      glow: 'var(--glow-tertiary)',
      active: 'var(--accent-tertiary-active)',
    },
  };

  const vars = variantVars[variant];

  // Combine Tailwind classes - Corrected background syntax
  const combinedClassName = `
    relative inline-flex items-center justify-center 
    px-2 py-1
    text-sm font-medium 
    cursor-pointer
    transition-all duration-150 ease-in-out 
    ${!disabled ? 'disabled:cursor-not-allowed' : ''}
    
    // Idle State: Transparent background, accent text color.
    ${!disabled ? `bg-transparent text-[${vars.accent}]` : ''}
    
    // Hover State: SOLID ACCENT background, on-accent text, shadow
    ${!disabled ? `hover:bg-[${vars.accent}] hover:text-[var(--text-on-accent)] hover:shadow-[0_0_8px_2px_${vars.glow}]` : ''}
    
    // Active State: SOLID ACTIVE ACCENT background, on-accent text
    ${!disabled ? `active:bg-[${vars.active}] active:text-[var(--text-on-accent)]` : ''}
    
    // Disabled State: Use Tailwind for border, text, opacity. Transparent BG.
    disabled:border disabled:border-[var(--text-disabled)] disabled:text-[var(--text-disabled)] disabled:opacity-[var(--disabled-opacity)] disabled:bg-transparent disabled:cursor-not-allowed
    
    ${className} 
  `.trim().replace(/\s+/g, ' '); 

  // Define augmented-ui specific styles - ONLY BORDER
  const augmentedStyles: React.CSSProperties = {
    // Border:
    '--aug-border-all': '1px',
    '--aug-border-bg': vars.accent,
  } as React.CSSProperties;

  const buttonElement = (
    <button
      className={combinedClassName}
      style={augmentedStyles}
      data-variant={variant}
      data-augmented-ui="tl-clip br-clip border"
      disabled={disabled}
      {...props} 
    >
      {children}
    </button>
  );

  // Conditionally wrap with TiltWrapper if enableTilt is true and button is not disabled
  return enableTilt && !disabled ? (
    <TiltWrapper tiltEnable={!disabled} className="inline-flex w-full">
      {buttonElement}
    </TiltWrapper>
  ) : (
    buttonElement
  );
};

export default Button; 