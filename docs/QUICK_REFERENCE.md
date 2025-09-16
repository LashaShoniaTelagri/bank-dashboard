# Quick Reference Guide

> **Fast access to common tasks and documentation**

## 🚀 Quick Start Commands

```bash
# Development
npm run dev                      # Start development server
npm run build                    # Build for production
npm run lint                     # Run linter
npm run type-check              # TypeScript validation

# Environment Setup
./scripts/setup-aws-parameter-store.sh us-east-1 dev
./scripts/upload-env-to-aws.sh frontend dev env.frontend.dev us-east-1
./scripts/test-env-setup.sh dev us-east-1

# Database
cd supabase && supabase migration list --linked
cd supabase && supabase db push --linked

# Infrastructure
cd cdk && npm run deploy
```

## 📚 Documentation Quick Links

| Need | Document | Path |
|------|----------|------|
| **Get Started** | Main README | [../README.md](../README.md) |
| **Environment Setup** | Environment Guide | [setup/environment.md](setup/environment.md) |
| **Security Config** | Security Setup | [security/setup.md](security/setup.md) |
| **Deploy to AWS** | AWS Deployment | [deployment/aws.md](deployment/aws.md) |
| **Feature Request** | Product Templates | [development/product-templates.md](development/product-templates.md) |
| **PWA Features** | PWA Development | [development/pwa.md](development/pwa.md) |
| **2FA Setup** | 2FA Guide | [security/2fa-trusted-devices.md](security/2fa-trusted-devices.md) |

## 🔧 Common Troubleshooting

### Environment Issues
```bash
# Check Parameter Store access
./scripts/test-env-setup.sh dev us-east-1

# Verify AWS credentials
aws sts get-caller-identity

# Check environment variables
grep -c '^VITE_' .env
```

### Database Issues
```bash
# Check migration status
cd supabase && supabase migration list --linked

# Reset database (DANGER - dev only)
cd supabase && supabase db reset --linked

# Check RLS policies
cd supabase && supabase db diff --linked
```

### Build Issues
```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm install
npm run build

# Check TypeScript errors
npm run type-check
```

## 🔒 Security Checklist

- [ ] Environment variables in Parameter Store (not committed)
- [ ] Frontend/backend variables properly separated
- [ ] 2FA enabled for all admin accounts
- [ ] RLS policies implemented for all tables
- [ ] Sensitive data never logged
- [ ] HTTPS enforced everywhere

## 📞 Emergency Contacts

| Issue Type | Action |
|------------|--------|
| **Security Incident** | Contact security team immediately |
| **Production Down** | Check GitHub Actions, AWS Console, Supabase Dashboard |
| **Data Issue** | Check audit logs, contact database admin |
| **Access Issue** | Verify 2FA, check user roles in Supabase |

## 🔗 External Quick Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [AWS Console](https://console.aws.amazon.com/)
- [GitHub Actions](../../actions)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

**💡 Tip**: Bookmark this page for quick access to common tasks and troubleshooting steps.
