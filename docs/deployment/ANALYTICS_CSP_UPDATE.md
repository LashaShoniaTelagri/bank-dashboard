# Analytics CSP Update - CloudFront Configuration

## 🎯 Issue
Content Security Policy (CSP) was blocking Smartlook and needs to be updated to allow analytics scripts.

**Error:**
```
Refused to load the script 'https://web-sdk.smartlook.com/recorder.js' because it violates 
the following Content Security Policy directive: "script-src ..."
```

---

## ✅ Solution Applied

Updated CSP in `cdk/lib/telagri-stack.ts` to allow:
- ✅ **Smartlook SDK**: `https://web-sdk.smartlook.com`
- ✅ **Smartlook API**: `https://*.smartlook.com`
- ✅ **Google Tag Manager**: Already configured
- ✅ **Google Analytics**: Already configured

---

## 📝 Updated CSP Directives

### script-src (Line 118)
**Added**: `https://web-sdk.smartlook.com`

```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' 
  https://www.googletagmanager.com 
  https://www.google-analytics.com 
  https://js.sentry-cdn.com 
  https://maps.googleapis.com 
  https://maps.gstatic.com 
  https://web-sdk.smartlook.com"  // ← NEW
```

### connect-src (Line 122)
**Added**: `https://*.smartlook.com`

```typescript
"connect-src 'self' 
  https://*.supabase.co 
  https://*.telagri.com 
  https://www.google-analytics.com 
  https://sentry.io 
  https://*.sentry.io 
  wss://*.supabase.co 
  https://maps.googleapis.com 
  https://maps.gstatic.com 
  https://*.smartlook.com"  // ← NEW
```

---

## 🚀 Deployment Instructions

### Step 1: Verify Changes
```bash
cd cdk
git diff lib/telagri-stack.ts
```

### Step 2: Build CDK
```bash
cd cdk
npm install  # If needed
npm run build
```

### Step 3: Deploy to CloudFront
```bash
# Deploy to production
cdk deploy --profile production

# Or specific stack name if different
cdk deploy TelAgriStack --profile production
```

### Step 4: Verify Deployment
```bash
# Check CloudFront distribution
aws cloudfront get-distribution-config \
  --id YOUR_DISTRIBUTION_ID \
  --profile production \
  | grep -A 5 "Content-Security-Policy"
```

### Step 5: Test Analytics
1. **Clear browser cache** (important!)
2. **Hard refresh** the production site (Cmd+Shift+R / Ctrl+Shift+F5)
3. **Login as specialist or bank viewer**
4. **Check browser console** - should see:
   - ✅ `"✅ Smartlook SDK loaded successfully"`
   - ✅ `"✅ Smartlook user identified"`
   - ✅ `"✅ Google Tag Manager initialized successfully"`
   - ❌ No CSP errors

---

## 🧪 Testing CSP Changes

### Test 1: Smartlook SDK Load
```javascript
// In browser console (production):
window.smartlook
// Should be: function, not undefined
```

### Test 2: GTM DataLayer
```javascript
// In browser console:
window.dataLayer
// Should be: Array with events
```

### Test 3: Check for CSP Errors
```javascript
// Open DevTools → Console
// Filter by: "Content Security Policy"
// Expected: No errors related to smartlook.com or googletagmanager.com
```

---

## 🔧 Alternative: Manual CloudFront Update

If CDK deployment is not immediate, you can manually update CloudFront:

### Via AWS Console:
1. Go to **CloudFront → Distributions**
2. Select your distribution
3. Go to **Security → Response headers**
4. Edit **Content-Security-Policy**
5. Update `script-src` to add: `https://web-sdk.smartlook.com`
6. Update `connect-src` to add: `https://*.smartlook.com`
7. **Create invalidation**: `/*` (to clear CDN cache)

### Via AWS CLI:
```bash
# Get current config
aws cloudfront get-distribution-config \
  --id YOUR_DISTRIBUTION_ID \
  --profile production \
  > current-config.json

# Edit current-config.json to update CSP
# Then update:
aws cloudfront update-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --if-match ETAG_FROM_GET_CONFIG \
  --distribution-config file://current-config.json \
  --profile production
```

---

## 🔒 Security Considerations

### Why These Domains Are Safe:
- ✅ **Smartlook**: Official session recording service (EU-hosted, GDPR compliant)
- ✅ **Google Tag Manager**: Official Google analytics service
- ✅ **Wildcard `*.smartlook.com`**: Required for Smartlook API calls and data collection

### CSP Best Practices Maintained:
- ✅ `default-src 'self'` - Restrictive default
- ✅ `frame-ancestors 'none'` - Prevents clickjacking
- ✅ `base-uri 'self'` - Prevents base tag injection
- ✅ `form-action 'self'` - Restricts form submissions
- ✅ Specific domain whitelisting (no wildcards except for known services)

---

## 📊 What Gets Loaded

After CSP update, these scripts will load:

1. **Smartlook Recorder**: `https://web-sdk.smartlook.com/recorder.js`
2. **Google Tag Manager**: `https://www.googletagmanager.com/gtag/js?id=GTM-KZ2LGC3W`
3. **Smartlook API Calls**: Various `https://*.smartlook.com` endpoints

---

## 🐛 Troubleshooting

### Issue: Still getting CSP errors after deployment
**Solution:**
1. **Clear CloudFront cache**: Create invalidation for `/*`
2. **Clear browser cache**: Hard refresh (Cmd+Shift+R)
3. **Wait 5-10 minutes**: CloudFront distribution takes time to propagate

### Issue: CDK deployment fails
**Solution:**
```bash
# Check CDK context
cdk context --clear

# Re-bootstrap if needed
cdk bootstrap --profile production

# Try deploy with verbose logging
cdk deploy --verbose --profile production
```

### Issue: Smartlook still not loading
**Solution:**
1. Check browser console for other errors
2. Verify environment variables are set:
   ```javascript
   import.meta.env.VITE_APP_SMARTLOOK_KEY
   import.meta.env.VITE_APP_TAG_MANAGER_KEY
   ```
3. Ensure user is specialist or bank viewer (not admin)

---

## 📝 Rollback Plan

If issues arise, rollback CSP changes:

```bash
# Rollback CDK
git revert HEAD
cdk deploy --profile production

# Or manually remove domains from CloudFront console
```

---

## ✅ Verification Checklist

After deployment:
- [ ] No CSP errors in browser console
- [ ] Smartlook SDK loads successfully
- [ ] GTM dataLayer initialized
- [ ] User identification working in Smartlook dashboard
- [ ] Session recordings visible in Smartlook
- [ ] Events tracked in Google Analytics
- [ ] No impact on existing functionality
- [ ] All other scripts still loading (Maps, Sentry, etc.)

---

**Deployment Time**: ~10-15 minutes (including CloudFront propagation)  
**Risk Level**: Low (only adding domains to CSP whitelist)  
**Rollback Time**: ~5 minutes

---

**Last Updated**: October 3, 2025  
**Updated By**: Lasha Shonia, CTO

