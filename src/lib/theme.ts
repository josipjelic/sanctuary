// Design tokens for "The Serene Interface"
// Source of truth: .assets/DESIGN.md

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
export const colors = {
  // Primary palette — Sage Green
  primary: "#536253",
  onPrimary: "#ecfce8",
  primaryContainer: "#d7e7d3",
  onPrimaryContainer: "#122612",

  // Secondary palette — Slate
  secondary: "#576165",
  onSecondary: "#ffffff",
  secondaryContainer: "#dae4e9",
  onSecondaryContainer: "#121e22",

  // Surface hierarchy — Parchment spectrum
  surface: "#f9f9f8",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f1f4f3",
  surfaceContainerHigh: "#e3e9e8",
  surfaceContainerHighest: "#dde3e2",

  // Text — never pure black
  onSurface: "#2c3433",
  onSurfaceVariant: "#3f4948",
  outline: "#6f7978",
  outlineVariant: "#abb4b3",

  // Error — Terracotta (a gentle correction, not a siren)
  error: "#9e422c",
  onError: "#ffffff",
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// React Native uses numeric font sizes (points, roughly equivalent to px).
// Base: 1rem = 16pt
export const typography = {
  displayLg: {
    fontFamily: "Manrope_700Bold",
    fontSize: 56, // 3.5rem
    lineHeight: 64,
    letterSpacing: -2.24, // -0.04em × 56
  },
  headlineMd: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 28, // 1.75rem
    lineHeight: 36,
    letterSpacing: -0.56, // -0.02em × 28
  },
  bodyLg: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16, // 1rem
    lineHeight: 26, // ~1.6 line-height for a peaceful reading experience
    letterSpacing: 0,
  },
  labelMd: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12, // 0.75rem
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------
// 1 spacing unit = 4pt (standard React Native convention)
export const spacing = {
  s2: 8, // 0.5rem
  s4: 16, // 1rem
  s6: 24, // 1.5rem
  s8: 32, // 2rem
  s12: 48, // 3rem
  s16: 64, // 4rem
  s20: 80, // 5rem
  s24: 96, // 6rem
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 16,
  lg: 24, // "lg" cards — 2rem equivalent
  xl: 32, // "xl" cards — 3rem equivalent (primary containers)
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows — ambient light, very soft
// ---------------------------------------------------------------------------
export const shadows = {
  card: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 2, // Android equivalent
  },
} as const;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
// Long, slow transitions for a "drifting" sanctuary feel (400–600ms)
export const animation = {
  driftDuration: 500, // ms
  springConfig: {
    damping: 20,
    mass: 1,
    stiffness: 100,
  },
} as const;
