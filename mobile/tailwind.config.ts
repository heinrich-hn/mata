import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { PluginAPI } from "tailwindcss/types/config";

// Import your breakpoint configuration
import { BREAKPOINTS, MOBILE_BREAKPOINT } from "./src/constants/breakpoints";

export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/**/*.css",
    "./index.html",
    "./src/**/*.jsx", // Add jsx files
    "./src/**/*.js",  // Add js files
  ],
  prefix: "",
  important: true, // Add this to ensure styles override
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: `${BREAKPOINTS.sm}px`,
        md: `${BREAKPOINTS.md}px`,
        lg: `${BREAKPOINTS.lg}px`,
        xl: `${BREAKPOINTS.xl}px`,
        "2xl": `${BREAKPOINTS["2xl"]}px`,
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["28px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        title: ["20px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        body: ["15px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.35" }],
        label: ["11px", { lineHeight: "1.2", letterSpacing: "0.08em" }],
      },
      screens: {
        xs: "480px",
        short: { raw: "(max-height: 500px)" },
        touch: { raw: "(hover: none) and (pointer: coarse)" },
        mobile: { max: `${MOBILE_BREAKPOINT - 1}px` },
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          hover: "hsl(var(--surface-hover))",
          active: "hsl(var(--surface-active))",
          subtle: "hsl(var(--surface-subtle))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      spacing: {
        touch: "44px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-out-to-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "scale-press": {
          from: { transform: "scale(1)" },
          to: { transform: "scale(0.97)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down var(--duration-normal) var(--ease-out)",
        "accordion-up": "accordion-up var(--duration-normal) var(--ease-out)",
        "fade-in": "fade-in var(--duration-fast) var(--ease-out)",
        "fade-out": "fade-out var(--duration-fast) var(--ease-out)",
        "slide-in-bottom": "slide-in-from-bottom var(--duration-normal) var(--ease-out)",
        "slide-out-bottom": "slide-out-to-bottom var(--duration-normal) var(--ease-in-out)",
        "scale-press": "scale-press var(--duration-fast) var(--ease-out) forwards",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      padding: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      zIndex: {
        fab: "40",
        modal: "50",
        popover: "30",
        tooltip: "20",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    function ({ addUtilities, theme }: PluginAPI) {
      addUtilities({
        ".touch-target": {
          "min-height": "44px",
          "min-width": "44px",
        },
        ".press-scale": {
          transition: `transform ${theme("transitionDuration.fast")} ${theme("transitionTimingFunction.out")}`,
          "&:active": {
            transform: "scale(0.97)",
          },
        },
        ".scroll-row": {
          display: "flex",
          "flex-wrap": "nowrap",
          "overflow-x": "auto",
          "-webkit-overflow-scrolling": "touch",
          "scrollbar-width": "none",
          "-ms-overflow-style": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
} satisfies Config;