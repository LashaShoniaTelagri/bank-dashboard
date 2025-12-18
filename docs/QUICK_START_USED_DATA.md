# Quick Start: Used Data Feature

## What is "Used Data"?

"Used Data" is a new section in F-100 reports that allows you to document data sources and optionally display Interactive Maps directly within the report.

## Quick Setup (3 Steps)

### Step 1: Apply Database Migration
```bash
cd /Users/lasha/Desktop/TelAgri/tech/gitlab/new-system/telagri-bank-dashboard
npx supabase db push
```

This adds "Used Data" as the 8th monitored issue in your database.

### Step 2: Test as Admin
1. Login as admin
2. Open any F-100 report (click F-100 button on farmer phase)
3. Scroll to bottom - you'll see "Used Data" section after "Other"
4. Click the gear icon (⚙️) to add description
5. If the phase has Interactive Maps:
   - You'll see a "Show Maps" switch
   - Toggle it ON to display maps in the section
   - Toggle it OFF to hide maps

### Step 3: Test as Bank Viewer
1. Login as bank viewer
2. Open same F-100 report
3. Verify "Used Data" appears
4. Click eye icon (👁️) to view description (read-only)
5. If admin enabled maps, you'll see them automatically

## Key Features

### For Admins
✅ Edit Used Data description with rich text editor
✅ Toggle Interactive Maps display with switch control
✅ Maps only show if phase has them attached
✅ Collapsible map sections for better organization

### For Bank Viewers
✅ View Used Data description (read-only)
✅ See Interactive Maps if admin enabled them
✅ No toggle control (follows admin's setting)

## Where Used Data Appears

```
F-100 Report Structure:
1. Irrigation
2. Soil and plant fertility
3. Pest control
4. Weather risk
5. Weed control
6. Management
7. Other
8. Used Data ← NEW! (with optional Interactive Maps)
```

## How to Add Interactive Maps

Interactive Maps are managed in the Data Upload Modal:

1. Go to Farmers table
2. Click "Upload Data" for a farmer
3. Select F-100 Phase
4. Scroll to "Interactive Maps for Phase X" section
5. Add iframe URLs with names and annotations
6. These maps will be available in Used Data section

## Troubleshooting

**Q: I don't see "Used Data" section**
A: Run `npx supabase db push` to apply the migration

**Q: I don't see the "Show Maps" switch**
A: The switch only appears if:
   - You're logged in as admin
   - The phase has Interactive Maps attached

**Q: Bank viewer can edit Used Data**
A: Check user role in database - should be 'bank_viewer', not 'admin'

**Q: Maps not displaying**
A: 
   - Check if "Show Maps" switch is ON (admin only)
   - Verify iframe URLs are valid in farmer_phases table
   - Check browser console for CORS errors

## Files Modified

- ✅ `supabase/migrations/20251218000000_add_used_data_monitored_issue.sql`
- ✅ `src/components/F100Modal.tsx`
- ✅ `docs/development/used-data-feature-implementation.md`
- ✅ `docs/development/used-data-feature-diagram.md`

## Next Steps

1. Apply migration: `npx supabase db push`
2. Test with real data
3. Add Used Data descriptions to existing F-100 reports
4. Enable Interactive Maps where relevant
5. Train bank viewers on new feature

---

**Need Help?** See full documentation in `docs/development/used-data-feature-implementation.md`

