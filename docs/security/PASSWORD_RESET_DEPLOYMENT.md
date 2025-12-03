# Password Reset Edge Function Deployment Guide

## Overview

This guide covers deploying the `send-password-reset` Edge Function to enable branded TelAgri password reset emails via SendGrid.

## Prerequisites

✅ Supabase CLI installed  
✅ SendGrid API key configured  
✅ Supabase project linked  
✅ Environment variables set

## Quick Deployment

### Option 1: Deploy All Functions (Recommended)

```bash
cd /path/to/telagri-bank-dashboard
./scripts/deploy-all.sh --environment dev
```

This will:
- Deploy all Edge Functions including `send-password-reset`
- Set required secrets automatically
- Validate deployment

### Option 2: Deploy Single Function

```bash
# Link to your Supabase project
supabase link --project-ref your-project-id

# Deploy the password reset function
supabase functions deploy send-password-reset --no-verify-jwt

# Set required secrets
supabase secrets set SUPABASE_URL=your-supabase-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set SENDGRID_API_KEY=your-sendgrid-api-key
supabase secrets set SENDGRID_FROM_EMAIL=noreply@telagri.com
supabase secrets set SITE_URL=http://localhost:3000  # or your production URL
```

## Required Environment Variables

### Edge Function Secrets

These secrets must be set in Supabase for the Edge Function to work:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@telagri.com

# Application URL (for password reset redirect)
SITE_URL=https://your-production-domain.com  # or http://localhost:3000 for dev
```

### Setting Secrets via CLI

```bash
# Set all secrets at once
supabase secrets set \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx \
  SENDGRID_FROM_EMAIL=noreply@telagri.com \
  SITE_URL=https://your-domain.com
```

### Verifying Secrets

```bash
# List all secrets (values are hidden for security)
supabase secrets list
```

## Testing the Deployment

### 1. Test via Browser

1. Navigate to `http://localhost:3000/forgot-password` (or your production URL)
2. Enter a valid email address
3. Click "Send Reset Link"
4. Check the email inbox for the branded TelAgri password reset email

### 2. Test via cURL

```bash
# Get your Supabase anon key
ANON_KEY=your-anon-key
PROJECT_URL=https://your-project.supabase.co

# Test the function
curl -X POST \
  "${PROJECT_URL}/functions/v1/send-password-reset" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@telagri.com"}'
```

Expected response:
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

### 3. Check Edge Function Logs

```bash
# View real-time logs
supabase functions serve send-password-reset

# Or check logs in Supabase Dashboard
# Dashboard → Edge Functions → send-password-reset → Logs
```

## Email Template Preview

The password reset email will look like this:

**From:** TelAgri Platform <noreply@telagri.com>  
**Subject:** Reset Your TelAgri Password

**Content:**
- TelAgri branded header with emerald gradient
- Clear password reset button
- Security warnings and best practices
- Password requirements listed
- Link expiration notice (1 hour)
- Professional footer

## Troubleshooting

### Issue: Function not found

```bash
# Verify function is deployed
supabase functions list

# Redeploy if needed
supabase functions deploy send-password-reset --no-verify-jwt
```

### Issue: SendGrid error "Unauthorized"

```bash
# Verify SendGrid API key is set correctly
supabase secrets list

# Update if needed
supabase secrets set SENDGRID_API_KEY=your-correct-api-key
```

### Issue: Email not received

1. **Check SendGrid Dashboard:**
   - Go to SendGrid Dashboard → Activity
   - Search for the recipient email
   - Check delivery status

2. **Check Edge Function Logs:**
   ```bash
   # View logs in Supabase Dashboard
   # Look for SendGrid response codes
   ```

3. **Verify Email Configuration:**
   - Ensure `SENDGRID_FROM_EMAIL` is verified in SendGrid
   - Check spam folder
   - Verify email address is correct

### Issue: Invalid reset link

1. **Check SITE_URL:**
   ```bash
   # Ensure SITE_URL matches your application URL
   supabase secrets list
   
   # Update if needed
   supabase secrets set SITE_URL=https://your-correct-domain.com
   ```

2. **Verify Supabase Auth Settings:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your application URL to allowed redirect URLs

### Issue: User not found

This is expected behavior for security (prevents email enumeration). The function will:
- Return success message regardless of user existence
- Only send email if user actually exists
- Log user not found in Edge Function logs (server-side only)

## Security Considerations

### ✅ Implemented Security Features

1. **Email Enumeration Prevention**
   - Always returns success message
   - Doesn't reveal if user exists
   - Only logs details server-side

2. **Secure Token Generation**
   - Uses Supabase Admin API
   - One-time use tokens
   - 1-hour expiration
   - Contains access_token for security

3. **Rate Limiting**
   - Built-in Supabase rate limiting
   - Prevents brute force attacks
   - Cooldown periods enforced

4. **Input Validation**
   - Email format validation
   - Sanitized inputs
   - Error handling for edge cases

### 🔒 Best Practices

1. **Rotate SendGrid API Key Regularly**
   ```bash
   # Generate new key in SendGrid Dashboard
   # Update secret in Supabase
   supabase secrets set SENDGRID_API_KEY=new-key
   ```

2. **Monitor Edge Function Usage**
   - Check Supabase Dashboard for unusual activity
   - Set up alerts for high usage
   - Review logs regularly

3. **Keep Secrets Secure**
   - Never commit secrets to git
   - Use environment-specific secrets
   - Rotate keys after team member changes

## Production Deployment Checklist

Before deploying to production:

- [ ] SendGrid API key configured and tested
- [ ] `SENDGRID_FROM_EMAIL` verified in SendGrid
- [ ] `SITE_URL` set to production domain
- [ ] Edge Function deployed successfully
- [ ] All secrets set correctly
- [ ] Test password reset flow end-to-end
- [ ] Verify email delivery to multiple providers (Gmail, Outlook, etc.)
- [ ] Check spam score of emails
- [ ] Monitor Edge Function logs for errors
- [ ] Set up monitoring/alerts for function failures

## Monitoring & Maintenance

### Daily Checks
- Monitor Edge Function error rate
- Check SendGrid delivery statistics
- Review any user-reported issues

### Weekly Tasks
- Review Edge Function logs for patterns
- Check SendGrid bounce/spam reports
- Verify email delivery rates

### Monthly Tasks
- Review and rotate API keys if needed
- Update email templates if branding changes
- Audit security logs for suspicious activity

## Support

### For Developers
- Check Edge Function logs in Supabase Dashboard
- Review SendGrid Activity feed
- Test with curl commands above

### For Users
If users report issues:
1. Verify their email exists in system
2. Check SendGrid delivery status
3. Ask them to check spam folder
4. Verify reset link hasn't expired (1 hour limit)

## Related Documentation

- [Password Reset Implementation](./PASSWORD_RESET_IMPLEMENTATION.md)
- [Edge Functions Deployment](../deployment/edge-functions.md)
- [Security Best Practices](./setup.md)

---

**Last Updated:** December 3, 2025  
**Status:** ✅ Production Ready

