# 🚀 Deploy Password Reset with Branded Emails

## Quick Deploy (1 Command)

```bash
./scripts/deploy-all.sh --environment dev
```

This will deploy the `send-password-reset` Edge Function with your existing SendGrid configuration.

## What This Does

Replaces Supabase's default password reset emails with **branded TelAgri emails**:

**Before:**
```
From: Supabase Auth <noreply@mail.app.supabase.io>
```

**After:**
```
From: TelAgri Platform <noreply@telagri.com>
```

## Test After Deployment

1. Go to `http://localhost:3000/forgot-password`
2. Enter your email: `lasha@telagri.com`
3. Check your inbox for the branded TelAgri password reset email

## Verify Deployment

```bash
# Check if function is deployed
supabase functions list

# Check logs
supabase functions logs send-password-reset
```

## Configuration

Uses your existing SendGrid setup (no changes needed):
- ✅ `SENDGRID_API_KEY` (already configured)
- ✅ `SENDGRID_FROM_EMAIL` (already configured)
- ✅ `SUPABASE_URL` (already configured)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (already configured)
- ✅ `SITE_URL` (already configured)

## Documentation

- **Summary:** [docs/security/PASSWORD_RESET_SUMMARY.md](./docs/security/PASSWORD_RESET_SUMMARY.md)
- **Full Guide:** [docs/security/PASSWORD_RESET_IMPLEMENTATION.md](./docs/security/PASSWORD_RESET_IMPLEMENTATION.md)
- **Deployment:** [docs/security/PASSWORD_RESET_DEPLOYMENT.md](./docs/security/PASSWORD_RESET_DEPLOYMENT.md)

## Support

If emails aren't branded after deployment:

1. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → send-password-reset → Logs

2. **Verify secrets:**
   ```bash
   supabase secrets list
   ```

3. **Test the function:**
   ```bash
   curl -X POST \
     "https://your-project.supabase.co/functions/v1/send-password-reset" \
     -H "Authorization: Bearer your-anon-key" \
     -H "Content-Type: application/json" \
     -d '{"email":"lasha@telagri.com"}'
   ```

---

**Status:** ✅ Ready to Deploy  
**Estimated Time:** 2-3 minutes  
**Risk Level:** Low (uses existing SendGrid configuration)

