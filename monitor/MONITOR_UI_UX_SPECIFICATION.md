# MAT Monitor App — UI/UX Design Specification

> **Version:** 2.0  
> **Date:** 2026-03-11  
> **Status:** Design Specification  
> **Target:** Modern Fleet Management Alert Monitoring Dashboard

---

## 1. Executive Summary

This document defines a comprehensive UI/UX design specification for modernizing the MAT Monitor application. The Monitor app serves as a real-time alert and analytics dashboard for fleet management operations. The specification covers responsive layouts, visual styling, user interactions, accessibility features, and implementation guidelines that align with contemporary design standards.

**Current State:**
- React 18 + TypeScript + Vite + Tailwind CSS stack
- Light/Dark mode with professional navy/slate palette
- Real-time Supabase subscriptions for live alerts
- 7 main pages: Alerts, Trip Alerts, Faults, Documents, Diesel Alerts, Analytics, Config

**Target State:**
- Modernized, polished interface with refined aesthetics
- Fully responsive across all device sizes
- Enhanced interactivity with smooth animations
- WCAG 2.1 AA compliant accessibility
- Skeleton loading states and improved empty states
- Command palette for quick navigation
- Advanced data visualizations

---

## 2. Design System Foundation

### 2.1 Color Palette

The application uses a professional color system designed for fleet management operations. Maintain the existing severity colors while modernizing the base palette.

#### Base Colors (CSS Variables)

```css
/* Light Mode */
:root {
  --background: 220 14% 96%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 222 47% 35%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 93%;
  --secondary-foreground: 222 47% 11%;
  --muted: 220 14% 93%;
  --muted-foreground: 220 9% 46%;
  --accent: 220 14% 93%;
  --accent-foreground: 222 47% 11%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 13% 88%;
  --input: 220 13% 88%;
  --ring: 222 47% 35%;
  --radius: 0.5rem;
}

/* Dark Mode - Enhanced with subtle gradients */
.dark {
  --background: 222 47% 8%;
  --foreground: 220 14% 96%;
  --card: 222 47% 11%;
  --card-foreground: 220 14% 96%;
  --popover: 222 47% 13%;
  --popover-foreground: 220 14% 96%;
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 222 47% 16%;
  --secondary-foreground: 220 14% 96%;
  --muted: 222 47% 16%;
  --muted-foreground: 220 9% 60%;
  --accent: 222 47% 18%;
  --accent-foreground: 220 14% 96%;
  --destructive: 0 62% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 217 19% 27%;
  --input: 217 19% 27%;
  --ring: 217 91% 60%;
}
```

#### Severity Colors (Enhanced)

| Severity | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| Critical | `hsl(0 72% 51%)` | `hsl(0 72% 55%)` | Immediate action required |
| High | `hsl(25 95% 53%)` | `hsl(25 95% 57%)` | Urgent attention |
| Medium | `hsl(38 92% 50%)` | `hsl(38 92% 54%)` | Moderate priority |
| Low | `hsl(217 91% 60%)` | `hsl(217 91% 64%)` | Informational |
| Info | `hsl(220 9% 46%)` | `hsl(220 9% 60%)` | General information |

#### Semantic Colors

```css
/* Success States */
--success: 142 76% 36%;
--success-foreground: 0 0% 100%;

/* Warning States */
--warning: 38 92% 50%;
--warning-foreground: 0 0% 0%;

/* Info States */
--info: 199 89% 48%;
--info-foreground: 0 0% 100%;
```

### 2.2 Typography

#### Font Stack

```css
font-family: 
  'Inter',           /* Primary - Modern, clean */
  -apple-system,     /* macOS */
  BlinkMacSystemFont, /* Chrome */
  'Segoe UI',        /* Windows */
  Roboto,            /* Android */
  'Helvetica Neue',  /* Legacy */
  Arial,             /* Fallback */
  sans-serif;
```

#### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| Display | 36px / 2.25rem | 700 | 1.2 | -0.02em |
| H1 | 30px / 1.875rem | 600 | 1.25 | -0.01em |
| H2 | 24px / 1.5rem | 600 | 1.3 | 0 |
| H3 | 20px / 1.25rem | 600 | 1.4 | 0 |
| H4 | 16px / 1rem | 600 | 1.5 | 0.005em |
| Body | 14px / 0.875rem | 400 | 1.5 | 0.01em |
| Small | 13px / 0.8125rem | 400 | 1.5 | 0.02em |
| Caption | 12px / 0.75rem | 500 | 1.4 | 0.03em |
| Overline | 10px / 0.625rem | 600 | 1.5 | 0.08em (uppercase) |

### 2.3 Spacing System

```css
/* Base spacing unit: 4px */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### 2.4 Shadows (Enhanced)

```css
--shadow-subtle: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-elevated: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-dropdown: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-dialog: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-glow-critical: 0 0 20px -5px hsl(0 72% 51% / 0.4);
--shadow-glow-primary: 0 0 20px -5px hsl(217 91% 60% / 0.3);
```

### 2.5 Border Radius

```css
--radius-sm: 0.375rem;   /* 6px - Buttons, Inputs */
--radius-md: 0.5rem;     /* 8px - Cards, Panels */
--radius-lg: 0.75rem;    /* 12px - Modals */
--radius-xl: 1rem;       /* 16px - Large containers */
--radius-full: 9999px;   /* Pills, Avatars */
```

---

## 3. Responsive Layout Requirements

### 3.1 Breakpoint System

| Breakpoint | Width | Target Devices |
|------------|-------|----------------|
| xs | < 480px | Large phones |
| sm | ≥ 480px | Small tablets, Large phones |
| md | ≥ 768px | Tablets, Small laptops |
| lg | ≥ 1024px | Laptops, Desktops |
| xl | ≥ 1280px | Large monitors |
| 2xl | ≥ 1536px | Extra-large monitors |

### 3.2 Layout Structures

#### 3.2.1 Main Application Shell

```typescript
// Layout Structure
<ApplicationShell>
  <Sidebar 
    // Collapsible on mobile/tablet
    // Hidden by default on xs-sm
    // Collapsible on md-lg
    // Fixed on xl+
  />
  <MainContent>
    <TopBar />           // Breadcrumbs, Search, User Menu
    <PageContent />      // Scrollable content area
    <ToastContainer />   // Fixed position notifications
  </MainContent>
</ApplicationShell>
```

#### 3.2.2 Sidebar Specifications

**Desktop (lg+):**
- Width: 260px (expanded), 72px (collapsed)
- Fixed position, full height
- Smooth collapse animation (300ms ease)
- Logo at top with app name
- Navigation items with icons and labels
- Active state: background highlight + left border accent
- Hover: subtle background change
- Badge indicators for alert counts
- User profile section at bottom
- Collapse/Expand toggle button

**Tablet (md-lg):**
- Width: 72px (collapsed by default)
- Expandable on hover/tap
- Icons only with tooltips
- Can be set to overlay mode

**Mobile (xs-sm):**
- Hidden by default (hamburger menu)
- Slide-in drawer from left
- Width: 280px
- Backdrop overlay with tap-to-close
- Full-height navigation

#### 3.2.3 Page Layouts

**Alert Feed Page:**
```
┌─────────────────────────────────────────────────────┐
│ Page Header (56px)                                 │
│ ┌─────────────┬───────────────────────────────┐   │
│ │ Icon + Title│ Severity Pills │ Refresh      │   │
│ └─────────────┴───────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ Filter Bar (variable height)                        │
│ ┌─────────────────────────────────────────────┐    │
│ │ Time │ Severity │ Status │ Vehicle │ Search │    │
│ └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│ Alert List (scrollable, flex-1)                    │
│ ┌─────────────────────────────────────────────┐    │
│ │ Alert Card 1                                │    │
│ ├─────────────────────────────────────────────┤    │
│ │ Alert Card 2                                │    │
│ ├─────────────────────────────────────────────┤    │
│ │ ...                                         │    │
│ └─────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────┐    │
│ │ Loading Skeleton / Infinite Scroll Trigger  │    │
│ └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Analytics Dashboard:**
```
┌─────────────────────────────────────────────────────┐
│ Page Header (56px)                                 │
├─────────────────────────────────────────────────────┤
│ Filter Bar (variable height)                        │
├─────────────────────────────────────────────────────┤
│ KPI Scorecard (2 cols mobile, 4 cols desktop)      │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ │ Active │ │ Total  │ │Resolved│ │ Rate   │          │
│ └────────┘ └────────┘ └────────┘ └────────┘          │
├─────────────────────────────────────────────────────┤
│ Charts Row 1 (lg: 2 cols, md-xs: 1 col)             │
│ ┌────────────────────┐ ┌────────────┐               │
│ │ Trend Area Chart   │ │ Category  │               │
│ │                    │ │ Donut     │               │
│ └────────────────────┘ └────────────┘               │
├─────────────────────────────────────────────────────┤
│ Charts Row 2 (lg: 2 cols, md-xs: 1 col)             │
│ ┌────────────────────┐ ┌────────────┐               │
│ │ Daily Bar Chart    │ │ Source     │               │
│ │                    │ │ Table      │               │
│ └────────────────────┘ └────────────┘               │
└─────────────────────────────────────────────────────┘
```

### 3.3 Responsive Component Patterns

#### Cards
- **Mobile:** Full width, stacked vertically
- **Tablet:** 2 columns in grid
- **Desktop:** 3-4 columns in grid
- Gap: 16px (md), 24px (lg)

#### Tables
- **Mobile:** Horizontal scroll container OR card transformation
- **Tablet:** Horizontal scroll
- **Desktop:** with pagination

#### Forms Full table
- **Mobile:** Single column, full width inputs
- **Desktop:** Multi-column where appropriate, inline labels

---

## 4. Visual Styling Enhancements

### 4.1 Modern UI Elements

#### 4.1.1 Glass Morphism (Subtle)

```css
/* Use sparingly for emphasis */
.glass {
  background: hsl(var(--card) / 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--border) / 0.5);
}
```

#### 4.1.2 Gradient Accents

```css
/* Primary gradient for emphasis */
.gradient-primary {
  background: linear-gradient(135deg, 
    hsl(217 91% 60%) 0%, 
    hsl(222 47% 35%) 100%
  );
}

/* Severity gradient for critical alerts */
.gradient-critical {
  background: linear-gradient(135deg, 
    hsl(0 72% 51%) 0%, 
    hsl(0 84% 40%) 100%
  );
}
```

#### 4.1.3 Animated Backgrounds

```css
/* Subtle pulse for live indicators */
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

.live-indicator::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-ring 1.5s ease-out infinite;
}
```

### 4.2 Component Styling

#### Alert Cards (Enhanced)

**Structure:**
```tsx
<AlertCard 
  severity={alert.severity}
  expanded={isExpanded}
  className="group"
>
  <CardHeader>
    <div className="flex items-start gap-3">
      <SeverityIcon className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <AlertTitle />
        <AlertMeta />
      </div>
      <ExpandButton />
    </div>
  </CardHeader>
  
  {expanded && (
    <CardContent>
      <AlertDetails />
      <AlertActions />
      <AlertComments />
    </CardContent>
  )}
</AlertCard>
```

**Visual Enhancements:**
- Left border color by severity (4px)
- Subtle hover lift effect (translateY -2px)
- Expand animation (accordion style)
- Source icon with colored background circle
- Time ago in muted text with tooltip for exact time

#### Filter Bar (Enhanced)

**Features:**
- Collapsible advanced filters
- Multi-select dropdowns with search
- Clear individual or all filters
- Active filter count badge
- Filter preset save/load

#### KPI Cards (Enhanced)

**Structure:**
```tsx
<KPICard>
  <CardHeader>
    <KPIcon className="text-muted-foreground" />
    <TrendIndicator />
  </CardHeader>
  <CardContent>
    <KPIVALUE />
    <KPILabel />
  </CardContent>
  <CardFooter>
    <SparklineChart />
  </CardFooter>
</KPICard>
```

**Visual Enhancements:**
- Icon with gradient background
- Animated number counting on load
- Trend arrow with percentage
- Subtle sparkline for history
- Hover: slight scale + shadow increase

### 4.3 Animation Specifications

#### Transitions

| Property | Duration | Easing |
|----------|----------|--------|
| Page transitions | 200ms | ease-out |
| Hover effects | 150ms | ease-in-out |
| Modal open/close | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Sidebar collapse | 300ms | ease-in-out |
| Alert expand | 250ms | ease-out |
| Skeleton pulse | 1.5s | ease-in-out (infinite) |
| Toast slide-in | 300ms | ease-out |

#### Keyframe Animations

```css
/* Fade in up for list items */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}

/* Stagger children */
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
/* ... up to 10 children */
```

### 4.4 Loading States

#### Skeleton Screens

```tsx
// Alert Card Skeleton
<AlertCardSkeleton>
  <div className="flex gap-3">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
</AlertCardSkeleton>

// Chart Skeleton
<ChartSkeleton>
  <Skeleton className="h-64 w-full" />
</ChartSkeleton>

// Table Skeleton
<TableSkeleton rows={5}>
  <Skeleton className="h-12 w-full" />
</TableSkeleton>
```

#### Loading Spinner

```tsx
// Compact spinner for inline loading
<Spinner size="sm" className="text-primary" />

// Full page loader
<PageLoader>
  <Logo className="animate-pulse" />
  <Spinner size="lg" />
  <span>Loading...</span>
</PageLoader>
```

### 4.5 Empty States

```tsx
// Informative empty state
<EmptyState
  icon={InboxIcon}
  title="No alerts found"
  description="All caught up! There are no alerts matching your current filters."
  action={{
    label: "Clear filters",
    onClick: clearFilters
  }}
/>

// Success empty state
<EmptyState
  icon={CheckCircle}
  title="All clear!"
  description="No active alerts at this time."
  variant="success"
/>
```

---

## 5. User Interaction Patterns

### 5.1 Navigation

#### 5.1.1 Sidebar Navigation

```tsx
interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number | null;
  badgeType?: 'count' | 'critical' | 'pulse';
}

<NavItem 
  active={isActive}
  badge={unreadCount}
  badgeType="critical"
>
  <Icon />
  <Label />
</NavItem>
```

**Interaction Behaviors:**
- Hover: background `hover:bg-accent`, scale 1.02
- Active: left border accent (3px primary), background highlight
- Badge pulse animation for critical alerts

#### 5.1.2 Command Palette

Implement `cmdk` based command palette for quick navigation:

```tsx
<CommandPalette>
  <CommandInput placeholder="Search alerts, navigate..." />
  <CommandGroup heading="Navigation">
    <CommandItem onSelect={() => navigate('/alerts')}>
      <Bell /> Go to Alerts
      <Shortcut>⌘1</Shortcut>
    </CommandItem>
    <CommandItem onSelect={() => navigate('/analytics')}>
      <BarChart3 /> Go to Analytics
      <Shortcut>⌘2</Shortcut>
    </CommandItem>
  </CommandGroup>
  <CommandGroup heading="Recent Alerts">
    <CommandItem>ALERT-1234: Engine Warning</CommandItem>
  </CommandGroup>
  <CommandGroup heading="Actions">
    <CommandItem>
      <RefreshCw /> Refresh Data
    </CommandItem>
  </CommandGroup>
</CommandPalette>
```

**Trigger:** `⌘K` (Mac) / `Ctrl+K` (Windows)

### 5.2 Data Display

#### 5.2.1 Infinite Scroll

```tsx
<AlertList
  alerts={alerts}
  onLoadMore={() => fetchNextPage()}
  hasMore={hasNextPage}
  isLoading={isFetchingNextPage}
  loadingTrigger={<LoadingTrigger />}
/>
```

**Behavior:**
- Load more trigger at 80% scroll position
- Loading spinner in trigger area
- "No more results" message when exhausted
- Pull-to-refresh on mobile

#### 5.2.2 Real-time Updates

```tsx
<AlertList>
  {alerts.map((alert, index) => (
    <AlertCard
      key={alert.id}
      alert={alert}
      // New items animate in from top
      className={cn(
        isNew && "animate-slide-in-from-top"
      )}
    />
  ))}
</AlertList>
```

**Toast Notifications:**
```tsx
// Critical alerts trigger toast
toast.success("New Alert", {
  description: `CRITICAL: ${alert.title}`,
  action: {
    label: "View",
    onClick: () => navigate(`/alerts/${alert.id}`)
  },
  duration: 8000,
});
```

### 5.3 Forms & Inputs

#### 5.3.1 Search

```tsx
<SearchInput
  value={searchQuery}
  onChange={handleSearch}
  onClear={clearSearch}
  placeholder="Search alerts..."
  debounceMs={300}
>
  <SearchIcon />
</SearchInput>
```

#### 5.3.2 Filters

```tsx
<FilterDropdown
  label="Severity"
  selected={selectedSeverities}
  onChange={setSeverities}
  options={SEVERITY_OPTIONS}
  multiSelect
  search
/>

<FilterChip 
  active={true} 
  onRemove={removeFilter}
  variant="severity-critical"
>
  Critical
</FilterChip>
```

### 5.4 Actions

#### 5.4.1 Alert Actions

```tsx
<AlertActions>
  <Button 
    variant="ghost" 
    size="sm"
    onClick={acknowledge}
  >
    <CheckCheck /> Acknowledge
  </Button>
  <Button 
    variant="ghost" 
    size="sm"
    onClick={resolve}
  >
    <CheckCircle /> Resolve
  </Button>
  <Button 
    variant="ghost" 
    size="sm"
    asChild
  >
    <Link to={`/alerts/${id}`}>
      <ChevronRight /> Details
    </Link>
  </Button>
</AlertActions>
```

#### 5.4.2 Bulk Actions

```tsx
<SelectionBar
  selectedCount={selectedIds.length}
  onClearSelection={clearSelection}
>
  <BulkActionButton
    label="Acknowledge All"
    icon={<CheckCheck />}
    onClick={bulkAcknowledge}
  />
  <BulkActionButton
    label="Export Selected"
    icon={<Download />}
    onClick={exportSelected}
  />
</SelectionBar>
```

### 5.5 Feedback

#### 5.5.1 Optimistic Updates

```tsx
// Immediately update UI, revert on error
const handleResolve = async (alertId: string) => {
  // Optimistic update
  setAlerts(prev => prev.map(a => 
    a.id === alertId ? { ...a, status: 'resolved' } : a
  ));
  
  try {
    await resolveAlert(alertId);
    toast.success("Alert resolved");
  } catch (error) {
    // Revert on error
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: 'active' } : a
    ));
    toast.error("Failed to resolve alert");
  }
};
```

#### 5.5.2 Undo Actions

```tsx
toast.success("Alert resolved", {
  action: {
    label: "Undo",
    onClick: () => unresolveAlert(alertId)
  },
  duration: 5000,
});
```

---

## 6. Accessibility Requirements

### 6.1 WCAG 2.1 AA Compliance

#### 6.1.1 Color Contrast

| Element | Contrast Ratio | Requirement |
|---------|----------------|-------------|
| Body text | ≥ 4.5:1 | AA Normal |
| Large text (18px+) | ≥ 3:1 | AA Large |
| UI Components | ≥ 3:1 | AA UI |
| Disabled states | No requirement | N/A |

**Verification:**
```css
/* Example: Ensure primary text passes */
.text-primary {
  color: hsl(var(--primary));
  /* Must verify: 4.5:1 against background */
}
```

#### 6.1.2 Focus States

```css
/* Visible focus indicator */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Custom focus ring for components */
.focus-ring:focus-visible {
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.4);
}
```

#### 6.1.3 Keyboard Navigation

**Requirements:**
- All interactive elements focusable via Tab
- Logical tab order (document flow)
- Skip links for main content
- Arrow key navigation in menus/lists
- Escape key closes modals/dropdowns
- Enter/Space activates buttons
- Keyboard shortcuts documented and discoverable

**Skip Link:**
```tsx
<SkipLink href="#main-content">
  Skip to main content
</SkipLink>

<main id="main-content" tabIndex={-1}>
  {/* Page content */}
</main>
```

### 6.2 Screen Reader Support

#### 6.2.1 ARIA Attributes

```tsx
// Alert Card
<article
  aria-label={`${severity} alert: ${title}`}
  aria-labelledby={`alert-${id}-title`}
  aria-describedby={`alert-${id}-meta`}
  role="article"
>
  <h3 id={`alert-${id}-title`}>{title}</h3>
  <p id={`alert-${id}-meta`}>
    <span aria-label={`Severity: ${severity}`}>
      <SeverityIcon />
    </span>
    <time dateTime={createdAt}>{formattedTime}</time>
  </p>
</article>

// Status Badge
<Badge
  aria-label={`Status: ${status}`}
  role="status"
>
  {status}
</Badge>

// Live Region for Real-time Updates
<div 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {newAlertCount} new alerts received
</div>
```

#### 6.2.2 Announcements

```tsx
// Announce alert count changes
useEffect(() => {
  if (newAlertsCount > 0) {
    announce(`${newAlertsCount} new alerts received`);
  }
}, [newAlertsCount]);

// Announce sort/filter changes
announce(`Sorted by ${sortBy}, ${sortOrder === 'desc' ? 'descending' : 'ascending'}`);
```

### 6.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Implementation:**
```tsx
// Respect reduced motion preference
const prefersReducedMotion = useMediaQuery(
  '(prefers-reduced-motion: reduce)'
);

<AnimatePresence mode="wait">
  {!prefersReducedMotion ? (
    <motion.div animate={animate} />
  ) : (
    <div>{children}</div>
  )}
</AnimatePresence>
```

### 6.4 Touch Targets

| Size | Requirement |
|------|-------------|
| Minimum | 44x44px (iOS), 48x48dp (Android) |
| Recommended | 48x48px |
| Spacing | 8px minimum between targets |

```css
/* Ensure touch targets meet minimum size */
button, 
[role="button"],
a {
  min-height: 44px;
  min-width: 44px;
}

/* Dense toolbars */
.toolbar button {
  min-height: 36px;
  min-width: 36px;
}
```

### 6.5 Text Scaling

```css
/* Support browser zoom up to 200% */
html {
  font-size: 100%;
}

/* Prevent layout breaks at high zoom */
.container {
  max-width: 100%;
  overflow: hidden;
}
```

---

## 7. Page-Specific Enhancements

### 7.1 Alert Feed Page

**Features to Add:**
1. **View Toggle:** List/Compact/Split view options
2. **Real-time Counter:** Live active alert count in header
3. **Sound Toggle:** Audio notification for critical alerts
4. **Quick Filters:** Saved filter presets
5. **Batch Selection:** Checkbox selection for bulk actions

**Enhanced Alert Card:**
- Expandable for full details
- Inline comment thread
- Related alerts link
- Vehicle/Driver quick link
- Copy alert ID button

### 7.2 Analytics Dashboard

**Features to Add:**
1. **Date Range Picker:** Custom date ranges with presets
2. **Export Options:** CSV, PDF, PNG chart export
3. **Drill-down:** Click chart elements to filter
4. **Comparison Mode:** Period-over-period overlay
5. **Dashboard Customization:** Show/hide widgets

**Chart Enhancements:**
- Tooltips with detailed data
- Legend with toggle visibility
- Responsive sizing
- Animation on data load
- Error state handling

### 7.3 Alert Detail Page

**Features to Add:**
1. **Timeline View:** Chronological alert history
2. **Related Assets:** Linked vehicles, drivers
3. **Action Log:** Full audit trail
4. **Attachment Support:** Images, documents
5. **Share Alert:** Email/Link sharing

### 7.4 Configuration Page

**Features to Add:**
1. **Rule Builder:** Visual rule creation
2. **Test Rules:** Validate before saving
3. **Import/Export:** Backup configurations
4. **Version History:** Track changes
5. **Template Library:** Pre-built rule sets

---

## 8. Implementation Guidelines

### 8.1 Component Architecture

```typescript
// Component folder structure
components/
├── ui/                    // Base UI components (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── alerts/                // Feature components
│   ├── AlertCard/
│   │   ├── AlertCard.tsx
│   │   ├── AlertCardSkeleton.tsx
│   │   ├── AlertCard.stories.tsx
│   │   └── index.ts
│   └── AlertFilterBar/
│       └── ...
├── analytics/
│   ├── charts/
│   └── widgets/
└── layout/
    ├── Sidebar/
    ├── TopBar/
    └── Shell/
```

### 8.2 Hook Patterns

```typescript
// Custom hook for component state
function useAlertCard(alert: Alert) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // Computed values
  const timeAgo = useMemo(
    () => formatDistanceToNow(alert.created_at),
    [alert.created_at]
  );
  
  // Effects
  useEffect(() => {
    if (expanded) {
      trackEvent('alert_expanded', { alertId: alert.id });
    }
  }, [expanded, alert.id]);
  
  return {
    expanded,
    setExpanded,
    showComments,
    setShowComments,
    timeAgo,
  };
}
```

### 8.3 Testing Requirements

| Test Type | Coverage Target |
|-----------|----------------|
| Unit Tests | 80% components |
| Integration Tests | Critical flows |
| E2E Tests | Key user journeys |
| Accessibility | Full axe-core audit |

### 8.4 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |
| First Input Delay | < 100ms |

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Update design tokens in tailwind.config.ts
- [ ] Enhance color palette with new semantic colors
- [ ] Add animation utilities
- [ ] Update skeleton components
- [ ] Implement empty states

### Phase 2: Core Components (Week 3-4)
- [ ] Modernize AlertCard with animations
- [ ] Enhance AlertFilterBar with better UX
- [ ] Improve KPIScorecard with animations
- [ ] Update chart components with tooltips

### Phase 3: Navigation & Shell (Week 5-6)
- [ ] Implement responsive sidebar
- [ ] Add command palette (Cmd+K)
- [ ] Improve mobile navigation
- [ ] Add skip links

### Phase 4: Accessibility & Polish (Week 7-8)
- [ ] Complete ARIA implementation
- [ ] Keyboard navigation audit
- [ ] Screen reader testing
- [ ] Reduced motion support
- [ ] Performance optimization

### Phase 5: Advanced Features (Week 9-10)
- [ ] Real-time presence indicators
- [ ] Advanced filtering
- [ ] Export functionality
- [ ] Dashboard customization

---

## 10. Appendix

### 10.1 Design Resources

- **Icons:** Lucide React (already installed)
- **Charts:** Recharts (already installed)
- **Animations:** Framer Motion (recommended addition)
- **Command Palette:** cmdk (already installed)
- **Forms:** React Hook Form + Zod (already installed)

### 10.2 Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "react-day-picker": "^8.10.0",
    "date-fns": "^3.6.0",
    "cmdk": "^1.0.0",
    "recharts": "^2.12.0",
    "sonner": "^1.4.0",
    "lucide-react": "^0.370.0",
    "@tanstack/react-query": "^5.90.0"
  }
}
```

### 10.3 Reference Systems

- [shadcn/ui](https://ui.shadcn.com/) — Component patterns
- [Radix UI](https://www.radix-ui.com/) — Primitive accessibility
- [Vercel Dashboard](https://vercel.com/dashboard) — Modern dashboard inspiration
- [Linear](https://linear.app/) — Premium UX patterns
- [AWS Console](https://console.aws.amazon.com/) — Enterprise dashboard patterns

---

## 11. Summary

This UI/UX design specification provides a comprehensive blueprint for modernizing the MAT Monitor application. The specification covers:

1. **Design System Foundation** — Color palette, typography, spacing, shadows, and border radius system
2. **Responsive Layouts** — Mobile-first approach with breakpoints, sidebar specifications, and page layouts
3. **Visual Styling** — Glass morphism, gradients, animations, skeleton screens, and empty states
4. **User Interactions** — Navigation patterns, command palette, infinite scroll, real-time updates, and forms
5. **Accessibility** — WCAG 2.1 AA compliance, keyboard navigation, screen reader support, and reduced motion
6. **Implementation Guidelines** — Component architecture, testing requirements, and performance targets

The specification aligns with contemporary design standards used in modern SaaS applications while maintaining the professional, fleet-management-focused aesthetic required for the MAT Monitor application.

---

*Document Version: 2.0*  
*Last Updated: 2026-03-11*  
*Next Review: 2026-04-11*
