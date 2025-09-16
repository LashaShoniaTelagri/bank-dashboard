# Edge Functions Deployment Guide

## Overview

This guide covers deploying Supabase Edge Functions for TelAgri Monitoring. The deployment process is now fully automated and flexible.

## Quick Start

### Using the Automated Script

```bash
# Deploy everything (migrations + functions)
./scripts/deploy-all.sh --environment dev

# Deploy only functions (skip migrations)
./scripts/deploy-all.sh --environment dev --skip-migrations

# Deploy with custom environment file
./scripts/deploy-all.sh --env-file my-custom.env
```

### Manual Deployment

```bash
# 1. Link to Supabase project
supabase link --project-ref your-project-id --password your-password

# 2. Deploy all functions automatically
for func in supabase/functions/*/; do
  function_name=$(basename "$func")
  supabase functions deploy "$function_name" --no-verify-jwt
done

# 3. Set secrets
supabase secrets set PROJECT_URL="https://your-project.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="your-service-role-key"
```

## Available Edge Functions

The system automatically discovers and deploys all functions in `supabase/functions/`:

- `delete-user` - User deletion functionality
- `invite-bank-viewer` - Bank viewer invitations
- `invite-user` - General user invitations  
- `send-2fa-code` - Two-factor authentication codes
- `verify-2fa-code` - 2FA verification

## Adding New Edge Functions

1. **Create function directory:**
   ```bash
   mkdir supabase/functions/my-new-function
   ```

2. **Add function code:**
   ```typescript
   // supabase/functions/my-new-function/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   
   serve(async (req) => {
     // Your function logic here
     return new Response("Hello from my new function!")
   })
   ```

3. **Deploy automatically:**
   ```bash
   ./scripts/deploy-all.sh --environment dev
   ```

The deployment script will automatically discover and deploy your new function!

## Environment Variables

### Required for Deployment

```bash
# Supabase Configuration
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_DB_PASSWORD=your-db-password

# Edge Function Secrets
PROJECT_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your-service-role-key
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@telagri.com
```

### Environment Files

- **Development:** `env.backend.dev`
- **Production:** `env.backend.prod`
- **Custom:** Use `--env-file` flag

## Project IDs

- **Development:** `jhelkawgkjohvzsusrnw`
- **Production:** `imncjxfppzikerifyukk`

## Troubleshooting

### Common Issues

1. **"Function not found"**
   - Ensure function directory exists in `supabase/functions/`
   - Check function has `index.ts` file

2. **"Secrets not set"**
   - Verify environment variables are loaded
   - Check for placeholder values (`REPLACE_WITH_*`)

3. **"Link failed"**
   - Verify project ID and password
   - Check network connectivity

### Debug Mode

```bash
# Run with verbose output
./scripts/deploy-all.sh --environment dev --verbose

# Check function logs
supabase functions logs my-function-name
```

## Security Notes

- Never commit real API keys to version control
- Use AWS Parameter Store for production secrets
- Edge Function secrets are encrypted by Supabase
- Service role keys have full database access - handle carefully

## GitHub Actions Integration

The deployment is automatically handled in CI/CD:

```yaml
# .github/workflows/deploy.yml
- name: 🔧 Deploy Edge Functions
  run: |
    # Automatically discovers and deploys all functions
    for function_dir in supabase/functions/*/; do
      function_name=$(basename "$function_dir")
      supabase functions deploy "$function_name" --no-verify-jwt
    done
```

This ensures new functions are automatically deployed without manual GitHub Actions updates!
