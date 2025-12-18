# Chart Sections (Rows) Feature - Grafana-Style Organization
## Comprehensive Implementation Strategy for TelAgri Bank Dashboard

**Analysis Date:** December 17, 2025  
**Priority:** High - Improves chart organization and UX  
**Complexity:** Moderate-High  
**Estimated Effort:** 40-60 hours

---

## 📊 Feature Overview

### Business Requirements

**Goal:** Enable admins to organize charts into collapsible sections (like Grafana dashboard rows) with drag-and-drop functionality.

**User Stories:**

**As an Admin:**
- I want to create named sections to group related charts
- I want to drag charts into and out of sections
- I want to reorder sections
- I want to reorder charts within sections
- I want to collapse/expand sections to manage screen space
- I want to edit section names
- I want to delete sections (charts move to "ungrouped")

**As a Bank Viewer:**
- I want to see sections created by admin
- I want to collapse/expand sections to focus on specific data
- I cannot modify sections or their structure

---

## 🏗️ Architecture Design

### Database Schema

**New Table: `chart_sections`**

```sql
CREATE TABLE IF NOT EXISTS public.chart_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  farmer_id uuid REFERENCES public.farmers(id) ON DELETE CASCADE,
  phase_number integer CHECK (phase_number >= 1 AND phase_number <= 12),
  display_order integer NOT NULL DEFAULT 0,
  is_collapsed boolean NOT NULL DEFAULT false, -- User's collapse state
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_chart_sections_farmer_phase 
ON public.chart_sections(farmer_id, phase_number) 
WHERE is_active = true;

CREATE INDEX idx_chart_sections_display_order 
ON public.chart_sections(display_order);

-- RLS Policies
ALTER TABLE public.chart_sections ENABLE ROW LEVEL SECURITY;

-- Read: Admin and bank viewers can see active sections
CREATE POLICY "chart_sections.read.all"
ON public.chart_sections FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.role = 'admin' OR p.role = 'bank_viewer')
  )
);

-- Write: Admin only
CREATE POLICY "chart_sections.write.admin"
ON public.chart_sections FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_chart_sections_updated_at
  BEFORE UPDATE ON public.chart_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Update Existing Table: `chart_templates`**

```sql
-- Add section_id to chart_templates
ALTER TABLE public.chart_templates 
ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.chart_sections(id) ON DELETE SET NULL;

-- Add index for section queries
CREATE INDEX IF NOT EXISTS idx_chart_templates_section 
ON public.chart_templates(section_id) 
WHERE section_id IS NOT NULL;

-- Add display_order within section
-- Note: display_order already exists globally, this will work for both
-- NULL section_id = ungrouped charts (use global display_order)
-- Non-NULL section_id = grouped charts (use display_order within section)

COMMENT ON COLUMN public.chart_templates.section_id IS 
'Optional: Associates chart with a section/row. NULL means ungrouped chart.';
```

---

## 📐 Data Structure Design

### TypeScript Types

```typescript
// src/types/chart.ts

export interface ChartSection {
  id: string;
  name: string;
  description?: string;
  farmer_id?: string;
  phase_number?: number | null;
  display_order: number;
  is_collapsed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  charts: ChartTemplate[]; // Populated charts belonging to this section
}

// Update ChartTemplate
export interface ChartTemplate {
  id?: string;
  name: string;
  chart_type: ChartType;
  chart_data: {
    // ... existing fields
  };
  annotation?: string;
  bottom_description?: string;
  section_id?: string; // NEW: Reference to section
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  farmer_id?: string;
  phase_number?: number | null;
  display_order?: number;
}

// Organized structure for display
export interface OrganizedCharts {
  ungrouped: ChartTemplate[]; // Charts without section_id
  sections: Array<{
    section: ChartSection;
    charts: ChartTemplate[];
  }>;
}
```

---

## 🎨 UI Component Architecture

### Component Hierarchy

```
ChartDisplay (main container)
├── SectionManagement (admin only)
│   ├── CreateSectionButton
│   └── SectionModal (create/edit)
│
├── Ungrouped Charts
│   ├── DndContext (for ungrouped charts)
│   └── SortableChartCard (drag between ungrouped)
│
└── Sections (loop)
    ├── SectionHeader
    │   ├── Collapse/Expand Button
    │   ├── Section Name (editable by admin)
    │   ├── Chart Count Badge
    │   └── Section Actions (edit, delete - admin only)
    │
    └── Collapsible Content
        ├── DndContext (charts within section)
        ├── SortableChartCard (can drag out to ungrouped or other sections)
        └── "Drop charts here" placeholder (when empty)
```

### Drag and Drop Strategy

**Three Drag Scenarios:**

1. **Within Same Section:** Reorder charts within section
2. **Between Sections:** Move chart from Section A to Section B
3. **Section ↔ Ungrouped:** Move chart in/out of sections

**Implementation with @dnd-kit:**

```typescript
// Multiple drop zones
<DndContext onDragEnd={handleChartDrag}>
  {/* Ungrouped Charts Droppable */}
  <Droppable id="ungrouped">
    {ungroupedCharts.map(chart => (
      <Draggable id={chart.id} />
    ))}
  </Droppable>
  
  {/* Each Section is Droppable */}
  {sections.map(section => (
    <Droppable id={section.id}>
      {section.charts.map(chart => (
        <Draggable id={chart.id} />
      ))}
    </Droppable>
  ))}
</DndContext>

// Separate DndContext for section reordering
<DndContext onDragEnd={handleSectionDrag}>
  {sections.map(section => (
    <DraggableSection id={section.id} />
  ))}
</DndContext>
```

---

## 🛠️ Implementation Plan

### Phase 1: Database & Types (8-12 hours)

**Tasks:**
1. ✅ Create `chart_sections` table migration
2. ✅ Add `section_id` to `chart_templates`
3. ✅ Create RLS policies
4. ✅ Add TypeScript types
5. ✅ Update Supabase type generation

**Deliverables:**
- Migration file: `20251217000000_create_chart_sections.sql`
- Updated types: `src/types/chart.ts`

---

### Phase 2: Section Management UI (12-16 hours)

**Tasks:**
1. Create `SectionManagementModal.tsx`
   - Create new section form
   - Edit section name/description
   - Delete section (with confirmation)
   - List all sections

2. Create `SectionHeader.tsx`
   - Collapsible header with icon
   - Section name display (editable for admin)
   - Chart count badge
   - Action buttons (edit, delete - admin only)
   - Drag handle for section reordering

3. Create `SectionDropZone.tsx`
   - "Drop charts here" placeholder when empty
   - Visual feedback when dragging over

**Deliverables:**
- New components in `src/components/`
- Section CRUD operations with TanStack Query

---

### Phase 3: Enhanced Drag & Drop (16-20 hours)

**Tasks:**
1. Upgrade drag system to support multiple drop zones
2. Implement chart drag between sections
3. Implement section reordering
4. Visual feedback during drag (highlight drop zones)
5. Persistence layer (update section_id and display_order)
6. Optimistic UI updates

**Complexity:**
- Current: Single DndContext for flat chart list
- New: Nested DndContext for sections + charts
- Challenge: Drag between different droppable containers

**Key Libraries:**
- Already using: `@dnd-kit/core`, `@dnd-kit/sortable`
- May need: `@dnd-kit/modifiers` for constraints

---

### Phase 4: Chart Display Updates (8-12 hours)

**Tasks:**
1. Update `ChartDisplay.tsx` to render sections
2. Group charts by section_id
3. Render ungrouped charts first
4. Render sections with collapsible headers
5. Persist collapse state (localStorage or user preferences)
6. Update empty state handling

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Analytics & Charts                  │
│                                     │
│ [+ Create Section]  (admin only)    │
├─────────────────────────────────────┤
│ Ungrouped Charts:                   │
│ ┌───────┐ ┌───────┐                │
│ │Chart 1│ │Chart 2│                │
│ └───────┘ └───────┘                │
├─────────────────────────────────────┤
│ ▼ Risk Assessment (6 charts)        │
│   [Edit] [Delete]  (admin only)     │
│ ┌───────┐ ┌───────┐                │
│ │Chart 3│ │Chart 4│                │
│ │Chart 5│ │Chart 6│                │
│ └───────┘ └───────┘                │
├─────────────────────────────────────┤
│ ▶ Performance Metrics (collapsed)   │
│   [Edit] [Delete]  (admin only)     │
└─────────────────────────────────────┘
```

---

### Phase 5: F100 & OnePager Integration (6-8 hours)

**Tasks:**
1. Update `F100Modal.tsx` to render sections
2. Update `OnePagerModal.tsx` to render sections
3. Sections should be expanded by default in PDFs
4. Section headers should print in PDFs
5. Intelligent page breaking respects sections

**PDF Layout:**
```
Page 1:
─────────────────────────────
SECTION: Risk Assessment
─────────────────────────────
[Chart 1] [Chart 2]
[Chart 3] [Chart 4]

Page 2:
[Chart 5] [Chart 6]
─────────────────────────────
SECTION: Performance Metrics
─────────────────────────────
[Chart 7] [Chart 8]
```

---

## 💡 Implementation Strategy

### Option A: Full Implementation (Recommended)

**Pros:**
- ✅ Complete Grafana-like experience
- ✅ Maximum flexibility
- ✅ Scalable for future features

**Cons:**
- ⚠️ Higher development effort (40-60 hours)
- ⚠️ More complex drag-and-drop logic

**Timeline:** 6-8 weeks

---

### Option B: Simplified Tags/Categories

**Alternative Approach:** Use tags instead of sections

**Pros:**
- ✅ Simpler implementation (20-30 hours)
- ✅ Faster to deploy

**Cons:**
- ⚠️ Less flexible (no nesting, no reordering)
- ⚠️ No collapse/expand
- ⚠️ Less Grafana-like

**Not Recommended** - Doesn't meet requirements

---

## 🎯 Technical Challenges

### Challenge 1: Nested Drag & Drop

**Problem:** Drag chart between different section containers

**Solution:** Use `@dnd-kit` droppable containers

```typescript
import { useDroppable } from '@dnd-kit/core';

const SectionDropZone = ({ sectionId, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionId,
  });
  
  return (
    <div 
      ref={setNodeRef}
      className={isOver ? 'bg-primary/10 border-primary' : ''}
    >
      {children}
    </div>
  );
};
```

**Drag Handler:**
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  
  // Determine source and destination
  const chartId = active.id;
  const destinationId = over?.id; // Could be section ID or "ungrouped"
  
  // Update chart's section_id in database
  await supabase
    .from('chart_templates')
    .update({ 
      section_id: destinationId === 'ungrouped' ? null : destinationId 
    })
    .eq('id', chartId);
};
```

---

### Challenge 2: Collapse State Persistence

**Problem:** Remember which sections are collapsed per user

**Options:**

**A. User Preferences Table (Recommended)**
```sql
CREATE TABLE user_section_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id uuid REFERENCES chart_sections(id) ON DELETE CASCADE,
  is_collapsed boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, section_id)
);
```

**B. LocalStorage (Simpler)**
```typescript
localStorage.setItem(`section_${sectionId}_collapsed`, 'true');
```

**C. Section Table Default (Global)**
```typescript
// Use is_collapsed from chart_sections table
// Applies to all users (not per-user)
```

**Recommendation:** Start with Option C (simplest), add Option A later if needed.

---

### Challenge 3: Display Order Management

**Problem:** Track order within sections and globally

**Solution: Composite Ordering**

```typescript
interface ChartOrdering {
  global_display_order: number;    // For ungrouped charts
  section_id: string | null;       // Which section (null = ungrouped)
  section_display_order: number;   // Order within section
}

// Query pattern
const charts = await supabase
  .from('chart_templates')
  .select('*')
  .order('section_id', { ascending: true, nullsFirst: true })
  .order('display_order', { ascending: true });

// Group by section in code
const organized = organizeChartsBySections(charts);
```

---

## 📋 Detailed Task Breakdown

### Week 1-2: Foundation (20 hours)

**Database (6 hours):**
- [ ] Create migration for `chart_sections` table
- [ ] Add `section_id` to `chart_templates`
- [ ] Create RLS policies
- [ ] Test with sample data

**TypeScript Types (4 hours):**
- [ ] Add `ChartSection` interface
- [ ] Update `ChartTemplate` with `section_id`
- [ ] Create `OrganizedCharts` type
- [ ] Update Supabase type generation

**Utility Functions (4 hours):**
- [ ] `organizeChartsBySections()` - Group charts by section
- [ ] `reorderChartsInSection()` - Update display_order
- [ ] `moveChartToSection()` - Change section_id
- [ ] `reorderSections()` - Update section display_order

**Basic UI Components (6 hours):**
- [ ] `SectionHeader.tsx` - Collapsible header component
- [ ] `CreateSectionModal.tsx` - Form to create section
- [ ] Basic section display (no drag yet)

---

### Week 3-4: Core Features (20 hours)

**Section Management (10 hours):**
- [ ] Create section functionality
- [ ] Edit section name/description
- [ ] Delete section (charts become ungrouped)
- [ ] Section ordering (up/down buttons as fallback)
- [ ] Collapse/expand functionality
- [ ] Persist collapse state

**Drag & Drop (10 hours):**
- [ ] Set up multiple droppable zones
- [ ] Drag charts between sections
- [ ] Drag charts from section to ungrouped
- [ ] Drag charts from ungrouped to section
- [ ] Visual feedback (highlight drop zones)
- [ ] Update backend on drop
- [ ] Optimistic UI updates

---

### Week 5-6: Polish & Integration (20 hours)

**ChartDisplay Updates (8 hours):**
- [ ] Render sections with headers
- [ ] Render ungrouped charts separately
- [ ] Show "Add Chart" button per section (admin)
- [ ] Empty section placeholder
- [ ] Loading states
- [ ] Error handling

**F100Modal Integration (6 hours):**
- [ ] Render sections in F-100 reports
- [ ] Section headers in PDF export
- [ ] Intelligent page breaking respects sections
- [ ] Sections expanded by default in PDF

**OnePagerModal Integration (6 hours):**
- [ ] Render sections in one-pager
- [ ] Section headers in exports
- [ ] Collapsible sections
- [ ] Consistent with F-100 layout

---

## 🎨 UI/UX Mockups

### Section Header (Collapsed)

```
┌──────────────────────────────────────────────────────────┐
│ ▶ Risk Assessment (6 charts)           [Edit] [Delete]   │
└──────────────────────────────────────────────────────────┘
```

### Section Header (Expanded - Admin)

```
┌──────────────────────────────────────────────────────────┐
│ ▼ Risk Assessment (6 charts)  ≡ [Drag]  [Edit] [Delete]  │
│   Description: Critical risk metrics for phase assessment │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ Chart 1  │ │ Chart 2  │ │ Chart 3  │                  │
│ │   ≡      │ │   ≡      │ │   ≡      │  [+ Add Chart]   │
│ └──────────┘ └──────────┘ └──────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### Section Header (Expanded - Bank Viewer)

```
┌──────────────────────────────────────────────────────────┐
│ ▼ Risk Assessment (6 charts)                             │
│   Description: Critical risk metrics for phase assessment │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ Chart 1  │ │ Chart 2  │ │ Chart 3  │                  │
│ │          │ │          │ │          │                  │
│ └──────────┘ └──────────┘ └──────────┘                  │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 Permission Model

### Admin Capabilities
- ✅ Create sections
- ✅ Edit section names/descriptions
- ✅ Delete sections
- ✅ Reorder sections (drag or buttons)
- ✅ Drag charts between sections
- ✅ Drag charts in/out of sections
- ✅ Reorder charts within sections
- ✅ Collapse/expand sections (personal preference)

### Bank Viewer Capabilities
- ✅ View sections
- ✅ Collapse/expand sections (personal preference)
- ❌ Cannot create/edit/delete sections
- ❌ Cannot move charts
- ❌ Cannot reorder anything

---

## 💾 Database Queries

### Fetch All Charts with Sections

```typescript
// Fetch sections
const { data: sections } = await supabase
  .from('chart_sections')
  .select('*')
  .eq('farmer_id', farmerId)
  .eq('is_active', true)
  .order('display_order', { ascending: true });

// Fetch charts (both grouped and ungrouped)
const { data: charts } = await supabase
  .from('chart_templates')
  .select('*')
  .eq('farmer_id', farmerId)
  .eq('is_active', true)
  .order('display_order', { ascending: true });

// Organize in code
const organized = {
  ungrouped: charts.filter(c => !c.section_id),
  sections: sections.map(section => ({
    section,
    charts: charts.filter(c => c.section_id === section.id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }))
};
```

### Move Chart to Section

```typescript
const moveChartToSection = async (
  chartId: string, 
  targetSectionId: string | null, 
  newDisplayOrder: number
) => {
  const { error } = await supabase
    .from('chart_templates')
    .update({
      section_id: targetSectionId,
      display_order: newDisplayOrder,
    })
    .eq('id', chartId);
  
  if (error) throw error;
};
```

---

## 📊 User Workflows

### Admin: Create Section and Add Charts

1. Click **"+ Create Section"** button
2. Modal opens: Enter section name (e.g., "Risk Assessment")
3. Optionally add description
4. Save section
5. Section appears with empty state: "Drop charts here"
6. Drag existing charts into section
7. OR click "+ Add Chart" within section to create new chart directly in section

### Admin: Reorganize Charts

1. **Drag chart within section:** Reorder position
2. **Drag chart out of section:** Move to ungrouped area
3. **Drag chart between sections:** Change section membership
4. **Drag section up/down:** Reorder sections

### Bank Viewer: Navigate Sections

1. View organized charts by sections
2. Click ▶/▼ to expand/collapse sections
3. Focus on specific data groups
4. Better overview of farmer analytics

---

## 🎯 Benefits

### For Admins
- ✅ Better organization of 10+ charts
- ✅ Logical grouping (Risk, Performance, Finance, etc.)
- ✅ Easier to manage large dashboards
- ✅ Professional presentation

### For Bank Viewers
- ✅ Easier navigation with many charts
- ✅ Collapse irrelevant sections
- ✅ Find charts faster
- ✅ Better cognitive load management

### For Platform
- ✅ Scalability - Handle 20-30+ charts per farmer
- ✅ Professionalism - Matches industry standards (Grafana)
- ✅ Flexibility - Easy to add/remove/reorganize

---

## ⚠️ Risks & Mitigation

### Risk 1: Complexity of Nested Drag & Drop
**Mitigation:** Implement in stages (first sections only, then drag between)

### Risk 2: Migration of Existing Charts
**Mitigation:** All existing charts default to `section_id = null` (ungrouped)

### Risk 3: Performance with Many Sections
**Mitigation:** Lazy loading, virtual scrolling if >10 sections

### Risk 4: PDF Export Complexity
**Mitigation:** Sections in PDF are just headers + charts (simpler than UI)

---

## 📈 Estimated Effort & Timeline

### Development Time

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1 | Database & Types | 8-12 |
| Phase 2 | Section Management UI | 12-16 |
| Phase 3 | Enhanced Drag & Drop | 16-20 |
| Phase 4 | Chart Display Updates | 8-12 |
| Phase 5 | F100 & OnePager Integration | 6-8 |
| Testing & Polish | All features | 8-12 |
| **Total** | | **58-80 hours** |

**At $100/hour:** $5,800 - $8,000

### Timeline Options

**Fast Track (4-5 weeks):**
- Dedicated developer
- Full-time focus
- Aggressive testing

**Standard (6-8 weeks):**
- Part-time alongside other work
- Normal pace
- Thorough testing

**Incremental (8-12 weeks):**
- Piece by piece
- Lower risk
- Gradual rollout

---

## 🚀 Recommended Implementation Approach

### Incremental Rollout Strategy

**Sprint 1 (Week 1-2): Foundation**
- Database schema
- Basic section display (no drag yet)
- Create/edit/delete sections
- Manual assignment of charts to sections

**Sprint 2 (Week 3-4): Drag & Drop**
- Implement section drag (reorder)
- Implement chart drag within section
- Visual feedback and animations

**Sprint 3 (Week 5-6): Cross-Section Drag**
- Drag between sections
- Drag to/from ungrouped
- Optimistic updates
- Polish UX

**Sprint 4 (Week 7-8): Integration & Polish**
- F100Modal sections
- OnePagerModal sections
- PDF export with sections
- Testing and bug fixes

---

## 📝 Migration Strategy

### Backward Compatibility

**Existing Charts:**
- All charts have `section_id = null` (ungrouped)
- Display exactly as before
- No disruption to existing users

**Gradual Adoption:**
- Admins can create sections at their pace
- Some farmers may never use sections (that's OK)
- Sections are optional, not required

---

## 🎨 Visual Design Consistency

### Section Headers - Theme-Aware

```typescript
// Light mode
<div className="bg-muted/30 border-l-4 border-primary px-4 py-3">
  <h3 className="text-heading-primary font-semibold">
    Section Name
  </h3>
</div>

// Dark mode (automatic)
<div className="bg-muted/30 dark:bg-muted/20 border-l-4 border-primary">
  {/* Same structure, theme-aware colors */}
</div>
```

### Collapse/Expand Animation

```typescript
<Collapsible open={!section.is_collapsed}>
  <CollapsibleTrigger>
    {section.is_collapsed ? <ChevronRight /> : <ChevronDown />}
  </CollapsibleTrigger>
  <CollapsibleContent className="animate-in slide-in-from-top">
    {/* Charts */}
  </CollapsibleContent>
</Collapsible>
```

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Section CRUD operations
- [ ] Chart assignment to sections
- [ ] Display order calculations
- [ ] Organize charts function

### Integration Tests
- [ ] Drag chart within section
- [ ] Drag chart between sections
- [ ] Create section with charts
- [ ] Delete section (charts ungrouped)
- [ ] Collapse/expand persistence

### E2E Tests
- [ ] Admin creates section and adds charts
- [ ] Admin reorders sections
- [ ] Bank viewer views and collapses sections
- [ ] PDF export includes sections
- [ ] Charts display correctly after section operations

---

## 💡 Future Enhancements (Post-MVP)

**Phase 2 Features:**
- [ ] Section templates (pre-defined groups)
- [ ] Duplicate section (copy structure)
- [ ] Section-level permissions
- [ ] Section-level export (export one section as PDF)
- [ ] Section search/filter
- [ ] Section tags/categories
- [ ] Section color coding
- [ ] Nested sections (sections within sections)

---

## 📊 Success Metrics

### Adoption
- % of farmers using sections (target: 40% in 3 months)
- Average sections per farmer (target: 2-4)
- Charts per section (target: 4-6)

### UX Improvement
- Time to find specific chart (target: 30% reduction)
- User satisfaction with organization (target: 8/10)
- Support tickets about chart finding (target: 50% reduction)

### Technical
- Page load performance (should remain under 2 seconds)
- Drag operation latency (target: <100ms)
- PDF export time (should not increase significantly)

---

## 🎬 Next Steps - Your Decision

**I can proceed with:**

**Option A: Start Implementation**
- Create database migration
- Build TypeScript types
- Implement basic section UI (no drag yet)
- **Effort:** 8-12 hours to get foundation working

**Option B: Build Detailed PRD**
- Create mockups/wireframes
- Define exact UX flows
- Document edge cases
- **Effort:** 4-6 hours planning document

**Option C: Build Prototype First**
- Quick proof-of-concept
- Basic sections (no drag)
- Validate approach
- **Effort:** 12-16 hours for working prototype

**My Recommendation:**
Start with **Option A** (Foundation) to get database and basic UI working, then iterate based on your feedback. This allows you to see and test the concept early.

---

**What would you like me to do?**
1. Start building the foundation (database + basic UI)?
2. Create detailed mockups and PRD first?
3. Build a quick prototype to validate?
4. Something else?

This is a high-value feature that will set TelAgri apart from competitors! 🚀📊


