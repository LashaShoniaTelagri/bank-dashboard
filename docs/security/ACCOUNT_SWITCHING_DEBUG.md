# Account Switching - Debugging Guide

Quick guide to debug and verify the account switching feature is working correctly.

## 🧪 Step-by-Step Testing

### 1. **Check Browser Console Logs**

After refreshing the page, you should see:
```
🔍 Checking impersonation session: Found / Not found
✅ Impersonation active: user@example.com
  OR
ℹ️ No active impersonation
```

### 2. **Check localStorage**

Open browser DevTools (F12) → Application → Local Storage → http://localhost:3000

Look for key: `impersonation_session`

**Should contain:**
```json
{
  "sessionId": "uuid-here",
  "targetUserId": "uuid-here",
  "targetEmail": "specialist@example.com",
  "targetRole": "specialist",
  "targetProfile": {...},
  "adminUserId": "your-admin-uuid",
  "adminEmail": "admin@example.com",
  "startedAt": "2025-01-20T...",
  "reason": "Admin support"
}
```

### 3. **Verify Banner Shows**

**Expected:**
- Orange/amber banner at **very top** of screen
- Shows: "Admin Mode: Viewing as [email]"
- Has "Exit" button on the right
- Content pushed down 70px

**If not showing:**
- Check console for errors
- Verify localStorage has session
- Check if z-index conflicts with other elements

### 4. **Verify Profile Switch**

Open DevTools → Console, type:
```javascript
JSON.parse(localStorage.getItem('impersonation_session'))
```

Then check which profile is being used:
- Open React DevTools
- Find `useAuth` hook
- Check `profile.role` - should be `specialist` not `admin`

### 5. **Verify Redirect**

When switching to specialist:
- URL should change to `/specialist/dashboard`
- You should NOT see admin menu items
- Should see specialist-specific UI

### 6. **Test Exit**

Click "Exit" button in orange banner:
- Banner disappears
- Page reloads
- Redirects to `/admin/dashboard`
- You're back to admin view

## 🐛 Common Issues & Fixes

### Issue 1: No Banner Shows

**Symptoms:**
- Switch happens but no orange banner
- Can't exit back to admin

**Debug:**
```javascript
// In browser console
console.log('Session:', localStorage.getItem('impersonation_session'));
console.log('Is impersonating:', !!localStorage.getItem('impersonation_session'));
```

**Fix:**
1. Check if session is stored in localStorage
2. Refresh page to ensure useImpersonation hook loads
3. Check browser console for React errors

### Issue 2: White Screen After Switch

**Symptoms:**
- Click "Switch Account"
- Page reloads
- White screen, nothing renders

**Debug:**
```javascript
// Check if profile query is failing
// Look in Network tab for failed API calls
// Check for RLS policy errors
```

**Fix:**
1. Ensure SQL migration `20251011000000_allow_admin_read_all_profiles.sql` is applied
2. Verify `is_admin()` function exists
3. Check RLS policies on `profiles` table

### Issue 3: Still See Admin Features

**Symptoms:**
- Orange banner shows
- But still see admin dashboard/menu

**Debug:**
```javascript
// In React DevTools, check useAuth hook
// profile.role should be 'specialist', not 'admin'
```

**Fix:**
1. Check `useAuth` hook is checking impersonation
2. Verify `effectiveUserId` logic in useAuth
3. Clear React Query cache and reload

### Issue 4: Can't See Specialist Data

**Symptoms:**
- Redirected to specialist dashboard
- But no farmers, no tasks shown
- Empty lists

**Possible Reasons:**
1. **Specialist has no data** - They might not have any farmers assigned
2. **RLS blocking data** - Check RLS policies for specialists
3. **bank_id mismatch** - Specialist profile might not have correct bank_id

**Debug:**
```sql
-- Check specialist's profile
SELECT * FROM profiles WHERE user_id = 'specialist-uuid-here';

-- Check if specialist has any farmers
SELECT f.* 
FROM farmers f
INNER JOIN profiles p ON f.bank_id = p.bank_id
WHERE p.user_id = 'specialist-uuid-here';
```

**Fix:**
1. **Assign data to specialist:**
   ```sql
   -- Ensure specialist has bank_id
   UPDATE profiles 
   SET bank_id = 'bank-uuid-here'
   WHERE user_id = 'specialist-uuid-here';
   ```

2. **Check RLS policies allow specialists to read their data:**
   ```sql
   -- Should have policy like:
   CREATE POLICY "specialists_read_own_bank_farmers"
   ON farmers FOR SELECT
   TO authenticated
   USING (
     bank_id IN (
       SELECT bank_id FROM profiles 
       WHERE user_id = auth.uid()
     )
   );
   ```

### Issue 5: Infinite Recursion Error

**Symptoms:**
```
Error: infinite recursion detected in policy for relation "profiles"
```

**Fix:**
- Ensure using the `is_admin()` SECURITY DEFINER function
- Don't query `profiles` directly in RLS policy
- Apply migration `20251011000000_allow_admin_read_all_profiles.sql`

## 🔍 Manual Testing Checklist

- [ ] SQL migrations applied (check migrations 20251008, 20251009, 20251010, 20251011)
- [ ] Edge Function deployed (`impersonate-user`)
- [ ] localStorage session stored after switch
- [ ] Orange banner appears at top
- [ ] Exit button visible in banner
- [ ] Profile switches from admin to target user
- [ ] Automatic redirect to correct dashboard
- [ ] Can exit back to admin successfully
- [ ] Specialist can see their assigned data
- [ ] Admin can see all user data again after exit

## 📊 SQL Queries for Verification

### Check Active Sessions
```sql
SELECT 
  admin_email,
  target_email,
  target_role,
  started_at,
  is_active,
  reason
FROM admin_impersonation_sessions
WHERE is_active = TRUE
ORDER BY started_at DESC;
```

### Check if Admin Can Read All Profiles
```sql
-- As admin user, should return TRUE
SELECT is_admin();

-- Should return all profiles (not just admin's own)
SELECT user_id, role FROM profiles;
```

### Verify Specialist Has Data
```sql
SELECT 
  p.user_id,
  p.role,
  p.bank_id,
  b.name as bank_name,
  COUNT(f.id) as farmer_count
FROM profiles p
LEFT JOIN banks b ON p.bank_id = b.id
LEFT JOIN farmers f ON f.bank_id = p.bank_id
WHERE p.role = 'specialist'
GROUP BY p.user_id, p.role, p.bank_id, b.name;
```

## 🎯 Success Criteria

✅ All features working when:
1. Banner shows immediately after switch
2. Profile is impersonated user's profile
3. Can navigate specialist dashboard
4. Can see specialist's assigned farmers/tasks
5. Exit button returns to admin
6. Full audit log captured in database

---

**Need Help?**
- Check browser console for logs starting with 🔍, ✅, or ❌
- Verify all SQL migrations applied
- Ensure Edge Function deployed
- Check localStorage for session data













