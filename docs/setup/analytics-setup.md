# Analytics Setup Guide - GTM & Smartlook

This guide covers the setup of Google Tag Manager (GTM) and Smartlook analytics for the TelAgri Bank Dashboard. Analytics are configured to track **only specialists and bank viewers** in production environments.

## 🎯 Overview

### What's Tracked:
- ✅ **Specialists** - Full session recording and event tracking
- ✅ **Bank Viewers** - Full session recording and event tracking
- ❌ **Admins** - Not tracked (sensitive operations)

### Environment Behavior:
- **Production**: Analytics fully enabled
- **Development/Localhost**: Analytics completely disabled

---

## 📋 Prerequisites

1. **Google Tag Manager Account**: [Create account](https://tagmanager.google.com/)
2. **Smartlook Account**: [Create account](https://www.smartlook.com/)
3. Access to production environment variables

---

## 🔧 Setup Instructions

### Step 1: Create Google Tag Manager Container

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Create a new container:
   - **Container name**: `TelAgri Bank Dashboard`
   - **Target platform**: `Web`
3. Copy your **Container ID** (format: `GTM-XXXXXXX`)

### Step 2: Create Smartlook Project

1. Go to [Smartlook Dashboard](https://app.smartlook.com/)
2. Create a new project:
   - **Project name**: `TelAgri Bank Dashboard`
   - **Project type**: `Web`
   - **Region**: `EU` (GDPR compliance)
3. Copy your **Project Key** (format: long alphanumeric string)

### Step 3: Update Production Configuration

Update the following file: `index.html`

#### Replace GTM Container ID (Line 15):
```html
<!-- Before -->
})(window,document,'script','dataLayer','GTM-XXXXXXX');

<!-- After -->
})(window,document,'script','dataLayer','GTM-ABC1234'); // Your actual GTM ID
```

#### Replace Smartlook Project Key (Line 29):
```html
<!-- Before -->
smartlook('init', 'YOUR_SMARTLOOK_KEY', { region: 'eu' });

<!-- After -->
smartlook('init', '1234567890abcdef1234567890abcdef12345678', { region: 'eu' });
```

#### Update GTM noscript fallback (Line 92):
```html
<!-- Before -->
<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"

<!-- After -->
<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-ABC1234"
```

### Step 4: Configure Google Tag Manager

1. **Login to GTM** and select your container
2. **Create Basic Tags**:

#### Page View Tag
- **Tag Type**: Google Analytics: GA4 Event
- **Event Name**: `page_view`
- **Trigger**: All Pages

#### User Identification Tag
- **Tag Type**: Custom HTML
- **HTML**:
```html
<script>
dataLayer.push({
  'user_role': {{User Role}},
  'user_type': {{User Type}},
  'bank_id': {{Bank ID}}
});
</script>
```
- **Trigger**: Custom Event - `user_identified`

3. **Create Variables**:
   - `User Role` - Data Layer Variable - `user_role`
   - `User Type` - Data Layer Variable - `user_type`
   - `Bank ID` - Data Layer Variable - `bank_id`

### Step 5: Configure Smartlook

1. **Login to Smartlook** and select your project
2. **Configure User Properties**:
   - Go to **Settings → User Properties**
   - Verify these properties are tracked:
     - `role` (specialist/bank_viewer)
     - `email` (user email)
     - `bank_id` (bank identifier)
     - `user_type` (Specialist/Bank Viewer)

3. **Set up Segments** (Optional):
   - **Specialists Only**: Filter by `user_type = Specialist`
   - **Bank Viewers Only**: Filter by `user_type = Bank Viewer`
   - **By Bank**: Filter by `bank_id = specific-bank-id`

---

## 🧪 Testing

### Local Testing (Development)
```bash
# Start development server
npm run dev

# Expected behavior:
# - Console: "📊 Analytics disabled in development environment"
# - GTM/Smartlook scripts NOT loaded
# - No tracking occurs
```

### Production Testing

1. **Build production bundle**:
```bash
npm run build
npm run preview
```

2. **Test as Specialist**:
   - Login with specialist credentials
   - Check browser console for: `"✅ Smartlook user identified"`
   - Verify GTM dataLayer events in browser DevTools

3. **Test as Bank Viewer**:
   - Login with bank viewer credentials
   - Verify same tracking behavior as specialist

4. **Test as Admin**:
   - Login with admin credentials
   - Check console for: `"📊 Analytics disabled for admin users"`
   - Verify no tracking occurs

### Verification Checklist

- [ ] GTM Container ID correctly configured
- [ ] Smartlook Project Key correctly configured
- [ ] Analytics disabled in development (localhost)
- [ ] Analytics enabled in production
- [ ] Specialists tracked correctly
- [ ] Bank viewers tracked correctly
- [ ] Admins NOT tracked
- [ ] User identity visible in Smartlook dashboard
- [ ] Page views tracked in GTM
- [ ] Custom events tracked successfully

---

## 📊 Using Analytics

### Custom Event Tracking

To track custom events in your components:

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { trackEvent } = useAnalytics();

  const handleAction = () => {
    // Your business logic
    
    // Track the action
    trackEvent('farmer_created', {
      farmer_id: 'farmer-123',
      bank_id: 'bank-456',
      action_type: 'manual'
    });
  };

  return <button onClick={handleAction}>Create Farmer</button>;
}
```

### Example Events to Track

```typescript
// Farmer management
trackEvent('farmer_created', { farmer_id, bank_id });
trackEvent('farmer_updated', { farmer_id, changes });
trackEvent('farmer_deleted', { farmer_id });

// F-100 Reports
trackEvent('f100_generated', { farmer_id, phase });
trackEvent('f100_downloaded', { farmer_id, phase });
trackEvent('f100_viewed', { farmer_id, phase });

// Data uploads
trackEvent('data_uploaded', { data_type, file_size, farmer_id });
trackEvent('data_deleted', { data_type, farmer_id });

// Analysis sessions
trackEvent('analysis_started', { farmer_id, phase });
trackEvent('analysis_completed', { farmer_id, phase, duration });
```

---

## 🔒 Privacy & Compliance

### GDPR Compliance
- ✅ Data stored in EU region (Smartlook)
- ✅ User consent implied by platform usage (business tool)
- ✅ Admin users excluded from tracking (sensitive operations)
- ✅ Email addresses masked in console logs

### Data Retention
- **Smartlook**: Configure in Settings → Data Retention
- **GTM**: Configure in Google Analytics 4 settings
- **Recommended**: 90 days for session recordings, 14 months for analytics

### Sensitive Data Protection
- ❌ Never track farmer financial details
- ❌ Never track loan amounts or sensitive banking info
- ✅ Track only behavioral data and user interactions
- ✅ Use anonymized identifiers where possible

---

## 🐛 Troubleshooting

### Analytics Not Loading

**Symptom**: No console logs, no tracking
**Solution**:
1. Verify production build: `npm run build`
2. Check hostname is not `localhost`
3. Verify GTM/Smartlook IDs are correct in `index.html`

### User Not Identified in Smartlook

**Symptom**: Sessions shown as "Anonymous"
**Solution**:
1. Check user is logged in
2. Verify user role is `specialist` or `bank_viewer`
3. Check console for identification logs
4. Verify Smartlook script loaded: `window.smartlook` exists

### Events Not Appearing in GTM

**Symptom**: No events in GTM Preview mode
**Solution**:
1. Check `window.dataLayer` exists in console
2. Verify triggers are correctly configured in GTM
3. Check browser console for any errors
4. Use GTM Preview mode for debugging

### Tracking Admin Users Accidentally

**Symptom**: Admin sessions appearing in Smartlook
**Solution**:
1. Check `useAnalytics.ts` role filter logic
2. Verify profile data loading correctly
3. Add additional filtering in Smartlook dashboard

---

## 📚 Additional Resources

- [Google Tag Manager Documentation](https://support.google.com/tagmanager)
- [Smartlook Documentation](https://help.smartlook.com/)
- [GTM Best Practices](https://www.analyticsmania.com/google-tag-manager-best-practices/)
- [Smartlook User Identification](https://help.smartlook.com/en/articles/2911878-how-to-identify-users)

---

## 🔄 Maintenance

### Monthly Tasks
- [ ] Review tracked events in GTM
- [ ] Check Smartlook session recordings for insights
- [ ] Verify tracking still works after deployments
- [ ] Review and clean up unused GTM tags

### Quarterly Tasks
- [ ] Review data retention policies
- [ ] Update custom event tracking as needed
- [ ] Audit privacy compliance
- [ ] Optimize GTM tag configuration

---

**Last Updated**: October 3, 2025  
**Version**: 1.0.0  
**Maintained By**: Lasha Shonia, CTO


