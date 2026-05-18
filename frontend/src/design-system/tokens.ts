/**
 * Enterprise Design System Tokens
 * Professional color palette and typography for leadership-focused dashboards
 */

// =============================================================================
// COLOR PALETTE - Enterprise Grade
// =============================================================================

export const colors = {
  // Background layers (dark theme with depth)
  background: {
    base: '#0B0F15',      // Deepest layer
    elevated: '#0F1419',   // Cards, panels
    surface: '#151B23',    // Interactive surfaces
    overlay: '#1A2230',    // Modals, dropdowns
  },

  // Border system (subtle hierarchy)
  border: {
    subtle: 'rgba(71, 85, 105, 0.15)',
    default: 'rgba(71, 85, 105, 0.25)',
    emphasis: 'rgba(71, 85, 105, 0.4)',
    interactive: 'rgba(99, 102, 241, 0.4)',
  },

  // Text hierarchy
  text: {
    primary: '#F1F5F9',    // Headings, important content
    secondary: '#CBD5E1',  // Body text
    tertiary: '#94A3B8',   // Labels, captions
    muted: '#64748B',      // Disabled, hints
  },

  // Semantic colors - Refined for enterprise
  semantic: {
    // Success / Positive trends
    success: {
      base: '#10B981',
      muted: '#059669',
      subtle: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
    },
    // Warning / Attention needed
    warning: {
      base: '#F59E0B',
      muted: '#D97706',
      subtle: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
    },
    // Error / Critical
    error: {
      base: '#EF4444',
      muted: '#DC2626',
      subtle: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
    },
    // Info / Neutral highlight
    info: {
      base: '#3B82F6',
      muted: '#2563EB',
      subtle: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
    },
  },

  // Brand / Primary accent
  accent: {
    primary: '#6366F1',    // Indigo - primary brand
    secondary: '#8B5CF6',  // Violet - secondary brand
    tertiary: '#06B6D4',   // Cyan - data visualization
  },

  // Chart palette - Carefully selected for clarity
  chart: {
    primary: '#6366F1',    // Indigo
    secondary: '#10B981',  // Emerald
    tertiary: '#F59E0B',   // Amber
    quaternary: '#06B6D4', // Cyan
    quinary: '#EC4899',    // Pink
    senary: '#8B5CF6',     // Violet
    // For comparisons (lighter variants)
    comparison: {
      a: '#818CF8',        // Light indigo
      b: '#34D399',        // Light emerald
    },
  },

  // Quarter comparison specific
  comparison: {
    current: '#6366F1',
    previous: '#94A3B8',
    positive: '#10B981',
    negative: '#EF4444',
    neutral: '#64748B',
  },
} as const;

// =============================================================================
// TYPOGRAPHY SCALE
// =============================================================================

export const typography = {
  // Font families
  fontFamily: {
    display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
  },

  // Size scale (modular scale 1.25)
  fontSize: {
    xs: '0.6875rem',    // 11px - labels, metadata
    sm: '0.75rem',      // 12px - captions, small text
    base: '0.875rem',   // 14px - body text
    lg: '1rem',         // 16px - emphasized body
    xl: '1.125rem',     // 18px - section headers
    '2xl': '1.5rem',    // 24px - card titles
    '3xl': '2rem',      // 32px - page titles
    '4xl': '2.5rem',    // 40px - hero numbers
    '5xl': '3rem',      // 48px - large metrics
  },

  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// =============================================================================
// SPACING & LAYOUT
// =============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  base: '0.5rem',  // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  full: '9999px',
} as const;

// =============================================================================
// SHADOWS & EFFECTS
// =============================================================================

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
  glow: {
    primary: '0 0 20px rgba(99, 102, 241, 0.3)',
    success: '0 0 20px rgba(16, 185, 129, 0.3)',
    warning: '0 0 20px rgba(245, 158, 11, 0.3)',
    error: '0 0 20px rgba(239, 68, 68, 0.3)',
  },
} as const;

// =============================================================================
// ANIMATION & TRANSITIONS
// =============================================================================

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// =============================================================================
// CHART CONFIGURATION
// =============================================================================

export const chartConfig = {
  // Shared tooltip styles
  tooltip: {
    contentStyle: {
      backgroundColor: colors.background.overlay,
      border: `1px solid ${colors.border.default}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      padding: '12px 16px',
      boxShadow: shadows.lg,
    },
    labelStyle: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.semibold,
      marginBottom: '8px',
    },
  },

  // Axis styles
  axis: {
    stroke: colors.border.subtle,
    tick: {
      fill: colors.text.muted,
      fontSize: 11,
    },
  },

  // Grid styles
  grid: {
    stroke: colors.border.subtle,
    strokeDasharray: '3 3',
  },

  // Legend styles
  legend: {
    wrapperStyle: {
      fontSize: '12px',
      color: colors.text.secondary,
    },
  },
} as const;

// =============================================================================
// CSS VARIABLES EXPORT
// =============================================================================

export const cssVariables = `
:root {
  /* Background */
  --bg-base: ${colors.background.base};
  --bg-elevated: ${colors.background.elevated};
  --bg-surface: ${colors.background.surface};
  --bg-overlay: ${colors.background.overlay};

  /* Border */
  --border-subtle: ${colors.border.subtle};
  --border-default: ${colors.border.default};
  --border-emphasis: ${colors.border.emphasis};
  --border-interactive: ${colors.border.interactive};

  /* Text */
  --text-primary: ${colors.text.primary};
  --text-secondary: ${colors.text.secondary};
  --text-tertiary: ${colors.text.tertiary};
  --text-muted: ${colors.text.muted};

  /* Semantic - Success */
  --success-base: ${colors.semantic.success.base};
  --success-muted: ${colors.semantic.success.muted};
  --success-subtle: ${colors.semantic.success.subtle};
  --success-border: ${colors.semantic.success.border};

  /* Semantic - Warning */
  --warning-base: ${colors.semantic.warning.base};
  --warning-muted: ${colors.semantic.warning.muted};
  --warning-subtle: ${colors.semantic.warning.subtle};
  --warning-border: ${colors.semantic.warning.border};

  /* Semantic - Error */
  --error-base: ${colors.semantic.error.base};
  --error-muted: ${colors.semantic.error.muted};
  --error-subtle: ${colors.semantic.error.subtle};
  --error-border: ${colors.semantic.error.border};

  /* Semantic - Info */
  --info-base: ${colors.semantic.info.base};
  --info-muted: ${colors.semantic.info.muted};
  --info-subtle: ${colors.semantic.info.subtle};
  --info-border: ${colors.semantic.info.border};

  /* Accent */
  --accent-primary: ${colors.accent.primary};
  --accent-secondary: ${colors.accent.secondary};
  --accent-tertiary: ${colors.accent.tertiary};

  /* Chart */
  --chart-1: ${colors.chart.primary};
  --chart-2: ${colors.chart.secondary};
  --chart-3: ${colors.chart.tertiary};
  --chart-4: ${colors.chart.quaternary};
  --chart-5: ${colors.chart.quinary};
  --chart-6: ${colors.chart.senary};

  /* Typography */
  --font-display: ${typography.fontFamily.display};
  --font-body: ${typography.fontFamily.body};
  --font-mono: ${typography.fontFamily.mono};

  /* Shadows */
  --shadow-sm: ${shadows.sm};
  --shadow-base: ${shadows.base};
  --shadow-lg: ${shadows.lg};

  /* Transitions */
  --transition-fast: ${transitions.fast};
  --transition-base: ${transitions.base};
  --transition-slow: ${transitions.slow};
}
`;

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  chartConfig,
};
