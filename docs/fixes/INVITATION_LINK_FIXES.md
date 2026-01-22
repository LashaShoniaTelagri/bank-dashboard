# Invitation Link Issues and Fixes

## Issues Identified

### Issue 1: Links Expire After First Click
**Problem:** When a user clicks an invitation/password reset link for the first time, it works. But if they click the same link again (e.g., from their email), the system shows "link expired."

**Root Cause:** Supabase recovery links (`generateLink` with type `'recovery'`) are **single-use tokens** by design. Once the user clicks the link and authenticates, the token is consumed and cannot be reused.

**Why This Happens:**
1. User receives email with recovery link containing `access_token` and `refresh_token`
2. User clicks link -> Supabase validates tokens and creates a session
3. Tokens are marked as "used" in Supabase
4. If user clicks the same link again -> Tokens are already consumed -> "expired" error

### Issue 2: 24-Hour Expiration Too Short
**Problem:** Current invitation links expire after 24 hours, which is too short for users who may not check their email immediately or need time to complete setup.

**Current Configuration:** 
- Email templates show "24 hours" expiration
- Supabase default OTP/recovery token expiration is 24 hours

**Requirement:** Extend to 5 days (120 hours)

---

## Solutions

### Solution 1: Handle Single-Use Token Behavior

**Current Behavior (Correct):**
The single-use token behavior is a **security feature** and should NOT be disabled. This prevents token reuse attacks.

**User Experience Improvements:**
1. ✅ **Already Implemented:** We show a clear error message when link is expired (Auth.tsx)
2. ✅ **Email Instructions:** Update email templates to warn users that links are single-use
3. 📋 **TODO:** Add "Request New Link" functionality for expired invitations

**Email Template Updates Needed:**
- Clarify that links work only once
- If users close the browser before completing setup, they should contact admin for a new link
- Show expiration time prominently

### Solution 2: Extend Link Expiration to 5 Days

**Configuration Required:**

#### Option A: Supabase Dashboard (Recommended for Production)
1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to: **Authentication** -> **Settings** -> **Auth**
4. Find: **"Magic Link Expiry"** or **"OTP Expiry"**
5. Change from `3600` (1 hour) or `86400` (24 hours) to `432000` (5 days = 120 hours)
6. Click **Save**

**Note:** Supabase may have different fields:
- `GOTRUE_MAILER_OTP_EXP` - OTP expiration time
- `GOTRUE_MAX_RECOVERY_TOKEN_TTL` - Maximum recovery token time-to-live

#### Option B: Environment Variables (If Supported)
```bash
# In your Supabase project environment
GOTRUE_MAILER_OTP_EXP=432000  # 5 days in seconds
```

#### Option C: Self-Hosted Supabase
If self-hosting, add to your docker-compose or Kubernetes config:
```yaml
GOTRUE_MAILER_OTP_EXP: "432000"
GOTRUE_MAX_RECOVERY_TOKEN_TTL: "432000"
```

---

## Implementation Steps

### Step 1: Update Email Templates ✅
Update both invitation Edge Functions to show 5-day expiration:
- `supabase/functions/invite-bank-viewer/index.ts`
- `supabase/functions/invite-user/index.ts`

**Changes:**
- Line 69 (invite-bank-viewer): `"This invitation link expires in 24 hours"` -> `"This invitation link expires in 5 days"`
- Line 102 (invite-bank-viewer text): `"This link expires in 24 hours."` -> `"This link expires in 5 days."`
- Line 111 (invite-user): Same changes
- Line 141 (invite-user text): Same changes

### Step 2: Configure Supabase Auth Settings
**Action Required:** Update Supabase Dashboard settings (cannot be done via code)

**Steps:**
1. Login to Supabase Dashboard
2. Select Dev Project: `jhelkawgkjohvzsusrnw`
3. Go to Authentication -> Settings
4. Update OTP/Recovery Token expiration to 432000 seconds (5 days)
5. Repeat for Prod Project: `imncjxfppzikerifyukk`

### Step 3: Add User-Friendly Warnings to Emails ✅
Enhance warning sections in email templates to clarify single-use behavior.

### Step 4: Test the Changes
1. Send invitation to test email
2. Verify email shows "5 days" expiration
3. Click link -> Should work
4. Wait 10 minutes and click again -> Should show proper expired message (expected behavior)
5. Verify link actually expires after 5 days (may need to adjust system time for testing)

---

## Additional Recommendations

### 1. Add "Resend Invitation" Feature
Allow admins to resend invitations from the Recent Invitations table:
```typescript
// Button in InvitationsManagement.tsx
<Button onClick={() => resendInvitation(invitation.user_id)}>
  <Mail className="h-4 w-4 mr-2" />
  Resend Invitation
</Button>
```

### 2. Track Link Usage
Add to profiles table:
```sql
ALTER TABLE profiles ADD COLUMN invitation_clicked_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN invitation_clicks_count INTEGER DEFAULT 0;
```

### 3. Show Link Status to Users
When users visit expired link, show:
- When the link was sent
- When it expired
- Contact information for admin to request new link

---

## Security Considerations

### ✅ DO:
- Keep single-use tokens (security best practice)
- Use 5-day expiration (balance between security and UX)
- Log all invitation activities
- Rate limit invitation requests

### ❌ DON'T:
- Don't make tokens reusable (security risk)
- Don't extend expiration beyond 7 days (security concern)
- Don't remove email verification
- Don't skip 2FA for admins

---

## Testing Checklist

- [ ] Email template shows "5 days" expiration
- [ ] Supabase auth configured for 5-day tokens (dev)
- [ ] Supabase auth configured for 5-day tokens (prod)
- [ ] First click on link works correctly
- [ ] Second click shows proper error message
- [ ] Error message is user-friendly and actionable
- [ ] Links actually expire after 5 days
- [ ] Admin can resend invitations
- [ ] All invitation types work (admin, bank_viewer, specialist)

---

## Files Modified

1. `/supabase/functions/invite-bank-viewer/index.ts` - Update email template expiration text
2. `/supabase/functions/invite-user/index.ts` - Update email template expiration text
3. `/src/pages/Auth.tsx` - Already has proper error handling ✅
4. `/docs/fixes/INVITATION_LINK_FIXES.md` - This documentation file

---

## Deployment Notes

### Dev Environment
```bash
# After updating Edge Functions
cd supabase
supabase functions deploy invite-bank-viewer --project-ref jhelkawgkjohvzsusrnw
supabase functions deploy invite-user --project-ref jhelkawgkjohvzsusrnw
```

### Prod Environment
```bash
# Deploy to production
supabase functions deploy invite-bank-viewer --project-ref imncjxfppzikerifyukk
supabase functions deploy invite-user --project-ref imncjxfppzikerifyukk
```

### Supabase Dashboard Configuration
**IMPORTANT:** After code changes, manually configure in Supabase Dashboard:
1. Dev project auth settings
2. Prod project auth settings
3. Set OTP expiration to 432000 seconds

---

## Support and Troubleshooting

### If links still expire after 24 hours:
1. Verify Supabase Dashboard settings were saved
2. Check project environment variables
3. Clear Supabase cache (restart edge functions)
4. Test with fresh invitation

### If users report issues:
1. Check Supabase logs in Dashboard -> Edge Functions
2. Verify SendGrid delivery (Dashboard -> Email Logs)
3. Check invitation status in profiles table
4. Manually update invitation_status if needed

---

Last Updated: January 22, 2026
Status: Implementation Ready
Priority: High - User Experience Critical
