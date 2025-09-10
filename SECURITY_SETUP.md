# 🔒 Security Setup Guide

## ⚠️ CRITICAL: Never Commit Sensitive Data

This guide explains how to securely manage environment variables without exposing secrets in version control.

## 🚨 What NOT to Commit

**NEVER commit these files:**
- `env.frontend.dev` - Contains real API keys
- `env.backend.dev` - Contains sensitive secrets like `SENDGRID_API_KEY`
- Any file with real credentials, tokens, or passwords

## ✅ What IS Safe to Commit

**These files are safe because they contain only placeholders:**
- `cdk/lib/telagri-stack.ts` - CDK stack with Parameter Store resources (placeholder values only)
- `env.template` - Template with variable names only
- `ENVIRONMENT_SETUP.md` - Documentation
- Scripts in `scripts/` directory

## 🔐 Secure Workflow

### 1. **Initial Setup (One-time)**

```bash
# 1. Deploy AWS infrastructure via CDK (creates encrypted Parameter Store)
./scripts/setup-aws-parameter-store.sh us-east-1 dev your-org your-repo

# 2. Upload your REAL environment variables to AWS (encrypted)
./scripts/upload-env-to-aws.sh frontend dev env.frontend.dev us-east-1
./scripts/upload-env-to-aws.sh backend dev env.backend.dev us-east-1
```

### 2. **GitHub Actions Workflow**

```yaml
# GitHub Actions fetches from AWS Parameter Store (encrypted)
- name: 🔧 Fetch Environment Configuration from AWS
  run: ./scripts/fetch-env-from-aws.sh "$ENVIRONMENT" "$AWS_REGION"
```

### 3. **Local Development**

```bash
# For local development, create .env from template
cp env.template .env
# Edit .env with your local values (this file is gitignored)
```

## 🛡️ Security Layers

1. **AWS Parameter Store** - Encrypted with KMS
2. **IAM Permissions** - Least privilege access
3. **GitHub OIDC** - No long-lived credentials
4. **Frontend/Backend Separation** - Frontend gets only public variables
5. **Gitignore Protection** - Sensitive files never committed

## 🔍 Security Validation

```bash
# Test that your setup is secure
./scripts/test-env-setup.sh dev us-east-1

# Verify no sensitive data in git
git log --all --full-history -- env.frontend.dev env.backend.dev
# Should return: "fatal: ambiguous argument" (good - files never tracked)
```

## 📋 Environment Variable Classification

### **Frontend Variables (Public - Safe in builds)**
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...  # Public key
VITE_APP_URL=https://dashboard.telagri.com
VITE_APP_GOOGLE_MAPS_API_KEY=AIzaSy...  # Domain-restricted
```

### **Backend Variables (Sensitive - Server-side only)**
```bash
SENDGRID_API_KEY=SG.XFNPPbMSR...  # 🚨 SENSITIVE
SUPABASE_DB_PASSWORD=CbiYoXSJ...  # 🚨 SENSITIVE
JWT_SECRET=your-jwt-secret        # 🚨 SENSITIVE
```

## 🚨 Emergency: If Secrets Are Accidentally Committed

1. **Immediately rotate all exposed credentials**
2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch env.backend.dev' \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push to remote:**
   ```bash
   git push origin --force --all
   ```
4. **Update Parameter Store with new credentials**

## ✅ Best Practices Checklist

- [ ] Real environment files are gitignored
- [ ] CloudFormation templates use placeholder values only
- [ ] AWS Parameter Store is encrypted with KMS
- [ ] GitHub Actions uses OIDC (no stored credentials)
- [ ] Frontend gets only public variables
- [ ] Backend secrets are isolated
- [ ] All team members understand the workflow
- [ ] Regular security audits of Parameter Store access

## 🔗 Related Documentation

- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Setup instructions
- [AWS Parameter Store Best Practices](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-best-practices.html)
- [GitHub OIDC Security](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
