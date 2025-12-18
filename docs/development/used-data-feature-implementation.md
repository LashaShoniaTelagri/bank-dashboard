# Used Data Feature Implementation

## Overview
Added "Used Data" section to F-100 reports with Interactive Maps integration. This feature allows admins to manage data source documentation and optionally display interactive maps within the Used Data section.

## Implementation Date
December 18, 2025

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251218000000_add_used_data_monitored_issue.sql`

- Added "Used Data" as the 8th monitored issue (display_order: 8)
- Positioned after "Other" (display_order: 7) in the F-100 report
- Follows same pattern as existing monitored issues

**To Apply Migration:**
```bash
npx supabase db push
```

### 2. F100Modal Component Updates
**File:** `src/components/F100Modal.tsx`

#### New Imports
- `Switch` - Toggle control for iframe display
- `Label` - Label for switch control
- `Map`, `ExternalLink`, `ChevronDown`, `ChevronRight` - Icons for map display
- `useMutation` - For handling iframe display preference updates

#### New State Variables
```typescript
// Used Data iframe display state
const [showUsedDataIframes, setShowUsedDataIframes] = useState(false);
const [collapsedIframes, setCollapsedIframes] = useState<Set<string>>(new Set());
```

#### New Data Queries
- **Phase Iframes Query**: Fetches iframe URLs from `farmer_phases.iframe_urls` for the current phase
- **Separated Issues**: Splits monitored issues into `usedDataIssue` and `otherMonitoredIssues`

#### New UI Features

##### For Admins:
1. **Gear Icon (Edit)**: Opens rich text editor for Used Data description
2. **Switch Control**: "Show Maps" toggle (only visible if phase has interactive maps)
   - When ON: Displays all interactive maps as iframes within Used Data section
   - When OFF: Shows hint about available maps
3. **Map Display**: Full iframe rendering with collapse/expand functionality

##### For Bank Viewers:
1. **Eye Icon (View)**: Opens read-only view of Used Data description
2. **No Switch Control**: Cannot toggle map display
3. **Map Visibility**: Follows admin's setting (if admin enabled maps, bank viewer sees them)

#### Interactive Maps Display
When enabled, maps are shown with:
- Collapsible sections (click header to expand/collapse)
- Map name and annotation
- "Open" link to view in new tab
- Full iframe rendering (500px height)
- Sandbox security attributes

### 3. MonitoredIssueEditor Component
**File:** `src/components/MonitoredIssueEditor.tsx`

- Already supports `readOnly` prop for bank viewer access
- No changes needed - existing functionality works perfectly

## Feature Behavior

### Used Data Section Location
- Appears AFTER all other monitored issues (Irrigation, Soil, Pest, Weather, Weed, Management, Other)
- Numbered as position 8 (or last position based on active issues)
- Separated by a visual separator line

### Interactive Maps Integration
The Used Data section checks if the current phase has attached Interactive Maps:

1. **No Maps Attached**: 
   - Admin sees normal Used Data section with text editor
   - No switch control displayed

2. **Maps Attached (Admin View)**:
   - Switch control appears: "Show Maps"
   - When OFF: Shows blue hint box indicating maps are available
   - When ON: Displays all maps as iframes below the description

3. **Maps Attached (Bank Viewer)**:
   - Sees whatever admin configured
   - If admin enabled maps, bank viewer sees them
   - No ability to toggle display

### Rich Text Editor
- Same behavior as other monitored issues
- Supports full HTML formatting
- Phase-specific descriptions stored in `phase_monitored_data` table
- Auto-saves on submit

## Database Schema

### Tables Used
1. **monitored_issues**: Stores "Used Data" definition
   ```sql
   name: 'Used Data'
   display_order: 8
   is_active: true
   ```

2. **phase_monitored_data**: Stores phase-specific Used Data descriptions
   ```sql
   farmer_id: UUID
   phase_number: INTEGER (1-12)
   issue_id: UUID (Used Data issue ID)
   description: TEXT (HTML content)
   ```

3. **farmer_phases**: Stores interactive map URLs
   ```sql
   farmer_id: UUID
   phase_number: INTEGER (1-12)
   iframe_urls: JSONB (array of {url, name, annotation})
   ```

## Testing Checklist

### Admin Testing
- [ ] Apply migration: `npx supabase db push`
- [ ] Open F-100 report for any farmer/phase
- [ ] Verify "Used Data" appears after "Other" section
- [ ] Click gear icon on Used Data - should open rich text editor
- [ ] Add/edit description and save
- [ ] Verify description displays correctly
- [ ] If phase has Interactive Maps:
  - [ ] Verify "Show Maps" switch appears
  - [ ] Toggle switch ON - maps should display
  - [ ] Toggle switch OFF - hint message should appear
  - [ ] Expand/collapse individual maps
  - [ ] Click "Open" link - should open in new tab
- [ ] If phase has NO Interactive Maps:
  - [ ] Verify no switch control appears
  - [ ] Only description editor available

### Bank Viewer Testing
- [ ] Login as bank viewer
- [ ] Open F-100 report for same farmer/phase
- [ ] Verify "Used Data" appears in same position
- [ ] Click eye icon on Used Data - should open read-only view
- [ ] Verify cannot edit description
- [ ] If admin enabled maps:
  - [ ] Verify maps display automatically
  - [ ] Can expand/collapse maps
  - [ ] Can click "Open" link
- [ ] Verify no "Show Maps" switch visible

### PDF Export Testing
- [ ] Generate PDF with Used Data section
- [ ] Verify Used Data description appears correctly
- [ ] Verify maps are NOT included in PDF (only description)
- [ ] Verify proper page breaks around Used Data section

## Security Considerations

### Row Level Security (RLS)
- Used Data follows same RLS policies as other monitored issues
- Bank viewers can only see data for their assigned farmers
- Specialists see data only for their assigned phases

### Iframe Security
- All iframes use sandbox attributes:
  - `allow-same-origin`
  - `allow-scripts`
  - `allow-popups`
  - `allow-forms`
- External links open in new tab with `noopener,noreferrer`

## Future Enhancements

### Potential Improvements
1. **Persistent Preference**: Store "Show Maps" preference in database
2. **PDF Integration**: Option to include maps in PDF export
3. **Map Thumbnails**: Show preview thumbnails when collapsed
4. **Map Annotations**: Rich text annotations for each map
5. **Map Ordering**: Drag-and-drop reordering of maps
6. **Map Analytics**: Track which maps are viewed most

### Related Features
- Interactive Maps management (already exists in DataUploadModal)
- Phase-specific data management
- F-100 report generation and export

## Troubleshooting

### Issue: "Used Data" not appearing
**Solution**: Apply migration with `npx supabase db push`

### Issue: Switch control not showing
**Check**: 
1. Are you logged in as admin?
2. Does the phase have Interactive Maps attached?
3. Check `farmer_phases.iframe_urls` for the phase

### Issue: Maps not displaying
**Check**:
1. Is "Show Maps" switch enabled?
2. Are iframe URLs valid?
3. Check browser console for CORS errors
4. Verify iframe URLs are accessible

### Issue: Bank viewer can edit
**Check**: 
1. Verify user role in `profiles` table
2. Check `isAdmin` prop in F100Modal
3. Verify `readOnly` prop passed to MonitoredIssueEditor

## Code References

### Key Files
- `src/components/F100Modal.tsx` - Main implementation
- `src/components/MonitoredIssueEditor.tsx` - Text editor component
- `supabase/migrations/20251218000000_add_used_data_monitored_issue.sql` - Database migration

### Related Components
- `src/components/DataUploadModal.tsx` - Where Interactive Maps are managed
- `src/pages/SpecialistDashboard.tsx` - How specialists see Interactive Maps

## Documentation Updates
- Added to `docs/development/` folder
- Update `docs/README.md` to include this feature

---

**Implementation Status**: ✅ Complete
**Migration Status**: ⏳ Pending Application
**Testing Status**: ⏳ Pending User Testing

