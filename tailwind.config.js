// songcluster/tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
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