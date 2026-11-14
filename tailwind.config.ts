import type { Config } from "tailwindcss";

// "Almanac" theme. One hue (OKLCH degrees) drives the whole site, shared with
// joeflynnpm.com (amber, 70): the neutrals are warm near-greys carrying a
// whisper of that hue, and the accent is the hue at full chroma.
//
// The class names are still Tailwind's gray / slate / blue so every existing
// `dark:` variant keeps working: gray = light-mode neutrals, slate = dark-mode
// neutrals, blue = the accent ladder (amber here, despite the name).
// Change HUE to re-theme everything. The <alpha-value> placeholder keeps
// opacity modifiers like bg-white/70 working.
const HUE = 70;
const o = (l: number, c: number) => `oklch(${l} ${c} ${HUE} / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: ["var(--font-display)", "Georgia", '"Times New Roman"', "serif"],
      },
      colors: {
        // Paper: the light page surface, a touch warmer than white.
        paper: o(0.985, 0.006),
        gray: {
          50: o(0.985, 0.006),
          100: o(0.965, 0.007),
          200: o(0.92, 0.008),
          300: o(0.87, 0.009),
          400: o(0.71, 0.01),
          500: o(0.55, 0.01),
          600: o(0.44, 0.01),
          700: o(0.37, 0.009),
          800: o(0.28, 0.008),
          900: o(0.21, 0.006),
          950: o(0.15, 0.005),
        },
        // Dark ladder matches joeflynnpm.com: 950 background, 900 card, 800 border.
        slate: {
          50: o(0.985, 0.003),
          100: o(0.965, 0.004),
          200: o(0.92, 0.006),
          300: o(0.87, 0.007),
          400: o(0.71, 0.008),
          500: o(0.55, 0.008),
          600: o(0.45, 0.008),
          700: o(0.37, 0.007),
          800: o(0.27, 0.006),
          900: o(0.22, 0.005),
          950: o(0.17, 0.004),
        },
        // Accent ladder. 400 is the dark-mode accent (the site's amber);
        // 600/700 are deepened so accent text passes AA on paper.
        blue: {
          50: o(0.975, 0.02),
          100: o(0.95, 0.045),
          200: o(0.9, 0.085),
          300: o(0.84, 0.13),
          400: o(0.77, 0.165),
          500: o(0.68, 0.155),
          600: o(0.53, 0.125),
          700: o(0.46, 0.108),
          800: o(0.39, 0.09),
          900: o(0.32, 0.07),
          950: o(0.25, 0.05),
        },
      },
    },
  },
  plugins: [],
};

export default config;
