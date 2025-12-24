# Used Data Maps Upload Feature

## Overview
Added file upload capability to the "Used Data" section in F-100 reports, allowing admins to upload PDF and image files per phase that will be visible to bank viewers.

## Implementation Date
December 18, 2025

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251218000002_add_phase_used_data_maps.sql`

Created new table `phase_used_data_maps` to store uploaded map files:

```sql
Columns:
- id: UUID (Primary Key)
- farmer_id: UUID → farmers.id
- phase_number: INTEGER (1-12)
- file_name: TEXT (original filename)
- file_path: TEXT (Supabase Storage path)
- file_mime: TEXT (MIME type)
- file_size_bytes: BIGINT
- display_order: INTEGER
- annotation: TEXT (optional note)
- created_at: TIMESTAMPTZ
- created_by: UUID → auth.users.id
```

**Storage Path Format:**
```
phase_used_data_maps/{farmer_id}/{phase_number}/{timestamp}_{filename}
```

**RLS Policies:**
- Admins: Full access (CRUD)
- Bank Viewers: Read-only for their bank's farmers
- Specialists: Read-only for their assigned phases

### 2. MonitoredIssueEditor Component Updates
**File:** `src/components/MonitoredIssueEditor.tsx`

#### New Imports
- File-related icons: `Upload`, `Trash2`, `FileImage`, `FileText`, `Image`
- `AlertDialog` components for delete confirmation

#### New State Variables
```typescript
const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
const [fileAnnotations, setFileAnnotations] = useState<Record<string, string>>({});
const [isUploading, setIsUploading] = useState(false);
const [deleteMapDialog, setDeleteMapDialog] = useState<{ open: boolean; mapId?: string; fileName?: string }>({ open: false });
```

#### New Queries
- **uploadedMaps**: Fetches all uploaded maps for the current farmer and phase

#### New Mutations
- **uploadMapMutation**: Uploads files to Supabase Storage and saves metadata
- **deleteMapMutation**: Deletes files from both Storage and database

#### Helper Functions
- `handleFileSelect`: Validates and adds files to upload queue
- `handleUploadFiles`: Triggers upload mutation
- `handleDeleteMap`: Opens delete confirmation dialog
- `confirmDeleteMap`: Executes file deletion
- `getFileIcon`: Returns appropriate icon based on MIME type
- `formatFileSize`: Formats bytes to KB/MB
- `openFileInViewer`: Opens file in new tab with signed URL

## Feature Behavior

### Admin View (Edit Mode)

When admin clicks gear icon on "Used Data":

1. **Upload Section** (top):
   - Drag-and-drop / click to select files
   - Accepts: PDF, PNG, JPG, JPEG
   - Shows preview of files to upload with delete option
   - "Upload X Files" button
   - Auto-uploads to Supabase Storage

2. **Uploaded Maps List** (below):
   - Shows all previously uploaded files
   - Click filename to open in new tab
   - Delete button for each file
   - Displays: filename, size, upload date, annotation

### Bank Viewer View (Read-Only Mode)

When bank viewer clicks eye icon on "Used Data":

1. **Uploaded Maps List** (read-only):
   - Shows all uploaded files
   - Click filename to open in new tab
   - No delete button
   - Displays: filename, size, upload date, annotation
   - If no files: "No maps uploaded for this phase yet."

## UI Layout

```
┌────────────────────────────────────────────────────────────┐
│ Edit Phase X - Used Data                          [✕]      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Description                                                 │
│ [Rich Text Editor]                                          │
│                                                             │
│ ──────────────────────────────────────────────────────────│
│                                                             │
│ 🗺️ Interactive Maps for Phase X          [🔘 Showing]    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ▼ Map Name                            [🔗 Open]      │   │
│ │   [Iframe Display]                                   │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ──────────────────────────────────────────────────────────│
│                                                             │
│ 📤 Uploaded Maps & Documents                               │
│                                                             │
│ ┌────────────────────────────────────────────────────┐     │
│ │  📤 Click to upload maps or documents              │     │
│ │     PDF, PNG, JPG, JPEG accepted                   │     │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
│ Files to upload:                                            │
│ ┌────────────────────────────────────────────────────┐     │
│ │ 📄 soil_analysis.pdf  (2.3 MB)            [🗑️]     │     │
│ │ 🖼️ field_map.png      (1.5 MB)            [🗑️]     │     │
│ └────────────────────────────────────────────────────┘     │
│ [📤 Upload 2 Files]                                        │
│                                                             │
│ 2 uploaded files:                                           │
│ ┌────────────────────────────────────────────────────┐     │
│ │ 📄 previous_report.pdf     [🗑️]                     │     │
│ │    2.1 MB • Dec 15, 2025                           │     │
│ └────────────────────────────────────────────────────┘     │
│ ┌────────────────────────────────────────────────────┐     │
│ │ 🖼️ satellite_view.jpg      [🗑️]                     │     │
│ │    3.4 MB • Dec 14, 2025                           │     │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
└────────────────────────────────────────────────────────────┘
[Cancel]                                      [Save Changes]
```

## File Upload Flow

### Admin Upload Process
```
1. Admin clicks gear icon on "Used Data"
   ↓
2. Scrolls to "Uploaded Maps & Documents"
   ↓
3. Clicks upload area or drag-drops files
   ↓
4. Files added to queue (with validation)
   ↓
5. Clicks "Upload X Files" button
   ↓
6. Files uploaded to:
   - Supabase Storage: farmer-documents bucket
   - Path: phase_used_data_maps/{farmer_id}/{phase_number}/
   ↓
7. Metadata saved to phase_used_data_maps table
   ↓
8. Files appear in "uploaded files" list
   ↓
9. Bank viewers can now see these files
```

### Bank Viewer Access
```
1. Bank viewer clicks eye icon on "Used Data"
   ↓
2. Sees description (read-only)
   ↓
3. Scrolls to "Uploaded Maps & Documents"
   ↓
4. Sees list of all uploaded files
   ↓
5. Clicks filename → Opens in new tab
   ↓
6. Cannot delete files (admin-only)
```

## File Type Support

### Accepted Formats
- ✅ PDF (`.pdf`) - Reports, documents
- ✅ PNG (`.png`) - Images, maps, screenshots
- ✅ JPG/JPEG (`.jpg`, `.jpeg`) - Photos, maps
- ✅ GIF (`.gif`) - Animated maps (if browser supports)
- ✅ WebP (`.webp`) - Modern image format

### File Validation
- MIME type check on upload
- Only image/* and application/pdf accepted
- Rejected files show error toast

## Security Considerations

### Row Level Security (RLS)
- **Admins**: Full CRUD access to all maps
- **Bank Viewers**: Read-only access to their bank's farmers' maps
- **Specialists**: Read-only access to their assigned phases

### Storage Security
- Files stored in Supabase Storage `farmer-documents` bucket
- Signed URLs with 1-hour expiry for secure access
- Files opened in new tab to prevent MIME type issues

### Input Validation
- File type validation before upload
- Path sanitization to prevent directory traversal
- Unique constraint on farmer_id + phase_number + file_path

## Database Schema

```
phase_used_data_maps
├── id: UUID (Primary Key)
├── farmer_id: UUID → farmers.id
├── phase_number: INTEGER (1-12)
├── file_name: TEXT
├── file_path: TEXT (Storage path)
├── file_mime: TEXT
├── file_size_bytes: BIGINT
├── display_order: INTEGER
├── annotation: TEXT (optional)
├── created_at: TIMESTAMPTZ
└── created_by: UUID → auth.users.id

Indexes:
- idx_phase_used_data_maps_farmer_phase (farmer_id, phase_number)
- idx_phase_used_data_maps_created_at (created_at DESC)

Constraints:
- UNIQUE(farmer_id, phase_number, file_path)
- phase_number CHECK (BETWEEN 1 AND 12)
```

## Testing Checklist

### Admin Testing
- [ ] Apply migrations: `npx supabase db push`
- [ ] Open F-100 report, click gear icon on "Used Data"
- [ ] Upload section visible at bottom
- [ ] Upload a PDF file
  - [ ] File appears in queue
  - [ ] Click "Upload 1 File"
  - [ ] Success toast appears
  - [ ] File appears in uploaded list
- [ ] Upload multiple images at once
  - [ ] All files upload successfully
  - [ ] Appear in correct order
- [ ] Click uploaded filename
  - [ ] Opens in new tab
  - [ ] File displays correctly
- [ ] Delete uploaded file
  - [ ] Confirmation dialog appears
  - [ ] Click "Delete"
  - [ ] File removed from list
  - [ ] File removed from storage
- [ ] Try uploading invalid file (.docx, .txt)
  - [ ] Shows error toast
  - [ ] File rejected

### Bank Viewer Testing
- [ ] Login as bank viewer
- [ ] Open same F-100 report
- [ ] Click eye icon on "Used Data"
- [ ] Uploaded Maps section visible
- [ ] See all files uploaded by admin
- [ ] Click filename - opens in new tab
- [ ] No delete buttons visible
- [ ] No upload section visible
- [ ] If no files uploaded:
  - [ ] See "No maps uploaded for this phase yet."

### Edge Cases
- [ ] Upload file with same name twice
  - [ ] Timestamp prevents conflicts
- [ ] Delete file while someone else viewing
  - [ ] Handles gracefully with error toast
- [ ] Upload very large file (>10MB)
  - [ ] Shows appropriate loading state
  - [ ] Uploads successfully or shows size limit error
- [ ] Internet disconnection during upload
  - [ ] Shows error toast
  - [ ] Allows retry

## Related Features

### Differences from Interactive Maps
- **Interactive Maps**: Admin adds iframe URLs, viewed in collapsible iframes
- **Uploaded Maps**: Admin uploads actual files (PDF/images), viewed by opening in new tab

### Use Cases
- **Interactive Maps**: For live, interactive QGIS/web maps
- **Uploaded Maps**: For static reports, scanned documents, satellite imagery, analysis reports

## Troubleshooting

### Issue: Upload fails
**Check:**
1. Supabase Storage bucket `farmer-documents` exists
2. User has upload permissions
3. File size within limits
4. Valid file format (PDF or image)

### Issue: Bank viewer cannot see files
**Check:**
1. Bank viewer role set correctly
2. Farmer belongs to viewer's bank
3. RLS policies applied correctly
4. Files actually uploaded (check phase_used_data_maps table)

### Issue: File won't open
**Check:**
1. File exists in Supabase Storage
2. Signed URL generation working
3. Browser allows pop-ups
4. File path in database matches storage

## Future Enhancements

### Potential Improvements
1. **Inline Preview**: Show PDF/image preview in modal
2. **File Annotations**: Rich text annotations per file
3. **Drag-and-Drop Reordering**: Change display order
4. **Bulk Upload**: Upload multiple files with progress bar
5. **File Categories**: Tag files (satellite, analysis, report, etc.)
6. **Download All**: Zip download of all phase files
7. **Version History**: Track file updates and revisions

## Code References

### Key Files
- `src/components/MonitoredIssueEditor.tsx` - Main implementation
- `supabase/migrations/20251218000002_add_phase_used_data_maps.sql` - Database schema

### Related Components
- `OnePagerSummaryModal` - Similar file viewing pattern
- `FileViewer` - Could be integrated for better preview

---

**Implementation Status**: ✅ Complete
**Migration Status**: ⏳ Pending Application
**Testing Status**: ⏳ Pending User Testing

