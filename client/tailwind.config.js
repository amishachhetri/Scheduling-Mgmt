/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Public booking site design tokens ("light table" palette) -- unchanged, still only
      // used by the public site's own components.
      colors: {
        paper: { DEFAULT: '#F6F1E7', raised: '#FBF8F1', sunken: '#EEE6D4' },
        ink: { DEFAULT: '#1E1B16', soft: '#6B6255', faint: '#736A5A' },
        line: { DEFAULT: '#DAD0BE', strong: '#C6B99F' },
        accent: { DEFAULT: '#C1442B', soft: '#F3DCD2' },
        confirmed: { DEFAULT: '#5C7A5A', soft: '#E3EAE0' },
        pending: { DEFAULT: '#A9781E', soft: '#F3E7CE' },
        declined: { DEFAULT: '#8B4A3D', soft: '#EEDEDA' },

        // Admin tool palette. The admin's ~130 `sky-*`/`gray-*` utility classes are left
        // exactly as they are in every component -- these two overrides replace what those
        // class names actually render as, swapping Tailwind's stock saturated cyan-blue +
        // cool gray (the "generic SaaS dashboard" look) for a muted dusty-blue + warm stone
        // neutral that reads calmer without touching a single component file.
        sky: {
          50: '#F1F5F8', 100: '#E1E9EF', 200: '#C7D6E0', 300: '#A3BDCE', 400: '#7A9FB8',
          500: '#5C87A3', 600: '#47708C', 700: '#3A5C73', 800: '#2F4A5D', 900: '#283E4D', 950: '#1A2933'
        },
        gray: {
          50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1', 400: '#A8A29E',
          500: '#78716C', 600: '#57534E', 700: '#44403C', 800: '#292524', 900: '#1C1917', 950: '#0C0A09'
        }
      },
      fontFamily: {
        display: ['Georgia', '"Iowan Old Style"', '"Times New Roman"', 'serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', '"Courier New"', 'monospace']
      }
    }
  },
  plugins: []
}

