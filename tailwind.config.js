// songcluster/tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
    safelist: [
      // Idle text colors
      'text-[var(--accent-primary)]',
      'text-[var(--accent-secondary)]',
      'text-[var(--accent-tertiary)]',
      // Hover background colors
      'hover:bg-[var(--accent-primary)]',
      'hover:bg-[var(--accent-secondary)]',
      'hover:bg-[var(--accent-tertiary)]',
      // Active background colors
      'active:bg-[var(--accent-primary-active)]',
      'active:bg-[var(--accent-secondary-active)]',
      'active:bg-[var(--accent-tertiary-active)]',
      // Hover shadows (using the exact string format Tailwind expects for arbitrary values)
      'hover:shadow-[0_0_8px_2px_var(--glow-primary)]',
      'hover:shadow-[0_0_8px_2px_var(--glow-secondary)]',
      'hover:shadow-[0_0_8px_2px_var(--glow-tertiary)]',
      // Optional: Hover/Active text colors (likely not needed, but safe to include)
      'hover:text-[var(--text-on-accent)]',
      'active:text-[var(--text-on-accent)]',
      
      // === General Colors & Opacity (from globals.css) ===
      // Backgrounds
      'bg-[var(--background)]',
      'bg-[var(--panel-background)]',
      'bg-[var(--panel-hover-background)]',
      'bg-[var(--panel-active-background)]', // Same as panel-background, but include for completeness
      // Text
      'text-[var(--text-primary)]',
      'text-[var(--text-secondary)]',
      'text-[var(--text-disabled)]',
      // Borders
      'border-[var(--text-disabled)]', // Used in Button disabled state
      'border-[var(--secondary-primary)]',
      // Opacity
      'opacity-[var(--disabled-opacity)]', // Used in Button disabled state
      
      // === Added for VisualizationPanel Controls ===
      'focus:border-[var(--accent-secondary)]', 
      'focus:ring-[var(--accent-secondary)]/50',
    ],
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}", // Adjust if you use 'pages' dir
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}", // Standard for App Router
    ],
    theme: {
      extend: {
        // Add any custom theme extensions here if needed
        // For example, extending colors, fonts, etc.
        colors: {
          // You might define your cyberpunk/neon colors here
        },
      },
    },
    plugins: [
      require('@tailwindcss/typography'), // Add the typography plugin
      // Add any other Tailwind plugins you might use
    ],
  }