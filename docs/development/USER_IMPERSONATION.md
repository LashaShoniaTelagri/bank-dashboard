# User Impersonation System
## Admin Support & Testing Feature

**Feature Status**: ✅ Ready for Implementation  
**Security Level**: Banking-Grade with Full Audit Trail  
**Compliance**: F-100 Reporting Compatible  

---

## 🎯 Overview

The User Impersonation system allows administrators to view the TelAgri platform exactly as another user would see it. This is essential for:

- **Customer Support**: Help users troubleshoot issues by seeing what they see
- **Testing**: Verify that permissions and RLS policies work correctly
- **Quality Assurance**: Experience the platform from different user perspectives
- **Debugging**: Reproduce and fix user-reported issues

**Key Security Features**:
- ✅ Full audit trail (all actions logged)
- ✅ Banking-grade compliance (F-100 compatible)
- ✅ Admin-only access (requires admin role)
- ✅ Cannot impersonate other admins
- ✅ Prominent visual indicator (orange banner)
- ✅ One-click exit (return to admin account)
- ✅ Session tracking (duration, reason, actions)

---

## 🏗️ Architecture

### **Database Layer**

**Tables**:
1. `admin_impersonation_sessions` - Tracks who impersonated whom and when
2. `admin_impersonation_actions` - Logs every action during impersonation
3. Integrated with existing `audit_log` table

**Functions**:
- `start_user_impersonation()` - Initiates impersonation session
- `end_user_impersonation()` - Ends active session
- `log_impersonation_action()` - Records actions
- `get_active_impersonation()` - Retrieves current session
- `get_impersonation_history()` - Admin dashboard reporting

### **Edge Function**

**Location**: `supabase/functions/impersonate-user/index.ts`

**Endpoints**:
```typescript
POST /impersonate-user
{
  "action": "start",
  "targetUserId": "uuid",
  "reason": "Support ticket #123"
}

POST /impersonate-user
{
  "action": "end",
  "sessionId": "uuid"
}

POST /impersonate-user
{
  "action": "logAction",
  "sessionId": "uuid",
  "actionType": "PAGE_VIEW",
  "actionDescription": "Viewed farmer profile"
}
```

### **Frontend Components**

1. **`useImpersonation` Hook** - React hook for state management
2. **`ImpersonationBanner`** - Prominent visual indicator
3. **`UserImpersonationModal`** - User selection interface

---

## 📋 Installation

### **Step 1: Database Migration**

```bash
# Apply the migration
cd /Users/lasha/Desktop/TelAgri/tech/gitlab/new-system/telagri-bank-dashboard
supabase db push

# Or apply specific migration
psql -h db.{project-ref}.supabase.co -U postgres -d postgres -f supabase/migrations/20251008000000_add_user_impersonation_system.sql
```

**Verify tables created**:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'admin_impersonation%';

-- Expected output:
-- admin_impersonation_sessions
-- admin_impersonation_actions
```

### **Step 2: Deploy Edge Function**

```bash
# Deploy the impersonation function
supabase functions deploy impersonate-user

# Verify deployment
supabase functions list

# Test endpoint
curl -X POST https://api.telagri.com/functions/v1/impersonate-user \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "getActive"}'
```

### **Step 3: Install date-fns (Required)**

```bash
# Install date-fns for date formatting
npm install date-fns
```

### **Step 4: Integrate Components**

Add the impersonation banner to your main layout:

**File**: `src/App.tsx` or main layout component

```typescript
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { useAuth } from '@/hooks/useAuth';

function App() {
  const { profile } = useAuth();
  const isAdmin = profile && ['admin', 'system_admin', 'Administrator', 'System Administrator'].includes(profile.role);

  return (
    <>
      {/* Impersonation Banner - Shows when admin is impersonating */}
      {isAdmin && <ImpersonationBanner />}
      
      {/* Adjust main content to account for banner height */}
      <div className="pt-16"> {/* Add padding-top when banner is visible */}
        {/* Your existing app content */}
      </div>
    </>
  );
}
```

### **Step 5: Add Admin Controls**

Add impersonation button to admin panel:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserImpersonationModal } from '@/components/UserImpersonationModal';
import { Eye } from 'lucide-react';

function AdminPanel() {
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);

  return (
    <div>
      <Button 
        onClick={() => setImpersonateModalOpen(true)}
        variant="outline"
      >
        <Eye className="h-4 w-4 mr-2" />
        Impersonate User
      </Button>

      <UserImpersonationModal
        open={impersonateModalOpen}
        onOpenChange={setImpersonateModalOpen}
      />
    </div>
  );
}
```

---

## 🎮 Usage

### **For Administrators**

#### **Starting Impersonation**

1. **Open Admin Panel**
   - Navigate to your admin dashboard
   - Look for "Impersonate User" button

2. **Select Target User**
   - Click "Impersonate User" button
   - Search for user by email, name, or role
   - Click on user to select them

3. **Provide Reason** (Optional but Recommended)
   - Enter reason for impersonation
   - Examples: "Support ticket #123", "Testing permissions", "Helping with F-100 issue"
   - This is logged for compliance

4. **Start Session**
   - Click "Start Impersonation"
   - Page will reload with orange banner
   - You now see exactly what the user sees

#### **During Impersonation**

**Visual Indicator**:
- Orange banner at top of screen
- Shows: target user email, role, duration
- Prominent "Exit" button

**What You Can Do**:
- ✅ View all pages the user can access
- ✅ See data filtered by RLS policies
- ✅ Test user workflows
- ✅ Reproduce reported issues
- ✅ Take screenshots for documentation

**What You Cannot Do**:
- ❌ Delete critical data (use read-only mode)
- ❌ Impersonate other admins
- ❌ Hide the impersonation banner
- ❌ Avoid audit logging

**All Actions Are Logged**:
- Page views
- Button clicks
- Form submissions
- API calls
- Duration of session

#### **Ending Impersonation**

1. **Click "Exit" Button** on orange banner
2. Page reloads
3. You're back in your admin account
4. Session duration and actions are saved

---

## 🔐 Security & Compliance

### **Security Policies**

1. **Admin-Only Access**
   - Only users with `admin`, `system_admin`, `Administrator`, or `System Administrator` roles
   - Enforced at database level (RLS)

2. **Cannot Impersonate Admins**
   - Security policy prevents admin-to-admin impersonation
   - Reduces risk of privilege escalation

3. **Session Management**
   - Only one active impersonation per admin
   - Previous sessions auto-ended when starting new one
   - Sessions expire on logout

4. **IP Address Tracking**
   - All sessions log IP address
   - Helps detect unauthorized access

### **Audit Trail**

**What's Logged**:

**Session Level** (`admin_impersonation_sessions`):
- Admin user ID and email
- Target user ID and email
- Start time, end time, duration
- Reason for impersonation
- IP address and user agent

**Action Level** (`admin_impersonation_actions`):
- Session ID (links to session)
- Action type (page view, API call, etc.)
- Page URL or API endpoint
- Request/response data (sanitized)
- Timestamp and duration

**General Audit** (`audit_log`):
- `IMPERSONATION_STARTED` event
- `IMPERSONATION_ENDED` event
- Links to admin and target users

### **Compliance Queries**

**View All Impersonation Sessions (Last 30 Days)**:
```sql
SELECT 
  admin_email,
  target_email,
  target_role,
  started_at,
  ended_at,
  duration_seconds,
  reason,
  ip_address
FROM admin_impersonation_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
ORDER BY started_at DESC;
```

**View Actions During Specific Session**:
```sql
SELECT 
  action_type,
  action_description,
  page_url,
  performed_at
FROM admin_impersonation_actions
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY performed_at ASC;
```

**Find Who Accessed Specific User's Account**:
```sql
SELECT 
  admin_email,
  started_at,
  ended_at,
  reason,
  COUNT(aia.id) as action_count
FROM admin_impersonation_sessions ais
LEFT JOIN admin_impersonation_actions aia ON aia.session_id = ais.id
WHERE target_user_id = 'TARGET_USER_ID'
GROUP BY ais.id
ORDER BY started_at DESC;
```

**Longest Impersonation Sessions** (potential abuse):
```sql
SELECT 
  admin_email,
  target_email,
  duration_seconds,
  reason,
  started_at
FROM admin_impersonation_sessions
WHERE duration_seconds IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 20;
```

---

## 📊 Reporting & Analytics

### **Admin Dashboard Metrics**

```typescript
// Get impersonation statistics
const { data, error } = await supabase.rpc('get_impersonation_history', {
  p_limit: 100,
  p_offset: 0
});

// Example metrics:
// - Total sessions this month
// - Average session duration
// - Most impersonated users
// - Most active admins
// - Common reasons for impersonation
```

### **Example Dashboard Queries**

**Monthly Impersonation Report**:
```sql
SELECT 
  DATE_TRUNC('month', started_at) as month,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT admin_user_id) as unique_admins,
  COUNT(DISTINCT target_user_id) as unique_targets,
  AVG(duration_seconds) as avg_duration_seconds
FROM admin_impersonation_sessions
WHERE started_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', started_at)
ORDER BY month DESC;
```

**Top Impersonated User Roles**:
```sql
SELECT 
  target_role,
  COUNT(*) as session_count,
  AVG(duration_seconds) as avg_duration
FROM admin_impersonation_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY target_role
ORDER BY session_count DESC;
```

---

## 🐛 Troubleshooting

### **Issue: Impersonation Button Not Showing**

**Symptom**: Admin cannot see "Impersonate User" button

**Solutions**:
1. Verify admin role in database:
   ```sql
   SELECT email, role FROM profiles WHERE email = 'admin@telagri.com';
   ```
2. Check role is exactly: `admin`, `system_admin`, `Administrator`, or `System Administrator`
3. Clear browser cache and reload

### **Issue: "Unauthorized" Error When Starting**

**Symptom**: Error message when trying to start impersonation

**Solutions**:
1. Verify Edge Function is deployed:
   ```bash
   supabase functions list
   ```
2. Check function logs:
   ```bash
   supabase functions logs impersonate-user --follow
   ```
3. Verify admin profile exists and role is correct

### **Issue: Orange Banner Not Showing**

**Symptom**: Impersonation started but no visual indicator

**Solutions**:
1. Verify `ImpersonationBanner` is in your main layout
2. Check if `isAdmin` condition is correct
3. Check browser console for errors
4. Verify `date-fns` is installed

### **Issue: Cannot Exit Impersonation**

**Symptom**: "Exit" button not working

**Solutions**:
1. Clear localStorage:
   ```javascript
   localStorage.removeItem('impersonation_session');
   ```
2. Reload page manually
3. Check browser console for errors
4. Verify Edge Function is responding

### **Issue: Users Can See Other Users' Data**

**Symptom**: RLS policies not working during impersonation

**Solutions**:
1. This is a **critical security issue**
2. Verify RLS policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'farmers';
   ```
3. Check if policies use `auth.uid()` correctly
4. **Disable impersonation** until fixed

---

## ⚠️ Best Practices

### **Do's ✅**

1. **Always Provide a Reason**
   - Helps with compliance audits
   - Makes logs more useful
   - Shows professionalism

2. **Keep Sessions Short**
   - Exit as soon as you're done
   - Don't leave sessions open
   - Maximum recommended: 30 minutes

3. **Document Actions**
   - Take screenshots if needed
   - Note any issues found
   - Update support tickets

4. **Be Mindful of Privacy**
   - Only access what you need
   - Don't share user data unnecessarily
   - Follow data protection policies

5. **Test in Development First**
   - Try impersonation on dev before prod
   - Verify functionality works
   - Check audit logs are created

### **Don'ts ❌**

1. **Never Impersonate Without Reason**
   - Always have legitimate business purpose
   - Document the reason

2. **Don't Modify Critical Data**
   - Use impersonation for viewing, not editing
   - If changes needed, use admin panel instead

3. **Don't Share Impersonation Access**
   - Each admin uses their own account
   - No shared admin credentials

4. **Don't Impersonate for Long Periods**
   - Exit promptly after finishing
   - Don't forget you're impersonating

5. **Don't Hide That You're Impersonating**
   - Orange banner must always be visible
   - Be transparent about admin access

---

## 📈 Future Enhancements

### **Planned Features**

1. **Read-Only Mode**
   - Option to prevent any modifications
   - Even safer for compliance

2. **Session Recording**
   - Screen recording during impersonation
   - Helpful for training and audits

3. **Approval Workflow**
   - Require approval from another admin
   - For extra-sensitive users (bank partners)

4. **Time Limits**
   - Auto-end sessions after 30 minutes
   - Prevents forgotten sessions

5. **Notification to User**
   - Optional email to user after impersonation
   - Transparency and trust

6. **Advanced Analytics**
   - Heatmaps of admin activity
   - Pattern detection for unusual behavior

---

## 🔗 Related Documentation

- [Security Setup](../security/setup.md) - General security configuration
- [Audit Logging](../security/audit-logging.md) - Complete audit trail system
- [Admin Panel](./admin-panel.md) - Admin dashboard documentation
- [RLS Policies](../deployment/rls-policies.md) - Row Level Security

---

## 📞 Support

**If You Encounter Issues**:
1. Check troubleshooting section above
2. Review Edge Function logs
3. Check database audit logs
4. Contact CTO for security-related concerns

**For Feature Requests**:
- Create GitHub issue with label `feature/impersonation`
- Discuss in team meetings

---

**Feature Version**: 1.0  
**Last Updated**: October 2025  
**Maintained By**: CTO Office  
**Security Level**: Banking-Grade ✅

