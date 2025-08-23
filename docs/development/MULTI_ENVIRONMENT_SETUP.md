# 🏗️ Multi-Environment Supabase Setup

**Comprehensive guide for managing development, staging, and production Supabase environments with proper Edge Function environment variable management.**

---

## 🎯 **Overview**

### **Environment Structure**
```
Development  → Local dev + Dev Supabase project
Staging      → GitHub Actions + Staging Supabase project  
Production   → GitHub Actions + Production Supabase project
```

### **What's Managed Per Environment**
- ✅ **Supabase Project** (separate project per environment)
- ✅ **Database Schema** (migrations applied to each)
- ✅ **Edge Functions** (deployed to each with environment-specific secrets)
- ✅ **Environment Variables** (different values per environment)
- ✅ **Email Configuration** (dev/staging/prod email settings)

---

## 🔧 **Step 1: Development Project Setup**

### **1.1 Update Local Environment**

Create/update `.env.local` with your new development project:

```bash
# TelAgri Bank Dashboard - DEVELOPMENT Environment
VITE_SUPABASE_URL=https://YOUR_DEV_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY_HERE
NODE_ENV=development

# SendGrid Configuration (Development)
SENDGRID_API_KEY=YOUR_DEV_SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=dev-noreply@telagri.com
SITE_URL=http://localhost:8081

# Edge Function Secrets (for local testing)
EDGE_SENDGRID_API_KEY=YOUR_DEV_SENDGRID_API_KEY
EDGE_SENDGRID_FROM_EMAIL=dev-noreply@telagri.com
EDGE_SITE_URL=http://localhost:8081
```

### **1.2 Update Supabase Configuration**

**Option A: Environment-Specific Config (Recommended)**
```bash
# Create environment-specific configs
cp supabase/config.toml supabase/config.production.toml
```

Update main config for development:
```toml
# supabase/config.toml (Development)
project_id = "YOUR_DEV_PROJECT_ID"

[functions.invite-bank-viewer]
verify_jwt = false

[functions.verify-2fa-code]
verify_jwt = false

[functions.send-2fa-code]
verify_jwt = false

[functions.delete-user]
verify_jwt = true
```

Create production config:
```toml
# supabase/config.production.toml
project_id = "imncjxfppzikerifyukk"

[functions.invite-bank-viewer]
verify_jwt = false

[functions.verify-2fa-code]
verify_jwt = false

[functions.send-2fa-code]
verify_jwt = false

[functions.delete-user]
verify_jwt = true
```

---

## 🚀 **Step 2: GitHub Secrets Management**

### **2.1 Add Development Project Secrets**

Add these secrets to your GitHub repository:

```bash
# Development Environment
SUPABASE_PROJECT_ID_DEV=your_dev_project_id
SUPABASE_DB_PASSWORD_DEV=your_dev_db_password
SUPABASE_ACCESS_TOKEN_DEV=your_dev_access_token  # Optional: separate token

# Edge Function Environment Variables - Development
EDGE_SENDGRID_API_KEY_DEV=your_dev_sendgrid_key
EDGE_SENDGRID_FROM_EMAIL_DEV=dev-noreply@telagri.com
EDGE_SITE_URL_DEV=https://dev-dashboard.telagri.com

# Staging Environment (if needed)
SUPABASE_PROJECT_ID_STAGING=your_staging_project_id
SUPABASE_DB_PASSWORD_STAGING=your_staging_db_password
EDGE_SENDGRID_API_KEY_STAGING=your_staging_sendgrid_key
EDGE_SENDGRID_FROM_EMAIL_STAGING=staging-noreply@telagri.com
EDGE_SITE_URL_STAGING=https://staging-dashboard.telagri.com

# Production Environment (existing)
SUPABASE_PROJECT_ID_PROD=imncjxfppzikerifyukk
SUPABASE_DB_PASSWORD_PROD=your_prod_db_password
EDGE_SENDGRID_API_KEY_PROD=your_prod_sendgrid_key
EDGE_SENDGRID_FROM_EMAIL_PROD=noreply@telagri.com
EDGE_SITE_URL_PROD=https://dashboard.telagri.com
```

### **2.2 Update GitHub Actions Environment Detection**

The workflows will automatically use the right secrets based on environment.

---

## 🔧 **Step 3: Enhanced Edge Functions Deployment**

### **3.1 Update GitHub Actions Workflows**

The workflows need enhancement to manage environment-specific Edge Function secrets. Here's how the enhanced deployment will work:

**Enhanced Edge Functions Deployment Process:**
1. **Determine Environment** (dev/staging/prod based on branch/input)
2. **Set Environment-Specific Secrets** in Supabase
3. **Deploy Edge Functions** with proper environment configuration
4. **Verify Deployment** with environment-specific settings

---

## 🔐 **Step 4: Supabase Secrets Management**

### **4.1 Set Edge Function Secrets Per Environment**

**For Development Environment:**
```bash
# Link to development project
supabase link --project-ref your_dev_project_id

# Set development secrets
supabase secrets set SENDGRID_API_KEY=your_dev_sendgrid_key
supabase secrets set SENDGRID_FROM_EMAIL=dev-noreply@telagri.com
supabase secrets set SITE_URL=https://dev-dashboard.telagri.com

# Deploy functions to development
supabase functions deploy
```

**For Production Environment:**
```bash
# Link to production project  
supabase link --project-ref imncjxfppzikerifyukk

# Set production secrets
supabase secrets set SENDGRID_API_KEY=your_prod_sendgrid_key
supabase secrets set SENDGRID_FROM_EMAIL=noreply@telagri.com
supabase secrets set SITE_URL=https://dashboard.telagri.com

# Deploy functions to production
supabase functions deploy
```

### **4.2 Edge Function Code Access**

Your Edge Functions can access these secrets using `Deno.env.get()`:

```typescript
// supabase/functions/send-2fa-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Access environment-specific secrets
  const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')!
  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL')!
  const siteUrl = Deno.env.get('SITE_URL')!
  
  // Your function logic here
  console.log(`Sending from: ${fromEmail}`)
  console.log(`Site URL: ${siteUrl}`)
  
  return new Response(JSON.stringify({ 
    success: true,
    environment: Deno.env.get('NODE_ENV') || 'production'
  }))
})
```

---

## 🚀 **Step 5: Enhanced GitHub Actions Configuration**

We need to update the workflows to handle environment-specific Edge Function secrets. 

---

## 📋 **Step 6: Local Development Workflow**

### **6.1 Development Setup**
```bash
# 1. Update your local .env.local with development project details
# 2. Update supabase/config.toml with development project_id
# 3. Link to development project
supabase link --project-ref your_dev_project_id

# 4. Run migrations on development project
supabase db push

# 5. Set Edge Function secrets for development
supabase secrets set SENDGRID_API_KEY=your_dev_sendgrid_key
supabase secrets set SENDGRID_FROM_EMAIL=dev-noreply@telagri.com
supabase secrets set SITE_URL=http://localhost:8081

# 6. Deploy Edge Functions to development
supabase functions deploy

# 7. Start local development
bun run dev
```

### **6.2 Testing Edge Functions Locally**
```bash
# Start local Supabase (uses your .env.local)
supabase start

# Serve functions locally
supabase functions serve

# Test a function
curl -X POST 'http://localhost:54321/functions/v1/send-2fa-code' \
  -H 'Content-Type: application/json' \
  -d '{"email": "test@example.com", "code": "123456"}'
```

---

## 🔄 **Step 7: Environment Workflows**

### **7.1 Automatic Deployment (Branch-based)**

**Development Branch (`develop`)**
```bash
git push origin develop
# → Deploys to development Supabase project
# → Uses EDGE_*_DEV secrets
```

**Staging Branch (`staging`)**  
```bash
git push origin staging
# → Deploys to staging Supabase project
# → Uses EDGE_*_STAGING secrets
```

**Production Branch (`main`)**
```bash
git push origin main  
# → Deploys to production Supabase project
# → Uses EDGE_*_PROD secrets
```

### **7.2 Manual Deployment (Environment Selection)**

Use GitHub Actions manual workflow:
1. Go to **Actions** → **Manual Database Migration**
2. Select **Environment**: `dev`, `staging`, or `prod`
3. Select **Migration Action**: `push`, `reset`, `repair`, or `list`
4. **Run workflow**

**Result**: Deploys to selected environment with appropriate secrets.

---

## 🔍 **Step 8: Verification & Monitoring**

### **8.1 Verify Environment Setup**
```bash
# Check which project you're linked to
supabase status

# List Edge Functions in current project
supabase functions list

# Check Edge Function secrets (won't show values)
supabase secrets list
```

### **8.2 Test Environment-Specific Behavior**
```bash
# Development - should use dev email settings
curl -X POST 'https://your-dev-project.supabase.co/functions/v1/send-2fa-code' \
  -H 'Authorization: Bearer YOUR_DEV_ANON_KEY' \
  -d '{"email": "test@example.com"}'

# Production - should use prod email settings  
curl -X POST 'https://imncjxfppzikerifyukk.supabase.co/functions/v1/send-2fa-code' \
  -H 'Authorization: Bearer YOUR_PROD_ANON_KEY' \
  -d '{"email": "test@example.com"}'
```

---

## 🚨 **Step 9: Troubleshooting**

### **9.1 Common Issues**

**Issue**: Edge Functions using wrong environment variables
```bash
# Solution: Re-set secrets for the environment
supabase link --project-ref your_project_id
supabase secrets set SENDGRID_API_KEY=correct_key_for_env
supabase functions deploy
```

**Issue**: GitHub Actions can't find environment secrets
```bash
# Solution: Verify GitHub Secrets are set with correct naming
# EDGE_SENDGRID_API_KEY_DEV
# EDGE_SENDGRID_API_KEY_STAGING  
# EDGE_SENDGRID_API_KEY_PROD
```

**Issue**: Local development using production data
```bash
# Solution: Verify .env.local points to development project
VITE_SUPABASE_URL=https://your_dev_project_id.supabase.co
VITE_SUPABASE_ANON_KEY=your_dev_anon_key
```

### **9.2 Environment Verification Checklist**
- [ ] ✅ **Local .env.local** points to development project
- [ ] ✅ **supabase/config.toml** has development project_id  
- [ ] ✅ **GitHub Secrets** set for all environments (DEV/STAGING/PROD)
- [ ] ✅ **Supabase Secrets** set in each project environment
- [ ] ✅ **Edge Functions** deployed to each environment
- [ ] ✅ **Database Migrations** applied to each environment

---

## 📚 **Step 10: Quick Reference**

### **Environment Mapping**
| Environment | Branch | Project ID | GitHub Secrets Suffix |
|-------------|---------|------------|----------------------|
| Development | `develop` | `your_dev_project_id` | `_DEV` |
| Staging | `staging` | `your_staging_project_id` | `_STAGING` |
| Production | `main` | `imncjxfppzikerifyukk` | `_PROD` |

### **Required GitHub Secrets**
```bash
# Database Connection (per environment)
SUPABASE_PROJECT_ID_DEV / SUPABASE_PROJECT_ID_STAGING / SUPABASE_PROJECT_ID_PROD
SUPABASE_DB_PASSWORD_DEV / SUPABASE_DB_PASSWORD_STAGING / SUPABASE_DB_PASSWORD_PROD

# Edge Function Environment Variables (per environment)  
EDGE_SENDGRID_API_KEY_DEV / EDGE_SENDGRID_API_KEY_STAGING / EDGE_SENDGRID_API_KEY_PROD
EDGE_SENDGRID_FROM_EMAIL_DEV / EDGE_SENDGRID_FROM_EMAIL_STAGING / EDGE_SENDGRID_FROM_EMAIL_PROD
EDGE_SITE_URL_DEV / EDGE_SITE_URL_STAGING / EDGE_SITE_URL_PROD

# Shared (all environments)
SUPABASE_ACCESS_TOKEN
```

### **Commands Quick Reference**
```bash
# Switch to development
supabase link --project-ref your_dev_project_id
supabase secrets set SENDGRID_API_KEY=dev_key

# Switch to production  
supabase link --project-ref imncjxfppzikerifyukk
supabase secrets set SENDGRID_API_KEY=prod_key

# Deploy to current linked project
supabase functions deploy

# Check current environment
supabase status
```

---

**✅ Your multi-environment Supabase setup with Edge Function environment variable management is now complete!**

**Key Benefits:**
- 🔒 **Environment Isolation**: Development changes don't affect production
- 🚀 **Automatic Deployment**: Branch-based deployment with proper environment detection
- 🔐 **Secure Secrets Management**: Environment-specific secrets via GitHub Secrets + Supabase Secrets
- 🧪 **Safe Testing**: Test Edge Functions with development data and email settings
- 📊 **Environment Consistency**: Same deployment process across all environments 