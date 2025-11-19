# User Account Switching System

Banking-grade user account switching system for TelAgri administrators to securely view the system as other users see it. This feature enables efficient support and debugging while maintaining complete audit trails for regulatory compliance.

## 🎯 Overview

The Account Switching system allows administrators to:
- View the platform exactly as any user (bank_viewer, specialist) would see it
- Debug user-specific issues in real-time
- Provide hands-on support without asking for passwords
- Maintain complete audit logs for banking compliance

## 🏗️ Architecture

### Frontend Components

#### 1. **UserImpersonationModal** (`src/components/UserImpersonationModal.tsx`)
- User selection interface with search functionality
- Displays users with email, role, and bank information
- Reason input for audit compliance
- Security warnings and disclaimers

#### 2. **ImpersonationBanner** (`src/components/ImpersonationBanner.tsx`)
- Prominent orange warning banner at top of screen
- Shows target user's email, role, and session duration
- "Exit" button to end session
- Always visible during account switching

#### 3. **useImpersonation Hook** (`src/hooks/useImpersonation.ts`)
- Manages impersonation state and lifecycle
- Calls Edge Function for session management
- Stores session data in localStorage
- Auto-reloads page to apply new user context

#### 4. **useAuth Hook** (`src/hooks/useAuth.ts`)
- **Impersonation-Aware**: Checks for active impersonation on mount
- Returns impersonated user's profile instead of admin's when switching
- Automatically triggers role-based redirects
- Clears impersonation on sign out

### Backend Components

#### 1. **Database Tables**

**`admin_impersonation_sessions`**
```sql
- id (UUID, primary key)
- admin_user_id (UUID, references auth.users)
- admin_email (TEXT)
- admin_role (TEXT)
- target_user_id (UUID, references auth.users)
- target_email (TEXT)
- target_role (TEXT)
- started_at (TIMESTAMPTZ)
- ended_at (TIMESTAMPTZ, nullable)
- duration_seconds (INTEGER)
- reason (TEXT)
- ip_address (INET)
- user_agent (TEXT)
- is_active (BOOLEAN)
```

**`admin_impersonation_actions`**
```sql
- id (UUID, primary key)
- session_id (UUID, references admin_impersonation_sessions)
- action_type (TEXT) - e.g., 'PAGE_VIEW', 'DATA_ACCESS', 'FORM_SUBMIT'
- action_description (TEXT)
- page_url (TEXT)
- api_endpoint (TEXT, nullable)
- request_data (JSONB, nullable)
- response_status (INTEGER, nullable)
- duration_ms (INTEGER, nullable)
- performed_at (TIMESTAMPTZ)
```

#### 2. **PostgreSQL Functions**

**`get_users_for_impersonation()`**
- Returns list of users (excluding admins) with emails from auth.users
- Security check: Only callable by administrators
- Joins profiles with auth.users to get email addresses

**`start_user_impersonation(admin_user_id, target_user_id, reason, ip_address, user_agent)`**
- Validates admin permissions
- Prevents self-impersonation and admin-to-admin switching
- Ends any existing active sessions
- Creates new session record with full audit details
- Returns session ID

**`end_user_impersonation(admin_user_id, session_id)`**
- Marks session as inactive
- Calculates and stores session duration
- Logs end timestamp

**`log_impersonation_action(session_id, action_type, details...)`**
- Records specific actions taken during impersonation
- Stores page URLs, API calls, and user interactions

#### 3. **Edge Function** (`supabase/functions/impersonate-user/index.ts`)

Secure proxy for impersonation operations:

**Actions:**
- `start`: Initiates impersonation session
- `end`: Terminates impersonation session
- `logAction`: Records action during session
- `getActive`: Checks for active impersonation

**Security Features:**
- Validates JWT token with user's session
- Verifies admin role before any operation
- Extracts client IP from proxy chain (x-forwarded-for)
- Uses service role only for database operations
- Passes admin_user_id explicitly to PostgreSQL functions

## 🔄 User Flow

### Starting Account Switch

1. **Admin clicks "Switch Account"** button in header
2. **Modal opens** showing list of non-admin users
3. **Admin selects target user** and optionally enters reason
4. **Frontend calls Edge Function** with `action: 'start'`
5. **Edge Function validates** admin role and calls PostgreSQL function
6. **Session created** in database with full audit details
7. **Session stored** in localStorage for persistence
8. **Page reloads** (`window.location.reload()`)
9. **useAuth detects** impersonation from localStorage
10. **Fetches target user's profile** instead of admin's
11. **AdminDashboard redirects** based on target user's role:
    - `specialist` → `/specialist/dashboard`
    - `bank_viewer` → `/bank`
12. **ImpersonationBanner appears** at top of screen
13. **User sees system** exactly as target user would

### During Account Switch

- **All components** receive impersonated user's profile from `useAuth`
- **Permissions** are automatically filtered to target user's level
- **Data access** is limited to what target user can see (via RLS)
- **Page views** are automatically logged
- **Banner remains visible** as constant reminder

### Ending Account Switch

1. **Admin clicks "Exit"** in orange banner
2. **Frontend calls Edge Function** with `action: 'end'`
3. **Session marked inactive** in database
4. **Duration calculated** and stored
5. **localStorage cleared**
6. **Page reloads**
7. **Admin's original session** and permissions restored
8. **Redirects** back to admin dashboard

## 🔒 Security Features

### Authentication & Authorization
- ✅ Only administrators can access switch functionality
- ✅ JWT token validation on every Edge Function call
- ✅ Cannot switch to other administrators
- ✅ Cannot switch to self
- ✅ Session validation on all operations

### Audit Trail (Banking Compliance)
- ✅ Every session logged with:
  - Admin identity (user_id, email, role)
  - Target user identity
  - Start time, end time, duration
  - Reason for switching
  - IP address (client, not proxy)
  - User agent (browser/device info)
- ✅ All actions during session logged with:
  - Action type (page view, form submit, etc.)
  - Page URL and API endpoints accessed
  - Request/response data
  - Timestamps

### Visual Indicators
- ✅ Prominent orange banner (can't be missed)
- ✅ Shows target user's email and role
- ✅ Displays session duration
- ✅ Always visible across all pages
- ✅ Warning in modal before starting

### Data Protection
- ✅ No password access required
- ✅ Admin's real session remains active
- ✅ Automatic session timeout (via localStorage expiration)
- ✅ Session cleared on browser close
- ✅ Proper RLS policies apply to impersonated user

## 📋 Database Migrations

1. **20251008000000_add_user_impersonation_system.sql**
   - Creates tables and initial functions
   - Sets up RLS policies
   - Creates indexes for performance

2. **20251009000000_add_get_users_for_impersonation_function.sql**
   - Adds function to fetch users for modal
   - Properly joins with auth.users for emails

3. **20251010000000_fix_impersonation_auth.sql**
   - Updates functions to accept admin_user_id parameter
   - Fixes authentication for service role calls
   - Removes audit_log dependencies

## 🎨 UI/UX Considerations

### Terminology
- Uses **"Switch Account"** instead of "Impersonate"
- Familiar terminology from team's previous experience
- Reduces cognitive load for administrators

### Visual Design
- **Orange banner**: High contrast, impossible to miss
- **Blue button**: Distinct from green admin actions
- **Security warnings**: Prominent and clear
- **Role badges**: Color-coded for quick identification

### User Experience
- **Instant feedback**: Loading states during transition
- **Clear context**: Always know who you're viewing as
- **One-click exit**: Easy to return to admin view
- **Search functionality**: Quick user lookup in modal

## 🔧 Configuration

### Environment Variables
```bash
# Edge Function automatically uses:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

### Feature Flags
No feature flags required - available to all administrators automatically based on role.

## 📊 Monitoring & Analytics

### Key Metrics to Track
1. **Session Duration**: Average time spent in switched sessions
2. **Most Switched Users**: Identify users needing frequent support
3. **Switch Reasons**: Categorize support vs. testing vs. debugging
4. **Actions Per Session**: Understanding admin activity during switches
5. **IP Patterns**: Detect unusual access patterns

### Query Examples

**Recent Switches:**
```sql
SELECT 
  admin_email,
  target_email,
  target_role,
  reason,
  started_at,
  duration_seconds
FROM admin_impersonation_sessions
ORDER BY started_at DESC
LIMIT 50;
```

**Switch Statistics:**
```sql
SELECT 
  admin_email,
  COUNT(*) as total_sessions,
  AVG(duration_seconds) as avg_duration,
  MAX(started_at) as last_session
FROM admin_impersonation_sessions
GROUP BY admin_email
ORDER BY total_sessions DESC;
```

**Actions During Sessions:**
```sql
SELECT 
  s.admin_email,
  s.target_email,
  a.action_type,
  COUNT(*) as action_count
FROM admin_impersonation_actions a
JOIN admin_impersonation_sessions s ON a.session_id = s.id
GROUP BY s.admin_email, s.target_email, a.action_type
ORDER BY action_count DESC;
```

## 🚨 Troubleshooting

### Common Issues

**Issue: "Not authenticated" error**
- Ensure SQL migration `20251010000000_fix_impersonation_auth.sql` is applied
- Verify Edge Function is deployed with latest code
- Check JWT token is valid

**Issue: IP address parsing error**
- Fixed in latest Edge Function - extracts first IP from proxy chain
- Redeploy Edge Function if seeing `invalid input syntax for type inet`

**Issue: Still seeing admin view after switch**
- Check browser console for impersonation session in localStorage
- Verify `useAuth` hook is returning impersonated profile
- Check AdminDashboard redirect logic is executing

**Issue: Can't find users in modal**
- Apply migration `20251009000000_add_get_users_for_impersonation_function.sql`
- Verify function has proper permissions (GRANT EXECUTE)
- Check admin role in database

## 🔄 Future Enhancements

### Potential Improvements
1. **Session Timeout**: Auto-end sessions after X minutes of inactivity
2. **Multi-Factor Confirmation**: Require 2FA before high-privilege switches
3. **Screenshot Prevention**: Disable screenshots during sessions (browser limitation)
4. **Live Monitoring**: Real-time dashboard of active switches
5. **Smart Suggestions**: ML-based user recommendations based on support tickets
6. **Session Recording**: Video/screen recording of switched sessions (compliance)

### Integration Opportunities
1. **Support Ticket System**: Auto-link sessions to support tickets
2. **Slack Notifications**: Alert team when admin switches accounts
3. **Compliance Reports**: Automated monthly audit reports
4. **Role-Based Limits**: Different admins have different switch permissions

## 📚 References

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Banking Compliance Standards](https://www.bis.org/bcbs/)

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready











