# F-100 External URL Feature

## Overview
Allows admins to specify an external URL (e.g., Google Docs link) for F-100 reports. When a URL is set, bank viewers will use this link instead of the generated PDF download.

## Implementation Date
December 24, 2025

## Use Case

### Scenario
Admin wants to provide a live, editable Google Docs or external link for the F-100 report instead of a static PDF.

### Benefits
- ✅ Dynamic updates without re-generating PDF
- ✅ Collaborative editing in Google Docs
- ✅ Version control in external platform
- ✅ Rich formatting and interactive content
- ✅ Easier sharing and commenting

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251218000003_add_f100_url_to_farmer_phases.sql`

Added `f100_url` column to `farmer_phases` table:
```sql
ALTER TABLE public.farmer_phases
  ADD COLUMN IF NOT EXISTS f100_url TEXT;
```

### 2. F100Modal Component Updates
**File:** `src/components/F100Modal.tsx`

#### New State Variables
```typescript
const [f100Url, setF100Url] = useState('');
const [isEditingUrl, setIsEditingUrl] = useState(false);
const [isSavingUrl, setIsSavingUrl] = useState(false);
```

#### New Mutations
- **saveF100UrlMutation**: Saves URL to `farmer_phases.f100_url`

#### New Functions
- **handleSaveUrl**: Triggers save mutation
- **handleDownload**: Smart download - uses URL if available, otherwise generates PDF

#### Updated Queries
- **phaseData**: Now fetches `f100_url` field

#### New UI Elements
1. **"Set URL" / "Edit URL" Button** (Admin only, in header)
2. **URL Editor Panel** (Collapsible, with input field and save/cancel buttons)
3. **Smart Download Button** (Changes text and icon based on URL presence)

## Feature Behavior

### Admin Workflow

**1. Setting F-100 URL:**
```
1. Open F-100 Report
2. Click "Set URL" button in header
3. URL editor panel slides down
4. Enter Google Docs or external URL
5. Click "Save"
6. Success toast appears
7. Download button changes to "Open F-100"
```

**2. Editing F-100 URL:**
```
1. Open F-100 Report (URL already set)
2. Click "Edit URL" button
3. Modify URL in input field
4. Click "Save" or "Cancel"
```

**3. Removing F-100 URL:**
```
1. Click "Edit URL"
2. Clear the input field
3. Click "Save"
4. Download button reverts to "Download PDF"
```

### Bank Viewer Workflow

**When URL is Set:**
```
1. Open F-100 Report
2. See "Open F-100" button (with ExternalLink icon)
3. Click button
4. Opens external URL in new tab
5. No PDF generation
```

**When URL is NOT Set:**
```
1. Open F-100 Report
2. See "Download PDF" button (with Download icon)
3. Click button
4. PDF generates and downloads
```

## UI Layout

### Admin View - Header
```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 - F-100 Report                                      │
│ Farmer Name - Comprehensive overview                        │
│                                                              │
│ [🔗 Edit URL]  [📥 Download PDF]  [✕]                       │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ F-100 Report URL                                     │    │
│ │ Enter external URL (e.g., Google Docs)...            │    │
│ │                                                       │    │
│ │ [https://docs.google.com/...]  [💾 Save] [Cancel]   │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Bank Viewer View - Header (URL Set)
```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 - F-100 Report                                      │
│ Farmer Name - Comprehensive overview                        │
│                                                              │
│                        [🔗 Open F-100]  [✕]                 │
└─────────────────────────────────────────────────────────────┘
```

### Bank Viewer View - Header (No URL)
```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 - F-100 Report                                      │
│ Farmer Name - Comprehensive overview                        │
│                                                              │
│                        [📥 Download PDF]  [✕]               │
└─────────────────────────────────────────────────────────────┘
```

## Button State Logic

```typescript
// Smart download button
const handleDownload = () => {
  if (phaseData?.f100_url) {
    // URL exists → Open in new tab
    window.open(phaseData.f100_url, '_blank');
  } else {
    // No URL → Generate PDF
    handleDownloadPDF();
  }
};

// Button appearance
{phaseData?.f100_url ? (
  <>
    <ExternalLink /> Open F-100
  </>
) : (
  <>
    <Download /> Download PDF
  </>
)}
```

## Database Schema

```sql
farmer_phases
├── id: UUID
├── farmer_id: UUID
├── phase_number: INTEGER (1-12)
├── score: DECIMAL(3,1)
├── issue_date: DATE
├── iframe_urls: JSONB
└── f100_url: TEXT           ← NEW!
    └── External F-100 report URL (optional)
```

## Security Considerations

### URL Validation
- Input type="url" for browser validation
- Trims whitespace before saving
- Saves NULL if empty

### Access Control
- Only admins can set/edit URL
- Bank viewers see the button but cannot edit
- URL opens in new tab with `noopener,noreferrer` for security

## Testing Checklist

### Admin Testing
- [ ] Apply migration: `npx supabase db push --linked`
- [ ] Open F-100 report
- [ ] Click "Set URL" button
- [ ] URL editor panel appears
- [ ] Enter Google Docs URL
- [ ] Click "Save"
- [ ] Success toast appears
- [ ] Button changes to "Open F-100"
- [ ] Click "Open F-100"
  - [ ] Opens URL in new tab
  - [ ] No PDF generation
- [ ] Click "Edit URL"
  - [ ] Panel opens with current URL
  - [ ] Modify URL
  - [ ] Click "Save"
  - [ ] URL updates successfully
- [ ] Clear URL and save
  - [ ] Button reverts to "Download PDF"
  - [ ] PDF generation works again

### Bank Viewer Testing
- [ ] Login as bank viewer
- [ ] Open F-100 report (URL set by admin)
- [ ] No "Set URL" button visible
- [ ] See "Open F-100" button
- [ ] Click button
  - [ ] Opens external URL
  - [ ] Correct link opens
- [ ] Test with no URL set
  - [ ] See "Download PDF" button
  - [ ] PDF downloads correctly

### Edge Cases
- [ ] Invalid URL format
  - [ ] Browser validation shows error
- [ ] URL with special characters
  - [ ] Saves and opens correctly
- [ ] Very long URL
  - [ ] Input handles gracefully
- [ ] URL that requires authentication
  - [ ] Opens but may require user login
- [ ] Cancel editing
  - [ ] Reverts to original URL
  - [ ] Panel closes without saving

## Common URLs to Support

### Google Docs
```
https://docs.google.com/document/d/DOCUMENT_ID/edit
```

### Google Sheets
```
https://sheets.google.com/spreadsheets/d/SHEET_ID/edit
```

### OneDrive
```
https://onedrive.live.com/...
```

### Dropbox
```
https://www.dropbox.com/s/...
```

## Future Enhancements

### Potential Improvements
1. **URL Preview**: Show favicon or link preview
2. **URL History**: Track previous URLs
3. **URL Types**: Dropdown for common platforms (Google Docs, Sheets, etc.)
4. **URL Validation**: Check if URL is accessible
5. **Hybrid Mode**: Allow both URL and PDF download
6. **URL Analytics**: Track how many times URL is accessed
7. **URL Expiry**: Set expiration date for temporary links

## Troubleshooting

### Issue: URL doesn't save
**Check:**
1. User has admin role
2. Farmer phase exists in database
3. URL is valid format
4. No database connection issues

### Issue: Bank viewer sees "Download PDF" when URL is set
**Check:**
1. URL actually saved in database
2. phaseData query fetching f100_url
3. Browser cache - try hard refresh

### Issue: URL opens wrong page
**Check:**
1. URL copied correctly
2. No extra spaces or characters
3. URL is accessible (not private/restricted)

## Migration Commands

### Apply Migration
```bash
cd /path/to/telagri-bank-dashboard
npx supabase db push --linked
```

### Verify Migration
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'farmer_phases' 
AND column_name = 'f100_url';

-- Check existing URLs
SELECT farmer_id, phase_number, f100_url 
FROM farmer_phases 
WHERE f100_url IS NOT NULL;
```

## Code References

### Key Files
- `src/components/F100Modal.tsx` - Main implementation
- `supabase/migrations/20251218000003_add_f100_url_to_farmer_phases.sql` - Database schema

### Related Features
- PDF generation (existing)
- Phase management system
- Bank viewer permissions

---

**Implementation Status**: ✅ Complete
**Migration Status**: ⏳ Pending Application
**Testing Status**: ⏳ Pending User Testing

