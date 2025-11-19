# Farmer-Specific Charts Implementation ✅

## 🎯 Problem Solved

**Before:**
- ❌ Charts were global (shown for ALL farmers)
- ❌ Admins couldn't see which bank each farmer belonged to
- ❌ No way to manage charts individually per farmer

**After:**
- ✅ Charts are farmer-specific (each farmer has their own charts)
- ✅ Admin sees bank name on each farmer card
- ✅ Charts only display for the specific farmer they're created for
- ✅ Complete farmer-specific chart management

---

## 📋 Changes Made

### 1. **Database Migration** (`supabase/migrations/20251112000002_add_farmer_id_to_charts.sql`)

**Added `farmer_id` column to `chart_templates` table:**
```sql
ALTER TABLE public.chart_templates
ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE;
```

**Key Features:**
- `farmer_id` links charts to specific farmers
- `ON DELETE CASCADE` - if farmer is deleted, their charts are automatically deleted
- Index added for fast queries: `idx_chart_templates_farmer_id`

**Updated RLS Policies:**
- ✅ Admins can manage all charts (no change)
- ✅ Bank viewers can only view charts for farmers in their bank
- ✅ Specialists can only view charts for their assigned farmers

---

### 2. **Chart Display Component** (`src/components/ChartDisplay.tsx`)

**Updated to filter by farmer:**
```typescript
// Before: Showed all charts
.from('chart_templates')
.select('*')
.eq('is_active', true)

// After: Only shows charts for specific farmer
.from('chart_templates')
.select('*')
.eq('is_active', true)
.eq('farmer_id', farmerId)  // ✅ Farmer-specific!
```

**Query key updated:**
```typescript
queryKey: ['chart-templates', farmerId]  // Cache per farmer
```

---

### 3. **Farmer List View** (`src/components/FarmerListView.tsx`)

**Fetch bank name for each farmer:**
```typescript
const { data: bankData } = await supabase
  .from('banks')
  .select('name')
  .eq('id', farmer.bank_id)
  .single();
```

**Fetch farmer-specific chart count:**
```typescript
const { count: chartCount } = await supabase
  .from('chart_templates')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true)
  .eq('farmer_id', farmer.id);  // ✅ Count only this farmer's charts
```

**Return enriched data:**
```typescript
return {
  // ... other fields
  bank_name: bankData?.name,
  chart_count: chartCount || 0,  // Farmer-specific count
};
```

---

### 4. **Farmer Card Component** (`src/components/FarmerCard.tsx`)

**Display bank name (Admin only):**
```tsx
{isAdmin && farmer.bank_name && (
  <div className="flex items-center gap-2 text-sm">
    <Building2 className="h-4 w-4 text-emerald-600" />
    <span className="font-medium">{farmer.bank_name}</span>
  </div>
)}
```

**Chart count now shows farmer-specific count:**
```tsx
<span>{farmer.chart_count} Charts</span>  // Only this farmer's charts
```

---

### 5. **Farmer Profile Page** (`src/pages/FarmerProfilePage.tsx`)

**"Add Chart" button passes farmer ID:**
```tsx
<Button 
  variant="outline"
  onClick={() => navigate(`/admin/charts/new?farmerId=${farmerId}`)}
>
  <BarChart3 className="h-4 w-4 mr-2" />
  Add Chart
</Button>
```

**ChartDisplay receives farmer ID:**
```tsx
<ChartDisplay farmerId={farmerId || ''} />
```

---

### 6. **Chart Builder Page** (`src/pages/ChartBuilderPage.tsx`)

**Get farmer ID from URL:**
```typescript
const [searchParams] = useSearchParams();
const farmerIdFromUrl = searchParams.get('farmerId');
const [farmerId, setFarmerId] = useState<string | null>(farmerIdFromUrl);
```

**Load farmer ID when editing:**
```typescript
if (existingChart) {
  // ... other fields
  setFarmerId((existingChart as any).farmer_id || null);
}
```

**Save farmer ID with chart:**
```typescript
const chartData: any = {
  name: name.trim(),
  chart_type: chartType,
  chart_data: { /* ... */ },
  annotation: annotation.trim() || undefined,
  is_active: true,
  farmer_id: farmerId,  // ✅ Associate with specific farmer
};
```

---

## 🔒 Security (RLS Policies)

### Admin Access:
```sql
-- Admins can manage ALL charts (all farmers)
CREATE POLICY "Admins can manage all charts"
FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
```

### Bank Viewer Access:
```sql
-- Bank viewers can ONLY view charts for farmers in their bank
CREATE POLICY "Bank viewers can view their farmers' charts"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN farmers f ON f.id = chart_templates.farmer_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'bank_viewer'
      AND p.bank_id = f.bank_id
  )
);
```

### Specialist Access:
```sql
-- Specialists can ONLY view charts for their assigned farmers
CREATE POLICY "Specialists can view assigned farmers' charts"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN farmer_specialists fs ON fs.farmer_id = chart_templates.farmer_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'specialist'
      AND fs.specialist_id = p.user_id
  )
);
```

---

## 🚀 Admin Workflow

### Creating Farmer-Specific Charts:

1. **Admin views farmer list** → Sees bank name on each card
2. **Click farmer card** → Opens farmer profile
3. **Click "Add Chart" button** → Navigates to `/admin/charts/new?farmerId=123`
4. **Build chart** (name, type, data, colors)
5. **Submit** → Chart is saved with `farmer_id=123`
6. **Return to profile** → Chart appears ONLY for this farmer

### Editing Farmer-Specific Charts:

1. **Admin in farmer profile** → Views charts
2. **Click three dots on chart** → "Edit Chart"
3. **Make changes** → Save
4. **Chart updates** → Only affects this farmer

---

## 📊 Data Flow

```
┌─────────────┐
│   Admin     │
└──────┬──────┘
       │
       │ Creates chart for Farmer A (ID: 123)
       ↓
┌──────────────────────────────┐
│   chart_templates table      │
├──────────────────────────────┤
│ id: abc-123                  │
│ name: "Crop Yield"           │
│ chart_type: "bar"            │
│ farmer_id: 123  ← ✅         │
│ chart_data: {...}            │
└──────────────────────────────┘
       │
       │ Farmer A views profile
       ↓
┌──────────────────────────────┐
│  ChartDisplay                │
│  (farmerId=123)              │
│                              │
│  Queries WHERE               │
│  farmer_id = 123             │
│                              │
│  Returns: 1 chart            │
└──────────────────────────────┘
       │
       │ Farmer B views profile
       ↓
┌──────────────────────────────┐
│  ChartDisplay                │
│  (farmerId=456)              │
│                              │
│  Queries WHERE               │
│  farmer_id = 456             │
│                              │
│  Returns: 0 charts           │
└──────────────────────────────┘
```

---

## 🎯 What Each User Sees

### **Admin:**
**On Dashboard:**
- ✅ Farmer cards with **bank names**
- ✅ Accurate **farmer-specific chart counts**
- ✅ Quick access to add/edit/delete

**On Farmer Profile:**
- ✅ "Add Chart" button (creates chart for THIS farmer)
- ✅ All charts for THIS farmer only
- ✅ "Edit Chart" option on each chart

### **Bank Viewer:**
**On Dashboard:**
- ✅ Farmer cards (no bank names shown)
- ✅ Accurate chart counts

**On Farmer Profile:**
- ✅ All charts for THIS farmer (if in their bank)
- ✅ Download/export options
- ❌ Cannot add or edit charts

### **Other Bank's Viewer:**
**If trying to access farmer from different bank:**
- ❌ Cannot see farmer
- ❌ Cannot see their charts
- ✅ RLS blocks access automatically

---

## 🧪 Testing Steps

### 1. **Apply Database Migration:**
```bash
cd /path/to/telagri-bank-dashboard
supabase db push --linked
```

### 2. **Test as Admin:**
```bash
npm run dev

# Login as admin
# 1. View dashboard - see bank names on cards
# 2. Click Farmer A card
# 3. Click "Add Chart" - create "Crop Yield" chart
# 4. Save and return
# 5. Verify chart appears only for Farmer A
# 6. Navigate to Farmer B profile
# 7. Verify "Crop Yield" chart does NOT appear
# 8. Create different chart for Farmer B
# 9. Verify each farmer has their own unique charts
```

### 3. **Test as Bank Viewer:**
```bash
# Login as bank viewer
# 1. View farmers in your bank
# 2. Open farmer profile
# 3. Verify you see only their specific charts
# 4. Try to access farmer from different bank (should fail)
```

### 4. **Test Chart Counts:**
```bash
# As admin:
# 1. Create 3 charts for Farmer A
# 2. Create 1 chart for Farmer B
# 3. View dashboard
# 4. Verify Farmer A card shows "3 Charts"
# 5. Verify Farmer B card shows "1 Chart"
```

---

## ✅ Migration Safety

**Idempotent:** Can be run multiple times safely
```sql
-- Uses IF NOT EXISTS, DROP IF EXISTS
ADD COLUMN IF NOT EXISTS farmer_id...
CREATE INDEX IF NOT EXISTS...
DROP POLICY IF EXISTS...
CREATE POLICY...
```

**Backward Compatible:**
- Existing charts without `farmer_id` will have `NULL`
- They won't display on any farmer profile (expected)
- Admin can edit them to assign a farmer
- Or they can be deleted (orphaned charts)

**No Data Loss:**
- `ON DELETE CASCADE` only affects charts when farmers are deleted
- Intentional: If farmer is deleted, their charts should be deleted too

---

## 🎉 Benefits

### **For Admins:**
- ✅ See bank assignments at a glance
- ✅ Manage charts per farmer individually
- ✅ No confusion about which chart belongs to whom
- ✅ Accurate chart counts per farmer

### **For Bank Viewers:**
- ✅ Only see relevant farmer data
- ✅ Charts are contextual to the farmer they're viewing
- ✅ No clutter from other farmers' charts

### **For System:**
- ✅ Better data organization
- ✅ Proper access control (RLS)
- ✅ Scalable for thousands of farmers
- ✅ Faster queries (indexed farmer_id)

---

## 🚨 Important Notes

### **Existing Charts:**
After migration, any existing charts will have `farmer_id = NULL`. You'll need to either:
1. **Assign them to farmers** (edit chart, select farmer)
2. **Delete orphaned charts** (no longer relevant)
3. **Leave as NULL** (won't display anywhere)

### **Creating New Charts:**
- **FROM FARMER PROFILE:** `farmer_id` is automatically set ✅
- **FROM CHARTS MANAGEMENT:** Admin must manually select farmer (future feature)

### **Deleting Farmers:**
- Farmer's charts are automatically deleted (`ON DELETE CASCADE`)
- This is intentional - charts are farmer-specific data

---

## 📚 Summary

**Files Changed:**
1. `supabase/migrations/20251112000002_add_farmer_id_to_charts.sql` - Database schema
2. `src/components/ChartDisplay.tsx` - Filter by farmer
3. `src/components/FarmerListView.tsx` - Show bank name, farmer-specific counts
4. `src/components/FarmerCard.tsx` - Display bank name
5. `src/pages/FarmerProfilePage.tsx` - Pass farmer ID to chart builder
6. `src/pages/ChartBuilderPage.tsx` - Save farmer ID with chart

**Status:** ✅ **Complete & Ready for Testing!**

**Next Steps:**
1. Apply database migration
2. Test chart creation/viewing per farmer
3. Verify bank names display correctly
4. Confirm RLS policies work as expected

---

**Created:** 2024-11-12
**Migration Required:** Yes - Run `supabase db push --linked`
**Breaking Changes:** Existing charts will need farmer assignment
**Security:** Enhanced with farmer-specific RLS policies

