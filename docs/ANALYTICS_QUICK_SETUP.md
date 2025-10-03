# Analytics Quick Setup - Already Configured! ✅

## 🎉 Good News - Analytics are Pre-Configured!

Your analytics are **already set up** using environment variables. No manual configuration needed!

### Current Configuration:

**Google Tag Manager (GA4)**: `G-ZFKW9H3ZT9`  
**Smartlook Key**: `d59dc50d7b8c7150e3654cf66e706be6fa259795` (EU Region)

---

## 📝 Environment Variables (Already Set)

Analytics keys are stored in:
- `env.frontend.prod` - Production environment
- `env.frontend.dev` - Development environment (disabled by default)

```bash
# Current values in env.frontend.prod:
VITE_APP_TAG_MANAGER_KEY=G-ZFKW9H3ZT9
VITE_APP_SMARTLOOK_KEY=d59dc50d7b8c7150e3654cf66e706be6fa259795
```

---

## 🔄 To Update Analytics Keys (If Needed)

If you need to change analytics providers or keys:

1. **Update environment file**: `env.frontend.prod`
2. **Change the values**:
```bash
VITE_APP_TAG_MANAGER_KEY=YOUR_NEW_GA4_KEY
VITE_APP_SMARTLOOK_KEY=YOUR_NEW_SMARTLOOK_KEY
```
3. **Rebuild**: `npm run build`

---

### 3️⃣ Deploy to Production

```bash
npm run build
# Deploy to production server
```

---

## ✅ What's Tracked

| User Role | Tracked | Details |
|-----------|---------|---------|
| **Specialist** | ✅ Yes | Full session recording + events |
| **Bank Viewer** | ✅ Yes | Full session recording + events |
| **Admin** | ❌ No | Privacy & security reasons |

---

## 🧪 Quick Test

### In Production:

1. **Login as Specialist/Bank Viewer**
2. **Open Browser Console**
3. **Look for**: `"✅ Smartlook user identified"`
4. **Check Smartlook Dashboard**: User should appear with email/role

### In Development:

1. **Start dev server**: `npm run dev`
2. **Check console**: `"📊 Analytics disabled in development"`
3. **No tracking occurs**

---

## 🎯 User Properties in Smartlook

When specialists/bank viewers login, they're automatically identified with:

```javascript
{
  name: "user@example.com",
  email: "user@example.com",
  role: "specialist" | "bank_viewer",
  bank_id: "bank-uuid",
  user_type: "Specialist" | "Bank Viewer",
  created_at: "2024-01-01T00:00:00Z",
  invitation_status: "accepted"
}
```

---

## 📊 Custom Event Tracking (Optional)

Add tracking to any component:

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { trackEvent } = useAnalytics();
  
  const handleAction = () => {
    trackEvent('custom_event_name', {
      property1: 'value1',
      property2: 'value2'
    });
  };
}
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No tracking | Verify production build + correct IDs in `index.html` |
| User anonymous | Check user role is `specialist` or `bank_viewer` |
| Admin tracked | Review `useAnalytics.ts` role filtering logic |
| Events missing | Verify GTM triggers configured correctly |

---

## 📚 Full Documentation

See [docs/setup/analytics-setup.md](./setup/analytics-setup.md) for complete setup guide.

---

**Setup Time**: ~5 minutes  
**Maintenance**: Monthly GTM review recommended  
**Privacy**: GDPR compliant (EU region)


