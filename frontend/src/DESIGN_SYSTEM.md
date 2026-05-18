# Enterprise QA Dashboard - Design System

## Overview

This design system provides a professional, enterprise-grade visual language for the QA Metrics Dashboard. It's optimized for leadership presentations and executive reviews.

---

## Color Palette

### Background Layers (Dark Theme with Depth)
```css
--bg-base: #0B0F15;      /* Deepest layer - main background */
--bg-elevated: #0F1419;   /* Cards, panels */
--bg-surface: #151B23;    /* Interactive surfaces */
--bg-overlay: #1A2230;    /* Modals, dropdowns */
```

### Text Hierarchy
```css
--text-primary: #F1F5F9;    /* Headings, important content */
--text-secondary: #CBD5E1;  /* Body text */
--text-tertiary: #94A3B8;   /* Labels, captions */
--text-muted: #64748B;      /* Disabled, hints */
```

### Semantic Colors

#### Success (Positive Trends)
```css
--success-base: #10B981;
--success-muted: #059669;
--success-subtle: rgba(16, 185, 129, 0.12);
--success-border: rgba(16, 185, 129, 0.3);
```

#### Warning (Attention Needed)
```css
--warning-base: #F59E0B;
--warning-muted: #D97706;
--warning-subtle: rgba(245, 158, 11, 0.12);
--warning-border: rgba(245, 158, 11, 0.3);
```

#### Error (Critical)
```css
--error-base: #EF4444;
--error-muted: #DC2626;
--error-subtle: rgba(239, 68, 68, 0.12);
--error-border: rgba(239, 68, 68, 0.3);
```

### Chart Palette (Accessibility Optimized)
```css
--chart-1: #6366F1;  /* Indigo - Primary data */
--chart-2: #10B981;  /* Emerald - Positive/Success */
--chart-3: #F59E0B;  /* Amber - Warning/Caution */
--chart-4: #06B6D4;  /* Cyan - Secondary data */
--chart-5: #EC4899;  /* Pink - Accent */
--chart-6: #8B5CF6;  /* Violet - Tertiary */
```

### Comparison Mode Colors
```css
--comparison-current: #6366F1;   /* Current period - Indigo */
--comparison-previous: #94A3B8;  /* Previous period - Muted */
--comparison-positive: #10B981;  /* Improvement */
--comparison-negative: #EF4444;  /* Regression */
```

---

## Typography

### Font Stack
```css
--font-display: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;
```

### Type Scale
| Token | Size | Use Case |
|-------|------|----------|
| xs | 11px | Labels, metadata |
| sm | 12px | Captions, small text |
| base | 14px | Body text |
| lg | 16px | Emphasized body |
| xl | 18px | Section headers |
| 2xl | 24px | Card titles |
| 3xl | 32px | Page titles |
| 4xl | 40px | Hero numbers |
| 5xl | 48px | Large metrics |

### Typography Guidelines
- **Headers**: Use `-0.02em` letter-spacing for display text
- **Labels**: Use uppercase with `0.05em-0.1em` tracking
- **Numbers**: Use tabular figures for alignment in tables

---

## Component Structure

### Quarter Comparison Feature

```
src/
  components/
    comparison/
      QuarterComparisonSelector.tsx  # Period selector UI
      TrendIndicator.tsx             # Up/down arrows with percentage
      ComparisonKPICard.tsx          # KPI card with comparison mode
      ComparisonChart.tsx            # Charts with dual data series
      ComparisonSummaryCard.tsx      # Executive summary card
      index.ts                       # Barrel exports
  hooks/
    useComparison.ts                 # Comparison state management
  types/
    comparison.ts                    # TypeScript interfaces
```

### Comparison Modes
1. **Single Period**: Standard view showing one quarter
2. **Side-by-Side**: Two quarters displayed in parallel
3. **Overlay**: Both periods on same chart (line/bar)
4. **Delta**: Show only the change/difference

---

## KPI Card Variants

### Standard KPI Card
```tsx
<ComparisonKPICard
  title="Open Bugs"
  currentValue={12}
  subtitle="3 critical"
  color="emerald"
/>
```

### With Trend Indicator
```tsx
<ComparisonKPICard
  title="Pass Rate"
  currentValue="94%"
  previousValue={91}
  polarity="positive"  // Up is good
  color="emerald"
/>
```

### Comparison Mode
```tsx
<ComparisonKPICard
  title="PRs Merged"
  currentValue={45}
  previousValue={38}
  comparisonMode={true}
  baseLabel="Q2 2026"
  compareLabel="Q1 2026"
/>
```

---

## Trend Indicators

### Polarity Rules
| Metric | Polarity | Up = | Down = |
|--------|----------|------|--------|
| Open Bugs | Negative | Bad | Good |
| Critical Bugs | Negative | Bad | Good |
| Flaky Tests | Negative | Bad | Good |
| Automation % | Positive | Good | Bad |
| Pass Rate | Positive | Good | Bad |
| PRs Merged | Positive | Good | Bad |
| Story Points | Positive | Good | Bad |
| Velocity | Positive | Good | Bad |

### Visual Treatment
- **Positive Change**: Emerald (#10B981) with up arrow
- **Negative Change**: Rose (#EF4444) with down arrow
- **Neutral**: Slate (#64748B) with dash

---

## Chart Styling

### Axis Configuration
```tsx
const axisStyle = {
  tick: { fill: '#64748B', fontSize: 11 },
  axisLine: { stroke: 'rgba(71, 85, 105, 0.25)' },
  tickLine: false,
};
```

### Tooltip Configuration
```tsx
const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1A2230',
    border: '1px solid rgba(71, 85, 105, 0.4)',
    borderRadius: '12px',
    fontSize: '13px',
    padding: '12px 16px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  },
  labelStyle: {
    color: '#F1F5F9',
    fontWeight: 600,
  },
};
```

### Bar Chart (Comparison)
- Current period: Solid fill
- Previous period: 50% opacity or dashed pattern
- Gap between grouped bars: 4px

### Line Chart (Comparison)
- Current period: Solid line (2.5px)
- Previous period: Dashed line (2px, "5 5" dash)
- Dot radius: 4px current, 3px previous

---

## Spacing System

| Token | Value | Use Case |
|-------|-------|----------|
| 1 | 4px | Tight spacing |
| 2 | 8px | Element spacing |
| 3 | 12px | Component padding (sm) |
| 4 | 16px | Component padding (md) |
| 5 | 20px | Section spacing |
| 6 | 24px | Card padding |
| 8 | 32px | Section gaps |

---

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-base: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
```

### Glow Effects (Accent)
```css
--glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
--glow-success: 0 0 20px rgba(16, 185, 129, 0.3);
--glow-warning: 0 0 20px rgba(245, 158, 11, 0.3);
--glow-error: 0 0 20px rgba(239, 68, 68, 0.3);
```

---

## Animation Guidelines

### Transitions
- **Fast (150ms)**: Hover states, toggles
- **Base (200ms)**: Most interactions
- **Slow (300ms)**: Expanding sections, modals

### Timing Function
```css
cubic-bezier(0.4, 0, 0.2, 1)  /* Ease out */
```

### Hover States
- Scale: `transform: scale(1.02)`
- Background shift: Lighten by ~5%
- Shadow: Upgrade by one level

---

## Accessibility

### Color Contrast
- All text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- Chart colors tested for color blindness compatibility

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### Motion
- Respect `prefers-reduced-motion`
- Provide static alternatives for animations

---

## Implementation Checklist

### Core Components Created
- [x] Design tokens (`design-system/tokens.ts`)
- [x] CSS variables (`index.css`)
- [x] Quarter comparison selector
- [x] Trend indicator
- [x] Enhanced KPI card with comparison
- [x] Comparison chart wrapper
- [x] Comparison summary card
- [x] Enhanced section component
- [x] Enhanced table component
- [x] Comparison hook

### Integration Steps
1. Import design tokens: `import { colors, typography } from '@/design-system'`
2. Use comparison hook: `const { baseQuarter, compareQuarter, ... } = useComparison()`
3. Replace KPICard with ComparisonKPICard
4. Add QuarterComparisonSelector to header
5. Update charts to support comparison mode

---

## File Structure

```
frontend/src/
├── design-system/
│   ├── tokens.ts          # Design tokens (colors, typography, etc.)
│   └── index.ts           # Barrel exports
├── components/
│   ├── comparison/
│   │   ├── QuarterComparisonSelector.tsx
│   │   ├── TrendIndicator.tsx
│   │   ├── ComparisonKPICard.tsx
│   │   ├── ComparisonChart.tsx
│   │   ├── ComparisonSummaryCard.tsx
│   │   └── index.ts
│   ├── ui/
│   │   ├── EnhancedKPICard.tsx
│   │   ├── EnhancedSection.tsx
│   │   ├── EnhancedTable.tsx
│   │   └── index.ts
│   └── ComparisonDashboard.tsx  # Example implementation
├── hooks/
│   └── useComparison.ts
├── types/
│   └── comparison.ts
└── index.css              # Updated with CSS variables
```
