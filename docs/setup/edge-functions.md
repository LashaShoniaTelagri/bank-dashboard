# Edge Functions Setup Guide

## Overview

This guide covers setting up Supabase Edge Functions for TelAgri Monitoring. Edge Functions handle server-side operations like user management, 2FA, and email sending.

## Available Edge Functions

- `delete-user` - User deletion functionality
- `invite-bank-viewer` - Bank viewer invitations
- `invite-user` - General user invitations
- `send-2fa-code` - Two-factor authentication codes
- `verify-2fa-code` - 2FA verification

## Quick Setup (Automated)

Use our automated deployment script:

```bash
./scripts/deploy-all.sh --environment dev
```

This script automatically:
- Links to the correct Supabase project
- Deploys all Edge Functions
- Sets up secrets from environment variables

## Manual Setup

### Step 1: Link to Supabase Project

```bash
# Development
supabase link --project-ref jhelkawgkjohvzsusrnw --password your-dev-password

# Production  
supabase link --project-ref imncjxfppzikerifyukk --password your-prod-password
```

### Step 2: Set Edge Function Secrets

```bash
# Get your service role key from:
# Dev: https://supabase.com/dashboard/project/jhelkawgkjohvzsusrnw/settings/api
# Prod: https://supabase.com/dashboard/project/imncjxfppzikerifyukk/settings/api

supabase secrets set PROJECT_URL="https://jhelkawgkjohvzsusrnw.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set SITE_URL="https://dashboard-dev.telagri.com"
supabase secrets set SENDGRID_API_KEY="your-sendgrid-api-key"
supabase secrets set SENDGRID_FROM_EMAIL="noreply@telagri.com"
```

### Step 3: Deploy Functions

```bash
supabase functions deploy delete-user
supabase functions deploy invite-bank-viewer
supabase functions deploy invite-user
supabase functions deploy send-2fa-code
supabase functions deploy verify-2fa-code
```

## Environment Variables

### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `PROJECT_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIs...` |
| `SENDGRID_API_KEY` | SendGrid API key for emails | `SG.your-api-key...` |
| `SENDGRID_FROM_EMAIL` | From email address | `noreply@telagri.com` |
| `SITE_URL` | Application URL | `https://dashboard-dev.telagri.com` |

### Project IDs

- **Development**: `jhelkawgkjohvzsusrnw`
- **Production**: `imncjxfppzikerifyukk`

## Testing Edge Functions

### Test 2FA Code Sending

```bash
curl -X POST "https://jhelkawgkjohvzsusrnw.supabase.co/functions/v1/send-2fa-code" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Test User Invitation

```bash
curl -X POST "https://jhelkawgkjohvzsusrnw.supabase.co/functions/v1/invite-user" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "userRole": "bank_viewer"}'
```

## Troubleshooting

### Common Issues

1. **"Function not found"**
   - Ensure function is deployed: `supabase functions list`
   - Check project linking: `supabase status`

2. **"Secrets not set"**
   - Verify secrets: `supabase secrets list`
   - Check environment variables in Parameter Store

3. **"Email not sending"**
   - Verify SendGrid API key is valid
   - Check SendGrid domain verification

### Debug Logs

```bash
# View function logs
supabase functions logs send-2fa-code

# View all function logs
supabase functions logs
```

## Security Notes

- Service role keys have full database access - handle carefully
- Edge Function secrets are encrypted by Supabase
- Never commit real API keys to version control
- Use AWS Parameter Store for production secrets

## Automated Deployment

The deployment is handled automatically in GitHub Actions:

```yaml
# .github/workflows/deploy.yml
- name: Deploy Edge Functions
  run: |
    # Automatically discovers and deploys all functions
    for function_dir in supabase/functions/*/; do
      function_name=$(basename "$function_dir")
      supabase functions deploy "$function_name" --no-verify-jwt
    done
```

This ensures new functions are automatically deployed without manual configuration updates!
