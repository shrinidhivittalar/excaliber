import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height, var(--accordion-panel-height, auto))" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height, var(--accordion-panel-height, auto))" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    plugin(function({ addVariant }) {
      addVariant("data-open", [
        "&:where([data-state='open'])",
        "&:where([data-open]:not([data-open='false']))",
      ]);
      addVariant("data-closed", [
        "&:where([data-state='closed'])",
        "&:where([data-closed]:not([data-closed='false']))",
      ]);
      addVariant("data-checked", [
        "&:where([data-state='checked'])",
        "&:where([data-checked]:not([data-checked='false']))",
      ]);
      addVariant("data-unchecked", [
        "&:where([data-state='unchecked'])",
        "&:where([data-unchecked]:not([data-unchecked='false']))",
      ]);
      addVariant("data-selected", "&:where([data-selected='true'])");
      addVariant("data-disabled", [
        "&:where([data-disabled='true'])",
        "&:where([data-disabled]:not([data-disabled='false']))",
      ]);
      addVariant("data-active", [
        "&:where([data-state='active'])",
        "&:where([data-active]:not([data-active='false']))",
      ]);
      addVariant("data-horizontal", "&:where([data-orientation='horizontal'])");
      addVariant("data-vertical", "&:where([data-orientation='vertical'])");
    }),
  ],
} satisfies Config;
