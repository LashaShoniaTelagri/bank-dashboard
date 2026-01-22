# Supabase Authentication Configuration Guide

## Configure 5-Day Link Expiration

This guide explains how to configure Supabase to use 5-day expiration for invitation/password reset links instead of the default 24 hours.

---

## Option 1: Supabase Dashboard (Recommended)

### Step-by-Step Instructions:

#### 1. Access Supabase Dashboard
- Go to: https://app.supabase.com
- Login with your credentials

#### 2. Select Your Project
**Dev Environment:**
- Project ID: `jhelkawgkjohvzsusrnw`
- Project Name: telagri-bank-dashboard-dev

**Production Environment:**
- Project ID: `imncjxfppzikerifyukk`
- Project Name: telagri-bank-dashboard-prod

#### 3. Navigate to Auth Settings
1. Click on **"Authentication"** in the left sidebar
2. Click on **"Settings"** tab
3. Look for **"Email Settings"** or **"Auth Settings"** section

#### 4. Update OTP/Recovery Token Expiration

**Look for one of these fields:**
- "Magic Link Expiry"
- "OTP Expiry" 
- "Recovery Token TTL"
- "Email Link Expiration"

**Current Value:** `86400` (24 hours in seconds)
**New Value:** `432000` (5 days = 120 hours in seconds)

#### 5. Save Changes
- Click **"Save"** button
- Wait for confirmation message
- Changes apply immediately (no restart needed)

#### 6. Verify Configuration
Test by sending an invitation and checking:
- Email shows "5 days" expiration
- Link actually works for 5 days
- Link expires properly after 5 days

---

## Option 2: Supabase CLI (Alternative)

If your Supabase setup supports CLI configuration:

```bash
# Login to Supabase CLI
supabase login

# Link to your project (Dev)
supabase link --project-ref jhelkawgkjohvzsusrnw

# Update auth config
supabase secrets set GOTRUE_MAILER_OTP_EXP=432000

# Verify
supabase secrets list
```

**Repeat for Production:**
```bash
supabase link --project-ref imncjxfppzikerifyukk
supabase secrets set GOTRUE_MAILER_OTP_EXP=432000
```

---

## Option 3: Self-Hosted Supabase

If you're self-hosting Supabase, add these environment variables:

**Docker Compose:**
```yaml
services:
  auth:
    environment:
      GOTRUE_MAILER_OTP_EXP: "432000"          # 5 days
      GOTRUE_MAX_RECOVERY_TOKEN_TTL: "432000"   # 5 days
      GOTRUE_PASSWORD_RESET_EXP: "432000"       # 5 days
```

**Kubernetes ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: supabase-auth-config
data:
  GOTRUE_MAILER_OTP_EXP: "432000"
  GOTRUE_MAX_RECOVERY_TOKEN_TTL: "432000"
  GOTRUE_PASSWORD_RESET_EXP: "432000"
```

---

## Important Notes

### Time Calculation
```
5 days = 5 × 24 hours × 60 minutes × 60 seconds
      = 5 × 24 × 3600
      = 432,000 seconds
```

### Security Considerations
- ✅ **5 days** is a good balance between security and UX
- ❌ **Don't exceed 7 days** (168 hours = 604,800 seconds) for security
- ✅ Links are still **single-use** (cannot be reused after first click)
- ✅ Links **auto-expire** after 5 days even if unused

### Both Environments Required
You must update **BOTH** environments:
1. Dev environment (for testing)
2. Production environment (for live users)

---

## Verification Steps

### 1. Check Email Content
After deployment, send a test invitation:
```
Expected: "This invitation link expires in 5 days and can only be used once"
```

### 2. Test Link Validity
- Day 1: Link should work ✅
- Day 3: Link should still work ✅
- Day 5: Link should still work ✅
- Day 6: Link should be expired ❌

### 3. Test Single-Use Behavior
1. Click link first time -> Should work ✅
2. Complete password setup -> Success ✅
3. Click same link again -> Should show "expired" ❌ (Expected)

---

## Troubleshooting

### Links still expire after 24 hours
**Possible causes:**
1. Configuration not saved properly
2. Wrong project selected
3. Browser cache (clear and retry)
4. Need to restart edge functions

**Solution:**
```bash
# Redeploy edge functions to pick up new config
supabase functions deploy invite-user
supabase functions deploy invite-bank-viewer
```

### Can't find OTP expiry setting
**Alternative locations in Supabase Dashboard:**
- Settings -> Project Settings -> Auth
- Authentication -> Configuration
- Settings -> API -> Auth

**Contact Supabase support if not found**

### Configuration not taking effect
1. Clear browser cache
2. Wait 5 minutes for propagation
3. Check Supabase status page
4. Restart edge functions
5. Test with incognito window

---

## Related Files

- `/supabase/functions/invite-bank-viewer/index.ts` - Bank viewer invitations
- `/supabase/functions/invite-user/index.ts` - Admin/specialist invitations
- `/src/pages/Auth.tsx` - Password setup page with expiration handling
- `/docs/fixes/INVITATION_LINK_FIXES.md` - Complete fix documentation

---

## Support Contacts

**Supabase Support:**
- Dashboard: https://app.supabase.com/support
- Discord: https://discord.supabase.com
- Docs: https://supabase.com/docs/guides/auth

**TelAgri Internal:**
- CTO: Lasha Shonia
- Documentation: `/docs/` directory

---

Last Updated: January 22, 2026
Configuration Target: 432,000 seconds (5 days)
Status: Ready for Implementation
