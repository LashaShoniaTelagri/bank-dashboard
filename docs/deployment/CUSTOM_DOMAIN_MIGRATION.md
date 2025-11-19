# Custom Domain Migration Guide
## Migrating from Supabase Default Domain to api.telagri.com

**Migration Date**: Pending  
**Target Domain**: `api.telagri.com`  
**Current Domain**: `*.supabase.co`  
**Status**: Pre-migration checklist

---

## 🎯 Overview

This guide outlines all code changes required to migrate from Supabase's default domain to your custom domain `api.telagri.com`.

**What Changes**:
- API endpoint: `https://{project-id}.supabase.co` → `https://api.telagri.com`
- Storage URLs: `https://{project-id}.supabase.co/storage/v1/...` → `https://api.telagri.com/storage/v1/...`
- Auth endpoints: Same pattern change
- Edge Functions: Same pattern change

**What Stays Same**:
- All Supabase functionality works identically
- Database connections unchanged
- Authentication flows unchanged
- Your code logic unchanged

---

## ✅ Pre-Migration Checklist

Before activating the custom domain:

### **Supabase Setup** (Already Done ✓)
- [x] Custom domain configured in Supabase Dashboard
- [x] DNS validation completed
- [x] SSL certificate provisioned

### **Code Updates** (To Do)
- [ ] Update environment variables
- [ ] Update CDK infrastructure code
- [ ] Update Edge Function secrets
- [ ] Update CORS and CSP policies
- [ ] Update documentation
- [ ] Test in development
- [ ] Deploy to production

### **Post-Migration** (After Activation)
- [ ] Verify all API calls work
- [ ] Test file uploads/downloads
- [ ] Test authentication flows
- [ ] Monitor error logs
- [ ] Update monitoring alerts

---

## 📋 Required Code Changes

### **1. Environment Variables (CRITICAL)**

#### **A. Local Development Files**

**File**: `env.template`
```bash
# OLD
VITE_SUPABASE_URL=

# NEW
VITE_SUPABASE_URL=https://api.telagri.com
```

**File**: `env.dev`
```bash
# OLD
VITE_SUPABASE_URL=https://jhelkawgkjohvzsusrnw.supabase.co

# NEW
VITE_SUPABASE_URL=https://api.telagri.com
```

**File**: `env.prod`
```bash
# OLD
VITE_SUPABASE_URL=https://imncjxfppzikerifyukk.supabase.co

# NEW  
VITE_SUPABASE_URL=https://api.telagri.com
```

**Note**: If you use staging:
```bash
# env.staging
VITE_SUPABASE_URL=https://api-staging.telagri.com  # Or keep dev Supabase URL
```

---

#### **B. AWS Parameter Store**

Update parameters for all environments:

```bash
# Development Environment
aws ssm put-parameter \
  --name "/telagri/dev/frontend/env" \
  --value "$(cat env.dev | base64)" \
  --type "SecureString" \
  --key-id "alias/telagri-parameter-encryption-dev" \
  --overwrite \
  --region eu-central-1

# Production Environment
aws ssm put-parameter \
  --name "/telagri/prod/frontend/env" \
  --value "$(cat env.prod | base64)" \
  --type "SecureString" \
  --key-id "alias/telagri-parameter-encryption-prod" \
  --overwrite \
  --region eu-central-1

# Backend parameters (if separate)
aws ssm put-parameter \
  --name "/telagri/prod/backend/env" \
  --value "$(cat env.backend.prod | base64)" \
  --type "SecureString" \
  --overwrite \
  --region eu-central-1
```

---

### **2. AWS CDK Infrastructure Code**

**File**: `cdk/lib/telagri-stack.ts`

**Location**: Lines 334 & 375

```typescript
// OLD
VITE_SUPABASE_URL=https://${supabaseProjectId}.supabase.co

// NEW
VITE_SUPABASE_URL=https://api.telagri.com
```

**Location**: Line 383

```typescript
// OLD
PROJECT_URL=https://${supabaseProjectId}.supabase.co

// NEW
PROJECT_URL=https://api.telagri.com
```

**Full changes**:

```typescript
private getFrontendEnvironmentTemplate(environment: string): string {
  const baseUrl = environment === 'prod' 
    ? 'https://dashboard.telagri.com' 
    : `https://dashboard-${environment}.telagri.com`;

  return `# Frontend Environment Configuration
VITE_APP_NAME=TelAgri Bank Dashboard
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=${environment}

# Supabase Configuration - UPDATED TO CUSTOM DOMAIN
VITE_SUPABASE_URL=https://api.telagri.com
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_${environment.toUpperCase()}_ANON_KEY

# Application URLs
VITE_APP_URL=${baseUrl}
VITE_CALENDLY_URL=https://calendly.com/telagri

# Analytics (Optional)
VITE_ANALYTICS_ID=REPLACE_WITH_GA_ID
VITE_SENTRY_DSN=REPLACE_WITH_SENTRY_DSN

${environment === 'prod' ? 'true' : 'false'}`;
}

private getBackendEnvironmentTemplate(environment: string): string {
  const baseUrl = environment === 'prod' 
    ? 'https://dashboard.telagri.com' 
    : `https://dashboard-${environment}.telagri.com`;

  return `# Backend Environment Configuration (Server-side only)

# Email Service
SENDGRID_API_KEY=REPLACE_WITH_SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=noreply@telagri.com

# Server Configuration
SITE_URL=${baseUrl}
VITE_APP_URL=${baseUrl}

# Supabase Configuration - UPDATED TO CUSTOM DOMAIN
VITE_SUPABASE_URL=https://api.telagri.com
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_${environment.toUpperCase()}_ANON_KEY

# Database Connection (for migrations)
SUPABASE_PROJECT_ID=${environment === 'prod' ? 'imncjxfppzikerifyukk' : 'jhelkawgkjohvzsusrnw'}
SUPABASE_DB_PASSWORD=REPLACE_WITH_${environment.toUpperCase()}_DB_PASSWORD

# Edge Functions Environment - UPDATED TO CUSTOM DOMAIN
PROJECT_URL=https://api.telagri.com
SERVICE_ROLE_KEY=REPLACE_WITH_${environment.toUpperCase()}_SERVICE_ROLE_KEY`;
}
```

---

### **3. Content Security Policy (CSP) Updates**

**File**: `cdk/lib/telagri-stack.ts`

**Location**: Lines 122-126

```typescript
// OLD
"connect-src 'self' https://*.supabase.co https://*.telagri.com https://www.google-analytics.com https://sentry.io https://*.sentry.io wss://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://*.smartlook.com https://*.smartlook.cloud",
"default-src 'self' https://*.telagri.com https://*.googleapis.com https://*.gstatic.com data: blob:",
"frame-src https://*.supabase.co https://view.officeapps.live.com https://*.google.com https://drive.google.com",
"img-src 'self' https://*.supabase.co https://*.telagri.com data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.smartlook.com",
"object-src https://*.supabase.co blob: data:",

// NEW - Keep *.supabase.co temporarily for backward compatibility during rollout
"connect-src 'self' https://api.telagri.com https://*.supabase.co https://*.telagri.com https://www.google-analytics.com https://sentry.io https://*.sentry.io wss://api.telagri.com wss://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://*.smartlook.com https://*.smartlook.cloud",
"default-src 'self' https://*.telagri.com https://*.googleapis.com https://*.gstatic.com data: blob:",
"frame-src https://api.telagri.com https://*.supabase.co https://view.officeapps.live.com https://*.google.com https://drive.google.com",
"img-src 'self' https://api.telagri.com https://*.supabase.co https://*.telagri.com data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.smartlook.com",
"object-src https://api.telagri.com https://*.supabase.co blob: data:",
```

**Note**: Keep `*.supabase.co` for 1 week after migration, then remove in follow-up deployment.

---

### **4. Edge Function Secrets**

Update all Edge Function environment variables:

```bash
# Set the custom domain URL for all Edge Functions
supabase secrets set PROJECT_URL="https://api.telagri.com"
supabase secrets set SUPABASE_URL="https://api.telagri.com"

# Verify secrets are set
supabase secrets list
```

**Expected output**:
```
PROJECT_URL=https://api.telagri.com
SUPABASE_URL=https://api.telagri.com
SERVICE_ROLE_KEY=***hidden***
SENDGRID_API_KEY=***hidden***
SITE_URL=https://dashboard.telagri.com
```

---

### **5. GitHub Actions Secrets**

Update GitHub repository secrets:

1. Go to: `https://github.com/{your-org}/telagri-bank-dashboard/settings/secrets/actions`

2. Update these secrets:

**For Development**:
```bash
# Generate new base64 with updated env.dev
./scripts/generate-env-base64.sh dev

# Copy output and update secret: ENV_DEV_BASE64
```

**For Production**:
```bash
# Generate new base64 with updated env.prod
./scripts/generate-env-base64.sh prod

# Copy output and update secret: ENV_PROD_BASE64
```

---

### **6. Frontend Code (No Changes Needed! ✅)**

**Good news**: All frontend code uses environment variables, so no code changes required!

**Files that automatically adapt**:
- ✅ `src/integrations/supabase/client.ts` - Uses `VITE_SUPABASE_URL`
- ✅ `src/components/AgriCopilot.tsx` - Storage URLs use Supabase client
- ✅ `src/components/FileViewer.tsx` - Uses Supabase client
- ✅ `src/components/DataUploadModal.tsx` - Uses Supabase client
- ✅ All other components - Use Supabase client

**Why it works**:
```typescript
// This line dynamically uses whatever URL is in VITE_SUPABASE_URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Storage URLs automatically use the custom domain
supabase.storage.from('farmer-documents').getPublicUrl(path)
// Returns: https://api.telagri.com/storage/v1/object/public/farmer-documents/{path}
```

---

### **7. Documentation Updates**

Update these documentation files with new domain:

**File**: `docs/setup/environment.md`
- Lines 44, 52, 60, 146: Replace example URLs with `https://api.telagri.com`

**File**: `docs/setup/edge-functions.md`  
- Lines 47, 70, 86, 95: Update example URLs

**File**: `docs/setup/supabase.md`
- Add note about custom domain usage

**File**: `docs/deployment/aws.md`
- Lines 58, 121, 377-379: Update Supabase URL references

**File**: `README.md` (root)
- Update any Supabase URL references

---

## 🚀 Migration Procedure

### **Phase 1: Code Updates (Before Activation)**

#### **Day 1: Update Code**

```bash
# 1. Update local environment files
vim env.dev     # Change VITE_SUPABASE_URL
vim env.prod    # Change VITE_SUPABASE_URL

# 2. Update CDK infrastructure
vim cdk/lib/telagri-stack.ts  # Update lines 334, 375, 383

# 3. Generate new base64 for Parameter Store
./scripts/generate-env-base64.sh dev
./scripts/generate-env-base64.sh prod

# 4. Update AWS Parameter Store
aws ssm put-parameter --name "/telagri/dev/frontend/env" --value "$(cat env.dev | base64)" --type "SecureString" --overwrite --region eu-central-1
aws ssm put-parameter --name "/telagri/prod/frontend/env" --value "$(cat env.prod | base64)" --type "SecureString" --overwrite --region eu-central-1

# 5. Update GitHub Secrets (manual - copy base64 output)
# Go to GitHub → Settings → Secrets → Update ENV_DEV_BASE64 and ENV_PROD_BASE64

# 6. Commit changes
git add cdk/lib/telagri-stack.ts env.dev env.prod docs/
git commit -m "chore: prepare for custom domain migration to api.telagri.com"
git push origin main
```

---

### **Phase 2: Test in Development**

```bash
# 1. Update Edge Function secrets (dev project)
supabase link --project-ref jhelkawgkjohvzsusrnw  # Dev project
supabase secrets set PROJECT_URL="https://api.telagri.com"
supabase secrets set SUPABASE_URL="https://api.telagri.com"

# 2. Deploy Edge Functions
supabase functions deploy

# 3. Test locally
npm run dev

# 4. Verify functionality
# - Test login/logout
# - Test file uploads
# - Test file viewer
# - Test AgriCopilot
# - Test all CRUD operations
```

---

### **Phase 3: Activate Custom Domain**

**On Supabase Dashboard**:

1. Go to: `https://supabase.com/dashboard/project/{project-id}/settings/general`
2. Navigate to "Custom Domains" section
3. Click **"Activate"** on `api.telagri.com`
4. Wait for propagation (2-5 minutes)

**Verify Activation**:
```bash
# Test API endpoint
curl https://api.telagri.com/rest/v1/

# Test auth endpoint
curl https://api.telagri.com/auth/v1/health

# Test storage
curl https://api.telagri.com/storage/v1/bucket
```

---

### **Phase 4: Deploy to Production**

```bash
# 1. Update production Edge Function secrets
supabase link --project-ref imncjxfppzikerifyukk  # Prod project
supabase secrets set PROJECT_URL="https://api.telagri.com"
supabase secrets set SITE_URL="https://dashboard.telagri.com"

# 2. Deploy production Edge Functions
supabase functions deploy

# 3. Deploy frontend via GitHub Actions
git push origin main  # Triggers production deployment

# 4. Verify deployment
# Check: https://dashboard.telagri.com
```

---

### **Phase 5: Post-Migration Verification (Critical!)**

**Immediate Tests** (5 minutes after activation):

```bash
# 1. Test authentication
# → Login as admin
# → Login as bank viewer
# → Logout and login again

# 2. Test file operations
# → Upload a farmer document
# → View document in FileViewer
# → Download document
# → Delete document

# 3. Test AgriCopilot
# → Send a query
# → Attach a document
# → Verify response

# 4. Test CRUD operations
# → Create new farmer
# → Edit farmer details
# → View F-100 reports
# → Generate F-100 PDF

# 5. Monitor errors
# → Check browser console
# → Check Supabase logs
# → Check Sentry (if configured)
```

**Browser Console Check**:
```javascript
// Should show custom domain
console.log(import.meta.env.VITE_SUPABASE_URL)
// Expected: "https://api.telagri.com"

// Storage URL check
// Open any file → Check Network tab → Should see api.telagri.com
```

---

### **Phase 6: Monitor & Rollback Plan**

**Monitoring** (First 24 hours):

```bash
# Watch Supabase logs
supabase logs --type api --follow

# Watch Edge Function logs
supabase functions logs ai-chat --follow
supabase functions logs invite-user --follow

# Watch application errors (browser console)
# - Open DevTools → Console tab
# - Filter by "error" or "supabase"
```

**Rollback Plan** (If issues occur):

```bash
# EMERGENCY ROLLBACK
# 1. Deactivate custom domain in Supabase Dashboard
# 2. Revert environment variables to old domain
vim env.prod
# Change: VITE_SUPABASE_URL=https://imncjxfppzikerifyukk.supabase.co

# 3. Update Parameter Store
./scripts/generate-env-base64.sh prod
aws ssm put-parameter --name "/telagri/prod/frontend/env" --value "$(cat env.prod | base64)" --type "SecureString" --overwrite

# 4. Redeploy
git revert HEAD
git push origin main

# 5. Clear CDN cache (if using CloudFront)
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## 🔍 Verification Checklist

### **Pre-Activation Verification**

- [ ] All environment files updated
- [ ] CDK infrastructure updated
- [ ] AWS Parameter Store updated
- [ ] GitHub Secrets updated
- [ ] Documentation updated
- [ ] Edge Function secrets prepared
- [ ] Team notified of migration window

### **Post-Activation Verification**

#### **Critical Functionality**
- [ ] Authentication works (login/logout)
- [ ] File uploads work
- [ ] File downloads work
- [ ] File viewer works
- [ ] AgriCopilot works
- [ ] F-100 generation works
- [ ] Farmer CRUD works
- [ ] Bank viewer access works
- [ ] 2FA codes sent successfully

#### **Technical Checks**
- [ ] Browser console shows no errors
- [ ] Network tab shows api.telagri.com URLs
- [ ] Storage URLs use custom domain
- [ ] WebSocket connections work (realtime)
- [ ] Edge Functions responding correctly
- [ ] No CORS errors
- [ ] No CSP violations

#### **Performance Checks**
- [ ] API response times normal (<200ms)
- [ ] File uploads complete successfully
- [ ] Page load times unchanged
- [ ] No timeout errors

---

## ⚠️ Common Issues & Solutions

### **Issue 1: CORS Errors**

**Symptom**: `Access-Control-Allow-Origin` errors in console

**Solution**:
```bash
# Verify Edge Function secrets include custom domain
supabase secrets list

# Update CORS headers in Edge Functions if needed
# (Should be automatic, but verify)
```

### **Issue 2: Storage URLs Still Use Old Domain**

**Symptom**: File URLs show `*.supabase.co` instead of `api.telagri.com`

**Solution**:
```bash
# Clear browser cache
# Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# Verify environment variable
echo $VITE_SUPABASE_URL

# Should output: https://api.telagri.com
```

### **Issue 3: Authentication Redirects Fail**

**Symptom**: After login, redirect to wrong URL

**Solution**:
```bash
# Verify SITE_URL in Edge Function secrets
supabase secrets list | grep SITE_URL

# Should be: https://dashboard.telagri.com

# Update if wrong:
supabase secrets set SITE_URL="https://dashboard.telagri.com"
```

### **Issue 4: Edge Functions Don't Work**

**Symptom**: AI chat or invitations fail

**Solution**:
```bash
# Redeploy Edge Functions with new secrets
supabase functions deploy

# Check logs
supabase functions logs ai-chat --follow
```

### **Issue 5: CSP Violations**

**Symptom**: "Content Security Policy" errors in console

**Solution**:
```bash
# Verify CSP includes custom domain
# Check cdk/lib/telagri-stack.ts lines 122-126

# Redeploy CDK if needed
cd cdk
cdk deploy
```

---

## 📊 Migration Timeline

| Phase | Duration | Risk Level |
|-------|----------|------------|
| **Code Updates** | 2 hours | 🟢 Low |
| **Testing** | 4 hours | 🟢 Low |
| **Domain Activation** | 5 minutes | 🟡 Medium |
| **Production Deploy** | 10 minutes | 🟡 Medium |
| **Verification** | 1 hour | 🟡 Medium |
| **Monitoring** | 24 hours | 🟡 Medium |

**Total Downtime**: 0 minutes (zero-downtime migration)

**Best Time to Migrate**: 
- Monday-Thursday (avoid Friday deployments)
- During low-traffic hours (evening in Georgia)
- When team is available for monitoring

---

## 🎯 Success Criteria

Migration is successful when:

✅ All API calls use `api.telagri.com`  
✅ All storage URLs use `api.telagri.com`  
✅ Authentication flows work perfectly  
✅ File operations work perfectly  
✅ No console errors  
✅ No user complaints  
✅ Performance unchanged  
✅ Monitoring shows healthy metrics  

---

## 📞 Support & Escalation

**If Issues Occur**:

1. **Check Supabase Status**: https://status.supabase.com
2. **Review Logs**: Supabase Dashboard → Logs
3. **Rollback if Critical**: Follow rollback procedure above
4. **Contact Supabase Support**: If domain activation issues

**Team Contacts**:
- CTO (Lasha): Primary decision maker
- DevOps Lead: Infrastructure support
- Backend Lead: Edge Function support

---

## 📚 Additional Resources

- [Supabase Custom Domains Documentation](https://supabase.com/docs/guides/platform/custom-domains)
- [DNS Propagation Checker](https://www.whatsmydns.net/)
- [SSL Certificate Checker](https://www.sslshopper.com/ssl-checker.html)

---

**Migration Status**: ⏳ **Ready for Execution**

**Next Step**: Review this document with team → Schedule migration window → Execute Phase 1

---

**Document Version**: 1.0  
**Last Updated**: October 2025  
**Maintained By**: CTO Office

